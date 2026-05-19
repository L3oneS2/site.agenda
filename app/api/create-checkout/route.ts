import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { tryCreateAdminClient } from "@/lib/supabaseAdmin";
import { getStripe } from "@/lib/stripe";
import { APP_URL } from "@/lib/config";
import { logJsonLine } from "@/lib/supabase/debug-env";

/** URLs de retorno só com origem configurada ou a do próprio request — nunca `Origin` do cliente em isolamento. */
function trustedCheckoutOrigin(request: Request): string {
  try {
    return new URL(APP_URL).origin;
  } catch {
    logJsonLine({
      where: "api.create-checkout",
      phase: "invalid_APP_URL",
      message: APP_URL.slice(0, 120),
    });
    return new URL(request.url).origin;
  }
}

/**
 * Checkout Stripe autenticado por **sessão Supabase** (cookies), igual às páginas protegidas do App Router.
 * Não depende do middleware para validar usuário em `/api/*` — o handler chama `getUser()` explicitamente.
 *
 * Corpo JSON: sucesso `{ ok: true, url }`; erro `{ ok: false, error }` (compatível com clientes que só leem `url` / `error`).
 */
export async function POST(request: Request) {
  const priceId = process.env.STRIPE_PRICE_ID;
  if (!priceId?.trim()) {
    return NextResponse.json(
      { ok: false, error: "STRIPE_PRICE_ID não configurado." },
      { status: 500 }
    );
  }

  if (!process.env.STRIPE_SECRET_KEY?.trim()) {
    logJsonLine({
      where: "api.create-checkout",
      phase: "misconfig",
      message: "STRIPE_SECRET_KEY ausente",
    });
    return NextResponse.json(
      { ok: false, error: "STRIPE_SECRET_KEY não configurado no servidor." },
      { status: 500 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
  }

  const origin = trustedCheckoutOrigin(request);

  const admin = tryCreateAdminClient();
  if (!admin) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Checkout indisponível: configure SUPABASE_SERVICE_ROLE_KEY no servidor (ex.: Vercel → Environment Variables) e faça redeploy.",
      },
      { status: 503 }
    );
  }

  let stripe;
  try {
    stripe = getStripe();
  } catch (e) {
    const message = e instanceof Error ? e.message : "Stripe indisponível.";
    logJsonLine({ where: "api.create-checkout", phase: "stripe_init", message });
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }

  try {
    const { data: row } = await admin
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    let customerId = row?.stripe_customer_id as string | null | undefined;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;
      const { data: existingSub, error: selectErr } = await admin
        .from("subscriptions")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (selectErr) {
        return NextResponse.json({ ok: false, error: selectErr.message }, { status: 500 });
      }

      if (existingSub) {
        const { error: updErr } = await admin
          .from("subscriptions")
          .update({ stripe_customer_id: customerId, updated_at: new Date().toISOString() })
          .eq("user_id", user.id);
        if (updErr) {
          return NextResponse.json({ ok: false, error: updErr.message }, { status: 500 });
        }
      } else {
        const { error: insErr } = await admin.from("subscriptions").insert({
          user_id: user.id,
          stripe_customer_id: customerId,
          status: "expired",
        });
        if (insErr) {
          return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 });
        }
      }
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/sucesso?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/erro`,
      client_reference_id: user.id,
      metadata: { supabase_user_id: user.id },
      subscription_data: {
        metadata: { supabase_user_id: user.id },
      },
    });

    if (!session.url) {
      return NextResponse.json(
        { ok: false, error: "Falha ao criar sessão de checkout." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, url: session.url });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Falha ao criar checkout.";
    logJsonLine({ where: "api.create-checkout", phase: "stripe_api", message });
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
