// src/app/api/opportunities/route.ts
import { NextResponse } from 'next/server';
import { isSupabaseServerConfigured, getSupabaseAdmin } from '@/lib/server/supabaseAdmin';
import { runOddsLifecyclePipeline } from '@/lib/server/oddsLifecycleService';
import { invalidateOldOpportunities } from '@/lib/server/opportunityLifecycleService';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isSupabaseServerConfigured()) {
    return NextResponse.json(
      { error: 'Supabase não configurado. App rodando em modo local.' },
      { status: 503 }
    );
  }

  try {
    // Pipeline de lifecycle
    const lifecycle = await runOddsLifecyclePipeline();
    const invalidated = await invalidateOldOpportunities();

    const supabase = getSupabaseAdmin();

    const { data: opportunities, error } = await supabase
      .from('surebet_opportunities')
      .select(`
        id,
        implied_sum,
        margin_percent,
        status,
        expires_at,
        created_at,
        events(name, sport, league, start_time),
        markets(market_type, market_name),
        opportunity_legs(
          selection_name,
          bookmaker_name,
          odd_decimal,
          stake_suggestion,
          bet_link
        )
      `)
      .eq('status', 'active')
      .order('margin_percent', { ascending: false })
      .limit(100);

    if (error) throw error;

    return NextResponse.json({
      opportunities: opportunities ?? [],
      count: opportunities?.length ?? 0,
      lifecycle: { ...lifecycle, invalidated },
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Erro ao buscar oportunidades', details: String(err) },
      { status: 500 }
    );
  }
}
