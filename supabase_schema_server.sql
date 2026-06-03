-- ============================================================
-- GuimaBets — Etapa 2: Schema Server-Side
-- Supabase como banco de dados puro (sem Auth)
-- ============================================================

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Função genérica para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 1. CASAS DE APOSTAS
-- ============================================================
CREATE TABLE IF NOT EXISTS bookmakers (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name               TEXT        NOT NULL,
  domain             TEXT,
  regulatory_status  TEXT        DEFAULT 'unknown',
  is_active          BOOLEAN     DEFAULT true,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER bookmakers_updated_at
  BEFORE UPDATE ON bookmakers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 2. EVENTOS ESPORTIVOS
-- ============================================================
CREATE TABLE IF NOT EXISTS events (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sport           TEXT        NOT NULL,
  league          TEXT,
  name            TEXT        NOT NULL,
  start_time      TIMESTAMPTZ,
  status          TEXT        DEFAULT 'scheduled',
  source          TEXT,
  source_event_id TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_start_time ON events(start_time);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);

CREATE TRIGGER events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 3. MERCADOS
-- ============================================================
CREATE TABLE IF NOT EXISTS markets (
  id                       UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id                 UUID    REFERENCES events(id) ON DELETE CASCADE,
  market_type              TEXT    NOT NULL,
  market_name              TEXT    NOT NULL,
  expected_outcomes_count  INTEGER,
  is_exhaustive_market     BOOLEAN DEFAULT true,
  status                   TEXT    DEFAULT 'active',
  created_at               TIMESTAMPTZ DEFAULT NOW(),
  updated_at               TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_markets_event_id ON markets(event_id);
CREATE INDEX IF NOT EXISTS idx_markets_status ON markets(status);

CREATE TRIGGER markets_updated_at
  BEFORE UPDATE ON markets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 4. SELEÇÕES DE MERCADO
-- ============================================================
CREATE TABLE IF NOT EXISTS market_selections (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id               UUID REFERENCES markets(id) ON DELETE CASCADE,
  selection_name          TEXT NOT NULL,
  normalized_selection_key TEXT NOT NULL,
  outcome_order           INTEGER,
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_market_selections_market_id ON market_selections(market_id);

-- ============================================================
-- 5. SNAPSHOTS DE ODDS
-- ============================================================
CREATE TABLE IF NOT EXISTS odds_snapshots (
  id               UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         UUID    REFERENCES events(id) ON DELETE CASCADE,
  market_id        UUID    REFERENCES markets(id) ON DELETE CASCADE,
  selection_id     UUID    REFERENCES market_selections(id) ON DELETE CASCADE,
  bookmaker_id     UUID    REFERENCES bookmakers(id) ON DELETE CASCADE,
  odd_decimal      NUMERIC NOT NULL,
  source           TEXT    NOT NULL,
  bet_link         TEXT,
  status           TEXT    DEFAULT 'active',
  is_active        BOOLEAN DEFAULT true,
  provider_run_id  TEXT,
  collected_at     TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at     TIMESTAMPTZ DEFAULT NOW(),
  expires_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_odds_event_id       ON odds_snapshots(event_id);
CREATE INDEX IF NOT EXISTS idx_odds_market_id      ON odds_snapshots(market_id);
CREATE INDEX IF NOT EXISTS idx_odds_bookmaker_id   ON odds_snapshots(bookmaker_id);
CREATE INDEX IF NOT EXISTS idx_odds_status         ON odds_snapshots(status);
CREATE INDEX IF NOT EXISTS idx_odds_is_active      ON odds_snapshots(is_active);
CREATE INDEX IF NOT EXISTS idx_odds_expires_at     ON odds_snapshots(expires_at);
CREATE INDEX IF NOT EXISTS idx_odds_provider_run   ON odds_snapshots(provider_run_id);
CREATE INDEX IF NOT EXISTS idx_odds_collected_at   ON odds_snapshots(collected_at);

CREATE TRIGGER odds_updated_at
  BEFORE UPDATE ON odds_snapshots
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 6. OPORTUNIDADES DE SUREBET
-- ============================================================
CREATE TABLE IF NOT EXISTS surebet_opportunities (
  id                  UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id            UUID    REFERENCES events(id) ON DELETE CASCADE,
  market_id           UUID    REFERENCES markets(id) ON DELETE CASCADE,
  implied_sum         NUMERIC NOT NULL,
  margin_percent      NUMERIC NOT NULL,
  status              TEXT    DEFAULT 'active',
  expires_at          TIMESTAMPTZ,
  invalidated_reason  TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_opportunities_event_id  ON surebet_opportunities(event_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_market_id ON surebet_opportunities(market_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_status    ON surebet_opportunities(status);
CREATE INDEX IF NOT EXISTS idx_opportunities_expires   ON surebet_opportunities(expires_at);

CREATE TRIGGER opportunities_updated_at
  BEFORE UPDATE ON surebet_opportunities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 7. PERNAS DA OPORTUNIDADE
-- ============================================================
CREATE TABLE IF NOT EXISTS opportunity_legs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id    UUID REFERENCES surebet_opportunities(id) ON DELETE CASCADE,
  odds_snapshot_id  UUID REFERENCES odds_snapshots(id) ON DELETE SET NULL,
  event_id          UUID,
  market_id         UUID,
  selection_name    TEXT,
  bookmaker_name    TEXT,
  odd_decimal       NUMERIC,
  stake_suggestion  NUMERIC,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_legs_opportunity_id ON opportunity_legs(opportunity_id);

-- ============================================================
-- 8. LOGS DE PROVIDERS
-- ============================================================
CREATE TABLE IF NOT EXISTS provider_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_name     TEXT NOT NULL,
  action            TEXT NOT NULL,
  status            TEXT NOT NULL,
  message           TEXT,
  response_time_ms  INTEGER,
  response_size     INTEGER,
  provider_run_id   TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_provider_logs_name     ON provider_logs(provider_name);
CREATE INDEX IF NOT EXISTS idx_provider_logs_run_id   ON provider_logs(provider_run_id);
CREATE INDEX IF NOT EXISTS idx_provider_logs_created  ON provider_logs(created_at);

-- ============================================================
-- 9. APOSTAS EXECUTADAS
-- ============================================================
CREATE TABLE IF NOT EXISTS executed_bets (
  id               UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name       TEXT    NOT NULL,
  market_name      TEXT    NOT NULL,
  legs             JSONB   NOT NULL,
  total_stake      NUMERIC,
  expected_return  NUMERIC,
  expected_profit  NUMERIC,
  real_profit      NUMERIC,
  status           TEXT    DEFAULT 'pending',
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER executed_bets_updated_at
  BEFORE UPDATE ON executed_bets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 10. ALERTAS DO SISTEMA
-- ============================================================
CREATE TABLE IF NOT EXISTS alerts (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  type       TEXT    NOT NULL,
  message    TEXT    NOT NULL,
  is_read    BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_is_read   ON alerts(is_read);
CREATE INDEX IF NOT EXISTS idx_alerts_created   ON alerts(created_at);

-- ============================================================
-- SEED INICIAL DE CASAS DE APOSTAS
-- ============================================================
INSERT INTO bookmakers (name, domain, regulatory_status, is_active) VALUES
  ('Bet365',          'bet365.com',              'autorizada',   true),
  ('Betano',          'betano.com',              'autorizada',   true),
  ('Superbet',        'superbet.com',            'autorizada',   true),
  ('EstrelaBet',      'estrelabet.com',          'autorizada',   true),
  ('KTO',             'kto.com',                 'autorizada',   true),
  ('Betfair',         'betfair.com',             'autorizada',   true),
  ('Sportingbet',     'sportingbet.com',         'autorizada',   true),
  ('1xBet',           '1xbet.com',               'judicial',     true),
  ('F12.Bet',         'f12.bet',                 'autorizada',   true),
  ('LuvaBet',         'luvabet.com',             'desconhecida', true),
  ('Betnacional',     'betnacional.com',         'autorizada',   true),
  ('Novibet',         'novibet.com',             'autorizada',   true),
  ('Stake',           'stake.com',               'bloqueada',    false),
  ('Esportes da Sorte','esportesdasorte.com',    'autorizada',   true),
  ('Pixbet',          'pixbet.com',              'autorizada',   true),
  ('Betfair Exchange','betfair.com/exchange',    'autorizada',   true)
ON CONFLICT DO NOTHING;
