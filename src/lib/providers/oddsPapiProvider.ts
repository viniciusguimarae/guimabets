// src/lib/providers/oddsPapiProvider.ts
// Provider OddsPapi — fluxo oficial: /sports → /tournaments → /odds-by-tournaments
// Autenticação: query param apiKey (NUNCA Authorization header)

import type { ParsedOdd, ParsedEvent, ParsedMarket, ParsedSelection, ParsedBookmaker } from './types';

// -----------------------------------------------------------------------
// Constantes
// -----------------------------------------------------------------------
const SOCCER_SPORT_ID = 10;

// Casas prioritárias (busca flexível via slug/name)
const PRIORITY_SLUGS = [
  'bet365', 'betano', 'superbet', 'sportingbet', 'estrela', 'estrelabet',
  'kto', 'pixbet', 'betfair', 'novibet', 'esportes', 'esporte', 'betfair-exchange',
];

// Torneios prioritários para probe (por nome parcial em lowercase)
const PRIORITY_TOURNAMENT_NAMES = [
  'premier league', 'laliga', 'la liga', 'serie a', 'bundesliga',
  'champions league', 'brasileirao', 'brazil', 'brasil',
];

// Mercados aceitos nesta versão
const ACCEPTED_MARKETS = ['h2h', 'totals', 'btts', 'spreads', '1x2', 'match_winner', 'winner'];

// Mapeamento de mercados OddsPapi → GuimaBets
const MARKET_MAP: Record<string, { type: string; name: string }> = {
  h2h:          { type: '1X2',        name: 'Resultado Final (1X2)' },
  '1x2':        { type: '1X2',        name: 'Resultado Final (1X2)' },
  match_winner: { type: '1X2',        name: 'Resultado Final (1X2)' },
  winner:       { type: '1X2',        name: 'Resultado Final (1X2)' },
  totals:       { type: 'OVER_UNDER', name: 'Total de Gols (Over/Under)' },
  btts:         { type: 'BTTS',       name: 'Ambas as Equipes Marcam' },
  spreads:      { type: 'HANDICAP',   name: 'Handicap Asiático' },
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
 * Constrói URL com apiKey como query param — NUNCA via Authorization header.
 */
export function buildOddsPapiUrl(path: string, params: Record<string, string> = {}): string {
  const key = getApiKey();
  if (!key) throw new Error('ODDSPAPI_API_KEY não configurada no servidor');
  const base = getBaseUrl();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(`${base}${normalizedPath}`);
  url.searchParams.set('apiKey', key);
  for (const [k, v] of Object.entries(params)) {
    if (k !== 'apiKey') url.searchParams.set(k, v);
  }
  return url.toString();
}

function buildHeaders(): HeadersInit {
  return { Accept: 'application/json' };
}

export function apiKeyDiagnostic(): { apiKeyConfigured: boolean; apiKeyPrefix: string } {
  const key = getApiKey();
  return {
    apiKeyConfigured: !!key,
    apiKeyPrefix: key ? `${key.substring(0, 4)}...` : 'não definida',
  };
}

async function safeFetch(url: string, timeoutMs = 15000): Promise<{ ok: boolean; status: number; data: any; rawText: string }> {
  try {
    const res = await fetch(url, { headers: buildHeaders(), signal: AbortSignal.timeout(timeoutMs) });
    const rawText = await res.text();
    let data: any = null;
    try { data = JSON.parse(rawText); } catch { data = null; }
    return { ok: res.ok, status: res.status, data, rawText };
  } catch (err) {
    return { ok: false, status: 0, data: null, rawText: String(err) };
  }
}

// -----------------------------------------------------------------------
// testConnection
// -----------------------------------------------------------------------
export async function testConnection(): Promise<{
  ok: boolean; status: number; responseTimeMs: number;
  apiKeyConfigured: boolean; apiKeyPrefix: string;
  error?: string; requestsUsed?: number; requestsRemaining?: number;
}> {
  const start = Date.now();
  const diag = apiKeyDiagnostic();
  if (!diag.apiKeyConfigured) {
    return { ok: false, status: 0, responseTimeMs: 0, ...diag, error: 'ODDSPAPI_API_KEY não configurada no servidor' };
  }
  try {
    const url = buildOddsPapiUrl('/sports');
    const res = await fetch(url, { headers: buildHeaders(), signal: AbortSignal.timeout(10000) });
    const timeMs = Date.now() - start;
    const requestsUsed      = parseInt(res.headers.get('x-requests-used')      || '0') || undefined;
    const requestsRemaining = parseInt(res.headers.get('x-requests-remaining') || '0') || undefined;
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      let friendlyError = `HTTP ${res.status}: ${body.substring(0, 300)}`;
      if (body.includes('MISSING_API_KEY') || body.includes('Missing API key')) {
        friendlyError = 'A chave não foi enviada corretamente para a OddsPapi. Verifique buildOddsPapiUrl.';
      }
      return { ok: false, status: res.status, responseTimeMs: timeMs, ...diag, error: friendlyError, requestsUsed, requestsRemaining };
    }
    return { ok: true, status: res.status, responseTimeMs: timeMs, ...diag, requestsUsed, requestsRemaining };
  } catch (err) {
    return { ok: false, status: 0, responseTimeMs: Date.now() - start, ...diag, error: String(err) };
  }
}

