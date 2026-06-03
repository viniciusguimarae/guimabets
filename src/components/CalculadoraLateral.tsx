'use client';

import React, { useState, useEffect } from 'react';
import { SurebetOpportunity, Bookmaker, ExecutedBetLeg, ExecutedBet } from '../types';
import { SurebetEngine } from '../services/surebetEngine';
import { X, Calculator, ShieldAlert, Award, Save, RefreshCw } from 'lucide-react';

interface CalculadoraLateralProps {
  opportunity: SurebetOpportunity | null;
  onClose: () => void;
  bookmakers: Bookmaker[];
  defaultStake: number;
  onSaveBet: (bet: Omit<ExecutedBet, 'id' | 'createdAt'>) => void;
}

export default function CalculadoraLateral({ 
  opportunity, 
  onClose, 
  bookmakers,
  defaultStake,
  onSaveBet
}: CalculadoraLateralProps) {
  const [stakeTotal, setStakeTotal] = useState<number>(defaultStake);
  const [bancaTotal, setBancaTotal] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (opportunity) {
      setNotes(`Arbitragem: ${opportunity.eventName} - ${opportunity.marketName}`);
      setSavedSuccess(false);
    }
  }, [opportunity]);

  if (!opportunity) return null;

  const calculationOdds = opportunity.legs.map(leg => ({
    selectionId: leg.selectionId,
    oddDecimal: leg.oddDecimal
  }));

  const calcResult = SurebetEngine.calculate(calculationOdds, stakeTotal);

  const legsWithLimits = opportunity.legs.map(leg => {
    const calcLeg = calcResult.legs.find(cl => cl.selectionId === leg.selectionId);
    const bookmaker = bookmakers.find(b => b.id === leg.bookmakerId);
    
    const stakeSugerida = calcLeg ? calcLeg.recommendedStake : 0;
    const retornoSugerido = calcLeg ? calcLeg.expectedReturn : 0;
    const isExceedingLimit = bookmaker && bookmaker.maxLimit > 0 && stakeSugerida > bookmaker.maxLimit;

    return {
      ...leg,
      recommendedStake: stakeSugerida,
      expectedReturn: retornoSugerido,
      bookmakerLimit: bookmaker ? bookmaker.maxLimit : 0,
      isExceedingLimit,
      isNotAuthorized: leg.bookmakerStatus !== 'autorizada'
    };
  });

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      onSaveBet({
        eventName: opportunity.eventName,
        marketName: opportunity.marketName,
        totalStake: stakeTotal,
        returnExpected: calcResult.expectedReturn,
        profitExpected: calcResult.expectedProfit,
        legs: legsWithLimits.map(leg => ({
          selectionName: leg.selectionName,
          bookmakerName: leg.bookmakerName,
          oddDecimal: leg.oddDecimal,
          stake: leg.recommendedStake
        })),
        notes: notes || 'Arbitragem de alta fidelidade.',
        status: 'pendente',
        actualResult: 'pendente'
      });
      setSaving(false);
      setSavedSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1000);
    }, 500);
  };

  return (
    <div className="w-96 bg-[#050505] border-l border-[#121212] h-full flex flex-col shrink-0 select-none animate-in slide-in-from-right duration-200 relative z-30">
      
      {/* Header */}
      <div className="p-5 border-b border-[#121212] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calculator className="w-4 h-4 text-emerald-400" />
          <span className="font-space font-bold text-xs uppercase tracking-wider text-white">Painel de Cálculo</span>
        </div>
        <button 
          onClick={onClose}
          className="w-7 h-7 hover:bg-zinc-900 rounded flex items-center justify-center text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Conteúdo */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Sinal Monitorado */}
        <div className="bg-[#080808] border border-[#121212] rounded p-4">
          <span className="text-[8px] font-black text-emerald-400 bg-emerald-500/5 px-2 py-0.5 rounded border border-emerald-500/10 uppercase tracking-wider">
            {opportunity.sport}
          </span>
          <h3 className="font-extrabold text-xs text-zinc-200 truncate mt-2">{opportunity.eventName}</h3>
          <p className="text-[10px] text-zinc-500 font-medium mt-0.5">{opportunity.marketName}</p>
        </div>

        {/* Parâmetros de Entrada */}
        <div className="space-y-3">
          <div>
            <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Investimento de Entrada (Total)</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-zinc-600 text-xs font-bold font-mono">R$</span>
              <input
                type="number"
                min="1"
                value={stakeTotal}
                onChange={(e) => setStakeTotal(Math.max(1, parseFloat(e.target.value) || 0))}
                className="w-full bg-[#0a0a0a] border border-[#151515] rounded pl-8 pr-4 py-2.5 text-zinc-200 text-xs font-mono font-bold focus:outline-none focus:border-zinc-800"
              />
            </div>
          </div>

          <div>
            <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Banca Geral (Opcional)</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-zinc-600 text-xs font-bold font-mono">R$</span>
              <input
                type="number"
                placeholder="Ex: 5000"
                value={bancaTotal}
                onChange={(e) => setBancaTotal(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-[#151515] rounded pl-8 pr-4 py-2.5 text-zinc-300 text-xs font-mono focus:outline-none focus:border-zinc-800"
              />
            </div>
            {bancaTotal && parseFloat(bancaTotal) > 0 && (
              <div className="text-[8px] text-zinc-600 font-bold uppercase tracking-wider mt-1.5 flex justify-between">
                <span>Comprometimento:</span>
                <span>{((stakeTotal / parseFloat(bancaTotal)) * 100).toFixed(1)}% da banca</span>
              </div>
            )}
          </div>
        </div>

        {/* Retornos e Métricas Consolidadas */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-emerald-500/5 border border-emerald-500/10 rounded p-3 text-center">
            <span className="text-[8px] font-bold text-emerald-500 uppercase tracking-wider block">ROI Seguro</span>
            <div className="text-base font-black font-space text-emerald-400 mt-0.5">
              +{opportunity.marginPercent.toFixed(2)}%
            </div>
          </div>
          <div className="bg-[#080808] border border-[#121212] rounded p-3 text-center">
            <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-wider block">Retorno Líquido</span>
            <div className="text-base font-black font-space text-white mt-0.5">
              R$ {calcResult.expectedProfit.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Divisão de Stakes por Seleção */}
        <div className="space-y-2.5">
          <span className="block text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Divisão Proporcional de Stakes</span>
          <div className="space-y-2">
            {legsWithLimits.map((leg, idx) => (
              <div key={idx} className="bg-[#080808] border border-[#121212] rounded p-3 space-y-2">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-bold text-zinc-300">{leg.selectionName}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] text-zinc-500">Odd:</span>
                    <span className="text-[10px] font-black text-[#38BDF8] bg-[#38BDF8]/5 border border-[#38BDF8]/10 px-1.5 py-0.5 rounded font-mono">
                      {leg.oddDecimal.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] pt-1">
                  <div className="flex flex-col">
                    <span className="text-zinc-500 font-bold">{leg.bookmakerName}</span>
                    {leg.isNotAuthorized && (
                      <span className="text-[7px] font-bold text-amber-500 uppercase mt-0.5 font-mono">Não Regulada</span>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-black font-mono text-zinc-200">
                      R$ {leg.recommendedStake.toFixed(2)}
                    </div>
                    <span className="text-[8px] text-zinc-600 font-semibold font-mono">
                      Retorno: R$ {leg.expectedReturn.toFixed(2)}
                    </span>
                  </div>
                </div>

                {leg.isExceedingLimit && (
                  <div className="mt-1.5 p-2 bg-red-950/10 border border-red-900/20 rounded flex items-center gap-1.5 text-[8px] text-red-400 font-bold uppercase tracking-wider font-mono">
                    <ShieldAlert className="w-3 h-3 text-red-500 shrink-0" />
                    <span>Excede limite (Lim: R$ {leg.bookmakerLimit})</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Notas */}
        <div>
          <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Notas do Registro</label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full bg-[#0a0a0a] border border-[#151515] rounded p-2.5 text-[10px] text-zinc-300 focus:outline-none focus:border-zinc-800 resize-none font-mono"
          />
        </div>
      </div>

      {/* Ação */}
      <div className="p-5 border-t border-[#121212] bg-[#050505]">
        <button
          onClick={handleSave}
          disabled={saving || savedSuccess}
          className={`w-full py-3 rounded text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-all ${
            savedSuccess 
              ? 'bg-emerald-500 text-black' 
              : 'bg-emerald-500 hover:bg-emerald-400 text-black active:bg-emerald-600'
          }`}
        >
          {saving ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : savedSuccess ? (
            <>
              <Award className="w-3.5 h-3.5" />
              <span>Entrada Executada!</span>
            </>
          ) : (
            <>
              <Save className="w-3.5 h-3.5" />
              <span>Registrar Execução</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
