import { SportEvent, Market, MarketSelection, OddSnapshot, Bookmaker } from '../../types';

export interface OddsProviderAdapter {
  name: string;
  sourceUrl: string;
  isEnabled: boolean;
  fetchRawData(): Promise<any>;
  parseEvents(raw: any): SportEvent[];
  parseMarkets(raw: any): Market[];
  parseOdds(raw: any): OddSnapshot[];
  normalizeEvent(raw: any): SportEvent;
  normalizeMarket(raw: any): Market;
  normalizeSelection(raw: any): MarketSelection;
  normalizeBookmaker(raw: any): Partial<Bookmaker>;
  getLastFetchStatus(): { status: 'sucesso' | 'erro' | 'ocioso'; timestamp: string; message?: string };
}

// ----------------------------------------------------
// 1. MOCK ODDS PROVIDER (DADOS PREMIUM TOTALMENTE NOVOS)
// ----------------------------------------------------
export class MockOddsProvider implements OddsProviderAdapter {
  name = 'MockOddsProvider';
  sourceUrl = 'https://api.mock-odds-gma.internal';
  isEnabled = true;
  private lastStatus: 'sucesso' | 'erro' | 'ocioso' = 'ocioso';
  private lastTimestamp = '';

  constructor(isEnabled = true) {
    this.isEnabled = isEnabled;
  }

  async fetchRawData(): Promise<any> {
    await new Promise(resolve => setTimeout(resolve, 300));
    const time = new Date().getTime();
    
    // Pequenas flutuações discretas
    const flux1 = Math.sin(time / 20000) * 0.08;
    const flux2 = Math.cos(time / 15000) * 0.10;
    const flux3 = Math.sin(time / 10000) * 0.05;

    this.lastStatus = 'sucesso';
    this.lastTimestamp = new Date().toISOString();

    return {
      timestamp: this.lastTimestamp,
      flux1,
      flux2,
      flux3
    };
  }

  parseEvents(raw: any): SportEvent[] {
    return [
      { id: 'mock_ev_101', name: 'Bayern de Munique x Real Madrid', sport: 'Futebol', league: 'UEFA Champions League', startTime: new Date(Date.now() + 14400000).toISOString() },
      { id: 'mock_ev_102', name: 'Inter de Milão x Juventus', sport: 'Futebol', league: 'Serie A Italiana', startTime: new Date(Date.now() + 90000000).toISOString() },
      { id: 'mock_ev_103', name: 'Arsenal x Chelsea', sport: 'Futebol', league: 'Premier League', startTime: new Date(Date.now() + 25000000).toISOString() },
      { id: 'mock_ev_104', name: 'Miami Heat x Golden State Warriors', sport: 'Basquete', league: 'NBA', startTime: new Date(Date.now() + 40000000).toISOString() },
      { id: 'mock_ev_105', name: 'Carlos Alcaraz x Novak Djokovic', sport: 'Tênis', league: 'Roland Garros', startTime: new Date(Date.now() + 50000000).toISOString() }
    ];
  }

