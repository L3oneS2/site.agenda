import { NextResponse } from "next/server";
import { utcTodayYmd } from "@/lib/subscription-access";
import { createAdminClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

/** Expira períodos Stripe (fim do período) e trials UTC por data civil. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET não configurado" },
      { status: 500 }
    );
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const admin = createAdminClient();
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
    return NextResponse.json({ error: stripeErr.message }, { status: 500 });
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
    return NextResponse.json({ error: trialErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
