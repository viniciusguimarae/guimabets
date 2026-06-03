// src/lib/providers/mockProvider.ts
// Gera dados realistas de odds e surebets no Supabase para desenvolvimento/testes

import { getSupabaseAdmin } from '../server/supabaseAdmin';
import { getDefaultTTLMinutes } from '../server/oddsLifecycleService';
import type { OddsProviderAdapter, ProbeResult } from './types';

const MOCK_EVENTS = [
  {
    sport: 'futebol',
    league: 'Brasileirão Série A',
    matches: [
      { home: 'Flamengo', away: 'Palmeiras' },
      { home: 'Corinthians', away: 'São Paulo' },
      { home: 'Grêmio', away: 'Internacional' },
      { home: 'Atlético-MG', away: 'Cruzeiro' },
    ],
  },
  {
    sport: 'futebol',
    league: 'Premier League',
    matches: [
      { home: 'Manchester City', away: 'Arsenal' },
      { home: 'Liverpool', away: 'Chelsea' },
    ],
  },
  {
    sport: 'futebol',
    league: 'La Liga',
    matches: [{ home: 'Real Madrid', away: 'Barcelona' }],
  },
];

const MOCK_BOOKMAKERS = [
  { name: 'Bet365', domain: 'bet365.com' },
  { name: 'Betano', domain: 'betano.com' },
  { name: 'Superbet', domain: 'superbet.com' },
  { name: 'KTO', domain: 'kto.com' },
  { name: 'Betfair Exchange', domain: 'betfair.com/exchange' },
  { name: 'EstrelaBet', domain: 'estrelabet.com' },
];

function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function roundOdd(val: number): number {
  return Math.round(val * 100) / 100;
}

/**
 * Gera odds para um mercado 1X2 onde há garantia de surebet.
 * A soma das probabilidades implícitas é forçada para < 1.0 em 50% dos casos.
 */
function generateSurebetOdds1X2(forceSurebet = false): {
  home: number;
  draw: number;
  away: number;
  isSurebet: boolean;
} {
  if (forceSurebet) {
    // Criar surebet garantida: distribui probabilidades que somam < 1
    const impliedHome = randomBetween(0.28, 0.38);
    const impliedDraw = randomBetween(0.26, 0.32);
    const impliedAway = randomBetween(0.22, 0.30);
    const total = impliedHome + impliedDraw + impliedAway;

    // Escalar para que a soma seja < 0.97 (garantia de surebet de ~3%)
    const scale = randomBetween(0.93, 0.97) / total;

    return {
      home: roundOdd(1 / (impliedHome * scale)),
      draw: roundOdd(1 / (impliedDraw * scale)),
      away: roundOdd(1 / (impliedAway * scale)),
      isSurebet: true,
    };
  }

  // Mercado normal sem surebet
  const home = roundOdd(randomBetween(1.5, 4.0));
  const draw = roundOdd(randomBetween(2.8, 4.2));
  const away = roundOdd(randomBetween(1.5, 5.5));
  return { home, draw, away, isSurebet: false };
}

export class MockProvider implements OddsProviderAdapter {
  readonly name = 'mock';
  readonly description = 'Provider de dados mock para desenvolvimento e testes internos';

  isConfigured(): boolean {
    return true; // Mock sempre disponível
  }

  async probeSource(): Promise<ProbeResult> {
    return {
      provider: this.name,
      reachable: true,
      responseTimeMs: 0,
      probedAt: new Date().toISOString(),
    };
  }

