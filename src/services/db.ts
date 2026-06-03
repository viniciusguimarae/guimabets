import { 
  Bookmaker, 
  AuthorizedBookmaker, 
  SportEvent, 
  Market, 
  MarketSelection, 
  OddSnapshot, 
  ExecutedBet, 
  Alert, 
  ProviderLog, 
  UserSettings, 
  BookmakerStatus 
} from '../types';

// Chaves para o LocalStorage do usuário único
const KEYS = {
  BOOKMAKERS: 'gma_bets_bookmakers',
  AUTHORIZED: 'gma_bets_authorized_bookmakers',
  EVENTS: 'gma_bets_events',
  MARKETS: 'gma_bets_markets',
  SELECTIONS: 'gma_bets_market_selections',
  ODDS: 'gma_bets_odds_snapshots',
  HISTORY: 'gma_bets_executed_bets',
  LOGS: 'gma_bets_provider_logs',
  ALERTS: 'gma_bets_alerts',
  SETTINGS: 'gma_bets_user_settings'
};

// Sementes iniciais para Casas de Apostas
const INITIAL_BOOKMAKERS: Omit<Bookmaker, 'id'>[] = [
  { name: 'Bet365', domain: 'bet365.com', status: 'autorizada', hasAccount: true, currentBalance: 1500, maxLimit: 5000, avgWithdrawalTime: '4 horas', notes: 'Excelente para mercados alternativos de escanteios.', isActive: true, isFavorite: true },
  { name: 'Betano', domain: 'betano.com', status: 'autorizada', hasAccount: true, currentBalance: 2300, maxLimit: 10000, avgWithdrawalTime: '1 hora (Pix)', notes: 'Odds muito competitivas e pagamentos via Pix instantâneos.', isActive: true, isFavorite: true },
  { name: 'Superbet', domain: 'superbet.com', status: 'autorizada', hasAccount: true, currentBalance: 800, maxLimit: 8000, avgWithdrawalTime: '30 minutos (Pix)', notes: 'Ótima cobertura de futebol sul-americano.', isActive: true, isFavorite: true },
  { name: 'EstrelaBet', domain: 'estrelabet.com', status: 'autorizada', hasAccount: false, currentBalance: 0, maxLimit: 4000, avgWithdrawalTime: '2 horas', notes: 'Foco no mercado brasileiro.', isActive: true, isFavorite: false },
  { name: 'KTO', domain: 'kto.com', status: 'autorizada', hasAccount: true, currentBalance: 450, maxLimit: 3000, avgWithdrawalTime: '3 horas', notes: 'Excelente política de freebets.', isActive: true, isFavorite: false },
  { name: 'Betfair', domain: 'betfair.com', status: 'autorizada', hasAccount: true, currentBalance: 3200, maxLimit: 25000, avgWithdrawalTime: '12 horas', notes: 'Ideal para combinar com a Exchange.', isActive: true, isFavorite: true },
  { name: 'Sportingbet', domain: 'sportingbet.com', status: 'autorizada', hasAccount: false, currentBalance: 0, maxLimit: 6000, avgWithdrawalTime: '1 dia', notes: 'Interface simples e tradicional.', isActive: true, isFavorite: false },
  { name: '1xBet', domain: '1xbet.com', status: 'judicial', hasAccount: true, currentBalance: 150, maxLimit: 15000, avgWithdrawalTime: '2 dias', notes: 'Frequentes problemas de limitação. Usar com cautela.', isActive: true, isFavorite: false },
  { name: 'F12.Bet', domain: 'f12.bet', status: 'autorizada', hasAccount: false, currentBalance: 0, maxLimit: 5000, avgWithdrawalTime: '10 minutos', notes: 'Fundada pelo jogador Falcão. Pagamentos rápidos.', isActive: true, isFavorite: false },
  { name: 'LuvaBet', domain: 'luvabet.com', status: 'desconhecida', hasAccount: false, currentBalance: 0, maxLimit: 2000, avgWithdrawalTime: '1 hora', notes: 'Nova no mercado.', isActive: true, isFavorite: false },
  { name: 'Betnacional', domain: 'betnacional.com', status: 'autorizada', hasAccount: false, currentBalance: 0, maxLimit: 5000, avgWithdrawalTime: '15 minutos', notes: 'Muito estável no Brasil.', isActive: true, isFavorite: false },
  { name: 'Novibet', domain: 'novibet.com', status: 'autorizada', hasAccount: true, currentBalance: 600, maxLimit: 7500, avgWithdrawalTime: '2 horas', notes: 'Bons bônus de recarga.', isActive: true, isFavorite: false },
  { name: 'Stake', domain: 'stake.com', status: 'bloqueada', hasAccount: false, currentBalance: 0, maxLimit: 50000, avgWithdrawalTime: 'Instantâneo (Crypto)', notes: 'Bloqueada por questões de licença no país.', isActive: false, isFavorite: false },
  { name: 'Esportes da Sorte', domain: 'esportesdasorte.com', status: 'autorizada', hasAccount: false, currentBalance: 0, maxLimit: 6000, avgWithdrawalTime: '1 hora', notes: 'Grande patrocinador de clubes brasileiros.', isActive: true, isFavorite: false },
  { name: 'Pixbet', domain: 'pixbet.com', status: 'autorizada', hasAccount: false, currentBalance: 0, maxLimit: 4000, avgWithdrawalTime: '5 minutos', notes: 'Focada em saques rápidos via Pix.', isActive: true, isFavorite: false },
  { name: 'Betfair Exchange', domain: 'betfair.com/exchange', status: 'autorizada', hasAccount: true, currentBalance: 4500, maxLimit: 100000, avgWithdrawalTime: '12 horas', notes: 'Bolsa de apostas esportivas. Sem limites de conta comuns.', isActive: true, isFavorite: true }
];

