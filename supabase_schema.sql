-- Schema SQL para o Supabase - GuimaBets (Gma Betes)

-- Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. perfis de usuário (ligado ao auth.users do Supabase)
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver seu próprio perfil" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

-- 2. Casas de apostas por usuário
CREATE TYPE bookmaker_status_type AS ENUM ('autorizada', 'judicial', 'desconhecida', 'bloqueada');

CREATE TABLE public.bookmakers (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    domain TEXT NOT NULL,
    status bookmaker_status_type DEFAULT 'desconhecida'::bookmaker_status_type NOT NULL,
    has_account BOOLEAN DEFAULT FALSE NOT NULL,
    current_balance NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
    max_limit NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
    avg_withdrawal_time TEXT,
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    is_favorite BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.bookmakers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem gerenciar suas próprias casas" ON public.bookmakers
    FOR ALL USING (auth.uid() = user_id);

-- 3. Casas de apostas oficialmente autorizadas no Brasil
CREATE TABLE public.authorized_bookmakers (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    domain TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.authorized_bookmakers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos os usuários autenticados podem ler casas autorizadas" ON public.authorized_bookmakers
    FOR SELECT USING (auth.role() = 'authenticated');

-- 4. Eventos esportivos
CREATE TABLE public.events (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    sport TEXT NOT NULL,
    league TEXT NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura de eventos por usuários autenticados" ON public.events FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Escrita de eventos por usuários autenticados" ON public.events FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 5. Mercados esportivos dinâmicos
CREATE TABLE public.markets (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
    sport TEXT NOT NULL,
    market_type TEXT NOT NULL,
    market_name TEXT NOT NULL,
    rules TEXT,
    expected_outcomes_count INT NOT NULL,
    is_exhaustive_market BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.markets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura de mercados" ON public.markets FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Escrita de mercados" ON public.markets FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 6. Seleções de resultado do mercado
CREATE TABLE public.market_selections (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    market_id UUID REFERENCES public.markets(id) ON DELETE CASCADE NOT NULL,
    selection_name TEXT NOT NULL,
    normalized_selection_key TEXT NOT NULL,
    outcome_order INT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.market_selections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura de seleções" ON public.market_selections FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Escrita de seleções" ON public.market_selections FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 7. Histórico de Odds capturadas (snapshots)
CREATE TABLE public.odds_snapshots (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
    market_id UUID REFERENCES public.markets(id) ON DELETE CASCADE NOT NULL,
    selection_id UUID REFERENCES public.market_selections(id) ON DELETE CASCADE NOT NULL,
    bookmaker_id UUID NOT NULL, -- Ligado ao seed global ou id texto
    odd_decimal NUMERIC(6, 2) NOT NULL,
    source TEXT NOT NULL,
    bet_link TEXT,
    collected_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.odds_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura de odds" ON public.odds_snapshots FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Escrita de odds" ON public.odds_snapshots FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 8. Oportunidades de surebet ativas
CREATE TYPE opportunity_status_type AS ENUM ('quente', 'morna', 'fria', 'morta');

CREATE TABLE public.surebet_opportunities (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
    market_id UUID REFERENCES public.markets(id) ON DELETE CASCADE NOT NULL,
    margin_percent NUMERIC(6, 2) NOT NULL,
    implied_sum NUMERIC(6, 4) NOT NULL,
    status opportunity_status_type DEFAULT 'quente'::opportunity_status_type NOT NULL,
    last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.surebet_opportunities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura de oportunidades" ON public.surebet_opportunities FOR SELECT USING (auth.role() = 'authenticated');

-- 9. Pernas da surebet (legs)
CREATE TABLE public.opportunity_legs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    opportunity_id UUID REFERENCES public.surebet_opportunities(id) ON DELETE CASCADE NOT NULL,
    selection_id UUID REFERENCES public.market_selections(id) ON DELETE CASCADE NOT NULL,
    bookmaker_id UUID NOT NULL,
    odd_decimal NUMERIC(6, 2) NOT NULL,
    recommended_stake NUMERIC(12, 2),
    expected_return NUMERIC(12, 2)
);

ALTER TABLE public.opportunity_legs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura de pernas" ON public.opportunity_legs FOR SELECT USING (auth.role() = 'authenticated');

-- 10. Histórico de Apostas Executadas pelo usuário
CREATE TYPE bet_status_type AS ENUM ('pendente', 'finalizada', 'cancelada', 'erro operacional');
CREATE TYPE bet_result_type AS ENUM ('ganhou', 'perdeu', 'reembolsada', 'cancelada', 'pendente');

CREATE TABLE public.executed_bets (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    event_name TEXT NOT NULL,
    market_name TEXT NOT NULL,
    total_stake NUMERIC(12, 2) NOT NULL,
    return_expected NUMERIC(12, 2) NOT NULL,
    profit_expected NUMERIC(12, 2) NOT NULL,
    actual_result bet_result_type DEFAULT 'pendente'::bet_result_type NOT NULL,
    actual_profit NUMERIC(12, 2) DEFAULT 0.00,
    status bet_status_type DEFAULT 'pendente'::bet_status_type NOT NULL,
    notes TEXT,
    legs JSONB NOT NULL, -- Salvando a lista de stakes/casas por perna para flexibilidade
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.executed_bets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem gerenciar seu próprio histórico de apostas" ON public.executed_bets
    FOR ALL USING (auth.uid() = user_id);

-- 11. Logs do provider de dados
CREATE TABLE public.provider_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    provider_name TEXT NOT NULL,
    status TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.provider_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura de logs" ON public.provider_logs FOR SELECT USING (auth.role() = 'authenticated');

-- 12. Alertas do sistema
CREATE TABLE public.alerts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    type TEXT NOT NULL,
    message TEXT NOT NULL,
    read BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem gerenciar seus próprios alertas" ON public.alerts
    FOR ALL USING (auth.uid() = user_id);

-- 13. Configurações de preferência do usuário
CREATE TABLE public.user_settings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
    default_stake NUMERIC(12, 2) DEFAULT 1000.00 NOT NULL,
    min_margin NUMERIC(5, 2) DEFAULT 0.50 NOT NULL,
    only_authorized BOOLEAN DEFAULT FALSE NOT NULL,
    hot_threshold_sec INT DEFAULT 20 NOT NULL,
    warm_threshold_sec INT DEFAULT 60 NOT NULL,
    currency TEXT DEFAULT 'BRL' NOT NULL,
    theme TEXT DEFAULT 'dark' NOT NULL,
    mock_enabled BOOLEAN DEFAULT TRUE NOT NULL,
    manual_enabled BOOLEAN DEFAULT TRUE NOT NULL,
    providers_enabled JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem gerenciar suas próprias configurações" ON public.user_settings
    FOR ALL USING (auth.uid() = user_id);

-- 14. Trigger automático para criar perfil ao criar usuário no auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email)
    VALUES (new.id, new.email);
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
