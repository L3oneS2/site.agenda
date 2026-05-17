import { normalizeAppointmentStatus } from "@/lib/appointments/status";
import type { Appointment } from "@/lib/types";

/** Supabase pode inferir relação N:1 como array; normaliza para um objeto ou null. */
export function normalizeJoinedAppointments(data: unknown): Appointment[] {
  if (!Array.isArray(data)) return [];
  return data.map((item) => {
    const row = item as Record<string, unknown>;
    const s = row.services;
    const joined =
      Array.isArray(s) && s[0] && typeof s[0] === "object"
        ? (s[0] as Appointment["services"])
        : s && typeof s === "object"
          ? (s as Appointment["services"])
          : null;
    return {
      ...row,
      status: normalizeAppointmentStatus(String(row.status)),
      services: joined,
    } as Appointment;
  });
}
