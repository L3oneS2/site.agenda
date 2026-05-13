-- Disponibilidade por data (YYYY-MM-DD) + horário explícito; remove modelo semanal legado.

CREATE TABLE IF NOT EXISTS public.agenda_day_slots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  data DATE NOT NULL,
  hora TIME NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now (),
  UNIQUE (user_id, data, hora)
);

CREATE INDEX IF NOT EXISTS idx_agenda_day_slots_user_data ON public.agenda_day_slots (user_id, data);

ALTER TABLE public.agenda_day_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agenda_day_slots_select_own" ON public.agenda_day_slots;

CREATE POLICY "agenda_day_slots_select_own" ON public.agenda_day_slots FOR SELECT TO authenticated USING (user_id = auth.uid ());

DROP POLICY IF EXISTS "agenda_day_slots_select_public_active" ON public.agenda_day_slots;

CREATE POLICY "agenda_day_slots_select_public_active" ON public.agenda_day_slots FOR SELECT TO anon,
authenticated USING (
  EXISTS (
    SELECT
      1
    FROM
      public.subscriptions s
    WHERE
      s.user_id = agenda_day_slots.user_id
      AND public.subscription_grants_public_access (s)
  )
);

DROP POLICY IF EXISTS "agenda_day_slots_insert_own" ON public.agenda_day_slots;

CREATE POLICY "agenda_day_slots_insert_own" ON public.agenda_day_slots FOR INSERT TO authenticated
WITH
  CHECK (user_id = auth.uid ());

DROP POLICY IF EXISTS "agenda_day_slots_update_own" ON public.agenda_day_slots;

CREATE POLICY "agenda_day_slots_update_own" ON public.agenda_day_slots FOR UPDATE TO authenticated USING (user_id = auth.uid ())
WITH
  CHECK (user_id = auth.uid ());

DROP POLICY IF EXISTS "agenda_day_slots_delete_own" ON public.agenda_day_slots;

CREATE POLICY "agenda_day_slots_delete_own" ON public.agenda_day_slots FOR DELETE TO authenticated USING (user_id = auth.uid ());

-- Modelo legado (dia da semana) removido.
DROP TABLE IF EXISTS public.availability CASCADE;
