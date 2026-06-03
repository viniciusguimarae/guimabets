// src/lib/data/ServerDataProvider.ts
// Camada de dados server-side: faz chamadas às API Routes do Next.js

export interface ServerHealth {
  ok: boolean;
  mode: 'server' | 'local';
  supabase: { configured: boolean; url: string | null };
  adminSecret: boolean;
  version: string;
  stage: string;
  timestamp: string;
}

export interface ServerOddsResponse {
  odds: unknown[];
  count: number;
  lifecycle: unknown;
  fetchedAt: string;
}

export interface ServerOpportunitiesResponse {
  opportunities: ServerOpportunity[];
  count: number;
  lifecycle: unknown;
  fetchedAt: string;
}

export interface ServerOpportunity {
  id: string;
  implied_sum: number;
  margin_percent: number;
  status: string;
  expires_at: string;
  created_at: string;
  events: { name: string; sport: string; league: string; start_time: string } | null;
  markets: { market_type: string; market_name: string } | null;
  opportunity_legs: Array<{
    selection_name: string;
    bookmaker_name: string;
    odd_decimal: number;
    stake_suggestion: number;
    bet_link: string | null;
  }>;
}

export interface MockGenerateResult {
  ok: boolean;
  mock: {
    eventsCreated: number;
    oddsCreated: number;
    surebetsGuaranteed: number;
    runId: string;
  };
  recalculate: {
    invalidated: number;
    newOpportunities: number;
    processedAt: string;
  };
  generatedAt: string;
}

export interface ExpireResult {
  ok: boolean;
  expiredOdds: number;
  eventStartedOdds: number;
  processedAt: string;
}

export interface ProbeResult {
  provider: string;
  reachable: boolean;
  statusCode?: number;
  responseTimeMs?: number;
  error?: string;
  probedAt: string;
}

class ServerDataProvider {
  private baseUrl: string;

  constructor() {
    // Em ambiente Next.js, as API routes são relativas ao mesmo servidor
    this.baseUrl = typeof window !== 'undefined' ? '' : 'http://localhost:3000';
  }

  private getAdminSecret(): string {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('gmb_admin_secret') ?? '';
    }
    return process.env.GMB_ADMIN_SECRET ?? '';
  }

  async getHealth(): Promise<ServerHealth> {
    const res = await fetch(`${this.baseUrl}/api/health`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Health check falhou: ${res.status}`);
    return res.json();
  }

  async getOdds(): Promise<ServerOddsResponse> {
    const res = await fetch(`${this.baseUrl}/api/odds`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Falha ao buscar odds: ${res.status}`);
    return res.json();
  }

  async getOpportunities(): Promise<ServerOpportunitiesResponse> {
    const res = await fetch(`${this.baseUrl}/api/opportunities`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Falha ao buscar oportunidades: ${res.status}`);
    return res.json();
  }

  async generateMock(adminSecret?: string): Promise<MockGenerateResult> {
    const secret = adminSecret ?? this.getAdminSecret();
    const res = await fetch(`${this.baseUrl}/api/mock/generate`, {
      method: 'POST',
      headers: { 'x-admin-secret': secret },
      cache: 'no-store',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error ?? `Erro ${res.status}`);
    }
    return res.json();
  }

  async expireOdds(adminSecret?: string): Promise<ExpireResult> {
    const secret = adminSecret ?? this.getAdminSecret();
    const res = await fetch(`${this.baseUrl}/api/odds/expire`, {
      method: 'POST',
      headers: { 'x-admin-secret': secret },
      cache: 'no-store',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error ?? `Erro ${res.status}`);
    }
    return res.json();
  }

  async recalculateOpportunities(adminSecret?: string): Promise<unknown> {
    const secret = adminSecret ?? this.getAdminSecret();
    const res = await fetch(`${this.baseUrl}/api/opportunities/recalculate`, {
      method: 'POST',
      headers: { 'x-admin-secret': secret },
      cache: 'no-store',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error ?? `Erro ${res.status}`);
    }
    return res.json();
  }

  async probeScraper(adminSecret?: string, provider?: string): Promise<ProbeResult | ProbeResult[]> {
    const secret = adminSecret ?? this.getAdminSecret();
    const res = await fetch(`${this.baseUrl}/api/scraper/probe`, {
      method: 'POST',
      headers: {
        'x-admin-secret': secret,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(provider ? { provider } : {}),
      cache: 'no-store',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error ?? `Erro ${res.status}`);
    }
    const data = await res.json();
    // Se retornou { results: [...] }, retornar o array
    if (data.results) return data.results;
    return data;
  }
}

export const serverDataProvider = new ServerDataProvider();
