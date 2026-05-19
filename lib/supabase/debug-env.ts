/** Áreas do app para logs opt-in (`DEBUG_APP=1` ou `NODE_ENV=development`). */
export type AppDebugArea = "auth" | "booking" | "bootstrap" | "agenda";

/**
 * Uma linha JSON para logs operacionais (grep / agregadores). Evite colocar PII em `fields`.
 */
function shouldEmitJsonLine(fields: Record<string, unknown>): boolean {
  if (process.env.NODE_ENV === "development" || process.env.DEBUG_APP === "1") {
    return true;
  }
  const where = typeof fields.where === "string" ? fields.where : "";
  return where.startsWith("cron.") || where.startsWith("stripe.webhook");
}

export function logJsonLine(fields: Record<string, unknown>): void {
  if (!shouldEmitJsonLine(fields)) {
    return;
  }
  // eslint-disable-next-line no-console
  console.error(JSON.stringify({ t: new Date().toISOString(), ...fields }));
}

/**
 * Log JSON único no servidor ou Edge (sem PII). Use para falhas de configuração em middleware.
 */
export function logGatewayError(where: string, message: string): void {
  // Falhas de configuração no Edge: sempre registrar (sem PII).
  // eslint-disable-next-line no-console
  console.error(JSON.stringify({ t: new Date().toISOString(), where, message }));
}

/**
 * Logs no browser: `NODE_ENV=development` ou `NEXT_PUBLIC_DEBUG_APP=1`.
 * Preferir a `console.error` genérico em fluxos de UI para reduzir ruído em produção.
 */
export function logClientDebug(
  area: AppDebugArea,
  message: string,
  detail?: Record<string, unknown>
): void {
  const enabled =
    typeof process !== "undefined" &&
    (process.env.NODE_ENV === "development" ||
      process.env.NEXT_PUBLIC_DEBUG_APP === "1");
  if (!enabled) return;
  // eslint-disable-next-line no-console
  console.warn(
    `[app-debug · ${area}]`,
    message,
    detail && Object.keys(detail).length > 0 ? detail : ""
  );
}

/**
 * Logs estruturados leves (auth / agendamento / trial / bootstrap).
 * Ative `DEBUG_APP=1` em qualquer ambiente para ver no servidor ou no browser.
 */
export function logAppDebug(
  area: AppDebugArea,
  message: string,
  detail?: Record<string, unknown>
): void {
  if (process.env.NODE_ENV !== "development" && process.env.DEBUG_APP !== "1") {
    return;
  }
  // eslint-disable-next-line no-console
  console.log(`[app-debug · ${area}]`, message, detail && Object.keys(detail).length > 0 ? detail : "");
}

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
