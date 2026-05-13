/** Origem pública do site (links de agendamento, checkout). */
export function getPublicAppOrigin(): string | null {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

export function appointmentPublicUrl(accessToken: string): string | null {
  const origin = getPublicAppOrigin();
  if (!origin) return null;
  return `${origin}/agendamento/${accessToken}`;
}