// -----------------------------------------------------------------------
// listBookmakers — GET /v4/bookmakers
// Retorna bookmakerName + slug; busca flexível por casas prioritárias
// -----------------------------------------------------------------------
export async function listBookmakers(): Promise<{
  ok: boolean;
  totalRaw: number;
  bookmakers: Array<{ name: string; slug: string; liveOdds: boolean }>;
  priorityFound: string[];
  priorityMissing: string[];
  verdict: 'viable' | 'partial' | 'not_viable';
  error?: string;
}> {
  if (!getApiKey()) {
    return {
      ok: false, totalRaw: 0, bookmakers: [],
      priorityFound: [], priorityMissing: PRIORITY_SLUGS,
      verdict: 'not_viable',
      error: 'ODDSPAPI_API_KEY não configurada no servidor',
    };
  }

  try {
    const url = buildOddsPapiUrl('/bookmakers');
    const { ok, status, data } = await safeFetch(url);

    if (!ok) {
      return {
        ok: false, totalRaw: 0, bookmakers: [],
        priorityFound: [], priorityMissing: PRIORITY_SLUGS,
        verdict: 'not_viable',
        error: `HTTP ${status} em /bookmakers`,
      };
    }

    // A resposta pode ser array direto ou ter wrapper { data: [...] }
    const rawList: any[] = Array.isArray(data) ? data : (data?.data ?? data?.bookmakers ?? []);
    const totalRaw = rawList.length;

    const bookmakers = rawList.slice(0, 100).map((bk: any) => ({
      name:     bk.bookmakerName || bk.name || bk.title || bk.slug || '',
      slug:     bk.slug || bk.key || '',
      liveOdds: !!bk.liveOdds,
    })).filter((b) => b.name || b.slug);

    // Busca flexível: slug + name em lowercase
    const search = bookmakers.map((b) => `${b.slug} ${b.name}`.toLowerCase());

    const priorityFound   = PRIORITY_SLUGS.filter((p) => search.some((s) => s.includes(p)));
    const priorityMissing = PRIORITY_SLUGS.filter((p) => !search.some((s) => s.includes(p)));

    const verdict: 'viable' | 'partial' | 'not_viable' =
      priorityFound.length >= 3 ? 'viable' :
      priorityFound.length >= 1 ? 'partial' :
      totalRaw > 0              ? 'partial' : // tem casas, mas nenhuma prioritária => parcial
      'not_viable';

    return { ok: true, totalRaw, bookmakers: bookmakers.slice(0, 30), priorityFound, priorityMissing, verdict };
  } catch (err) {
    return {
      ok: false, totalRaw: 0, bookmakers: [],
      priorityFound: [], priorityMissing: PRIORITY_SLUGS,
      verdict: 'not_viable', error: String(err),
    };
  }
}

