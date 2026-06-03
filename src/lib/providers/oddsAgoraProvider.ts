// src/lib/providers/oddsAgoraProvider.ts
// Adapter para OddsAgora — apenas probe de conectividade por enquanto

import type { OddsProviderAdapter, ProbeResult } from './types';

const PROBE_URL = 'https://oddsagora.com.br';

export class OddsAgoraProvider implements OddsProviderAdapter {
  readonly name = 'oddsagora';
  readonly description = 'OddsAgora.com.br — Comparador brasileiro de odds (somente probe nesta etapa)';

  isConfigured(): boolean {
    return true; // Probe não requer chave
  }

  async probeSource(): Promise<ProbeResult> {
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(PROBE_URL, {
        method: 'HEAD',
        signal: controller.signal,
        headers: {
          'User-Agent': 'GuimaBets-Probe/1.0',
        },
      });

      clearTimeout(timeout);

      const elapsed = Date.now() - start;

      return {
        provider: this.name,
        reachable: response.ok || response.status < 500,
        statusCode: response.status,
        responseTimeMs: elapsed,
        probedAt: new Date().toISOString(),
      };
    } catch (err) {
      const elapsed = Date.now() - start;
      return {
        provider: this.name,
        reachable: false,
        responseTimeMs: elapsed,
        error: err instanceof Error ? err.message : String(err),
        probedAt: new Date().toISOString(),
      };
    }
  }
}

export const oddsAgoraProvider = new OddsAgoraProvider();
