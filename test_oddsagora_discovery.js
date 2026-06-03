// test_oddsagora_discovery.js
const assert = require('assert');

// Simulando funções TypeScript para o teste Node puro
function discoverCandidateUrls(html, baseUrl) {
  const discoveredUrls = new Set();
  const prioritizedUrls = new Set();
  const ignoredUrls = new Set();

  const linkRegex = /href=["'](\/[^"']+)["']/g;
  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    const rawUrl = match[1];
    if (rawUrl.match(/\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/i)) continue;
    if (rawUrl.length < 2) continue;
    
    const fullUrl = rawUrl.startsWith('/') ? `${baseUrl}${rawUrl}` : rawUrl;
    discoveredUrls.add(fullUrl);
  }

  const keywords = [
    'futebol', 'football', 'sure', 'surebet', 'sure-bets', 'apostas', 'odds',
    'probabilidades', 'brasileirao', 'serie-a', 'live', 'hoje', 'jogos',
    'comparar', 'comparador'
  ];

  for (const url of discoveredUrls) {
    const lowerUrl = url.toLowerCase();
    
    if (lowerUrl.includes('/login') || lowerUrl.includes('/register') || lowerUrl.includes('/conta') || lowerUrl.includes('/termos') || lowerUrl.includes('/privacidade')) {
      ignoredUrls.add(url);
      continue;
    }

    try {
      const urlObj = new URL(url);
      const path = urlObj.pathname.toLowerCase();
      const isRelevant = keywords.some(kw => path.includes(kw));
      if (isRelevant) {
        prioritizedUrls.add(url);
      } else {
        ignoredUrls.add(url);
      }
    } catch {
      ignoredUrls.add(url);
    }
  }

  return {
    discoveredUrls: Array.from(discoveredUrls),
    prioritizedUrls: Array.from(prioritizedUrls).slice(0, 15),
    ignoredUrls: Array.from(ignoredUrls),
    notes: []
  };
}

function rankOddsAgoraUrlInspection(url, status, responseTimeMs, diagnostic) {
  let score = 0;

  if (status === 200) score += 30;
  if (diagnostic.htmlSize > 50000) score += 20;
  if (diagnostic.bookmakerMentions.length > 0) score += 20;
  if (diagnostic.oddsLikeNumbers.length > 10) score += 20;
  if (diagnostic.eventLikeTexts.length > 5) score += 20;
  if (diagnostic.hasNextData) score += 20;
  if (diagnostic.hasJsonScripts) score += 15;
  if (diagnostic.possibleApiEndpoints.length > 0) score += 15;
  
  if (diagnostic.extractionMode === 'blocked') score -= 50;
  if (diagnostic.htmlSize < 20000) score -= 20;
  if (diagnostic.confidence === 'low') score -= 20;

  let ranking = 'not_useful';
  if (diagnostic.extractionMode === 'blocked' || status >= 400) {
    ranking = 'not_useful';
  } else if (score >= 90) {
    ranking = 'strong_candidate';
  } else if (score >= 60) {
    ranking = 'medium_candidate';
  } else if (score >= 30) {
    ranking = 'weak_candidate';
  }

  return {
    url,
    status,
    score,
    ranking
  };
}

async function runTests() {
  console.log("== Iniciando testes de Discovery OddsAgora ==");
  
  // 1. Testa extração de links e priorização
  const mockHtml = `
    <html>
      <body>
        <a href="/futebol/brasileirao">Futebol</a>
        <a href="/login">Login</a>
        <a href="/sobre">Sobre</a>
        <a href="/surebets-hoje">Surebets</a>
        <a href="/futebol/brasileirao">Futebol (duplicado)</a>
      </body>
    </html>
  `;
  const discoveryResult = discoverCandidateUrls(mockHtml, "https://oddsagora.com.br");
  
  assert.strictEqual(discoveryResult.discoveredUrls.length, 4); // /futebol/brasileirao, /login, /sobre, /surebets-hoje
  assert.strictEqual(discoveryResult.prioritizedUrls.length, 2); // futebol, surebets
  assert.strictEqual(discoveryResult.ignoredUrls.length, 2); // login, sobre
  console.log("✔ discoverCandidateUrls passou");
  
  // 2. Testa Ranking: Strong Candidate
  const strongDiag = {
    htmlSize: 80000,
    bookmakerMentions: ['bet365'],
    oddsLikeNumbers: Array(15).fill('2.00'),
    eventLikeTexts: Array(10).fill('Flamengo x Vasco'),
    hasNextData: false,
    hasJsonScripts: false,
    possibleApiEndpoints: [],
    extractionMode: 'html',
    confidence: 'high'
  };
  const strongRank = rankOddsAgoraUrlInspection("https://oddsagora.com.br/futebol", 200, 150, strongDiag);
  assert.strictEqual(strongRank.ranking, 'strong_candidate');
  assert.ok(strongRank.score >= 90);
  console.log("✔ Ranking (Strong Candidate) passou");

  // 3. Testa Ranking: Blocked
  const blockedDiag = {
    htmlSize: 10000,
    bookmakerMentions: [],
    oddsLikeNumbers: [],
    eventLikeTexts: [],
    hasNextData: false,
    hasJsonScripts: false,
    possibleApiEndpoints: [],
    extractionMode: 'blocked',
    confidence: 'high'
  };
  const blockedRank = rankOddsAgoraUrlInspection("https://oddsagora.com.br/futebol", 403, 50, blockedDiag);
  assert.strictEqual(blockedRank.ranking, 'not_useful');
  console.log("✔ Ranking (Blocked) passou");

  // 4. Testa Ranking: Weak Candidate (apenas HTML, sem odds ou eventos)
  const weakDiag = {
    htmlSize: 30000,
    bookmakerMentions: [],
    oddsLikeNumbers: [],
    eventLikeTexts: [],
    hasNextData: false,
    hasJsonScripts: false,
    possibleApiEndpoints: [],
    extractionMode: 'html',
    confidence: 'medium'
  };
  const weakRank = rankOddsAgoraUrlInspection("https://oddsagora.com.br/sobre", 200, 100, weakDiag);
  assert.strictEqual(weakRank.ranking, 'weak_candidate');
  console.log("✔ Ranking (Weak Candidate) passou");

  console.log("Todos os testes de discovery passaram com sucesso!");
}

runTests().catch(console.error);