  parseMarkets(raw: any): Market[] {
    return [
      // Bayern x Real (Futebol)
      { id: 'mock_mk_101_1x2', eventId: 'mock_ev_101', sport: 'Futebol', marketType: '1X2', marketName: 'Vencedor Partida (1X2)', expectedOutcomesCount: 3, isExhaustiveMarket: true },
      { id: 'mock_mk_101_ou', eventId: 'mock_ev_101', sport: 'Futebol', marketType: 'OVER_UNDER_2.5', marketName: 'Total de Gols (Mais/Menos 2.5)', expectedOutcomesCount: 2, isExhaustiveMarket: true },
      
      // Inter x Juventus (Futebol)
      { id: 'mock_mk_102_bts', eventId: 'mock_ev_102', sport: 'Futebol', marketType: 'BOTH_TEAMS_TO_SCORE', marketName: 'Ambas Equipes Marcam', expectedOutcomesCount: 2, isExhaustiveMarket: true },
      
      // Arsenal x Chelsea (Futebol)
      { id: 'mock_mk_103_1x2', eventId: 'mock_ev_103', sport: 'Futebol', marketType: '1X2', marketName: 'Vencedor Partida (1X2)', expectedOutcomesCount: 3, isExhaustiveMarket: true },
      { id: 'mock_mk_103_ou', eventId: 'mock_ev_103', sport: 'Futebol', marketType: 'OVER_UNDER_2.5', marketName: 'Total de Gols (Mais/Menos 2.5)', expectedOutcomesCount: 2, isExhaustiveMarket: true },

      // Miami x GSW (Basquete)
      { id: 'mock_mk_104_ml', eventId: 'mock_ev_104', sport: 'Basquete', marketType: 'MONEYLINE', marketName: 'Vencedor da Partida (Moneyline)', expectedOutcomesCount: 2, isExhaustiveMarket: true },

      // Alcaraz x Djokovic (Tênis)
      { id: 'mock_mk_105_ml', eventId: 'mock_ev_105', sport: 'Tênis', marketType: 'MONEYLINE', marketName: 'Vencedor do Encontro', expectedOutcomesCount: 2, isExhaustiveMarket: true }
    ];
  }

  getSelectionsForMarkets(markets: Market[]): MarketSelection[] {
    const list: MarketSelection[] = [];
    markets.forEach(m => {
      if (m.marketType === '1X2') {
        list.push(
          { id: `${m.id}_home`, marketId: m.id, selectionName: 'Casa (1)', normalizedSelectionKey: 'home', outcomeOrder: 1 },
          { id: `${m.id}_draw`, marketId: m.id, selectionName: 'Empate (X)', normalizedSelectionKey: 'draw', outcomeOrder: 2 },
          { id: `${m.id}_away`, marketId: m.id, selectionName: 'Fora (2)', normalizedSelectionKey: 'away', outcomeOrder: 3 }
        );
      } else if (m.marketType === 'OVER_UNDER_2.5') {
        list.push(
          { id: `${m.id}_over`, marketId: m.id, selectionName: 'Mais de 2.5 Gols', normalizedSelectionKey: 'over_2.5', outcomeOrder: 1 },
          { id: `${m.id}_under`, marketId: m.id, selectionName: 'Menos de 2.5 Gols', normalizedSelectionKey: 'under_2.5', outcomeOrder: 2 }
        );
      } else if (m.marketType === 'BOTH_TEAMS_TO_SCORE') {
        list.push(
          { id: `${m.id}_yes`, marketId: m.id, selectionName: 'Sim', normalizedSelectionKey: 'yes', outcomeOrder: 1 },
          { id: `${m.id}_no`, marketId: m.id, selectionName: 'Não', normalizedSelectionKey: 'no', outcomeOrder: 2 }
        );
      } else if (m.marketType === 'MONEYLINE') {
        list.push(
          { id: `${m.id}_home`, marketId: m.id, selectionName: 'Time A / Jogador A', normalizedSelectionKey: 'home', outcomeOrder: 1 },
          { id: `${m.id}_away`, marketId: m.id, selectionName: 'Time B / Jogador B', normalizedSelectionKey: 'away', outcomeOrder: 2 }
        );
      }
    });
    return list;
  }

