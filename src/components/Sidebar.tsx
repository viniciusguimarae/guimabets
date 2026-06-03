'use client';

import React from 'react';
import { 
  LayoutDashboard, 
  Radar, 
  Building2, 
  History, 
  Settings, 
  Zap 
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function Sidebar({ activeTab, setActiveTab }: SidebarProps) {
  const menuItems = [
    { id: 'dashboard', name: 'Visão Geral', icon: LayoutDashboard },
    { id: 'radar', name: 'Radar Surebets', icon: Radar },
    { id: 'casas', name: 'Casas Monitoradas', icon: Building2 },
    { id: 'historico', name: 'Histórico Operacional', icon: History },
    { id: 'configuracoes', name: 'Configurações', icon: Settings },
  ];

  return (
    <aside className="w-60 bg-[#080808] border-r border-[#151515] flex flex-col h-full shrink-0 select-none">
      {/* Brand logo textual premium com Space Grotesk */}
      <div className="p-6 border-b border-[#121212] flex items-center gap-2.5">
        <div className="w-7 h-7 rounded bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
          <Zap className="w-3.5 h-3.5 fill-current" />
        </div>
        <span className="font-space font-extrabold text-sm tracking-tight text-white uppercase">
          Gma<span className="text-emerald-400"> Betes</span>
        </span>
      </div>

      {/* Itens do Menu */}
      <nav className="flex-1 px-3 py-6 space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded text-xs font-semibold tracking-wide transition-all duration-150 cursor-pointer ${
                isActive 
                  ? 'bg-emerald-500/5 text-emerald-400 border border-emerald-500/10 pl-2.5' 
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-[#0c0c0c] pl-3'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-400' : 'text-zinc-600'}`} />
              <span>{item.name}</span>
            </button>
          );
        })}
      </nav>

      {/* Rodapé decorativo do terminal privado */}
      <div className="p-4 border-t border-[#121212] bg-[#060606]/40 text-center">
        <span className="text-[8px] font-mono font-bold text-zinc-600 uppercase tracking-widest block">
          TERMINAL PESSOAL
        </span>
      </div>
    </aside>
  );
}
