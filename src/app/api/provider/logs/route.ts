// src/app/api/provider/logs/route.ts
// Lista histórico de probes e ações dos providers

import { NextResponse } from 'next/server';
import { requireAdminSecret } from '@/lib/server/adminAuth';
import { isSupabaseServerConfigured, getSupabaseAdmin } from '@/lib/server/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const authError = requireAdminSecret(request);
  if (authError) return authError;

  if (!isSupabaseServerConfigured()) {
    return NextResponse.json(
      { error: 'Supabase não configurado. Logs não disponíveis em modo local.' },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(request.url);
  const providerFilter = searchParams.get('provider');
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200);

  try {
    const supabase = getSupabaseAdmin();

    let query = supabase
      .from('provider_logs')
      .select('id, provider_name, action, status, message, response_time_ms, response_size, provider_run_id, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (providerFilter) {
      query = query.eq('provider_name', providerFilter);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({
      logs: data ?? [],
      count: data?.length ?? 0,
      filter: { provider: providerFilter, limit },
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Erro ao buscar logs', details: String(err) },
      { status: 500 }
    );
  }
}
