import Link from "next/link";
import dynamic from "next/dynamic";
import { notFound } from "next/navigation";
import { tryCreateClient } from "@/lib/supabase/server";
import { createAdminClient, tryCreateAdminClient } from "@/lib/supabaseAdmin";
import { isPublicSubscriptionBypassEnabled } from "@/lib/public-subscription-bypass";
import { Card } from "@/components/ui/card";
import { mapServiceRows } from "@/lib/map-service-row";
import type { Barbershop, Service } from "@/lib/types";

const PublicBarbershop = dynamic(
  () =>
    import("./ui/public-barbershop").then((m) => ({
      default: m.PublicBarbershop,
    })),
  { loading: () => <p className="mt-6 text-sm text-[var(--muted)]">Carregando…</p> }
);

export default async function BarbeariaPublicPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await tryCreateClient();
  if (!supabase) notFound();

  const bypass = isPublicSubscriptionBypassEnabled();

  const { data: shop } = await supabase
    .from("barbershops")
    .select("id, user_id, nome_barbearia, endereco, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();

  if (!shop) {
    // Diagnóstico: pode ser inexistente OU bloqueado pela policy pública (assinatura).
    // Usamos service_role (server-only) para diferenciar os casos e facilitar o teste.
    let exists: Barbershop | null = null;
    let sub: {
      status: string | null;
      current_period_end: string | null;
      trial_end_date: string | null;
      account_blocked: boolean | null;
    } | null = null;
    try {
      const admin = createAdminClient();
      const { data: rawShop } = await admin
        .from("barbershops")
        .select("id, user_id, nome_barbearia, endereco, created_at, updated_at")
        .eq("id", id)
        .maybeSingle();
      exists = (rawShop as Barbershop | null) ?? null;

      if (exists?.user_id) {
        const { data: rawSub } = await admin
          .from("subscriptions")
          .select("status, current_period_end, trial_end_date, account_blocked")
          .eq("user_id", exists.user_id)
          .maybeSingle();
        sub =
          (rawSub as {
            status: string | null;
            current_period_end: string | null;
            trial_end_date: string | null;
            account_blocked: boolean | null;
          } | null) ?? null;
      }
    } catch {
      // se não houver service_role key, mantemos mensagem genérica
    }

    if (bypass && exists) {
      const adminBypass = tryCreateAdminClient();
      if (!adminBypass) {
        return (
          <div className="mx-auto max-w-3xl px-4 py-16">
            <Card>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-600">
                Modo teste
              </p>
              <h1 className="mt-3 font-display text-2xl font-bold">
                Servidor sem chave admin
              </h1>
              <p className="mt-3 text-sm text-[var(--muted)]">
                `PUBLIC_BYPASS_SUBSCRIPTION` está ativo, mas `SUPABASE_SERVICE_ROLE_KEY` não está
                configurada (ou está vazia). Configure no host e faça redeploy para carregar
                serviços em modo bypass.
              </p>
            </Card>
          </div>
        );
      }
      const { data: rawServices } = await adminBypass
        .from("services")
        .select("id, user_id, nome, preco, duracao_minutos, created_at, updated_at")
        .eq("user_id", exists.user_id)
        .order("nome");

      const services = mapServiceRows(rawServices as unknown[] | null);

      return (
        <div className="mx-auto max-w-3xl px-4 py-16">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-600">
              Modo teste
            </p>
            <h1 className="mt-3 font-display text-4xl font-bold">
              {exists.nome_barbearia}
            </h1>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Acesso liberado com `PUBLIC_BYPASS_SUBSCRIPTION=1`.
            </p>
          </div>
          <Card className="mt-10">
            <PublicBarbershop barbershop={exists} services={services} />
          </Card>
        </div>
      );
    }

    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-600">
            Página indisponível
          </p>
          <h1 className="mt-3 font-display text-3xl font-bold">
            {exists ? "Assinatura inativa" : "Barbearia não encontrada"}
          </h1>
          <p className="mt-3 text-sm text-[var(--muted)]">
            {exists
              ? "A barbearia existe, mas está bloqueada para o público pela assinatura. Ative o status no Supabase para liberar imediatamente (sem depender da Stripe por enquanto)."
              : "Confira se o link/código (UUID) foi copiado corretamente."}
          </p>
          {exists ? (
            <div className="mt-4 rounded-2xl border border-[var(--border)] bg-black/[0.02] px-4 py-3 text-xs text-[var(--muted)] dark:bg-white/[0.03]">
              <p className="font-medium text-[var(--fg)]">Diagnóstico</p>
              <p className="mt-1">
                - **barbershops.id**: <code>{exists.id}</code>
              </p>
              <p className="mt-1">
                - **barbershops.user_id**: <code>{exists.user_id}</code>
              </p>
              <p className="mt-1">
                - **subscriptions.status**:{" "}
                <code>{sub?.status ?? "null (sem linha)"}</code>
              </p>
              <p className="mt-1">
                - **subscriptions.current_period_end**:{" "}
                <code>{sub?.current_period_end ?? "null"}</code>
              </p>
              <p className="mt-1">
                - **subscriptions.trial_end_date**:{" "}
                <code>{sub?.trial_end_date ?? "null"}</code>
              </p>
              <p className="mt-1">
                - **subscriptions.account_blocked**:{" "}
                <code>{sub?.account_blocked != null ? String(sub.account_blocked) : "null"}</code>
              </p>
              <p className="mt-2">
                Para liberar via banco: garanta uma linha em `subscriptions`
                com `user_id = barbershops.user_id` e `status = &apos;active&apos;`.
              </p>
              <p className="mt-2">
                (Opcional dev) Defina{" "}
                <code>PUBLIC_BYPASS_SUBSCRIPTION=1</code> no `.env.local` e
                reinicie o `npm run dev`.
              </p>
            </div>
          ) : null}
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/cliente"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--card)] px-5 py-2.5 text-sm font-medium transition-all duration-200 hover:border-gold-500/50 hover:shadow-soft"
            >
              Voltar para /cliente
            </Link>
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gold-500 px-5 py-2.5 text-sm font-medium text-ink-950 shadow-gold transition-all duration-200 hover:bg-gold-400 hover:shadow-lg"
            >
              Ir para início
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const barbershop = shop as Barbershop;

  const { data: rawServices } = await supabase
    .from("services")
    .select("id, user_id, nome, preco, duracao_minutos, created_at, updated_at")
    .eq("user_id", barbershop.user_id)
    .order("nome");

  const services = mapServiceRows(rawServices as unknown[] | null);

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-600">
          Agende seu horário
        </p>
        <h1 className="mt-3 font-display text-4xl font-bold">
          {barbershop.nome_barbearia}
        </h1>
        {barbershop.endereco ? (
          <p className="mt-2 text-sm text-[var(--muted)]">{barbershop.endereco}</p>
        ) : null}
      </div>

      <Card className="mt-10">
        <PublicBarbershop barbershop={barbershop} services={services} />
      </Card>
    </div>
  );
}
