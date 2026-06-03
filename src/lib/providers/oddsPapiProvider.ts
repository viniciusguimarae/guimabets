// src/lib/providers/oddsPapiProvider.ts
// Provider para OddsPapi — fonte de odds reais de futebol
// Autenticação: query param apiKey (NÃO Authorization header)

import type { ParsedOdd, ParsedEvent, ParsedMarket, ParsedSelection, ParsedBookmaker } from './types';

const SPORT_FOOTBALL = 'soccer';

// Casas prioritárias para o mercado brasileiro
const PRIORITY_BOOKMAKERS = [
  'bet365', 'betano', 'superbet', 'sportingbet', 'estrelabet',
  'kto', 'pixbet', 'betfair', 'novibet', 'esportes da sorte',
  'betfair exchange',
];

// Mercados aceitos nesta versão
const ACCEPTED_MARKETS = ['h2h', 'totals', 'btts', 'spreads'];

// Mapeamento de mercados OddsPapi → GuimaBets
const MARKET_MAP: Record<string, { type: string; name: string }> = {
  h2h:     { type: '1X2',       name: 'Resultado Final (1X2)' },
  totals:  { type: 'OVER_UNDER', name: 'Total de Gols (Over/Under)' },
  btts:    { type: 'BTTS',       name: 'Ambas as Equipes Marcam' },
  spreads: { type: 'HANDICAP',   name: 'Handicap Asiático' },
};

// -----------------------------------------------------------------------
// Helpers internos
// -----------------------------------------------------------------------

function getBaseUrl(): string {
  return (process.env.ODDSPAPI_BASE_URL || 'https://api.oddspapi.io/v4').replace(/\/$/, '');
}

function getApiKey(): string | null {
  return process.env.ODDSPAPI_API_KEY || null;
}

/**
 * Constrói a URL final com apiKey como query param.
 * Nunca usa Authorization header — a OddsPapi exige apiKey na query string.
 *
 * @param path   Caminho relativo, ex: "/sports" ou "/sports/soccer/odds"
 * @param params Outros query params adicionais (sem apiKey)
 */
export function buildOddsPapiUrl(path: string, params: Record<string, string> = {}): string {
  const key = getApiKey();
  if (!key) {
    throw new Error('ODDSPAPI_API_KEY não configurada no servidor');
  }

  const base = getBaseUrl();
  // Garante que path começa com /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(`${base}${normalizedPath}`);

  // Adiciona apiKey SEMPRE como query param
  url.searchParams.set('apiKey', key);

  // Adiciona outros params preservando-os
  for (const [k, v] of Object.entries(params)) {
    if (k !== 'apiKey') { // nunca sobrescrever apiKey via params externos
      url.searchParams.set(k, v);
    }
  }

  return url.toString();
}

/**
 * Headers simples sem autenticação (apiKey vai na query string)
 */
function buildHeaders(): HeadersInit {
  return { Accept: 'application/json' };
}

/**
 * Log seguro: mostra apenas se a key existe e os 4 primeiros caracteres
 */
export function apiKeyDiagnostic(): { apiKeyConfigured: boolean; apiKeyPrefix: string } {
  const key = getApiKey();
  return {
    apiKeyConfigured: !!key,
    apiKeyPrefix: key ? `${key.substring(0, 4)}...` : 'não definida',
  };
}

// -----------------------------------------------------------------------
// testConnection — testa se a API key é válida
// -----------------------------------------------------------------------
export async function testConnection(): Promise<{
  ok: boolean;
  status: number;
  responseTimeMs: number;
  apiKeyConfigured: boolean;
  apiKeyPrefix: string;
  error?: string;
  requestsUsed?: number;
  requestsRemaining?: number;
}> {
  const start = Date.now();
  const diag = apiKeyDiagnostic();

  if (!diag.apiKeyConfigured) {
    return {
      ok: false,
      status: 0,
      responseTimeMs: 0,
      ...diag,
      error: 'ODDSPAPI_API_KEY não configurada no servidor',
    };
  }

  try {
    const url = buildOddsPapiUrl('/sports');
    const res = await fetch(url, {
      headers: buildHeaders(),
      signal: AbortSignal.timeout(10000),
    });

    const timeMs = Date.now() - start;
    const requestsUsed      = parseInt(res.headers.get('x-requests-used')      || '0') || undefined;
    const requestsRemaining = parseInt(res.headers.get('x-requests-remaining') || '0') || undefined;

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      let friendlyError = `HTTP ${res.status}: ${body.substring(0, 300)}`;

      // Detectar erro de chave ausente na API
      if (body.includes('MISSING_API_KEY') || body.includes('Missing API key')) {
        friendlyError =
          'A chave não foi enviada corretamente para a OddsPapi. Verifique provider/buildOddsPapiUrl.';
      }

      return { ok: false, status: res.status, responseTimeMs: timeMs, ...diag, error: friendlyError, requestsUsed, requestsRemaining };
    }

    return { ok: true, status: res.status, responseTimeMs: timeMs, ...diag, requestsUsed, requestsRemaining };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      responseTimeMs: Date.now() - start,
      ...diag,
      error: String(err),
    };
  }
}

