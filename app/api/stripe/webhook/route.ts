import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

async function syncSubscriptionFromStripe(
  stripeSub: Stripe.Subscription,
  fallbackUserId?: string | null
) {
  const admin = createAdminClient();
  const userId =
    stripeSub.metadata?.supabase_user_id ?? fallbackUserId ?? null;

  if (!userId) {
    console.error("Stripe subscription sem supabase_user_id", stripeSub.id);
    return;
  }

  const { data: existing } = await admin
    .from("subscriptions")
    .select("trial_start_date,trial_end_date")
    .eq("user_id", userId)
    .maybeSingle();

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

  if (error) console.error("Erro ao sincronizar assinatura:", error);
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "STRIPE_WEBHOOK_SECRET ausente" },
      { status: 500 }
    );
  }

  const body = await request.text();
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Sem assinatura" }, { status: 400 });
  }

  const stripe = getStripe();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Webhook inválido";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.supabase_user_id;
        if (session.mode !== "subscription" || !session.subscription) break;

        const subId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription.id;

        const stripeSub = await stripe.subscriptions.retrieve(subId);
        await syncSubscriptionFromStripe(stripeSub, userId);
        break;
      }
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const subRef = invoice.subscription;
        if (!subRef) break;
        const subId = typeof subRef === "string" ? subRef : subRef.id;
        const stripeSub = await stripe.subscriptions.retrieve(subId);
        await syncSubscriptionFromStripe(stripeSub);
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subRef = invoice.subscription;
        if (!subRef) break;
        const subId = typeof subRef === "string" ? subRef : subRef.id;
        const admin = createAdminClient();
        await admin
          .from("subscriptions")
          .update({
            status: "expired",
            account_blocked: true,
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_subscription_id", subId);
        break;
      }
      case "customer.subscription.deleted": {
        const stripeSub = event.data.object as Stripe.Subscription;
        const admin = createAdminClient();
        await admin
          .from("subscriptions")
          .update({
            status: "canceled",
            account_blocked: true,
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_subscription_id", stripeSub.id);
        break;
      }
      default:
        break;
    }
  } catch (e) {
    console.error(e);
    return NextResponse.json({ received: true, error: true }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
