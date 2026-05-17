import { NextResponse } from "next/server";
import { runAutoCompleteAppointments } from "@/lib/appointments/auto-complete";
import { cronBearerMatchesSecret, cronUserAgentAllowed } from "@/lib/cron-auth";
import { tryCreateAdminClient } from "@/lib/supabaseAdmin";
import { logJsonLine } from "@/lib/supabase/debug-env";

export const runtime = "nodejs";

/**
 * Finaliza agendamentos `scheduled` após fim + 20 min (America/Sao_Paulo).
 * Bearer CRON_SECRET — mesmo padrão de expire-subscriptions.
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

  if (process.env.NODE_ENV === "production" && secret.length < 16) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET muito curto em produção." },
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
        error: "SUPABASE_SERVICE_ROLE_KEY ausente.",
      },
      { status: 503 }
    );
  }

  const result = await runAutoCompleteAppointments(admin);
  if (result.error) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }

  logJsonLine({
    where: "cron.auto-complete-appointments",
    phase: "ok",
    updated: result.updated,
  });

  return NextResponse.json({ ok: true, updated: result.updated });
}