// -----------------------------------------------------------------------
// getSoccerSportId — confirma o sportId correto do soccer na API
// -----------------------------------------------------------------------
async function getSoccerSportId(): Promise<{ sportId: number | null; sports: any[] }> {
  try {
    const url = buildOddsPapiUrl('/sports');
    const { ok, data } = await safeFetch(url);
    if (!ok) return { sportId: null, sports: [] };

    const list: any[] = Array.isArray(data) ? data : (data?.data ?? data?.sports ?? []);

    // Procura soccer por slug ou nome
    const soccer = list.find((s: any) => {
      const slug = (s.slug || s.key || '').toLowerCase();
      const name = (s.sportName || s.name || s.title || '').toLowerCase();
      return slug.includes('soccer') || slug.includes('football') || name.includes('soccer') || name.includes('football');
    });

    const sportId = soccer?.sportId ?? soccer?.id ?? soccer?.sport_id ?? SOCCER_SPORT_ID;
    return { sportId: typeof sportId === 'number' ? sportId : parseInt(String(sportId)) || SOCCER_SPORT_ID, sports: list };
  } catch {
    return { sportId: SOCCER_SPORT_ID, sports: [] };
  }
}

// -----------------------------------------------------------------------
// getSoccerTournaments — GET /v4/tournaments?sportId=...
// -----------------------------------------------------------------------
async function getSoccerTournaments(sportId: number): Promise<{ tournaments: any[]; rawCount: number }> {
  try {
    const url = buildOddsPapiUrl('/tournaments', { sportId: String(sportId) });
    const { ok, data } = await safeFetch(url);
    if (!ok) return { tournaments: [], rawCount: 0 };

    const list: any[] = Array.isArray(data) ? data : (data?.data ?? data?.tournaments ?? []);
    return { tournaments: list, rawCount: list.length };
  } catch {
    return { tournaments: [], rawCount: 0 };
  }
}

// -----------------------------------------------------------------------
// pickBestTournaments — escolhe até 3 torneios com fixtures
// -----------------------------------------------------------------------
function pickBestTournaments(tournaments: any[]): any[] {
  // Filtrar torneios com fixtures disponíveis
  const withFixtures = tournaments.filter((t: any) => {
    const future   = t.futureFixtures   || t.future_fixtures   || 0;
    const upcoming = t.upcomingFixtures || t.upcoming_fixtures || 0;
    const live     = t.liveFixtures     || t.live_fixtures     || 0;
    return (future + upcoming + live) > 0;
  });

  // Priorizar torneios conhecidos
  const prioritized = withFixtures.filter((t: any) => {
    const name = (t.tournamentName || t.name || t.title || '').toLowerCase();
    return PRIORITY_TOURNAMENT_NAMES.some((p) => name.includes(p));
  });

  const pool = prioritized.length > 0 ? prioritized : withFixtures;

  // Ordenar por total de fixtures decrescente
  pool.sort((a, b) => {
    const totalA = (a.futureFixtures || 0) + (a.upcomingFixtures || 0) + (a.liveFixtures || 0);
    const totalB = (b.futureFixtures || 0) + (b.upcomingFixtures || 0) + (b.liveFixtures || 0);
    return totalB - totalA;
  });

  return pool.slice(0, 3);
}

