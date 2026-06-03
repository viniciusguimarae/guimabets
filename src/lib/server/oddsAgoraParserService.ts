// src/lib/server/oddsAgoraParserService.ts

import { ParsedBookmaker, ParsedEvent, ParsedMarket, ParsedOdd, ParsedSelection } from '../providers/types';

export interface DeepDiagnostic {
  hasHtml: boolean;
  htmlSize: number;
  title?: string;
  hasNextData: boolean;
  hasJsonScripts: boolean;
  possibleApiEndpoints: string[];
  bookmakerMentions: string[];
  oddsLikeNumbers: string[];
  eventLikeTexts: string[];
  confidence: "high" | "medium" | "low";
  extractionMode: "html" | "next_data" | "api_endpoint" | "js_rendered" | "blocked" | "unknown" | "not_available";
  notes: string[];
}

export function inspectOddsAgoraHtml(html: string): DeepDiagnostic {
  const notes: string[] = [];
  const lowerHtml = html.toLowerCase();
  
  const hasHtml = html.length > 100;
  const htmlSize = html.length;
  
  // Title
  let title: string | undefined;
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) title = titleMatch[1].trim();

  // Next Data
  const hasNextData = html.includes('id="__NEXT_DATA__"');
  if (hasNextData) notes.push("Detectado __NEXT_DATA__ (Next.js SSR/SSG).");

  // JSON scripts
  const hasJsonScripts = hasNextData || html.includes('type="application/json"') || html.includes('window.__');
  
  // API endpoints
  const possibleApiEndpoints: string[] = [];
  const apiMatches = html.match(/(["'`])(\/api\/[^"'`]+)\1/g);
  if (apiMatches) {
    apiMatches.forEach(m => {
      const ep = m.slice(1, -1);
      if (ep.length > 5 && !possibleApiEndpoints.includes(ep)) {
        possibleApiEndpoints.push(ep);
      }
    });
  }
  
  // Bookmakers
  const knownBookmakers = ['bet365', 'betano', 'superbet', 'kto', 'estrela bet', 'sportingbet', 'pinnacle', '1xbet'];
  const bookmakerMentions = knownBookmakers.filter(b => lowerHtml.includes(b));
  
  // Event like texts (heuristic: teams vs teams)
  const eventLikeTexts: string[] = [];
  const vsMatches = html.match(/[A-Z][a-z]+(?:\s[A-Z][a-z]+)*\s+(?:x|vs\.?)\s+[A-Z][a-z]+(?:\s[A-Z][a-z]+)*/g);
  if (vsMatches) {
    eventLikeTexts.push(...vsMatches.slice(0, 5)); // cap at 5 for diag
  }

  // Odds like numbers (heuristic: 1.XX or 2.XX inside some span or div, hard to do pure regex on raw html without context, but let's try basic)
  const oddsLikeNumbers: string[] = [];
  const oddsMatches = html.match(/>(\s*[1-9]\.\d{2}\s*)</g);
  if (oddsMatches) {
    const rawNumbers = oddsMatches.map(m => m.replace(/[><\s]/g, '')).filter(n => parseFloat(n) > 1.0);
    oddsLikeNumbers.push(...Array.from(new Set(rawNumbers)).slice(0, 5));
  }

  // Determine Extraction Mode and Confidence
  let extractionMode: DeepDiagnostic["extractionMode"] = "unknown";
  let confidence: DeepDiagnostic["confidence"] = "low";

  if (!hasHtml) {
    extractionMode = "unknown";
  } else if (lowerHtml.includes('cloudflare') && lowerHtml.includes('challenge')) {
    extractionMode = "blocked";
    confidence = "high";
    notes.push("Bloqueio de Cloudflare detectado.");
  } else if (lowerHtml.includes('captcha') || lowerHtml.includes('recaptcha')) {
    extractionMode = "blocked";
    confidence = "high";
    notes.push("Captcha detectado.");
  } else if (hasNextData) {
    extractionMode = "next_data";
    confidence = "high";
  } else if (possibleApiEndpoints.length > 0 && htmlSize < 50000) {
    extractionMode = "api_endpoint";
    confidence = "medium";
    notes.push("Parece ser SPA consumindo API.");
  } else if (oddsLikeNumbers.length > 0 && bookmakerMentions.length > 0) {
    extractionMode = "html";
    confidence = "high";
  } else if (htmlSize < 20000 && hasJsonScripts === false) {
    extractionMode = "js_rendered";
    confidence = "high";
    notes.push("HTML muito pequeno e sem JSON. Provável CSR puro.");
  } else {
    extractionMode = "html";
    confidence = "medium";
    notes.push("Fallback para HTML, mas com baixa confiança.");
  }

  return {
    hasHtml,
    htmlSize,
    title,
    hasNextData,
    hasJsonScripts,
    possibleApiEndpoints,
    bookmakerMentions,
    oddsLikeNumbers,
    eventLikeTexts,
    confidence,
    extractionMode,
    notes
  };
}

// -- Normalizers --

export function normalizeBookmakerName(name: string): string {
  const n = name.trim().toLowerCase();
  if (n.includes('bet365')) return 'Bet365';
  if (n.includes('betano')) return 'Betano';
  if (n.includes('superbet')) return 'Superbet';
  if (n.includes('estrela')) return 'EstrelaBet';
  if (n.includes('kto')) return 'KTO';
  if (n.includes('1xbet')) return '1xBet';
  if (n.includes('pinnacle')) return 'Pinnacle';
  if (n.includes('sportingbet')) return 'Sportingbet';
  if (n.includes('novibet')) return 'Novibet';
  if (n.includes('betfair')) return 'Betfair';
  
  // Fallback capitalize
  return name.trim().replace(/\b\w/g, c => c.toUpperCase());
}

export function normalizeMarketName(raw: string): { type: string, name: string } {
  const r = raw.trim().toLowerCase();
  if (r === '1x2' || r === 'resultado final' || r === 'vencedor do encontro') {
    return { type: '1X2', name: 'Resultado Final' };
  }
  if (r.includes('over') || r.includes('mais de')) {
    if (r.includes('2.5') || r.includes('2,5')) return { type: 'OVER_UNDER_2.5', name: 'Total de Gols (Mais/Menos 2.5)' };
    if (r.includes('1.5') || r.includes('1,5')) return { type: 'OVER_UNDER_1.5', name: 'Total de Gols (Mais/Menos 1.5)' };
  }
  if (r.includes('ambas') && r.includes('marcam')) {
    return { type: 'BTTS', name: 'Ambas as Equipes Marcam' };
  }
  return { type: 'CUSTOM', name: raw.trim() };
}

export function normalizeSelection(raw: string): string {
  const r = raw.trim().toLowerCase();
  if (r === '1' || r === 'casa' || r === 'home') return 'Casa';
  if (r === 'x' || r === 'empate' || r === 'draw') return 'Empate';
  if (r === '2' || r === 'fora' || r === 'away') return 'Fora';
  if (r.includes('mais de 2.5') || r === 'over 2.5') return 'Mais de 2.5 Gols';
  if (r.includes('menos de 2.5') || r === 'under 2.5') return 'Menos de 2.5 Gols';
  if (r === 'sim' || r === 'yes') return 'Sim';
  if (r === 'não' || r === 'nao' || r === 'no') return 'Não';
  return raw.trim();
}

export function normalizeOdd(val: string | number): number | null {
  if (typeof val === 'number') {
    return val > 1.01 && val < 1000 ? val : null;
  }
  const clean = val.replace(/[^\d.,]/g, '').replace(',', '.');
  const parsed = parseFloat(clean);
  if (isNaN(parsed) || parsed <= 1.01 || parsed >= 1000) return null;
  return parsed;
}

// -- Parser --

export function parseOddsAgora(html: string): ParsedOdd[] {
  const diag = inspectOddsAgoraHtml(html);
  
  if (diag.extractionMode !== 'next_data' && diag.extractionMode !== 'html') {
    // Para js_rendered ou API ou bloqueio, não conseguimos extrair odds agora.
    return [];
  }

  const odds: ParsedOdd[] = [];

  if (diag.extractionMode === 'next_data') {
    // Tenta extrair o JSON
    const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    if (match && match[1]) {
      try {
        const nextData = JSON.parse(match[1]);
        // Tentar navegar pela árvore do JSON e encontrar objetos que pareçam eventos ou odds.
        // O OddsAgora pode ter a estrutura no pageProps
        extractFromNextData(nextData, odds);
      } catch (err) {
        console.error("Erro ao fazer parse do __NEXT_DATA__", err);
      }
    }
  } else if (diag.extractionMode === 'html') {
    // HTML regex heurístico agressivo básico (placeholder para um Cheerio se fosse o caso)
    // Na vida real usaríamos cheerio. Aqui tentamos um regex muito conservador só para evitar vazio.
    // ...
  }

  return odds;
}

function extractFromNextData(obj: any, odds: ParsedOdd[]) {
  // Uma função recursiva para caminhar pelo JSON gigante do __NEXT_DATA__ 
  // procurando arrays de jogos ou odds.
  
  const visited = new Set();
  
  function walk(current: any) {
    if (!current || typeof current !== 'object') return;
    if (visited.has(current)) return;
    visited.add(current);
    
    // Tentar identificar se o current parece um evento (tem homeTeam, awayTeam, etc)
    const isEvent = current.homeTeam && current.awayTeam || current.teams && current.teams.length >= 2 || current.eventName;
    
    // Tentar identificar se é uma odd solta com odds, bookmaker, etc.
    
    // Como não conhecemos a estrutura exata do OddsAgora, a gente busca chaves comuns:
    // 'odds', 'markets', 'bookmakers', 'events', 'matches'
    
    for (const key of Object.keys(current)) {
      walk(current[key]);
    }
  }
  
  walk(obj);
}
