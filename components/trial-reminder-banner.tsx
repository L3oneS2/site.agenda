import { getSubscription } from "@/lib/auth";
import {
  subscriptionAllowsFullAccess,
  trialCalendarDaysRemainingUtc,
} from "@/lib/subscription-access";

export async function TrialReminderBanner() {
  const sub = await getSubscription();

  if (
    !sub ||
    sub.account_blocked ||
    !subscriptionAllowsFullAccess(sub) ||
    sub.status !== "trial" ||
    !sub.trial_end_date
  ) {
    return null;
  }

  const days = trialCalendarDaysRemainingUtc(sub.trial_end_date);
  if (days === null || days <= 0) return null;

  let tone: "muted" | "gold" | "danger" = "muted";
  let label = `Período de teste: faltam ${days} dia${days === 1 ? "" : "s"}.`;
  if (days <= 1) {
    tone = "danger";
    label = "Último dia do seu período de teste. Assine para não perder o acesso.";
  } else if (days <= 3) {
    tone = "gold";
    label = `Faltam ${days} dias no seu teste grátis. Considere assinar em breve.`;
  } else if (days <= 7) {
    tone = "gold";
    label = `Restam ${days} dias de teste gratuito.`;
  }

  const palette =
    tone === "danger"
      ? "border-red-500/40 bg-red-500/10 text-red-900 dark:text-red-100"
      : tone === "gold"
        ? "border-gold-500/35 bg-gold-500/10 text-[var(--fg)]"
        : "border-[var(--border)] bg-black/[0.02] text-[var(--muted)] dark:bg-white/[0.04]";

  return (
    <div className={`rounded-2xl border px-4 py-3 text-sm ${palette}`}>
      <p className="font-medium">{label}</p>
    </div>
  );
}