  parseOdds(raw: any): OddSnapshot[] {
    const flux1 = raw.flux1 || 0;
    const flux2 = raw.flux2 || 0;
    const flux3 = raw.flux3 || 0;
    const collectedAt = raw.timestamp || new Date().toISOString();

    const odds: OddSnapshot[] = [];

    // --- JOGO 1: Bayern x Real Madrid ---
    // 1X2 - SUREBET DE 3 RESULTADOS (Retorno Alto!)
    // Casa: 3.40 (Novibet), Empate: 3.45 (Betfair Exchange), Fora: 3.25 (Betano)
    const mcHome = Number((3.40 + flux1).toFixed(2));
    const mcDraw = Number((3.45 - flux2).toFixed(2));
    const mcAway = Number((3.25 + flux3).toFixed(2));
    odds.push(
      { id: 'mock_od_101', eventId: 'mock_ev_101', marketId: 'mock_mk_101_1x2', selectionId: 'mock_mk_101_1x2_home', bookmakerId: 'bookmaker_user_11', oddDecimal: mcHome, source: 'mock', collectedAt },
      { id: 'mock_od_102', eventId: 'mock_ev_101', marketId: 'mock_mk_101_1x2', selectionId: 'mock_mk_101_1x2_draw', bookmakerId: 'bookmaker_user_15', oddDecimal: mcDraw, source: 'mock', collectedAt },
      { id: 'mock_od_103', eventId: 'mock_ev_101', marketId: 'mock_mk_101_1x2', selectionId: 'mock_mk_101_1x2_away', bookmakerId: 'bookmaker_user_1', oddDecimal: mcAway, source: 'mock', collectedAt }
    );

    // Over/Under - Sem Surebet
    odds.push(
      { id: 'mock_od_104', eventId: 'mock_ev_101', marketId: 'mock_mk_101_ou', selectionId: 'mock_mk_101_ou_over', bookmakerId: 'bookmaker_user_0', oddDecimal: Number((1.85 + flux1).toFixed(2)), source: 'mock', collectedAt },
      { id: 'mock_od_105', eventId: 'mock_ev_101', marketId: 'mock_mk_101_ou', selectionId: 'mock_mk_101_ou_under', bookmakerId: 'bookmaker_user_1', oddDecimal: Number((1.90 - flux1).toFixed(2)), source: 'mock', collectedAt }
    );

    // --- JOGO 2: Inter x Juventus ---
    // Ambas marcam - SUREBET
    // Sim: 2.12 (Bet365), Não: 2.15 (Superbet)
    const btsYesOdd = Number((2.12 + flux2).toFixed(2));
    const btsNoOdd = Number((2.15 - flux3).toFixed(2));
    odds.push(
      { id: 'mock_od_106', eventId: 'mock_ev_102', marketId: 'mock_mk_102_bts', selectionId: 'mock_mk_102_bts_yes', bookmakerId: 'bookmaker_user_0', oddDecimal: btsYesOdd, source: 'mock', collectedAt },
      { id: 'mock_od_107', eventId: 'mock_ev_102', marketId: 'mock_mk_102_bts', selectionId: 'mock_mk_102_bts_no', bookmakerId: 'bookmaker_user_2', oddDecimal: btsNoOdd, source: 'mock', collectedAt }
    );

    // --- JOGO 3: Arsenal x Chelsea ---
    // Over/Under 2.5 - SUREBET
    // Over: 2.18 na KTO, Under: 2.14 na Betfair
    const ouOver = Number((2.18 + flux3).toFixed(2));
    const ouUnder = Number((2.14 - flux1).toFixed(2));
    odds.push(
      { id: 'mock_od_108', eventId: 'mock_ev_103', marketId: 'mock_mk_103_ou', selectionId: 'mock_mk_103_ou_over', bookmakerId: 'bookmaker_user_4', oddDecimal: ouOver, source: 'mock', collectedAt },
      { id: 'mock_od_109', eventId: 'mock_ev_103', marketId: 'mock_mk_103_ou', selectionId: 'mock_mk_103_ou_under', bookmakerId: 'bookmaker_user_5', oddDecimal: ouUnder, source: 'mock', collectedAt }
    );

    // --- JOGO 4: Miami x GSW ---
    // Moneyline - SUREBET
    // Miami: 2.06 na Superbet, GSW: 2.14 na Betano
    const mlHome = Number((2.06 + flux2).toFixed(2));
    const mlAway = Number((2.14 - flux2).toFixed(2));
    odds.push(
      { id: 'mock_od_110', eventId: 'mock_ev_104', marketId: 'mock_mk_104_ml', selectionId: 'mock_mk_104_ml_home', bookmakerId: 'bookmaker_user_2', oddDecimal: mlHome, source: 'mock', collectedAt },
      { id: 'mock_od_111', eventId: 'mock_ev_104', marketId: 'mock_mk_104_ml', selectionId: 'mock_mk_104_ml_away', bookmakerId: 'bookmaker_user_1', oddDecimal: mlAway, source: 'mock', collectedAt }
    );

    // --- JOGO 5: Alcaraz x Djokovic ---
    // Moneyline - SUREBET
    // Alcaraz: 2.10 na EstrelaBet, Djokovic: 2.08 na Sportingbet
    const tenHome = Number((2.10 + flux1).toFixed(2));
    const tenAway = Number((2.08 - flux3).toFixed(2));
    odds.push(
      { id: 'mock_od_112', eventId: 'mock_ev_105', marketId: 'mock_mk_105_ml', selectionId: 'mock_mk_105_ml_home', bookmakerId: 'bookmaker_user_3', oddDecimal: tenHome, source: 'mock', collectedAt },
      { id: 'mock_od_113', eventId: 'mock_ev_105', marketId: 'mock_mk_105_ml', selectionId: 'mock_mk_105_ml_away', bookmakerId: 'bookmaker_user_6', oddDecimal: tenAway, source: 'mock', collectedAt }
    );

    return odds;
  }

