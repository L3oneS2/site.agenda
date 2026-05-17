import type { ReportDateRange } from "@/lib/reports/date-range";
import { weekdayLabelPt } from "@/lib/reports/timezone";
import type {
  ReportAppointmentRow,
  ReportCounts,
  ReportDailyPoint,
  ReportFinancial,
  ReportServiceRow,
} from "@/lib/reports/types";
import { countByStatus } from "@/lib/reports/aggregate";

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

type InsightInput = {
  rows: ReportAppointmentRow[];
  previousRows: ReportAppointmentRow[] | null;
  range: ReportDateRange;
  counts: ReportCounts;
  financial: ReportFinancial;
  daily: ReportDailyPoint[];
  byService: ReportServiceRow[];
  now: Date;
};

export function buildReportInsights(input: InsightInput): string[] {
  const out: string[] = [];
  const { financial, daily, byService, previousRows, counts } = input;

  if (counts.total === 0) {
    out.push("Nenhum agendamento no período selecionado.");
    return out;
  }

  if (financial.topServiceByRevenue && financial.topServiceByRevenue.revenue > 0) {
    out.push(
      `O serviço mais lucrativo foi ${financial.topServiceByRevenue.nome} (${brl.format(financial.topServiceByRevenue.revenue)}).`
    );
  }

  const topByCount = byService[0];
  if (topByCount && topByCount.count > 0) {
    out.push(
      `O serviço mais realizado foi ${topByCount.nome} (${topByCount.count} atendimento${topByCount.count === 1 ? "" : "s"}).`
    );
  }

  let bestDay: ReportDailyPoint | null = null;
  for (const d of daily) {
    if (d.revenue <= 0) continue;
    if (!bestDay || d.revenue > bestDay.revenue) bestDay = d;
  }
  if (bestDay) {
    const label = weekdayLabelPt(bestDay.date);
    out.push(
      `${label.charAt(0).toUpperCase() + label.slice(1)} foi seu dia mais lucrativo (${brl.format(bestDay.revenue)}).`
    );
  }

  if (previousRows && previousRows.length >= 0) {
    const prevCounts = countByStatus(previousRows, input.now);
    const cur = counts.total;
    const prev = prevCounts.total;
    if (prev > 0 && cur !== prev) {
      const pct = Math.round(((cur - prev) / prev) * 100);
      if (pct > 0) {
        out.push(`Você teve aumento de ${pct}% nos agendamentos em relação ao período anterior.`);
      } else if (pct < 0) {
        out.push(
          `Os agendamentos caíram ${Math.abs(pct)}% em relação ao período anterior.`
        );
      }
    } else if (prev === 0 && cur > 0) {
      out.push("Este é o primeiro período com agendamentos registrados na comparação.");
    }

    const prevCompleted = prevCounts.completed;
    if (prevCompleted > 0 && financial.servicesCompletedCount !== prevCompleted) {
      const pctC = Math.round(
        ((financial.servicesCompletedCount - prevCompleted) / prevCompleted) * 100
      );
      if (pctC > 0) {
        out.push(`Serviços realizados cresceram ${pctC}% vs. período anterior.`);
      }
    }
  }

  if (counts.cancelled > 0 && counts.total > 0) {
    const pct = Math.round((counts.cancelled / counts.total) * 100);
    out.push(`${pct}% dos agendamentos do período foram cancelados.`);
  }

  if (counts.no_show > 0) {
    out.push(
      `${counts.no_show} cliente${counts.no_show === 1 ? "" : "s"} não compareceu${counts.no_show === 1 ? "" : "ram"}.`
    );
  }

  return out.slice(0, 6);
}
