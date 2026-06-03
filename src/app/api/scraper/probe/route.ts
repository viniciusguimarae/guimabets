// src/app/api/scraper/probe/route.ts
// Rota de probe diagnóstico completo — Etapa 3
// Executa probeSource() expandido e salva log no Supabase

import { NextResponse } from 'next/server';
import { requireAdminSecret } from '@/lib/server/adminAuth';
import { oddsAgoraProvider } from '@/lib/providers/oddsAgoraProvider';
import { oddspediaProvider } from '@/lib/providers/oddspediaProvider';
import type { OddsProviderAdapter, ProbeResult } from '@/lib/providers/types';
import { isSupabaseServerConfigured, getSupabaseAdmin } from '@/lib/server/supabaseAdmin';
import { summarizeSourceHealth, inspectHtml } from '@/lib/server/sourceInspectionService';

export const dynamic = 'force-dynamic';

const providers: Record<string, OddsProviderAdapter> = {
  oddsagora: oddsAgoraProvider,
  oddspedia: oddspediaProvider,
};

/** Persiste resultado do probe em provider_logs (silenciosamente) */
async function logProbeResult(result: ProbeResult): Promise<void> {
  if (!isSupabaseServerConfigured()) return;

  try {
    const supabase = getSupabaseAdmin();
    const status =
      result.blocked || result.captchaDetected
        ? 'blocked'
        : result.reachable
        ? 'success'
        : 'failed';

    const message = result.inspectionNotes?.join(' | ') ?? summarizeSourceHealth({
      hasHtml: (result.htmlSize ?? 0) > 0,
      htmlSize: result.htmlSize ?? 0,
      hasCaptcha: result.captchaDetected,
      hasCloudflare: result.cloudflareDetected,
      hasBlockedMessage: result.blocked,
      hasJsonScripts: result.jsonDetected,
      jsonScriptCount: 0,
      potentialApiEndpoints: result.potentialApiEndpoints,
      keywordHits: result.keywordHits,
      confidence: result.confidence,
      recommendation: result.recommendation,
      notes: result.inspectionNotes ?? [],
    });

    await supabase.from('provider_logs').insert({
      provider_name: result.provider,
      action: 'probe',
      status,
      message,
      response_time_ms: result.responseTimeMs ?? null,
      response_size: result.responseSize ?? null,
      provider_run_id: `probe_${Date.now()}`,
    });
  } catch {
    // Log silencioso — não bloqueia resposta ao cliente
  }
}

export async function POST(request: Request) {
  const authError = requireAdminSecret(request);
  if (authError) return authError;

  let body: { provider?: string; url?: string } = {};
  try {
    body = await request.json();
  } catch {
    // body vazio OK — probe todos
  }

  const providerName = body.provider?.toLowerCase();

  // Probe de todos os providers
  if (!providerName) {
    const results = await Promise.all(
      Object.values(providers).map(async (p) => {
        const result = await p.probeSource();
        await logProbeResult(result);
        return result;
      })
    );
    return NextResponse.json({
      results,
      count: results.length,
      probedAt: new Date().toISOString(),
    });
  }

  // Probe de provider específico
  const provider = providers[providerName];
  if (!provider) {
    return NextResponse.json(
      {
        error: `Provider desconhecido: "${providerName}"`,
        available: Object.keys(providers),
      },
      { status: 400 }
    );
  }

  // Probe de URL customizada (para testes de endpoints específicos)
  if (body.url) {
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(body.url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Accept: 'text/html,application/json,*/*',
          'Accept-Language': 'pt-BR,pt;q=0.9',
        },
      });

      clearTimeout(timeoutId);
      const elapsed = Date.now() - start;
      const buffer = await response.arrayBuffer();
      const html = new TextDecoder('utf-8', { fatal: false }).decode(
        buffer.byteLength > 500_000 ? buffer.slice(0, 500_000) : buffer
      );

      const headersMap: Record<string, string> = {};
      response.headers.forEach((v, k) => { headersMap[k] = v; });
      const inspection = inspectHtml(html, response.status, headersMap);

      const result: ProbeResult = {
        provider: `${providerName}:custom_url`,
        probedAt: new Date().toISOString(),
        reachable: response.status < 500,
        statusCode: response.status,
        responseTimeMs: elapsed,
        responseSize: buffer.byteLength,
        contentType: response.headers.get('content-type') ?? undefined,
        serverHeader: response.headers.get('server') ?? undefined,
        cfRay: response.headers.get('cf-ray') ?? undefined,
        blocked: inspection.hasBlockedMessage || inspection.hasCloudflare,
        captchaDetected: inspection.hasCaptcha,
        cloudflareDetected: inspection.hasCloudflare,
        pageTitle: inspection.title,
        htmlSize: inspection.htmlSize,
        jsonDetected: inspection.hasJsonScripts,
        potentialApiEndpoints: inspection.potentialApiEndpoints,
        keywordHits: inspection.keywordHits,
        confidence: inspection.confidence,
        recommendation: inspection.recommendation,
        inspectionNotes: inspection.notes,
      };

      await logProbeResult(result);
      return NextResponse.json(result);
    } catch (err) {
      return NextResponse.json({
        provider: `${providerName}:custom_url`,
        probedAt: new Date().toISOString(),
        reachable: false,
        statusCode: 0,
        responseTimeMs: Date.now() - start,
        blocked: false,
        captchaDetected: false,
        cloudflareDetected: false,
        jsonDetected: false,
        potentialApiEndpoints: [],
        keywordHits: [],
        confidence: 'unknown',
        recommendation: 'not_available',
        inspectionNotes: ['Erro de rede na URL customizada'],
        error: String(err),
      });
    }
  }

  // Probe padrão do provider
  const result = await provider.probeSource();
  await logProbeResult(result);

  return NextResponse.json({
    ok: result.reachable,
    provider: result.provider,
    status: result.statusCode,
    responseTimeMs: result.responseTimeMs,
    responseSize: result.responseSize,
    blocked: result.blocked,
    captchaDetected: result.captchaDetected,
    cloudflareDetected: result.cloudflareDetected,
    jsonDetected: result.jsonDetected,
    potentialApiEndpoints: result.potentialApiEndpoints,
    keywordHits: result.keywordHits,
    confidence: result.confidence,
    recommendation: result.recommendation,
    inspectionNotes: result.inspectionNotes,
    pageTitle: result.pageTitle,
    serverHeader: result.serverHeader,
    cfRay: result.cfRay,
    probedAt: result.probedAt,
  });
}
