/**
 * test_source_probe.js
 * Testa as lógicas puras de inspeção de fontes e detecção (Etapa 3)
 * Execute com: node test_source_probe.js
 */

const CAPTCHA_SIGNALS = ['recaptcha', 'hcaptcha', 'turnstile', 'cf-challenge'];
const CLOUDFLARE_SIGNALS = ['cloudflare', '__cf_bm', 'cf_clearance', 'cf-ray', 'please wait while we check'];
const BLOCKING_SIGNALS = ['access denied', '403 forbidden', 'you have been blocked', 'bot detected'];
const ODDS_KEYWORDS = ['odds', 'bookmaker', 'betano', 'bet365', 'handicap', 'over', 'football'];
const API_ENDPOINT_PATTERNS = [
  /["'`](\/api\/[^"'`\s]{3,})/g,
  /["'`](\/graphql[^"'`\s]*)/g,
  /fetch\(["'`]([^"'`\s]{5,})/g,
  /endpoint['":\s]+["'`]([^"'`\s]{5,})/gi
];
const JSON_SCRIPT_PATTERNS = [
  /<script[^>]+type=["']application\/json["'][^>]*>([\s\S]{10,500}?)<\/script>/gi,
  /<script[^>]+id=["'][^"']*(?:data|props|state|__NEXT|__NUXT|__INITIAL)[^"']*["'][^>]*>/gi,
  /window\.__(?:INITIAL|NEXT|NUXT|STATE|DATA)__\s*=/gi
];

function detectCaptcha(html) {
  const lower = html.toLowerCase();
  return CAPTCHA_SIGNALS.some((signal) => lower.includes(signal));
}

function detectCloudflare(html, statusCode, headers) {
  const lower = html.toLowerCase();
  const headerStr = JSON.stringify(headers || {}).toLowerCase();
  const inHtml = CLOUDFLARE_SIGNALS.some((s) => lower.includes(s));
  const inHeaders = headerStr.includes('cloudflare') || !!(headers && headers['cf-ray']);
  const isChallenge = statusCode === 403 && (inHtml || inHeaders);
  return inHtml || inHeaders || isChallenge;
}

function detectBlocking(html, statusCode) {
  const lower = html.toLowerCase();
  if (statusCode === 403 || statusCode === 429) return { blocked: true };
  for (const signal of BLOCKING_SIGNALS) {
    if (lower.includes(signal)) return { blocked: true };
  }
  return { blocked: false };
}

function detectJsonScripts(html) {
  let count = 0;
  for (const pattern of JSON_SCRIPT_PATTERNS) {
    const matches = html.match(new RegExp(pattern.source, pattern.flags));
    if (matches) count += matches.length;
  }
  return { detected: count > 0, count };
}

function detectPotentialApiEndpoints(html) {
  const found = new Set();
  for (const pattern of API_ENDPOINT_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(html)) !== null) {
      const endpoint = match[1] || match[2];
      if (endpoint && endpoint.length > 3) found.add(endpoint);
    }
  }
  return Array.from(found).slice(0, 15);
}

function detectOddsKeywords(html) {
  const lower = html.toLowerCase();
  return ODDS_KEYWORDS.filter((kw) => lower.includes(kw));
}

function inspectHtml(html, statusCode, headers) {
  const blockResult = detectBlocking(html, statusCode);
  const jsonResult = detectJsonScripts(html);
  
  return {
    hasHtml: html.length > 100,
    htmlSize: html.length,
    hasCaptcha: detectCaptcha(html),
    hasCloudflare: detectCloudflare(html, statusCode, headers),
    hasBlockedMessage: blockResult.blocked,
    hasJsonScripts: jsonResult.detected,
    jsonScriptCount: jsonResult.count,
    potentialApiEndpoints: detectPotentialApiEndpoints(html),
    keywordHits: detectOddsKeywords(html),
  };
}

function deriveRecommendation(input) {
  const { hasHtml, htmlSize, hasCaptcha, hasCloudflare, hasBlockedMessage, potentialApiEndpoints = [], keywordHits, statusCode } = input;
  if (!hasHtml && !statusCode) return 'not_available';
  if (hasCaptcha || (hasCloudflare && hasBlockedMessage)) return 'blocked_or_risky';
  if (statusCode === 403 || statusCode === 429) return 'blocked_or_risky';
  if (statusCode === 200 && htmlSize < 10000 && keywordHits.length === 0) return 'needs_browser_rendering';
  if (potentialApiEndpoints.length >= 3) return 'inspect_network_or_api_pattern';
  if (statusCode === 200 && htmlSize >= 10000) return 'candidate_for_parser';
  if (hasCloudflare) return 'blocked_or_risky';
  return 'not_available';
}

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ❌ ${name}`);
    console.log(`     → ${err.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion falhou');
}

console.log('\n📋 Suíte 1: Detecção de Captcha e Bloqueio');

test('Detecta reCAPTCHA no HTML', () => {
  const html = '<html><body><script src="https://www.google.com/recaptcha/api.js"></script></body></html>';
  const result = inspectHtml(html, 200, {});
  assert(result.hasCaptcha === true, 'Não detectou recaptcha');
});

test('Detecta Cloudflare por status 403 e html', () => {
  const html = '<html><body><title>Just a moment...</title><p>Please wait while we check your browser...</p></body></html>';
  const result = inspectHtml(html, 403, {});
  assert(result.hasCloudflare === true, 'Não detectou Cloudflare challenge');
  assert(result.hasBlockedMessage === true, 'Não detectou como bloqueado via HTTP 403');
  const rec = deriveRecommendation({ ...result, statusCode: 403 });
  assert(rec === 'blocked_or_risky', 'Deveria recomendar blocked_or_risky');
});

test('Não detecta falso positivo de bloqueio em HTML limpo', () => {
  const html = '<html><body><h1>Odds de Futebol</h1></body></html>'.padEnd(10000, ' ');
  const result = inspectHtml(html, 200, {});
  assert(result.hasCaptcha === false, 'Falso positivo de captcha');
  assert(result.hasCloudflare === false, 'Falso positivo de cloudflare');
  assert(result.hasBlockedMessage === false, 'Falso positivo de bloqueio');
});

console.log('\n📋 Suíte 2: Detecção de Dados (JSON/Keywords)');

test('Detecta keywords de odds corretamente', () => {
  const html = '<html><body><div class="bookmaker-list">Odds da Betano para handicap asiático</div></body></html>';
  const result = inspectHtml(html, 200, {});
  assert(result.keywordHits.includes('odds'), 'Não achou "odds"');
  assert(result.keywordHits.includes('betano'), 'Não achou "betano"');
  assert(result.keywordHits.includes('handicap'), 'Não achou "handicap"');
  assert(result.keywordHits.length >= 3, 'Deveria achar pelo menos 3 keywords');
});

test('Detecta JSON embutido via Next.js ou genérico', () => {
  const html = `
    <html>
      <body>
        <script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{"odds":[]}}}</script>
        <script>window.__INITIAL_STATE__ = { markets: [] };</script>
      </body>
    </html>
  `;
  const result = inspectHtml(html, 200, {});
  assert(result.hasJsonScripts === true, 'Não detectou scripts JSON');
  assert(result.jsonScriptCount >= 2, 'Deveria contar 2 hits de script de dados');
});

test('Detecta possíveis endpoints de API', () => {
  const html = `
    <script>
      fetch('/api/v1/sports/football/odds').then(r => r.json());
      const endpoint = "/graphql";
    </script>
  `;
  const result = inspectHtml(html, 200, {});
  assert(result.potentialApiEndpoints.length >= 2, 'Deveria detectar 2 endpoints');
});

console.log('\n📋 Suíte 3: Recomendação e Confiança');

test('Fonte ideal → candidate_for_parser', () => {
  const html = '<html><title>Odds</title><body>bookmaker betano odds match fixture futebol football bet365</body></html>'.padEnd(20000, ' ');
  const rec = deriveRecommendation({
    hasHtml: true, htmlSize: html.length, hasCaptcha: false,
    hasCloudflare: false, hasBlockedMessage: false, keywordHits: ['odds', 'betano', 'bookmaker', 'football', 'bet365'], statusCode: 200
  });
  assert(rec === 'candidate_for_parser', `Recomendou ${rec}`);
});

test('HTML vazio/muito pequeno → needs_browser_rendering', () => {
  const html = '<html><body><div id="root"></div></body></html>'; // 47 bytes
  const rec = deriveRecommendation({
    hasHtml: true, htmlSize: html.length, hasCaptcha: false,
    hasCloudflare: false, hasBlockedMessage: false, keywordHits: [], statusCode: 200
  });
  assert(rec === 'needs_browser_rendering', `Recomendou ${rec}`);
});

test('Muitos endpoints → inspect_network_or_api_pattern', () => {
  const rec = deriveRecommendation({
    hasHtml: true, htmlSize: 20000, hasCaptcha: false,
    hasCloudflare: false, hasBlockedMessage: false, keywordHits: ['odds'], statusCode: 200,
    potentialApiEndpoints: ['/api/1', '/api/2', '/api/3']
  });
  assert(rec === 'inspect_network_or_api_pattern', `Recomendou ${rec}`);
});

// ============================
console.log('\n' + '─'.repeat(45));
console.log(`Resultado: ${passed} passaram, ${failed} falharam`);
if (failed > 0) process.exit(1);
process.exit(0);
