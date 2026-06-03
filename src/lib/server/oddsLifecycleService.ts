// src/lib/server/oddsLifecycleService.ts
// Gerencia o ciclo de vida das odds no servidor (expiração, staleness, etc.)

import { getSupabaseAdmin } from './supabaseAdmin';

export interface LifecycleResult {
  expiredOdds: number;
  eventStartedOdds: number;
  staleOdds: number;
  processedAt: string;
}

/**
 * Retorna TTL padrão em minutos baseado no contexto.
 * Pré-jogo normal: 60 minutos
 * Futuros: poderíamos ter regras por esporte, mercado etc.
 */
export function getDefaultTTLMinutes(_context?: { sport?: string; marketType?: string }): number {
  return 60;
}

/**
 * Expira odds cujo expires_at já passou.
 * Atualiza status para 'expired' e is_active para false.
 */
export async function expireOldOdds(): Promise<number> {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('odds_snapshots')
    .update({ status: 'expired', is_active: false })
    .eq('is_active', true)
    .lte('expires_at', now)
    .select('id');

  if (error) {
    console.error('[oddsLifecycle] Erro ao expirar odds:', error.message);
    return 0;
  }

  return data?.length ?? 0;
}

/**
 * Marca como 'event_started' as odds de eventos que já começaram.
 * Útil para filtrar do radar de pré-jogo.
 */
export async function markEventStartedOdds(): Promise<number> {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  // Busca IDs de eventos já iniciados
  const { data: startedEvents } = await supabase
    .from('events')
    .select('id')
    .lt('start_time', now)
    .eq('status', 'scheduled');

  if (!startedEvents || startedEvents.length === 0) return 0;

  const eventIds = startedEvents.map((e: { id: string }) => e.id);

  // Marca esses eventos como 'live'
  await supabase
    .from('events')
    .update({ status: 'live' })
    .in('id', eventIds);

  // Marca odds desses eventos como event_started
  const { data: updatedOdds } = await supabase
    .from('odds_snapshots')
    .update({ status: 'event_started', is_active: false })
    .eq('is_active', true)
    .in('event_id', eventIds)
    .select('id');

  return updatedOdds?.length ?? 0;
}

/**
 * Marca odds de uma rodada específica que não foram vistas novamente como 'stale'.
 * Use quando um provider faz uma nova coleta completa: odds que sumiram ficam stale.
 */
export async function markMissingOddsAsStale(
  providerName: string,
  currentRunId: string
): Promise<number> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('odds_snapshots')
    .update({ status: 'stale', is_active: false })
    .eq('source', providerName)
    .eq('is_active', true)
    .neq('provider_run_id', currentRunId)
    .select('id');

  if (error) {
    console.error('[oddsLifecycle] Erro ao marcar stale:', error.message);
    return 0;
  }

  return data?.length ?? 0;
}

/**
 * Pipeline completo de ciclo de vida: expira + marca event_started.
 * Deve ser chamado antes de qualquer leitura de odds ativas.
 */
export async function runOddsLifecyclePipeline(): Promise<LifecycleResult> {
  const [expiredOdds, eventStartedOdds] = await Promise.all([
    expireOldOdds(),
    markEventStartedOdds(),
  ]);

  return {
    expiredOdds,
    eventStartedOdds,
    staleOdds: 0,
    processedAt: new Date().toISOString(),
  };
}
