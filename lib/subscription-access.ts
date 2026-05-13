import type { Subscription } from "@/lib/types";

export type SubscriptionAccessFields = Pick<
  Subscription,
  "status" | "current_period_end" | "trial_end_date" | "account_blocked"
>;

/** Data civil em UTC (`YYYY-MM-DD`), alinhada ao servidor Postgres quando usa `CURRENT_DATE` em UTC. */
export function utcTodayYmd(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/**
 * Dias restantes inclusivos no trial (UTC). Último dia válido = 1 dia restante.
 * Retorna 0 quando expirou; null se não há data de fim.
 */
export function trialCalendarDaysRemainingUtc(
  trialEndDate: string | null | undefined
): number | null {
  if (!trialEndDate) return null;
  const today = utcTodayYmd();
  if (trialEndDate < today) return 0;
  const d0 = Date.parse(`${today}T12:00:00.000Z`);
  const d1 = Date.parse(`${trialEndDate}T12:00:00.000Z`);
  return Math.round((d1 - d0) / 86400000) + 1;
}

/** Acesso completo ao painel / agenda: alinhado a `public.subscription_grants_public_access` (schema.sql). */
export function subscriptionAllowsFullAccess(
  sub: SubscriptionAccessFields | null
): boolean {
  if (!sub || sub.account_blocked) return false;
  if (sub.status === "active") {
    if (!sub.current_period_end) return true;
    return new Date(sub.current_period_end) > new Date();
  }
  if (sub.status === "trial" && sub.trial_end_date) {
    const today = utcTodayYmd();
    return sub.trial_end_date >= today;
  }
  return false;
}
