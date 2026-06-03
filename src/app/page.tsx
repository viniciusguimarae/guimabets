'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { SurebetOpportunity, Bookmaker, ExecutedBet, Alert, UserSettings, AuthorizedBookmaker } from '../types';
import { DatabaseService } from '../services/db';
import { SurebetEngine } from '../services/surebetEngine';
import { MockOddsProvider, CsvImportProvider } from '../services/providers';

// Componentes da Interface
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import CalculadoraLateral from '../components/CalculadoraLateral';
import DashboardScreen from '../components/DashboardScreen';
import RadarScreen from '../components/RadarScreen';
import CasasScreen from '../components/CasasScreen';
import HistoricoScreen from '../components/HistoricoScreen';
import ConfiguracoesScreen from '../components/ConfiguracoesScreen';

// Ícones auxiliares
import { ShieldAlert, Layers, Play, Zap, FileSpreadsheet, PlusCircle } from 'lucide-react';

export default function Home() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [settings, setSettings] = useState<UserSettings | null>(null);
  
  // Dados operacionais
  const [bookmakers, setBookmakers] = useState<Bookmaker[]>([]);
  const [authorizedBookmakers, setAuthorizedBookmakers] = useState<AuthorizedBookmaker[]>([]);
  const [history, setHistory] = useState<ExecutedBet[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [opportunities, setOpportunities] = useState<SurebetOpportunity[]>([]);
  
  // Status de controle
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null);
  const [selectedOpportunity, setSelectedOpportunity] = useState<SurebetOpportunity | null>(null);
  const [loading, setLoading] = useState(true);

  // --- CARREGAMENTO DE DADOS ---
  const loadData = useCallback(() => {
    const userSettings = DatabaseService.getSettings();
    setSettings(userSettings);

    const userBookmakers = DatabaseService.getBookmakers();
    setBookmakers(userBookmakers);

    const authBookmakers = DatabaseService.getAuthorizedBookmakers();
    setAuthorizedBookmakers(authBookmakers);

    const userHistory = DatabaseService.getExecutedBets();
    setHistory(userHistory);

    const userAlerts = DatabaseService.getAlerts();
    setAlerts(userAlerts);
  }, []);

  useEffect(() => {
    loadData();
    setLoading(false);
  }, [loadData]);

  // --- MOTOR DE PROCESSO DE ODDS & SUREBETS ---
  const calculateAndRefreshRadar = useCallback(() => {
    if (!settings) return;

    const events = DatabaseService.getEvents();
    const markets = DatabaseService.getMarkets();
    const selections = DatabaseService.getSelections();
    const odds = DatabaseService.getOddsSnapshots();

    // Cruzar dados no Engine
    const { opportunities: newOps, alerts: engineAlerts } = SurebetEngine.findOpportunities(
      events,
      markets,
      selections,
      odds,
      bookmakers,
      settings
    );

    setOpportunities(newOps);

    // Salvar alertas detectados pelo motor
    engineAlerts.forEach(msg => {
      const alertsList = DatabaseService.getAlerts();
      if (!alertsList.some(a => a.message === msg)) {
        DatabaseService.addAlert('mercado_incompleto', msg);
      }
    });

    // Se encontramos novas surebets acima da margem mínima que não tínhamos alertas, avisar o usuário
    newOps.forEach(op => {
      if (op.marginPercent >= settings.minMargin) {
        const msg = `Surebet disponível: ${op.eventName} (${op.marketName}) com +${op.marginPercent}% de lucro seguro!`;
        const alertsList = DatabaseService.getAlerts();
        if (!alertsList.some(a => a.message === msg)) {
          DatabaseService.addAlert('nova_surebet', msg);
        }
      }
    });

    // Atualizar estado de alertas
    setAlerts(DatabaseService.getAlerts());
  }, [settings, bookmakers]);

  // --- SINCRONIZAÇÃO DE DADOS (PROVIDERS) ---
  const handleSyncFeed = useCallback(async () => {
    if (!settings) return;
    
    setIsRefreshing(true);
    DatabaseService.addProviderLog('RadarSync', 'rodando', 'Iniciando captura de feeds de dados.');

    try {
      let combinedOddsCount = 0;

      // 1. Se Mock Data estiver ativo
      if (settings.mockEnabled) {
        const mockProvider = new MockOddsProvider(true);
        const raw = await mockProvider.fetchRawData();
        const evs = mockProvider.parseEvents(raw);
        const mks = mockProvider.parseMarkets(raw);
        const sels = mockProvider.getSelectionsForMarkets(mks);
        const odds = mockProvider.parseOdds(raw);

        DatabaseService.saveOddsBatch({
          events: evs,
          markets: mks,
          selections: sels,
          odds: odds
        });

        combinedOddsCount += odds.length;
        DatabaseService.addProviderLog('MockOddsProvider', 'sucesso', `Alimentação de ${odds.length} odds de simulação concluída.`);
      }

      // Recalcular e atualizar timestamp
      calculateAndRefreshRadar();
      setLastFetchTime(new Date());
      DatabaseService.addProviderLog('RadarSync', 'sucesso', `Processamento matemático finalizado. Total de odds: ${combinedOddsCount}.`);
    } catch (err: any) {
      DatabaseService.addProviderLog('RadarSync', 'erro', `Erro ao sincronizar feeds: ${err.message}`);
      DatabaseService.addAlert('erro_provider', `Falha na sincronização dos provedores: ${err.message}`);
      setAlerts(DatabaseService.getAlerts());
    } finally {
      setIsRefreshing(false);
    }
  }, [settings, calculateAndRefreshRadar]);

  // Rodar feed automático na primeira carga
  useEffect(() => {
    if (settings) {
      const t = setTimeout(() => {
        handleSyncFeed();
      }, 500);
      return () => clearTimeout(t);
    }
  }, [settings, handleSyncFeed]);

  // --- OPERAÇÕES DA APLICAÇÃO ---
  const handleUpdateSettings = (newSettings: UserSettings) => {
    const updated = DatabaseService.updateSettings(newSettings);
    setSettings(updated);
    setTimeout(() => {
      calculateAndRefreshRadar();
    }, 100);
  };

  const handleUpdateBookmaker = (updated: Bookmaker) => {
    const list = DatabaseService.updateBookmaker(updated);
    setBookmakers(list);
    calculateAndRefreshRadar();
  };

  const handleCreateBookmaker = (input: Omit<Bookmaker, 'id'>) => {
    const list = DatabaseService.createBookmaker(input);
    setBookmakers(list);
    calculateAndRefreshRadar();
  };

  const handleImportAuthorized = (csvData: { name: string; domain: string }[]) => {
    DatabaseService.importAuthorizedBookmakers(csvData);
    setAuthorizedBookmakers(DatabaseService.getAuthorizedBookmakers());
    
    // Atualizar bookmakers locais cruzando os status regulatórios com os domínios
    const updatedBookmakers = bookmakers.map(b => {
      const match = csvData.find(c => c.domain === b.domain.toLowerCase());
      if (match) {
        return { ...b, status: 'autorizada' as const };
      }
      return b;
    });

    updatedBookmakers.forEach(b => {
      DatabaseService.updateBookmaker(b);
    });

    setBookmakers(DatabaseService.getBookmakers());
    calculateAndRefreshRadar();
  };

  const handleClearAuthorized = () => {
    DatabaseService.clearAuthorizedBookmakers();
    setAuthorizedBookmakers([]);
  };

  const handleSaveExecutedBet = (bet: Omit<ExecutedBet, 'id' | 'createdAt'>) => {
    const list = DatabaseService.saveExecutedBet(bet);
    setHistory(list);

    // Ajustar saldo das casas de apostas proporcionalmente ao stake investido em cada perna
    bet.legs.forEach(leg => {
      const bookmaker = bookmakers.find(b => b.name === leg.bookmakerName);
      if (bookmaker) {
        const newBalance = bookmaker.currentBalance - leg.stake;
        DatabaseService.updateBookmaker({
          ...bookmaker,
          currentBalance: Math.max(0, Number(newBalance.toFixed(2)))
        });
      }
    });

    setBookmakers(DatabaseService.getBookmakers());
    calculateAndRefreshRadar();
  };

  const handleUpdateExecutedBet = (bet: ExecutedBet) => {
    const list = DatabaseService.updateExecutedBet(bet);
    setHistory(list);
    setHistory(DatabaseService.getExecutedBets());
  };

  const handleDeleteExecutedBet = (id: string) => {
    const list = DatabaseService.deleteExecutedBet(id);
    setHistory(list);
  };

  const handleMarkAlertRead = (id: string) => {
    DatabaseService.markAlertAsRead(id);
    setAlerts(DatabaseService.getAlerts());
  };

  const handleMarkAllAlertsRead = () => {
    DatabaseService.markAllAlertsAsRead();
    setAlerts(DatabaseService.getAlerts());
  };

  // Importar Odds CSV
  const handleImportOddsCsv = (csvText: string) => {
    try {
      const csvProvider = new CsvImportProvider(csvText, true);
      const raw = csvProvider.fetchRawData();
      const evs = csvProvider.parseEvents(csvText);
      const mks = csvProvider.parseMarkets(csvText);
      const sels = csvProvider.getSelectionsForCsv(csvText);
      const odds = csvProvider.parseOdds(csvText);

      DatabaseService.saveOddsBatch({
        events: evs,
        markets: mks,
        selections: sels,
        odds: odds
      });

      calculateAndRefreshRadar();
      setLastFetchTime(new Date());
      return { success: true, count: odds.length };
    } catch (err: any) {
      return { success: false, count: 0, error: err.message };
    }
  };

  const handleAddManualOdd = (input: any) => {
    DatabaseService.addManualOdd(input);
    calculateAndRefreshRadar();
    setLastFetchTime(new Date());
  };

  const handleClearAllOdds = () => {
    DatabaseService.clearOdds();
    setOpportunities([]);
    calculateAndRefreshRadar();
  };

  const handleSaveBetDirectly = (op: SurebetOpportunity) => {
    const calculationOdds = op.legs.map(leg => ({
      selectionId: leg.selectionId,
      oddDecimal: leg.oddDecimal
    }));
    const calc = SurebetEngine.calculate(calculationOdds, settings?.defaultStake || 1000);
    
    handleSaveExecutedBet({
      eventName: op.eventName,
      marketName: op.marketName,
      totalStake: settings?.defaultStake || 1000,
      returnExpected: calc.expectedReturn,
      profitExpected: calc.expectedProfit,
      legs: op.legs.map(leg => {
        const cLeg = calc.legs.find(cl => cl.selectionId === leg.selectionId);
        return {
          selectionName: leg.selectionName,
          bookmakerName: leg.bookmakerName,
          oddDecimal: leg.oddDecimal,
          stake: cLeg ? cLeg.recommendedStake : 0
        };
      }),
      status: 'pendente',
      actualResult: 'pendente',
      notes: 'Registrada direto do Radar.'
    });
  };

  // --- RENDERIZADOR DE TELAS ---
  const renderActiveScreen = () => {
    if (!settings) return null;
    
    switch (activeTab) {
      case 'dashboard':
        return (
          <DashboardScreen
            opportunities={opportunities}
            bookmakers={bookmakers}
            defaultStake={settings.defaultStake}
            onOpenCalculator={(op) => setSelectedOpportunity(op)}
            onNavigateToRadar={() => setActiveTab('radar')}
          />
        );
      case 'radar':
        return (
          <RadarScreen
            opportunities={opportunities}
            bookmakers={bookmakers}
            onOpenCalculator={(op) => setSelectedOpportunity(op)}
            onSaveBetDirectly={handleSaveBetDirectly}
          />
        );
      case 'casas':
        return (
          <CasasScreen
            bookmakers={bookmakers}
            authorizedBookmakers={authorizedBookmakers}
            onUpdateBookmaker={handleUpdateBookmaker}
            onCreateBookmaker={handleCreateBookmaker}
            onImportAuthorized={handleImportAuthorized}
            onClearAuthorized={handleClearAuthorized}
          />
        );
      case 'historico':
        return (
          <HistoricoScreen
            history={history}
            onUpdateBet={handleUpdateExecutedBet}
            onDeleteBet={handleDeleteExecutedBet}
          />
        );
      case 'configuracoes':
        return (
          <ConfiguracoesScreen
            settings={settings}
            bookmakers={bookmakers}
            onUpdateSettings={handleUpdateSettings}
            onImportOddsCsv={handleImportOddsCsv}
            onAddManualOdd={handleAddManualOdd}
            onClearAllOdds={handleClearAllOdds}
          />
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-black text-zinc-100 overflow-hidden font-sans">
      
      {/* Sidebar Navegação */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
      />

      {/* Área de Conteúdo Principal */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        
        {/* Header de Status e Alertas */}
        <Header
          onRefresh={handleSyncFeed}
          isRefreshing={isRefreshing}
          alerts={alerts}
          onMarkAlertRead={handleMarkAlertRead}
          onMarkAllAlertsRead={handleMarkAllAlertsRead}
          lastFetchTime={lastFetchTime}
        />

        {/* Viewport Principal */}
        <main className="flex-1 overflow-y-auto p-8 bg-zinc-950/20">
          
          {/* Apresentação Inicial / Estado Vazio do Radar */}
          {opportunities.length === 0 && activeTab === 'dashboard' && (
            <div className="max-w-2xl mx-auto bg-zinc-950 border border-zinc-900 rounded-2xl p-8 space-y-6 text-center shadow-2xl mt-10 select-none">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mx-auto">
                <Layers className="w-6 h-6" />
              </div>
              
              <div className="space-y-2">
                <h2 className="text-lg font-bold text-zinc-100 uppercase tracking-wide">Bem-vindo ao GuimaBets</h2>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Para iniciar suas operações de arbitragem esportiva, você precisa popular os dados de odds.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-left pt-2">
                <div className="bg-zinc-900/30 border border-zinc-900 rounded-xl p-4 space-y-2">
                  <div className="text-emerald-400 font-bold text-xs flex items-center gap-1.5">
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Mock Feed</span>
                  </div>
                  <p className="text-[10px] text-zinc-500 leading-relaxed">
                    Clique em sincronizar no topo para ativar a simulação e testar o radar com surebets simuladas matemáticas.
                  </p>
                </div>

                <div className="bg-zinc-900/30 border border-zinc-900 rounded-xl p-4 space-y-2">
                  <div className="text-emerald-400 font-bold text-xs flex items-center gap-1.5">
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Importar CSV</span>
                  </div>
                  <p className="text-[10px] text-zinc-500 leading-relaxed">
                    Vá em Configurações e faça a importação de uma planilha formatada contendo odds reais extraídas de scrapers.
                  </p>
                </div>

                <div className="bg-zinc-900/30 border border-zinc-900 rounded-xl p-4 space-y-2">
                  <div className="text-emerald-400 font-bold text-xs flex items-center gap-1.5">
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Lançar Manual</span>
                  </div>
                  <p className="text-[10px] text-zinc-500 leading-relaxed">
                    Use o formulário de cadastro manual nas Configurações para incluir odds de partidas e calcular arbitragens.
                  </p>
                </div>
              </div>
            </div>
          )}

          {renderActiveScreen()}
        </main>

        {/* Rodapé Obrigatório de Segurança e Alertas Legais */}
        <footer className="h-10 bg-zinc-950 border-t border-zinc-900 px-8 flex items-center justify-center shrink-0">
          <div className="flex items-center gap-2 text-[9px] text-zinc-500 font-semibold tracking-wider uppercase text-center leading-none">
            <ShieldAlert className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
            <span>Apostas envolvem risco. Confira odds, regras do mercado e disponibilidade diretamente na casa antes de apostar. O Gma Betes é uma ferramenta de análise e cálculo, não uma garantia de lucro.</span>
          </div>
        </footer>
      </div>

      {/* Calculadora Lateral (Drawer / Sidebar reativa) */}
      <CalculadoraLateral
        opportunity={selectedOpportunity}
        onClose={() => setSelectedOpportunity(null)}
        bookmakers={bookmakers}
        defaultStake={settings?.defaultStake || 1000}
        onSaveBet={handleSaveExecutedBet}
      />
    </div>
  );
}
