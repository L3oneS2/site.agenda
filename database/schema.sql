-- Barbearia SaaS — schema Supabase
-- Execute no SQL Editor do Supabase ou via CLI após revisão.

-- Extensões
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enums
DO $$ BEGIN
  CREATE TYPE public.profile_role AS ENUM ('barber', 'client');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.subscription_status AS ENUM ('active', 'expired', 'canceled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.appointment_status AS ENUM ('scheduled', 'canceled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Perfis (1:1 com auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  nome TEXT NOT NULL DEFAULT '',
  telefone TEXT NOT NULL DEFAULT '',
  role public.profile_role NOT NULL DEFAULT 'client',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Barbearias (um barbeiro = uma barbearia neste MVP)
CREATE TABLE IF NOT EXISTS public.barbershops (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  nome_barbearia TEXT NOT NULL,
  endereco TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_barbershops_user_id ON public.barbershops (user_id);

-- Assinaturas Stripe
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  status public.subscription_status NOT NULL DEFAULT 'expired',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT UNIQUE,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions (user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions (status);

-- Disponibilidade semanal do barbeiro
CREATE TABLE IF NOT EXISTS public.availability (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  dia_semana SMALLINT NOT NULL CHECK (dia_semana >= 0 AND dia_semana <= 6),
  hora_inicio TIME NOT NULL,
  hora_fim TIME NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT availability_time_order CHECK (hora_fim > hora_inicio)
);

CREATE INDEX IF NOT EXISTS idx_availability_user_day ON public.availability (user_id, dia_semana);

-- Serviços oferecidos pelo barbeiro
CREATE TABLE IF NOT EXISTS public.services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  preco NUMERIC(10, 2) NOT NULL DEFAULT 0,
  duracao_minutos SMALLINT NOT NULL CHECK (duracao_minutos > 0 AND duracao_minutos <= 720),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_services_user_id ON public.services (user_id);

-- Agendamentos (intervalo de tempo + serviço opcional para registros legados)
CREATE TABLE IF NOT EXISTS public.appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  barber_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  servico_id UUID REFERENCES public.services (id) ON DELETE SET NULL,
  cliente_nome TEXT NOT NULL,
  cliente_telefone TEXT NOT NULL,
  data DATE NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fim TIME NOT NULL,
  status public.appointment_status NOT NULL DEFAULT 'scheduled',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT appointment_time_order CHECK (hora_fim > hora_inicio)
);

CREATE INDEX IF NOT EXISTS idx_appointments_barber_date ON public.appointments (barber_id, data);
CREATE INDEX IF NOT EXISTS idx_appointments_barber_date_start
  ON public.appointments (barber_id, data, hora_inicio);

-- updated_at automático
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_updated ON public.profiles;
CREATE TRIGGER trg_profiles_updated
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

DROP TRIGGER IF EXISTS trg_barbershops_updated ON public.barbershops;
CREATE TRIGGER trg_barbershops_updated
  BEFORE UPDATE ON public.barbershops
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

DROP TRIGGER IF EXISTS trg_subscriptions_updated ON public.subscriptions;
CREATE TRIGGER trg_subscriptions_updated
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

DROP TRIGGER IF EXISTS trg_services_updated ON public.services;
CREATE TRIGGER trg_services_updated
  BEFORE UPDATE ON public.services
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

DROP TRIGGER IF EXISTS trg_appointments_updated ON public.appointments;
CREATE TRIGGER trg_appointments_updated
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- Perfil na criação do usuário (dados iniciais via raw_user_meta_data no signUp)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.profile_role;
BEGIN
  BEGIN
    r := (NEW.raw_user_meta_data->>'role')::public.profile_role;
  EXCEPTION WHEN OTHERS THEN
    r := 'client';
  END;

  INSERT INTO public.profiles (id, nome, telefone, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', ''),
    COALESCE(NEW.raw_user_meta_data->>'telefone', ''),
    COALESCE(r, 'client')
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barbershops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- profiles
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- barbershops: leitura pública só com assinatura ativa; dono sempre vê a sua
DROP POLICY IF EXISTS "barbershops_select_public" ON public.barbershops;
CREATE POLICY "barbershops_select_public"
  ON public.barbershops FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.subscriptions s
      WHERE s.user_id = barbershops.user_id
        AND s.status = 'active'
        AND (s.current_period_end IS NULL OR s.current_period_end > now())
    )
  );

DROP POLICY IF EXISTS "barbershops_select_owner" ON public.barbershops;
CREATE POLICY "barbershops_select_owner"
  ON public.barbershops FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "barbershops_insert_owner" ON public.barbershops;
CREATE POLICY "barbershops_insert_owner"
  ON public.barbershops FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "barbershops_update_owner" ON public.barbershops;
CREATE POLICY "barbershops_update_owner"
  ON public.barbershops FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "barbershops_delete_owner" ON public.barbershops;
CREATE POLICY "barbershops_delete_owner"
  ON public.barbershops FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- subscriptions: leitura do próprio usuário; escrita apenas service_role (sem policies para authenticated)
DROP POLICY IF EXISTS "subscriptions_select_own" ON public.subscriptions;
CREATE POLICY "subscriptions_select_own"
  ON public.subscriptions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- availability: dono sempre lê; público só barbeiros com assinatura ativa
DROP POLICY IF EXISTS "availability_select_own" ON public.availability;
CREATE POLICY "availability_select_own"
  ON public.availability FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "availability_select_public_active" ON public.availability;
CREATE POLICY "availability_select_public_active"
  ON public.availability FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.subscriptions s
      WHERE s.user_id = availability.user_id
        AND s.status = 'active'
        AND (s.current_period_end IS NULL OR s.current_period_end > now())
    )
  );

DROP POLICY IF EXISTS "availability_insert_own" ON public.availability;
CREATE POLICY "availability_insert_own"
  ON public.availability FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "availability_update_own" ON public.availability;
CREATE POLICY "availability_update_own"
  ON public.availability FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "availability_delete_own" ON public.availability;
CREATE POLICY "availability_delete_own"
  ON public.availability FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- services: dono; leitura pública com assinatura ativa (página do cliente)
DROP POLICY IF EXISTS "services_select_own" ON public.services;
CREATE POLICY "services_select_own"
  ON public.services FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "services_select_public_active" ON public.services;
CREATE POLICY "services_select_public_active"
  ON public.services FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.subscriptions s
      WHERE s.user_id = services.user_id
        AND s.status = 'active'
        AND (s.current_period_end IS NULL OR s.current_period_end > now())
    )
  );

DROP POLICY IF EXISTS "services_insert_own" ON public.services;
CREATE POLICY "services_insert_own"
  ON public.services FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "services_update_own" ON public.services;
CREATE POLICY "services_update_own"
  ON public.services FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "services_delete_own" ON public.services;
CREATE POLICY "services_delete_own"
  ON public.services FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- appointments: barbeiro vê e atualiza os seus; insert público NÃO — use Server Action + service role
DROP POLICY IF EXISTS "appointments_select_barber" ON public.appointments;
CREATE POLICY "appointments_select_barber"
  ON public.appointments FOR SELECT
  TO authenticated
  USING (barber_id = auth.uid());

DROP POLICY IF EXISTS "appointments_update_barber" ON public.appointments;
CREATE POLICY "appointments_update_barber"
  ON public.appointments FOR UPDATE
  TO authenticated
  USING (barber_id = auth.uid())
  WITH CHECK (barber_id = auth.uid());

-- Agendamentos: sem SELECT público — ocupação e reservas apenas via Server Actions com service role (lib/supabaseAdmin).
