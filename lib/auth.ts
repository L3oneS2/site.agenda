import { cache } from "react";
import { redirect } from "next/navigation";
import { tryCreateClient } from "@/lib/supabase/server";
import { subscriptionAllowsFullAccess } from "@/lib/subscription-access";
import type { Barbershop, Profile, Subscription } from "@/lib/types";

/**
 * Sessão no servidor (RSC / Server Actions). Deduplicada com `cache()` por request.
 *
 * O middleware Edge ainda chama `getUser()` para proteger rotas e propagar cookies;
 * isso não é eliminável sem perder refresh/redirects confiáveis. Evite adicionar outras
 * leituras redundantes de auth no mesmo request — reutilize este helper ou `createClient`.
 */
export const getSessionUser = cache(async () => {
  const supabase = await tryCreateClient();
  if (!supabase) {
    return null;
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export async function requireAuth() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export const getProfile = cache(async (): Promise<Profile | null> => {
  const user = await getSessionUser();
  if (!user) return null;
  const supabase = await tryCreateClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("profiles")
    .select("id, nome, telefone, role, created_at, updated_at")
    .eq("id", user.id)
    .single();
  return data as Profile | null;
});

export async function requireBarber() {
  const user = await requireAuth();
  const profile = await getProfile();
  if (!profile || profile.role !== "barber") redirect("/");
  return { user, profile };
}

export const getSubscription = cache(async (): Promise<Subscription | null> => {
  const user = await getSessionUser();
  if (!user) return null;
  const supabase = await tryCreateClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("subscriptions")
    .select(
      "id, user_id, status, stripe_customer_id, stripe_subscription_id, current_period_end, trial_start_date, trial_end_date, account_blocked, created_at, updated_at"
    )
    .eq("user_id", user.id)
    .maybeSingle();
  return data as Subscription | null;
});

/** Barbearia do barbeiro logado; deduplicada no mesmo request (layout + página). */
export const getBarbershopForCurrentUser = cache(
  async (): Promise<Barbershop | null> => {
    const user = await getSessionUser();
    if (!user) return null;
    const supabase = await tryCreateClient();
    if (!supabase) return null;
    const { data } = await supabase
      .from("barbershops")
      .select("id, user_id, nome_barbearia, endereco, created_at, updated_at")
      .eq("user_id", user.id)
      .maybeSingle();
    return data as Barbershop | null;
  }
);

export function isSubscriptionActive(sub: Subscription | null): boolean {
  if (!sub || sub.account_blocked || sub.status !== "active") return false;
  if (!sub.current_period_end) return false;
  return new Date(sub.current_period_end) > new Date();
}

/**
 * Dashboard: permite completar onboarding (sem barbearia) ou uso normal com trial/assinatura válidos.
 */
export async function requireBarberDashboardAccess() {
  await requireBarber();
  const shop = await getBarbershopForCurrentUser();
  if (!shop) return;

  const sub = await getSubscription();
  if (!subscriptionAllowsFullAccess(sub)) {
    redirect("/assinatura?trial_expired=1");
  }
}

/**
 * Agenda e rotas equivalentes só após onboarding e trial/assinatura válidos (verificação no servidor).
 */
export async function requireBarberAgendaAccess() {
  await requireBarber();
  const shop = await getBarbershopForCurrentUser();
  if (!shop) {
    redirect("/dashboard");
  }

  const sub = await getSubscription();
  if (!subscriptionAllowsFullAccess(sub)) {
    redirect("/assinatura?trial_expired=1");
  }
}

export { subscriptionAllowsFullAccess } from "@/lib/subscription-access";
