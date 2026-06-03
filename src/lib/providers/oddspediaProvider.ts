// src/lib/providers/oddspediaProvider.ts
// Adapter para Oddspedia — probe diagnóstico completo (Etapa 3)
// NÃO extrai odds. Apenas analisa a resposta HTTP e o HTML recebido.

import type { OddsProviderAdapter, ProbeResult } from './types';
import { inspectHtml } from '../server/sourceInspectionService';

const PROBE_URL = 'https://oddspedia.com/br/football';
const TIMEOUT_MS = 15000;
const MAX_BODY_BYTES = 500_000;

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
  Pragma: 'no-cache',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Upgrade-Insecure-Requests': '1',
};

export class OddspediaProvider implements OddsProviderAdapter {
  readonly name = 'oddspedia';
  readonly description =
    'Oddspedia.com — Comparador internacional de odds (probe diagnóstico completo)';

  isConfigured(): boolean {
    return true;
  }

  async probeSource(): Promise<ProbeResult> {
    const start = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(PROBE_URL, {
        method: 'GET',
        signal: controller.signal,
        headers: BROWSER_HEADERS,
      });

      clearTimeout(timeoutId);
      const elapsed = Date.now() - start;

      const contentType = response.headers.get('content-type') ?? undefined;
      const serverHeader = response.headers.get('server') ?? undefined;
      const cfRay = response.headers.get('cf-ray') ?? undefined;

      const headersMap: Record<string, string> = {};
      response.headers.forEach((value, key) => { headersMap[key] = value; });

      let html = '';
      let responseSize = 0;
      try {
        const buffer = await response.arrayBuffer();
        responseSize = buffer.byteLength;
        const slice = buffer.byteLength > MAX_BODY_BYTES
          ? buffer.slice(0, MAX_BODY_BYTES)
          : buffer;
        html = new TextDecoder('utf-8', { fatal: false }).decode(slice);
      } catch {
        html = '';
      }

      const inspection = inspectHtml(html, response.status, headersMap);

      return {
        provider: this.name,
        probedAt: new Date().toISOString(),
        reachable: response.status < 500,
        statusCode: response.status,
        responseTimeMs: elapsed,
        responseSize,
        contentType,
        serverHeader,
        cfRay,
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
    } catch (err) {
      clearTimeout(timeoutId);
      const elapsed = Date.now() - start;
      const isTimeout = err instanceof Error && err.name === 'AbortError';

      return {
        provider: this.name,
        probedAt: new Date().toISOString(),
        reachable: false,
        statusCode: 0,
        responseTimeMs: elapsed,
        responseSize: 0,
        blocked: false,
        captchaDetected: false,
        cloudflareDetected: false,
        jsonDetected: false,
        potentialApiEndpoints: [],
        keywordHits: [],
        confidence: 'unknown',
        recommendation: 'not_available',
        inspectionNotes: [isTimeout ? `Timeout após ${TIMEOUT_MS / 1000}s` : 'Erro de rede'],
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}

export const oddspediaProvider = new OddspediaProvider();

/*
 * NOTA SOBRE BROWSER RENDERING (Playwright — futuro):
 *
 * Oddspedia é um site moderno que pode usar SSR (Next.js/Nuxt).
 * Se probe retornar 'needs_browser_rendering', o HTML estático
 * não contém dados de odds — eles são injetados pelo JavaScript.
 *
 * Solução futura (Etapa 4+):
 *   Usar Playwright em servidor dedicado (não Vercel Serverless).
 *   Ou investigar a API interna detectada pelos potentialApiEndpoints.
 */
