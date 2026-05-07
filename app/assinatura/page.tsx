import Link from "next/link";
import {
  getSubscription,
  isSubscriptionActive,
  subscriptionAllowsFullAccess,
} from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SubscribeButton } from "./ui/subscribe-button";

const TRIAL_PAYWALL =
  "Seu período de teste expirou. Assine um plano para continuar utilizando o sistema.";

export default async function AssinaturaPage({
  searchParams,
}: {
  searchParams: Promise<{ trial_expired?: string; trial_denied?: string }>;
}) {
  const sub = await getSubscription();
  const active = isSubscriptionActive(sub);
  const sp = await searchParams;

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="font-display text-4xl font-bold">Assinatura</h1>
      <p className="mt-2 text-[var(--muted)]">
        Plano mensal para liberar painel, agenda pública e agendamentos online.
      </p>

      {(sp.trial_expired === "1" ||
        (!subscriptionAllowsFullAccess(sub) && sub?.account_blocked)) && (
        <div className="mt-6 rounded-2xl border border-gold-500/35 bg-gold-500/10 px-4 py-3 text-sm text-[var(--fg)]">
          {TRIAL_PAYWALL}
        </div>
      )}

      {sp.trial_denied === "1" ? (
        <div className="mt-6 rounded-2xl border border-[var(--border)] bg-black/[0.02] px-4 py-3 text-sm text-[var(--muted)] dark:bg-white/[0.04]">
          Os dados informados já utilizaram o período gratuito. Você pode assinar abaixo
          para acessar o sistema sem novo trial.
        </div>
      ) : null}

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
              <li>14 dias grátis na primeira conta elegível · bloqueio automático ao expirar</li>
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
                  : sub?.account_blocked
                    ? TRIAL_PAYWALL
                    : sub?.status === "expired"
                      ? "Plano inativo. Renove para recuperar o painel e a página pública."
                      : "Ative o plano para continuar após o teste gratuito."}
              </p>
              <SubscribeButton />
              <Link href="/suporte">
                <Button variant="outline">Suporte</Button>
              </Link>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