// -----------------------------------------------------------------------
// footballProbe — fluxo completo sem salvar no Supabase
// -----------------------------------------------------------------------
export async function footballProbe(): Promise<{
  ok: boolean;
  sportsFound: any[];
  sportIdUsed: number | null;
  tournamentsFound: number;
  tournamentsChosen: any[];
  eventsDetected: number;
  bookmakersDetected: string[];
  marketsDetected: string[];
  oddsCount: number;
  sampleEvent?: any;
  rawShape: Record<string, unknown>;
  technicalVerdict: string;
  error?: string;
}> {
  if (!getApiKey()) {
    return {
      ok: false, sportsFound: [], sportIdUsed: null, tournamentsFound: 0,
      tournamentsChosen: [], eventsDetected: 0, bookmakersDetected: [],
      marketsDetected: [], oddsCount: 0, rawShape: {},
      technicalVerdict: 'no_api_key',
      error: 'ODDSPAPI_API_KEY não configurada no servidor',
    };
  }

  try {
    // A) Confirmar sportId do soccer
    const { sportId, sports } = await getSoccerSportId();
    const usedSportId = sportId ?? SOCCER_SPORT_ID;

    // B) Buscar torneios de futebol
    const { tournaments, rawCount } = await getSoccerTournaments(usedSportId);

    // C) Escolher torneios para probe
    const chosen = pickBestTournaments(tournaments);
    const tournamentIds = chosen
      .map((t: any) => t.tournamentId ?? t.id ?? t.tournament_id)
      .filter(Boolean)
      .map(String);

    if (tournamentIds.length === 0) {
      return {
        ok: true, sportsFound: sports.slice(0, 10), sportIdUsed: usedSportId,
        tournamentsFound: rawCount, tournamentsChosen: chosen,
        eventsDetected: 0, bookmakersDetected: [], marketsDetected: [],
        oddsCount: 0, rawShape: { sampleTournament: tournaments[0] ?? null },
        technicalVerdict: 'no_tournaments_with_fixtures',
      };
    }

    // D) Buscar odds pelos torneios escolhidos (sem bookmakers fixos — ver todos disponíveis)
    const oddsUrl = buildOddsPapiUrl('/odds-by-tournaments', {
      tournamentIds: tournamentIds.join(','),
      oddsFormat:    'decimal',
      verbosity:     '3',
    });

    const { ok: oddsOk, status: oddsStatus, data: oddsData, rawText } = await safeFetch(oddsUrl, 25000);

    if (!oddsOk) {
      return {
        ok: false, sportsFound: sports.slice(0, 10), sportIdUsed: usedSportId,
        tournamentsFound: rawCount, tournamentsChosen: chosen,
        eventsDetected: 0, bookmakersDetected: [], marketsDetected: [],
        oddsCount: 0, rawShape: {},
        technicalVerdict: 'odds_endpoint_error',
        error: `HTTP ${oddsStatus} em /odds-by-tournaments: ${rawText.substring(0, 300)}`,
      };
    }

    // E) Extrair dados da resposta
    const fixtures: any[] = Array.isArray(oddsData)
      ? oddsData
      : (oddsData?.data ?? oddsData?.fixtures ?? oddsData?.events ?? oddsData?.results ?? []);

    const bkSet     = new Set<string>();
    const marketSet = new Set<string>();
    let oddsCount   = 0;

    for (const fixture of fixtures) {
      // Bookmakers podem estar em bookmakerOdds, bookmakers, odds
      const bkList: any[] = fixture.bookmakerOdds ?? fixture.bookmakers ?? fixture.odds ?? [];
      for (const bk of bkList) {
        const bkName = bk.bookmakerName || bk.bookmaker || bk.name || bk.slug || '';
        if (bkName) bkSet.add(bkName);
        const markets: any[] = bk.markets ?? bk.odds ?? bk.market ?? [];
        for (const mkt of markets) {
          const mktName = mkt.marketName || mkt.market || mkt.key || mkt.name || '';
          if (mktName) marketSet.add(mktName);
          const outcomes: any[] = mkt.outcomes ?? mkt.selections ?? mkt.odds ?? [];
          oddsCount += outcomes.length;
        }
      }
    }

    const sampleRaw = fixtures[0];
    const sampleEvent = sampleRaw ? {
      id:       sampleRaw.fixtureId ?? sampleRaw.id ?? sampleRaw.fixture_id,
      home:     sampleRaw.homeTeam ?? sampleRaw.home_team ?? sampleRaw.home ?? '',
      away:     sampleRaw.awayTeam ?? sampleRaw.away_team ?? sampleRaw.away ?? '',
      date:     sampleRaw.startDate ?? sampleRaw.commence_time ?? sampleRaw.date ?? '',
      bkCount:  Array.isArray(sampleRaw.bookmakerOdds ?? sampleRaw.bookmakers ?? sampleRaw.odds ?? [])
                  ? (sampleRaw.bookmakerOdds ?? sampleRaw.bookmakers ?? sampleRaw.odds ?? []).length : 0,
      topKeys:  sampleRaw ? Object.keys(sampleRaw).slice(0, 12) : [],
    } : undefined;

    const technicalVerdict =
      fixtures.length === 0 ? 'no_fixtures_returned' :
      oddsCount === 0       ? 'fixtures_but_no_odds' :
      bkSet.size === 0      ? 'odds_but_no_bookmakers_parsed' :
      'viable';

    return {
      ok: true,
      sportsFound:       sports.slice(0, 15),
      sportIdUsed:       usedSportId,
      tournamentsFound:  rawCount,
      tournamentsChosen: chosen.map((t) => ({
        id:       t.tournamentId ?? t.id,
        name:     t.tournamentName ?? t.name,
        category: t.categoryName ?? t.category ?? '',
        future:   t.futureFixtures ?? 0,
        upcoming: t.upcomingFixtures ?? 0,
        live:     t.liveFixtures ?? 0,
      })),
      eventsDetected:    fixtures.length,
      bookmakersDetected: Array.from(bkSet),
      marketsDetected:    Array.from(marketSet),
      oddsCount,
      sampleEvent,
      rawShape: {
        topLevelKeys:     oddsData ? Object.keys(oddsData).slice(0, 10) : [],
        sampleFixtureKeys: sampleRaw ? Object.keys(sampleRaw).slice(0, 15) : [],
        sampleBkKeys:      (() => {
          const bkList = sampleRaw?.bookmakerOdds ?? sampleRaw?.bookmakers ?? [];
          return bkList[0] ? Object.keys(bkList[0]).slice(0, 10) : [];
        })(),
        sampleMarketKeys:  (() => {
          const bkList = sampleRaw?.bookmakerOdds ?? sampleRaw?.bookmakers ?? [];
          const mktList = bkList[0]?.markets ?? bkList[0]?.odds ?? [];
          return mktList[0] ? Object.keys(mktList[0]).slice(0, 10) : [];
        })(),
      },
      technicalVerdict,
    };
  } catch (err) {
    return {
      ok: false, sportsFound: [], sportIdUsed: null, tournamentsFound: 0,
      tournamentsChosen: [], eventsDetected: 0, bookmakersDetected: [],
      marketsDetected: [], oddsCount: 0, rawShape: {},
      technicalVerdict: 'exception', error: String(err),
    };
  }
}

