import { describe, expect, it } from "vitest";
import { APPOINTMENT_STATUS } from "@/lib/appointments/status";
import { buildReportSummary } from "@/lib/reports/aggregate";
import type { ReportAppointmentRow } from "@/lib/reports/types";

describe("buildReportSummary", () => {
  it("fatura apenas completed e ignora cancelados", () => {
    const rows: ReportAppointmentRow[] = [
      {
        id: "1",
        data: "2026-05-10",
        hora_fim: "10:30:00",
        status: APPOINTMENT_STATUS.COMPLETED,
        servico_id: "s1",
        service_nome: "Corte",
        preco: 50,
        cliente_telefone: "11999999999",
      },
      {
        id: "2",
        data: "2026-05-10",
        hora_fim: "11:00:00",
        status: APPOINTMENT_STATUS.CANCELLED,
        servico_id: "s1",
        service_nome: "Corte",
        preco: 50,
        cliente_telefone: "11888888888",
      },
      {
        id: "3",
        data: "2026-05-11",
        hora_fim: "12:00:00",
        status: APPOINTMENT_STATUS.NO_SHOW,
        servico_id: "s1",
        service_nome: "Corte",
        preco: 50,
        cliente_telefone: "11777777777",
      },
    ];

    const summary = buildReportSummary(
      rows,
      { preset: "custom", from: "2026-05-10", to: "2026-05-11" },
      [],
      new Date("2026-05-17T12:00:00.000Z")
    );

    expect(summary.financial.revenueTotal).toBe(50);
    expect(summary.counts.completed).toBe(1);
    expect(summary.counts.cancelled).toBe(1);
    expect(summary.counts.no_show).toBe(1);
  });

  it("aceita legado canceled no banco", () => {
    const rows: ReportAppointmentRow[] = [
      {
        id: "1",
        data: "2026-05-10",
        hora_fim: "10:30:00",
        status: "canceled",
        servico_id: "s1",
        service_nome: "Corte",
        preco: 50,
        cliente_telefone: "11999999999",
      },
    ];
    const summary = buildReportSummary(
      rows,
      { preset: "custom", from: "2026-05-10", to: "2026-05-10" },
      []
    );
    expect(summary.counts.cancelled).toBe(1);
  });
});
