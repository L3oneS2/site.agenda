import type { ReportSummary } from "@/lib/reports/types";

/** Payload estável para exportação PDF/Excel (implementação futura). */
export type ReportExportPayload = {
  generatedAt: string;
  timezone: string;
  summary: ReportSummary;
  formats: {
    pdf: { ready: boolean; note: string };
    excel: { ready: boolean; note: string };
  };
};

export function prepareReportExportPayload(
  summary: ReportSummary,
  timezone: string
): ReportExportPayload {
  return {
    generatedAt: new Date().toISOString(),
    timezone,
    summary,
    formats: {
      pdf: {
        ready: false,
        note: "Exportação PDF será disponibilizada em atualização futura.",
      },
      excel: {
        ready: false,
        note: "Exportação Excel será disponibilizada em atualização futura.",
      },
    },
  };
}
