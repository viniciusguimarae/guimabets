'use client';

import React, { useState } from 'react';
import { SurebetOpportunity, Bookmaker } from '../types';
import { 
  Search, 
  Flame, 
  Clock, 
  Calendar, 
  ChevronRight,
  ShieldAlert,
  Save,
  Layers,
  Activity
} from 'lucide-react';

interface RadarScreenProps {
  opportunities: SurebetOpportunity[];
  bookmakers: Bookmaker[];
  onOpenCalculator: (op: SurebetOpportunity) => void;
  onSaveBetDirectly: (op: SurebetOpportunity) => void;
}

export default function RadarScreen({
  opportunities,
  bookmakers,
  onOpenCalculator,
  onSaveBetDirectly
}: RadarScreenProps) {
  const [search, setSearch] = useState('');
  const [selectedSport, setSelectedSport] = useState<string>('todos');
  const [selectedMarket, setSelectedMarket] = useState<string>('todos');
  const [minMargin, setMinMargin] = useState<number>(0.5);
  const [onlyAuthorized, setOnlyAuthorized] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>('todos');
  const [orderBy, setOrderBy] = useState<'margem' | 'recencia' | 'horario'>('margem');

  const sports = Array.from(new Set(opportunities.map(o => o.sport)));
  const markets = Array.from(new Set(opportunities.map(o => o.marketName)));

  const filteredOpportunities = opportunities
    .filter(op => {
      if (search && !op.eventName.toLowerCase().includes(search.toLowerCase())) return false;
      if (selectedSport !== 'todos' && op.sport !== selectedSport) return false;
      if (selectedMarket !== 'todos' && op.marketName !== selectedMarket) return false;
      if (op.marginPercent < minMargin) return false;
      if (selectedStatus !== 'todos' && op.status !== selectedStatus) return false;
      if (onlyAuthorized) {
        const hasUnauthorized = op.legs.some(leg => leg.bookmakerStatus !== 'autorizada');
        if (hasUnauthorized) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (orderBy === 'margem') return b.marginPercent - a.marginPercent;
      if (orderBy === 'recencia') return new Date(b.lastUpdatedAt).getTime() - new Date(a.lastUpdatedAt).getTime();
      if (orderBy === 'horario') return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
      return 0;
    });

  const getStatusBadge = (status: SurebetOpportunity['status']) => {
    switch (status) {
      case 'quente':
        return (
          <span className="flex items-center gap-1 text-[9px] uppercase font-black text-red-400 bg-red-950/20 px-2.5 py-0.5 rounded border border-red-500/10 font-mono">
            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping mr-1" />
            <span>Quente</span>
          </span>
        );
      case 'morna':
        return (
          <span className="flex items-center gap-1 text-[9px] uppercase font-black text-amber-400 bg-amber-950/20 px-2.5 py-0.5 rounded border border-amber-500/10 font-mono">
            <span>Morna</span>
          </span>
        );
      case 'fria':
        return (
          <span className="flex items-center gap-1 text-[9px] uppercase font-black text-blue-400 bg-blue-950/20 px-2.5 py-0.5 rounded border border-blue-500/10 font-mono">
            <span>Fria</span>
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 text-[9px] uppercase font-black text-zinc-500 bg-zinc-900 px-2.5 py-0.5 rounded font-mono">
            <span>Morta</span>
          </span>
        );
    }
  };

  const getElapsedTimeText = (isoString: string) => {
    const diffMs = new Date().getTime() - new Date(isoString).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 2) return 'agora';
    if (diffSec < 60) return `${diffSec}s atrás`;
    return `${Math.floor(diffSec / 60)}m atrás`;
  };

  return (
    <div className="space-y-6 select-none">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-white font-space uppercase">Radar de Surebets</h1>
        <p className="text-[10px] text-zinc-500 font-semibold tracking-wider uppercase mt-1">
          Arbitragem esportiva quantitativa em tempo real
        </p>
      </div>

      {/* Painel Filtros Terminal */}
      <div className="bg-[#080808] border border-[#121212] rounded-lg p-5 space-y-4">
        {/* Linha 1: Lupa e Slider */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-3.5 w-3.5 h-3.5 text-zinc-600" />
            <input
              type="text"
              placeholder="Filtro rápido de time/campeonato..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#0c0c0c] border border-[#151515] rounded px-9 py-3 text-zinc-100 placeholder-zinc-700 focus:outline-none focus:border-emerald-500/20 text-xs font-medium"
            />
          </div>

          <div>
            <div className="flex justify-between text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">
              <span>Margem Mínima</span>
              <span className="text-emerald-400 font-bold font-mono">{minMargin.toFixed(1)}%</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="10"
              step="0.1"
              value={minMargin}
              onChange={(e) => setMinMargin(parseFloat(e.target.value))}
              className="w-full h-1 bg-[#151515] rounded appearance-none cursor-pointer accent-emerald-500"
            />
          </div>

          <div className="flex items-center justify-between md:justify-end gap-3 px-1">
            <label className="flex items-center gap-2.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={onlyAuthorized}
                onChange={(e) => setOnlyAuthorized(e.target.checked)}
                className="w-3.5 h-3.5 rounded bg-zinc-900 border-[#1c1c1c] text-emerald-500 focus:ring-transparent"
              />
              <span>Apenas Casas Autorizadas</span>
            </label>
          </div>
        </div>

        {/* Linha 2: Dropdowns e Ordenações */}
        <div className="flex flex-wrap gap-2 pt-3 border-t border-[#121212]">
          <select
            value={selectedSport}
            onChange={(e) => setSelectedSport(e.target.value)}
            className="bg-[#0c0c0c] border border-[#151515] rounded px-3 py-2 text-xs text-zinc-400 focus:outline-none focus:border-zinc-800"
          >
            <option value="todos">Todos Esportes</option>
            {sports.map((sp, idx) => (
              <option key={idx} value={sp}>{sp}</option>
            ))}
          </select>

          <select
            value={selectedMarket}
            onChange={(e) => setSelectedMarket(e.target.value)}
            className="bg-[#0c0c0c] border border-[#151515] rounded px-3 py-2 text-xs text-zinc-400 focus:outline-none focus:border-zinc-800 max-w-xs"
          >
            <option value="todos">Todos Mercados</option>
            {markets.map((mk, idx) => (
              <option key={idx} value={mk}>{mk}</option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-[#0c0c0c] border border-[#151515] rounded px-3 py-2 text-xs text-zinc-400 focus:outline-none focus:border-zinc-800"
          >
            <option value="todos">Temperatura</option>
            <option value="quente">Quente</option>
            <option value="morna">Morna</option>
            <option value="fria">Fria</option>
          </select>

          <div className="flex items-center gap-2 ml-auto">
            <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-wider">Filtrar:</span>
            {(['margem', 'recencia', 'horario'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setOrderBy(mode)}
                className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-all ${
                  orderBy === mode 
                    ? 'bg-emerald-500/5 text-emerald-400 border border-emerald-500/20' 
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {mode === 'margem' ? 'Margem' : mode === 'recencia' ? 'Recência' : 'Horário'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid de Oportunidades */}
      <div className="space-y-4">
        {filteredOpportunities.length === 0 ? (
          <div className="bg-[#080808] border border-[#121212] rounded-lg p-14 text-center text-zinc-600 text-xs flex flex-col items-center justify-center gap-3">
            <Layers className="w-6 h-6 text-zinc-700" />
            <p>Nenhuma oportunidade cadastrada no radar para os filtros selecionados.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredOpportunities.map((op) => {
              const hasUnauthorizedLeg = op.legs.some(leg => leg.bookmakerStatus !== 'autorizada');
              
              return (
                <div 
                  key={op.id}
                  className="bg-[#080808] border border-[#121212] rounded-lg p-5 hover:border-[#1a1a1a] transition-all flex flex-col space-y-4"
                >
                  {/* Evento, Status, Margem */}
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="text-[9px] font-black text-zinc-500 bg-[#0c0c0c] border border-[#151515] px-2 py-0.5 rounded font-mono">
                          {op.sport.toUpperCase()}
                        </span>
                        <span className="text-[10px] text-zinc-400 font-semibold">
                          {op.league}
                        </span>
                        <span className="text-[9px] text-zinc-500 font-mono flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-zinc-600" />
                          {new Date(op.startTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                      </div>
                      <h2 className="text-base font-extrabold text-zinc-100 tracking-tight">
                        {op.eventName}
                      </h2>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-[9px] uppercase font-bold text-zinc-600 tracking-wider block">Implícita</span>
                        <span className="text-xs text-zinc-400 font-bold font-mono">{(op.impliedSum * 100).toFixed(2)}%</span>
                      </div>

                      {/* Margem do radar premium */}
                      <div className="bg-emerald-500/5 border border-emerald-500/10 px-4 py-2 rounded">
                        <span className="text-[9px] uppercase font-bold text-emerald-500 tracking-wider block">Margem ROI</span>
                        <span className="text-base font-black font-space text-emerald-400">+{op.marginPercent.toFixed(2)}%</span>
                      </div>

                      {getStatusBadge(op.status)}
                    </div>
                  </div>

                  {/* Detalhe do Mercado */}
                  <div className="text-xs text-zinc-400 bg-[#0c0c0c] border border-[#151515] px-3.5 py-2.5 rounded flex items-center justify-between">
                    <span>Mercado: <strong className="text-zinc-200 font-bold">{op.marketName}</strong></span>
                    <span className="text-[9px] text-zinc-600 font-semibold flex items-center gap-1">
                      <Clock className="w-3 h-3 text-zinc-600" />
                      Capturado {getElapsedTimeText(op.lastUpdatedAt)}
                    </span>
                  </div>

                  {/* Odds Decimais em azul celeste brilhante #38BDF8 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {op.legs.map((leg, idx) => (
                      <div key={idx} className="bg-[#0a0a0a] border border-[#121212] hover:border-[#1c1c1c] transition-all rounded p-3 flex justify-between items-center text-xs">
                        <div className="flex flex-col">
                          <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">{leg.selectionName}</span>
                          <span className="text-zinc-300 font-bold mt-0.5">{leg.bookmakerName}</span>
                          {leg.bookmakerStatus !== 'autorizada' && (
                            <span className="text-[8px] font-bold text-amber-500 uppercase tracking-wide mt-0.5 font-mono">
                              {leg.bookmakerStatus}
                            </span>
                          )}
                        </div>
                        <div>
                          <span className="text-sm font-black text-[#38BDF8] bg-[#38BDF8]/5 border border-[#38BDF8]/10 px-2.5 py-1 rounded font-mono">
                            {leg.oddDecimal.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Alerta regulatório */}
                  {hasUnauthorizedLeg && (
                    <div className="p-3 bg-amber-500/5 border border-amber-500/10 rounded flex gap-2.5 text-[10px] text-amber-500 leading-relaxed font-medium">
                      <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
                      <div>
                        <strong>ALERTA REGULATÓRIO:</strong> Esta arbitragem envolve casas sem licença ou não autorizadas no mercado brasileiro. Risco operacional detectado.
                      </div>
                    </div>
                  )}

                  {/* Ações */}
                  <div className="flex justify-end gap-3 pt-3 border-t border-[#121212]">
                    <button
                      onClick={() => onSaveBetDirectly(op)}
                      className="px-4 py-2 rounded text-[10px] font-bold text-zinc-500 hover:text-zinc-200 hover:bg-[#0c0c0c] border border-[#151515] transition-all flex items-center gap-1.5 cursor-pointer uppercase tracking-wider"
                    >
                      <Save className="w-3 h-3" />
                      <span>Salvar Direto</span>
                    </button>
                    <button
                      onClick={() => onOpenCalculator(op)}
                      className="px-5 py-2 rounded text-[10px] font-extrabold bg-[#0f172a] text-[#38bdf8] hover:bg-[#1e293b] transition-all flex items-center gap-1.5 cursor-pointer border border-[#38bdf8]/10 uppercase tracking-wider"
                    >
                      <span>Calcular Stake</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
