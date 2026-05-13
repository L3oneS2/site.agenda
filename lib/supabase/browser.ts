import { createBrowserClient } from "@supabase/ssr";
import { getPublicSupabaseEnv } from "@/lib/supabase/public-env";

/** Cliente browser (anon) para Realtime na agenda do barbeiro. */
export function createBrowserSupabase() {
  const r = getPublicSupabaseEnv();
  if (!r.ok) return null;
  return createBrowserClient(r.url, r.anonKey);
}
