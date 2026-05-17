-- Relatórios: status completed (realizado) e no_show (não compareceu).
-- Não altera trigger de overlap (só aplica a status = scheduled).

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

-- Histórico (legado): backfill imediato — se 20260518 já foi aplicada, ela corrige a janela de 20 min.
UPDATE public.appointments a
SET
  status = 'completed',
  updated_at = now()
WHERE
  a.status = 'scheduled'
  AND (
    a.data < (timezone('America/Sao_Paulo', now()))::date
    OR (
      a.data = (timezone('America/Sao_Paulo', now()))::date
      AND a.hora_fim <= (timezone('America/Sao_Paulo', now()))::time
    )
  );

CREATE INDEX IF NOT EXISTS idx_appointments_barber_data_status ON public.appointments (barber_id, data, status);