  normalizeEvent(raw: any): SportEvent { return raw; }
  normalizeMarket(raw: any): Market { return raw; }
  normalizeSelection(raw: any): MarketSelection { return raw; }
  normalizeBookmaker(raw: any): Partial<Bookmaker> { return raw; }

  getLastFetchStatus() {
    return {
      status: this.lastStatus,
      timestamp: this.lastTimestamp || new Date().toISOString()
    };
  }
}

// ----------------------------------------------------
// 2. CSV IMPORT PROVIDER
// ----------------------------------------------------
export class CsvImportProvider implements OddsProviderAdapter {
  name = 'CsvImportProvider';
  sourceUrl = 'local://csv-upload';
  isEnabled = true;
  private lastStatus: 'sucesso' | 'erro' | 'ocioso' = 'ocioso';
  private lastTimestamp = '';
  private csvText = '';

  constructor(csvText = '', isEnabled = true) {
    this.csvText = csvText;
    this.isEnabled = isEnabled;
  }

  setCsvText(text: string) {
    this.csvText = text;
  }

  async fetchRawData(): Promise<any> {
    if (!this.csvText) {
      this.lastStatus = 'erro';
      this.lastTimestamp = new Date().toISOString();
      throw new Error('Nenhum texto CSV fornecido para processamento.');
    }
    this.lastStatus = 'sucesso';
    this.lastTimestamp = new Date().toISOString();
    return this.csvText;
  }