  async generateData(): Promise<{
    eventsCreated: number;
    oddsCreated: number;
    surebetsGuaranteed: number;
    runId: string;
  }> {
    const supabase = getSupabaseAdmin();
    const runId = `mock_${Date.now()}`;
    const ttlMinutes = getDefaultTTLMinutes();
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();

    let eventsCreated = 0;
    let oddsCreated = 0;
    let surebetsGuaranteed = 0;

    // Garantir bookmakers no banco
    const bookmakerIds: Map<string, string> = new Map();
    for (const bm of MOCK_BOOKMAKERS) {
      const { data } = await supabase
        .from('bookmakers')
        .upsert({ name: bm.name, domain: bm.domain, is_active: true }, { onConflict: 'name' })
        .select('id, name')
        .single();
      if (data) bookmakerIds.set(data.name, data.id);
    }

    for (const league of MOCK_EVENTS) {
      for (const match of league.matches) {
        const eventName = `${match.home} x ${match.away}`;
        const startTime = new Date(Date.now() + randomBetween(2, 72) * 60 * 60 * 1000).toISOString();
        const forceSurebet = Math.random() < 0.5; // 50% das partidas terão surebet garantida

        // Criar evento
        const { data: event } = await supabase
          .from('events')
          .insert({
            sport: league.sport,
            league: league.league,
            name: eventName,
            start_time: startTime,
            status: 'scheduled',
            source: 'mock',
            source_event_id: `mock_${runId}_${eventsCreated}`,
          })
          .select('id')
          .single();

        if (!event) continue;
        eventsCreated++;

        // Criar mercado 1X2
        const { data: market } = await supabase
          .from('markets')
          .insert({
            event_id: event.id,
            market_type: '1x2',
            market_name: 'Resultado Final',
            expected_outcomes_count: 3,
            is_exhaustive_market: true,
          })
          .select('id')
          .single();

        if (!market) continue;

        // Criar seleções do mercado
        const selections = [
          { name: 'Casa', key: 'home', order: 1 },
          { name: 'Empate', key: 'draw', order: 2 },
          { name: 'Fora', key: 'away', order: 3 },
        ];

        const selectionIds: Map<string, string> = new Map();
        for (const sel of selections) {
          const { data: selData } = await supabase
            .from('market_selections')
            .insert({
              market_id: market.id,
              selection_name: sel.name,
              normalized_selection_key: sel.key,
              outcome_order: sel.order,
            })
            .select('id')
            .single();
          if (selData) selectionIds.set(sel.key, selData.id);
        }

        // Gerar odds distribuídas entre bookmakers
        const odds1x2 = generateSurebetOdds1X2(forceSurebet);
        if (odds1x2.isSurebet) surebetsGuaranteed++;

        const bookmakerList = MOCK_BOOKMAKERS.map((bm) => bm.name);

        // Distribuir as melhores odds entre bookmakers diferentes para criar surebet
        const oddsToInsert: Array<{
          event_id: string;
          market_id: string;
          selection_id: string;
          bookmaker_id: string;
          odd_decimal: number;
          source: string;
          bet_link: string | null;
          status: string;
          is_active: boolean;
          provider_run_id: string;
          expires_at: string;
        }> = [];

        const selKeys = ['home', 'draw', 'away'] as const;
        const selOdds = [odds1x2.home, odds1x2.draw, odds1x2.away];

        // Para cada seleção, criar odds em todos os bookmakers (com leve variação)
        for (let si = 0; si < selKeys.length; si++) {
          const selKey = selKeys[si];
          const bestOdd = selOdds[si];
          const selId = selectionIds.get(selKey);
          if (!selId) continue;

          // Shuffle bookmakers para distribuir odds melhores
          const shuffled = [...bookmakerList].sort(() => Math.random() - 0.5);

          for (let bi = 0; bi < Math.min(shuffled.length, 4); bi++) {
            const bmName = shuffled[bi];
            const bmId = bookmakerIds.get(bmName);
            if (!bmId) continue;

            // O primeiro bookmaker tem a melhor odd, os outros têm odds piores
            const variationFactor = bi === 0 ? 1.0 : randomBetween(0.92, 0.99);
            const odd = roundOdd(bestOdd * variationFactor);

            oddsToInsert.push({
              event_id: event.id,
              market_id: market.id,
              selection_id: selId,
              bookmaker_id: bmId,
              odd_decimal: odd,
              source: 'mock',
              bet_link: null,
              status: 'active',
              is_active: true,
              provider_run_id: runId,
              expires_at: expiresAt,
            });
          }
        }

        if (oddsToInsert.length > 0) {
          await supabase.from('odds_snapshots').insert(oddsToInsert);
          oddsCreated += oddsToInsert.length;
        }

        // Também criar mercado Over/Under 2.5 para alguns jogos
        if (Math.random() < 0.6) {
          const { data: ouMarket } = await supabase
            .from('markets')
            .insert({
              event_id: event.id,
              market_type: 'over_under',
              market_name: 'Total de Gols — Over/Under 2.5',
              expected_outcomes_count: 2,
              is_exhaustive_market: true,
            })
            .select('id')
            .single();

          if (ouMarket) {
            const { data: overSel } = await supabase
              .from('market_selections')
              .insert({ market_id: ouMarket.id, selection_name: 'Over 2.5', normalized_selection_key: 'over_2_5', outcome_order: 1 })
              .select('id').single();

            const { data: underSel } = await supabase
              .from('market_selections')
              .insert({ market_id: ouMarket.id, selection_name: 'Under 2.5', normalized_selection_key: 'under_2_5', outcome_order: 2 })
              .select('id').single();

            if (overSel && underSel) {
              const forceOUSurebet = Math.random() < 0.4;
              const impliedOver = forceOUSurebet ? randomBetween(0.44, 0.48) : randomBetween(0.49, 0.54);
              const impliedUnder = forceOUSurebet ? randomBetween(0.44, 0.48) : randomBetween(0.49, 0.54);

              const ouOdds = [
                { selId: overSel.id, odd: roundOdd(1 / impliedOver), bmName: 'Bet365' },
                { selId: underSel.id, odd: roundOdd(1 / impliedUnder), bmName: 'Betfair Exchange' },
              ];

              const ouInserts = ouOdds
                .map((o) => ({
                  event_id: event.id,
                  market_id: ouMarket.id,
                  selection_id: o.selId,
                  bookmaker_id: bookmakerIds.get(o.bmName) ?? '',
                  odd_decimal: o.odd,
                  source: 'mock',
                  bet_link: null,
                  status: 'active',
                  is_active: true,
                  provider_run_id: runId,
                  expires_at: expiresAt,
                }))
                .filter((o) => o.bookmaker_id);

              if (ouInserts.length > 0) {
                await supabase.from('odds_snapshots').insert(ouInserts);
                oddsCreated += ouInserts.length;
              }
            }
          }
        }
      }
    }

    // Log da rodada
    await supabase.from('provider_logs').insert({
      provider_name: this.name,
      action: 'generate_data',
      status: 'success',
      message: `Gerados: ${eventsCreated} eventos, ${oddsCreated} odds, ${surebetsGuaranteed} surebets garantidas`,
      provider_run_id: runId,
    });

    return { eventsCreated, oddsCreated, surebetsGuaranteed, runId };
  }
}

export const mockProvider = new MockProvider();
