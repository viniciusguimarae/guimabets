// src/lib/server/opportunityLifecycleService.ts
// Invalida oportunidades antigas e recalcula novas a partir das odds ativas

import { getSupabaseAdmin } from './supabaseAdmin';
import { runOddsLifecyclePipeline } from './oddsLifecycleService';

export interface RecalculateResult {
  invalidated: number;
  newOpportunities: number;
  processedAt: string;
  oddsLifecycle: {
    expiredOdds: number;
    eventStartedOdds: number;
  };
}

interface OddsRow {
  id: string;
  event_id: string;
  market_id: string;
  selection_id: string;
  bookmaker_id: string;
  odd_decimal: number;
  source: string;
  bet_link: string | null;
  market_selections: { selection_name: string; normalized_selection_key: string } | null;
  bookmakers: { name: string } | null;
  markets: {
    market_type: string;
    market_name: string;
    expected_outcomes_count: number | null;
    is_exhaustive_market: boolean;
  } | null;
  events: {
    name: string;
    sport: string;
    start_time: string | null;
  } | null;
}

/**
 * Invalida oportunidades cujas odds expiraram ou mercado ficou incompleto.
 */
export async function invalidateOldOpportunities(): Promise<number> {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  // 1. Oportunidades com expires_at passado
  const { data: expired } = await supabase
    .from('surebet_opportunities')
    .update({ status: 'expired', invalidated_reason: 'expired_by_time' })
    .eq('status', 'active')
    .lte('expires_at', now)
    .select('id');

  // 2. Oportunidades cujas legs têm odds inativas
  const { data: activeOpps } = await supabase
    .from('surebet_opportunities')
    .select('id, opportunity_legs(odds_snapshot_id)')
    .eq('status', 'active');

  let invalidatedByOdds = 0;

  if (activeOpps && activeOpps.length > 0) {
    for (const opp of activeOpps) {
      const legs = (opp as { id: string; opportunity_legs: { odds_snapshot_id: string | null }[] }).opportunity_legs ?? [];
      const oddsIds = legs.map((l) => l.odds_snapshot_id).filter(Boolean);

      if (oddsIds.length === 0) continue;

      const { data: activeOdds } = await supabase
        .from('odds_snapshots')
        .select('id')
        .in('id', oddsIds)
        .eq('is_active', true);

      const activeCount = activeOdds?.length ?? 0;

      if (activeCount < oddsIds.length) {
        await supabase
          .from('surebet_opportunities')
          .update({ status: 'invalidated', invalidated_reason: 'odds_expired_or_removed' })
          .eq('id', opp.id);
        invalidatedByOdds++;
      }
    }
  }

  return (expired?.length ?? 0) + invalidatedByOdds;
}

/**
 * Agrupa odds ativas por mercado e calcula se há surebet.
 * Salva novas oportunidades no banco.
 */
export async function recalculateOpportunities(): Promise<RecalculateResult> {
  const supabase = getSupabaseAdmin();

  // 1. Rodar lifecycle das odds primeiro
  const lifecycleResult = await runOddsLifecyclePipeline();

  // 2. Invalidar oportunidades antigas
  const invalidated = await invalidateOldOpportunities();

  // 3. Buscar odds ativas agrupadas por mercado
  const { data: activeOdds, error } = await supabase
    .from('odds_snapshots')
    .select(`
      id,
      event_id,
      market_id,
      selection_id,
      bookmaker_id,
      odd_decimal,
      source,
      bet_link,
      market_selections(selection_name, normalized_selection_key),
      bookmakers(name),
      markets(market_type, market_name, expected_outcomes_count, is_exhaustive_market),
      events(name, sport, start_time)
    `)
    .eq('is_active', true)
    .eq('status', 'active')
    .order('collected_at', { ascending: false });

  if (error || !activeOdds) {
    return {
      invalidated,
      newOpportunities: 0,
      processedAt: new Date().toISOString(),
      oddsLifecycle: lifecycleResult,
    };
  }

  // 4. Agrupar por market_id
  const marketGroups: Map<string, OddsRow[]> = new Map();
  for (const odd of (activeOdds as unknown as OddsRow[])) {
    if (!marketGroups.has(odd.market_id)) {
      marketGroups.set(odd.market_id, []);
    }
    marketGroups.get(odd.market_id)!.push(odd);
  }

  // 5. Para cada mercado, verificar se é surebet
  let newOpportunities = 0;

  for (const [marketId, odds] of marketGroups.entries()) {
    const market = odds[0].markets;
    if (!market) continue;

    // Agrupar por seleção: melhor odd de cada seleção por bookmaker diferente
    const selectionBestOdd: Map<string, OddsRow> = new Map();
    for (const odd of odds) {
      const key = odd.market_selections?.normalized_selection_key ?? odd.selection_id;
      const existing = selectionBestOdd.get(key);
      if (!existing || odd.odd_decimal > existing.odd_decimal) {
        selectionBestOdd.set(key, odd);
      }
    }

    // Verificar se temos todas as seleções necessárias
    const expectedCount = market.expected_outcomes_count;
    if (expectedCount && selectionBestOdd.size < expectedCount) continue;

    // Calcular implied probability sum (soma das probabilidades implícitas)
    const legs = Array.from(selectionBestOdd.values());
    const impliedSum = legs.reduce((acc, leg) => acc + 1 / leg.odd_decimal, 0);

    // É surebet se impliedSum < 1.0
    if (impliedSum >= 1.0) continue;

    const marginPercent = (1 - impliedSum) * 100;

    // Calcular stakes sugeridas (baseadas em R$ 1000)
    const totalStake = 1000;
    const stakeLegs = legs.map((leg) => ({
      ...leg,
      stake_suggestion: totalStake / (leg.odd_decimal * impliedSum),
    }));

    // Verificar se já existe oportunidade ativa para este mercado
    const { data: existing } = await supabase
      .from('surebet_opportunities')
      .select('id')
      .eq('market_id', marketId)
      .eq('status', 'active')
      .single();

    if (existing) continue; // Já existe oportunidade ativa para este mercado

    // Calcular expires_at (mínimo dos expires_at das odds)
    const now = Date.now();
    const expiresAt = new Date(now + 60 * 60 * 1000).toISOString(); // 1 hora padrão

    // Salvar oportunidade
    const { data: newOpp, error: oppError } = await supabase
      .from('surebet_opportunities')
      .insert({
        event_id: odds[0].event_id,
        market_id: marketId,
        implied_sum: impliedSum,
        margin_percent: marginPercent,
        status: 'active',
        expires_at: expiresAt,
      })
      .select('id')
      .single();

    if (oppError || !newOpp) continue;

    // Salvar legs
    await supabase.from('opportunity_legs').insert(
      stakeLegs.map((leg) => ({
        opportunity_id: newOpp.id,
        odds_snapshot_id: leg.id,
        event_id: leg.event_id,
        market_id: leg.market_id,
        selection_name: leg.market_selections?.selection_name ?? '',
        bookmaker_name: leg.bookmakers?.name ?? leg.source,
        odd_decimal: leg.odd_decimal,
        stake_suggestion: leg.stake_suggestion,
      }))
    );

    newOpportunities++;
  }

  return {
    invalidated,
    newOpportunities,
    processedAt: new Date().toISOString(),
    oddsLifecycle: lifecycleResult,
  };
}
