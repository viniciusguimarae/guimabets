// src/lib/providers/types.ts
// Interface contratual para qualquer provider de odds

export type RecommendationType =
  | 'candidate_for_parser'       // Fonte saudável, pronta para parser
  | 'inspect_network_or_api_pattern' // Muitos endpoints/API detectados — inspecionar rede
  | 'needs_browser_rendering'    // HTML vazio/JS-rendered — precisa de Playwright
  | 'blocked_or_risky'           // 403/429/captcha/Cloudflare — risco alto
  | 'not_available';             // Falha de rede ou timeout

export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'unknown';

export interface SourceInspectionResult {
  hasHtml: boolean;
  htmlSize: number;
  title?: string;
  hasCaptcha: boolean;
  hasCloudflare: boolean;
  hasBlockedMessage: boolean;
  hasJsonScripts: boolean;
  jsonScriptCount: number;
  potentialApiEndpoints: string[];
  keywordHits: string[];
  confidence: ConfidenceLevel;
  recommendation: RecommendationType;
  notes: string[];
}

export interface ProbeResult {
  // Identidade
  provider: string;
  probedAt: string;

  // Conectividade
  reachable: boolean;
  statusCode?: number;
  responseTimeMs?: number;
  responseSize?: number;

  // Headers relevantes
  contentType?: string;
  serverHeader?: string;
  cfRay?: string;

  // Diagnóstico de bloqueio
  blocked: boolean;
  captchaDetected: boolean;
  cloudflareDetected: boolean;

  // Diagnóstico de conteúdo
  pageTitle?: string;
  htmlSize?: number;
  jsonDetected: boolean;
  potentialApiEndpoints: string[];
  keywordHits: string[];

  // Avaliação final
  confidence: ConfidenceLevel;
  recommendation: RecommendationType;
  inspectionNotes: string[];

  // Erro (se falhou)
  error?: string;
}

export interface OddsProviderAdapter {
  /** Nome único do provider (ex: 'mock', 'oddsagora', 'oddspedia') */
  readonly name: string;

  /** Descrição humana do provider */
  readonly description: string;

  /**
   * Executa probe diagnóstico completo na fonte pública.
   * Faz 1 GET, analisa HTML, retorna diagnóstico estruturado.
   * NÃO extrai odds.
   */
  probeSource(): Promise<ProbeResult>;

  /**
   * Retorna true se o provider está configurado e pronto para executar.
   */
  isConfigured(): boolean;
}
