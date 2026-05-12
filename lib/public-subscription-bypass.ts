/**
 * Bypass da checagem pública de assinatura (apenas desenvolvimento / preview local).
 * Nunca ativo quando `VERCEL_ENV=production` ou `NODE_ENV=production` — a env pode existir,
 * mas é ignorada nesses casos (evita bypass acidental em deploy).
 */
export function isPublicSubscriptionBypassEnabled(): boolean {
  if (process.env.VERCEL_ENV === "production") return false;
  if (process.env.NODE_ENV === "production") return false;
  return process.env.PUBLIC_BYPASS_SUBSCRIPTION === "1";
}
