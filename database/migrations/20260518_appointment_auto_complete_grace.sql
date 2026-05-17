-- Finalização automática com tolerância de 20 min após hora_fim (America/Sao_Paulo).
-- Corrige backfill imediato da migration 20260517 quando ainda dentro da janela.

-- Reabre finalizados prematuramente (ainda na janela de 20 min).
UPDATE public.appointments a
SET
  status = 'scheduled',
  updated_at = now()
WHERE
  a.status = 'completed'
  AND (
    (a.data + a.hora_fim) AT TIME ZONE 'America/Sao_Paulo' + interval '20 minutes'
  ) > (now() AT TIME ZONE 'America/Sao_Paulo');

-- Finaliza agendados elegíveis (fim + 20 min já passou).
UPDATE public.appointments a
SET
  status = 'completed',
  updated_at = now()
WHERE
  a.status = 'scheduled'
  AND (
    (a.data + a.hora_fim) AT TIME ZONE 'America/Sao_Paulo' + interval '20 minutes'
  ) <= (now() AT TIME ZONE 'America/Sao_Paulo');

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
