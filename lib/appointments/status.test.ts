import { describe, expect, it } from "vitest";
import {
  APPOINTMENT_STATUS,
  appointmentStatusLabel,
  normalizeAppointmentStatus,
} from "@/lib/appointments/status";

describe("appointment status", () => {
  it("normaliza canceled legado para cancelled", () => {
    expect(normalizeAppointmentStatus("canceled")).toBe(
      APPOINTMENT_STATUS.CANCELLED
    );
  });

  it("labels em português", () => {
    expect(appointmentStatusLabel("scheduled")).toBe("Agendado");
    expect(appointmentStatusLabel("completed")).toBe("Finalizado");
    expect(appointmentStatusLabel("cancelled")).toBe("Cancelado");
    expect(appointmentStatusLabel("no_show")).toBe("Não compareceu");
  });
});
