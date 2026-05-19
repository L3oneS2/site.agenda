/**
 * Fonte única de verdade para status de agendamento (valor do ENUM no Postgres).
 * Labels em português só na UI — nunca persistir texto traduzido.
 */
export const APPOINTMENT_STATUS = {
  SCHEDULED: "scheduled",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
  NO_SHOW: "no_show",
} as const;

export type AppointmentStatus =
  (typeof APPOINTMENT_STATUS)[keyof typeof APPOINTMENT_STATUS];

export const APPOINTMENT_STATUS_VALUES: readonly AppointmentStatus[] = [
  APPOINTMENT_STATUS.SCHEDULED,
  APPOINTMENT_STATUS.COMPLETED,
  APPOINTMENT_STATUS.CANCELLED,
  APPOINTMENT_STATUS.NO_SHOW,
];

export const APPOINTMENT_STATUS_LABEL: Record<AppointmentStatus, string> = {
  scheduled: "Agendado",
  completed: "Finalizado",
  cancelled: "Cancelado",
  no_show: "Não compareceu",
};

/** Legado: enum antigo usava `canceled` (uma letra). */
const LEGACY_CANCELLED = "canceled";

export function isAppointmentStatus(value: string): value is AppointmentStatus {
  return (APPOINTMENT_STATUS_VALUES as readonly string[]).includes(value);
}

/** Normaliza leituras do banco / APIs (inclui `canceled` legado). */
export function normalizeAppointmentStatus(
  raw: string | null | undefined
): AppointmentStatus {
  const s = String(raw ?? "").trim();
  if (s === LEGACY_CANCELLED) return APPOINTMENT_STATUS.CANCELLED;
  if (isAppointmentStatus(s)) return s;
  return APPOINTMENT_STATUS.SCHEDULED;
}

export function appointmentStatusLabel(
  status: string | null | undefined
): string {
  return APPOINTMENT_STATUS_LABEL[normalizeAppointmentStatus(status)];
}