// Configurações padrão do usuário
const DEFAULT_SETTINGS: UserSettings = {
  defaultStake: 1000,
  minMargin: 0.5,
  onlyAuthorized: false,
  hotThresholdSec: 20,
  warmThresholdSec: 60,
  currency: 'BRL',
  theme: 'dark',
  mockEnabled: true,
  manualEnabled: true,
  providersEnabled: {
    'MockOddsProvider': true,
    'CsvImportProvider': true,
    'OddsAgoraProvider': false,
    'OddspediaProvider': false
  }
};

export class DatabaseService {
  private static isClient(): boolean {
    return typeof window !== 'undefined';
  }

  private static get<T>(key: string, defaultValue: T): T {
    if (!this.isClient()) return defaultValue;
    const item = localStorage.getItem(key);
    if (!item) {
      this.set(key, defaultValue);
      return defaultValue;
    }
    try {
      return JSON.parse(item);
    } catch {
      return defaultValue;
    }
  }

  private static set<T>(key: string, value: T): void {
    if (!this.isClient()) return;
    localStorage.setItem(key, JSON.stringify(value));
  }

  // --- CONFIGURAÇÕES ---
  static getSettings(): UserSettings {
    return this.get<UserSettings>(KEYS.SETTINGS, DEFAULT_SETTINGS);
  }

  static updateSettings(settings: Partial<UserSettings>): UserSettings {
    const current = this.getSettings();
    const updated = { ...current, ...settings };
    this.set(KEYS.SETTINGS, updated);
    return updated;
  }

  // --- CASAS DE APOSTAS ---
  static getBookmakers(): Bookmaker[] {
    const list = this.get<Bookmaker[]>(KEYS.BOOKMAKERS, []);
    if (list.length === 0) {
      const initial = INITIAL_BOOKMAKERS.map((b, i) => ({
        ...b,
        id: `bookmaker_${i}`
      }));
      this.set(KEYS.BOOKMAKERS, initial);
      return initial;
    }
    return list;
  }

  static updateBookmaker(updated: Bookmaker): Bookmaker[] {
    const list = this.getBookmakers();
    const index = list.findIndex(b => b.id === updated.id);
    if (index !== -1) {
      list[index] = updated;
      this.set(KEYS.BOOKMAKERS, list);
    }
    return list;
  }

  static createBookmaker(bookmaker: Omit<Bookmaker, 'id'>): Bookmaker[] {
    const list = this.getBookmakers();
    const newBookmaker: Bookmaker = {
      ...bookmaker,
      id: `bookmaker_${Math.random().toString(36).substr(2, 9)}`
    };
    list.push(newBookmaker);
    this.set(KEYS.BOOKMAKERS, list);
    return list;
  }

