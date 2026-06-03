import { Bookmaker, Market, MarketSelection, OddSnapshot, OpportunityLeg, SportEvent, SurebetOpportunity, UserSettings } from '../types';

export interface CalculationResult {
  impliedSum: number;
  marginPercent: number;
  roi: number;
  expectedReturn: number;
  expectedProfit: number;
  legs: {
    selectionId: string;
    oddDecimal: number;
    recommendedStake: number;
    expectedReturn: number;
  }[];
}

export class SurebetEngine {
  /**
   * Realiza os cálculos matemáticos de surebet baseados em uma lista de odds e um stake total.
   */
  static calculate(odds: { selectionId: string; oddDecimal: number }[], totalStake: number): CalculationResult {
    const impliedSum = odds.reduce((sum, item) => sum + (item.oddDecimal > 0 ? 1 / item.oddDecimal : 0), 0);
    const hasSurebet = impliedSum < 1 && impliedSum > 0;
    
    // Margem: se impliedSum for menor que 1, temos arbitragem positiva.
    // Fórmula: margin = ((1 / implied_sum) - 1) * 100
    const marginPercent = impliedSum > 0 ? ((1 / impliedSum) - 1) * 100 : 0;
    
    // No cálculo de surebet:
    // stake_i = (total_stake / odd_i) / implied_sum
    // Isso garante que o retorno seja idêntico para todos os lados.
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

    // Como as pernas são arredondadas para 2 casas decimais, a soma das stakes pode diferir ligeiramente da stake total.
    // Vamos somar as stakes arredondadas para ver o lucro real do usuário com base no arredondamento.
    const actualTotalStake = legs.reduce((sum, leg) => sum + leg.recommendedStake, 0);
    
    // O retorno esperado ideal seria o mesmo em todas as pernas. 
    // Usaremos a média ou a primeira perna (já que o retorno é balanceado) para calcular o lucro esperado.
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

  /**
   * Processa uma lista de odds brutas (snapshots) e eventos para encontrar oportunidades de surebet
   */
  static findOpportunities(
    events: SportEvent[],
    markets: Market[],
    selections: MarketSelection[],
    oddsSnapshots: OddSnapshot[],
    bookmakers: Bookmaker[],
    settings: UserSettings
  ): { opportunities: SurebetOpportunity[]; alerts: string[] } {
    const opportunities: SurebetOpportunity[] = [];
    const alerts: string[] = [];

    // 1. Filtrar casas ativas (e opcionalmente apenas autorizadas)
    const activeBookmakers = bookmakers.filter(b => {
      if (!b.isActive) return false;
      if (settings.onlyAuthorized && b.status !== 'autorizada') return false;
      return true;
    });

    const activeBookmakerIds = new Set(activeBookmakers.map(b => b.id));

    // 2. Agrupar seleções por mercado
    const selectionsByMarket: Record<string, MarketSelection[]> = {};
    selections.forEach(sel => {
      if (!selectionsByMarket[sel.marketId]) {
        selectionsByMarket[sel.marketId] = [];
      }
      selectionsByMarket[sel.marketId].push(sel);
    });

    // 3. Agrupar odds snapshots por mercado e por seleção
    // Estrutura: marketId -> selectionId -> OddSnapshot[]
    const oddsByMarketAndSelection: Record<string, Record<string, OddSnapshot[]>> = {};
    oddsSnapshots.forEach(snap => {
      // Ignorar se a casa de aposta não estiver ativa no radar
      if (!activeBookmakerIds.has(snap.bookmakerId)) return;
      
      if (!oddsByMarketAndSelection[snap.marketId]) {
        oddsByMarketAndSelection[snap.marketId] = {};
      }
      if (!oddsByMarketAndSelection[snap.marketId][snap.selectionId]) {
        oddsByMarketAndSelection[snap.marketId][snap.selectionId] = [];
      }
      oddsByMarketAndSelection[snap.marketId][snap.selectionId].push(snap);
    });

    // 4. Analisar cada mercado
    markets.forEach(market => {
      const event = events.find(e => e.id === market.eventId);
      if (!event) return;

      const marketSels = selectionsByMarket[market.id] || [];
      const marketOdds = oddsByMarketAndSelection[market.id] || {};

      // Verificar se temos odds para TODAS as seleções exigidas pelo mercado
      const missingSelections: string[] = [];
      const bestOddsPerSelection: { selection: MarketSelection; bestOdd: OddSnapshot }[] = [];

      marketSels.forEach(sel => {
        const snaps = marketOdds[sel.id] || [];
        if (snaps.length === 0) {
          missingSelections.push(sel.selectionName);
        } else {
          // Encontrar a maior odd para essa seleção
          const best = snaps.reduce((max, curr) => (curr.oddDecimal > max.oddDecimal ? curr : max), snaps[0]);
          bestOddsPerSelection.push({ selection: sel, bestOdd: best });
        }
      });

      // Se faltar alguma seleção, o mercado está incompleto
      if (missingSelections.length > 0) {
        // Apenas alertar se tivermos pelo menos alguma odd no mercado (para não poluir se for vazio)
        if (bestOddsPerSelection.length > 0) {
          alerts.push(`Mercado incompleto para ${event.name} - ${market.marketName}. Faltando: ${missingSelections.join(', ')}`);
        }
        return;
      }

      // 5. Calcular Surebet usando as melhores odds de cada seleção
      const oddsInput = bestOddsPerSelection.map(item => ({
        selectionId: item.selection.id,
        oddDecimal: item.bestOdd.oddDecimal,
      }));

      const calc = this.calculate(oddsInput, settings.defaultStake);

      // Se impliedSum < 1, temos arbitragem positiva
      if (calc.impliedSum < 1.0 && calc.impliedSum > 0) {
        // Verificar se a margem atende à margem mínima configurada pelo usuário
        if (calc.marginPercent >= settings.minMargin) {
          // Mapear pernas (legs)
          const legs: OpportunityLeg[] = bestOddsPerSelection.map(item => {
            const bookmaker = bookmakers.find(b => b.id === item.bestOdd.bookmakerId)!;
            const legCalc = calc.legs.find(l => l.selectionId === item.selection.id)!;

            return {
              id: `${market.id}_${item.selection.id}`,
              selectionId: item.selection.id,
              selectionName: item.selection.selectionName,
              bookmakerId: bookmaker.id,
              bookmakerName: bookmaker.name,
              bookmakerStatus: bookmaker.status,
              oddDecimal: item.bestOdd.oddDecimal,
              recommendedStake: legCalc.recommendedStake,
              expectedReturn: legCalc.expectedReturn,
            };
          });

          // Determinar o status térmico baseado no tempo desde a última coleta de odd
          const timestamps = bestOddsPerSelection.map(item => new Date(item.bestOdd.collectedAt).getTime());
          const latestTimestamp = Math.max(...timestamps);
          const secondsAgo = (new Date().getTime() - latestTimestamp) / 1000;

          let status: 'quente' | 'morna' | 'fria' | 'morta' = 'quente';
          if (secondsAgo < settings.hotThresholdSec) {
            status = 'quente';
          } else if (secondsAgo < settings.warmThresholdSec) {
            status = 'morna';
          } else {
            status = 'fria';
          }

          opportunities.push({
            id: market.id, // O próprio ID do mercado serve de ID único para a oportunidade agrupada
            eventId: event.id,
            eventName: event.name,
            sport: event.sport,
            league: event.league,
            startTime: event.startTime,
            marketId: market.id,
            marketName: market.marketName,
            marketType: market.marketType,
            marginPercent: Number(calc.marginPercent.toFixed(2)),
            impliedSum: Number(calc.impliedSum.toFixed(4)),
            status,
            lastUpdatedAt: new Date(latestTimestamp).toISOString(),
            legs,
          });
        }
      }
    });

    // Ordenar por maior margem primeiro
    opportunities.sort((a, b) => b.marginPercent - a.marginPercent);

    return { opportunities, alerts };
  }
}
