/**
 * Logs seguros para debug (apenas desenvolvimento). Nunca imprime a chave completa.
 */
export function logSupabasePublicEnvDebug(context: string): void {
  if (process.env.NODE_ENV !== "development") return;

  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const rawKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let origin = "(inválida)";
  try {
    if (rawUrl) {
      const s = rawUrl.trim().replace(/\/+$/, "");
      const withScheme = /^https?:\/\//i.test(s) ? s : `https://${s}`;
      origin = new URL(withScheme).origin;
    }
  } catch {
    origin = "(parse error)";
  }

  // eslint-disable-next-line no-console
  console.log(`[Supabase debug · ${context}]`, {
    NEXT_PUBLIC_SUPABASE_URL_defined: Boolean(rawUrl?.trim()),
    resolved_origin: origin,
    NEXT_PUBLIC_SUPABASE_ANON_KEY_defined: Boolean(rawKey?.trim()),
    anon_key_length: rawKey?.trim().length ?? 0,
    anon_key_prefix:
      rawKey && rawKey.length >= 12
        ? `${rawKey.slice(0, 8)}…${rawKey.slice(-4)}`
        : rawKey
          ? "(curta demais — verifique)"
          : "(ausente)",
  });
}

/** Motivos tratados pelo app (toast); em dev, evita `console.error` → overlay do Next.js. */
const USER_FACING_AUTH_CODES = new Set([
  "invalid_credentials",
  "email_not_confirmed",
  "same_password",
  "user_already_exists",
  "weak_password",
]);

export function logAuthError(context: string, error: unknown): void {
  if (error && typeof error === "object" && "message" in error) {
    const e = error as {
      message: string;
      status?: number;
      name?: string;
      code?: string;
    };
    const line =
      `[${e.code ?? "—"}] ${e.message}` +
      (typeof e.status === "number" ? ` (HTTP ${e.status})` : "");
    const payload = {
      message: e.message,
      status: e.status,
      name: e.name,
      code: e.code,
    };
    const benign =
      e.code !== undefined && USER_FACING_AUTH_CODES.has(e.code);
    if (benign) {
      // eslint-disable-next-line no-console
      console.warn(`[Auth · ${context}]`, line, payload);
    } else {
      // eslint-disable-next-line no-console
      console.error(`[Auth · ${context}]`, line, payload);
    }
    return;
  }
  // eslint-disable-next-line no-console
  console.error(`[Auth · ${context}]`, error);
}
