// test_oddsagora_parser.js
const assert = require('assert');

// Simulando as funções para teste (em produção rodaria no jest/node com TS)
function normalizeOdd(val) {
  if (typeof val === 'number') {
    return val > 1.01 && val < 1000 ? val : null;
  }
  const clean = val.replace(/[^\d.,]/g, '').replace(',', '.');
  const parsed = parseFloat(clean);
  if (isNaN(parsed) || parsed <= 1.01 || parsed >= 1000) return null;
  return parsed;
}

function inspectOddsAgoraHtml(html) {
  const lowerHtml = html.toLowerCase();
  const hasHtml = html.length > 100;
  
  const hasNextData = html.includes('id="__NEXT_DATA__"');
  const hasJsonScripts = hasNextData || html.includes('type="application/json"');
  
  const knownBookmakers = ['bet365', 'betano', 'superbet'];
  const bookmakerMentions = knownBookmakers.filter(b => lowerHtml.includes(b));
  
  const oddsLikeNumbers = [];
  const oddsMatches = html.match(/>(\s*[1-9]\.\d{2}\s*)</g);
  if (oddsMatches) {
    oddsLikeNumbers.push(...oddsMatches.map(m => m.replace(/[><\s]/g, '')).filter(n => parseFloat(n) > 1.0));
  }
  
  let extractionMode = "unknown";
  
  if (lowerHtml.includes('cloudflare') && lowerHtml.includes('challenge')) {
    extractionMode = "blocked";
  } else if (hasNextData) {
    extractionMode = "next_data";
  } else if (oddsLikeNumbers.length > 0 && bookmakerMentions.length > 0) {
    extractionMode = "html";
  } else if (html.length < 20000 && !hasJsonScripts) {
    extractionMode = "js_rendered";
  } else {
    extractionMode = "html";
  }
  
  return { extractionMode, hasNextData, hasJsonScripts };
}

async function runTests() {
  console.log("== Iniciando testes do parser OddsAgora ==");
  
  // 1. Testa normalizeOdd
  assert.strictEqual(normalizeOdd("2.10"), 2.10);
  assert.strictEqual(normalizeOdd("2,10"), 2.10);
  assert.strictEqual(normalizeOdd("1.01"), null); // inválido
  assert.strictEqual(normalizeOdd("2000"), null); // inválido
  assert.strictEqual(normalizeOdd(1.50), 1.50);
  console.log("✔ normalizeOdd passou");
  
  // 2. Testa inspectOddsAgoraHtml com HTML válido HTML
  const mockHtml = `
    <html>
      <title>OddsAgora</title>
      <body>
        <div>Bet365</div>
        <span> 2.10 </span>
      </body>
    </html>
  `;
  const resultHtml = inspectOddsAgoraHtml(mockHtml);
  assert.strictEqual(resultHtml.extractionMode, "html");
  console.log("✔ inspectOddsAgoraHtml (HTML) passou");

  // 3. Testa NEXT_DATA
  const mockNext = `
    <html>
      <script id="__NEXT_DATA__" type="application/json">{"props":{}}</script>
    </html>
  `;
  const resultNext = inspectOddsAgoraHtml(mockNext);
  assert.strictEqual(resultNext.extractionMode, "next_data");
  assert.strictEqual(resultNext.hasNextData, true);
  console.log("✔ inspectOddsAgoraHtml (NEXT_DATA) passou");
  
  // 4. Testa js_rendered
  const mockJs = `<html><head><script src="app.js"></script></head><body><div id="root"></div></body></html>`;
  const resultJs = inspectOddsAgoraHtml(mockJs);
  assert.strictEqual(resultJs.extractionMode, "js_rendered");
  console.log("✔ inspectOddsAgoraHtml (JS Rendered) passou");

  console.log("Todos os testes passaram com sucesso!");
}

runTests().catch(console.error);
