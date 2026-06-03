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
- Painel Admin na tela de Configurações
- Camada híbrida: LocalStorage padrão + Supabase opcional

### Etapa 3 — Probe Real das Fontes (Diagnóstico) ✅
- Arquitetura de adapters para `OddsAgora` e `Oddspedia`.
- Inspeção de tráfego HTML: detecta captchas, Cloudflare WAF, e bloqueios.
- Extração estática de JSON embutido (`__NEXT_DATA__`, estado inicial) e Endpoints de API.
- Motor de derivação de confiança com recomendação (Ex: `candidate_for_parser`, `needs_browser_rendering`, etc).
- Painel de Diagnóstico visual colorido direto na Vercel sem precisar rodar localmente.
- Nenhuma odd é extraída ainda — o foco é garantir viabilidade técnica de extração.

### Etapa 4 — Parser Inicial do OddsAgora ✅
- Refatoração do provider OddsAgora para incluir `runParser()`.
- Diagnóstico profundo da resposta para identificar modelo de extração (`next_data`, `js_rendered`, `api_endpoint`, `html`).
- Persistência das odds extraídas e normalizadas no Supabase usando a camada de banco de dados nativa.
- Registro visual e de banco de dados para os logs de cada tentativa de extração.
- Modo conservador de requests, respeitando limites e não usando proxy.

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

# Inspeção e detecção de bloqueios (Etapa 3)
node test_source_probe.js
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
| `POST` | `/api/scraper/probe` | Admin | (Etapa 3) Executa diagnóstico de HTML e bloqueios de fonte |
| `GET` | `/api/provider/logs` | Admin | (Etapa 3) Lista histórico de execuções dos probes |

**Rotas Admin** exigem o header `x-admin-secret: SEU_GMB_ADMIN_SECRET`.

### Exemplo de uso de Probe (curl):
```bash
# Executar probe completo na OddsAgora
curl -X POST http://localhost:3000/api/scraper/probe \
  -H "x-admin-secret: sua-senha-aqui" \
  -H "Content-Type: application/json" \
  -d '{"provider":"oddsagora"}'
```

---

## 🔬 Etapa 3 — Como interpretar os Diagnósticos de Fonte

O painel de Configurações possui uma aba de **Diagnóstico de Fontes**. As recomendações possíveis são:

1. **Parser (candidate_for_parser)**: O site responde 200 OK, possui HTML grande e não apresenta WAF bloqueante. Está pronto para a Etapa 4 (Extração de texto).
2. **Playwright (needs_browser_rendering)**: O site responde 200 OK, mas o HTML é vazio. Os dados são carregados via JavaScript pelo navegador. Solução: usar headless browser.
3. **API (inspect_network_or_api_pattern)**: O site consome dados de uma API interna referenciada no HTML. O scraping direto da API é preferível.
4. **Bloqueada (blocked_or_risky)**: Resposta 403, Cloudflare Challenge ou reCAPTCHA detectado. Tentar scraping padrão resultará em banimento de IP.

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
| 3 — Probe Real das Fontes (Diagnóstico) | ✅ Concluída |
| 4 — Extração e Parsing de Dados | 🔜 Próxima |
| 5 — Alertas e notificações | 🔜 Planejada |

---

## 🔒 Aviso Legal
> Apostas envolvem risco. Confira odds, regras do mercado e disponibilidade diretamente na casa antes de apostar. O GuimaBets é uma ferramenta de análise e cálculo, não uma garantia de lucro.
