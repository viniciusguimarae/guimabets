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
    try {
      const body = await req.json();
      if (body.mode === 'parse_and_save') {
        mode = 'parse_and_save';
      }
    } catch {
      // Ignorar, body opcional
    }

    const start = Date.now();
    let result;

    if (mode === 'diagnostic') {
      const diag = await oddsAgoraProvider.probeSource();
      result = {
        success: diag.reachable,
        diagnostics: diag,
      };
    } else {
      const parseResult = await oddsAgoraProvider.runParser();
      let savedResult = null;
      
      if (parseResult.success && parseResult.odds.length > 0) {
        savedResult = await saveProviderOdds('oddsagora', parseResult.odds);
        
        // TODO: chamar recálculo?
        // Como o Supabase Admin aqui não dispara recálculo fácil (depende de API route),
        // O recálculo pode ser disparado depois. Ou podemos instanciar o lifecycle aqui.
        const supabase = getSupabaseAdmin();
        if (supabase) {
          // Apenas um trigger básico para simular o recálculo via proxy.
          // Na vida real, chamaríamos o lifecycleProvider.
          // Fetch próprio endpoint interno se fosse necessário.
        }
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
        status: result.success ? 'success' : 'failed',
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
