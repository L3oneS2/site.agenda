import { eachDayInRange } from "@/lib/reports/date-range";
import type {
  ReportAppointmentRow,
  ReportCounts,
  ReportDailyPoint,
  ReportFinancial,
  ReportServiceRow,
  ReportSummary,
} from "@/lib/reports/types";
import type { ReportDateRange } from "@/lib/reports/date-range";
import { buildReportInsights } from "@/lib/reports/insights";
import { appointmentEndPassed } from "@/lib/reports/timezone";
import {
  APPOINTMENT_STATUS,
  normalizeAppointmentStatus,
} from "@/lib/appointments/status";

function parsePreco(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** Pendente = agendado e ainda não terminou no fuso de relatórios. */
export function isPendingAppointment(row: ReportAppointmentRow, now = new Date()): boolean {
  if (normalizeAppointmentStatus(row.status) !== APPOINTMENT_STATUS.SCHEDULED) {
    return false;
  }
  return !appointmentEndPassed(row.data, row.hora_fim, now);
}

export function isCompletedForRevenue(row: ReportAppointmentRow): boolean {
  return normalizeAppointmentStatus(row.status) === APPOINTMENT_STATUS.COMPLETED;
}

export function countByStatus(
  rows: ReportAppointmentRow[],
  now = new Date()
): ReportCounts {
  let completed = 0;
  let cancelled = 0;
  let no_show = 0;
  let pending = 0;

  for (const r of rows) {
    const status = normalizeAppointmentStatus(r.status);
    switch (status) {
      case APPOINTMENT_STATUS.COMPLETED:
        completed++;
        break;
      case APPOINTMENT_STATUS.CANCELLED:
        cancelled++;
        break;
      case APPOINTMENT_STATUS.NO_SHOW:
        no_show++;
        break;
      case APPOINTMENT_STATUS.SCHEDULED:
        pending++;
        break;
      default:
        break;
    }
  }

  return {
    total: rows.length,
    completed,
    cancelled,
    no_show,
    pending,
  };
}

export function computeFinancial(rows: ReportAppointmentRow[]): ReportFinancial {
  const completedRows = rows.filter(isCompletedForRevenue);
  let revenueTotal = 0;
  let withPrice = 0;

  const revenueByService = new Map<string, { nome: string; revenue: number; count: number }>();

  for (const r of completedRows) {
    const preco = parsePreco(r.preco);
    if (r.servico_id && preco > 0) {
      revenueTotal += preco;
      withPrice++;
    }
    const key = r.servico_id ?? "__none__";
    const nome = r.service_nome ?? "Sem serviço";
    const cur = revenueByService.get(key) ?? { nome, revenue: 0, count: 0 };
    cur.count++;
    if (preco > 0) cur.revenue += preco;
    revenueByService.set(key, cur);
  }

  let topServiceByRevenue: ReportFinancial["topServiceByRevenue"] = null;
  for (const v of revenueByService.values()) {
    if (!topServiceByRevenue || v.revenue > topServiceByRevenue.revenue) {
      topServiceByRevenue = { nome: v.nome, revenue: v.revenue };
    }
  }

  const ticketMedio =
    withPrice > 0 ? Math.round((revenueTotal / withPrice) * 100) / 100 : 0;

  return {
    revenueTotal: Math.round(revenueTotal * 100) / 100,
    ticketMedio,
    servicesCompletedCount: completedRows.length,
    topServiceByRevenue,
  };
}

export function buildDailySeries(
  rows: ReportAppointmentRow[],
  range: ReportDateRange,
  _now = new Date()
): ReportDailyPoint[] {
  const days = eachDayInRange(range.from, range.to);
  const byDate = new Map<string, ReportDailyPoint>();
  for (const d of days) {
    byDate.set(d, { date: d, revenue: 0, appointments: 0, completed: 0 });
  }

  for (const r of rows) {
    const pt = byDate.get(r.data);
    if (!pt) continue;
    pt.appointments++;
    if (normalizeAppointmentStatus(r.status) === APPOINTMENT_STATUS.COMPLETED) {
      pt.completed++;
      pt.revenue += parsePreco(r.preco);
    }
  }

  for (const pt of byDate.values()) {
    pt.revenue = Math.round(pt.revenue * 100) / 100;
  }

  return days.map((d) => byDate.get(d)!);
}

export function buildServiceBreakdown(rows: ReportAppointmentRow[]): ReportServiceRow[] {
  const map = new Map<string, ReportServiceRow>();

  for (const r of rows) {
    if (normalizeAppointmentStatus(r.status) !== APPOINTMENT_STATUS.COMPLETED) continue;
    const key = r.servico_id ?? "__none__";
    const nome = r.service_nome ?? "Sem serviço";
    const cur = map.get(key) ?? {
      servico_id: r.servico_id,
      nome,
      count: 0,
      revenue: 0,
    };
    cur.count++;
    cur.revenue += parsePreco(r.preco);
    map.set(key, cur);
  }

  return [...map.values()]
    .map((s) => ({ ...s, revenue: Math.round(s.revenue * 100) / 100 }))
    .sort((a, b) => b.count - a.count);
}

export function uniqueClientsServed(rows: ReportAppointmentRow[]): number {
  const set = new Set<string>();
  for (const r of rows) {
    if (normalizeAppointmentStatus(r.status) !== APPOINTMENT_STATUS.COMPLETED) continue;
    const tel = r.cliente_telefone.replace(/\D/g, "");
    if (tel) set.add(tel);
    else set.add(r.id);
  }
  return set.size;
}

export function buildReportSummary(
  rows: ReportAppointmentRow[],
  range: ReportDateRange,
  previousRows: ReportAppointmentRow[] | null,
  now = new Date()
): ReportSummary {
  const counts = countByStatus(rows, now);
  const financial = computeFinancial(rows);
  const daily = buildDailySeries(rows, range, now);
  const byService = buildServiceBreakdown(rows);
  const uniqueClients = uniqueClientsServed(rows);
  const insights = buildReportInsights({
    rows,
    previousRows,
    range,
    counts,
    financial,
    daily,
    byService,
    now,
  });

  return {
    range,
    counts,
    financial,
    uniqueClients,
    daily,
    byService,
    insights,
  };
}
