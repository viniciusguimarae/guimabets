# GuimaBets — Painel de Arbitragem Esportiva Premium

O **GuimaBets** é um painel web privado, moderno e minimalista para monitoramento, cálculo e organização de oportunidades de surebet (arbitragem esportiva). Interface escura inspirada em painéis de trading financeiro.

---

## ⚡ Etapas Implementadas

### Etapa 1 — Painel Frontend ✅
- Dashboard de resumo com cards de métricas
- Radar em tempo real com status térmico (Quente, Morna, Fria)
- Calculadora lateral reativa de stakes
- Histórico consolidado de apostas
- Gerenciador de casas de apostas (CRUD + status regulatório)
- Configurações gerais: manual, CSV e toggles de depuração
- 100% funcional via **LocalStorage** sem login ou backend

### Etapa 2 — Backend Mínimo e Ciclo de Vida das Odds ✅
- Schema SQL server-side com 10 tabelas otimizadas
- API Routes Next.js para odds, oportunidades e admin
- Ciclo de vida completo: expiração por TTL, eventos iniciados, stale
- Provider mock que gera surebets matemáticas reais no Supabase
- Adapters com probe de conectividade para OddsAgora e Oddspedia
- Painel Admin na tela de Configurações
- Camada híbrida: LocalStorage padrão + Supabase opcional

---

## 🛠️ Tecnologias

- **Next.js 16 (App Router)**
- **TypeScript**
- **Tailwind CSS v4**
- **Supabase** (banco server-side opcional)
- **Lucide React**
- **LocalStorage** como padrão offline

---

## 🚀 Instalação e Execução

### 1. Clonar e entrar no diretório
```bash
cd C:\Users\Guima\.gemini\antigravity\scratch\guimabets
```

### 2. Instalar dependências
```bash
npm install
```

### 3. Rodar testes
```bash
# Motor matemático de surebet
node test_surebet_engine.js

# Ciclo de vida das odds (Etapa 2)
node test_lifecycle.js
```

### 4. Iniciar servidor de desenvolvimento
```bash
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

---

## 🗄️ Etapa 2 — Setup do Backend Supabase (Opcional)

O app funciona 100% em modo local sem nenhuma configuração adicional.  
Para ativar o modo servidor:

### Passo 1: Criar projeto no Supabase
Acesse [supabase.com](https://supabase.com) e crie um projeto gratuito.

### Passo 2: Rodar o schema SQL
No painel Supabase → **SQL Editor** → cole e execute o conteúdo de:
```
supabase_schema_server.sql
```

### Passo 3: Criar o .env.local
Na raiz do projeto, crie o arquivo `.env.local`:
```env
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...chave-service-role...
GMB_ADMIN_SECRET=uma-senha-secreta-sua
NEXT_PUBLIC_USE_SERVER_DATA=true
```

> ⚠️ **NUNCA commite o `.env.local` no git.** Ele está no `.gitignore`.

### Passo 4: Reiniciar o servidor
```bash
npm run dev
```

---

## 🌐 API Routes (Etapa 2)

| Método | Rota | Acesso | Descrição |
|--------|------|--------|-----------|
| `GET` | `/api/health` | Público | Status do sistema e modo ativo |
| `GET` | `/api/odds` | Público | Odds ativas (com lifecycle automático) |
| `GET` | `/api/opportunities` | Público | Oportunidades de surebet ativas |
| `POST` | `/api/odds/expire` | Admin | Expira odds antigas manualmente |
| `POST` | `/api/opportunities/recalculate` | Admin | Recalcula oportunidades do zero |
| `POST` | `/api/mock/generate` | Admin | Gera dados mock no Supabase |
| `POST` | `/api/scraper/probe` | Admin | Testa conectividade com providers |
| `POST` | `/api/scraper/run` | Admin | Placeholder para Etapa 3 |

**Rotas Admin** exigem o header `x-admin-secret: SEU_GMB_ADMIN_SECRET`.

### Exemplo de uso com curl:
```bash
# Health check
curl http://localhost:3000/api/health

# Gerar dados mock (requer Supabase configurado)
curl -X POST http://localhost:3000/api/mock/generate \
  -H "x-admin-secret: sua-senha-aqui"

# Testar conectividade com OddsAgora
curl -X POST http://localhost:3000/api/scraper/probe \
  -H "x-admin-secret: sua-senha-aqui" \
  -H "Content-Type: application/json" \
  -d '{"provider":"oddsagora"}'
```

---

## 📂 Estrutura do Projeto

```
src/
├── app/
│   ├── api/
│   │   ├── health/route.ts
│   │   ├── odds/route.ts
│   │   ├── odds/expire/route.ts
│   │   ├── opportunities/route.ts
│   │   ├── opportunities/recalculate/route.ts
│   │   ├── mock/generate/route.ts
│   │   ├── scraper/probe/route.ts
│   │   └── scraper/run/route.ts
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── components/          # Telas modulares de UI
├── lib/
│   ├── server/          # Código exclusivo server-side
│   │   ├── supabaseAdmin.ts
│   │   ├── adminAuth.ts
│   │   ├── oddsLifecycleService.ts
│   │   └── opportunityLifecycleService.ts
│   ├── providers/       # Adapters de fontes de odds
│   │   ├── types.ts
│   │   ├── mockProvider.ts
│   │   ├── oddsAgoraProvider.ts
│   │   └── oddspediaProvider.ts
│   └── data/
│       └── ServerDataProvider.ts
├── services/
│   ├── surebetEngine.ts
│   ├── db.ts
│   └── providers/
└── types/

supabase_schema.sql           # Schema Etapa 1 (referência)
supabase_schema_server.sql    # Schema Etapa 2 (server-side)
test_surebet_engine.js        # Testes Etapa 1
test_lifecycle.js             # Testes Etapa 2
```

---

## 📊 Formato CSV de Odds

```csv
sport,league,event_name,event_start_time,market_type,market_name,selection_name,bookmaker,odd_decimal,bet_link,collected_at
Futebol,La Liga,Real Madrid x Barcelona,2026-06-03T20:00:00Z,BOTH_TEAMS_TO_SCORE,Ambas marcam,Sim,Betano,2.15,,2026-06-03T02:00:00Z
```

---

## 🗺️ Roadmap

| Etapa | Status |
|-------|--------|
| 1 — Frontend + Motor Matemático | ✅ Concluída |
| 2 — Backend Mínimo + Ciclo de Vida | ✅ Concluída |
| 3 — Scraper real de odds públicas | 🔜 Próxima |
| 4 — Alertas e notificações | 🔜 Planejada |

---

## 🔒 Aviso Legal
> Apostas envolvem risco. Confira odds, regras do mercado e disponibilidade diretamente na casa antes de apostar. O GuimaBets é uma ferramenta de análise e cálculo, não uma garantia de lucro.