  parseCSVLines(csv: string): string[][] {
    const lines: string[][] = [];
    let currentLine: string[] = [];
    let currentField = '';
    let inQuotes = false;

    for (let i = 0; i < csv.length; i++) {
      const char = csv[i];
      const nextChar = csv[i + 1];

      if (inQuotes) {
        if (char === '"') {
          if (nextChar === '"') {
            currentField += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          currentField += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === ',') {
          currentLine.push(currentField.trim());
          currentField = '';
        } else if (char === '\r' || char === '\n') {
          if (char === '\r' && nextChar === '\n') {
            i++;
          }
          currentLine.push(currentField.trim());
          if (currentLine.length > 1 || currentLine[0] !== '') {
            lines.push(currentLine);
          }
          currentLine = [];
          currentField = '';
        } else {
          currentField += char;
        }
      }
    }
    
    if (currentField !== '' || currentLine.length > 0) {
      currentLine.push(currentField.trim());
      lines.push(currentLine);
    }

    return lines;
  }

  private processCsvData(raw: string) {
    const lines = this.parseCSVLines(raw);
    if (lines.length <= 1) return [];

    const headers = lines[0].map(h => h.toLowerCase().trim());
    
    const getIndex = (name: string) => headers.indexOf(name);

    const idxSport = getIndex('sport');
    const idxLeague = getIndex('league');
    const idxEventName = getIndex('event_name');
    const idxStartTime = getIndex('event_start_time');
    const idxMarketType = getIndex('market_type');
    const idxMarketName = getIndex('market_name');
    const idxSelName = getIndex('selection_name');
    const idxBookmaker = getIndex('bookmaker');
    const idxOdd = getIndex('odd_decimal');
    const idxLink = getIndex('bet_link');
    const idxCollected = getIndex('collected_at');

    const resultRows: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.length < 8) continue;

      const getValue = (idx: number, def = '') => (idx !== -1 && idx < line.length ? line[idx] : def);

      resultRows.push({
        sport: getValue(idxSport, 'Futebol'),
        league: getValue(idxLeague, 'Desconhecida'),
        eventName: getValue(idxEventName, 'Evento'),
        startTime: getValue(idxStartTime, new Date().toISOString()),
        marketType: getValue(idxMarketType, '1X2'),
        marketName: getValue(idxMarketName, 'Resultado Final'),
        selectionName: getValue(idxSelName),
        bookmaker: getValue(idxBookmaker),
        oddDecimal: parseFloat(getValue(idxOdd, '1.0')),
        betLink: getValue(idxLink, ''),
        collectedAt: getValue(idxCollected, new Date().toISOString())
      });
    }

