import { NextResponse } from "next/server";
import { cronBearerMatchesSecret, cronUserAgentAllowed } from "@/lib/cron-auth";
import { utcTodayYmd } from "@/lib/subscription-access";
import { tryCreateAdminClient } from "@/lib/supabaseAdmin";
import { logJsonLine } from "@/lib/supabase/debug-env";

export const runtime = "nodejs";

/**
 * Manutenção de assinaturas: **Bearer CRON_SECRET** + validações em `lib/cron-auth.ts`.
 * Não usa sessão de usuário; não passar pelo mesmo fluxo que páginas autenticadas é intencional.
 */
export async function GET(request: Request) {
  if (request.method !== "GET") {
    return NextResponse.json({ ok: false, error: "Método não permitido" }, { status: 405 });
  }

  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET não configurado" },
      { status: 500 }
    );
  }

  if (
    process.env.NODE_ENV === "production" &&
    secret.length < 16
  ) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "CRON_SECRET muito curto em produção (mínimo 16 caracteres). Gire um valor aleatório forte.",
      },
      { status: 500 }
    );
  }

  if (!cronUserAgentAllowed(request.headers.get("user-agent"))) {
    return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
  }

  if (!cronBearerMatchesSecret(secret, request.headers.get("authorization"))) {
    return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
  }

  const admin = tryCreateAdminClient();
  if (!admin) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "SUPABASE_SERVICE_ROLE_KEY ausente: cron não pode atualizar assinaturas.",
      },
      { status: 503 }
    );
  }

  const nowIso = new Date().toISOString();
  const today = utcTodayYmd();

  const { error: stripeErr } = await admin
    .from("subscriptions")
    .update({
      status: "expired",
      account_blocked: true,
      updated_at: nowIso,
    })
    .eq("status", "active")
    .lt("current_period_end", nowIso);

  if (stripeErr) {
    logJsonLine({
      where: "cron.expire-subscriptions",
      phase: "expire_active_by_period_end",
      message: stripeErr.message,
      code: stripeErr.code,
    });
    return NextResponse.json(
      { ok: false, error: stripeErr.message },
      { status: 500 }
    );
  }

  const { error: trialErr } = await admin
    .from("subscriptions")
    .update({
      status: "expired",
      account_blocked: true,
      updated_at: nowIso,
    })
    .eq("status", "trial")
    .lt("trial_end_date", today);

  if (trialErr) {
    logJsonLine({
      where: "cron.expire-subscriptions",
      phase: "expire_trial_by_end_date",
      message: trialErr.message,
      code: trialErr.code,
    });
    return NextResponse.json(
      { ok: false, error: trialErr.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
