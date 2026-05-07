import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getPublicSupabaseEnv } from "@/lib/supabase/public-env";

/**
 * Cliente Supabase **somente para o navegador** (componentes `"use client"`).
 *
 * - Usa `createBrowserClient` de `@supabase/ssr` (nunca `createServerClient`).
 * - Sessão em cookies + PKCE, compatível com `middleware.ts` no App Router.
 * - Chame apenas em event handlers / `useEffect`, nunca durante o render no SSR.
 */
export function createClient(): SupabaseClient {
  if (typeof window === "undefined") {
    throw new Error(
      "[supabaseClient] createClient() só pode rodar no browser. " +
        "Em Server Components, Server Actions ou Route Handlers use `@/lib/supabase/server`."
    );
  }

  const env = getPublicSupabaseEnv();
  if (!env.ok) {
    throw new Error(env.message);
  }

  const { url: supabaseUrl, anonKey: supabaseAnonKey } = env;

  if (process.env.NODE_ENV === "development") {
    // eslint-disable-next-line no-console
    console.info("[supabaseClient] browser init", {
      supabaseOrigin: supabaseUrl,
      anonKeyLength: supabaseAnonKey.length,
      authEndpoint: `${supabaseUrl}/auth/v1/signup`,
    });
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey, {
    isSingleton: true,
    global: {
      fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
        try {
          return await fetch(input as RequestInfo, init);
        } catch (err) {
          if (process.env.NODE_ENV === "development") {
            const target =
              typeof input === "string"
                ? input
                : input instanceof Request
                  ? input.url
                  : String(input);
            // eslint-disable-next-line no-console
            console.error("[supabaseClient] fetch error", {
              url: target,
              cause: err instanceof Error ? err.cause : undefined,
              message: err instanceof Error ? err.message : String(err),
            });
          }
          throw err;
        }
      },
    },
  });
}