  // --- CASAS AUTORIZADAS (CSV IMPORT) ---
  static getAuthorizedBookmakers(): AuthorizedBookmaker[] {
    return this.get<AuthorizedBookmaker[]>(KEYS.AUTHORIZED, []);
  }

  static importAuthorizedBookmakers(csvData: Omit<AuthorizedBookmaker, 'id' | 'createdAt'>[]): void {
    const current = this.getAuthorizedBookmakers();
    const imported: AuthorizedBookmaker[] = csvData.map(item => ({
      id: `auth_${Math.random().toString(36).substr(2, 9)}`,
      name: item.name,
      domain: item.domain.toLowerCase().trim(),
      createdAt: new Date().toISOString()
    }));
    
    const map = new Map<string, AuthorizedBookmaker>();
    current.forEach(item => map.set(item.domain, item));
    imported.forEach(item => map.set(item.domain, item));
    
    this.set(KEYS.AUTHORIZED, Array.from(map.values()));
  }

  static clearAuthorizedBookmakers(): void {
    this.set(KEYS.AUTHORIZED, []);
  }

  // --- DADOS DO RADAR (EVENTOS, MERCADOS, ODDS) ---
  static getEvents(): SportEvent[] {
    return this.get<SportEvent[]>(KEYS.EVENTS, []);
  }

  static getMarkets(): Market[] {
    return this.get<Market[]>(KEYS.MARKETS, []);
  }

  static getSelections(): MarketSelection[] {
    return this.get<MarketSelection[]>(KEYS.SELECTIONS, []);
  }

  static getOddsSnapshots(): OddSnapshot[] {
    return this.get<OddSnapshot[]>(KEYS.ODDS, []);
  }

  static saveOddsBatch(data: {
    events: SportEvent[];
    markets: Market[];
    selections: MarketSelection[];
    odds: OddSnapshot[];
  }): void {
    const currentEvents = this.getEvents();
    const currentMarkets = this.getMarkets();
    const currentSelections = this.getSelections();
    const currentOdds = this.getOddsSnapshots();

    const eventMap = new Map<string, SportEvent>();
    currentEvents.forEach(e => eventMap.set(e.id, e));
    data.events.forEach(e => eventMap.set(e.id, e));
    this.set(KEYS.EVENTS, Array.from(eventMap.values()));

    const marketMap = new Map<string, Market>();
    currentMarkets.forEach(m => marketMap.set(m.id, m));
    data.markets.forEach(m => marketMap.set(m.id, m));
    this.set(KEYS.MARKETS, Array.from(marketMap.values()));

    const selectionMap = new Map<string, MarketSelection>();
    currentSelections.forEach(s => selectionMap.set(s.id, s));
    data.selections.forEach(s => selectionMap.set(s.id, s));
    this.set(KEYS.SELECTIONS, Array.from(selectionMap.values()));

    const oddMap = new Map<string, OddSnapshot>();
    currentOdds.forEach(o => oddMap.set(`${o.marketId}_${o.selectionId}_${o.bookmakerId}`, o));
    data.odds.forEach(o => oddMap.set(`${o.marketId}_${o.selectionId}_${o.bookmakerId}`, o));
    this.set(KEYS.ODDS, Array.from(oddMap.values()));
  }

