# CortePro — Agenda SaaS para barbearias

Next.js (App Router), TypeScript, Tailwind, Supabase Auth + RLS, Stripe Subscriptions, deploy na Vercel.

## Configuração

1. Crie um projeto no [Supabase](https://supabase.com) e execute `database/schema.sql` no SQL Editor.
2. No Stripe, crie um produto **recorrente mensal**, copie o **Price ID** (`price_...`).
3. Copie `.env.example` para `.env.local` e preencha as variáveis.
4. Configure o webhook do Stripe apontando para `https://SEU_DOMINIO/api/stripe/webhook` com os eventos:
   - `checkout.session.completed`
   - `invoice.paid`
   - `invoice.payment_failed`
   - `customer.subscription.deleted`
5. `npm install` e `npm run dev`.

## Cron (assinaturas vencidas)

- Rota: `GET /api/cron/expire-subscriptions`
- Header: `Authorization: Bearer CRON_SECRET`
- Na Vercel, `vercel.json` agenda diariamente (plano com Cron habilitado). Teste local:

```bash
curl -H "Authorization: Bearer SEU_CRON_SECRET" http://localhost:3000/api/cron/expire-subscriptions
```

## Testes sugeridos

- Cadastro de barbeiro (Server Action com service role + trigger de perfil).
- Login e redirecionamento para `/assinatura` sem plano ativo.
- Checkout Stripe (cartão de teste) e webhook ativando `subscriptions.status = active`.
- Acesso a `/dashboard` e `/agenda` com plano ativo.
- Página pública `/barbearia/[id]`: carregar horários e agendar (sem login).
- Pagamento recusado / cancelado → `/erro`.
- `invoice.payment_failed` → status `expired` e bloqueio do painel.

## Estrutura

- `app/` — rotas exigidas (`/login`, `/register`, `/dashboard`, `/agenda`, `/assinatura`, `/barbearia/[id]`, `/sucesso`, `/erro`).
- `app/api/create-checkout` — sessão Stripe autenticada.
- `app/api/stripe/webhook` — sincronização segura com assinatura via `STRIPE_WEBHOOK_SECRET`.
- `lib/supabaseClient.ts` — browser; `lib/supabase/server.ts` — Server Components/Actions; `lib/supabaseAdmin.ts` — **apenas servidor** (webhooks, cadastro, slots/agendamento público).

## Segurança

- RLS ativo em todas as tabelas; agendamentos públicos passam por Server Actions com service role e checagem de slot livre.
- Nunca exponha `SUPABASE_SERVICE_ROLE_KEY` nem `STRIPE_SECRET_KEY` no cliente.
