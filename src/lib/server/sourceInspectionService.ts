// src/lib/server/sourceInspectionService.ts
// Funções puras de análise de HTML para diagnóstico de fontes de odds
// Nenhuma odd é extraída — apenas metadados diagnósticos

import type {
  SourceInspectionResult,
  RecommendationType,
  ConfidenceLevel,
} from '../providers/types';

// ============================================================
// Constantes de detecção
// ============================================================

const CAPTCHA_SIGNALS = [
  'recaptcha',
  'hcaptcha',
  'turnstile',
  'cf-challenge',
  'challenge-form',
  'captcha',
  'robot check',
  'are you a human',
  'verify you are human',
  'i am not a robot',
  'data-sitekey',
];

const CLOUDFLARE_SIGNALS = [
  'cloudflare',
  '__cf_bm',
  'cf_clearance',
  'cf-ray',
  'checking your browser',
  'please wait while we check',
  'ray id',
  'cloudflare ray',
  'attention required! | cloudflare',
  'cdn-cgi',
  'cf.challenge',
];

const BLOCKING_SIGNALS = [
  'access denied',
  '403 forbidden',
  'you have been blocked',
  'bot detected',
  'automated access',
  'this site is protected',
  'security service',
  'ip has been blocked',
  'forbidden',
  'not authorized',
];

const ODDS_KEYWORDS = [
  'odds',
  'bookmaker',
  'betano',
  'bet365',
  'apostas',
  'surebet',
  'arbitragem',
  'mercado',
  'cotacao',
  'cotação',
  'handicap',
  'over',
  'under',
  'moneyline',
  'football',
  'futebol',
  'superbet',
  'sportingbet',
  'betfair',
  'margin',
  'implied',
  'probability',
  'selection',
  'market',
  'fixture',
  'match',
  'event',
  'sport',
];

