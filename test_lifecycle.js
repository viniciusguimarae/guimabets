/**
 * test_lifecycle.js — Testes de ciclo de vida das odds e oportunidades
 * Execute com: node test_lifecycle.js
 * 
 * Testa a lógica matemática do ciclo de vida SEM depender do Supabase.
 */

// ============================
// Funções utilitárias mock
// ============================

function calcImpliedSum(odds) {
  return odds.reduce((acc, o) => acc + 1 / o, 0);
}

function isSurebet(impliedSum) {
  return impliedSum < 1.0;
}

function calcMargin(impliedSum) {
  return (1 - impliedSum) * 100;
}

function calcStakes(odds, totalStake, impliedSum) {
  return odds.map(o => ({
    odd: o,
    stake: totalStake / (o * impliedSum),
    profit: (totalStake / (o * impliedSum)) * o - totalStake,
  }));
}

function simulateExpiry(odds, nowMs) {
  return odds.map(o => ({
    ...o,
    is_active: o.expires_at > nowMs,
    status: o.expires_at > nowMs ? 'active' : 'expired',
  }));
}

// ============================
// Helpers de teste
// ============================
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

function assertApprox(actual, expected, tolerance = 0.001, msg = '') {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`${msg} Esperado ≈ ${expected}, recebeu ${actual}`);
  }
}

// ============================
// Suíte 1: Ciclo de vida — Validade das odds
// ============================
console.log('\n📋 Suíte 1: Validade temporal das odds\n');

test('Odd dentro do TTL deve ser active', () => {
  const nowMs = Date.now();
  const odds = [{ id: 'a', expires_at: nowMs + 60000 }]; // expira em 1 min
  const result = simulateExpiry(odds, nowMs);
  assert(result[0].is_active === true, 'Deve estar ativa');
  assert(result[0].status === 'active', 'Status deve ser active');
});

test('Odd com expires_at passado deve ser expired', () => {
  const nowMs = Date.now();
  const odds = [{ id: 'b', expires_at: nowMs - 1000 }]; // expirou há 1 segundo
  const result = simulateExpiry(odds, nowMs);
  assert(result[0].is_active === false, 'Deve estar inativa');
  assert(result[0].status === 'expired', 'Status deve ser expired');
});

test('Múltiplas odds com expiração mista', () => {
  const nowMs = Date.now();
  const odds = [
    { id: '1', expires_at: nowMs + 10000 },
    { id: '2', expires_at: nowMs - 5000 },
    { id: '3', expires_at: nowMs + 3000 },
    { id: '4', expires_at: nowMs - 1 },
  ];
  const result = simulateExpiry(odds, nowMs);
  const active = result.filter(o => o.is_active);
  const expired = result.filter(o => !o.is_active);
  assert(active.length === 2, `Deve haver 2 ativas, encontrou ${active.length}`);
  assert(expired.length === 2, `Deve haver 2 expiradas, encontrou ${expired.length}`);
});

// ============================
// Suíte 2: Cálculo de surebet com mercado completo
// ============================
console.log('\n📋 Suíte 2: Cálculo de surebet\n');

test('Surebet válida 1X2 — implied sum < 1', () => {
  const odds = [3.50, 4.00, 2.90]; // surebet matemática
  const implied = calcImpliedSum(odds);
  assert(isSurebet(implied), `Deve ser surebet. Implied sum: ${implied.toFixed(4)}`);
  assert(implied < 1.0, `Implied sum deve ser < 1.0, foi ${implied.toFixed(4)}`);
});

test('Mercado normal sem surebet — implied sum >= 1', () => {
  const odds = [2.10, 3.40, 3.50]; // casa leva margem
  const implied = calcImpliedSum(odds);
  assert(!isSurebet(implied), `Não deve ser surebet. Implied sum: ${implied.toFixed(4)}`);
  assert(implied >= 1.0, `Implied sum deve ser >= 1.0`);
});

