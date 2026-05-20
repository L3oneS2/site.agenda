# Operação (referência mínima)

Checklist para deploy e suporte. Detalhes de produto estão em `app/actions/README.md`.

## Crítico — antes de cada deploy

### C-01: build sem server secrets no disco

- `npm run build` usa `scripts/build-production.mjs`: afasta `.env.local` se contiver secrets e varre `.open-next/` por padrões (`sk_live_`, `whsec_`, etc.).
- Para build/deploy local, use `.env.production.local` (copie de `.env.production.local.example`) **só** com `NEXT_PUBLIC_*` e `STRIPE_PRICE_ID`.
- **Server secrets** (`SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `CRON_SECRET`, `TRIAL_IDENTITY_PEPPER`) → apenas **Secrets** no painel Cloudflare, nunca no ficheiro usado no build.
- Se já fez deploy com `.env.local` completo: o bundle antigo pode ter secrets em `.open-next/cloudflare/next-env.mjs` — rode `npm run build` de novo e **roteie** chaves Stripe/Supabase service role + `CRON_SECRET`.

### C-02: migration de segurança no Supabase

1. Aplicar `database/migrations/20260520_security_rls_public_access.sql` (SQL Editor ou `supabase db push`).
2. Validar com `database/scripts/verify_20260520_security.sql` — todas as mensagens devem ser `OK`.

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

## Deploy Cloudflare (Workers + OpenNext)

Este projeto **não** é SPA estático: precisa do Worker (`.open-next/worker.js`).

1. **Workers Builds** (recomendado) ou CI: `npm run build` e deploy `npm run deploy` (ver `package.json`). Em CI, não injetar server secrets nas envs do passo de build.
2. Definir **secrets** só no painel Cloudflare (encrypted): `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `CRON_SECRET`, `TRIAL_IDENTITY_PEPPER`.
3. Variáveis **plaintext** no painel: `NEXT_PUBLIC_*`, `NEXT_PUBLIC_APP_URL`, `STRIPE_PRICE_ID`. O `wrangler.toml` não define `[vars]` — evita sobrescrever o painel no deploy.
4. `CRON_SECRET`: mínimo 32 caracteres aleatórios; rotacionar se já houve deploy com valor fraco.
5. Domínio: defina `NEXT_PUBLIC_APP_URL` com o URL público (ex. `https://corte-pro.<subdomínio>.workers.dev` ou domínio próprio). `corte-pro` deve coincidir com `name` em `wrangler.toml`.
6. **Cron (Cloudflare):** o `vercel.json` não aplica em Workers. No painel Cloudflare → Workers → Triggers → Cron, configure chamadas HTTP (ou use Workers Cron + roteamento) para:
   - `GET https://<domínio>/api/cron/expire-subscriptions` — diário (ex. `0 8 * * *`)
   - `GET https://<domínio>/api/cron/auto-complete-appointments` — a cada 5 min (`*/5 * * * *`)
   - Header: `Authorization: Bearer <CRON_SECRET>`
7. Webhook Stripe: `https://<domínio>/api/stripe/webhook`.

## Deploy (ex.: Vercel)

1. Definir todas as envs no painel e **redeploy** após alterar secrets.
2. `npm run build` localmente antes de merge crítico.
3. Webhook Stripe: URL `https://<domínio>/api/stripe/webhook`, eventos usados no código (checkout, invoice, subscription).

## Migrations (Supabase)

1. Aplicar ficheiros em `database/migrations/` na ordem cronológica (SQL Editor ou `supabase db push`).
2. **Obrigatório para segurança (Etapa 2):** `20260520_security_rls_public_access.sql` — fecha SELECT público em `subscriptions`, endurece RPC do token e cria `booking_rate_events`.
3. Manter `database/schema.sql` alinhado com o estado desejado de referência (não substitui migrações já aplicadas em produção).

## Cron

- `GET /api/cron/expire-subscriptions` com header `Authorization: Bearer <CRON_SECRET>`.
- Opcional: `CRON_REQUIRE_VERCEL_UA=1` na Vercel (ver `lib/cron-auth.ts`).

## Testes locais

- `npm test` — Vitest (helpers em `lib/*.test.ts`).
- `npm run lint` / `npx tsc --noEmit`.
