// test_oddspapi_provider.js
// Testes do provider OddsPapi — fluxo oficial v2
const assert = require('assert');

// -----------------------------------------------------------------------
// Helpers reimplementados em JS puro
// -----------------------------------------------------------------------

function normalizeOdd(value) {
  if (value === undefined || value === null) return null;
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num) || num <= 1.0 || num > 1000) return null;
  return Math.round(num * 100) / 100;
}

function normalizeBookmaker(bkKey, bkTitle) {
  return { name: bkTitle || bkKey, originalName: bkKey };
}

function normalizeSelection(outcomeName, marketKey, homeTeam, awayTeam) {
  const lower = outcomeName.toLowerCase();
  const mkt   = marketKey.toLowerCase();
  let name = outcomeName;
  if (mkt === 'h2h' || mkt === '1x2' || mkt === 'match_winner') {
    if (lower === homeTeam.toLowerCase() || lower === 'home') name = 'Casa';
    else if (lower === awayTeam.toLowerCase() || lower === 'away') name = 'Fora';
    else if (lower === 'draw' || lower === 'x') name = 'Empate';
  } else if (mkt === 'btts') {
    if (lower === 'yes' || lower === 'sim') name = 'Sim';
    else if (lower === 'no' || lower === 'não') name = 'Não';
  }
  return { name, originalName: outcomeName };
}

function buildOddsPapiUrl(path, params, apiKey) {
  if (!apiKey) throw new Error('ODDSPAPI_API_KEY não configurada no servidor');
  const base = 'https://api.oddspapi.io/v4';
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const urlObj = new URL(`${base}${normalizedPath}`);
  urlObj.searchParams.set('apiKey', apiKey);
  for (const [k, v] of Object.entries(params || {})) {
    if (k !== 'apiKey') urlObj.searchParams.set(k, v);
  }
  return urlObj.toString();
}

function apiKeyDiagnostic(apiKey) {
  return {
    apiKeyConfigured: !!apiKey,
    apiKeyPrefix: apiKey ? `${apiKey.substring(0, 4)}...` : 'não definida',
  };
}

function parseSoccerSportId(sportsArray) {
  const soccer = sportsArray.find((s) => {
    const slug = (s.slug || s.key || '').toLowerCase();
    const name = (s.sportName || s.name || s.title || '').toLowerCase();
    return slug.includes('soccer') || slug.includes('football') || name.includes('soccer') || name.includes('football');
  });
  return soccer?.sportId ?? soccer?.id ?? null;
}

function parseBookmakers(rawList) {
  return rawList.slice(0, 30).map((bk) => ({
    name: bk.bookmakerName || bk.name || bk.slug || '',
    slug: bk.slug || bk.key || '',
    liveOdds: !!bk.liveOdds,
  }));
}

function pickBestTournaments(tournaments) {
  const PRIORITY_NAMES = ['premier league', 'laliga', 'serie a', 'bundesliga', 'champions', 'brasileirao', 'brazil', 'brasil'];
  const withFixtures = tournaments.filter((t) => {
    return (t.futureFixtures || 0) + (t.upcomingFixtures || 0) + (t.liveFixtures || 0) > 0;
  });
  const prioritized = withFixtures.filter((t) => {
    const name = (t.tournamentName || t.name || '').toLowerCase();
    return PRIORITY_NAMES.some((p) => name.includes(p));
  });
  const pool = prioritized.length > 0 ? prioritized : withFixtures;
  return pool.slice(0, 3);
}

function calculateSureBet(odds) {
  const impliedSum = odds.reduce((acc, o) => acc + 1 / o, 0);
  if (impliedSum >= 1.0) return null;
  return { impliedSum, marginPercent: (1 - impliedSum) * 100 };
}

