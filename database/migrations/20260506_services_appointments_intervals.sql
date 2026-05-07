-- Migração: serviços + agendamentos com intervalo (hora_inicio / hora_fim)
-- Execute no SQL Editor do Supabase em projetos já existentes.

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

DROP TRIGGER IF EXISTS trg_services_updated ON public.services;
CREATE TRIGGER trg_services_updated
  BEFORE UPDATE ON public.services
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS servico_id UUID REFERENCES public.services (id) ON DELETE SET NULL;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS hora_inicio TIME;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS hora_fim TIME;

UPDATE public.appointments
SET
  hora_inicio = hora,
  hora_fim = (hora + interval '30 minutes')::time
WHERE hora_inicio IS NULL
  AND hora IS NOT NULL;

ALTER TABLE public.appointments ALTER COLUMN hora_inicio SET NOT NULL;
ALTER TABLE public.appointments ALTER COLUMN hora_fim SET NOT NULL;

ALTER TABLE public.appointments DROP COLUMN IF EXISTS hora;

DROP INDEX IF EXISTS idx_appointments_unique_slot;
DROP INDEX IF EXISTS idx_appointments_data_hora;

CREATE INDEX IF NOT EXISTS idx_appointments_barber_date_start
  ON public.appointments (barber_id, data, hora_inicio);

ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointment_time_order;
ALTER TABLE public.appointments
  ADD CONSTRAINT appointment_time_order CHECK (hora_fim > hora_inicio);

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

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
