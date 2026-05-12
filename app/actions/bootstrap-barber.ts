"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { tryCreateAdminClient } from "@/lib/supabaseAdmin";
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

const DEBUG_BOOTSTRAP = process.env.DEBUG_BOOTSTRAP === "1";

function logBootstrap(stage: string, detail: Record<string, unknown>) {
  if (!DEBUG_BOOTSTRAP) return;
  // eslint-disable-next-line no-console
  console.warn("[bootstrap]", stage, detail);
}

export type BootstrapBarberResult = {
  ok: boolean;
  error?: string;
  trialEligible?: boolean;
  alreadyInitialized?: boolean;
};

async function bumpSignupRate(admin: SupabaseClient, ip: string) {
  await admin.from("signup_rate_events").insert({ ip });
}

async function signupRateExceeded(
  admin: SupabaseClient,
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

type RpcPayload = {
  ok?: boolean;
  already_initialized?: boolean;
  trial_eligible?: boolean;
  error?: string;
} | null;

function parseRpcResult(rpcRaw: unknown): RpcPayload {
  return rpcRaw as RpcPayload;
}

function friendlyRpcError(message: string): string {
  if (/permission denied|42501|not authorized/i.test(message)) {
    return (
      "Não foi possível ativar o período de teste: o banco ainda não permite esta operação com sua sessão. " +
      "Aplique a migração `database/migrations/20260511_finalize_bootstrap_authenticated.sql` no Supabase, " +
      "ou configure `SUPABASE_SERVICE_ROLE_KEY` no servidor (Vercel → Environment Variables) e faça redeploy."
    );
  }
  return message;
}

async function runFinalizeRpc(
  client: SupabaseClient,
  user: User,
  nome_barbearia: string,
  endereco: string,
  deviceSignals: unknown
): Promise<BootstrapBarberResult> {
  const { data: prof, error: profErr } = await client
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
      error:
        "Informe um telefone válido com DDD (pelo menos 10 dígitos) no cadastro.",
    };
  }

  const emailNorm = normalizeSignupEmail(user.email ?? "");
  const h = await headers();
  const ip = clientIpFromHeaders(h);
  const subnet = coarseIpSubnetKey(ip);

  const p_email_hash = hashTrialIdentifier("email", emailNorm);
  const p_phone_hash = hashTrialIdentifier("phone", telefoneDigits);
  const p_device_hash = hashDevicePayloadJson(deviceSignals);
  const p_ip_subnet_hash = hashTrialIdentifier("ip_subnet", subnet);

  const { data: rpcRaw, error: rpcErr } = await client.rpc(
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
    logBootstrap("rpc_error", { message: rpcErr.message, code: rpcErr.code });
    return { ok: false, error: friendlyRpcError(rpcErr.message) };
  }

  const rpc = parseRpcResult(rpcRaw);

  if (rpc?.ok === false) {
    const err =
      rpc.error === "unauthorized"
        ? "Operação não autorizada para esta sessão. Faça login novamente."
        : rpc.error || "Não foi possível concluir o cadastro.";
    return { ok: false, error: err };
  }

  if (!rpc || rpc.ok !== true) {
    return {
      ok: false,
      error: "Não foi possível concluir o cadastro. Tente novamente.",
    };
  }

  return {
    ok: true,
    alreadyInitialized: Boolean(rpc.already_initialized),
    trialEligible: Boolean(rpc.trial_eligible),
  };
}

/**
 * Finaliza cadastro do barbeiro no servidor: anti-fraude, rate limit via IP (quando há service role),
 * cria linha trial (14 dias) ou bloqueia sem trial repetido (`account_blocked`).
 * Idempotente: se já existe `subscriptions` para o usuário, apenas retorna estado.
 *
 * Sem `SUPABASE_SERVICE_ROLE_KEY`, usa a sessão do usuário para chamar a RPC (após migração
 * `20260511_finalize_bootstrap_authenticated.sql`). Rate limit por IP fica desativado nesse modo.
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
    logBootstrap("auth", { userErr: userErr?.message });
    return { ok: false, error: "Sessão inválida. Faça login novamente." };
  }

  const admin = tryCreateAdminClient();

  if (admin) {
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
    logBootstrap("path", { mode: "admin_service_role" });

    const result = await runFinalizeRpc(
      admin,
      user,
      nome_barbearia,
      endereco,
      deviceSignals
    );
    if (result.ok) {
      revalidatePath("/dashboard");
      revalidatePath("/assinatura");
    }
    return result;
  }

  logBootstrap("path", {
    mode: "user_session_fallback",
    serviceRoleConfigured: false,
  });

  const { data: existingSubUser } = await supabase
    .from("subscriptions")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingSubUser) {
    return { ok: true, alreadyInitialized: true };
  }

  const result = await runFinalizeRpc(
    supabase,
    user,
    nome_barbearia,
    endereco,
    deviceSignals
  );
  if (result.ok) {
    revalidatePath("/dashboard");
    revalidatePath("/assinatura");
  }
  return result;
}