    return resultRows;
  }

  parseEvents(raw: any): SportEvent[] {
    const rows = this.processCsvData(raw);
    const eventMap = new Map<string, SportEvent>();

    rows.forEach(row => {
      const id = `csv_ev_${row.eventName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
      eventMap.set(id, {
        id,
        name: row.eventName,
        sport: row.sport,
        league: row.league,
        startTime: row.startTime
      });
    });

    return Array.from(eventMap.values());
  }

  parseMarkets(raw: any): Market[] {
    const rows = this.processCsvData(raw);
    const marketMap = new Map<string, Market>();

    rows.forEach(row => {
      const eventId = `csv_ev_${row.eventName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
      const id = `csv_mk_${eventId}_${row.marketType.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
      
      marketMap.set(id, {
        id,
        eventId,
        sport: row.sport,
        marketType: row.marketType,
        marketName: row.marketName,
        expectedOutcomesCount: row.marketType === '1X2' ? 3 : 2,
        isExhaustiveMarket: true
      });
    });

    return Array.from(marketMap.values());
  }

  getSelectionsForCsv(raw: any): MarketSelection[] {
    const rows = this.processCsvData(raw);
    const selectionMap = new Map<string, MarketSelection>();

    rows.forEach(row => {
      const eventId = `csv_ev_${row.eventName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
      const marketId = `csv_mk_${eventId}_${row.marketType.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
      const id = `csv_sel_${marketId}_${row.selectionName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

      selectionMap.set(id, {
        id,
        marketId,
        selectionName: row.selectionName,
        normalizedSelectionKey: row.selectionName.toLowerCase().replace(/[^a-z0-9]/g, '_'),
        outcomeOrder: 0
      });
    });

    return Array.from(selectionMap.values());
  }

  parseOdds(raw: any): OddSnapshot[] {
    const rows = this.processCsvData(raw);
    const odds: OddSnapshot[] = [];

    rows.forEach((row, index) => {
      const eventId = `csv_ev_${row.eventName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
      const marketId = `csv_mk_${eventId}_${row.marketType.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
      const selectionId = `csv_sel_${marketId}_${row.selectionName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
      
      const bookmakerName = row.bookmaker.toLowerCase().trim();
      let bookmakerId = 'bookmaker_user_0';
      
      if (bookmakerName.includes('365')) bookmakerId = 'bookmaker_user_0';
      else if (bookmakerName.includes('tano')) bookmakerId = 'bookmaker_user_1';
      else if (bookmakerName.includes('super')) bookmakerId = 'bookmaker_user_2';
      else if (bookmakerName.includes('estrela')) bookmakerId = 'bookmaker_user_3';
      else if (bookmakerName.includes('kto')) bookmakerId = 'bookmaker_user_4';
      else if (bookmakerName.includes('fair') && bookmakerName.includes('ex')) bookmakerId = 'bookmaker_user_15';
      else if (bookmakerName.includes('fair')) bookmakerId = 'bookmaker_user_5';
      else if (bookmakerName.includes('sporting')) bookmakerId = 'bookmaker_user_6';
      else if (bookmakerName.includes('1x')) bookmakerId = 'bookmaker_user_7';
      else if (bookmakerName.includes('f12')) bookmakerId = 'bookmaker_user_8';
      else if (bookmakerName.includes('luva')) bookmakerId = 'bookmaker_user_9';
      else if (bookmakerName.includes('nacional')) bookmakerId = 'bookmaker_user_10';
      else if (bookmakerName.includes('novi')) bookmakerId = 'bookmaker_user_11';
      else if (bookmakerName.includes('stake')) bookmakerId = 'bookmaker_user_12';
      else if (bookmakerName.includes('esporte')) bookmakerId = 'bookmaker_user_13';
      else if (bookmakerName.includes('pix')) bookmakerId = 'bookmaker_user_14';

      odds.push({
        id: `csv_od_${index}_${Math.random().toString(36).substr(2, 4)}`,
        eventId,
        marketId,
        selectionId,
        bookmakerId,
        oddDecimal: row.oddDecimal,
        source: 'csv',
        betLink: row.betLink,
        collectedAt: row.collectedAt
      });
    });

    return odds;
  }

  normalizeEvent(raw: any): SportEvent { return raw; }
  normalizeMarket(raw: any): Market { return raw; }
  normalizeSelection(raw: any): MarketSelection { return raw; }
  normalizeBookmaker(raw: any): Partial<Bookmaker> { return raw; }

  getLastFetchStatus() {
    return {
      status: this.lastStatus,
      timestamp: this.lastTimestamp || new Date().toISOString()
    };
  }
}

// ----------------------------------------------------
// 3. ODDS AGORA PROVIDER
// ----------------------------------------------------
export class OddsAgoraProvider implements OddsProviderAdapter {
  name = 'OddsAgoraProvider';
  sourceUrl = 'https://api.oddsagora.com/v1';
  isEnabled = false;

  async fetchRawData(): Promise<any> { return null; }
  parseEvents(raw: any): SportEvent[] { return []; }
  parseMarkets(raw: any): Market[] { return []; }
  parseOdds(raw: any): OddSnapshot[] { return []; }
  normalizeEvent(raw: any): SportEvent { return raw; }
  normalizeMarket(raw: any): Market { return raw; }
  normalizeSelection(raw: any): MarketSelection { return raw; }
  normalizeBookmaker(raw: any): Partial<Bookmaker> { return raw; }
  getLastFetchStatus() {
    return { status: 'ocioso' as const, timestamp: new Date().toISOString(), message: 'Adapter preparado para integração futura.' };
  }
}

// ----------------------------------------------------
// 4. ODDSPEDIA PROVIDER
// ----------------------------------------------------
export class OddspediaProvider implements OddsProviderAdapter {
  name = 'OddspediaProvider';
  sourceUrl = 'https://api.oddspedia.com/v2';
  isEnabled = false;

  async fetchRawData(): Promise<any> { return null; }
  parseEvents(raw: any): SportEvent[] { return []; }
  parseMarkets(raw: any): Market[] { return []; }
  parseOdds(raw: any): OddSnapshot[] { return []; }
  normalizeEvent(raw: any): SportEvent { return raw; }
  normalizeMarket(raw: any): Market { return raw; }
  normalizeSelection(raw: any): MarketSelection { return raw; }
  normalizeBookmaker(raw: any): Partial<Bookmaker> { return raw; }
  getLastFetchStatus() {
    return { status: 'ocioso' as const, timestamp: new Date().toISOString(), message: 'Adapter preparado para integração futura.' };
  }
}
