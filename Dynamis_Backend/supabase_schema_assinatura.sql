-- ============================================
-- DYNAMIS - SCHEMA COMPLETO COMPATÍVEL COM ASSINATURA STRIPE
-- Pode ser usado como base nova ou como referência de migração.
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABELA: PROFILES
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  creditos INTEGER NOT NULL DEFAULT 3 CHECK (creditos >= 0),
  plano TEXT NOT NULL DEFAULT 'free'
    CHECK (plano IN ('free', '10_creditos', '20_creditos', 'ilimitado')),
  assinatura_status TEXT NOT NULL DEFAULT 'inactive'
    CHECK (assinatura_status IN ('inactive', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'incomplete')),
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS assinatura_status TEXT NOT NULL DEFAULT 'inactive';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_profiles_stripe_customer_id'
  ) THEN
    CREATE UNIQUE INDEX idx_profiles_stripe_customer_id
      ON profiles (stripe_customer_id)
      WHERE stripe_customer_id IS NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_profiles_stripe_subscription_id'
  ) THEN
    CREATE UNIQUE INDEX idx_profiles_stripe_subscription_id
      ON profiles (stripe_subscription_id)
      WHERE stripe_subscription_id IS NOT NULL;
  END IF;
END $$;

-- ============================================
-- TABELA: USO DE CRÉDITOS
-- ============================================
CREATE TABLE IF NOT EXISTS uso_creditos (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  ferramenta TEXT NOT NULL,
  creditos_antes INTEGER NOT NULL,
  creditos_depois INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- TABELA: PAGAMENTOS / ASSINATURAS
-- ============================================
CREATE TABLE IF NOT EXISTS pagamentos (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  plano TEXT NOT NULL
    CHECK (plano IN ('10_creditos', '20_creditos', 'ilimitado')),
  creditos INTEGER NOT NULL CHECK (creditos >= 0),
  stripe_session_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  tipo_cobranca TEXT NOT NULL DEFAULT 'subscription'
    CHECK (tipo_cobranca IN ('one_time', 'subscription')),
  valor DECIMAL(10,2),
  status TEXT DEFAULT 'pendente',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE pagamentos ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE pagamentos ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE pagamentos ADD COLUMN IF NOT EXISTS tipo_cobranca TEXT NOT NULL DEFAULT 'subscription';

-- ============================================
-- TABELA: PROJETOS GERADOS / HISTÓRICO
-- ============================================
CREATE TABLE IF NOT EXISTS projetos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  dados_entrada JSONB NOT NULL DEFAULT '{}'::jsonb,
  resultados JSONB NOT NULL DEFAULT '{}'::jsonb,
  total_registros INTEGER NOT NULL DEFAULT 0 CHECK (total_registros >= 0),
  total_ferramentas INTEGER NOT NULL DEFAULT 0 CHECK (total_ferramentas >= 0),
  creditos_consumidos INTEGER NOT NULL DEFAULT 1 CHECK (creditos_consumidos >= 0),
  ultima_geracao_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- ÍNDICES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_uso_creditos_user_created_at
  ON uso_creditos (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pagamentos_user_created_at
  ON pagamentos (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pagamentos_subscription
  ON pagamentos (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_projetos_user_geracao
  ON projetos (user_id, ultima_geracao_em DESC);

-- ============================================
-- FUNÇÃO/TRIGGER PARA updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_projetos_updated_at ON projetos;
CREATE TRIGGER update_projetos_updated_at
BEFORE UPDATE ON projetos
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();

-- ============================================
-- RLS
-- ============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE uso_creditos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE projetos ENABLE ROW LEVEL SECURITY;

-- ============================================
-- POLICIES: PROFILES
-- ============================================
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
CREATE POLICY "Users can read own profile"
ON profiles
FOR SELECT
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
ON profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- ============================================
-- POLICIES: USO_CREDITOS
-- ============================================
DROP POLICY IF EXISTS "Users can view own usage" ON uso_creditos;
CREATE POLICY "Users can view own usage"
ON uso_creditos
FOR SELECT
USING (auth.uid() = user_id);

-- ============================================
-- POLICIES: PAGAMENTOS
-- ============================================
DROP POLICY IF EXISTS "Users can view own payments" ON pagamentos;
CREATE POLICY "Users can view own payments"
ON pagamentos
FOR SELECT
USING (auth.uid() = user_id);

-- ============================================
-- POLICIES: PROJETOS
-- ============================================
DROP POLICY IF EXISTS "Users can view own projects" ON projetos;
CREATE POLICY "Users can view own projects"
ON projetos
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own projects" ON projetos;
CREATE POLICY "Users can insert own projects"
ON projetos
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own projects" ON projetos;
CREATE POLICY "Users can update own projects"
ON projetos
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own projects" ON projetos;
CREATE POLICY "Users can delete own projects"
ON projetos
FOR DELETE
USING (auth.uid() = user_id);