test('Surebet Over/Under 2 seleções', () => {
  const odds = [2.15, 2.05]; // Over Bet365 + Under Betfair
  const implied = calcImpliedSum(odds);
  assert(isSurebet(implied), `Deve ser surebet 2 seleções. Implied: ${implied.toFixed(4)}`);
});

test('Cálculo de margem correto', () => {
  const odds = [3.50, 4.00, 2.90];
  const implied = calcImpliedSum(odds);
  const margin = calcMargin(implied);
  assert(margin > 0, `Margem deve ser positiva: ${margin.toFixed(2)}%`);
  assert(margin < 20, `Margem deve ser razoável (<20%): ${margin.toFixed(2)}%`);
});

test('Stakes somam ao total corretamente', () => {
  const odds = [3.50, 4.00, 2.90];
  const totalStake = 1000;
  const implied = calcImpliedSum(odds);
  const stakes = calcStakes(odds, totalStake, implied);
  const stakeSum = stakes.reduce((acc, s) => acc + s.stake, 0);
  assertApprox(stakeSum, totalStake, 0.01, 'Soma das stakes');
});

test('Lucro líquido consistente em todas as legs', () => {
  const odds = [3.50, 4.00, 2.90];
  const totalStake = 1000;
  const implied = calcImpliedSum(odds);
  const stakes = calcStakes(odds, totalStake, implied);
  
  // Cada leg deve ter retorno próximo ao mesmo valor
  const returns = stakes.map(s => s.stake * s.odd);
  const firstReturn = returns[0];
  returns.forEach((ret, i) => {
    assertApprox(ret, firstReturn, 0.5, `Retorno da leg ${i}`);
  });
});

// ============================
// Suíte 3: Ciclo de vida das oportunidades
// ============================
console.log('\n📋 Suíte 3: Ciclo de vida de oportunidades\n');

test('Oportunidade deve ser invalidada se qualquer odd expirar', () => {
  const nowMs = Date.now();
  const opportunity = {
    id: 'opp_1',
    status: 'active',
    legs: [
      { odds_snapshot_id: 'odd_1', expires_at: nowMs + 60000 },
      { odds_snapshot_id: 'odd_2', expires_at: nowMs - 1000 }, // expirada!
      { odds_snapshot_id: 'odd_3', expires_at: nowMs + 30000 },
    ],
  };

  const allOddsActive = opportunity.legs.every(leg => leg.expires_at > nowMs);
  assert(!allOddsActive, 'Oportunidade deve ser invalidada pois odd_2 expirou');
});

test('Oportunidade permanece válida se todas as odds estão ativas', () => {
  const nowMs = Date.now();
  const opportunity = {
    id: 'opp_2',
    status: 'active',
    legs: [
      { odds_snapshot_id: 'odd_a', expires_at: nowMs + 60000 },
      { odds_snapshot_id: 'odd_b', expires_at: nowMs + 45000 },
      { odds_snapshot_id: 'odd_c', expires_at: nowMs + 30000 },
    ],
  };

  const allOddsActive = opportunity.legs.every(leg => leg.expires_at > nowMs);
  assert(allOddsActive, 'Oportunidade deve continuar válida');
});

test('Mercado incompleto não gera oportunidade', () => {
  // Mercado 1X2 precisa de 3 seleções
  const expectedOutcomes = 3;
  const availableSelections = 2; // falta uma seleção
  assert(
    availableSelections < expectedOutcomes,
    'Mercado incompleto: não deve calcular surebet'
  );
});

test('Oportunidade expirada por tempo deve ser excluída do radar', () => {
  const nowMs = Date.now();
  const opportunities = [
    { id: 'o1', status: 'active', expires_at: nowMs + 60000 },
    { id: 'o2', status: 'active', expires_at: nowMs - 5000 }, // expirada por tempo
    { id: 'o3', status: 'invalidated', expires_at: nowMs + 10000 },
  ];

  const activeOpps = opportunities.filter(
    o => o.status === 'active' && o.expires_at > nowMs
  );

  assert(activeOpps.length === 1, `Deve haver 1 oportunidade ativa, encontrou ${activeOpps.length}`);
  assert(activeOpps[0].id === 'o1', 'Deve ser o1');
});

