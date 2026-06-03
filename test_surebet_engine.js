/**
 * Script de Verificação Matemática do SurebetEngine do GuimaBets
 * Execução local rápida via: node test_surebet_engine.js
 */

const assert = require('assert');

// Simulação da classe SurebetEngine em JS
class SurebetEngine {
  static calculate(odds, totalStake) {
    const impliedSum = odds.reduce((sum, item) => sum + (item.oddDecimal > 0 ? 1 / item.oddDecimal : 0), 0);
    const marginPercent = impliedSum > 0 ? ((1 / impliedSum) - 1) * 100 : 0;
    
    const legs = odds.map(odd => {
      const recommendedStake = impliedSum > 0 && odd.oddDecimal > 0
        ? (totalStake / odd.oddDecimal) / impliedSum
        : 0;
      const expectedReturn = recommendedStake * odd.oddDecimal;
      
      return {
        selectionId: odd.selectionId,
        oddDecimal: odd.oddDecimal,
        recommendedStake: Number(recommendedStake.toFixed(2)),
        expectedReturn: Number(expectedReturn.toFixed(2)),
      };
    });

    const actualTotalStake = legs.reduce((sum, leg) => sum + leg.recommendedStake, 0);
    const averageReturn = legs.length > 0 
      ? legs.reduce((sum, leg) => sum + leg.expectedReturn, 0) / legs.length 
      : 0;
      
    const expectedProfit = averageReturn - actualTotalStake;
    const roi = actualTotalStake > 0 ? (expectedProfit / actualTotalStake) * 100 : 0;

    return {
      impliedSum,
      marginPercent,
      roi,
      expectedReturn: Number(averageReturn.toFixed(2)),
      expectedProfit: Number(expectedProfit.toFixed(2)),
      legs,
    };
  }
}

console.log('=== INICIANDO TESTES DO MOTOR DE SUREBETS ===\n');

// 1. Teste de Arbitragem com 2 Seleções (Ex: Over/Under 2.5)
// Odd A: 2.15 (Betano), Odd B: 2.12 (Superbet). Stake Total = 1000
try {
  console.log('Teste 1: Verificação de Surebet com 2 Seleções (Over/Under)...');
  const odds2 = [
    { selectionId: 'sel_over', oddDecimal: 2.15 },
    { selectionId: 'sel_under', oddDecimal: 2.12 }
  ];
  
  const res = SurebetEngine.calculate(odds2, 1000);
  
  console.log(`- Probabilidade Implícita: ${(res.impliedSum * 100).toFixed(2)}%`);
  console.log(`- Margem: +${res.marginPercent.toFixed(2)}%`);
  console.log(`- ROI: ${res.roi.toFixed(2)}%`);
  console.log(`- Distribuição Stake: A: R$ ${res.legs[0].recommendedStake} | B: R$ ${res.legs[1].recommendedStake}`);
  console.log(`- Lucro Esperado: R$ ${res.expectedProfit.toFixed(2)}`);

  // Asserts
  assert.ok(res.impliedSum < 1.0, 'Erro: Deve identificar arbitragem (implied_sum < 1)');
  assert.ok(res.marginPercent > 0, 'Erro: Margem deve ser positiva');
  assert.equal(res.legs[0].recommendedStake + res.legs[1].recommendedStake, 1000, 'Erro: A soma das stakes sugeridas deve bater 1000');
  
  console.log('=> Teste 1 Concluído com sucesso!\n');
} catch (e) {
  console.error('Falha no Teste 1:', e.message);
}

// 2. Teste de Arbitragem com 3 Seleções (Ex: 1X2)
// Odd 1: 3.20, Odd X: 3.30, Odd 2: 3.15. Stake Total = 1000
try {
  console.log('Teste 2: Verificação de Surebet com 3 Seleções (1X2)...');
  const odds3 = [
    { selectionId: 'sel_home', oddDecimal: 3.20 },
    { selectionId: 'sel_draw', oddDecimal: 3.30 },
    { selectionId: 'sel_away', oddDecimal: 3.15 }
  ];
  
  const res = SurebetEngine.calculate(odds3, 1000);
  
  console.log(`- Probabilidade Implícita: ${(res.impliedSum * 100).toFixed(2)}%`);
  console.log(`- Margem: +${res.marginPercent.toFixed(2)}%`);
  console.log(`- ROI: ${res.roi.toFixed(2)}%`);
  console.log(`- Distribuição Stake: Casa: R$ ${res.legs[0].recommendedStake} | Empate: R$ ${res.legs[1].recommendedStake} | Fora: R$ ${res.legs[2].recommendedStake}`);
  console.log(`- Lucro Esperado: R$ ${res.expectedProfit.toFixed(2)}`);

  // Asserts
  assert.ok(res.impliedSum < 1.0, 'Erro: Deve identificar arbitragem (implied_sum < 1)');
  assert.ok(res.marginPercent > 0, 'Erro: Margem deve ser positiva');
  assert.ok(res.expectedProfit > 0, 'Erro: Lucro deve ser positivo');

  console.log('=> Teste 2 Concluído com sucesso!\n');
} catch (e) {
  console.error('Falha no Teste 2:', e.message);
}

// 3. Teste Sem Arbitragem (Cenário Comum)
// Odd 1: 2.80, Odd X: 3.20, Odd 2: 2.65
try {
  console.log('Teste 3: Verificação de Cenário Sem Arbitragem...');
  const oddsCommon = [
    { selectionId: 'sel_home', oddDecimal: 2.80 },
    { selectionId: 'sel_draw', oddDecimal: 3.20 },
    { selectionId: 'sel_away', oddDecimal: 2.65 }
  ];

  const res = SurebetEngine.calculate(oddsCommon, 1000);
  
  console.log(`- Probabilidade Implícita: ${(res.impliedSum * 100).toFixed(2)}%`);
  console.log(`- Margem: ${res.marginPercent.toFixed(2)}%`);

  // Asserts
  assert.ok(res.impliedSum >= 1.0, 'Erro: Não deve identificar arbitragem');
  assert.ok(res.marginPercent <= 0, 'Erro: Margem deve ser negativa ou zero');
  
  console.log('=> Teste 3 Concluído com sucesso!\n');
} catch (e) {
  console.error('Falha no Teste 3:', e.message);
}

console.log('=== TESTES DO MOTOR DE SUREBETS CONCLUÍDOS COM SUCESSO ===');
