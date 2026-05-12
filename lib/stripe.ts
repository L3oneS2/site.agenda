import Stripe from "stripe";

let stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripe) {
    const key = process.env.STRIPE_SECRET_KEY?.trim();
    if (!key) {
      throw new Error(
        "STRIPE_SECRET_KEY ausente ou vazia. Configure no host (ex.: Vercel → Environment Variables) e faça redeploy."
      );
    }
    stripe = new Stripe(key, { typescript: true });
  }
  return stripe;
}