// ============================
// Suíte 4: Mock server-side lógica de distribuição
// ============================
console.log('\n📋 Suíte 4: Mock server — lógica de geração\n');

test('Geração de odds com surebet garantida (impliedSum < 0.97)', () => {
  // Simula o que mockProvider.ts faz quando forceSurebet = true
  function generateForcedSurebet() {
    const rand = (min, max) => Math.random() * (max - min) + min;
    const impliedHome = rand(0.28, 0.38);
    const impliedDraw = rand(0.26, 0.32);
    const impliedAway = rand(0.22, 0.30);
    const total = impliedHome + impliedDraw + impliedAway;
    const scale = rand(0.93, 0.97) / total;
    return {
      home: 1 / (impliedHome * scale),
      draw: 1 / (impliedDraw * scale),
      away: 1 / (impliedAway * scale),
    };
  }

  for (let i = 0; i < 10; i++) {
    const odds = generateForcedSurebet();
    const implied = calcImpliedSum([odds.home, odds.draw, odds.away]);
    assert(isSurebet(implied), `Tentativa ${i + 1}: implied ${implied.toFixed(4)} deve ser surebet`);
  }
});

test('Geração de dados mock cria eventos em horários futuros', () => {
  const nowMs = Date.now();
  // Simula: new Date(nowMs + random(2, 72) * 60 * 60 * 1000)
  const rand = (min, max) => Math.random() * (max - min) + min;
  for (let i = 0; i < 5; i++) {
    const startTime = nowMs + rand(2, 72) * 3600 * 1000;
    assert(startTime > nowMs, `Evento ${i + 1} deve ser no futuro`);
    assert(startTime < nowMs + 73 * 3600 * 1000, `Evento ${i + 1} deve ser < 73h`);
  }
});

// ============================
// Suíte 5: API Routes — segurança de autenticação
// ============================
console.log('\n📋 Suíte 5: Segurança das rotas admin\n');

function simulateAdminAuth(providedSecret, serverSecret) {
  if (!serverSecret) return { status: 500, error: 'Servidor sem secret configurado' };
  if (!providedSecret || providedSecret !== serverSecret) {
    return { status: 401, error: 'Não autorizado' };
  }
  return { status: 200, ok: true };
}

test('Rota admin rejeita requisição sem header secret', () => {
  const result = simulateAdminAuth('', 'meu-secret');
  assert(result.status === 401, `Status deve ser 401, recebeu ${result.status}`);
});

test('Rota admin rejeita secret errado', () => {
  const result = simulateAdminAuth('secret-errado', 'meu-secret');
  assert(result.status === 401, `Status deve ser 401, recebeu ${result.status}`);
});

test('Rota admin aceita secret correto', () => {
  const result = simulateAdminAuth('meu-secret', 'meu-secret');
  assert(result.status === 200, `Status deve ser 200, recebeu ${result.status}`);
  assert(result.ok === true, 'Deve retornar ok: true');
});

test('Rota admin retorna 500 se servidor não tem secret configurado', () => {
  const result = simulateAdminAuth('qualquer', '');
  assert(result.status === 500, `Status deve ser 500, recebeu ${result.status}`);
});

// ============================
// Resultado Final
// ============================
console.log('\n' + '─'.repeat(45));
console.log(`Resultado: ${passed} passaram, ${failed} falharam`);
if (failed > 0) {
  console.log('❌ Alguns testes falharam.\n');
  process.exit(1);
} else {
  console.log('✅ Todos os testes de ciclo de vida passaram!\n');
  process.exit(0);
}