const API_ENDPOINT_PATTERNS = [
  /["'`](\/api\/[^"'`\s]{3,})/g,
  /["'`](\/v\d\/[^"'`\s]{3,})/g,
  /["'`](\/graphql[^"'`\s]*)/g,
  /["'`](\/rest\/[^"'`\s]{3,})/g,
  /["'`](\/feed\/[^"'`\s]{3,})/g,
  /["'`](\/data\/[^"'`\s]{3,})/g,
  /["'`](\/sports\/[^"'`\s]{3,})/g,
  /["'`](\/odds\/[^"'`\s]{3,})/g,
  /["'`](\/markets\/[^"'`\s]{3,})/g,
  /fetch\(["'`]([^"'`\s]{5,})/g,
  /axios\.(get|post)\(["'`]([^"'`\s]{5,})/g,
  /endpoint['":\s]+["'`]([^"'`\s]{5,})/gi,
];

const JSON_SCRIPT_PATTERNS = [
  /<script[^>]+type=["']application\/json["'][^>]*>([\s\S]{10,500}?)<\/script>/gi,
  /<script[^>]+id=["'][^"']*(?:data|props|state|__NEXT|__NUXT|__INITIAL)[^"']*["'][^>]*>/gi,
  /window\.__(?:INITIAL|NEXT|NUXT|STATE|DATA)__\s*=/gi,
  /"odds"\s*:\s*[\[{]/g,
  /"markets"\s*:\s*[\[{]/g,
  /"bookmakers"\s*:\s*[\[{]/g,
];

// ============================================================
// Funções de detecção
// ============================================================

/** Detecta presença de captcha */
export function detectCaptcha(html: string): boolean {
  const lower = html.toLowerCase();
  return CAPTCHA_SIGNALS.some((signal) => lower.includes(signal));
}

/** Detecta Cloudflare ou WAF */
export function detectCloudflare(
  html: string,
  statusCode?: number,
  headers?: Record<string, string>
): boolean {
  const lower = html.toLowerCase();
  const headerStr = JSON.stringify(headers ?? {}).toLowerCase();

  const inHtml = CLOUDFLARE_SIGNALS.some((s) => lower.includes(s));
  const inHeaders = headerStr.includes('cloudflare') || !!headers?.['cf-ray'];
  const isChallenge = statusCode === 403 && (inHtml || inHeaders);
  const is429Cf = statusCode === 429 && inHeaders;

  return inHtml || inHeaders || isChallenge || is429Cf;
}

/** Detecta mensagens de bloqueio explícito */
export function detectBlocking(html: string, statusCode?: number): { blocked: boolean; reason?: string } {
  const lower = html.toLowerCase();

  if (statusCode === 403) return { blocked: true, reason: 'HTTP 403 Forbidden' };
  if (statusCode === 429) return { blocked: true, reason: 'HTTP 429 Too Many Requests' };
  if (statusCode === 503) return { blocked: true, reason: 'HTTP 503 Service Unavailable' };

  for (const signal of BLOCKING_SIGNALS) {
    if (lower.includes(signal)) {
      return { blocked: true, reason: `Mensagem de bloqueio: "${signal}"` };
    }
  }

  return { blocked: false };
}

/** Detecta scripts com JSON embutido (dados estruturados, Next.js, etc.) */
export function detectJsonScripts(html: string): { detected: boolean; count: number } {
  let count = 0;
  for (const pattern of JSON_SCRIPT_PATTERNS) {
    const matches = html.match(new RegExp(pattern.source, pattern.flags));
    if (matches) count += matches.length;
  }
  return { detected: count > 0, count };
}

/** Detecta possíveis endpoints de API referenciados no HTML/JS */
export function detectPotentialApiEndpoints(html: string): string[] {
  const found = new Set<string>();

  for (const pattern of API_ENDPOINT_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(html)) !== null) {
      const endpoint = match[1] ?? match[2];
      if (endpoint && endpoint.length > 3 && found.size < 20) {
        found.add(endpoint);
      }
    }
  }

  return Array.from(found).slice(0, 15);
}

/** Detecta palavras-chave relacionadas a odds e mercados esportivos */
export function detectOddsKeywords(html: string): string[] {
  const lower = html.toLowerCase();
  return ODDS_KEYWORDS.filter((kw) => lower.includes(kw));
}

/** Extrai o <title> da página de forma segura */
function extractTitle(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([^<]{1,200})<\/title>/i);
  return match ? match[1].trim() : undefined;
}

// ============================================================
// Inspeção principal
// ============================================================

export function inspectHtml(
  html: string,
  statusCode?: number,
  headers?: Record<string, string>
): SourceInspectionResult {
  const notes: string[] = [];

  const hasHtml = html.length > 100;
  const htmlSize = html.length;

  if (!hasHtml) {
    notes.push('Resposta HTML muito pequena ou vazia.');
  }

  const title = extractTitle(html);
  if (title) notes.push(`Título da página: "${title}"`);

  const hasCaptcha = detectCaptcha(html);
  if (hasCaptcha) notes.push('Captcha detectado na página.');

  const hasCloudflare = detectCloudflare(html, statusCode, headers);
  if (hasCloudflare) notes.push('Cloudflare ou WAF detectado.');

  const blockResult = detectBlocking(html, statusCode);
  const hasBlockedMessage = blockResult.blocked;
  if (hasBlockedMessage) notes.push(`Bloqueio detectado: ${blockResult.reason}`);

  const jsonResult = detectJsonScripts(html);
  const hasJsonScripts = jsonResult.detected;
  if (hasJsonScripts) notes.push(`${jsonResult.count} script(s) JSON estruturado(s) detectado(s).`);

  const potentialApiEndpoints = detectPotentialApiEndpoints(html);
  if (potentialApiEndpoints.length > 0) {
    notes.push(`${potentialApiEndpoints.length} possíve(l/is) endpoint(s) de API detectado(s).`);
  }

  const keywordHits = detectOddsKeywords(html);
  if (keywordHits.length > 0) {
    notes.push(`Palavras-chave de odds encontradas: ${keywordHits.slice(0, 8).join(', ')}.`);
  } else {
    notes.push('Nenhuma palavra-chave de odds detectada — pode ser página bloqueada ou JS-rendered.');
  }

  const confidence = deriveConfidence({
    hasHtml,
    htmlSize,
    hasCaptcha,
    hasCloudflare,
    hasBlockedMessage,
    hasJsonScripts,
    keywordHits,
    statusCode,
  });

  const recommendation = deriveRecommendation({
    hasHtml,
    htmlSize,
    hasCaptcha,
    hasCloudflare,
    hasBlockedMessage,
    potentialApiEndpoints,
    keywordHits,
    statusCode,
  });

  return {
    hasHtml,
    htmlSize,
    title,
    hasCaptcha,
    hasCloudflare,
    hasBlockedMessage,
    hasJsonScripts,
    jsonScriptCount: jsonResult.count,
    potentialApiEndpoints,
    keywordHits,
    confidence,
    recommendation,
    notes,
  };
}

// ============================================================
// Derivação de confiança e recomendação
// ============================================================

interface DeriveInput {
  hasHtml: boolean;
  htmlSize: number;
  hasCaptcha: boolean;
  hasCloudflare: boolean;
  hasBlockedMessage: boolean;
  hasJsonScripts?: boolean;
  potentialApiEndpoints?: string[];
  keywordHits: string[];
  statusCode?: number;
}

export function deriveConfidence(input: DeriveInput): ConfidenceLevel {
  const { hasHtml, htmlSize, hasCaptcha, hasCloudflare, hasBlockedMessage, keywordHits, statusCode } = input;

  if (!hasHtml || statusCode === 0) return 'unknown';
  if (hasCaptcha || hasCloudflare || hasBlockedMessage) return 'low';
  if (statusCode && statusCode >= 400) return 'low';
  if (htmlSize < 5000) return 'low';
  if (keywordHits.length >= 5 && htmlSize > 50000) return 'high';
  if (keywordHits.length >= 2 && htmlSize > 10000) return 'medium';
  return 'low';
}

export function deriveRecommendation(input: DeriveInput): RecommendationType {
  const {
    hasHtml,
    htmlSize,
    hasCaptcha,
    hasCloudflare,
    hasBlockedMessage,
    potentialApiEndpoints = [],
    keywordHits,
    statusCode,
  } = input;

  // Falha total
  if (!hasHtml && !statusCode) return 'not_available';
  if (statusCode === 0 || statusCode === undefined) return 'not_available';

  // Bloqueio confirmado
  if (hasCaptcha || (hasCloudflare && hasBlockedMessage)) return 'blocked_or_risky';
  if (statusCode === 403 || statusCode === 429) return 'blocked_or_risky';

  // HTML presente mas sem conteúdo útil → precisa de browser
  if (statusCode === 200 && htmlSize < 10000 && keywordHits.length === 0) {
    return 'needs_browser_rendering';
  }

  // Muitos endpoints encontrados → padrão de API
  if (potentialApiEndpoints.length >= 3) {
    return 'inspect_network_or_api_pattern';
  }

  // Tudo OK
  if (statusCode === 200 && htmlSize >= 10000) {
    return 'candidate_for_parser';
  }

  // Cloudflare sem bloqueio total → risco moderado
  if (hasCloudflare) return 'blocked_or_risky';

  return 'not_available';
}

/** Retorna uma frase resumo legível por humano do resultado do probe */
export function summarizeSourceHealth(result: SourceInspectionResult): string {
  const rec = result.recommendation;
  const size = (result.htmlSize / 1024).toFixed(1);
  const kw = result.keywordHits.length;

  switch (rec) {
    case 'candidate_for_parser':
      return `✅ Fonte saudável — ${size}kb de HTML, ${kw} keywords de odds detectadas. Pronta para parser.`;
    case 'inspect_network_or_api_pattern':
      return `🔍 ${result.potentialApiEndpoints.length} endpoints detectados — investigar padrão de API antes do parser.`;
    case 'needs_browser_rendering':
      return `🖥️ HTML muito pequeno (${size}kb) sem keywords — fonte provavelmente renderizada por JavaScript. Requer Playwright.`;
    case 'blocked_or_risky':
      return `🔴 Fonte bloqueada — ${result.hasCaptcha ? 'Captcha' : ''}${result.hasCloudflare ? ' Cloudflare' : ''}${result.hasBlockedMessage ? ' Mensagem de bloqueio' : ''} detectado(s).`;
    case 'not_available':
      return `❌ Fonte indisponível — falha de rede ou timeout.`;
  }
}
