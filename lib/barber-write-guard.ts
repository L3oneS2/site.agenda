import { getSubscription } from "@/lib/auth";
import { subscriptionAllowsFullAccess } from "@/lib/subscription-access";

const TRIAL_PAYWALL =
  "Seu período de teste expirou. Assine um plano para continuar utilizando o sistema.";

export async function barberWriteDeniedMessage(): Promise<string | null> {
  const sub = await getSubscription();
  return subscriptionAllowsFullAccess(sub) ? null : TRIAL_PAYWALL;
}
