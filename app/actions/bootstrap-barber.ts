"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
import {
  clientIpFromHeaders,
  coarseIpSubnetKey,
  hashDevicePayloadJson,
  hashTrialIdentifier,
  normalizeDigits,
  normalizeSignupEmail,
} from "@/lib/trial-identity";

const RATE_WINDOW_MS = 60 * 60 * 1000;
const MAX_ATTEMPTS_PER_WINDOW = 20;

export type BootstrapBarberResult = {
  ok: boolean;
  error?: string;
  trialEligible?: boolean;
  alreadyInitialized?: boolean;
};

async function bumpSignupRate(admin: ReturnType<typeof createAdminClient>, ip: string) {
  await admin.from("signup_rate_events").insert({ ip });
}

async function signupRateExceeded(
  admin: ReturnType<typeof createAdminClient>,
  ip: string
): Promise<boolean> {
  const since = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
  const { count, error } = await admin
    .from("signup_rate_events")
    .select("id", { count: "exact", head: true })
    .eq("ip", ip)
    .gte("occurred_at", since);

  if (error) return true;
  return (count ?? 0) >= MAX_ATTEMPTS_PER_WINDOW;
}

/**
 * Finaliza cadastro do barbeiro no servidor: anti-fraude, rate limit via IP,
 * cria linha trial (14 dias) ou bloqueia sem trial repetido (`account_blocked`).
 * Idempotente: se já existe `subscriptions` para o usuário, apenas retorna estado.
 */
export async function finalizeBarberBootstrap(
  formData: FormData
): Promise<BootstrapBarberResult> {
  const nome_barbearia = String(formData.get("nome_barbearia") ?? "").trim();
  const endereco = String(formData.get("endereco") ?? "").trim();
  let deviceSignals: unknown = null;

  try {
    const raw = formData.get("device_payload");
    if (raw && typeof raw === "string" && raw.length > 0) {
      deviceSignals = JSON.parse(raw) as unknown;
    }
  } catch {
    deviceSignals = null;
  }

  if (!nome_barbearia) {
    return { ok: false, error: "Informe o nome da barbearia." };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user?.email) {
    return { ok: false, error: "Sessão inválida. Faça login novamente." };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return {
      ok: false,
      error: "Servidor não configurado (SUPABASE_SERVICE_ROLE_KEY).",
    };
  }

  const { data: existingSub } = await admin
    .from("subscriptions")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingSub) {
    return { ok: true, alreadyInitialized: true };
  }

  const h = await headers();
  const ip = clientIpFromHeaders(h);
  if (await signupRateExceeded(admin, ip)) {
    return {
      ok: false,
      error:
        "Muitas tentativas de cadastro a partir desta rede. Tente mais tarde ou fale com o suporte.",
    };
  }

  await bumpSignupRate(admin, ip);

  const { data: prof, error: profErr } = await admin
    .from("profiles")
    .select("telefone")
    .eq("id", user.id)
    .maybeSingle();

  if (profErr || !prof) {
    return { ok: false, error: "Perfil não encontrado." };
  }

  const telefoneDigits = normalizeDigits(String(prof.telefone ?? ""));
  if (telefoneDigits.length < 10) {
    return {
      ok: false,
      error: "Informe um telefone válido com DDD (pelo menos 10 dígitos) no cadastro.",
    };
  }
  const emailNorm = normalizeSignupEmail(user.email);
  const subnet = coarseIpSubnetKey(ip);

  const p_email_hash = hashTrialIdentifier("email", emailNorm);
  const p_phone_hash = hashTrialIdentifier("phone", telefoneDigits);
  const p_device_hash = hashDevicePayloadJson(deviceSignals);
  const p_ip_subnet_hash = hashTrialIdentifier("ip_subnet", subnet);

  const { data: rpcRaw, error: rpcErr } = await admin.rpc(
    "finalize_barber_bootstrap",
    {
      p_user_id: user.id,
      p_email_hash,
      p_phone_hash,
      p_device_hash,
      p_ip_subnet_hash,
      p_nome_barbearia: nome_barbearia,
      p_endereco: endereco,
    }
  );

  if (rpcErr) {
    return { ok: false, error: rpcErr.message };
  }

  const rpc = rpcRaw as {
    ok?: boolean;
    already_initialized?: boolean;
    trial_eligible?: boolean;
  } | null;

  if (!rpc || rpc.ok !== true) {
    return {
      ok: false,
      error: "Não foi possível concluir o cadastro. Tente novamente.",
    };
  }

  revalidatePath("/dashboard");
  revalidatePath("/assinatura");

  return {
    ok: true,
    alreadyInitialized: Boolean(rpc.already_initialized),
    trialEligible: Boolean(rpc.trial_eligible),
  };
}
