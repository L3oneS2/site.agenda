import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { cache } from "react";
import {
  getPublicSupabaseEnv,
  requirePublicSupabaseEnv,
} from "@/lib/supabase/public-env";

async function createServerClientWithCookies(
  url: string,
  anonKey: string
): Promise<SupabaseClient> {
  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(
        cookiesToSet: {
          name: string;
          value: string;
          options?: Record<string, unknown>;
        }[]
      ) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          /* set from Server Component */
        }
      },
    },
  });
}

/** Uma instância por request RSC / Server Action (deduplicada via React `cache`). */
const getServerSupabase = cache(async (): Promise<SupabaseClient | null> => {
  const env = getPublicSupabaseEnv();
  if (!env.ok) {
    return null;
  }
  return createServerClientWithCookies(env.url, env.anonKey);
});

/**
 * Quando URL/anon key ausentes (ex.: `next build` sem .env), retorna null em vez de lançar.
 * Use em layouts e helpers que rodam na geração estática.
 */
export async function tryCreateClient(): Promise<SupabaseClient | null> {
  return getServerSupabase();
}

/**
 * Para Server Actions, Route Handlers e páginas que exigem Supabase configurado.
 */
export async function createClient(): Promise<SupabaseClient> {
  requirePublicSupabaseEnv();
  const client = await getServerSupabase();
  if (!client) {
    throw new Error("Supabase não configurado.");
  }
  return client;
}
