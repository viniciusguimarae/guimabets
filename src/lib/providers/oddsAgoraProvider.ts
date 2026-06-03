// src/lib/providers/oddsAgoraProvider.ts
// Adapter para OddsAgora — probe diagnóstico completo (Etapa 3)
// NÃO extrai odds. Apenas analisa a resposta HTTP e o HTML recebido.

import type { OddsProviderAdapter, ProbeResult } from './types';
import { inspectHtml } from '../server/sourceInspectionService';

const PROBE_URL = 'https://oddsagora.com.br';
const TIMEOUT_MS = 15000;
const MAX_BODY_BYTES = 500_000; // 500KB — suficiente para diagnóstico

// Headers realistas de navegador para evitar bloqueio por User-Agent simples
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

export class OddsAgoraProvider implements OddsProviderAdapter {
  readonly name = 'oddsagora';
  readonly description =
    'OddsAgora.com.br — Comparador brasileiro de odds (Etapa 4+5: parser e mapping)';

  isConfigured(): boolean {
    return true;
  }

  async probeSource(customUrl?: string): Promise<ProbeResult> {
    const start = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const targetUrl = customUrl || PROBE_URL;

    try {
      const response = await fetch(targetUrl, {
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

  async runParser(customUrl?: string): Promise<import('./types').ParseResult> {
    const probe = await this.probeSource(customUrl);
    if (!probe.reachable || !probe.statusCode) {
      return {
        provider: this.name,
        success: false,
        extractionMode: 'not_available',
        odds: [],
        diagnostics: probe,
        warnings: ['Fonte inatingível ou erro de rede'],
      };
    }

    const targetUrl = customUrl || PROBE_URL;
    let html = '';
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
      const res = await fetch(targetUrl, {
        method: 'GET',
        signal: controller.signal,
        headers: BROWSER_HEADERS,
      });
      clearTimeout(timeoutId);
      html = await res.text();
    } catch (err) {
      return {
        provider: this.name,
        success: false,
        extractionMode: 'not_available',
        odds: [],
        diagnostics: probe,
        warnings: ['Erro ao buscar HTML para o parser: ' + String(err)],
      };
    }

    const { parseOddsAgora, inspectOddsAgoraHtml } = await import('../server/oddsAgoraParserService');
    const diag = inspectOddsAgoraHtml(html);
    
    if (diag.extractionMode === 'js_rendered' || diag.extractionMode === 'api_endpoint' || diag.extractionMode === 'blocked' || diag.extractionMode === 'unknown') {
       return {
         provider: this.name,
         success: false,
         extractionMode: diag.extractionMode,
         odds: [],
         diagnostics: probe,
         warnings: ['Não foi possível extrair odds diretamente: ' + diag.extractionMode, ...diag.notes],
       };
    }

    try {
      const odds = parseOddsAgora(html);
      
      // Se retornou 0 odds mesmo o extractionMode sendo html ou next_data, é no_data
      if (odds.length === 0) {
        return {
          provider: this.name,
          success: false, // Alterado para refletir a ausência de dados úteis
          extractionMode: diag.extractionMode,
          odds: [],
          diagnostics: probe,
          warnings: ['A fonte respondeu, mas esta URL não contém odds extraíveis com o parser atual.', ...diag.notes],
        };
      }

      return {
        provider: this.name,
        success: true,
        extractionMode: diag.extractionMode,
        odds,
        diagnostics: probe,
        warnings: diag.notes,
      };
    } catch (err) {
       return {
         provider: this.name,
         success: false,
         extractionMode: diag.extractionMode,
         odds: [],
         diagnostics: probe,
         warnings: ['Erro interno no parser: ' + String(err)],
       };
    }
  }

  // Novo: Etapa 5 — Discovery
  async runDiscovery(maxUrls = 5): Promise<any> {
    const start = Date.now();
    let homeHtml = '';
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
      const res = await fetch(PROBE_URL, {
        method: 'GET',
        signal: controller.signal,
        headers: BROWSER_HEADERS,
      });
      clearTimeout(timeoutId);
      homeHtml = await res.text();
    } catch (err) {
      return { success: false, error: 'Falha ao buscar a home para iniciar discovery' };
    }

    const { discoverCandidateUrls, rankOddsAgoraUrlInspection } = await import('../server/oddsAgoraDiscoveryService');
    const { inspectOddsAgoraHtml } = await import('../server/oddsAgoraParserService');

    const discovery = discoverCandidateUrls(homeHtml, PROBE_URL);
    const urlsToInspect = discovery.prioritizedUrls.slice(0, maxUrls);
    const inspectedRoutes = [];

    for (const u of urlsToInspect) {
      const reqStart = Date.now();
      try {
        const c = new AbortController();
        const tid = setTimeout(() => c.abort(), TIMEOUT_MS);
        const r = await fetch(u, {
          method: 'GET',
          signal: c.signal,
          headers: BROWSER_HEADERS,
        });
        clearTimeout(tid);
        const txt = await r.text();
        const diag = inspectOddsAgoraHtml(txt);
        const reqElapsed = Date.now() - reqStart;
        
        const ranked = rankOddsAgoraUrlInspection(u, r.status, reqElapsed, diag);
        inspectedRoutes.push(ranked);
        
        // Rate limit simples (200ms)
        await new Promise(res => setTimeout(res, 200));
      } catch (err) {
        inspectedRoutes.push({
          url: u,
          status: 0,
          responseTimeMs: Date.now() - reqStart,
          diagnostic: { extractionMode: 'not_available', notes: [String(err)] } as any,
          score: -100,
          ranking: 'not_useful'
        });
      }
    }

    // Ordenar por score DESC
    inspectedRoutes.sort((a, b) => b.score - a.score);

    return {
      success: true,
      timeMs: Date.now() - start,
      discovery,
      inspections: inspectedRoutes
    };
  }
}

export const oddsAgoraProvider = new OddsAgoraProvider();
