# Server Actions — notas de arquitetura

Este diretório concentra efeitos colaterais (Supabase, Stripe, `revalidatePath`).
Hoje há **acoplamento direto** aos clientes Supabase/Stripe por design do MVP; não há camada `services/` intermediária.

## Pontos de maior acoplamento (para evolução futura, sem obrigar refatoração agora)

| Área            | Arquivos principais        | Dependência externa     | Ideia futura (opcional)                          |
|-----------------|----------------------------|-------------------------|--------------------------------------------------|
| Agendamento público | `booking.ts`           | `tryCreateAdminClient`, scheduling | `lib/booking/slots.ts` puro + thin action       |
| Bootstrap trial | `bootstrap-barber.ts`      | RPC, rate limit, headers | `lib/bootstrap/finalize.ts` + action só I/O    |
| Escrita barbeiro | `barber.ts`, `services.ts` | `createClient`, guards | Repositórios por tabela se o app crescer         |
| Barbearia dono  | `barbershop.ts`            | Supabase, bootstrap     | Manter fino; pouca lógica                        |

Regra: **alterar comportamento** só com testes ou checklist manual; extrações futuras devem ser **fatias pequenas** (um fluxo por vez).

## Rotas `app/api/**` e autenticação (T3)

O **middleware** devolve cedo em `/api/*` (não exige sessão). Cada rota aplica o mecanismo adequado:

| Rota | Mecanismo |
|------|-----------|
| `api/create-checkout` | Sessão Supabase (`createClient` + `getUser`), alinhado ao modelo de páginas autenticadas. |
| `api/cron/expire-subscriptions` | `Authorization: Bearer` + `lib/cron-auth.ts`. |
| `api/stripe/webhook` | Assinatura Stripe (`constructEvent`). |

## Alinhamento banco ↔ código (S2/D2)

- **Trial / bootstrap:** RPC `finalize_barber_bootstrap` (anti-fraude trial) — ver `database/migrations/20260512_trial_antifraud_email_phone_only.sql` (e-mail + telefone).
- **Agendamentos / concorrência:** `database/migrations/20260513_appointments_overlap_advisory.sql` (se aplicado no Supabase).

## Testes automatizados (Q1)

Rodar `npm test` (Vitest). Hoje cobrem helpers puros em `lib/*.test.ts` (cron e bypass público). Sugestão de expansão: `lib/scheduling`, `lib/trial-identity`, smoke de server actions com mocks de Supabase.

## Mapa de acoplamento (A1) — fronteira futura “services”

| Ficheiro | Acoplamento hoje | Fronteira natural para extrair |
|----------|------------------|----------------------------------|
| `booking.ts` | Admin Supabase + `lib/scheduling` | `lib/booking/slots.ts` (puro) + action fina |
| `bootstrap-barber.ts` | RPC `finalize_barber_bootstrap`, rate limit IP, headers | `lib/bootstrap/finalize-rpc.ts` (montagem de hashes + chamada RPC) |
| `barber.ts` / `barbershop.ts` | `createClient`, guards de escrita | Repositório por tabela se o domínio crescer |

Documentação operacional (env, deploy, cron): `docs/OPERATIONS.md`.
