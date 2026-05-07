import Link from "next/link";
import { redirect } from "next/navigation";
import { tryCreateClient } from "@/lib/supabase/server";
import { getSubscription, isSubscriptionActive } from "@/lib/auth";
import {
  subscriptionAllowsFullAccess,
  trialCalendarDaysRemainingUtc,
} from "@/lib/subscription-access";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrialReminderBanner } from "@/components/trial-reminder-banner";
import { CompleteBarbershopForm } from "@/app/dashboard/ui/complete-barbershop-form";
import { ServicesManager } from "@/app/dashboard/ui/services-manager";
import type { Appointment, Barbershop, Service, Subscription } from "@/lib/types";

function subscriptionStatusLabel(sub: Subscription | null): string {
  if (!sub) return "Configurando…";
  if (isSubscriptionActive(sub)) return "Assinatura Stripe ativa";
  if (subscriptionAllowsFullAccess(sub) && sub.status === "trial") {
    const days = trialCalendarDaysRemainingUtc(sub.trial_end_date ?? null);
    const d = days === null ? "" : ` · ${days} dia${days === 1 ? "" : "s"} restantes`;
    return `Período de teste${d}`;
  }
  if (sub.account_blocked) return "Bloqueado — assine para continuar";
  return "Inativo";
}

function mapServiceRow(r: Record<string, unknown>): Service {
  return {
    id: String(r.id),
    user_id: String(r.user_id),
    nome: String(r.nome),
    preco: Number(r.preco),
    duracao_minutos: Number(r.duracao_minutos),
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
  };
}

export default async function DashboardPage() {
  const supabase = await tryCreateClient();
  if (!supabase) redirect("/login");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const sub = await getSubscription();

  const { data: shop } = await supabase
    .from("barbershops")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  const today = new Date().toISOString().slice(0, 10);

  const { data: upcoming } = await supabase
    .from("appointments")
    .select("*, services(nome)")
    .eq("barber_id", user.id)
    .eq("status", "scheduled")
    .gte("data", today)
    .order("data", { ascending: true })
    .order("hora_inicio", { ascending: true })
    .limit(12);

  const { data: rawServices } = await supabase
    .from("services")
    .select("*")
    .eq("user_id", user.id)
    .order("nome");

  const serviceList = (rawServices ?? []).map((row) =>
    mapServiceRow(row as Record<string, unknown>)
  );

  const barbershop = shop as Barbershop | null;
  const rows = (upcoming ?? []) as Appointment[];

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-4xl font-bold">Painel</h1>
          <p className="mt-2 text-[var(--muted)]">
            Plano:{" "}
            <span className="font-medium text-gold-600">
              {subscriptionStatusLabel(sub)}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/agenda">
            <Button variant="outline">Gerenciar horários</Button>
          </Link>
          {barbershop ? (
            <Link href={`/barbearia/${barbershop.id}`}>
              <Button variant="outline">Ver página pública</Button>
            </Link>
          ) : null}
        </div>
      </div>

      <div className="mt-6">
        <TrialReminderBanner />
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <Card className="lg:col-span-2">
          <h2 className="font-display text-xl font-semibold">Serviços</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Preços e durações aparecem na página pública e definem os horários
            oferecidos aos clientes.
          </p>
          <ServicesManager initialServices={serviceList} />
        </Card>

        <Card>
          <h2 className="font-display text-xl font-semibold">Sua barbearia</h2>
          {barbershop ? (
            <dl className="mt-4 space-y-2 text-sm">
              <div>
                <dt className="text-[var(--muted)]">Nome</dt>
                <dd className="font-medium">{barbershop.nome_barbearia}</dd>
              </div>
              <div>
                <dt className="text-[var(--muted)]">Endereço</dt>
                <dd>{barbershop.endereco || "—"}</dd>
              </div>
              <div>
                <dt className="text-[var(--muted)]">Link do cliente</dt>
                <dd>
                  <code className="rounded-lg bg-black/5 px-2 py-1 text-xs dark:bg-white/10">
                    /barbearia/{barbershop.id}
                  </code>
                </dd>
              </div>
            </dl>
          ) : (
            <div className="mt-4">
              <p className="text-sm text-[var(--muted)]">
                Cadastre sua barbearia (necessário se você confirmou o e-mail
                depois do registro ou se a etapa anterior não foi concluída).
              </p>
              <CompleteBarbershopForm />
            </div>
          )}
        </Card>

        <Card>
          <h2 className="font-display text-xl font-semibold">
            Próximos agendamentos
          </h2>
          {rows.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--muted)]">
              Nada agendado ainda. Compartilhe seu link público.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {rows.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between rounded-2xl border border-[var(--border)] px-4 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium">{a.cliente_nome}</p>
                    <p className="text-[var(--muted)]">
                      {a.data} · {String(a.hora_inicio).slice(0, 5)} –{" "}
                      {String(a.hora_fim).slice(0, 5)}
                      {a.services &&
                      typeof a.services === "object" &&
                      "nome" in a.services
                        ? ` · ${(a.services as { nome: string }).nome}`
                        : ""}
                    </p>
                  </div>
                  <span className="text-xs text-gold-600">{a.cliente_telefone}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
