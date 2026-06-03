import { NextResponse } from 'next/server';
import { oddsAgoraProvider } from '@/lib/providers/oddsAgoraProvider';
import { saveProviderOdds } from '@/lib/server/saveProviderOdds';
import { getSupabaseAdmin } from '@/lib/server/supabaseAdmin';

export async function POST(req: Request) {
  try {
    const adminSecret = req.headers.get('x-admin-secret');
    if (!adminSecret || adminSecret !== process.env.GMB_ADMIN_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let mode = 'diagnostic';
    let url: string | undefined;
    try {
      const body = await req.json();
      if (body.mode === 'parse_and_save') {
        mode = 'parse_and_save';
      }
      if (body.url) {
        url = body.url;
      }
    } catch {
      // Ignorar, body opcional
    }

    const start = Date.now();
    let result;
    let logStatus = 'failed';

    if (mode === 'diagnostic') {
      const diag = await oddsAgoraProvider.probeSource(url);
      result = {
        success: diag.reachable,
        diagnostics: diag,
      };
      logStatus = diag.reachable ? 'success' : 'failed';
    } else {
      const parseResult = await oddsAgoraProvider.runParser(url);
      let savedResult = null;
      
      if (parseResult.success && parseResult.odds.length > 0) {
        savedResult = await saveProviderOdds('oddsagora', parseResult.odds);
        logStatus = 'success';
        
        // TODO: chamar recálculo?
        const supabase = getSupabaseAdmin();
        if (supabase) {
          // Trigger básico simulado
        }
      } else if (parseResult.extractionMode !== 'not_available' && parseResult.odds.length === 0) {
        logStatus = 'no_data';
      }

      result = {
        success: parseResult.success,
        extractionMode: parseResult.extractionMode,
        eventsExtracted: new Set(parseResult.odds.map(o => o.event.eventName)).size,
        marketsExtracted: new Set(parseResult.odds.map(o => o.market.name)).size,
        oddsExtracted: parseResult.odds.length,
        oddsSaved: savedResult?.oddsSaved || 0,
        warnings: parseResult.warnings,
        diagnostics: parseResult.diagnostics,
      };
    }

    // Registrar no log
    const supabase = getSupabaseAdmin();
    if (supabase) {
      await supabase.from('provider_logs').insert({
        provider_name: 'oddsagora',
        action: mode,
        status: logStatus,
        message: `Extraction mode: ${result.extractionMode || 'N/A'}. ${result.warnings?.join('; ') || ''}`,
        response_time_ms: Date.now() - start,
        response_size: result.diagnostics?.htmlSize || result.diagnostics?.responseSize || 0,
        provider_run_id: null,
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('OddsAgora Scraper Run Error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
