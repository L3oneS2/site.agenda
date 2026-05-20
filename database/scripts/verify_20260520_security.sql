-- Verificação pós-migration 20260520_security_rls_public_access.sql
-- Execute no SQL Editor do Supabase (produção). Todas as linhas devem passar.

-- 1) Policy pública antiga em subscriptions NÃO deve existir
SELECT
  CASE
    WHEN COUNT(*) = 0 THEN 'OK: subscriptions_select_public_active ausente'
    ELSE 'FALHA: subscriptions_select_public_active ainda existe'
  END AS check_subscriptions_public_policy
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'subscriptions'
  AND policyname = 'subscriptions_select_public_active';

-- 2) Função barber_has_public_access existe
SELECT
  CASE
    WHEN COUNT(*) = 1 THEN 'OK: barber_has_public_access definida'
    ELSE 'FALHA: barber_has_public_access em falta'
  END AS check_barber_has_public_access
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'barber_has_public_access';

-- 3) Tabela de rate limit
SELECT
  CASE
    WHEN to_regclass('public.booking_rate_events') IS NOT NULL THEN 'OK: booking_rate_events existe'
    ELSE 'FALHA: booking_rate_events em falta'
  END AS check_booking_rate_events;

-- 4) RPC público sem colunas de PII (telefone/e-mail)
SELECT
  a.attname AS column_name
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
JOIN pg_type t ON t.oid = p.prorettype
JOIN pg_attribute a ON a.attrelid = t.typrelid
WHERE n.nspname = 'public'
  AND p.proname = 'get_appointment_public_by_access_token'
  AND a.attnum > 0
  AND NOT a.attisdropped
ORDER BY a.attnum;
-- Esperado: data, hora_inicio, hora_fim, cliente_nome, status, nome_barbearia, nome_servico
-- NÃO deve listar: cliente_telefone, cliente_email
