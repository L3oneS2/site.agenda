import Link from "next/link";
import dynamic from "next/dynamic";
import { notFound } from "next/navigation";
import { tryCreateClient } from "@/lib/supabase/server";
import { tryCreateAdminClient } from "@/lib/supabaseAdmin";
import { isPublicSubscriptionBypassEnabled } from "@/lib/public-subscription-bypass";
import { Card } from "@/components/ui/card";
import { mapServiceRows } from "@/lib/map-service-row";
import { todayYmdInReportTz } from "@/lib/reports/timezone";
import type { Barbershop } from "@/lib/types";

const PublicBarbershop = dynamic(
  () =>
    import("./ui/public-barbershop").then((m) => ({
      default: m.PublicBarbershop,
    })),
  { loading: () => <p className="mt-6 text-sm text-[var(--muted)]">Carregando…</p> }
);

function PublicUnavailableCard({ title, message }: { title: string; message: string }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <Card>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-600">
          Página indisponível
        </p>
        <h1 className="mt-3 font-display text-3xl font-bold">{title}</h1>
        <p className="mt-3 text-sm text-[var(--muted)]">{message}</p>
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

export default async function BarbeariaPublicPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const initialTodayYmd = todayYmdInReportTz();
  const supabase = await tryCreateClient();
  if (!supabase) notFound();

  const bypass = isPublicSubscriptionBypassEnabled();

  const { data: shop } = await supabase
    .from("barbershops")
    .select("id, user_id, nome_barbearia, endereco, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();

  if (!shop) {
    if (bypass) {
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
                configurada. Configure no host e reinicie o servidor de desenvolvimento.
              </p>
            </Card>
          </div>
        );
      }

      const { data: rawShop } = await adminBypass
        .from("barbershops")
        .select("id, user_id, nome_barbearia, endereco, created_at, updated_at")
        .eq("id", id)
        .maybeSingle();

      const exists = (rawShop as Barbershop | null) ?? null;
      if (!exists) {
        return (
          <PublicUnavailableCard
            title="Barbearia não encontrada"
            message="Confira se o link foi copiado corretamente."
          />
        );
      }

      const { data: rawServices } = await adminBypass
        .from("services")
        .select("id, user_id, nome, preco, duracao_minutos, created_at, updated_at")
        .eq("user_id", exists.user_id)
        .order("nome");

      const services = mapServiceRows(rawServices);

      return (
        <div className="mx-auto max-w-3xl px-4 py-16">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-600">
              Modo teste
            </p>
            <h1 className="mt-3 font-display text-4xl font-bold">{exists.nome_barbearia}</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Acesso liberado com `PUBLIC_BYPASS_SUBSCRIPTION=1` (somente desenvolvimento).
            </p>
          </div>
          <Card className="mt-10">
            <PublicBarbershop
              barbershop={exists}
              services={services}
              initialTodayYmd={initialTodayYmd}
            />
          </Card>
        </div>
      );
    }

    return (
      <PublicUnavailableCard
        title="Agendamento indisponível"
        message="Esta barbearia não foi encontrada ou o agendamento online não está ativo no momento. Peça um novo link ao barbeiro."
      />
    );
  }

  const barbershop = shop as Barbershop;

  const { data: rawServices } = await supabase
    .from("services")
    .select("id, user_id, nome, preco, duracao_minutos, created_at, updated_at")
    .eq("user_id", barbershop.user_id)
    .order("nome");

  const services = mapServiceRows(rawServices);

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-600">
          Agende seu horário
        </p>
        <h1 className="mt-3 font-display text-4xl font-bold">{barbershop.nome_barbearia}</h1>
        {barbershop.endereco ? (
          <p className="mt-2 text-sm text-[var(--muted)]">{barbershop.endereco}</p>
        ) : null}
      </div>

      <Card className="mt-10">
        <PublicBarbershop
          barbershop={barbershop}
          services={services}
          initialTodayYmd={initialTodayYmd}
        />
      </Card>
    </div>
  );
}
