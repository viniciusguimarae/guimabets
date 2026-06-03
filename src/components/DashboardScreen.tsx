'use client';

import React from 'react';
import { SurebetOpportunity, Bookmaker } from '../types';
import { 
  TrendingUp, 
  Layers, 
  Activity, 
  Coins, 
  Zap, 
  ArrowUpRight,
  TrendingDown
} from 'lucide-react';

interface DashboardScreenProps {
  opportunities: SurebetOpportunity[];
  bookmakers: Bookmaker[];
  defaultStake: number;
  onOpenCalculator: (op: SurebetOpportunity) => void;
  onNavigateToRadar: () => void;
}

export default function DashboardScreen({
  opportunities,
  bookmakers,
  defaultStake,
  onOpenCalculator,
  onNavigateToRadar
}: DashboardScreenProps) {
  
  const activeCount = opportunities.length;
  
  const maxMargin = activeCount > 0 
    ? Math.max(...opportunities.map(o => o.marginPercent)) 
    : 0;

  const totalEvents = Array.from(new Set(opportunities.map(o => o.eventId))).length;

  const estimatedProfit = opportunities.reduce((acc, curr) => {
    const profit = defaultStake * (1 / curr.impliedSum) - defaultStake;
    return acc + profit;
  }, 0);

  const bookmakerCounts: Record<string, number> = {};
  opportunities.forEach(op => {
    op.legs.forEach(leg => {
      bookmakerCounts[leg.bookmakerName] = (bookmakerCounts[leg.bookmakerName] || 0) + 1;
    });
  });

  const topBookmakers = Object.entries(bookmakerCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(item => item[0]);

  const marketCounts: Record<string, number> = {};
  opportunities.forEach(op => {
    marketCounts[op.marketName] = (marketCounts[op.marketName] || 0) + 1;
  });

  const topMarkets = Object.entries(marketCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(item => item[0]);

  const hotOpportunities = opportunities
    .filter(o => o.status === 'quente')
    .slice(0, 3);

  const stats = [
    { name: 'Oportunidades Ativas', value: activeCount, icon: Layers, color: 'text-emerald-400' },
    { name: 'Maior Margem Detectada', value: `+${maxMargin.toFixed(2)}%`, icon: TrendingUp, color: 'text-emerald-400' },
    { name: 'Eventos Monitorados', value: totalEvents, icon: Activity, color: 'text-zinc-500' },
    { name: 'Lucro Líquido Acumulado', value: `R$ ${estimatedProfit.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`, icon: Coins, color: 'text-emerald-400', desc: `Simulado com stake padrão de R$ ${defaultStake}` },
  ];

  return (
    <div className="space-y-8 select-none">
      {/* Top Banner minimalista de inteligência */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-white font-space uppercase">Terminal de Operações</h1>
        <p className="text-[10px] text-zinc-500 font-semibold tracking-wider uppercase mt-1">
          Monitoramento analítico de arbitragem matemática / Gma Betes V1.0
        </p>
      </div>

      {/* Grid de Estatísticas tipo Bloomberg */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div key={i} className="bg-[#080808] border border-[#121212] rounded-lg p-5 flex flex-col justify-between h-28 hover:border-[#1a1a1a] transition-all">
              <div className="flex justify-between items-start">
                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">
                  {stat.name}
                </span>
                <Icon className="w-3.5 h-3.5 text-zinc-600" />
              </div>
              <div>
                <div className={`text-xl font-black font-space tracking-tight text-white`}>
                  {stat.value}
                </div>
                {stat.desc ? (
                  <p className="text-[8px] text-zinc-600 font-mono tracking-wide mt-1">{stat.desc}</p>
                ) : (
                  <p className="text-[8px] text-zinc-600 font-mono tracking-wide mt-1">Status: Conectado</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Subseções */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Oportunidades Quentes */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider font-space">
              Oportunidades Quentes (Melhor Margem)
            </h2>
            <button 
              onClick={onNavigateToRadar}
              className="text-[9px] font-bold text-emerald-400 hover:text-emerald-300 transition-colors uppercase tracking-wider flex items-center gap-1 cursor-pointer"
            >
              <span>Ver Radar Completo</span>
              <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-3">
            {hotOpportunities.length === 0 ? (
              <div className="bg-[#080808] border border-[#121212] rounded-lg p-10 text-center text-zinc-600 text-xs">
                Nenhum sinal quente capturado. Atualize o radar ou importe odds via CSV.
              </div>
            ) : (
              hotOpportunities.map((op) => (
                <div 
                  key={op.id}
                  className="bg-[#080808] border border-[#121212] rounded-lg p-5 hover:border-[#1a1a1a] transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[9px] font-black text-emerald-400 bg-emerald-500/5 px-2 py-0.5 rounded border border-emerald-500/10 font-space tracking-wide">
                        +{op.marginPercent.toFixed(2)}% Margem
                      </span>
                      <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-wide">
                        {op.sport} — {op.league}
                      </span>
                    </div>
                    <h3 className="font-extrabold text-zinc-200 text-sm truncate tracking-tight">{op.eventName}</h3>
                    <p className="text-xs text-zinc-400 font-medium">{op.marketName}</p>
                  </div>

                  {/* Casas Envolvidas no sinal */}
                  <div className="flex items-center gap-2 bg-[#0c0c0c] border border-[#151515] rounded px-3 py-2">
                    <div className="flex flex-wrap gap-1.5">
                      {op.legs.map((leg, i) => (
                        <span key={i} className="text-[9px] text-zinc-300 font-bold bg-[#121212] border border-[#1a1a1a] px-2 py-0.5 rounded font-mono">
                          {leg.bookmakerName} ({leg.oddDecimal.toFixed(2)})
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Botão de Operação */}
                  <button 
                    onClick={() => onOpenCalculator(op)}
                    className="bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs px-4 py-2.5 rounded transition-all cursor-pointer text-center tracking-wide uppercase shrink-0"
                  >
                    Operar Sinal
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Listas estatísticas de mercado e bookmakers */}
        <div className="space-y-6">
          {/* Top Casas */}
          <div className="bg-[#080808] border border-[#121212] rounded-lg p-5 space-y-4">
            <h2 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider font-space">
              Casas mais Monitoradas
            </h2>
            <div className="space-y-3">
              {topBookmakers.length === 0 ? (
                <p className="text-xs text-zinc-700">Aguardando dados...</p>
              ) : (
                topBookmakers.map((book, i) => (
                  <div key={i} className="flex items-center justify-between text-xs border-b border-[#121212]/30 pb-2 last:border-0 last:pb-0">
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded bg-[#101010] text-zinc-500 flex items-center justify-center font-bold text-[9px] font-mono">
                        0{i + 1}
                      </span>
                      <span className="text-zinc-300 font-semibold">{book}</span>
                    </div>
                    <span className="text-[8px] font-black uppercase text-emerald-400 bg-emerald-500/5 px-2 py-0.5 rounded tracking-wider border border-emerald-500/10">
                      Sinal Ativo
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Top Mercados */}
          <div className="bg-[#080808] border border-[#121212] rounded-lg p-5 space-y-4">
            <h2 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider font-space">
              Mercados Mais Recorrentes
            </h2>
            <div className="space-y-3">
              {topMarkets.length === 0 ? (
                <p className="text-xs text-zinc-700">Aguardando dados...</p>
              ) : (
                topMarkets.map((market, i) => (
                  <div key={i} className="flex items-center justify-between text-xs border-b border-[#121212]/30 pb-2 last:border-0 last:pb-0">
                    <span className="text-zinc-300 font-semibold truncate max-w-[170px]">{market}</span>
                    <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-wider font-mono">
                      Arbitrado
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
