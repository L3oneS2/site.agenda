import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requirePublicSupabaseEnv } from "@/lib/supabase/public-env";

function normalizeEnvValue(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const t = value.trim();
  return t.length > 0 ? t : undefined;
}

export function isServiceRoleKeyConfigured(): boolean {
  return Boolean(normalizeEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY));
}

/**
 * Cliente admin (service_role). Retorna `null` se a chave não estiver definida
 * — use para fallback seguro sem derrubar o processo.
 */
export function tryCreateAdminClient(): SupabaseClient | null {
  let url: string;
  try {
    ({ url } = requirePublicSupabaseEnv());
  } catch {
    return null;
  }
  const key = normalizeEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!key) {
    return null;
  }
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/** Para webhooks, cron e fluxos que exigem bypass de RLS. */
export function createAdminClient(): SupabaseClient {
  const client = tryCreateAdminClient();
  if (!client) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY ausente ou vazia. Em produção, configure em Vercel → Settings → Environment Variables (redeploy após salvar). Em dev, use .env.local e reinicie `npm run dev`."
    );
  }
  return client;
}
