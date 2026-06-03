'use client';

import React, { useState } from 'react';
import { UserSettings, Bookmaker } from '../types';
import { 
  Settings, 
  Upload, 
  Plus, 
  ShieldCheck
} from 'lucide-react';

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
              <span className="text-[8px] bg-zinc-900 text-zinc-600 border border-[#1a1a1a] px-2 py-0.5 rounded font-mono uppercase font-bold">Inativo</span>
            </div>
            <div className="flex items-center justify-between p-2.5 bg-[#0a0a0a] border border-[#151515] rounded">
              <span className="text-zinc-400 font-bold">OddspediaProvider.ts</span>
              <span className="text-[8px] bg-zinc-900 text-zinc-600 border border-[#1a1a1a] px-2 py-0.5 rounded font-mono uppercase font-bold">Inativo</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
