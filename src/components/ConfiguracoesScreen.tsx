'use client';

import React, { useState, useEffect } from 'react';
import { UserSettings, Bookmaker } from '../types';
import { 
  Settings, 
  Upload, 
  Plus, 
  ShieldCheck,
  Server,
  Zap,
  RefreshCw,
  Clock,
  Wifi,
  Activity,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Search,
  BarChart2,
  Database
} from 'lucide-react';
import { serverDataProvider, type ProbeResult } from '../lib/data/ServerDataProvider';

interface ConfiguracoesScreenProps {
  settings: UserSettings;
  bookmakers: Bookmaker[];
  onUpdateSettings: (s: UserSettings) => void;
  onImportOddsCsv: (csvText: string) => { success: boolean; count: number; error?: string };
  onAddManualOdd: (input: {
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
  }) => void;
  onClearAllOdds: () => void;
}

export default function ConfiguracoesScreen({
  settings,
  bookmakers,
  onUpdateSettings,
  onImportOddsCsv,
  onAddManualOdd,
  onClearAllOdds
}: ConfiguracoesScreenProps) {
  
  const [defaultStake, setDefaultStake] = useState(settings.defaultStake);
  const [minMargin, setMinMargin] = useState(settings.minMargin);
  const [onlyAuthorized, setOnlyAuthorized] = useState(settings.onlyAuthorized);
  const [hotThresholdSec, setHotThresholdSec] = useState(settings.hotThresholdSec);
  const [warmThresholdSec, setWarmThresholdSec] = useState(settings.warmThresholdSec);
  const [mockEnabled, setMockEnabled] = useState(settings.mockEnabled);
  const [feedbackSettings, setFeedbackSettings] = useState('');

  // Admin Server
  const isServerMode = process.env.NEXT_PUBLIC_USE_SERVER_DATA === 'true';
  const [adminSecret, setAdminSecret] = useState('');
  const [adminFeedback, setAdminFeedback] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const [adminLoading, setAdminLoading] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('gmb_admin_secret');
    if (saved) setAdminSecret(saved);
  }, []);

  const saveAdminSecret = () => {
    localStorage.setItem('gmb_admin_secret', adminSecret);
    setAdminFeedback({ type: 'ok', msg: 'Secret salvo no localStorage.' });
    setTimeout(() => setAdminFeedback(null), 2000);
  };

  const adminAction = async (label: string, fn: () => Promise<unknown>) => {
    setAdminLoading(label);
    setAdminFeedback(null);
    try {
      const result = await fn();
      setAdminFeedback({ type: 'ok', msg: JSON.stringify(result, null, 2) });
    } catch (err) {
      setAdminFeedback({ type: 'err', msg: String(err) });
    } finally {
      setAdminLoading(null);
    }
  };

  // Diagnóstico de fontes
  const [probeResults, setProbeResults] = useState<Record<string, ProbeResult>>({});
  const [probeLoading, setProbeLoading] = useState<string | null>(null);
  const [showNotes, setShowNotes] = useState<Record<string, boolean>>({});

  const runProbe = async (providerKey: string) => {
    setProbeLoading(providerKey);
    try {
      const raw = await serverDataProvider.probeScraper(adminSecret, providerKey);
      const result = Array.isArray(raw) ? raw[0] : raw;
      setProbeResults((prev) => ({ ...prev, [providerKey]: result as ProbeResult }));
    } catch (err) {
      const errorResult: ProbeResult = {
        provider: providerKey,
        probedAt: new Date().toISOString(),
        reachable: false,
        blocked: false,
        captchaDetected: false,
        cloudflareDetected: false,
        jsonDetected: false,
        potentialApiEndpoints: [],
        keywordHits: [],
        confidence: 'unknown',
        recommendation: 'not_available',
        inspectionNotes: [],
        error: String(err),
      };
      setProbeResults((prev) => ({ ...prev, [providerKey]: errorResult }));
    } finally {
      setProbeLoading(null);
    }
  };

  // Parser OddsAgora - Scraper Real Etapa 4 e 5
  const [parserLoading, setParserLoading] = useState<string | null>(null);
  const [parserResult, setParserResult] = useState<any>(null);
  const [parserError, setParserError] = useState<string | null>(null);
  const [customUrl, setCustomUrl] = useState<string>('');
  
  const [discoveryLoading, setDiscoveryLoading] = useState(false);
  const [discoveryResult, setDiscoveryResult] = useState<any>(null);

  const [finalInvLoading, setFinalInvLoading] = useState(false);
  const [finalInvResult, setFinalInvResult] = useState<any>(null);

  const runOddsAgoraFinalInvestigation = async () => {
    if (!adminSecret) {
      setParserError('Secret do admin obrigatório');
      return;
    }
    setFinalInvLoading(true);
    setFinalInvResult(null);
    setParserError(null);
    try {
      const res = await fetch('/api/scraper/oddsagora/final-investigation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': adminSecret,
        }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro na requisição');
      }
      setFinalInvResult(data);
    } catch (err) {
      setParserError(String(err));
    } finally {
      setFinalInvLoading(false);
    }
  };

  const runOddsAgoraScraper = async (mode: string) => {
    if (!adminSecret) {
      setParserError('Secret do admin obrigatório');
      return;
    }
    setParserLoading(mode);
    setParserResult(null);
    setParserError(null);
    try {
      const payload: any = { mode };
      if (customUrl.trim().length > 0) {
        payload.url = customUrl.trim();
      }

      const res = await fetch('/api/scraper/oddsagora/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': adminSecret,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro na requisição');
      }
      setParserResult(data);
    } catch (err) {
      setParserError(String(err));
    } finally {
      setParserLoading(null);
    }
  };

  const runOddsAgoraDiscovery = async () => {
    if (!adminSecret) {
      setParserError('Secret do admin obrigatório');
      return;
    }
    setDiscoveryLoading(true);
    setDiscoveryResult(null);
    setParserError(null);
    try {
      const res = await fetch('/api/scraper/oddsagora/discover', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': adminSecret,
        },
        body: JSON.stringify({ maxUrls: 10 }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro na requisição');
      }
      setDiscoveryResult(data);
    } catch (err) {
      setParserError(String(err));
    } finally {
      setDiscoveryLoading(false);
    }
  };

  const [manualSport, setManualSport] = useState('Futebol');
  const [manualLeague, setManualLeague] = useState('Brasileirão Série A');
  const [manualEvent, setManualEvent] = useState('');
  const [manualMarketType, setManualMarketType] = useState('OVER_UNDER_2.5');
  const [manualMarketName, setManualMarketName] = useState('Total de Gols (Mais/Menos 2.5)');
  const [manualSelectionName, setManualSelectionName] = useState('Mais de 2.5 Gols');
  const [manualBookmakerId, setManualBookmakerId] = useState(bookmakers[0]?.id || '');
  const [manualOdd, setManualOdd] = useState<string>('2.00');
  const [manualFeedback, setManualFeedback] = useState('');

  const [csvOddsText, setCsvOddsText] = useState('');
  const [csvOddsFeedback, setCsvOddsFeedback] = useState('');

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings({
      ...settings,
      defaultStake,
      minMargin,
      onlyAuthorized,
      hotThresholdSec,
      warmThresholdSec,
      mockEnabled
    });
    setFeedbackSettings('Configurações aplicadas.');
    setTimeout(() => setFeedbackSettings(''), 2000);
  };

  const handleAddManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualEvent || !manualSelectionName || !manualOdd || !manualBookmakerId) {
      setManualFeedback('Preencha os campos.');
      return;
    }

    const parsedOdd = parseFloat(manualOdd);
    if (isNaN(parsedOdd) || parsedOdd <= 1.0) {
      setManualFeedback('A odd decimal deve ser maior que 1.0.');
      return;
    }

    onAddManualOdd({
      sport: manualSport,
      league: manualLeague,
      eventName: manualEvent,
      startTime: new Date().toISOString(),
      marketType: manualMarketType,
      marketName: manualMarketName,
      selectionName: manualSelectionName,
      bookmakerId: manualBookmakerId,
      oddDecimal: parsedOdd
    });

    setManualFeedback('Sinal inserido com sucesso.');
    setManualOdd('2.00');
    setManualSelectionName('');
    setTimeout(() => setManualFeedback(''), 2000);
  };

  const handleImportCsvOdds = () => {
    if (!csvOddsText) {
      setCsvOddsFeedback('Insira as linhas CSV.');
      return;
    }

    const res = onImportOddsCsv(csvOddsText);
    if (res.success) {
      setCsvOddsFeedback(`Sucesso! ${res.count} odds importadas.`);
      setCsvOddsText('');
    } else {
      setCsvOddsFeedback(`Erro: ${res.error}`);
    }
    setTimeout(() => setCsvOddsFeedback(''), 3000);
  };

  return (
    <div className="space-y-6 select-none">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-white font-space uppercase font-extrabold">Configurações Gerais</h1>
        <p className="text-[10px] text-zinc-500 font-semibold tracking-wider uppercase mt-1">
          Ajustes de limiares térmicos, injeção manual e fontes de captura
        </p>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Painel Configurações */}
        <div className="bg-[#080808] border border-[#121212] rounded-lg p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Settings className="w-3.5 h-3.5 text-emerald-400" />
            <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider font-space font-extrabold">Ajustes do Terminal</h2>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-4 text-xs font-medium text-zinc-400">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-wider mb-2">Stake Padrão (R$)</label>
                <input
                  type="number"
                  value={defaultStake}
                  onChange={(e) => setDefaultStake(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#0a0a0a] border border-[#151515] rounded p-2.5 text-zinc-200 font-mono focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-wider mb-2">Margem Mínima (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={minMargin}
                  onChange={(e) => setMinMargin(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#0a0a0a] border border-[#151515] rounded p-2.5 text-zinc-200 font-mono focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-wider mb-2">Limite Quente (seg)</label>
                <input
                  type="number"
                  value={hotThresholdSec}
                  onChange={(e) => setHotThresholdSec(parseInt(e.target.value) || 0)}
                  className="w-full bg-[#0a0a0a] border border-[#151515] rounded p-2.5 text-zinc-200 font-mono focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-wider mb-2">Limite Morna (seg)</label>
                <input
                  type="number"
                  value={warmThresholdSec}
                  onChange={(e) => setWarmThresholdSec(parseInt(e.target.value) || 0)}
                  className="w-full bg-[#0a0a0a] border border-[#151515] rounded p-2.5 text-zinc-200 font-mono focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-3 pt-2 border-t border-[#121212] text-[10px]">
              <label className="flex items-center gap-2.5 text-zinc-500 cursor-pointer select-none font-bold uppercase tracking-wider">
                <input
                  type="checkbox"
                  checked={onlyAuthorized}
                  onChange={(e) => setOnlyAuthorized(e.target.checked)}
                  className="w-4 h-4 rounded bg-[#0a0a0a] border-[#1c1c1c] text-emerald-500"
                />
                <span>Exibir apenas autorizadas no radar</span>
              </label>

              <label className="flex items-center gap-2.5 text-zinc-500 cursor-pointer select-none font-bold uppercase tracking-wider">
                <input
                  type="checkbox"
                  checked={mockEnabled}
                  onChange={(e) => setMockEnabled(e.target.checked)}
                  className="w-4 h-4 rounded bg-[#0a0a0a] border-[#1c1c1c] text-emerald-500"
                />
                <span>Habilitar Simulação Dinâmica ao vivo</span>
              </label>
            </div>

            {feedbackSettings && (
              <div className="p-2 bg-emerald-500/5 border border-emerald-500/10 rounded text-emerald-400 font-mono">
                {feedbackSettings}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold py-2.5 rounded transition-colors cursor-pointer text-center uppercase tracking-wider text-[10px]"
            >
              Aplicar Ajustes
            </button>
          </form>
        </div>

        {/* Cadastro manual */}
        <div className="bg-[#080808] border border-[#121212] rounded-lg p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Plus className="w-3.5 h-3.5 text-emerald-400" />
            <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider font-space font-extrabold">Injetar Odds Manualmente</h2>
          </div>

          <form onSubmit={handleAddManual} className="space-y-4 text-xs text-zinc-500">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold uppercase tracking-wider mb-1">Esporte</label>
                <select
                  value={manualSport}
                  onChange={(e) => {
                    const sp = e.target.value;
                    setManualSport(sp);
                    if (sp === 'Basquete') {
                      setManualMarketType('MONEYLINE');
                      setManualMarketName('Vencedor da Partida');
                      setManualSelectionName('Time A');
                    } else if (sp === 'Futebol') {
                      setManualMarketType('OVER_UNDER_2.5');
                      setManualMarketName('Total de Gols (Mais/Menos 2.5)');
                      setManualSelectionName('Mais de 2.5 Gols');
                    }
                  }}
                  className="w-full bg-[#0a0a0a] border border-[#151515] rounded p-2.5 text-zinc-300 focus:outline-none"
                >
                  <option value="Futebol">Futebol</option>
                  <option value="Basquete">Basquete</option>
                  <option value="Tênis">Tênis</option>
                </select>
              </div>
              <div>
                <label className="block font-bold uppercase tracking-wider mb-1">Liga</label>
                <input
                  type="text"
                  required
                  value={manualLeague}
                  onChange={(e) => setManualLeague(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-[#151515] rounded p-2.5 text-zinc-200 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold uppercase tracking-wider mb-1">Evento (Participantes)</label>
              <input
                type="text"
                required
                placeholder="Ex: Bayern de Munique x Real Madrid"
                value={manualEvent}
                onChange={(e) => setManualEvent(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-[#151515] rounded p-2.5 text-zinc-200 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold uppercase tracking-wider mb-1">Mercado</label>
                <select
                  value={manualMarketType}
                  onChange={(e) => {
                    const type = e.target.value;
                    setManualMarketType(type);
                    if (type === '1X2') {
                      setManualMarketName('Vencedor Partida (1X2)');
                      setManualSelectionName('Casa (1)');
                    } else if (type === 'OVER_UNDER_2.5') {
                      setManualMarketName('Total de Gols (Mais/Menos 2.5)');
                      setManualSelectionName('Mais de 2.5 Gols');
                    } else if (type === 'BOTH_TEAMS_TO_SCORE') {
                      setManualMarketName('Ambas Equipes Marcam');
                      setManualSelectionName('Sim');
                    } else if (type === 'MONEYLINE') {
                      setManualMarketName('Vencedor do Jogo');
                      setManualSelectionName('Jogador A');
                    }
                  }}
                  className="w-full bg-[#0a0a0a] border border-[#151515] rounded p-2.5 text-zinc-300 focus:outline-none"
                >
                  {manualSport === 'Futebol' ? (
                    <>
                      <option value="OVER_UNDER_2.5">Over/Under 2.5 Gols</option>
                      <option value="1X2">1X2 (Resultado Final)</option>
                      <option value="BOTH_TEAMS_TO_SCORE">Ambas Marcam</option>
                    </>
                  ) : (
                    <option value="MONEYLINE">Vencedor Partida (Moneyline)</option>
                  )}
                </select>
              </div>

              <div>
                <label className="block font-bold uppercase tracking-wider mb-1">Seleção</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Mais de 2.5 Gols"
                  value={manualSelectionName}
                  onChange={(e) => setManualSelectionName(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-[#151515] rounded p-2.5 text-zinc-200 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold uppercase tracking-wider mb-1">Plataforma</label>
                <select
                  value={manualBookmakerId}
                  onChange={(e) => setManualBookmakerId(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-[#151515] rounded p-2.5 text-zinc-300 focus:outline-none"
                >
                  {bookmakers.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold uppercase tracking-wider mb-1">Odd Decimal</label>
                <input
                  type="number"
                  step="0.01"
                  min="1.01"
                  required
                  value={manualOdd}
                  onChange={(e) => setManualOdd(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-[#151515] rounded p-2.5 text-zinc-100 font-mono focus:outline-none"
                />
              </div>
            </div>

            {manualFeedback && (
              <div className="p-2 bg-emerald-500/5 border border-emerald-500/10 rounded text-emerald-400 font-mono">
                {manualFeedback}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-[#0c0c0c] border border-[#151515] hover:border-zinc-800 text-zinc-300 font-extrabold py-2.5 rounded transition-colors cursor-pointer text-center uppercase tracking-wider text-[10px]"
            >
              Injetar Odd
            </button>
          </form>
        </div>

        {/* CSV Import */}
        <div className="bg-[#080808] border border-[#121212] rounded-lg p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Upload className="w-3.5 h-3.5 text-emerald-400" />
            <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider font-space font-extrabold">Importação CSV de Odds</h2>
          </div>

          <div className="text-[10px] text-zinc-500 leading-relaxed bg-[#0a0a0a] border border-[#151515] p-3 rounded space-y-2">
            <p><strong>Formato das colunas do CSV:</strong></p>
            <code className="block p-2 bg-[#050505] border border-[#121212] rounded font-mono text-[9px] overflow-x-auto text-emerald-400">
              sport,league,event_name,event_start_time,market_type,market_name,selection_name,bookmaker,odd_decimal,bet_link,collected_at
            </code>
          </div>

          <textarea
            rows={4}
            placeholder="Futebol,Champions League,Bayern x Real,2026-06-03T20:00:00Z,OVER_UNDER_2.5,Total de Gols,Mais de 2.5,Betano,2.15,,2026-06-03T02:00:00Z"
            value={csvOddsText}
            onChange={(e) => setCsvOddsText(e.target.value)}
            className="w-full bg-[#0a0a0a] border border-[#151515] rounded p-3 text-xs text-zinc-300 focus:outline-none resize-none font-mono"
          />

          {csvOddsFeedback && (
            <div className="p-2 bg-emerald-500/5 border border-emerald-500/10 rounded text-[9px] font-bold text-emerald-400 font-mono">
              {csvOddsFeedback}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClearAllOdds}
              className="flex-1 bg-zinc-950 hover:bg-red-500/5 text-red-400 border border-red-500/10 font-bold py-2 rounded transition-colors cursor-pointer text-center text-[10px] uppercase tracking-wider"
            >
              Expurgar Odds do Radar
            </button>

            <button
              type="button"
              onClick={handleImportCsvOdds}
              className="flex-1 bg-[#0f172a] border border-[#1e293b]/30 hover:border-[#38bdf8]/30 hover:text-[#38bdf8] text-zinc-300 font-bold py-2 rounded transition-colors cursor-pointer text-center text-[10px] uppercase tracking-wider"
            >
              Importar CSV
            </button>
          </div>
        </div>

        {/* Adapters */}
        <div className="bg-[#080808] border border-[#121212] rounded-lg p-5 space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider font-space font-extrabold">Adaptadores de Integração</h2>
          </div>
          
          <p className="text-[10px] text-zinc-500 leading-relaxed font-medium">
            Classes prontas para scraping/API futuras em conformidade ética (vazias, aguardando chaves/tokens):
          </p>

          <div className="space-y-2 text-[10px] font-mono">
            <div className="flex items-center justify-between p-2.5 bg-[#0a0a0a] border border-[#151515] rounded">
              <span className="text-zinc-400 font-bold">OddsAgoraProvider.ts</span>
              <span className="text-[8px] bg-zinc-900 text-zinc-600 border border-[#1a1a1a] px-2 py-0.5 rounded font-mono uppercase font-bold">Probe ativo</span>
            </div>
            <div className="flex items-center justify-between p-2.5 bg-[#0a0a0a] border border-[#151515] rounded">
              <span className="text-zinc-400 font-bold">OddspediaProvider.ts</span>
              <span className="text-[8px] bg-zinc-900 text-zinc-600 border border-[#1a1a1a] px-2 py-0.5 rounded font-mono uppercase font-bold">Probe ativo</span>
            </div>
          </div>
        </div>

      </div>

      {/* Painel Admin Server — sempre visível, mas avisa se modo local */}
      <div className="bg-[#080808] border border-[#1a1a1a] rounded-lg p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="w-3.5 h-3.5 text-sky-400" />
            <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider font-space font-extrabold">Servidor / Admin</h2>
          </div>
          <span className={`text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border font-mono ${
            isServerMode
              ? 'text-sky-400 border-sky-500/20 bg-sky-500/5'
              : 'text-zinc-600 border-zinc-800 bg-zinc-950'
          }`}>
            {isServerMode ? 'Modo Servidor ativo' : 'Modo Local ativo'}
          </span>
        </div>

        {!isServerMode && (
          <div className="p-3 bg-amber-500/5 border border-amber-500/10 rounded text-[10px] text-amber-400 font-medium leading-relaxed">
            ⚠️ O modo servidor está desativado. Defina{' '}
            <code className="font-mono">NEXT_PUBLIC_USE_SERVER_DATA=true</code> no{' '}
            <code className="font-mono">.env.local</code> para ativar e usar o Supabase.
            Os botões abaixo ainda funcionam se o servidor estiver rodando.
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
              Admin Secret (salvo localmente)
            </label>
            <div className="flex gap-2">
              <input
                type="password"
                placeholder="Seu GMB_ADMIN_SECRET"
                value={adminSecret}
                onChange={(e) => setAdminSecret(e.target.value)}
                className="flex-1 bg-[#0a0a0a] border border-[#151515] rounded p-2.5 text-zinc-200 font-mono text-xs focus:outline-none"
              />
              <button
                type="button"
                onClick={saveAdminSecret}
                className="px-3 bg-sky-500/10 border border-sky-500/20 hover:border-sky-500/40 text-sky-400 rounded text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
              >
                Salvar
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
            <button
              type="button"
              disabled={!!adminLoading}
              onClick={() => adminAction('health', () => serverDataProvider.getHealth())}
              className="flex items-center justify-center gap-1.5 p-2.5 bg-[#0a0a0a] border border-[#151515] hover:border-sky-500/20 hover:text-sky-400 text-zinc-500 rounded text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-40"
            >
              {adminLoading === 'health' ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Wifi className="w-3 h-3" />}
              Health Check
            </button>

            <button
              type="button"
              disabled={!!adminLoading}
              onClick={() => adminAction('mock', () => serverDataProvider.generateMock(adminSecret))}
              className="flex items-center justify-center gap-1.5 p-2.5 bg-[#0a0a0a] border border-[#151515] hover:border-emerald-500/20 hover:text-emerald-400 text-zinc-500 rounded text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-40"
            >
              {adminLoading === 'mock' ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
              Gerar Mock
            </button>

            <button
              type="button"
              disabled={!!adminLoading}
              onClick={() => adminAction('expire', () => serverDataProvider.expireOdds(adminSecret))}
              className="flex items-center justify-center gap-1.5 p-2.5 bg-[#0a0a0a] border border-[#151515] hover:border-amber-500/20 hover:text-amber-400 text-zinc-500 rounded text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-40"
            >
              {adminLoading === 'expire' ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Clock className="w-3 h-3" />}
              Expirar Odds
            </button>

            <button
              type="button"
              disabled={!!adminLoading}
              onClick={() => adminAction('recalc', () => serverDataProvider.recalculateOpportunities(adminSecret))}
              className="flex items-center justify-center gap-1.5 p-2.5 bg-[#0a0a0a] border border-[#151515] hover:border-purple-500/20 hover:text-purple-400 text-zinc-500 rounded text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-40"
            >
              {adminLoading === 'recalc' ? <RefreshCw className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              Recalcular
            </button>

          </div>

          {adminFeedback && (
            <div className={`p-3 rounded border text-[10px] font-mono whitespace-pre-wrap break-all overflow-auto max-h-32 ${
              adminFeedback.type === 'ok'
                ? 'bg-sky-500/5 border-sky-500/10 text-sky-400'
                : 'bg-red-500/5 border-red-500/10 text-red-400'
            }`}>
              {adminFeedback.msg}
            </div>
          )}
        </div>
      </div>

      {/* Painel de Diagnóstico de Fontes — Etapa 3 */}
      <div className="bg-[#080808] border border-[#1a1a1a] rounded-lg p-5 space-y-5">
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-violet-400" />
          <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider font-space font-extrabold">Diagnóstico de Fontes</h2>
          <span className="text-[8px] font-bold text-violet-500 border border-violet-500/20 bg-violet-500/5 px-2 py-0.5 rounded font-mono uppercase">Etapa 3</span>
        </div>

        <p className="text-[10px] text-zinc-600 leading-relaxed">
          Testa conectividade e analisa estrutura HTML de cada fonte. Nenhuma odd é extraída. Apenas diagnóstico.
        </p>

        {/* Botões de probe */}
        <div className="grid grid-cols-2 gap-3">
          {[{ key: 'oddsagora', label: 'OddsAgora', color: 'emerald' }, { key: 'oddspedia', label: 'Oddspedia', color: 'violet' }].map(({ key, label, color }) => (
            <button
              key={key}
              type="button"
              disabled={!!probeLoading}
              onClick={() => runProbe(key)}
              className={`flex items-center justify-center gap-2 p-3 bg-[#0a0a0a] border border-[#151515] hover:border-${color}-500/20 hover:text-${color}-400 text-zinc-500 rounded text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer disabled:opacity-40`}
            >
              {probeLoading === key
                ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                : <Wifi className="w-3.5 h-3.5" />
              }
              Testar {label}
            </button>
          ))}
        </div>

        {/* Tabela comparativa de resultados */}
        {Object.keys(probeResults).length > 0 && (
          <div className="space-y-4">
            {/* Linha de header */}
            <div className="grid grid-cols-7 gap-1 text-[8px] font-bold text-zinc-600 uppercase tracking-wider border-b border-[#121212] pb-2">
              <span>Fonte</span>
              <span>Status</span>
              <span>Tempo</span>
              <span>Tamanho</span>
              <span>Bloqueio</span>
              <span>Confiança</span>
              <span>Recomendação</span>
            </div>

            {Object.entries(probeResults).map(([key, result]) => {
              const isBlocked = result.blocked || result.captchaDetected || result.cloudflareDetected;
              const recColors: Record<string, string> = {
                candidate_for_parser: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5',
                inspect_network_or_api_pattern: 'text-sky-400 border-sky-500/20 bg-sky-500/5',
                needs_browser_rendering: 'text-amber-400 border-amber-500/20 bg-amber-500/5',
                blocked_or_risky: 'text-red-400 border-red-500/20 bg-red-500/5',
                not_available: 'text-zinc-600 border-zinc-800 bg-zinc-950',
              };
              const confColors: Record<string, string> = {
                high: 'text-emerald-400',
                medium: 'text-amber-400',
                low: 'text-red-400',
                unknown: 'text-zinc-600',
              };
              const recLabels: Record<string, string> = {
                candidate_for_parser: 'Parser',
                inspect_network_or_api_pattern: 'API',
                needs_browser_rendering: 'Playwright',
                blocked_or_risky: 'Bloqueada',
                not_available: 'Indisponível',
              };

              return (
                <div key={key} className="space-y-2">
                  <div className="grid grid-cols-7 gap-1 items-center text-[9px] font-mono">
                    <span className="text-zinc-300 font-bold capitalize">{key === 'oddsagora' ? 'OddsAgora' : 'Oddspedia'}</span>

                    <span className={`font-bold ${
                      (result.statusCode ?? 0) === 200 ? 'text-emerald-400' :
                      (result.statusCode ?? 0) >= 400 ? 'text-red-400' : 'text-zinc-500'
                    }`}>
                      {result.statusCode ?? '—'}
                    </span>

                    <span className="text-zinc-400">
                      {result.responseTimeMs != null ? `${result.responseTimeMs}ms` : '—'}
                    </span>

                    <span className="text-zinc-400">
                      {result.responseSize != null
                        ? result.responseSize > 1024
                          ? `${(result.responseSize / 1024).toFixed(0)}kb`
                          : `${result.responseSize}b`
                        : '—'}
                    </span>

                    <span className={isBlocked ? 'text-red-400 font-bold' : 'text-emerald-400'}>
                      {isBlocked ? (
                        <span className="flex items-center gap-1">
                          <XCircle className="w-3 h-3" />
                          {result.captchaDetected ? 'Captcha' : result.cloudflareDetected ? 'CF' : 'Bloq.'}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Não
                        </span>
                      )}
                    </span>

                    <span className={`font-bold ${confColors[result.confidence] ?? 'text-zinc-600'}`}>
                      {result.confidence === 'high' ? 'Alta' :
                       result.confidence === 'medium' ? 'Média' :
                       result.confidence === 'low' ? 'Baixa' : '—'}
                    </span>

                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border ${
                      recColors[result.recommendation] ?? recColors.not_available
                    }`}>
                      {recLabels[result.recommendation] ?? result.recommendation}
                    </span>
                  </div>

                  {/* Badges de detalhes */}
                  <div className="flex flex-wrap gap-1 ml-0">
                    {result.jsonDetected && (
                      <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-sky-500/5 border border-sky-500/15 text-sky-400">JSON detectado</span>
                    )}
                    {result.potentialApiEndpoints.length > 0 && (
                      <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-violet-500/5 border border-violet-500/15 text-violet-400">{result.potentialApiEndpoints.length} endpoints</span>
                    )}
                    {result.keywordHits.length > 0 && (
                      <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/5 border border-emerald-500/15 text-emerald-400">{result.keywordHits.length} keywords</span>
                    )}
                    {result.pageTitle && (
                      <span className="text-[8px] px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-500 max-w-[200px] truncate">"{result.pageTitle}"</span>
                    )}
                    {result.cfRay && (
                      <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-orange-500/5 border border-orange-500/15 text-orange-400">CF-Ray: {result.cfRay.substring(0, 12)}...</span>
                    )}
                  </div>

                  {/* Notas de inspeção — recolhíveis */}
                  {result.inspectionNotes && result.inspectionNotes.length > 0 && (
                    <div>
                      <button
                        type="button"
                        onClick={() => setShowNotes((prev) => ({ ...prev, [key]: !prev[key] }))}
                        className="flex items-center gap-1 text-[9px] text-zinc-600 hover:text-zinc-400 transition-colors cursor-pointer"
                      >
                        {showNotes[key] ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        {showNotes[key] ? 'Ocultar notas' : `Ver ${result.inspectionNotes.length} notas de inspeção`}
                      </button>

                      {showNotes[key] && (
                        <div className="mt-1.5 p-2.5 bg-[#050505] border border-[#111] rounded space-y-1">
                          {result.inspectionNotes.map((note, i) => (
                            <div key={i} className="flex items-start gap-1.5 text-[9px] text-zinc-500 font-mono">
                              <span className="text-zinc-700 mt-0.5">›</span>
                              <span>{note}</span>
                            </div>
                          ))}
                          {result.potentialApiEndpoints.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-[#111]">
                              <p className="text-[8px] font-bold text-zinc-600 uppercase tracking-wider mb-1">Endpoints detectados:</p>
                              {result.potentialApiEndpoints.map((ep, i) => (
                                <div key={i} className="text-[9px] font-mono text-sky-600 hover:text-sky-400">{ep}</div>
                              ))}
                            </div>
                          )}
                          {result.keywordHits.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-[#111]">
                              <p className="text-[8px] font-bold text-zinc-600 uppercase tracking-wider mb-1">Keywords encontradas:</p>
                              <div className="flex flex-wrap gap-1">
                                {result.keywordHits.map((kw) => (
                                  <span key={kw} className="text-[8px] font-mono px-1 py-0.5 bg-zinc-900 border border-zinc-800 text-zinc-500 rounded">{kw}</span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Linha divisória entre fontes */}
                  <div className="border-b border-[#0e0e0e] mt-1" />
                </div>
              );
            })}

            {/* Legenda de recomendações */}
            <div className="mt-2 p-3 bg-[#050505] border border-[#0d0d0d] rounded">
              <p className="text-[8px] font-bold text-zinc-600 uppercase tracking-wider mb-2">Legenda de Recomendações</p>
              <div className="grid grid-cols-1 gap-1 text-[8px] font-mono">
                <div className="flex items-center gap-2"><span className="text-emerald-400 font-bold">Parser</span><span className="text-zinc-700">→</span><span className="text-zinc-600">Fonte saudável, pronta para criação de parser na Etapa 4</span></div>
                <div className="flex items-center gap-2"><span className="text-sky-400 font-bold">API</span><span className="text-zinc-700">→</span><span className="text-zinc-600">Endpoints detectados — investigar padrão de API antes do parser</span></div>
                <div className="flex items-center gap-2"><span className="text-amber-400 font-bold">Playwright</span><span className="text-zinc-700">→</span><span className="text-zinc-600">HTML renderizado via JS — requer browser headless (Etapa 4+)</span></div>
                <div className="flex items-center gap-2"><span className="text-red-400 font-bold">Bloqueada</span><span className="text-zinc-700">→</span><span className="text-zinc-600">403/captcha/Cloudflare — risco alto, investigar alternativa</span></div>
                <div className="flex items-center gap-2"><span className="text-zinc-600 font-bold">Indisponível</span><span className="text-zinc-700">→</span><span className="text-zinc-600">Timeout ou erro de rede</span></div>
              </div>
            </div>
          </div>
        )}

        {Object.keys(probeResults).length === 0 && (
          <div className="flex items-center justify-center gap-2 p-6 border border-dashed border-[#151515] rounded text-zinc-700 text-[10px]">
            <AlertTriangle className="w-4 h-4" />
            Clique em "Testar OddsAgora" ou "Testar Oddspedia" para iniciar o diagnóstico
          </div>
        )}
      </div>

      {/* Painel de Scraper Real — Etapa 4 e 5 */}
      <div className="bg-[#080808] border border-[#1a1a1a] rounded-lg p-5 space-y-5">
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-blue-400" />
          <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider font-space font-extrabold">Scraper Real (OddsAgora)</h2>
          <span className="text-[8px] font-bold text-blue-500 border border-blue-500/20 bg-blue-500/5 px-2 py-0.5 rounded font-mono uppercase">Etapa 4+5</span>
        </div>

        <p className="text-[10px] text-zinc-600 leading-relaxed">
          Executa a lógica de extração no OddsAgora. Descubra rotas candidatas ou teste uma URL manualmente.
        </p>

        <div className="space-y-3 p-4 bg-[#0a0a0a] border border-[#151515] rounded">
          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">URL de teste do OddsAgora</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              placeholder="https://oddsagora.com.br/futebol"
              className="flex-1 bg-black border border-[#222] rounded px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-blue-500/50"
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              disabled={!!parserLoading || discoveryLoading || finalInvLoading}
              onClick={() => runOddsAgoraScraper('diagnostic')}
              className="flex items-center justify-center gap-2 p-3 bg-[#0c0c0c] border border-[#1a1a1a] hover:border-blue-500/20 hover:text-blue-400 text-zinc-500 rounded text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer disabled:opacity-40"
            >
              {parserLoading === 'diagnostic' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5" />}
              Diagnóstico Profundo
            </button>
            
            <button
              type="button"
              disabled={!!parserLoading || discoveryLoading || finalInvLoading}
              onClick={() => runOddsAgoraScraper('parse_and_save')}
              className="flex items-center justify-center gap-2 p-3 bg-[#0c0c0c] border border-[#1a1a1a] hover:border-emerald-500/20 hover:text-emerald-400 text-zinc-500 rounded text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer disabled:opacity-40"
            >
              {parserLoading === 'parse_and_save' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
              Rodar Parser
            </button>
            
            <button
              type="button"
              disabled={!!parserLoading || discoveryLoading || finalInvLoading}
              onClick={runOddsAgoraDiscovery}
              className="flex items-center justify-center gap-2 p-3 bg-[#0c0c0c] border border-[#1a1a1a] hover:border-amber-500/20 hover:text-amber-400 text-zinc-500 rounded text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer disabled:opacity-40"
            >
              {discoveryLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              Descobrir URLs
            </button>

            <button
              type="button"
              disabled={!!parserLoading || discoveryLoading || finalInvLoading}
              onClick={runOddsAgoraFinalInvestigation}
              className="flex items-center justify-center gap-2 p-3 bg-[#110000] border border-red-900/50 hover:border-red-500/80 hover:bg-red-900/20 text-red-400 rounded text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer disabled:opacity-40"
            >
              {finalInvLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
              Investigação Final OddsAgora
            </button>
          </div>
        </div>
        {parserError && (
          <div className="p-3 bg-red-500/5 border border-red-500/10 rounded text-[10px] text-red-400 font-mono">
            Erro: {parserError}
          </div>
        )}

        {finalInvResult && (
          <div className="space-y-4 p-4 bg-[#080505] border border-red-900/30 rounded">
            <div className="flex items-center justify-between border-b border-red-900/30 pb-2">
              <span className="text-[10px] font-bold text-red-400 uppercase">Diagnóstico Final e Decisão</span>
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${
                finalInvResult.sourceDecision.includes('viable') && !finalInvResult.sourceDecision.includes('not') 
                  ? 'bg-emerald-500/10 text-emerald-400' 
                  : 'bg-red-500/10 text-red-400'
              }`}>
                {finalInvResult.sourceDecision}
              </span>
            </div>

            <div className="text-[10px] text-zinc-400 space-y-2">
              <p><strong className="text-zinc-300">Decisão:</strong> {finalInvResult.reason}</p>
              <p><strong className="text-zinc-300">Próximo Passo:</strong> {finalInvResult.recommendedNextAction}</p>
            </div>

            {finalInvResult.evidence && finalInvResult.evidence.length > 0 && (
              <div className="mt-3 pt-3 border-t border-red-900/30">
                <p className="text-[9px] font-bold text-red-400/70 uppercase mb-2">Evidências Encontradas ({finalInvResult.urlsTested} URLs testadas)</p>
                <div className="space-y-1">
                  {finalInvResult.evidence.map((ev: string, idx: number) => (
                    <div key={idx} className="flex items-start gap-1.5 text-[9px] text-zinc-500 font-mono">
                      <span className="text-red-700 mt-0.5">›</span>
                      <span>{ev}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {discoveryResult && discoveryResult.success && (
          <div className="space-y-4 p-4 bg-[#0a0a0a] border border-[#151515] rounded">
            <div className="flex items-center justify-between border-b border-[#151515] pb-2">
              <span className="text-[10px] font-bold text-zinc-400 uppercase">Rotas Descobertas e Rankeadas</span>
              <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400">
                {discoveryResult.inspections?.length || 0} Inspecionadas
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[9px] font-mono text-zinc-400">
                <thead className="bg-[#111] text-zinc-500 uppercase">
                  <tr>
                    <th className="px-3 py-2 font-bold">URL</th>
                    <th className="px-3 py-2 font-bold">Ranking</th>
                    <th className="px-3 py-2 font-bold">Score</th>
                    <th className="px-3 py-2 font-bold">Modo</th>
                    <th className="px-3 py-2 font-bold">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#151515]">
                  {discoveryResult.inspections?.map((ins: any, idx: number) => (
                    <tr key={idx} className="hover:bg-[#0c0c0c] transition-colors">
                      <td className="px-3 py-2 truncate max-w-[200px]" title={ins.url}>{ins.url}</td>
                      <td className="px-3 py-2">
                        <span className={`px-1.5 py-0.5 rounded ${
                          ins.ranking === 'strong_candidate' ? 'bg-emerald-500/10 text-emerald-400' :
                          ins.ranking === 'medium_candidate' ? 'bg-blue-500/10 text-blue-400' :
                          ins.ranking === 'weak_candidate' ? 'bg-amber-500/10 text-amber-400' :
                          'bg-red-500/10 text-red-400'
                        }`}>
                          {ins.ranking}
                        </span>
                      </td>
                      <td className="px-3 py-2">{ins.score}</td>
                      <td className="px-3 py-2">{ins.diagnostic?.extractionMode}</td>
                      <td className="px-3 py-2">
                        <button
                          onClick={() => {
                            setCustomUrl(ins.url);
                            runOddsAgoraScraper('diagnostic');
                          }}
                          className="px-2 py-1 bg-[#1a1a1a] hover:bg-[#252525] text-zinc-300 rounded mr-2"
                        >
                          Testar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {parserResult && (
          <div className="space-y-4 p-4 bg-[#0a0a0a] border border-[#151515] rounded">
            <div className="flex items-center justify-between border-b border-[#151515] pb-2">
              <span className="text-[10px] font-bold text-zinc-400 uppercase">Resultado do Scraper</span>
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${
                parserResult.success 
                  ? 'bg-emerald-500/10 text-emerald-400' 
                  : (parserResult.oddsExtracted === 0 && (parserResult.extractionMode === 'html' || parserResult.extractionMode === 'next_data'))
                    ? 'bg-amber-500/10 text-amber-400'
                    : 'bg-red-500/10 text-red-400'
              }`}>
                {parserResult.success 
                  ? 'SUCESSO' 
                  : (parserResult.oddsExtracted === 0 && (parserResult.extractionMode === 'html' || parserResult.extractionMode === 'next_data'))
                    ? 'SEM DADOS'
                    : 'FALHA PARCIAL'}
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-[10px] font-mono">
              <div>
                <p className="text-zinc-600 mb-1">Modo de Extração</p>
                <p className="text-sky-400 font-bold">{parserResult.extractionMode || 'N/A'}</p>
              </div>
              {parserResult.eventsExtracted !== undefined && (
                <>
                  <div>
                    <p className="text-zinc-600 mb-1">Eventos Extraídos</p>
                    <p className="text-zinc-300 font-bold">{parserResult.eventsExtracted}</p>
                  </div>
                  <div>
                    <p className="text-zinc-600 mb-1">Odds Extraídas</p>
                    <p className="text-zinc-300 font-bold">{parserResult.oddsExtracted}</p>
                  </div>
                  <div>
                    <p className="text-zinc-600 mb-1">Odds Salvas</p>
                    <p className="text-emerald-400 font-bold">{parserResult.oddsSaved}</p>
                  </div>
                </>
              )}
            </div>

            {parserResult.warnings && parserResult.warnings.length > 0 && (
              <div className="mt-4 pt-4 border-t border-[#151515]">
                <p className="text-[9px] font-bold text-amber-500 uppercase mb-2">Avisos e Notas de Inspeção</p>
                <ul className="space-y-1">
                  {parserResult.warnings.map((w: string, i: number) => (
                    <li key={i} className="text-[9px] text-amber-400/80 font-mono flex items-start gap-2">
                      <span className="mt-0.5">•</span> {w}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ===== PAINEL ODDSPAPI ===== */}
      <OddsPapiPanel adminSecret={adminSecret} />
    </div>
  );
}

// -----------------------------------------------------------------------
// Componente separado para manter o ConfiguracoesScreen enxuto
// -----------------------------------------------------------------------
function OddsPapiPanel({ adminSecret }: { adminSecret: string }) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [healthResult, setHealthResult] = useState<any>(null);
  const [importResult, setImportResult] = useState<any>(null);

  // Cached states
  const [sportsResult, setSportsResult] = useState<any>(null);
  const [bookmakersResult, setBookmakersResult] = useState<any>(null);
  const [tournamentsResult, setTournamentsResult] = useState<any>(null);
  
  // Probe states
  const [oddsProbeResult, setOddsProbeResult] = useState<any>(null);
  const [selectedTournament, setSelectedTournament] = useState<string>('');

  useEffect(() => {
    try {
      const s = localStorage.getItem('oddspapi_sports');
      const b = localStorage.getItem('oddspapi_bookmakers');
      const t = localStorage.getItem('oddspapi_tournaments');
      if (s) setSportsResult(JSON.parse(s));
      if (b) setBookmakersResult(JSON.parse(b));
      if (t) setTournamentsResult(JSON.parse(t));
    } catch {}
  }, []);

  const saveCache = (key: string, data: any) => {
    try {
      localStorage.setItem(key, JSON.stringify({ ...data, _cachedAt: Date.now() }));
    } catch {}
  };

  const isCacheValid = (data: any) => {
    if (!data || !data._cachedAt) return false;
    // Validade de 24 horas = 86400000 ms
    return Date.now() - data._cachedAt < 86400000;
  };

  const callDebugAction = async (step: string, payload?: any) => {
    if (!adminSecret) return setError('Secret do admin obrigatório');
    setLoading(step);
    setError(null);
    try {
      const res = await fetch('/api/providers/oddspapi/debug-flow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': adminSecret },
        body: JSON.stringify({ step, payload }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Erro na requisição');
      return data;
    } catch (err) {
      setError(String(err));
      return null;
    } finally {
      setLoading(null);
    }
  };

  const runHealth = async () => {
    const data = await callDebugAction('health'); // We could use regular endpoint but we are reusing pattern
    // health is different, let's keep the old call logic for health/import
    setLoading('health');
    try {
      const res = await fetch('/api/providers/oddspapi/health', {
        method: 'POST',
        headers: { 'x-admin-secret': adminSecret },
      });
      setHealthResult(await res.json());
    } finally {
      setLoading(null);
    }
  };

  const runImport = async () => {
    if (!window.confirm('Esta ação consome requisições da OddsPapi. Confirma o import?')) return;
    setLoading('import');
    try {
      const res = await fetch('/api/providers/oddspapi/import-football', {
        method: 'POST',
        headers: { 'x-admin-secret': adminSecret },
      });
      setImportResult(await res.json());
    } finally {
      setLoading(null);
    }
  };

  // Etapas manuais:
  const loadSports = async () => {
    if (sportsResult && isCacheValid(sportsResult)) return; // já validado
    if (!window.confirm('Esta ação consome 1 requisição da OddsPapi. Continuar?')) return;
    const data = await callDebugAction('sports');
    if (data) { setSportsResult(data); saveCache('oddspapi_sports', data); }
  };

  const loadBookmakers = async () => {
    if (bookmakersResult && isCacheValid(bookmakersResult)) return;
    if (!window.confirm('Esta ação consome 1 requisição da OddsPapi. Continuar?')) return;
    setLoading('bookmakers');
    try {
      const res = await fetch('/api/providers/oddspapi/bookmakers', {
        method: 'POST',
        headers: { 'x-admin-secret': adminSecret },
      });
      const data = await res.json();
      if (data.ok) { setBookmakersResult(data); saveCache('oddspapi_bookmakers', data); }
      else setError(data.error);
    } catch(e) { setError(String(e)); } finally { setLoading(null); }
  };

  const loadTournaments = async () => {
    if (tournamentsResult && isCacheValid(tournamentsResult)) return;
    if (!window.confirm('Esta ação consome 1 requisição da OddsPapi. Continuar?')) return;
    const sportId = sportsResult?.sportIdFound ?? 10;
    const data = await callDebugAction('tournaments', { sportId });
    if (data) { setTournamentsResult(data); saveCache('oddspapi_tournaments', data); }
  };

  const testOdds = async () => {
    if (!selectedTournament) return setError('Selecione 1 torneio primeiro.');
    if (!window.confirm('Esta ação consome 1 requisição da OddsPapi. Continuar?')) return;
    const data = await callDebugAction('odds-probe', { tournamentId: selectedTournament });
    if (data) setOddsProbeResult(data);
  };

  const isLoading = !!loading;

  return (
    <div className="bg-[#080808] border border-[#1a1a1a] rounded-lg p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <BarChart2 className="w-3.5 h-3.5 text-violet-400" />
        <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider font-extrabold">Fonte API — OddsPapi Futebol</h2>
        <span className="text-[8px] font-bold text-violet-500 border border-violet-500/20 bg-violet-500/5 px-2 py-0.5 rounded font-mono uppercase">Real</span>
      </div>

      <p className="text-[10px] text-zinc-600 leading-relaxed">
        Integração com a OddsPapi para odds reais de futebol. Apenas futebol. Sem cron — use os botões abaixo manualmente.
        <span className="ml-1 text-amber-500/80">⚠ Cada clique consome requisições da sua cota.</span>
      </p>

      {/* Status rápido */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[9px] font-mono">
        <div className="p-3 bg-[#0a0a0a] border border-[#151515] rounded">
          <p className="text-zinc-600 mb-1">API Key</p>
          <p className={healthResult?.ok ? 'text-emerald-400 font-bold' : 'text-zinc-500'}>
            {healthResult?.ok ? 'Válida ✓' : 'Não testada'}
          </p>
        </div>
        <div className="p-3 bg-[#0a0a0a] border border-[#151515] rounded">
          <p className="text-zinc-600 mb-1">Último Import</p>
          <p className="text-zinc-400">{importResult ? 'Recente ✓' : '—'}</p>
        </div>
        <div className="p-3 bg-[#0a0a0a] border border-[#151515] rounded">
          <p className="text-zinc-600 mb-1">Odds Salvas</p>
          <p className="text-emerald-400 font-bold">{importResult?.oddsSaved ?? '—'}</p>
        </div>
        <div className="p-3 bg-[#0a0a0a] border border-[#151515] rounded">
          <p className="text-zinc-600 mb-1">Oportunidades</p>
          <p className="text-violet-400 font-bold">{importResult?.opportunitiesCreated ?? '—'}</p>
        </div>
      </div>

      {/* Botões */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <button type="button" disabled={loading !== null}
          onClick={runHealth}
          className="flex items-center justify-center gap-2 p-3 bg-[#0c0c0c] border border-[#1a1a1a] hover:border-emerald-500/30 hover:text-emerald-400 text-zinc-500 rounded text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer disabled:opacity-40"
        >
          {loading === 'health' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Wifi className="w-3.5 h-3.5" />}
          Testar Conexão
        </button>

        <button type="button" disabled={loading !== null}
          onClick={loadSports}
          className="flex items-center justify-center gap-2 p-3 bg-[#0c0c0c] border border-[#1a1a1a] hover:border-blue-500/30 hover:text-blue-400 text-zinc-500 rounded text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer disabled:opacity-40"
        >
          {loading === 'sports' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5" />}
          Carregar Sports {sportsResult ? '(Cache)' : ''}
        </button>

        <button type="button" disabled={loading !== null}
          onClick={loadBookmakers}
          className="flex items-center justify-center gap-2 p-3 bg-[#0c0c0c] border border-[#1a1a1a] hover:border-sky-500/30 hover:text-sky-400 text-zinc-500 rounded text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer disabled:opacity-40"
        >
          {loading === 'bookmakers' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
          Carregar Bookmakers {bookmakersResult ? '(Cache)' : ''}
        </button>

        <button type="button" disabled={loading !== null}
          onClick={loadTournaments}
          className="flex items-center justify-center gap-2 p-3 bg-[#0c0c0c] border border-[#1a1a1a] hover:border-amber-500/30 hover:text-amber-400 text-zinc-500 rounded text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer disabled:opacity-40"
        >
          {loading === 'tournaments' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
          Carregar Torneios {tournamentsResult ? '(Cache)' : ''}
        </button>

        <button type="button" disabled={loading !== null}
          onClick={runImport}
          className="flex items-center justify-center gap-2 p-3 bg-[#0a0005] border border-violet-900/50 hover:border-violet-500/80 hover:bg-violet-900/20 text-violet-400 rounded text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer disabled:opacity-40 col-span-2 md:col-span-4"
        >
          {loading === 'import' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />}
          Importar Odds de Futebol → Supabase
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-500/5 border border-red-500/10 rounded text-[10px] text-red-400 font-mono">{error}</div>
      )}

      {/* Health result */}
      {healthResult && (
        <div className="p-4 bg-[#0a0a0a] border border-[#151515] rounded space-y-2">
          <p className="text-[9px] font-bold text-zinc-500 uppercase mb-2">Conexão OddsPapi</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[9px] font-mono">
            <div><p className="text-zinc-600">Status</p><p className={healthResult.ok ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>{healthResult.ok ? 'OK' : 'ERRO'}</p></div>
            <div><p className="text-zinc-600">HTTP</p><p className="text-zinc-300">{healthResult.status}</p></div>
            <div><p className="text-zinc-600">Resposta</p><p className="text-zinc-300">{healthResult.responseTimeMs}ms</p></div>
            <div><p className="text-zinc-600">Reqs Restantes</p><p className="text-zinc-300">{healthResult.requestsRemaining ?? '—'}</p></div>
          </div>
          {healthResult.error && <p className="text-[9px] text-red-400 font-mono mt-2">{healthResult.error}</p>}
        </div>
      )}

      {/* Sports Result */}
      {sportsResult && (
        <div className="p-4 bg-[#0a0a0a] border border-[#151515] rounded space-y-2">
          <p className="text-[9px] font-bold text-zinc-500 uppercase">Sports — /v4/sports</p>
          <div className="flex gap-4 text-[9px] font-mono text-zinc-400">
            <span>Total: {sportsResult.sports?.length}</span>
            <span className="text-emerald-400">Soccer SportId: {sportsResult.sportIdFound}</span>
          </div>
        </div>
      )}

      {/* Bookmakers result */}
      {bookmakersResult && (
        <div className="p-4 bg-[#0a0a0a] border border-[#151515] rounded space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[9px] font-bold text-zinc-500 uppercase">Bookmakers — /v4/bookmakers</p>
            <div className="flex items-center gap-2">
              <span className="text-[8px] text-zinc-600 font-mono">total bruto: {bookmakersResult.totalRaw}</span>
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${
                bookmakersResult.verdict === 'viable' ? 'bg-emerald-500/10 text-emerald-400' :
                bookmakersResult.verdict === 'partial' ? 'bg-amber-500/10 text-amber-400' :
                'bg-red-500/10 text-red-400'
              }`}>{bookmakersResult.verdict?.toUpperCase()}</span>
            </div>
          </div>
          {bookmakersResult.bookmakers?.length > 0 && (
            <div className="mt-1">
              <p className="text-[8px] font-bold text-zinc-600 uppercase mb-1">Disponíveis na conta (primeiros 30)</p>
              <div className="flex flex-wrap gap-1">
                {bookmakersResult.bookmakers.map((b: any, i: number) => (
                  <span key={i} className="text-[8px] font-mono px-1.5 py-0.5 bg-[#111] border border-[#222] rounded text-zinc-400" title={`slug: ${b.slug}`}>{b.name || b.slug}</span>
                ))}
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 text-[9px] font-mono mt-2">
            <div>
              <p className="text-emerald-600 font-bold mb-1">Prioritárias encontradas ({bookmakersResult.priorityFound?.length})</p>
              {bookmakersResult.priorityFound?.map((b: string, i: number) => (
                <p key={i} className="text-emerald-400">✓ {b}</p>
              ))}
              {bookmakersResult.priorityFound?.length === 0 && <p className="text-zinc-600">nenhuma encontrada</p>}
            </div>
            <div>
              <p className="text-zinc-700 font-bold mb-1">Prioritárias ausentes ({bookmakersResult.priorityMissing?.length})</p>
              {bookmakersResult.priorityMissing?.slice(0, 8).map((b: string, i: number) => (
                <p key={i} className="text-zinc-600">✗ {b}</p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tournaments result & Odds Probe */}
      {tournamentsResult && (
        <div className="p-4 bg-[#0a0a0a] border border-[#151515] rounded space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[9px] font-bold text-zinc-500 uppercase">Torneios de Futebol</p>
            <span className="text-[8px] text-zinc-600 font-mono">total: {tournamentsResult.rawCount}</span>
          </div>
          
          <div className="space-y-1 max-h-40 overflow-y-auto pr-2 border border-[#1a1a1a] rounded p-2">
            {tournamentsResult.tournaments?.slice(0, 50).map((t: any) => (
              <div key={t.tournamentId ?? t.id} className="flex justify-between items-center text-[9px] font-mono border-b border-[#111] pb-1 mb-1">
                <span className="text-zinc-300">#{t.tournamentId ?? t.id} {t.tournamentName ?? t.name} <span className="text-zinc-600 text-[8px]">({t.categoryName ?? t.category})</span></span>
                <span className="text-amber-500/70">↑{t.upcomingFixtures ?? 0} ⚡{t.liveFixtures ?? 0} 📅{t.futureFixtures ?? 0}</span>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-[#1a1a1a] flex gap-2 items-end">
            <div className="flex-1">
              <label className="block text-[9px] font-bold text-zinc-500 uppercase mb-1">Torneio para testar odds</label>
              <select 
                value={selectedTournament} 
                onChange={e => setSelectedTournament(e.target.value)}
                className="w-full bg-[#050505] border border-[#222] rounded p-2 text-zinc-300 text-[9px] font-mono outline-none"
              >
                <option value="">Selecione um torneio com fixtures &gt; 0</option>
                {tournamentsResult.tournaments?.filter((t: any) => (t.upcomingFixtures||0)+(t.liveFixtures||0)+(t.futureFixtures||0) > 0).map((t: any) => (
                  <option key={t.tournamentId ?? t.id} value={t.tournamentId ?? t.id}>
                    {t.tournamentName ?? t.name} (↑{t.upcomingFixtures||0} ⚡{t.liveFixtures||0})
                  </option>
                ))}
              </select>
            </div>
            <button type="button" disabled={loading !== null || !selectedTournament} onClick={testOdds} className="bg-emerald-900/30 text-emerald-500 hover:bg-emerald-900/50 border border-emerald-900/50 rounded px-4 py-2 text-[9px] font-bold uppercase transition-all whitespace-nowrap">
              Testar Odds
            </button>
          </div>
        </div>
      )}

      {/* Odds Probe Result */}
      {oddsProbeResult && (
        <div className="p-4 bg-[#080800] border border-amber-900/30 rounded space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[9px] font-bold text-amber-500/70 uppercase">Resultado das Odds</p>
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${
              oddsProbeResult.verdict === 'viável tecnicamente' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
            }`}>{oddsProbeResult.verdict}</span>
          </div>

          {oddsProbeResult.safeUrl && (
            <div className="mt-1">
              <p className="text-[8px] font-bold text-zinc-600 uppercase mb-1">URL Segura Chamada</p>
              <p className="text-[8px] font-mono text-zinc-400 break-all bg-black p-1.5 rounded border border-[#1a1a1a]">{oddsProbeResult.safeUrl}</p>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[9px] font-mono mt-2">
            <div><p className="text-zinc-600">HTTP</p><p className="text-zinc-300 font-bold">{oddsProbeResult.status}</p></div>
            <div><p className="text-zinc-600">Fixtures retornados</p><p className={oddsProbeResult.oddsShape?.totalFixtures > 0 ? "text-emerald-400 font-bold" : "text-red-400 font-bold"}>{oddsProbeResult.oddsShape?.totalFixtures ?? 0}</p></div>
            <div><p className="text-zinc-600">Odds Totais</p><p className="text-zinc-300 font-bold">{oddsProbeResult.oddsShape?.oddsCount ?? 0}</p></div>
          </div>

          {oddsProbeResult.oddsShape?.totalFixtures === 0 && (
            <div className="mt-2 p-2 bg-red-500/5 border border-red-500/10 rounded">
              <p className="text-[9px] text-red-400 font-mono">A API retornou array vazio ou sem fixtures. Verifique se o torneio realmente tem jogos disponíveis no seu plano.</p>
              {oddsProbeResult.oddsShape?.topLevelKeys && <p className="text-[8px] text-zinc-500 font-mono mt-1">Chaves do JSON: {oddsProbeResult.oddsShape.topLevelKeys.join(', ')}</p>}
            </div>
          )}

          {oddsProbeResult.oddsShape?.totalFixtures > 0 && (
            <div className="mt-2 pt-2 border-t border-[#1a1a1a]">
              <p className="text-[8px] font-bold text-zinc-600 uppercase mb-1">Shape do Primeiro Evento</p>
              <p className="text-[8px] font-mono text-zinc-500">fixture keys: {oddsProbeResult.oddsShape.sampleFixtureKeys?.join(', ')}</p>
              <p className="text-[8px] font-mono text-zinc-500">bookmaker keys: {oddsProbeResult.oddsShape.sampleBkKeys?.join(', ')}</p>
              <p className="text-[8px] font-mono text-zinc-500">market keys: {oddsProbeResult.oddsShape.sampleMarketKeys?.join(', ')}</p>
            </div>
          )}

          {oddsProbeResult.error && <p className="text-[9px] text-red-400 font-mono mt-1">{oddsProbeResult.error}</p>}
        </div>
      )}

      {/* Import result */}
      {importResult && (
        <div className="p-4 bg-[#070a07] border border-emerald-900/30 rounded space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[9px] font-bold text-emerald-500/70 uppercase">Resultado do Import</p>
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${importResult.ok ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
              {importResult.ok ? 'SUCESSO' : 'ERRO'}
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[9px] font-mono">
            <div><p className="text-zinc-600">Eventos</p><p className="text-zinc-300 font-bold">{importResult.eventsImported ?? 0}</p></div>
            <div><p className="text-zinc-600">Odds Salvas</p><p className="text-emerald-400 font-bold">{importResult.oddsSaved ?? 0}</p></div>
            <div><p className="text-zinc-600">Casas</p><p className="text-zinc-300 font-bold">{importResult.bookmakersUpserted ?? 0}</p></div>
            <div><p className="text-zinc-600">Oportunidades</p><p className="text-violet-400 font-bold">{importResult.opportunitiesCreated ?? 0}</p></div>
          </div>
          <div className="flex gap-4 text-[9px] font-mono">
            {importResult.requestsUsed !== undefined && <span className="text-zinc-600">Reqs usadas: <span className="text-zinc-400">{importResult.requestsUsed}</span></span>}
            {importResult.requestsRemaining !== undefined && <span className="text-zinc-600">Reqs restantes: <span className="text-zinc-400">{importResult.requestsRemaining}</span></span>}
          </div>
          {importResult.error && <p className="text-[9px] text-red-400 font-mono">{importResult.error}</p>}
        </div>
      )}
    </div>
  );
}