// -----------------------------------------------------------------------
// Etapas do fluxo separadas para diagnóstico econômico
// -----------------------------------------------------------------------

export async function getSportsDiagnostic(): Promise<{ ok: boolean; sports: any[]; sportIdFound: number | null; error?: string }> {
  if (!getApiKey()) return { ok: false, sports: [], sportIdFound: null, error: 'ODDSPAPI_API_KEY não configurada' };
  const { sportId, sports } = await getSoccerSportId();
  return { ok: true, sports, sportIdFound: sportId ?? SOCCER_SPORT_ID };
}

export async function getTournamentsDiagnostic(sportId: number): Promise<{ ok: boolean; tournaments: any[]; rawCount: number; error?: string }> {
  if (!getApiKey()) return { ok: false, tournaments: [], rawCount: 0, error: 'ODDSPAPI_API_KEY não configurada' };
  const { tournaments, rawCount } = await getSoccerTournaments(sportId);
  return { ok: true, tournaments, rawCount };
}

export async function getOddsProbeDiagnostic(tournamentId: string): Promise<any> {
  if (!getApiKey()) return { ok: false, error: 'ODDSPAPI_API_KEY não configurada' };

  const urlObj = new URL(buildOddsPapiUrl('/odds-by-tournaments', {
    tournamentIds: tournamentId,
    oddsFormat:    'decimal',
    verbosity:     '3',
  }));
  // URL segura sem apiKey
  const safeUrl = new URL(urlObj.toString());
  safeUrl.searchParams.set('apiKey', '***');

  const { ok, status, data, rawText } = await safeFetch(urlObj.toString(), 25000);
  
  if (!ok) {
    return { ok: false, safeUrl: safeUrl.toString(), status, error: `HTTP ${status}: ${rawText.substring(0, 300)}` };
  }

  const fixtures: any[] = Array.isArray(data)
    ? data
    : (data?.data ?? data?.fixtures ?? data?.events ?? data?.results ?? []);

  let oddsCount = 0;
  for (const fixture of fixtures) {
    const bkList: any[] = fixture.bookmakerOdds ?? fixture.bookmakers ?? fixture.odds ?? [];
    for (const bk of bkList) {
      const markets: any[] = bk.markets ?? bk.odds ?? bk.market ?? [];
      for (const mkt of markets) {
        oddsCount += (mkt.outcomes ?? mkt.selections ?? mkt.odds ?? []).length;
      }
    }
  }

  const sample = fixtures[0];
  const oddsShape = {
    totalFixtures:     fixtures.length,
    oddsCount,
    topLevelKeys:      data ? Object.keys(data).slice(0, 12) : [],
    sampleFixtureKeys: sample ? Object.keys(sample).slice(0, 15) : [],
    sampleBkKeys:      (() => {
      const bl = sample?.bookmakerOdds ?? sample?.bookmakers ?? [];
      return bl[0] ? Object.keys(bl[0]).slice(0, 10) : [];
    })(),
    sampleMarketKeys:  (() => {
      const bl = sample?.bookmakerOdds ?? sample?.bookmakers ?? [];
      const ml = bl[0]?.markets ?? bl[0]?.odds ?? [];
      return ml[0] ? Object.keys(ml[0]).slice(0, 10) : [];
    })(),
  };

  let verdict = 'parcial, sem odds retornadas';
  if (fixtures.length > 0 && oddsCount > 0) verdict = 'viável tecnicamente';
  if (JSON.stringify(data).includes('plan limits')) verdict = 'plano grátis insuficiente';

  return { ok: true, safeUrl: safeUrl.toString(), status, oddsShape, verdict };
}

