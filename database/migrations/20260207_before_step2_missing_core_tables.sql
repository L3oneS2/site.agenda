-- =============================================================================
-- Rode ANTES do PASSO 2 (20260207_trial_saas.sql) se aparecer:
--   ERROR: relation "public.services" does not exist (ou "availability").
--
-- Ou seja: o projeto espera essas tabelas; monte-as aqui e depois rode o trial.
-- É seguro repetir (CREATE TABLE IF NOT EXISTS).
--
-- Pressupõe: public.profiles já existe (trigger em auth.users) e enums básicos
-- do app (profile_role, appointment_status, subscription_status) existem ou
-- serão criados pelo schema.sql / Supabase.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE OR REPLACE FUNCTION public.set_updated_at ()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now ();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.availability (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4 (),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  dia_semana smallint NOT NULL CHECK (dia_semana >= 0 AND dia_semana <= 6),
  hora_inicio time NOT NULL,
  hora_fim time NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now (),
  CONSTRAINT availability_time_order CHECK (hora_fim > hora_inicio)
);

CREATE INDEX IF NOT EXISTS idx_availability_user_day ON public.availability (user_id, dia_semana);

ALTER TABLE public.availability ENABLE ROW LEVEL SECURITY;

-- Dono da agenda (o passo trial só recria policy *pública*)
DROP POLICY IF EXISTS "availability_select_own" ON public.availability;
CREATE POLICY "availability_select_own"
  ON public.availability FOR SELECT
  TO authenticated
  USING (user_id = auth.uid ());

DROP POLICY IF EXISTS "availability_insert_own" ON public.availability;
CREATE POLICY "availability_insert_own"
  ON public.availability FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid ());

DROP POLICY IF EXISTS "availability_update_own" ON public.availability;
CREATE POLICY "availability_update_own"
  ON public.availability FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid ())
  WITH CHECK (user_id = auth.uid ());

DROP POLICY IF EXISTS "availability_delete_own" ON public.availability;
CREATE POLICY "availability_delete_own"
  ON public.availability FOR DELETE
  TO authenticated
  USING (user_id = auth.uid ());

CREATE TABLE IF NOT EXISTS public.services (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4 (),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  nome text NOT NULL,
  preco numeric(10, 2) NOT NULL DEFAULT 0,
  duracao_minutos smallint NOT NULL CHECK (duracao_minutos > 0 AND duracao_minutos <= 720),
  created_at timestamptz NOT NULL DEFAULT now (),
  updated_at timestamptz NOT NULL DEFAULT now ()
);

CREATE INDEX IF NOT EXISTS idx_services_user_id ON public.services (user_id);

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_services_updated ON public.services;
CREATE TRIGGER trg_services_updated
  BEFORE UPDATE ON public.services
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at ();

DROP POLICY IF EXISTS "services_select_own" ON public.services;
CREATE POLICY "services_select_own"
  ON public.services FOR SELECT
  TO authenticated
  USING (user_id = auth.uid ());

DROP POLICY IF EXISTS "services_insert_own" ON public.services;
CREATE POLICY "services_insert_own"
  ON public.services FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid ());

DROP POLICY IF EXISTS "services_update_own" ON public.services;
CREATE POLICY "services_update_own"
  ON public.services FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid ())
  WITH CHECK (user_id = auth.uid ());

DROP POLICY IF EXISTS "services_delete_own" ON public.services;
CREATE POLICY "services_delete_own"
  ON public.services FOR DELETE
  TO authenticated
  USING (user_id = auth.uid ());

-- Policy pública será criada/atualizada no PASSO 2 (trial) com subscription_grants_public_access.
