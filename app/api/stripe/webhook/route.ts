import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { tryCreateAdminClient } from "@/lib/supabaseAdmin";
import { getStripe } from "@/lib/stripe";
import { logJsonLine } from "@/lib/supabase/debug-env";

export const runtime = "nodejs";

/**
 * Webhook Stripe: validação por assinatura HMAC (`STRIPE_WEBHOOK_SECRET`); sem sessão de usuário.
 * Sincroniza Supabase via service role quando configurada.
 * Respostas JSON incluem `ok` + `received` + `error` (string em falhas de handler; 500 para Stripe retentar).
 */
function logStripeWebhook(phase: string, detail: Record<string, unknown> = {}) {
  logJsonLine({ where: "stripe.webhook", phase, ...detail });
}

async function resolveSupabaseUserIdForStripeSubscription(
  admin: SupabaseClient,
  stripe: Stripe,
  stripeSub: Stripe.Subscription
): Promise<string | null> {
  const fromMeta = stripeSub.metadata?.supabase_user_id?.trim();
  if (fromMeta) return fromMeta;

  const { data: bySub, error: bySubErr } = await admin
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_subscription_id", stripeSub.id)
    .maybeSingle();

  if (bySubErr) {
    logStripeWebhook("resolve_user_by_subscription_failed", {
      message: bySubErr.message,
      stripeSubscriptionId: stripeSub.id,
    });
  } else if (bySub?.user_id) {
    return String(bySub.user_id);
  }

  const customerId =
    typeof stripeSub.customer === "string"
      ? stripeSub.customer
      : stripeSub.customer?.id;

  if (customerId) {
    const { data: byCust, error: byCustErr } = await admin
      .from("subscriptions")
      .select("user_id")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();

    if (byCustErr) {
      logStripeWebhook("resolve_user_by_customer_failed", {
        message: byCustErr.message,
        stripeCustomerId: customerId,
      });
    } else if (byCust?.user_id) {
      return String(byCust.user_id);
    }

    try {
      const cust = await stripe.customers.retrieve(customerId);
      if (!cust.deleted && cust.metadata?.supabase_user_id?.trim()) {
        return cust.metadata.supabase_user_id.trim();
      }
    } catch (e) {
      logStripeWebhook("stripe_customers_retrieve_failed", {
        customerId,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return null;
}

async function syncSubscriptionFromStripe(
  admin: SupabaseClient,
  stripe: Stripe,
  stripeSub: Stripe.Subscription,
  fallbackUserId?: string | null
): Promise<void> {
  const userId =
    (await resolveSupabaseUserIdForStripeSubscription(admin, stripe, stripeSub)) ??
    fallbackUserId ??
    null;

  if (!userId) {
    logStripeWebhook("sync_skipped", {
      reason: "missing_supabase_user_id",
      stripeSubscriptionId: stripeSub.id,
    });
    return;
  }

  const { data: existing, error: existingErr } = await admin
    .from("subscriptions")
    .select("trial_start_date, trial_end_date")
    .eq("user_id", userId)
    .maybeSingle();

  if (existingErr) {
    logStripeWebhook("subscription_select_failed", {
      message: existingErr.message,
      userId,
      stripeSubscriptionId: stripeSub.id,
    });
    throw new Error(existingErr.message);
  }

  const end = stripeSub.current_period_end
    ? new Date(stripeSub.current_period_end * 1000).toISOString()
    : null;

  const paidOk =
    stripeSub.status === "active" || stripeSub.status === "trialing";

  let status: "trial" | "active" | "expired" | "canceled";
  if (paidOk) {
    status = "active";
  } else if (
    stripeSub.status === "canceled" ||
    stripeSub.status === "unpaid" ||
    stripeSub.status === "incomplete_expired"
  ) {
    status = "canceled";
  } else {
    status = "expired";
  }

  const customerId =
    typeof stripeSub.customer === "string"
      ? stripeSub.customer
      : stripeSub.customer?.id;

  const account_blocked = !paidOk;

  const trial_start_date =
    existing && "trial_start_date" in existing
      ? (existing as { trial_start_date: string | null }).trial_start_date
      : null;
  const trial_end_date =
    existing && "trial_end_date" in existing
      ? (existing as { trial_end_date: string | null }).trial_end_date
      : null;

  const { error } = await admin.from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_customer_id: customerId ?? null,
      stripe_subscription_id: stripeSub.id,
      status,
      current_period_end: end,
      trial_start_date,
      trial_end_date,
      account_blocked,
    },
    { onConflict: "user_id" }
  );

  if (error) {
    logStripeWebhook("subscription_upsert_failed", {
      message: error.message,
      userId,
      stripeSubscriptionId: stripeSub.id,
    });
    throw new Error(error.message);
  }
}

async function retrieveSubscriptionForWebhook(
  stripe: Stripe,
  subId: string
): Promise<Stripe.Subscription> {
  try {
    return await stripe.subscriptions.retrieve(subId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const stripeErr = e as { type?: string; code?: string };
    logStripeWebhook("stripe_subscriptions_retrieve_failed", {
      subId,
      message: msg,
      stripeErrorType: stripeErr.type,
      stripeErrorCode: stripeErr.code,
    });
    throw e;
  }
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    logStripeWebhook("misconfig", { reason: "STRIPE_WEBHOOK_SECRET ausente" });
    return NextResponse.json(
      { ok: false, error: "STRIPE_WEBHOOK_SECRET ausente" },
      { status: 500 }
    );
  }

  const body = await request.text();
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ ok: false, error: "Sem assinatura" }, { status: 400 });
  }

  if (!process.env.STRIPE_SECRET_KEY?.trim()) {
    logStripeWebhook("misconfig", { reason: "STRIPE_SECRET_KEY ausente" });
    return NextResponse.json(
      { ok: false, error: "STRIPE_SECRET_KEY ausente no servidor" },
      { status: 503 }
    );
  }

  const stripe = getStripe();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Webhook inválido";
    logStripeWebhook("signature_invalid", { message });
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }

  const admin = tryCreateAdminClient();
  if (!admin) {
    logStripeWebhook("admin_missing", {
      eventType: event.type,
      eventId: event.id,
    });
    return NextResponse.json(
      { ok: false, received: false, error: "SUPABASE_SERVICE_ROLE_KEY ausente" },
      { status: 503 }
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId =
          session.metadata?.supabase_user_id?.trim() ||
          session.client_reference_id?.trim() ||
          undefined;
        if (session.mode !== "subscription" || !session.subscription) {
          logStripeWebhook("checkout_ignored", {
            mode: session.mode,
            hasSubscription: Boolean(session.subscription),
            sessionId: session.id,
          });
          break;
        }

        const subId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription.id;

        const stripeSub = await retrieveSubscriptionForWebhook(stripe, subId);
        await syncSubscriptionFromStripe(admin, stripe, stripeSub, userId);
        break;
      }
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const subRef = invoice.subscription;
        if (!subRef) {
          logStripeWebhook("invoice_paid_skipped", { reason: "no_subscription_on_invoice" });
          break;
        }
        const subId = typeof subRef === "string" ? subRef : subRef.id;
        const stripeSub = await retrieveSubscriptionForWebhook(stripe, subId);
        await syncSubscriptionFromStripe(admin, stripe, stripeSub);
        break;
      }
      case "customer.subscription.updated": {
        const stripeSub = event.data.object as Stripe.Subscription;
        await syncSubscriptionFromStripe(admin, stripe, stripeSub);
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subRef = invoice.subscription;
        if (!subRef) {
          logStripeWebhook("invoice_payment_failed_skipped", {
            reason: "no_subscription_on_invoice",
            invoiceId: invoice.id,
          });
          break;
        }
        const subId = typeof subRef === "string" ? subRef : subRef.id;
        const { error: updErr } = await admin
          .from("subscriptions")
          .update({
            status: "expired",
            account_blocked: true,
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_subscription_id", subId);
        if (updErr) {
          logStripeWebhook("invoice_payment_failed_update", {
            message: updErr.message,
            stripeSubscriptionId: subId,
          });
          throw new Error(updErr.message);
        }
        break;
      }
      case "customer.subscription.deleted": {
        const stripeSub = event.data.object as Stripe.Subscription;
        const { error: delErr } = await admin
          .from("subscriptions")
          .update({
            status: "canceled",
            account_blocked: true,
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_subscription_id", stripeSub.id);
        if (delErr) {
          logStripeWebhook("subscription_deleted_update", {
            message: delErr.message,
            stripeSubscriptionId: stripeSub.id,
          });
          throw new Error(delErr.message);
        }
        break;
      }
      default:
        logStripeWebhook("event_unhandled", {
          eventType: event.type,
          eventId: event.id,
        });
        break;
    }
  } catch (e) {
    logStripeWebhook("handler_failed", {
      eventType: event.type,
      eventId: event.id,
      message: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json(
      { ok: false, received: true, error: "handler_failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, received: true, eventId: event.id });
}