// -----------------------------------------------------------------------
// listBookmakers — lista bookmakers disponíveis na conta
// -----------------------------------------------------------------------
export async function listBookmakers(): Promise<{
  ok: boolean;
  total: number;
  bookmakers: string[];
  priorityFound: string[];
  priorityMissing: string[];
  verdict: 'viable' | 'partial' | 'not_viable';
  error?: string;
}> {
  if (!getApiKey()) {
    return {
      ok: false, total: 0, bookmakers: [],
      priorityFound: [], priorityMissing: PRIORITY_BOOKMAKERS,
      verdict: 'not_viable',
      error: 'ODDSPAPI_API_KEY não configurada no servidor',
    };
  }

  try {
    const url = buildOddsPapiUrl(`/sports/${SPORT_FOOTBALL}/odds`, {
      regions: 'eu,uk,us,au',
      markets: 'h2h',
    });

    const res = await fetch(url, {
      headers: buildHeaders(),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return {
        ok: false, total: 0, bookmakers: [],
        priorityFound: [], priorityMissing: PRIORITY_BOOKMAKERS,
        verdict: 'not_viable',
        error: `HTTP ${res.status}: ${body.substring(0, 300)}`,
      };
    }

    const data = await res.json();
    const events = Array.isArray(data) ? data : [];

    // Coletar nomes únicos de bookmakers
    const bookmakerSet = new Set<string>();
    for (const event of events) {
      for (const bk of (event.bookmakers || [])) {
        bookmakerSet.add(bk.title || bk.key || '');
      }
    }

    const bookmakers     = Array.from(bookmakerSet).filter(Boolean);
    const bkLower        = bookmakers.map((b) => b.toLowerCase());
    const priorityFound  = PRIORITY_BOOKMAKERS.filter((p) => bkLower.some((b) => b.includes(p.toLowerCase())));
    const priorityMissing = PRIORITY_BOOKMAKERS.filter((p) => !bkLower.some((b) => b.includes(p.toLowerCase())));
    const verdict: 'viable' | 'partial' | 'not_viable' =
      priorityFound.length >= 3 ? 'viable' :
      priorityFound.length >= 1 ? 'partial' : 'not_viable';

    return { ok: true, total: bookmakers.length, bookmakers, priorityFound, priorityMissing, verdict };
  } catch (err) {
    return {
      ok: false, total: 0, bookmakers: [],
      priorityFound: [], priorityMissing: PRIORITY_BOOKMAKERS,
      verdict: 'not_viable',
      error: String(err),
    };
  }
}

// -----------------------------------------------------------------------
// footballProbe — proba diagnóstica sem salvar no Supabase
// -----------------------------------------------------------------------
export async function footballProbe(): Promise<{
  ok: boolean;
  eventsDetected: number;
  leaguesDetected: string[];
  marketsDetected: string[];
  bookmakersDetected: string[];
  oddsCount: number;
  sampleEvent?: any;
  structureSummary: Record<string, unknown>;
  marketVerdicts: Record<string, boolean>;
  technicalVerdict: string;
  error?: string;
}> {
  if (!getApiKey()) {
    return {
      ok: false, eventsDetected: 0, leaguesDetected: [], marketsDetected: [],
      bookmakersDetected: [], oddsCount: 0, structureSummary: {},
      marketVerdicts: {}, technicalVerdict: 'no_api_key',
      error: 'ODDSPAPI_API_KEY não configurada no servidor',
    };
  }

  try {
    const url = buildOddsPapiUrl(`/sports/${SPORT_FOOTBALL}/odds`, {
      regions: 'eu,uk',
      markets: 'h2h,totals,btts',
    });

    const res = await fetch(url, {
      headers: buildHeaders(),
      signal: AbortSignal.timeout(20000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return {
        ok: false, eventsDetected: 0, leaguesDetected: [], marketsDetected: [],
        bookmakersDetected: [], oddsCount: 0, structureSummary: {},
        marketVerdicts: {}, technicalVerdict: 'error',
        error: `HTTP ${res.status}: ${body.substring(0, 300)}`,
      };
    }

    const data   = await res.json();
    const events = Array.isArray(data) ? data : [];

    const leagueSet = new Set<string>();
    const marketSet = new Set<string>();
    const bkSet     = new Set<string>();
    let oddsCount   = 0;

    for (const ev of events) {
      leagueSet.add(ev.sport_title || ev.league || '');
      for (const bk of (ev.bookmakers || [])) {
        bkSet.add(bk.title || bk.key || '');
        for (const market of (bk.markets || [])) {
          marketSet.add(market.key || '');
          oddsCount += (market.outcomes || []).length;
        }
      }
    }

    const sampleEvent = events[0] ? {
      id:              events[0].id,
      sport:           events[0].sport_title,
      homeTeam:        events[0].home_team,
      awayTeam:        events[0].away_team,
      startTime:       events[0].commence_time,
      bookmakersCount: (events[0].bookmakers || []).length,
      marketsAvailable: (events[0].bookmakers?.[0]?.markets || []).map((m: any) => m.key),
    } : undefined;

    const marketVerdicts: Record<string, boolean> = {
      '1X2 (h2h)':           marketSet.has('h2h'),
      'Over/Under (totals)': marketSet.has('totals'),
      'Ambas Marcam (btts)': marketSet.has('btts'),
      'Handicap (spreads)':  marketSet.has('spreads'),
    };

    const viableMarkets   = Object.values(marketVerdicts).filter(Boolean).length;
    const technicalVerdict =
      events.length === 0    ? 'no_events_returned' :
      viableMarkets === 0    ? 'no_viable_markets' :
      viableMarkets >= 2     ? 'viable_multiple_markets' : 'viable_partial_markets';

    return {
      ok: true,
      eventsDetected:    events.length,
      leaguesDetected:   Array.from(leagueSet).filter(Boolean),
      marketsDetected:   Array.from(marketSet).filter(Boolean),
      bookmakersDetected: Array.from(bkSet).filter(Boolean),
      oddsCount,
      sampleEvent,
      structureSummary: {
        totalEvents:    events.length,
        fieldsInEvent:  events[0] ? Object.keys(events[0]) : [],
        bookmakerFields: events[0]?.bookmakers?.[0] ? Object.keys(events[0].bookmakers[0]) : [],
        marketFields:   events[0]?.bookmakers?.[0]?.markets?.[0] ? Object.keys(events[0].bookmakers[0].markets[0]) : [],
      },
      marketVerdicts,
      technicalVerdict,
    };
  } catch (err) {
    return {
      ok: false, eventsDetected: 0, leaguesDetected: [], marketsDetected: [],
      bookmakersDetected: [], oddsCount: 0, structureSummary: {},
      marketVerdicts: {}, technicalVerdict: 'exception',
      error: String(err),
    };
  }
}

// -----------------------------------------------------------------------
// Normalização de entidades
// -----------------------------------------------------------------------

export function normalizeBookmaker(bkKey: string, bkTitle: string): ParsedBookmaker {
  return { name: bkTitle || bkKey, originalName: bkKey };
}

export function normalizeEvent(ev: any): ParsedEvent {
  return {
    sport:        'Futebol',
    league:       ev.sport_title || ev.league || 'Futebol Internacional',
    eventName:    `${ev.home_team} x ${ev.away_team}`,
    eventDate:    ev.commence_time || undefined,
    originalText: `${ev.home_team} vs ${ev.away_team}`,
  };
}

export function normalizeMarket(marketKey: string): ParsedMarket | null {
  const mapped = MARKET_MAP[marketKey];
  if (!mapped) return null;

  const baseSelections: ParsedSelection[] = [];
  if (marketKey === 'h2h') {
    baseSelections.push({ name: 'Casa',   originalName: 'home' });
    baseSelections.push({ name: 'Empate', originalName: 'draw' });
    baseSelections.push({ name: 'Fora',   originalName: 'away' });
  } else if (marketKey === 'btts') {
    baseSelections.push({ name: 'Sim', originalName: 'Yes' });
    baseSelections.push({ name: 'Não', originalName: 'No' });
  }

  return { type: mapped.type, name: mapped.name, originalName: marketKey, selections: baseSelections };
}

export function normalizeSelection(
  outcomeName: string,
  marketKey: string,
  homeTeam: string,
  awayTeam: string,
): ParsedSelection {
  const lower = outcomeName.toLowerCase();
  let name = outcomeName;

  if (marketKey === 'h2h') {
    if (lower === homeTeam.toLowerCase() || lower === 'home') name = 'Casa';
    else if (lower === awayTeam.toLowerCase() || lower === 'away') name = 'Fora';
    else if (lower === 'draw') name = 'Empate';
  } else if (marketKey === 'btts') {
    if (lower === 'yes') name = 'Sim';
    else if (lower === 'no') name = 'Não';
  }

  return { name, originalName: outcomeName };
}

export function normalizeOdd(value: number | string): number | null {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num) || num <= 1.0 || num > 1000) return null;
  return Math.round(num * 100) / 100;
}

// -----------------------------------------------------------------------
// fetchFootballOdds — busca odds e normaliza para ParsedOdd[]
// -----------------------------------------------------------------------
export async function fetchFootballOdds(): Promise<{
  ok: boolean;
  odds: ParsedOdd[];
  eventsCount: number;
  error?: string;
  requestsUsed?: number;
  requestsRemaining?: number;
}> {
  if (!getApiKey()) {
    return { ok: false, odds: [], eventsCount: 0, error: 'ODDSPAPI_API_KEY não configurada no servidor' };
  }

  try {
    const url = buildOddsPapiUrl(`/sports/${SPORT_FOOTBALL}/odds`, {
      regions:    'eu,uk',
      markets:    ACCEPTED_MARKETS.join(','),
      oddsFormat: 'decimal',
    });

    const res = await fetch(url, {
      headers: buildHeaders(),
      signal:  AbortSignal.timeout(20000),
    });

    const requestsUsed      = parseInt(res.headers.get('x-requests-used')      || '0') || undefined;
    const requestsRemaining = parseInt(res.headers.get('x-requests-remaining') || '0') || undefined;

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return {
        ok: false, odds: [], eventsCount: 0,
        error: `HTTP ${res.status}: ${body.substring(0, 300)}`,
        requestsUsed,
        requestsRemaining,
      };
    }

    const data   = await res.json();
    const events = Array.isArray(data) ? data : [];
    const parsedOdds: ParsedOdd[] = [];

    for (const ev of events) {
      const parsedEvent = normalizeEvent(ev);

      for (const bk of (ev.bookmakers || [])) {
        const parsedBookmaker = normalizeBookmaker(bk.key || '', bk.title || bk.key || '');

        for (const market of (bk.markets || [])) {
          const marketKey = market.key || '';
          if (!ACCEPTED_MARKETS.includes(marketKey)) continue;

          const parsedMarket = normalizeMarket(marketKey);
          if (!parsedMarket) continue;

          for (const outcome of (market.outcomes || [])) {
            const oddValue = normalizeOdd(outcome.price);
            if (oddValue === null) continue;

            const parsedSelection = normalizeSelection(
              outcome.name || '',
              marketKey,
              ev.home_team || '',
              ev.away_team || '',
            );

            parsedOdds.push({
              event:     parsedEvent,
              market:    { ...parsedMarket },
              selection: parsedSelection,
              bookmaker: parsedBookmaker,
              value:     oddValue,
            });
          }
        }
      }
    }

    return { ok: true, odds: parsedOdds, eventsCount: events.length, requestsUsed, requestsRemaining };
  } catch (err) {
    return { ok: false, odds: [], eventsCount: 0, error: String(err) };
  }
}

// -----------------------------------------------------------------------
// mapToGuimaBetsFormat — wrapper geral (alias de fetchFootballOdds)
// -----------------------------------------------------------------------
export async function mapToGuimaBetsFormat(): Promise<ParsedOdd[]> {
  const result = await fetchFootballOdds();
  return result.odds;
}
