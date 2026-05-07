import Link from "next/link";
import { getSubscription, isSubscriptionActive } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SubscribeButton } from "./ui/subscribe-button";

export default async function AssinaturaPage() {
  const sub = await getSubscription();
  const active = isSubscriptionActive(sub);

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="font-display text-4xl font-bold">Assinatura</h1>
      <p className="mt-2 text-[var(--muted)]">
        Plano mensal para liberar painel, agenda pública e agendamentos online.
      </p>

      <Card className="mt-10">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gold-600">
              Plano único
            </p>
            <h2 className="mt-2 font-display text-2xl font-semibold">CortePro Mensal</h2>
            <ul className="mt-4 space-y-2 text-sm text-[var(--muted)]">
              <li>Página pública com marca premium</li>
              <li>Agenda com faixas por dia da semana</li>
              <li>Pagamentos via Stripe (checkout + webhooks)</li>
              <li>Bloqueio automático sem plano ativo</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-black/[0.02] p-6 text-center dark:bg-white/[0.04]">
            <p className="text-sm text-[var(--muted)]">A partir de</p>
            <p className="mt-1 font-display text-4xl font-bold text-gradient-gold">
              Stripe
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Configure STRIPE_PRICE_ID com seu preço mensal
            </p>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-4 border-t border-[var(--border)] pt-8">
          {active ? (
            <>
              <p className="text-sm text-green-600 dark:text-green-400">
                Sua assinatura está ativa.
                {sub?.current_period_end
                  ? ` Renova em ${new Date(sub.current_period_end).toLocaleDateString("pt-BR")}.`
                  : null}
              </p>
              <Link href="/dashboard">
                <Button>Ir ao painel</Button>
              </Link>
            </>
          ) : (
            <>
              <p className="text-sm text-[var(--muted)]">
                {sub?.status === "canceled"
                  ? "Assinatura cancelada. Reative para voltar ao painel."
                  : "Ative o plano para desbloquear o sistema."}
              </p>
              <SubscribeButton />
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
