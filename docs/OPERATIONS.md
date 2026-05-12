# Operação (referência mínima)

Checklist para deploy e suporte. Detalhes de produto estão em `app/actions/README.md`.

## Variáveis de ambiente (produção)

| Variável | Uso |
|----------|-----|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave anónima (browser + middleware + RSC) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server: booking público, checkout, webhook, cron (admin) |
| `STRIPE_SECRET_KEY` | API Stripe (checkout, webhook) |
| `STRIPE_WEBHOOK_SECRET` | Verificação HMAC do webhook |
| `STRIPE_PRICE_ID` | Preço da assinatura no checkout |
| `CRON_SECRET` | Bearer do endpoint de expiração de trials/ativos |
| `TRIAL_IDENTITY_PEPPER` | Hash anti-fraude trial (obrigatório em produção no código) |
| `NEXT_PUBLIC_APP_URL` | (Opcional) origem absoluta para redirects Stripe |

## Deploy (ex.: Vercel)

1. Definir todas as envs no painel e **redeploy** após alterar secrets.
2. `npm run build` localmente antes de merge crítico.
3. Webhook Stripe: URL `https://<domínio>/api/stripe/webhook`, eventos usados no código (checkout, invoice, subscription).

## Migrations (Supabase)

1. Aplicar ficheiros em `database/migrations/` na ordem cronológica (SQL Editor ou `supabase db push`).
2. Manter `database/schema.sql` alinhado com o estado desejado de referência (não substitui migrações já aplicadas em produção).

## Cron

- `GET /api/cron/expire-subscriptions` com header `Authorization: Bearer <CRON_SECRET>`.
- Opcional: `CRON_REQUIRE_VERCEL_UA=1` na Vercel (ver `lib/cron-auth.ts`).

## Testes locais

- `npm test` — Vitest (helpers em `lib/*.test.ts`).
- `npm run lint` / `npx tsc --noEmit`.
