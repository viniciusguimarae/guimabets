// test_oddsagora_final_investigation.js
const assert = require('assert');

// Simulate Final Investigation result based on rules
function getMockFinalDecision(scenarios) {
  if (scenarios.htmlOdds) return 'viable_html';
  if (scenarios.nextDataOdds) return 'viable_next_data';
  if (scenarios.apiOdds) return 'viable_public_api';
  if (scenarios.headlessOdds) return 'viable_headless';
  return 'not_viable_for_mvp';
}

async function runTests() {
  console.log("== Iniciando testes da Investigação Final ==");
  
  // Teste: classification viable_html
  assert.strictEqual(getMockFinalDecision({ htmlOdds: true }), 'viable_html');
  console.log("✔ classificação viable_html");

  // Teste: classification viable_next_data
  assert.strictEqual(getMockFinalDecision({ nextDataOdds: true }), 'viable_next_data');
  console.log("✔ classificação viable_next_data");

  // Teste: classification viable_public_api
  assert.strictEqual(getMockFinalDecision({ apiOdds: true }), 'viable_public_api');
  console.log("✔ classificação viable_public_api");

  // Teste: classification viable_headless
  assert.strictEqual(getMockFinalDecision({ headlessOdds: true }), 'viable_headless');
  console.log("✔ classificação viable_headless");

  // Teste: classification not_viable_for_mvp
  assert.strictEqual(getMockFinalDecision({ }), 'not_viable_for_mvp');
  console.log("✔ classificação not_viable_for_mvp");

  console.log("Todos os testes passaram com sucesso!");
}

runTests().catch(console.error);