// -----------------------------------------------------------------------
// debugFlow — rota de debug (REMOVIDA/SUBSTITUÍDA pelas etapas acima)
// -----------------------------------------------------------------------


// -----------------------------------------------------------------------
// Normalização de entidades
// -----------------------------------------------------------------------

export function normalizeBookmaker(bkKey: string, bkTitle: string): ParsedBookmaker {
  return { name: bkTitle || bkKey, originalName: bkKey };
}

export function normalizeEvent(ev: any): ParsedEvent {
  const home = ev.homeTeam ?? ev.home_team ?? ev.home ?? '';
  const away = ev.awayTeam ?? ev.away_team ?? ev.away ?? '';
  return {
    sport:        'Futebol',
    league:       ev.tournamentName ?? ev.sport_title ?? ev.league ?? 'Futebol Internacional',
    eventName:    `${home} x ${away}`,
    eventDate:    ev.startDate ?? ev.commence_time ?? ev.date ?? undefined,
    originalText: `${home} vs ${away}`,
  };
}

export function normalizeMarket(marketKey: string): ParsedMarket | null {
  const key   = marketKey.toLowerCase().replace(/\s+/g, '_');
  const mapped = MARKET_MAP[key] ?? MARKET_MAP[marketKey];
  if (!mapped) return null;

  const baseSelections: ParsedSelection[] = [];
  if (key === 'h2h' || key === '1x2' || key === 'match_winner' || key === 'winner') {
    baseSelections.push({ name: 'Casa',   originalName: 'home' });
    baseSelections.push({ name: 'Empate', originalName: 'draw' });
    baseSelections.push({ name: 'Fora',   originalName: 'away' });
  } else if (key === 'btts') {
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
  const mkt   = marketKey.toLowerCase();
  let name    = outcomeName;

  if (mkt === 'h2h' || mkt === '1x2' || mkt === 'match_winner' || mkt === 'winner') {
    if (lower === homeTeam.toLowerCase() || lower === 'home' || lower === '1') name = 'Casa';
    else if (lower === awayTeam.toLowerCase() || lower === 'away' || lower === '2') name = 'Fora';
    else if (lower === 'draw' || lower === 'x' || lower === 'tie') name = 'Empate';
  } else if (mkt === 'btts') {
    if (lower === 'yes' || lower === 'sim') name = 'Sim';
    else if (lower === 'no' || lower === 'não' || lower === 'nao') name = 'Não';
  }

  return { name, originalName: outcomeName };
}

export function normalizeOdd(value: number | string | undefined | null): number | null {
  if (value === undefined || value === null) return null;
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num) || num <= 1.0 || num > 1000) return null;
  return Math.round(num * 100) / 100;
}

