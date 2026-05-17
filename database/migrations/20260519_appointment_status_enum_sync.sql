-- Sincroniza ENUM appointment_status com o código (scheduled, completed, cancelled, no_show).
-- Idempotente: seguro em projetos que só tinham scheduled + canceled.

DO $$
BEGIN
  ALTER TYPE public.appointment_status ADD VALUE 'completed';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE public.appointment_status ADD VALUE 'no_show';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE public.appointment_status ADD VALUE 'cancelled';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Legado americano `canceled` → `cancelled` (quando ambos existem no enum).
DO $$
BEGIN
  UPDATE public.appointments
  SET status = 'cancelled'::public.appointment_status,
      updated_at = now()
  WHERE status::text = 'canceled';
EXCEPTION
  WHEN invalid_text_representation THEN NULL;
  WHEN others THEN NULL;
END $$;

-- Garante função de auto-complete (recria se 20260518 não rodou).
CREATE OR REPLACE FUNCTION public.auto_complete_appointments_after_grace ()
  RETURNS integer
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.appointments a
  SET
    status = 'completed',
    updated_at = now()
  WHERE
    a.status = 'scheduled'
    AND (
      (a.data + a.hora_fim) AT TIME ZONE 'America/Sao_Paulo' + interval '20 minutes'
    ) <= (now() AT TIME ZONE 'America/Sao_Paulo');

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.auto_complete_appointments_after_grace () FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.auto_complete_appointments_after_grace () TO service_role;
