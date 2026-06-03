export type BookmakerStatus = 'autorizada' | 'judicial' | 'desconhecida' | 'bloqueada';

export interface Profile {
  id: string;
  email: string;
  createdAt: string;
}

export interface Bookmaker {
  id: string;
  name: string;
  domain: string;
  status: BookmakerStatus;
  hasAccount: boolean;
  currentBalance: number;
  maxLimit: number;
  avgWithdrawalTime: string; // Ex: "2 horas", "1 dia"
  notes: string;
  isActive: boolean;
  isFavorite: boolean;
}

export interface AuthorizedBookmaker {
  id: string;
  name: string;
  domain: string;
  createdAt: string;
}

export interface SportEvent {
  id: string;
  name: string;
  sport: string;
  league: string;
  startTime: string; // ISO string
}

export interface Market {
  id: string;
  eventId: string;
  sport: string;
  marketType: string; // Ex: "1X2", "OVER_UNDER_2.5", "BOTH_TEAMS_TO_SCORE"
  marketName: string; // Ex: "Vencedor do Encontro", "Total de Gols Mais/Menos 2.5"
  rules?: string;
  expectedOutcomesCount: number;
  isExhaustiveMarket: boolean;
}

export interface MarketSelection {
  id: string;
  marketId: string;
  selectionName: string; // Ex: "Casa", "Fora", "Over 2.5", "Sim"
  normalizedSelectionKey: string; // Ex: "home", "away", "over_2.5", "yes"
  outcomeOrder: number;
}

export interface OddSnapshot {
  id: string;
  eventId: string;
  marketId: string;
  selectionId: string;
  bookmakerId: string;
  oddDecimal: number;
  source: string; // Ex: "mock", "csv", "oddsagora"
  betLink?: string;
  collectedAt: string; // ISO string
}

export type OpportunityStatus = 'quente' | 'morna' | 'fria' | 'morta';

export interface OpportunityLeg {
  id: string;
  selectionId: string;
  selectionName: string;
  bookmakerId: string;
  bookmakerName: string;
  bookmakerStatus: BookmakerStatus;
  oddDecimal: number;
  recommendedStake: number;
  expectedReturn: number;
}

export interface SurebetOpportunity {
  id: string;
  eventId: string;
  eventName: string;
  sport: string;
  league: string;
  startTime: string;
  marketId: string;
  marketName: string;
  marketType: string;
  marginPercent: number;
  impliedSum: number;
  status: OpportunityStatus;
  lastUpdatedAt: string; // ISO string
  legs: OpportunityLeg[];
}

export type BetStatus = 'pendente' | 'finalizada' | 'cancelada' | 'erro operacional';
export type BetResult = 'ganhou' | 'perdeu' | 'reembolsada' | 'cancelada' | 'pendente';

export interface ExecutedBetLeg {
  selectionName: string;
  bookmakerName: string;
  oddDecimal: number;
  stake: number;
}

export interface ExecutedBet {
  id: string;
  eventName: string;
  marketName: string;
  totalStake: number;
  returnExpected: number;
  profitExpected: number;
  actualResult: BetResult;
  actualProfit?: number;
  status: BetStatus;
  notes: string;
  createdAt: string;
  legs: ExecutedBetLeg[];
}

export interface ProviderLog {
  id: string;
  providerName: string;
  status: 'sucesso' | 'erro' | 'rodando';
  message: string;
  createdAt: string;
}

export interface Alert {
  id: string;
  type: 'nova_surebet' | 'odd_antiga' | 'mercado_incompleto' | 'casa_nao_autorizada' | 'stake_excedida' | 'oportunidade_expirada' | 'erro_provider';
  message: string;
  read: boolean;
  createdAt: string;
}

export interface UserSettings {
  defaultStake: number;
  minMargin: number;
  onlyAuthorized: boolean;
  hotThresholdSec: number;
  warmThresholdSec: number;
  currency: string; // "BRL"
  theme: 'dark' | 'light';
  mockEnabled: boolean;
  manualEnabled: boolean;
  providersEnabled: Record<string, boolean>;
}