  static addManualOdd(input: {
    sport: string;
    league: string;
    eventName: string;
    startTime: string;
    marketType: string;
    marketName: string;
    selectionName: string;
    bookmakerId: string;
    oddDecimal: number;
    betLink?: string;
  }): void {
    const events = this.getEvents();
    const markets = this.getMarkets();
    const selections = this.getSelections();

    let event = events.find(e => e.name.toLowerCase().trim() === input.eventName.toLowerCase().trim());
    if (!event) {
      event = {
        id: `ev_${Math.random().toString(36).substr(2, 9)}`,
        name: input.eventName,
        sport: input.sport,
        league: input.league,
        startTime: input.startTime || new Date().toISOString()
      };
      events.push(event);
      this.set(KEYS.EVENTS, events);
    }

    let market = markets.find(m => m.eventId === event!.id && m.marketType === input.marketType);
    if (!market) {
      market = {
        id: `mk_${Math.random().toString(36).substr(2, 9)}`,
        eventId: event.id,
        sport: input.sport,
        marketType: input.marketType,
        marketName: input.marketName,
        expectedOutcomesCount: input.marketType === '1X2' ? 3 : 2,
        isExhaustiveMarket: true
      };
      markets.push(market);
      this.set(KEYS.MARKETS, markets);
    }

    let selection = selections.find(s => s.marketId === market!.id && s.selectionName.toLowerCase().trim() === input.selectionName.toLowerCase().trim());
    if (!selection) {
      const existing = selections.filter(s => s.marketId === market!.id);
      selection = {
        id: `sl_${Math.random().toString(36).substr(2, 9)}`,
        marketId: market.id,
        selectionName: input.selectionName,
        normalizedSelectionKey: input.selectionName.toLowerCase().replace(/[^a-z0-9]/g, '_'),
        outcomeOrder: existing.length + 1
      };
      selections.push(selection);
      this.set(KEYS.SELECTIONS, selections);
    }

    const odds = this.getOddsSnapshots();
    const filteredOdds = odds.filter(o => !(o.marketId === market!.id && o.selectionId === selection!.id && o.bookmakerId === input.bookmakerId));
    
    const newOdd: OddSnapshot = {
      id: `odd_${Math.random().toString(36).substr(2, 9)}`,
      eventId: event.id,
      marketId: market.id,
      selectionId: selection.id,
      bookmakerId: input.bookmakerId,
      oddDecimal: input.oddDecimal,
      source: 'manual',
      betLink: input.betLink,
      collectedAt: new Date().toISOString()
    };
    
    filteredOdds.push(newOdd);
    this.set(KEYS.ODDS, filteredOdds);
  }

  static clearOdds(): void {
    this.set(KEYS.EVENTS, []);
    this.set(KEYS.MARKETS, []);
    this.set(KEYS.SELECTIONS, []);
    this.set(KEYS.ODDS, []);
  }

  // --- HISTÓRICO DE ENTRADAS ---
  static getExecutedBets(): ExecutedBet[] {
    return this.get<ExecutedBet[]>(KEYS.HISTORY, []);
  }

  static saveExecutedBet(bet: Omit<ExecutedBet, 'id' | 'createdAt'>): ExecutedBet[] {
    const list = this.getExecutedBets();
    const newBet: ExecutedBet = {
      ...bet,
      id: `bet_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString()
    };
    list.unshift(newBet);
    this.set(KEYS.HISTORY, list);
    return list;
  }

  static updateExecutedBet(updated: ExecutedBet): ExecutedBet[] {
    const list = this.getExecutedBets();
    const index = list.findIndex(b => b.id === updated.id);
    if (index !== -1) {
      list[index] = updated;
      this.set(KEYS.HISTORY, list);
    }
    return list;
  }

  static deleteExecutedBet(id: string): ExecutedBet[] {
    const list = this.getExecutedBets().filter(b => b.id !== id);
    this.set(KEYS.HISTORY, list);
    return list;
  }

  // --- LOGS DE PROVEDORES ---
  static getProviderLogs(): ProviderLog[] {
    return this.get<ProviderLog[]>(KEYS.LOGS, []);
  }

  static addProviderLog(providerName: string, status: 'sucesso' | 'erro' | 'rodando', message: string): void {
    const logs = this.getProviderLogs();
    const newLog: ProviderLog = {
      id: `log_${Math.random().toString(36).substr(2, 9)}`,
      providerName,
      status,
      message,
      createdAt: new Date().toISOString()
    };
    logs.unshift(newLog);
    this.set(KEYS.LOGS, logs.slice(0, 100));
  }

  // --- ALERTAS ---
  static getAlerts(): Alert[] {
    return this.get<Alert[]>(KEYS.ALERTS, []);
  }

  static addAlert(type: Alert['type'], message: string): void {
    const list = this.getAlerts();
    const newAlert: Alert = {
      id: `alert_${Math.random().toString(36).substr(2, 9)}`,
      type,
      message,
      read: false,
      createdAt: new Date().toISOString()
    };
    list.unshift(newAlert);
    this.set(KEYS.ALERTS, list.slice(0, 50));
  }

  static markAlertAsRead(alertId: string): void {
    const list = this.getAlerts();
    const index = list.findIndex(a => a.id === alertId);
    if (index !== -1) {
      list[index].read = true;
      this.set(KEYS.ALERTS, list);
    }
  }

  static markAllAlertsAsRead(): void {
    const list = this.getAlerts();
    list.forEach(a => a.read = true);
    this.set(KEYS.ALERTS, list);
  }
}
