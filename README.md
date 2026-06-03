# GuimaBets (Gma Betes) — Painel de Arbitragem Esportiva Premium

O **GuimaBets** é um painel web privado, moderno e minimalista para monitoramento, cálculo e organização de oportunidades de surebet (arbitragem esportiva). Ele apresenta uma interface escura inspirada em painéis de trading financeiro de alto nível.

---

## ⚡ Funcionalidades Integradas
1. **Autenticação Privada:** Login, Cadastro e Logout com isolamento completo de dados por usuário.
2. **Dashboard de Resumo:** Cards de métricas consolidando oportunidades ativas, maior margem, lucro acumulado estimado, etc.
3. **Radar em Tempo Real:** Listagem dinâmica das arbitragens com status térmico (Quente, Morna, Fria) e alertas visuais de casas desconhecidas ou não reguladas.
4. **Calculadora Lateral Reativa:** Entrada rápida de stakes totais e banca, distribuições ideais de montante e avisos sobre limites das casas.
5. **Histórico Consolidado:** Controle operacional de apostas executadas, saldos e alteração do resultado para cálculo de lucros reais.
6. **Gerenciador de Casas de Apostas:** CRUD completo com controle de saldos, saques e importação de listas de casas autorizadas do governo federal.
7. **Configurações Gerais:** Formário para cadastro manual de odds, importação de CSV de odds do radar e toggles de depuração.

---

## 🛠️ Tecnologias Utilizadas
- **Next.js 15 (App Router)**
- **TypeScript**
- **Tailwind CSS v4**
- **Lucide React (Ícones)**
- **Supabase (Schema SQL pronto em `supabase_schema.sql`)**
- **Fallback de Banco de Dados Local (LocalStorage)** para execução sem configurações iniciais necessárias.

---

## 🚀 Instalação e Execução

### 1. Clonar/Acessar o Diretório
Acesse a pasta do projeto no seu terminal:
```bash
cd C:\Users\Guima\.gemini\antigravity\scratch\guimabets
```

### 2. Instalar Dependências
Instale as bibliotecas necessárias para o funcionamento do app:
```bash
npm install
```

### 3. Rodar Testes Matemáticos do Motor
Certifique-se de que a lógica matemática e proporcional de stakes da arbitragem está funcionando perfeitamente:
```bash
node test_surebet_engine.js
```

### 4. Executar Servidor Local de Desenvolvimento
Inicie o servidor de desenvolvimento do Next.js:
```bash
npm run dev
```
Abra [http://localhost:3000](http://localhost:3000) no seu navegador para utilizar o software!

---

## 📂 Estrutura do Projeto
- `src/types/index.ts` — Tipagens integradas e unificadas das entidades do sistema.
- `src/services/surebetEngine.ts` — Motor de cálculo e mapeador de arbitragem (calcula probabilidade implícita, ROI, Stakes, etc).
- `src/services/db.ts` — Banco de dados local com isolamento de usuários no LocalStorage (Offline Sandbox).
- `src/services/providers/index.ts` — Adaptadores de dados de odds (`MockOddsProvider` e `CsvImportProvider`).
- `src/components/` — Telas modulares de navegação e componentes de UI premium.
- `supabase_schema.sql` — Schema SQL detalhado pronto para importação na aba "SQL Editor" do Supabase.

---

## 📊 Especificações de Importação CSV

### A. CSV de Odds do Radar (Configurações)
O importador aceita planilhas no seguinte formato de colunas (com ou sem cabeçalho):
```csv
sport,league,event_name,event_start_time,market_type,market_name,selection_name,bookmaker,odd_decimal,bet_link,collected_at
Futebol,La Liga,Real Madrid x Barcelona,2026-06-03T20:00:00Z,BOTH_TEAMS_TO_SCORE,Ambas marcam,Sim,Betano,2.15,,2026-06-03T02:00:00Z
Futebol,La Liga,Real Madrid x Barcelona,2026-06-03T20:00:00Z,BOTH_TEAMS_TO_SCORE,Ambas marcam,Não,Superbet,2.10,,2026-06-03T02:00:00Z
```

### B. CSV de Casas Regulamentadas (Casas)
Formato simples contendo Nome da Casa de Aposta e Domínio oficial correspondente:
```csv
Betano,betano.com
Superbet,superbet.com
Bet365,bet365.com
```

---

## 🔒 Aviso de Riscos
> **Aviso Legal:** Apostas envolvem risco. Confira odds, regras do mercado e disponibilidade diretamente na casa antes de apostar. O Gma Betes é uma ferramenta de análise e cálculo, não uma garantia de lucro.
