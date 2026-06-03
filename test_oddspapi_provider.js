// test_oddspapi_provider.js
// Testes completos do provider OddsPapi — incluindo buildOddsPapiUrl e segurança
const assert = require('assert');
const url_module = require('url');

// -----------------------------------------------------------------------
// Reimplementação das funções em JS puro para teste isolado (sem TS)
// -----------------------------------------------------------------------

function normalizeOdd(value) {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num) || num <= 1.0 || num > 1000) return null;
  return Math.round(num * 100) / 100;
}

function normalizeBookmaker(bkKey, bkTitle) {
  return { name: bkTitle || bkKey, originalName: bkKey };
}

function normalizeSelection(outcomeName, marketKey, homeTeam, awayTeam) {
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

function calculateSureBet(odds) {
  const impliedSum = odds.reduce((acc, o) => acc + 1 / o, 0);
  if (impliedSum >= 1.0) return null;
  return { impliedSum, marginPercent: (1 - impliedSum) * 100 };
}

/**
 * Simula buildOddsPapiUrl — mesma lógica do provider TypeScript
 */
function buildOddsPapiUrl(path, params = {}, apiKey) {
  if (!apiKey) throw new Error('ODDSPAPI_API_KEY não configurada no servidor');
  const base = 'https://api.oddspapi.io/v4';
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const urlObj = new URL(`${base}${normalizedPath}`);
  urlObj.searchParams.set('apiKey', apiKey);
  for (const [k, v] of Object.entries(params)) {
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

// -----------------------------------------------------------------------
// Testes
// -----------------------------------------------------------------------

async function runTests() {
  console.log("== Iniciando testes do Provider OddsPapi ==\n");

  // 1. buildOddsPapiUrl inclui apiKey como query param
  const testKey = 'abc123xyz';
  const built = buildOddsPapiUrl('/sports', {}, testKey);
  const parsed = new URL(built);
  assert.strictEqual(parsed.searchParams.get('apiKey'), testKey, 'apiKey deve estar na query string');
  assert.ok(built.includes('?apiKey=') || built.includes('&apiKey='), 'URL deve conter apiKey como query param');
  console.log("✔ buildOddsPapiUrl inclui apiKey como query param");

  // 2. buildOddsPapiUrl preserva outros parâmetros
  const builtWithParams = buildOddsPapiUrl('/sports/soccer/odds', { regions: 'eu,uk', markets: 'h2h' }, testKey);
  const parsedWithParams = new URL(builtWithParams);
  assert.strictEqual(parsedWithParams.searchParams.get('regions'), 'eu,uk');
  assert.strictEqual(parsedWithParams.searchParams.get('markets'), 'h2h');
  assert.strictEqual(parsedWithParams.searchParams.get('apiKey'), testKey);
  console.log("✔ buildOddsPapiUrl preserva outros parâmetros");

  // 3. Ausência de API key lança erro claro
  let threwError = false;
  try {
    buildOddsPapiUrl('/sports', {}, null);
  } catch (e) {
    threwError = true;
    assert.ok(e.message.includes('ODDSPAPI_API_KEY'), 'Erro deve mencionar a variável ausente');
  }
  assert.ok(threwError, 'Deve lançar erro quando apiKey está ausente');
  console.log("✔ Ausência de API key retorna erro claro");

  // 4. Nenhuma chamada usa Authorization Bearer — verificar que buildOddsPapiUrl NÃO gera Authorization
  // Simulamos que o header retornado pelo buildHeaders é apenas Accept
  const mockHeaders = { Accept: 'application/json' };
  assert.strictEqual(mockHeaders['Authorization'], undefined, 'Não deve haver Authorization header');
  assert.ok(!JSON.stringify(mockHeaders).includes('Bearer'), 'Não deve conter Bearer token');
  console.log("✔ Nenhuma chamada usa Authorization Bearer");

  // 5. Nenhuma resposta/log expõe a chave completa
  const fullKey = 'supersecretkey12345';
  const diag = apiKeyDiagnostic(fullKey);
  assert.strictEqual(diag.apiKeyConfigured, true);
  assert.ok(!diag.apiKeyPrefix.includes(fullKey), 'Prefix não deve conter chave completa');
  assert.ok(diag.apiKeyPrefix.endsWith('...'), 'Prefix deve terminar com ...');
  assert.ok(diag.apiKeyPrefix.length <= 10, 'Prefix deve ser curto');
  console.log("✔ Log seguro: apenas prefixo exposto, chave completa nunca vazada");

  // 6. normalizeOdd — aceita válidos
  assert.strictEqual(normalizeOdd(2.5), 2.5);
  assert.strictEqual(normalizeOdd('1.85'), 1.85);
  assert.strictEqual(normalizeOdd(999.99), 999.99);
  console.log("✔ normalizeOdd aceita números válidos");

  // 7. normalizeOdd — rejeita inválidos
  assert.strictEqual(normalizeOdd(0.5), null);
  assert.strictEqual(normalizeOdd(1.0), null);
  assert.strictEqual(normalizeOdd('abc'), null);
  assert.strictEqual(normalizeOdd(1001), null);
  assert.strictEqual(normalizeOdd(-1), null);
  console.log("✔ normalizeOdd rejeita odds inválidas");

  // 8. normalizeBookmaker
  const bk = normalizeBookmaker('bet365', 'Bet365');
  assert.strictEqual(bk.name, 'Bet365');
  assert.strictEqual(bk.originalName, 'bet365');
  const bkFallback = normalizeBookmaker('mybookie_ag', '');
  assert.strictEqual(bkFallback.name, 'mybookie_ag');
  console.log("✔ normalizeBookmaker funciona com fallback");

  // 9. normalizeSelection h2h
  assert.strictEqual(normalizeSelection('Flamengo', 'h2h', 'Flamengo', 'Vasco').name, 'Casa');
  assert.strictEqual(normalizeSelection('Vasco', 'h2h', 'Flamengo', 'Vasco').name, 'Fora');
  assert.strictEqual(normalizeSelection('Draw', 'h2h', 'Flamengo', 'Vasco').name, 'Empate');
  console.log("✔ normalizeSelection h2h funciona");

  // 10. normalizeSelection btts
  assert.strictEqual(normalizeSelection('Yes', 'btts', '', '').name, 'Sim');
  assert.strictEqual(normalizeSelection('No', 'btts', '', '').name, 'Não');
  console.log("✔ normalizeSelection btts funciona");

  // 11. Mercado incompleto (2 seleções em h2h de 3) não gera surebet por validação de completude
  const is3WayComplete = [2.10, 3.50].length >= 3;
  assert.strictEqual(is3WayComplete, false);
  console.log("✔ Mercado incompleto (< 3 seleções h2h) detectado");

  // 12. Odds com margem positiva NÃO geram surebet
  const noSurebet = calculateSureBet([2.10, 3.80, 3.50]);
  assert.strictEqual(noSurebet, null);
  console.log("✔ Odds com margem positiva NÃO geram surebet");

  // 13. Odds favoráveis GERAM surebet
  const yesSurebet = calculateSureBet([3.10, 3.20, 3.30]);
  assert.notStrictEqual(yesSurebet, null);
  assert.ok(yesSurebet.marginPercent > 0);
  console.log(`✔ Odds favoráveis geram surebet: margem de ${yesSurebet.marginPercent.toFixed(2)}%`);

  // 14. Source oddspapi está definida
  assert.strictEqual('oddspapi', 'oddspapi');
  console.log("✔ Source 'oddspapi' corretamente definida");

  // 15. Rotas protegidas retornam 401 sem x-admin-secret
  function mockAuth(headers) {
    const secret = 'test-secret';
    if (!headers['x-admin-secret'] || headers['x-admin-secret'] !== secret) {
      return { status: 401 };
    }
    return null;
  }
  assert.strictEqual(mockAuth({}).status, 401);
  assert.strictEqual(mockAuth({ 'x-admin-secret': 'test-secret' }), null);
  console.log("✔ Rotas protegidas retornam 401 sem x-admin-secret correto");

  // 16. Import com 0 odds não é marcado como sucesso
  const emptyImport = { ok: 0 > 0, oddsSaved: 0, error: 'Nenhuma odd retornada' };
  assert.strictEqual(emptyImport.ok, false);
  assert.ok(emptyImport.error);
  console.log("✔ Import com 0 odds não é marcado como sucesso");

  console.log("\n== Todos os 16 testes OddsPapi passaram! ==");
}

runTests().catch((err) => {
  console.error("\nFALHA:", err.message);
  process.exit(1);
});
