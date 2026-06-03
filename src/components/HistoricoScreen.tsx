'use client';

import React, { useState } from 'react';
import { ExecutedBet, BetStatus, BetResult } from '../types';
import { 
  History, 
  Trash2, 
  Edit,
  TrendingUp,
  X
} from 'lucide-react';

interface HistoricoScreenProps {
  history: ExecutedBet[];
  onUpdateBet: (bet: ExecutedBet) => void;
  onDeleteBet: (id: string) => void;
}

export default function HistoricoScreen({
  history,
  onUpdateBet,
  onDeleteBet
}: HistoricoScreenProps) {
  const [filterStatus, setFilterStatus] = useState<string>('todos');
  const [selectedBet, setSelectedBet] = useState<ExecutedBet | null>(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const [actualProfit, setActualProfit] = useState<number>(0);
  const [actualResult, setActualResult] = useState<BetResult>('pendente');

  const filteredHistory = history.filter(bet => {
    if (filterStatus === 'todos') return true;
    return bet.status === filterStatus;
  });

  const totalInvested = history.reduce((acc, curr) => acc + curr.totalStake, 0);
  
  const totalProfitReal = history.reduce((acc, curr) => {
    if (curr.status === 'finalizada' && curr.actualProfit !== undefined) {
      return acc + curr.actualProfit;
    }
    return acc;
  }, 0);

  const pendingCount = history.filter(b => b.status === 'pendente').length;
  const roiReal = totalInvested > 0 ? (totalProfitReal / totalInvested) * 100 : 0;

  const handleOpenResultModal = (bet: ExecutedBet) => {
    setSelectedBet(bet);
    setActualResult(bet.actualResult || 'pendente');
    setActualProfit(bet.actualProfit !== undefined ? bet.actualProfit : bet.profitExpected);
    setShowResultModal(true);
  };

  const handleSaveResult = () => {
    if (!selectedBet) return;

    let finalStatus: BetStatus = 'finalizada';
    if (actualResult === 'pendente') finalStatus = 'pendente';
    if (actualResult === 'cancelada') finalStatus = 'cancelada';

    onUpdateBet({
      ...selectedBet,
      actualResult,
      actualProfit,
      status: finalStatus
    });

    setShowResultModal(false);
    setSelectedBet(null);
  };

  const getStatusBadge = (status: BetStatus) => {
    switch (status) {
      case 'finalizada':
        return <span className="text-[9px] bg-emerald-500/5 text-emerald-400 border border-emerald-500/10 px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider">Finalizada</span>;
      case 'cancelada':
        return <span className="text-[9px] bg-zinc-900 text-zinc-500 border border-zinc-800 px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider">Cancelada</span>;
      case 'erro operacional':
        return <span className="text-[9px] bg-red-500/5 text-red-400 border border-red-500/10 px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider">Erro Op.</span>;
      default:
        return <span className="text-[9px] bg-amber-500/5 text-amber-400 border border-amber-500/10 px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider">Pendente</span>;
    }
  };

  const getResultBadge = (result: BetResult) => {
    switch (result) {
      case 'ganhou':
        return <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-wider font-mono">Retorno Líquido</span>;
      case 'perdeu':
        return <span className="text-[9px] text-red-400 font-bold uppercase tracking-wider font-mono">Perda Total</span>;
      case 'reembolsada':
        return <span className="text-[9px] text-blue-400 font-bold uppercase tracking-wider font-mono">Reembolsada</span>;
      case 'cancelada':
        return <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider font-mono">Cancelada</span>;
      default:
        return <span className="text-[9px] text-amber-400 font-bold uppercase tracking-wider font-mono">Pendente</span>;
    }
  };

  return (
    <div className="space-y-6 select-none relative">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white font-space uppercase font-extrabold">Histórico de Operações</h1>
          <p className="text-[10px] text-zinc-500 font-semibold tracking-wider uppercase mt-1">
            Auditoria interna de arbitragens executadas no terminal
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="bg-[#080808] border border-[#121212] rounded px-4 py-2 flex items-center gap-3">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            <div>
              <span className="text-[8px] uppercase font-bold text-zinc-500 tracking-wider block font-mono">Lucro Líquido Real</span>
              <span className={`text-sm font-extrabold font-mono ${totalProfitReal >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                R$ {totalProfitReal.toFixed(2)} ({roiReal.toFixed(1)}% ROI)
              </span>
            </div>
          </div>

          <div className="bg-[#080808] border border-[#121212] rounded px-4 py-2 flex items-center gap-3">
            <History className="w-3.5 h-3.5 text-zinc-500" />
            <div>
              <span className="text-[8px] uppercase font-bold text-zinc-500 tracking-wider block font-mono">Pendentes / Total</span>
              <span className="text-sm font-extrabold text-zinc-100 font-mono">
                {pendingCount} / {history.length}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-[#080808] border border-[#121212] rounded-lg p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider font-space">Sinais Consolidados</h2>
          
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-[#0c0c0c] border border-[#151515] rounded px-3 py-1.5 text-xs text-zinc-400 focus:outline-none"
          >
            <option value="todos">Todos Status</option>
            <option value="pendente">Pendente</option>
            <option value="finalizada">Finalizada</option>
            <option value="cancelada">Cancelada</option>
            <option value="erro operacional">Erro Operacional</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          {filteredHistory.length === 0 ? (
            <div className="p-8 text-center text-zinc-700 text-xs">
              Nenhuma arbitragem liquidada no histórico.
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#121212] text-zinc-500 uppercase tracking-wider font-bold text-[9px]">
                  <th className="pb-3 pl-2">Data / Hora</th>
                  <th className="pb-3">Evento / Mercado</th>
                  <th className="pb-3">Distribuição Proporcional</th>
                  <th className="pb-3">Investimento</th>
                  <th className="pb-3">Retorno Real</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3 text-right pr-2">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#121212]/60">
                {filteredHistory.map((bet) => (
                  <tr key={bet.id} className="hover:bg-[#0c0c0c]/30 transition-colors">
                    <td className="py-4 pl-2 text-zinc-500 font-mono text-[10px]">
                      {new Date(bet.createdAt).toLocaleDateString()}<br/>
                      <span className="text-[9px] text-zinc-600">{new Date(bet.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    </td>
                    <td className="py-4 font-bold">
                      <span className="text-zinc-200 block text-xs truncate max-w-[200px]">{bet.eventName}</span>
                      <span className="text-[9px] text-zinc-500 block font-normal">{bet.marketName}</span>
                    </td>
                    <td className="py-4 font-mono text-[10px]">
                      <div className="space-y-1">
                        {bet.legs.map((leg, idx) => (
                          <span key={idx} className="block text-zinc-400 font-medium">
                            {leg.selectionName} &rarr; <strong className="text-zinc-300">{leg.bookmakerName}</strong> ({leg.oddDecimal.toFixed(2)}) - R$ {leg.stake}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-4 font-bold text-zinc-300 font-mono text-xs">
                      R$ {bet.totalStake.toFixed(2)}
                    </td>
                    <td className="py-4">
                      {bet.status === 'finalizada' ? (
                        <>
                          <span className={`font-black font-mono text-xs block ${(bet.actualProfit || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            R$ {(bet.actualProfit || 0).toFixed(2)}
                          </span>
                          <span className="block mt-0.5">{getResultBadge(bet.actualResult)}</span>
                        </>
                      ) : (
                        <>
                          <span className="text-zinc-500 font-semibold block font-mono text-xs">R$ {bet.profitExpected.toFixed(2)}</span>
                          <span className="text-[8px] text-amber-500 font-bold uppercase tracking-wider block">Pendente</span>
                        </>
                      )}
                    </td>
                    <td className="py-4">{getStatusBadge(bet.status)}</td>
                    <td className="py-4 text-right pr-2 space-x-2">
                      <button
                        onClick={() => handleOpenResultModal(bet)}
                        className="p-1 text-zinc-500 hover:text-emerald-400 transition-colors cursor-pointer inline-block"
                        title="Liquidar Perna"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onDeleteBet(bet.id)}
                        className="p-1 text-zinc-600 hover:text-red-400 transition-colors cursor-pointer inline-block"
                        title="Expurgar Registro"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal Ajustar Resultado */}
      {showResultModal && selectedBet && (
        <div className="absolute inset-0 bg-black/85 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-sm bg-[#050505] border border-[#121212] rounded-lg p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#121212] pb-3">
              <h3 className="font-space font-bold text-xs uppercase tracking-wider text-white">
                Definir Fechamento
              </h3>
              <button 
                type="button" 
                onClick={() => { setShowResultModal(false); setSelectedBet(null); }}
                className="w-7 h-7 hover:bg-zinc-900 text-zinc-600 hover:text-zinc-300 rounded flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="font-extrabold text-xs text-zinc-200">{selectedBet.eventName}</h4>
                <p className="text-[9px] text-zinc-500 mt-0.5">{selectedBet.marketName}</p>
              </div>

              <div>
                <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-wide mb-1.5">Resultado da Operação</label>
                <select
                  value={actualResult}
                  onChange={(e) => {
                    const res = e.target.value as BetResult;
                    setActualResult(res);
                    if (res === 'ganhou') {
                      setActualProfit(selectedBet.profitExpected);
                    } else if (res === 'perdeu') {
                      setActualProfit(-selectedBet.totalStake);
                    } else if (res === 'reembolsada' || res === 'cancelada') {
                      setActualProfit(0);
                    }
                  }}
                  className="w-full bg-[#0a0a0a] border border-[#151515] rounded p-2.5 text-zinc-300 text-xs focus:outline-none"
                >
                  <option value="pendente">Pendente / Aberto</option>
                  <option value="ganhou">Ganhou (Surebet realizada com sucesso)</option>
                  <option value="perdeu">Perdeu (Erro de odd/Limitação ou cancelamento de perna)</option>
                  <option value="reembolsada">Reembolsada (Aposta anulada na casa)</option>
                  <option value="cancelada">Cancelada</option>
                </select>
              </div>

              {actualResult !== 'pendente' && (
                <div>
                  <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-wide mb-1.5">Resultado Líquido Final (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={actualProfit}
                    onChange={(e) => setActualProfit(parseFloat(e.target.value) || 0)}
                    className="w-full bg-[#0a0a0a] border border-[#151515] rounded p-2.5 text-zinc-100 text-xs font-mono focus:outline-none focus:border-zinc-800"
                  />
                  <p className="text-[8px] text-zinc-600 mt-1 font-mono">
                    Margem teórica projetada: R$ {selectedBet.profitExpected.toFixed(2)}
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-3 border-t border-[#121212]">
              <button
                type="button"
                onClick={() => { setShowResultModal(false); setSelectedBet(null); }}
                className="flex-1 py-2.5 rounded text-xs font-bold text-zinc-500 bg-[#0c0c0c] hover:bg-[#121212] transition-colors cursor-pointer text-center uppercase tracking-wider"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveResult}
                className="flex-1 py-2.5 rounded text-xs font-black bg-emerald-500 hover:bg-emerald-400 text-black transition-all cursor-pointer text-center uppercase tracking-wider"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
