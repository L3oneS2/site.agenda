-- C1/C2: evita reservas simultâneas sobrepostas no mesmo dia/barbeiro.
-- Advisory lock por (barber_id, data) + verificação de sobreposição de TIME.
-- Inserts via service_role (Server Actions) permanecem suportados.

CREATE OR REPLACE FUNCTION public.appointments_prevent_overlap_scheduled ()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM 'scheduled' THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(NEW.barber_id::text || '|' || NEW.data::text), 0);

  IF EXISTS (
    SELECT
      1
    FROM
      public.appointments o
    WHERE
      o.barber_id = NEW.barber_id
      AND o.data = NEW.data
      AND o.status = 'scheduled'
      AND o.id IS DISTINCT FROM NEW.id
      AND o.hora_inicio < NEW.hora_fim
      AND NEW.hora_inicio < o.hora_fim
  ) THEN
    RAISE EXCEPTION 'Este horário acabou de ser reservado. Escolha outro.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_appointments_overlap ON public.appointments;

CREATE TRIGGER trg_appointments_overlap
  BEFORE INSERT OR UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE PROCEDURE public.appointments_prevent_overlap_scheduled ();

-- Mesmo horário de início no mesmo dia (duplo clique): índice único parcial.
CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_unique_barber_date_start_scheduled ON public.appointments (barber_id, data, hora_inicio)
WHERE
  status = 'scheduled';

-- D1/D3: reforço idempotente de grants (sem alterar assinaturas públicas controladas).
REVOKE ALL ON FUNCTION public.finalize_barber_bootstrap (uuid, text, text, text, text, text, text) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.subscription_grants_public_access (public.subscriptions) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.subscription_grants_public_access (public.subscriptions) TO anon,
  authenticated;