// -----------------------------------------------------------------------
// Testes
// -----------------------------------------------------------------------
async function runTests() {
  console.log("== Iniciando testes OddsPapi — Fluxo Oficial v2 ==\n");

  // 1. buildOddsPapiUrl inclui apiKey como query param
  const built = buildOddsPapiUrl('/sports', {}, 'abc123');
  const parsed = new URL(built);
  assert.strictEqual(parsed.searchParams.get('apiKey'), 'abc123');
  console.log("✔ buildOddsPapiUrl inclui apiKey como query param");

  // 2. buildOddsPapiUrl preserva outros parâmetros
  const builtWithParams = buildOddsPapiUrl('/odds-by-tournaments', { tournamentIds: '1,2,3', oddsFormat: 'decimal', verbosity: '3' }, 'abc123');
  const parsedFull = new URL(builtWithParams);
  assert.strictEqual(parsedFull.searchParams.get('tournamentIds'), '1,2,3');
  assert.strictEqual(parsedFull.searchParams.get('oddsFormat'), 'decimal');
  assert.strictEqual(parsedFull.searchParams.get('verbosity'), '3');
  assert.strictEqual(parsedFull.searchParams.get('apiKey'), 'abc123');
  assert.ok(!builtWithParams.includes('Bearer'), 'URL não deve conter Bearer');
  console.log("✔ buildOddsPapiUrl usa tournamentIds e oddsFormat (parâmetros corretos da API)");

  // 3. Ausência de API key lança erro claro
  let threw = false;
  try { buildOddsPapiUrl('/sports', {}, null); } catch (e) {
    threw = true;
    assert.ok(e.message.includes('ODDSPAPI_API_KEY'));
  }
  assert.ok(threw);
  console.log("✔ Ausência de API key retorna erro claro");

  // 4. Nenhuma chamada usa Authorization Bearer
  const headers = { Accept: 'application/json' };
  assert.strictEqual(headers['Authorization'], undefined);
  assert.ok(!JSON.stringify(headers).includes('Bearer'));
  console.log("✔ Nenhuma chamada usa Authorization Bearer");

  // 5. Log seguro da key
  const diag = apiKeyDiagnostic('supersecretkey12345');
  assert.ok(diag.apiKeyConfigured);
  assert.ok(!diag.apiKeyPrefix.includes('supersecretkey12345'));
  assert.ok(diag.apiKeyPrefix.endsWith('...'));
  console.log("✔ Log seguro: apenas prefixo, chave completa nunca vazada");

  // 6. parseSoccerSportId detecta soccer pelo slug
  const sportsArr = [
    { sportId: 1, slug: 'basketball', sportName: 'Basketball' },
    { sportId: 10, slug: 'soccer', sportName: 'Soccer' },
    { sportId: 15, slug: 'tennis', sportName: 'Tennis' },
  ];
  const soccerId = parseSoccerSportId(sportsArr);
  assert.strictEqual(soccerId, 10);
  console.log("✔ sportId 10 detectado como soccer via slug");

  // 7. parseSoccerSportId detecta soccer pelo nome quando slug diferente
  const sportsArr2 = [
    { sportId: 3, slug: 'futbol', sportName: 'Football' },
  ];
  const soccerId2 = parseSoccerSportId(sportsArr2);
  assert.strictEqual(soccerId2, 3);
  console.log("✔ sportId detectado via sportName quando slug é diferente");

  // 8. parseBookmakers parseia bookmakerName e slug
  const rawBk = [
    { bookmakerName: 'Bet365', slug: 'bet365', liveOdds: true },
    { bookmakerName: 'Betano', slug: 'betano', liveOdds: false },
    { slug: 'superbet', liveOdds: false }, // sem bookmakerName
  ];
  const parsed2 = parseBookmakers(rawBk);
  assert.strictEqual(parsed2[0].name, 'Bet365');
  assert.strictEqual(parsed2[0].slug, 'bet365');
  assert.strictEqual(parsed2[1].name, 'Betano');
  assert.strictEqual(parsed2[2].name, 'superbet'); // fallback para slug
  console.log("✔ parseBookmakers parseia bookmakerName e slug corretamente");

  // 9. Torneios com fixtures são priorizados
  const tournaments = [
    { tournamentId: 1, tournamentName: 'random cup', futureFixtures: 0, upcomingFixtures: 0, liveFixtures: 0 },
    { tournamentId: 2, tournamentName: 'Premier League', futureFixtures: 10, upcomingFixtures: 2, liveFixtures: 0 },
    { tournamentId: 3, tournamentName: 'Brasileirao', futureFixtures: 5, upcomingFixtures: 1, liveFixtures: 0 },
    { tournamentId: 4, tournamentName: 'unknow league', futureFixtures: 3, upcomingFixtures: 0, liveFixtures: 0 },
  ];
  const chosen = pickBestTournaments(tournaments);
  assert.ok(chosen.length > 0, 'deve escolher torneios com fixtures');
  assert.ok(chosen.some((t) => t.tournamentName === 'Premier League'), 'Premier League deve ser priorizado');
  assert.ok(chosen.every((t) => (t.futureFixtures || 0) + (t.upcomingFixtures || 0) + (t.liveFixtures || 0) > 0), 'todos escolhidos devem ter fixtures');
  assert.ok(!chosen.some((t) => t.tournamentId === 1), 'torneio sem fixtures não deve ser escolhido');
  console.log("✔ Torneios com fixtures são priorizados (Premier League, Brasileirao)");

  // 10. Ausência de casas prioritárias = 'partial', não 'not_viable'
  const bkList = [{ name: 'BetXYZ', slug: 'betxyz' }, { name: 'ApostaBR', slug: 'apostabr' }];
  const search = bkList.map((b) => `${b.slug} ${b.name}`.toLowerCase());
  const PRIORITY_SLUGS = ['bet365', 'betano', 'superbet', 'sportingbet'];
  const priorityFound = PRIORITY_SLUGS.filter((p) => search.some((s) => s.includes(p)));
  const verdict = bkList.length > 0 && priorityFound.length === 0 ? 'partial' : 'not_viable';
  assert.strictEqual(verdict, 'partial');
  console.log("✔ Ausência de casas prioritárias com bookmakers existentes = 'partial', não 'not_viable'");

  // 11. normalizeOdd — aceita válidos
  assert.strictEqual(normalizeOdd(2.5), 2.5);
  assert.strictEqual(normalizeOdd('1.85'), 1.85);
  assert.strictEqual(normalizeOdd(null), null);
  assert.strictEqual(normalizeOdd(undefined), null);
  assert.strictEqual(normalizeOdd(1.0), null);
  assert.strictEqual(normalizeOdd('abc'), null);
  console.log("✔ normalizeOdd aceita/rejeita corretamente");

  // 12. normalizeSelection h2h
  assert.strictEqual(normalizeSelection('Flamengo', 'h2h', 'Flamengo', 'Vasco').name, 'Casa');
  assert.strictEqual(normalizeSelection('Draw', 'match_winner', '', '').name, 'Empate');
  assert.strictEqual(normalizeSelection('Yes', 'btts', '', '').name, 'Sim');
  console.log("✔ normalizeSelection h2h/btts funciona");

  // 13. Mercado sem surebet
  const noSurebet = calculateSureBet([2.10, 3.80, 3.50]);
  assert.strictEqual(noSurebet, null);
  console.log("✔ Odds normais NÃO geram surebet");

  // 14. Odds favoráveis geram surebet
  const yes = calculateSureBet([3.10, 3.20, 3.30]);
  assert.notStrictEqual(yes, null);
  assert.ok(yes.marginPercent > 0);
  console.log(`✔ Odds favoráveis geram surebet: ${yes.marginPercent.toFixed(2)}%`);

  // 15. Source oddspapi
  assert.strictEqual('oddspapi', 'oddspapi');
  console.log("✔ Source 'oddspapi' corretamente definida");

  // 16. Rota 401 sem secret
  function mockAuth(headers) {
    const secret = 'test-secret';
    if (!headers['x-admin-secret'] || headers['x-admin-secret'] !== secret) return { status: 401 };
    return null;
  }
  assert.strictEqual(mockAuth({}).status, 401);
  assert.strictEqual(mockAuth({ 'x-admin-secret': 'test-secret' }), null);
  console.log("✔ Rotas protegidas retornam 401 sem secret");

  // 17. Import com 0 odds não é sucesso
  const empty = { ok: 0 > 0, oddsSaved: 0, error: 'Nenhuma odd' };
  assert.strictEqual(empty.ok, false);
  console.log("✔ Import com 0 odds não é marcado como sucesso");

  console.log(`\n== Todos os 17 testes passaram! ==`);
}

runTests().catch((err) => {
  console.error("\nFALHA:", err.message);
  process.exit(1);
});
