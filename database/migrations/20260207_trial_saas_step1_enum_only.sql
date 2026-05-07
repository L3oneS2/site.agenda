-- =============================================================================
-- PASSO 1 de 2 — rode APENAS este bloco no SQL Editor → RUN (uma vez).
-- Sem o valor 'trial' no enum, o PASSO 2 falha com:
--   22P02 invalid input value for enum subscription_status: "trial"
--
-- Este script é idempotente (pode repetir se 'trial' já existir).
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_enum e
    INNER JOIN pg_catalog.pg_type t ON t.oid = e.enumtypid
    INNER JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'subscription_status'
      AND e.enumlabel = 'trial'
  ) THEN
    EXECUTE 'ALTER TYPE public.subscription_status ADD VALUE ''trial''';
  END IF;
END $$;

-- (Opcional) Confira os valores depois — deve aparecer uma linha "trial":
-- SELECT e.enumlabel
-- FROM pg_enum e
-- JOIN pg_type t ON t.oid = e.enumtypid
-- JOIN pg_namespace n ON n.oid = t.typnamespace
-- WHERE n.nspname = 'public' AND t.typname = 'subscription_status'
-- ORDER BY e.enumsortorder;
