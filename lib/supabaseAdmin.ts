import { createClient } from "@supabase/supabase-js";
import { requirePublicSupabaseEnv } from "@/lib/supabase/public-env";

function normalizeEnvValue(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const t = value.trim();
  return t.length > 0 ? t : undefined;
}

export function createAdminClient() {
  const { url } = requirePublicSupabaseEnv();
  const key = normalizeEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY ausente ou vazia no .env.local. Obtenha em Project Settings → API (service_role) e reinicie o servidor."
    );
  }
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
