import { APP_URL } from "@/lib/config";

/** Origem pública do site (links de agendamento, checkout). */
export function getPublicAppOrigin(): string | null {
  try {
    return new URL(APP_URL).origin;
  } catch {
    return null;
  }
}

export function appointmentPublicUrl(accessToken: string): string | null {
  const origin = getPublicAppOrigin();
  if (!origin) return null;
  return `${origin}/agendamento/${accessToken}`;
}
