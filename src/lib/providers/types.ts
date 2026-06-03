// src/lib/providers/types.ts
// Interface contratual para qualquer provider de odds

export interface ProbeResult {
  provider: string;
  reachable: boolean;
  statusCode?: number;
  responseTimeMs?: number;
  responseSize?: number;
  error?: string;
  probedAt: string;
}

export interface OddsProviderAdapter {
  /** Nome único do provider (ex: 'mock', 'oddsagora', 'oddspedia') */
  readonly name: string;

  /** Descrição humana do provider */
  readonly description: string;

  /**
   * Testa conectividade com a fonte pública.
   * Não extrai dados — apenas verifica se o endpoint responde.
   */
  probeSource(): Promise<ProbeResult>;

  /**
   * Retorna true se o provider está configurado e pronto para executar.
   * Pode verificar variáveis de ambiente, chaves de API, etc.
   */
  isConfigured(): boolean;
}
