// src/app/api/providers/oddspapi/import-football/route.ts
import { NextResponse } from 'next/server';
import { requireAdminSecret } from '@/lib/server/adminAuth';
import { isSupabaseServerConfigured, getSupabaseAdmin } from '@/lib/server/supabaseAdmin';
import { fetchFootballOdds } from '@/lib/providers/oddsPapiProvider';
import { saveProviderOdds } from '@/lib/server/saveProviderOdds';
import { recalculateOpportunities } from '@/lib/server/opportunityLifecycleService';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const authError = requireAdminSecret(request);
  if (authError) return authError;

  if (!isSupabaseServerConfigured()) {
    return NextResponse.json({ error: 'Supabase não configurado.' }, { status: 503 });
  }

  const start = Date.now();

  try {
    // 1. Buscar e normalizar odds
    const fetchResult = await fetchFootballOdds();
    if (!fetchResult.ok) {
      return NextResponse.json({
        ok: false,
        error: fetchResult.error || 'Falha ao buscar odds da OddsPapi',
        requestsUsed: fetchResult.requestsUsed,
        requestsRemaining: fetchResult.requestsRemaining,
      }, { status: 502 });
    }

    if (fetchResult.odds.length === 0) {
      return NextResponse.json({
        ok: false,
        error: 'Nenhuma odd retornada pela OddsPapi',
        eventsCount: fetchResult.eventsCount,
        requestsUsed: fetchResult.requestsUsed,
        requestsRemaining: fetchResult.requestsRemaining,
      });
    }

    // 2. Salvar no Supabase (source = oddspapi injetado via provider_run_id)
    const saveResult = await saveProviderOdds('oddspapi', fetchResult.odds);

    // 3. Recalcular oportunidades
    const recalcResult = await recalculateOpportunities();

    // 4. Registrar log no Supabase
    const supabase = getSupabaseAdmin();
    if (supabase) {
      await supabase.from('provider_logs').insert({
        provider_name: 'oddspapi',
        action: 'import_football',
        status: saveResult.success ? 'success' : 'failed',
        message: `Eventos: ${fetchResult.eventsCount}, Odds: ${fetchResult.odds.length}, Salvas: ${saveResult.oddsSaved}, Oportunidades: ${recalcResult.newOpportunities}`,
        response_time_ms: Date.now() - start,
        response_size: fetchResult.odds.length,
        provider_run_id: saveResult.runId,
      });
    }

    return NextResponse.json({
      ok: saveResult.success,
      source: 'oddspapi',
      eventsImported: fetchResult.eventsCount,
      oddsNormalized: fetchResult.odds.length,
      oddsSaved: saveResult.oddsSaved,
      bookmakersUpserted: saveResult.bookmakersCreated,
      eventsUpserted: saveResult.eventsCreated,
      marketsUpserted: saveResult.marketsCreated,
      opportunitiesCreated: recalcResult.newOpportunities,
      runId: saveResult.runId,
      requestsUsed: fetchResult.requestsUsed,
      requestsRemaining: fetchResult.requestsRemaining,
      error: saveResult.error,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
