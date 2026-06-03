import { NextResponse } from 'next/server';
import { oddsAgoraProvider } from '@/lib/providers/oddsAgoraProvider';
import { getSupabaseAdmin } from '@/lib/server/supabaseAdmin';

export async function POST(req: Request) {
  try {
    const adminSecret = req.headers.get('x-admin-secret');
    if (!adminSecret || adminSecret !== process.env.GMB_ADMIN_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let maxUrls = 5;
    try {
      const body = await req.json();
      if (typeof body.maxUrls === 'number') {
        maxUrls = body.maxUrls;
      }
    } catch {
      // ignore
    }

    const start = Date.now();
    const result = await oddsAgoraProvider.runDiscovery(maxUrls);

    // Registrar log
    const supabase = getSupabaseAdmin();
    if (supabase) {
      await supabase.from('provider_logs').insert({
        provider_name: 'oddsagora',
        action: 'discover',
        status: result.success ? 'success' : 'failed',
        message: `Descobertas: ${result.discovery?.discoveredUrls?.length || 0}. Inspecionadas: ${result.inspections?.length || 0}`,
        response_time_ms: Date.now() - start,
        response_size: 0,
        provider_run_id: null,
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('OddsAgora Discovery Error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
