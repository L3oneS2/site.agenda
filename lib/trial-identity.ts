import { createHash } from "node:crypto";

export function getTrialIdentityPepper(): string {
  const p = process.env.TRIAL_IDENTITY_PEPPER?.trim();
  if (p) return p;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "TRIAL_IDENTITY_PEPPER é obrigatório em produção (hash seguro dos identificadores de trial)."
    );
  }
  return "__development_trial_pepper_change_me__";
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

/** Hash estável combinando sinais enviados pelo browser (never trust só dispositivo). */
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
