// src/lib/server/oddsAgoraDiscoveryService.ts

import { DeepDiagnostic } from './oddsAgoraParserService';

export interface DiscoveryResult {
  discoveredUrls: string[];
  prioritizedUrls: string[];
  ignoredUrls: string[];
  notes: string[];
}

export type CandidateRanking = 'strong_candidate' | 'medium_candidate' | 'weak_candidate' | 'not_useful';

export interface RankedInspection {
  url: string;
  status: number;
  responseTimeMs: number;
  diagnostic: DeepDiagnostic;
  score: number;
  ranking: CandidateRanking;
}

export function discoverCandidateUrls(html: string, baseUrl: string): DiscoveryResult {
  const discoveredUrls = new Set<string>();
  const prioritizedUrls = new Set<string>();
  const ignoredUrls = new Set<string>();
  const notes: string[] = [];

  // Extrair links usando Regex (href="...")
  const linkRegex = /href=["'](\/[^"']+)["']/g;
  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    const rawUrl = match[1];
    // Evitar links de assets
    if (rawUrl.match(/\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/i)) {
      continue;
    }
    // Ignorar urls muito curtas
    if (rawUrl.length < 2) continue;
    
    // Normalizar a url
    const fullUrl = rawUrl.startsWith('/') ? `${baseUrl}${rawUrl}` : rawUrl;
    discoveredUrls.add(fullUrl);
  }

  const keywords = [
    'futebol', 'football', 'sure', 'surebet', 'sure-bets', 'apostas', 'odds',
    'probabilidades', 'brasileirao', 'serie-a', 'live', 'hoje', 'jogos',
    'comparar', 'comparador'
  ];

  for (const url of discoveredUrls) {
    const lowerUrl = url.toLowerCase();
    
    // Ignorar rotas triviais comuns
    if (lowerUrl.includes('/login') || lowerUrl.includes('/register') || lowerUrl.includes('/conta') || lowerUrl.includes('/termos') || lowerUrl.includes('/privacidade')) {
      ignoredUrls.add(url);
      continue;
    }

    try {
      const urlObj = new URL(url);
      const path = urlObj.pathname.toLowerCase();
      const isRelevant = keywords.some(kw => path.includes(kw));
      if (isRelevant) {
        prioritizedUrls.add(url);
      } else {
        ignoredUrls.add(url);
      }
    } catch {
      ignoredUrls.add(url);
    }
  }

  // Limitar o número de urls priorizadas
  const maxUrlsToKeep = 15;
  let finalPrioritized = Array.from(prioritizedUrls);
  if (finalPrioritized.length > maxUrlsToKeep) {
    notes.push(`Limitado a ${maxUrlsToKeep} rotas priorizadas. (${finalPrioritized.length} originais)`);
    finalPrioritized = finalPrioritized.slice(0, maxUrlsToKeep);
  }

  return {
    discoveredUrls: Array.from(discoveredUrls),
    prioritizedUrls: finalPrioritized,
    ignoredUrls: Array.from(ignoredUrls),
    notes
  };
}

export function rankOddsAgoraUrlInspection(url: string, status: number, responseTimeMs: number, diagnostic: DeepDiagnostic): RankedInspection {
  let score = 0;

  if (status === 200) score += 30;
  if (diagnostic.htmlSize > 50000) score += 20;
  if (diagnostic.bookmakerMentions.length > 0) score += 20;
  if (diagnostic.oddsLikeNumbers.length > 10) score += 20;
  if (diagnostic.eventLikeTexts.length > 5) score += 20;
  if (diagnostic.hasNextData) score += 20;
  if (diagnostic.hasJsonScripts) score += 15;
  if (diagnostic.possibleApiEndpoints.length > 0) score += 15;
  
  if (diagnostic.extractionMode === 'blocked') score -= 50;
  if (diagnostic.htmlSize < 20000) score -= 20;
  if (diagnostic.confidence === 'low') score -= 20;

  let ranking: CandidateRanking = 'not_useful';
  if (diagnostic.extractionMode === 'blocked' || status >= 400) {
    ranking = 'not_useful';
  } else if (score >= 90) {
    ranking = 'strong_candidate';
  } else if (score >= 60) {
    ranking = 'medium_candidate';
  } else if (score >= 30) {
    ranking = 'weak_candidate';
  }

  return {
    url,
    status,
    responseTimeMs,
    diagnostic,
    score,
    ranking
  };
}
