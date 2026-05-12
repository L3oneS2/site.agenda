import { createHash } from "node:crypto";

let warnedShortTrialPepper = false;

/**
 * Pepper secreto para hashes de trial (e-mail/telefone/dispositivo).
 *
 * - **Produção:** defina `TRIAL_IDENTITY_PEPPER` com alta entropia (ex.: `openssl rand -hex 32`).
 *   Sem isso, fluxos que chamam `hashTrialIdentifier` antes de validar devem usar
 *   `trialIdentityPepperMissingMessage()` e retornar erro ao usuário em vez de lançar.
 * - **Desenvolvimento:** se ausente, usa placeholder fixo (nunca use isso em produção).
 */
export function getTrialIdentityPepper(): string {
  const p = process.env.TRIAL_IDENTITY_PEPPER?.trim();
  if (p) {
    if (
      process.env.NODE_ENV === "production" &&
      p.length < 24 &&
      !warnedShortTrialPepper
    ) {
      warnedShortTrialPepper = true;
      // eslint-disable-next-line no-console
      console.warn(
        "[trial-identity] TRIAL_IDENTITY_PEPPER muito curto em produção; recomenda-se 32+ bytes aleatórios (ex.: openssl rand -hex 32)."
      );
    }
    return p;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "TRIAL_IDENTITY_PEPPER é obrigatório em produção (hash de anti-fraude trial). " +
        "Gere um valor aleatório forte e configure no host (ex.: Vercel → Environment Variables)."
    );
  }
  return "__development_trial_pepper_change_me__";
}

/**
 * Se produção estiver sem `TRIAL_IDENTITY_PEPPER`, retorna mensagem segura para o usuário;
 * caso contrário `null` (pode prosseguir com os hashes).
 */
export function trialIdentityPepperMissingMessage(): string | null {
  if (process.env.NODE_ENV !== "production") return null;
  const p = process.env.TRIAL_IDENTITY_PEPPER?.trim();
  if (p) return null;
  return (
    "O cadastro não pôde ser concluído no servidor: falta a variável TRIAL_IDENTITY_PEPPER " +
    "(obrigatória em produção para anti-fraude). Quem administra o deploy deve definir um valor " +
    "aleatório forte no host (ex.: Vercel → Environment Variables) e fazer redeploy."
  );
}

export function hashTrialIdentifier(kind: string, normalized: string): string {
  const pepper = getTrialIdentityPepper();
  return createHash("sha256")
    .update(`${pepper}|${kind}|${normalized}`, "utf8")
    .digest("hex");
}

export function normalizeSignupEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizeDigits(raw: string): string {
  return raw.replace(/\D+/g, "");
}

/** Chave coarse para IPv4 /24 ou prefixo IPv6 (limita uso abusivo de IP). */
export function coarseIpSubnetKey(ip: string): string {
  const s = ip.trim();
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s);
  if (v4) return `${v4[1]}.${v4[2]}.${v4[3]}.0/24`;
  const parts = s.split(":");
  const head = parts.filter(Boolean).slice(0, 3).join(":");
  return head ? `${head}::/48` : "::/128";
}

export function clientIpFromHeaders(h: Headers): string {
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || "0.0.0.0";
  const realIp = h.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "0.0.0.0";
}

/**
 * Hash estável combinando sinais do browser.
 * Sem payload válido, todos os cadastros compartilhariam o mesmo hash ("missing") —
 * não use isso sozinho para bloqueio global (ver RPC finalize_barber_bootstrap).
 */
export function hashDevicePayloadJson(raw: unknown): string {
  if (!raw || typeof raw !== "object") {
    return hashTrialIdentifier("device", "missing");
  }
  const o = raw as Record<string, unknown>;
  const parts = [
    String(o.seed ?? ""),
    String(o.tz ?? ""),
    String(o.lang ?? ""),
    String(o.platform ?? ""),
  ].join("|");
  return hashTrialIdentifier("device", parts);
}
