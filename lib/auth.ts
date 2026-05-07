import { redirect } from "next/navigation";
import { tryCreateClient } from "@/lib/supabase/server";
import { subscriptionAllowsFullAccess } from "@/lib/subscription-access";
import type { Profile, Subscription } from "@/lib/types";

export async function getSessionUser() {
  const supabase = await tryCreateClient();
  if (!supabase) {
    return null;
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function requireAuth() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function getProfile(): Promise<Profile | null> {
  const user = await getSessionUser();
  if (!user) return null;
  const supabase = await tryCreateClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  return data as Profile | null;
}

export async function requireBarber() {
  const user = await requireAuth();
  const profile = await getProfile();
  if (!profile || profile.role !== "barber") redirect("/");
  return { user, profile };
}

export async function getSubscription(): Promise<Subscription | null> {
  const user = await getSessionUser();
  if (!user) return null;
  const supabase = await tryCreateClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  return data as Subscription | null;
}

export function isSubscriptionActive(sub: Subscription | null): boolean {
  if (!sub || sub.account_blocked || sub.status !== "active") return false;
  if (!sub.current_period_end) return false;
  return new Date(sub.current_period_end) > new Date();
}

/**
 * Dashboard: permite completar onboarding (sem barbearia) ou uso normal com trial/assinatura válidos.
 */
export async function requireBarberDashboardAccess() {
  const { user } = await requireBarber();
  const supabase = await tryCreateClient();
  if (!supabase) redirect("/login");

  const { data: shop } = await supabase
    .from("barbershops")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

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
  const { user } = await requireBarber();
  const supabase = await tryCreateClient();
  if (!supabase) redirect("/login");

  const { data: shop } = await supabase
    .from("barbershops")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!shop) {
    redirect("/dashboard");
  }

  const sub = await getSubscription();
  if (!subscriptionAllowsFullAccess(sub)) {
    redirect("/assinatura?trial_expired=1");
  }
}

export { subscriptionAllowsFullAccess } from "@/lib/subscription-access";
