'use client';

import React, { useState } from 'react';
import { Bookmaker, BookmakerStatus, AuthorizedBookmaker } from '../types';
import { 
  Plus, 
  Edit, 
  X, 
  Upload, 
  Bookmark, 
  BookmarkCheck,
  Search,
  Wallet
} from 'lucide-react';

interface CasasScreenProps {
  bookmakers: Bookmaker[];
  authorizedBookmakers: AuthorizedBookmaker[];
  onUpdateBookmaker: (b: Bookmaker) => void;
  onCreateBookmaker: (b: Omit<Bookmaker, 'id'>) => void;
  onImportAuthorized: (csvData: { name: string; domain: string }[]) => void;
  onClearAuthorized: () => void;
}

export default function CasasScreen({
  bookmakers,
  authorizedBookmakers,
  onUpdateBookmaker,
  onCreateBookmaker,
  onImportAuthorized,
  onClearAuthorized
}: CasasScreenProps) {
  const [search, setSearch] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingBookmaker, setEditingBookmaker] = useState<Partial<Bookmaker> | null>(null);
  
  const [csvText, setCsvText] = useState('');
  const [csvFeedback, setCsvFeedback] = useState('');

  const filteredBookmakers = bookmakers.filter(b => 
    b.name.toLowerCase().includes(search.toLowerCase()) || 
    b.domain.toLowerCase().includes(search.toLowerCase())
  );

  const totalBalance = bookmakers.reduce((acc, curr) => acc + (curr.hasAccount ? curr.currentBalance : 0), 0);
  const activeBookmakersCount = bookmakers.filter(b => b.isActive).length;

  const handleOpenEdit = (b: Bookmaker) => {
    setEditingBookmaker(b);
    setShowEditModal(true);
  };

  const handleOpenCreate = () => {
    setEditingBookmaker({
      name: '',
      domain: '',
      status: 'desconhecida',
      hasAccount: false,
      currentBalance: 0,
      maxLimit: 0,
      avgWithdrawalTime: '',
      notes: '',
      isActive: true,
      isFavorite: false
    });
    setShowEditModal(true);
  };

  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBookmaker) return;

    if (!editingBookmaker.name || !editingBookmaker.domain) {
      alert('Preencha os campos obrigatórios.');
      return;
    }

    if ('id' in editingBookmaker) {
      onUpdateBookmaker(editingBookmaker as Bookmaker);
    } else {
      onCreateBookmaker(editingBookmaker as Omit<Bookmaker, 'id'>);
    }
    setShowEditModal(false);
    setEditingBookmaker(null);
  };

  const handleToggleFavorite = (b: Bookmaker) => {
    onUpdateBookmaker({ ...b, isFavorite: !b.isFavorite });
  };

  const handleToggleActive = (b: Bookmaker) => {
    onUpdateBookmaker({ ...b, isActive: !b.isActive });
  };

  const handleCsvImport = () => {
    if (!csvText) {
      setCsvFeedback('CSV sem conteúdo.');
      return;
    }

    try {
      const rows = csvText.split('\n');
      const data: { name: string; domain: string }[] = [];

      rows.forEach((row, i) => {
        const cols = row.split(',').map(c => c.replace(/"/g, '').trim());
        if (cols.length >= 2) {
          if (i === 0 && (cols[0].toLowerCase().includes('nome') || cols[1].toLowerCase().includes('dominio'))) {
            return;
          }
          if (cols[0] && cols[1]) {
            data.push({ name: cols[0], domain: cols[1].toLowerCase() });
          }
        }
      });

      if (data.length > 0) {
        onImportAuthorized(data);
        setCsvFeedback(`Sucesso! ${data.length} cadastradas.`);
        setCsvText('');
      } else {
        setCsvFeedback('Nenhum registro válido detectado. Formato: Nome, Dominio');
      }
    } catch (err) {
      setCsvFeedback('Erro no parse do CSV.');
    }
  };

  const getStatusBadge = (status: BookmakerStatus) => {
    switch (status) {
      case 'autorizada':
        return <span className="text-[9px] bg-emerald-500/5 text-emerald-400 border border-emerald-500/10 px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider">Autorizada</span>;
      case 'judicial':
        return <span className="text-[9px] bg-amber-500/5 text-amber-400 border border-amber-500/10 px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider">Judicial</span>;
      case 'bloqueada':
        return <span className="text-[9px] bg-red-500/5 text-red-400 border border-red-500/10 px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider">Bloqueada</span>;
      default:
        return <span className="text-[9px] bg-zinc-900 text-zinc-500 border border-zinc-800 px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider">Desconhecida</span>;
    }
  };

  return (
    <div className="space-y-6 select-none relative">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white font-space uppercase font-extrabold">Bancas & Plataformas</h1>
          <p className="text-[10px] text-zinc-500 font-semibold tracking-wider uppercase mt-1">
            Status regulatório nacional e liquidez de saldos operacionais
          </p>
        </div>

        <div className="flex gap-3">
          <div className="bg-[#080808] border border-[#121212] rounded px-4 py-2 flex items-center gap-3">
            <Wallet className="w-3.5 h-3.5 text-emerald-400" />
            <div>
              <span className="text-[8px] uppercase font-bold text-zinc-500 tracking-wider block font-mono">Banca Consolidada</span>
              <span className="text-sm font-extrabold text-zinc-100 font-space">R$ {totalBalance.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
            </div>
          </div>

          <button
            onClick={handleOpenCreate}
            className="bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs px-4 py-2.5 rounded transition-colors flex items-center gap-1.5 cursor-pointer uppercase tracking-wider"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Adicionar Casa</span>
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Tabela de Casas */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-[#080808] border border-[#121212] rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider font-space">Plataformas Conectadas ({activeBookmakersCount})</h2>
              
              <div className="relative w-48">
                <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-zinc-700" />
                <input
                  type="text"
                  placeholder="Filtro rápido..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-[#0c0c0c] border border-[#151515] rounded pl-8 pr-3 py-1.5 text-zinc-300 placeholder-zinc-700 focus:outline-none focus:border-zinc-800 text-xs font-medium"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#121212] text-zinc-500 uppercase tracking-wider font-bold text-[9px]">
                    <th className="pb-3 pl-2">Fav</th>
                    <th className="pb-3">Plataforma / Link</th>
                    <th className="pb-3">Status Reg.</th>
                    <th className="pb-3">Lançamento / Saldo</th>
                    <th className="pb-3">Limite Oper.</th>
                    <th className="pb-3 text-right pr-2">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#121212]/60">
                  {filteredBookmakers.map((book) => (
                    <tr key={book.id} className={`hover:bg-[#0c0c0c]/30 transition-colors ${!book.isActive ? 'opacity-40' : ''}`}>
                      <td className="py-3.5 pl-2">
                        <button 
                          onClick={() => handleToggleFavorite(book)}
                          className="text-zinc-600 hover:text-amber-400 transition-colors cursor-pointer"
                        >
                          {book.isFavorite ? (
                            <BookmarkCheck className="w-3.5 h-3.5 text-emerald-400 fill-emerald-500/5" />
                          ) : (
                            <Bookmark className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </td>
                      <td className="py-3.5 font-bold">
                        <span className="text-zinc-200 block text-xs">{book.name}</span>
                        <span className="text-[9px] text-zinc-500 block font-mono font-normal">{book.domain}</span>
                      </td>
                      <td className="py-3.5">{getStatusBadge(book.status)}</td>
                      <td className="py-3.5">
                        {book.hasAccount ? (
                          <>
                            <span className="text-zinc-200 font-bold block font-mono text-xs">R$ {book.currentBalance.toFixed(2)}</span>
                            <span className="text-[8px] text-zinc-600 font-bold uppercase tracking-wider block mt-0.5">Saque: {book.avgWithdrawalTime || 'N/A'}</span>
                          </>
                        ) : (
                          <span className="text-zinc-600 block">—</span>
                        )}
                      </td>
                      <td className="py-3.5 font-semibold text-zinc-400 font-mono">
                        {book.maxLimit > 0 ? `R$ ${book.maxLimit}` : 'Livre'}
                      </td>
                      <td className="py-3.5 text-right pr-2 space-x-2">
                        <button
                          onClick={() => handleToggleActive(book)}
                          className={`text-[9px] font-bold px-2 py-0.5 rounded cursor-pointer transition-colors ${
                            book.isActive ? 'bg-[#0f0f0f] border border-[#151515] text-zinc-500 hover:text-zinc-300' : 'bg-emerald-500/5 text-emerald-400 border border-emerald-500/10'
                          }`}
                        >
                          {book.isActive ? 'Pausar' : 'Ativar'}
                        </button>
                        <button 
                          onClick={() => handleOpenEdit(book)}
                          className="text-zinc-500 hover:text-white transition-colors cursor-pointer inline-block align-middle"
                        >
                          <Edit className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* CSV Import regulatório */}
        <div className="space-y-6">
          <div className="bg-[#080808] border border-[#121212] rounded-lg p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Upload className="w-3.5 h-3.5 text-emerald-400" />
              <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider font-space">
                Importar Casas Reguladas
              </h2>
            </div>
            
            <p className="text-[10px] text-zinc-600 leading-relaxed font-medium">
              Insira as linhas de CSV de casas regulamentadas no Brasil (formato: Nome, Dominio) para cruzar automaticamente com o radar.
            </p>

            <textarea
              rows={3}
              placeholder="Betano,betano.com&#10;Superbet,superbet.com"
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              className="w-full bg-[#0a0a0a] border border-[#151515] rounded p-2.5 text-[10px] text-zinc-300 focus:outline-none focus:border-zinc-800 resize-none font-mono"
            />

            {csvFeedback && (
              <div className="p-2 bg-emerald-500/5 border border-emerald-500/10 rounded text-[9px] font-bold text-emerald-400 font-mono">
                {csvFeedback}
              </div>
            )}

            <div className="flex gap-2">
              {authorizedBookmakers.length > 0 && (
                <button
                  onClick={onClearAuthorized}
                  className="flex-1 py-2 rounded text-[10px] font-bold text-red-400 hover:bg-red-500/5 transition-colors cursor-pointer border border-red-500/10 uppercase tracking-wider"
                >
                  Limpar
                </button>
              )}
              <button
                onClick={handleCsvImport}
                className="flex-1 bg-[#0f172a] border border-[#1e293b]/30 hover:border-[#38bdf8]/30 hover:text-[#38bdf8] text-zinc-300 text-[10px] font-bold py-2 rounded transition-all cursor-pointer uppercase tracking-wider"
              >
                Importar
              </button>
            </div>
          </div>

          {/* Listagem Reguladas */}
          <div className="bg-[#080808] border border-[#121212] rounded-lg p-5 space-y-3">
            <h2 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider font-space">
              Entidades Reguladas ({authorizedBookmakers.length})
            </h2>
            <div className="max-h-48 overflow-y-auto divide-y divide-[#121212]">
              {authorizedBookmakers.length === 0 ? (
                <p className="text-[9px] text-zinc-700 font-medium">Aguardando importações...</p>
              ) : (
                authorizedBookmakers.map((auth, idx) => (
                  <div key={idx} className="py-2 flex items-center justify-between text-[9px]">
                    <span className="text-zinc-400 font-semibold">{auth.name}</span>
                    <span className="text-zinc-600 font-mono">{auth.domain}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Modal de Edição */}
      {showEditModal && editingBookmaker && (
        <div className="absolute inset-0 bg-black/85 flex items-center justify-center p-4 z-50">
          <form onSubmit={handleSaveModal} className="w-full max-w-md bg-[#050505] border border-[#121212] rounded-lg p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#121212] pb-3">
              <h3 className="font-space font-bold text-xs uppercase tracking-wider text-white">
                {'id' in editingBookmaker ? 'Configurar Plataforma' : 'Nova Plataforma'}
              </h3>
              <button 
                type="button" 
                onClick={() => setShowEditModal(false)}
                className="w-7 h-7 hover:bg-zinc-900 text-zinc-600 hover:text-zinc-300 rounded flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-wide mb-1.5">Nome Comercial</label>
                  <input
                    type="text"
                    required
                    value={editingBookmaker.name}
                    onChange={(e) => setEditingBookmaker({ ...editingBookmaker, name: e.target.value })}
                    className="w-full bg-[#0a0a0a] border border-[#151515] rounded p-2.5 text-zinc-100 text-xs focus:outline-none focus:border-zinc-800"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-wide mb-1.5">Domínio Oficial</label>
                  <input
                    type="text"
                    required
                    placeholder="betano.com"
                    value={editingBookmaker.domain}
                    onChange={(e) => setEditingBookmaker({ ...editingBookmaker, domain: e.target.value })}
                    className="w-full bg-[#0a0a0a] border border-[#151515] rounded p-2.5 text-zinc-100 text-xs focus:outline-none focus:border-zinc-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-wide mb-1.5">Status Regulatório</label>
                  <select
                    value={editingBookmaker.status}
                    onChange={(e) => setEditingBookmaker({ ...editingBookmaker, status: e.target.value as BookmakerStatus })}
                    className="w-full bg-[#0a0a0a] border border-[#151515] rounded p-2.5 text-zinc-300 text-xs focus:outline-none"
                  >
                    <option value="autorizada">Autorizada</option>
                    <option value="judicial">Ação Judicial</option>
                    <option value="desconhecida">Desconhecida</option>
                    <option value="bloqueada">Bloqueada</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-wide mb-1.5">Tenho Conta?</label>
                  <select
                    value={editingBookmaker.hasAccount ? 'sim' : 'nao'}
                    onChange={(e) => setEditingBookmaker({ ...editingBookmaker, hasAccount: e.target.value === 'sim', currentBalance: e.target.value === 'sim' ? (editingBookmaker.currentBalance || 0) : 0 })}
                    className="w-full bg-[#0a0a0a] border border-[#151515] rounded p-2.5 text-zinc-300 text-xs focus:outline-none"
                  >
                    <option value="sim">Sim</option>
                    <option value="nao">Não</option>
                  </select>
                </div>
              </div>

              {editingBookmaker.hasAccount && (
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-wide mb-1.5">Saldo Disponível (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editingBookmaker.currentBalance}
                      onChange={(e) => setEditingBookmaker({ ...editingBookmaker, currentBalance: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-[#0a0a0a] border border-[#151515] rounded p-2.5 text-zinc-100 text-xs font-mono focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-wide mb-1.5">Tempo Saque</label>
                    <input
                      type="text"
                      placeholder="2h"
                      value={editingBookmaker.avgWithdrawalTime}
                      onChange={(e) => setEditingBookmaker({ ...editingBookmaker, avgWithdrawalTime: e.target.value })}
                      className="w-full bg-[#0a0a0a] border border-[#151515] rounded p-2.5 text-zinc-100 text-xs focus:outline-none"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-wide mb-1.5">Limite Máximo de Aposta</label>
                <input
                  type="number"
                  placeholder="Deixe 0 para ilimitado"
                  value={editingBookmaker.maxLimit || ''}
                  onChange={(e) => setEditingBookmaker({ ...editingBookmaker, maxLimit: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-[#0a0a0a] border border-[#151515] rounded p-2.5 text-zinc-100 text-xs font-mono focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-wide mb-1.5">Observações Operacionais</label>
                <textarea
                  rows={2}
                  value={editingBookmaker.notes}
                  onChange={(e) => setEditingBookmaker({ ...editingBookmaker, notes: e.target.value })}
                  className="w-full bg-[#0a0a0a] border border-[#151515] rounded p-2.5 text-zinc-300 text-xs focus:outline-none resize-none font-mono"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-3 border-t border-[#121212]">
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="flex-1 py-2.5 rounded text-xs font-bold text-zinc-500 bg-[#0c0c0c] hover:bg-[#121212] transition-colors cursor-pointer text-center uppercase tracking-wider"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 rounded text-xs font-black bg-emerald-500 hover:bg-emerald-400 text-black transition-all cursor-pointer text-center uppercase tracking-wider"
              >
                Salvar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
