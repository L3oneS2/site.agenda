import { createHash, timingSafeEqual } from "node:crypto";

function sha256Utf8(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

/**
 * Valida `Authorization: Bearer <token>` contra o secret com comparação de hash (tamanho fixo),
 * reduzindo vazamento por timing do tamanho do secret.
 */
export function cronBearerMatchesSecret(secret: string, authorization: string | null): boolean {
  const m = /^Bearer\s+(\S+)\s*$/i.exec(authorization ?? "");
  if (!m) return false;
  const token = m[1] ?? "";
  if (!token) return false;
  try {
    return timingSafeEqual(sha256Utf8(secret), sha256Utf8(token));
  } catch {
    return false;
  }
}

/** Opcional: exige User-Agent típico do Vercel Cron (`CRON_REQUIRE_VERCEL_UA=1`). */
export function cronUserAgentAllowed(userAgent: string | null): boolean {
  if (process.env.CRON_REQUIRE_VERCEL_UA !== "1") return true;
  const ua = userAgent ?? "";
  return ua.includes("Vercel-Cron") || ua.includes("vercel-cron");
}
