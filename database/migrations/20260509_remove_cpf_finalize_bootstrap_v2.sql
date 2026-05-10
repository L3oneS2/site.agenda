-- Remove CPF: coluna em profiles, claims trial kind=cpf, e parâmetros da RPC finalize_barber_bootstrap.
-- Seguro para produção: ordem evita violação de CHECK; usuários existentes apenas perdem o campo CPF (dado sensível removido).
-- Aplicar no SQL Editor do Supabase ou via migração gerenciada.

BEGIN;

DELETE FROM public.trial_identifier_claims WHERE kind = 'cpf';

DROP FUNCTION IF EXISTS public.finalize_barber_bootstrap(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text
);

CREATE OR REPLACE FUNCTION public.finalize_barber_bootstrap (
  p_user_id uuid,
  p_email_hash text,
  p_phone_hash text,
  p_device_hash text,
  p_ip_subnet_hash text,
  p_nome_barbearia text,
  p_endereco text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_eligible boolean := true;
  v_start date;
  v_end date;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.subscriptions x
    WHERE x.user_id = p_user_id
    LIMIT 1
  ) THEN
    RETURN jsonb_build_object('ok', true, 'already_initialized', true);
  END IF;

  IF EXISTS (
      SELECT 1
      FROM public.trial_identifier_claims c
      WHERE (c.kind = 'email' AND c.value_hash = p_email_hash)
         OR (c.kind = 'phone' AND c.value_hash = p_phone_hash)
         OR (c.kind = 'device' AND c.value_hash = p_device_hash)
         OR (c.kind = 'ip_subnet' AND c.value_hash = p_ip_subnet_hash)
    LIMIT 1
  ) THEN
    v_eligible := false;
  END IF;

  INSERT INTO public.barbershops (user_id, nome_barbearia, endereco)
  VALUES (
    p_user_id,
    trim(p_nome_barbearia),
    coalesce(nullif(trim(p_endereco), ''), '')
  )
  ON CONFLICT (user_id) DO UPDATE
  SET nome_barbearia = excluded.nome_barbearia,
      endereco = excluded.endereco,
      updated_at = now ();

  IF v_eligible THEN
    v_start := ((now() AT TIME ZONE 'utc'))::date;
    v_end := v_start + 13;

    INSERT INTO public.subscriptions (
      user_id,
      status,
      trial_start_date,
      trial_end_date,
      account_blocked,
      stripe_customer_id,
      stripe_subscription_id,
      current_period_end
    )
    VALUES (
      p_user_id,
      'trial',
      v_start,
      v_end,
      false,
      NULL,
      NULL,
      NULL
    );

    INSERT INTO public.trial_identifier_claims (kind, value_hash, user_id)
    VALUES
      ('email', p_email_hash, p_user_id),
      ('phone', p_phone_hash, p_user_id),
      ('device', p_device_hash, p_user_id),
      ('ip_subnet', p_ip_subnet_hash, p_user_id);
  ELSE
    INSERT INTO public.subscriptions (
      user_id,
      status,
      trial_start_date,
      trial_end_date,
      account_blocked,
      stripe_customer_id,
      stripe_subscription_id,
      current_period_end
    )
    VALUES (
      p_user_id,
      'expired',
      NULL,
      NULL,
      true,
      NULL,
      NULL,
      NULL
    );
  END IF;

  RETURN jsonb_build_object(
    'ok',
    true,
    'trial_eligible',
    v_eligible,
    'trial_started',
    v_eligible,
    'account_blocked_after',
    NOT v_eligible
  );
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_barber_bootstrap (
  uuid, text, text, text, text, text, text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.finalize_barber_bootstrap (
  uuid, text, text, text, text, text, text
) TO service_role;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.relname = 'trial_identifier_claims'
      AND c.contype = 'c'
  LOOP
    EXECUTE format('ALTER TABLE public.trial_identifier_claims DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.trial_identifier_claims
  ADD CONSTRAINT trial_identifier_claims_kind_check
  CHECK (
    kind = ANY (
      ARRAY['email','phone','device','ip_subnet'::text]
    )
  );

ALTER TABLE public.profiles DROP COLUMN IF EXISTS cpf;

COMMIT;