// -----------------------------------------------------------------------
// fetchFootballOdds — fluxo completo para import
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
    // 1. Descobrir sportId
    const { sportId } = await getSoccerSportId();
    const usedSportId = sportId ?? SOCCER_SPORT_ID;

    // 2. Buscar torneios
    const { tournaments } = await getSoccerTournaments(usedSportId);
    const chosen = pickBestTournaments(tournaments);
    const tournamentIds = chosen
      .map((t: any) => t.tournamentId ?? t.id ?? t.tournament_id)
      .filter(Boolean)
      .map(String);

    if (tournamentIds.length === 0) {
      return { ok: false, odds: [], eventsCount: 0, error: 'Nenhum torneio de futebol com fixtures disponíveis' };
    }

    // 3. Buscar odds
    const url = buildOddsPapiUrl('/odds-by-tournaments', {
      tournamentIds: tournamentIds.join(','),
      oddsFormat:    'decimal',
      verbosity:     '3',
    });

    const res = await fetch(url, { headers: buildHeaders(), signal: AbortSignal.timeout(25000) });
    const requestsUsed      = parseInt(res.headers.get('x-requests-used')      || '0') || undefined;
    const requestsRemaining = parseInt(res.headers.get('x-requests-remaining') || '0') || undefined;

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { ok: false, odds: [], eventsCount: 0, error: `HTTP ${res.status}: ${body.substring(0, 300)}`, requestsUsed, requestsRemaining };
    }

    const data: any = await res.json();
    const fixtures: any[] = Array.isArray(data)
      ? data
      : (data?.data ?? data?.fixtures ?? data?.events ?? data?.results ?? []);

    const parsedOdds: ParsedOdd[] = [];

    for (const fixture of fixtures) {
      const parsedEvent = normalizeEvent(fixture);
      const bkList: any[] = fixture.bookmakerOdds ?? fixture.bookmakers ?? fixture.odds ?? [];

      for (const bk of bkList) {
        const bkName = bk.bookmakerName ?? bk.bookmaker ?? bk.name ?? bk.slug ?? '';
        const bkSlug = bk.slug ?? bk.key ?? bkName;
        const parsedBookmaker = normalizeBookmaker(bkSlug, bkName);

        const markets: any[] = bk.markets ?? bk.odds ?? bk.market ?? [];
        for (const mkt of markets) {
          const marketKey = (mkt.marketName ?? mkt.market ?? mkt.key ?? mkt.name ?? '').toLowerCase().replace(/\s+/g, '_');
          const parsedMarket = normalizeMarket(marketKey);
          if (!parsedMarket) continue;

          const outcomes: any[] = mkt.outcomes ?? mkt.selections ?? mkt.odds ?? [];
          for (const outcome of outcomes) {
            const price    = outcome.price ?? outcome.odd ?? outcome.value ?? outcome.decimal;
            const oddValue = normalizeOdd(price);
            if (oddValue === null) continue;

            const selName = outcome.outcomeName ?? outcome.name ?? outcome.selection ?? '';
            const parsedSelection = normalizeSelection(
              selName,
              marketKey,
              fixture.homeTeam ?? fixture.home_team ?? '',
              fixture.awayTeam ?? fixture.away_team ?? '',
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

    return { ok: true, odds: parsedOdds, eventsCount: fixtures.length, requestsUsed, requestsRemaining };
  } catch (err) {
    return { ok: false, odds: [], eventsCount: 0, error: String(err) };
  }
}

export async function mapToGuimaBetsFormat(): Promise<ParsedOdd[]> {
  const result = await fetchFootballOdds();
  return result.odds;
}
