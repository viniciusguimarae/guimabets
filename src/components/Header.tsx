'use client';

import React, { useState, useEffect } from 'react';
import { Bell, RefreshCw, AlertTriangle, Info, CheckCircle2, X } from 'lucide-react';
import { Alert } from '../types';

interface HeaderProps {
  onRefresh: () => void;
  isRefreshing: boolean;
  alerts: Alert[];
  onMarkAlertRead: (id: string) => void;
  onMarkAllAlertsRead: () => void;
  lastFetchTime: Date | null;
}

export default function Header({ 
  onRefresh, 
  isRefreshing, 
  alerts, 
  onMarkAlertRead, 
  onMarkAllAlertsRead,
  lastFetchTime
}: HeaderProps) {
  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);
  const [timeAgo, setTimeAgo] = useState<string>('Nunca');

  const unreadAlerts = alerts.filter(a => !a.read);

  useEffect(() => {
    if (!lastFetchTime) {
      setTimeAgo('Nunca');
      return;
    }

    const updateCounter = () => {
      const now = new Date();
      const diffMs = now.getTime() - lastFetchTime.getTime();
      const diffSec = Math.floor(diffMs / 1000);
      
      if (diffSec < 5) {
        setTimeAgo('Agora mesmo');
      } else if (diffSec < 60) {
        setTimeAgo(`há ${diffSec}s`);
      } else {
        const diffMin = Math.floor(diffSec / 60);
        setTimeAgo(`há ${diffMin}m ${diffSec % 60}s`);
      }
    };

    updateCounter();
    const interval = setInterval(updateCounter, 1000);
    return () => clearInterval(interval);
  }, [lastFetchTime]);

  const getAlertIcon = (type: Alert['type']) => {
    switch (type) {
      case 'nova_surebet':
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
      case 'casa_nao_autorizada':
      case 'stake_excedida':
        return <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />;
      case 'erro_provider':
      case 'oportunidade_expirada':
        return <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />;
      default:
        return <Info className="w-3.5 h-3.5 text-blue-400 shrink-0" />;
    }
  };

  return (
    <header className="h-14 bg-[#030303]/80 backdrop-blur border-b border-[#121212] px-8 flex items-center justify-between shrink-0 select-none relative z-40">
      {/* Status da Varredura */}
      <div className="flex items-center gap-4 text-[10px] text-zinc-500">
        <div className="flex items-center gap-2">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
          </span>
          <span className="font-bold tracking-wide uppercase text-zinc-400">VARREDURA EM TEMPO REAL ATIVA</span>
          <span className="text-zinc-600 font-mono">| {timeAgo}</span>
        </div>
        
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#0a0a0a] border border-[#151515] text-[9px] font-bold text-zinc-400 hover:text-emerald-400 hover:border-emerald-500/20 transition-all uppercase tracking-wider disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
          <span>{isRefreshing ? 'CAPTURA ATIVA' : 'RECARREGAR FEED'}</span>
        </button>
      </div>

      {/* Alertas */}
      <div className="flex items-center gap-4 relative">
        <button
          onClick={() => setShowNotificationDropdown(!showNotificationDropdown)}
          className="relative w-8 h-8 rounded border border-[#121212] bg-[#050505] flex items-center justify-center text-zinc-500 hover:text-zinc-300 hover:border-zinc-800 transition-colors cursor-pointer"
        >
          <Bell className="w-3.5 h-3.5" />
          {unreadAlerts.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 text-black text-[8px] font-black rounded-full flex items-center justify-center font-space">
              {unreadAlerts.length}
            </span>
          )}
        </button>

        {/* Dropdown de Alertas */}
        {showNotificationDropdown && (
          <div className="absolute right-0 top-10 w-76 bg-[#080808] border border-[#151515] rounded-lg shadow-2xl overflow-hidden py-1">
            <div className="flex items-center justify-between px-4 py-2 border-b border-[#121212] bg-[#0b0b0b]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">ALERTAS OPERACIONAIS ({unreadAlerts.length})</span>
              {unreadAlerts.length > 0 && (
                <button 
                  onClick={onMarkAllAlertsRead}
                  className="text-[9px] font-bold uppercase text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
                >
                  Limpar
                </button>
              )}
            </div>
            
            <div className="max-h-64 overflow-y-auto divide-y divide-[#121212]">
              {alerts.length === 0 ? (
                <div className="p-4 text-center text-zinc-600 text-[10px] font-medium tracking-wide">
                  NENHUM ALERTA EMITIDO
                </div>
              ) : (
                alerts.map((alert) => (
                  <div 
                    key={alert.id} 
                    className={`p-3 flex gap-2.5 text-[10px] transition-colors ${alert.read ? 'opacity-50 bg-[#080808]' : 'bg-emerald-500/5'}`}
                  >
                    {getAlertIcon(alert.type)}
                    <div className="flex-1 min-w-0">
                      <p className="text-zinc-300 font-medium leading-relaxed">{alert.message}</p>
                      <span className="text-[8px] font-mono text-zinc-600 block mt-1">
                        {new Date(alert.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                    {!alert.read && (
                      <button
                        onClick={() => onMarkAlertRead(alert.id)}
                        className="text-zinc-600 hover:text-zinc-300 shrink-0 self-start cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
