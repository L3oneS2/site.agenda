/**
 * Variáveis públicas do Supabase (browser, middleware, Server Components).
 * Valores vazios após trim contam como ausentes.
 */

export type PublicSupabaseConfig = {
  url: string;
  anonKey: string;
};

export type PublicSupabaseEnvResult =
  | { ok: true; url: string; anonKey: string }
  | { ok: false; message: string };

function normalizeEnvValue(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const t = value.trim();
  return t.length > 0 ? t : undefined;
}

/**
 * Normaliza a URL do projeto (evita fetch failed por "/" no fim, http faltando, path extra).
 */
export function normalizeSupabaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "");
  const withScheme = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL não é uma URL válida. Use algo como https://xxxx.supabase.co"
    );
  }

  if (!parsed.hostname) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL sem hostname válido.");
  }

  return parsed.origin;
}

/**
 * Lê NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY sem lançar.
 */
export function getPublicSupabaseEnv(): PublicSupabaseEnvResult {
  const url = normalizeEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const anonKey = normalizeEnvValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  if (!url || !anonKey) {
    const missing: string[] = [];
    if (!url) missing.push("NEXT_PUBLIC_SUPABASE_URL");
    if (!anonKey) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");

    return {
      ok: false,
      message: [
        "Supabase: variáveis de ambiente ausentes ou vazias: " + missing.join(", ") + ".",
        "",
        "Crie ou edite o arquivo .env.local na raiz do projeto (mesmo nível que package.json) com:",
        "NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co",
        "NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...",
        "",
        "Depois pare e rode novamente: npm run dev",
      ].join("\n"),
    };
  }

  let normalizedUrl: string;
  try {
    normalizedUrl = normalizeSupabaseUrl(url);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "URL inválida";
    return {
      ok: false,
      message: msg,
    };
  }

  return { ok: true, url: normalizedUrl, anonKey };
}

/**
 * Para Server Components / Route Handlers que devem falhar cedo com mensagem clara.
 */
export function requirePublicSupabaseEnv(): PublicSupabaseConfig {
  const r = getPublicSupabaseEnv();
  if (!r.ok) {
    throw new Error(r.message);
  }
  return { url: r.url, anonKey: r.anonKey };
}
