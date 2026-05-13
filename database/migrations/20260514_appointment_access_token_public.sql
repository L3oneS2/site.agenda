-- Link público por token: colunas em `appointments` + RPC só leitura (anon) sem expor outras linhas.
-- Leitura pública não usa RLS com JWT (anónimo); usa função SECURITY DEFINER com `GRANT EXECUTE TO anon`.

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS access_token UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS cliente_email TEXT;

UPDATE public.appointments
SET access_token = gen_random_uuid()
WHERE access_token IS NULL;

ALTER TABLE public.appointments
  ALTER COLUMN access_token SET NOT NULL,
  ALTER COLUMN access_token SET DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_access_token
  ON public.appointments (access_token);

CREATE OR REPLACE FUNCTION public.get_appointment_public_by_access_token (p_token uuid)
RETURNS TABLE (
  data date,
  hora_inicio time,
  hora_fim time,
  cliente_nome text,
  cliente_telefone text,
  cliente_email text,
  status public.appointment_status,
  nome_barbearia text,
  nome_servico text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.data,
    a.hora_inicio,
    a.hora_fim,
    a.cliente_nome,
    a.cliente_telefone,
    a.cliente_email,
    a.status,
    b.nome_barbearia,
    s.nome AS nome_servico
  FROM public.appointments a
  INNER JOIN public.barbershops b ON b.user_id = a.barber_id
  LEFT JOIN public.services s ON s.id = a.servico_id
  WHERE a.access_token = p_token
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_appointment_public_by_access_token (uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_appointment_public_by_access_token (uuid) TO anon, authenticated;
