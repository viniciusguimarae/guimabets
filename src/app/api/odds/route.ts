// src/app/api/odds/route.ts
import { NextResponse } from 'next/server';
import { isSupabaseServerConfigured, getSupabaseAdmin } from '@/lib/server/supabaseAdmin';
import { runOddsLifecyclePipeline } from '@/lib/server/oddsLifecycleService';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isSupabaseServerConfigured()) {
    return NextResponse.json(
      { error: 'Supabase não configurado. App rodando em modo local.' },
      { status: 503 }
    );
  }

  try {
    // Executar pipeline de lifecycle antes de retornar dados
    const lifecycle = await runOddsLifecyclePipeline();

    const supabase = getSupabaseAdmin();

    const { data: odds, error } = await supabase
      .from('odds_snapshots')
      .select(`
        id,
        odd_decimal,
        source,
        bet_link,
        collected_at,
        expires_at,
        status,
        market_selections(selection_name, normalized_selection_key),
        bookmakers(name, domain),
        markets(market_type, market_name),
        events(name, sport, league, start_time)
      `)
      .eq('is_active', true)
      .eq('status', 'active')
      .order('collected_at', { ascending: false })
      .limit(500);

    if (error) throw error;

    return NextResponse.json({
      odds: odds ?? [],
      count: odds?.length ?? 0,
      lifecycle,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Erro ao buscar odds', details: String(err) },
      { status: 500 }
    );
  }
}
