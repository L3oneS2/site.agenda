/** Chaves que não devem existir no ambiente durante `next build` / OpenNext (runtime = painel Cloudflare). */
export const SERVER_SECRET_ENV_KEYS = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "CRON_SECRET",
  "TRIAL_IDENTITY_PEPPER",
];

/** Padrões que não devem aparecer em `.open-next/` após o build (evitar strings genéricas do código-fonte). */
export const BUNDLE_SECRET_PATTERNS = [
  { id: "stripe_live_sk", re: /sk_live_[A-Za-z0-9]{20,}/ },
  { id: "stripe_test_sk", re: /sk_test_[A-Za-z0-9]{20,}/ },
  { id: "stripe_whsec", re: /whsec_[A-Za-z0-9]{20,}/ },
];
