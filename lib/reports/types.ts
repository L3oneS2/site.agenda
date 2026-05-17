import type { ReportDateRange } from "@/lib/reports/date-range";

export type ReportAppointmentRow = {
  id: string;
  data: string;
  hora_fim: string;
  status: string;
  servico_id: string | null;
  service_nome: string | null;
  preco: number | null;
  cliente_telefone: string;
};

export type ReportCounts = {
  total: number;
  completed: number;
  cancelled: number;
  no_show: number;
  pending: number;
};

export type ReportFinancial = {
  revenueTotal: number;
  ticketMedio: number;
  servicesCompletedCount: number;
  topServiceByRevenue: { nome: string; revenue: number } | null;
};

export type ReportDailyPoint = {
  date: string;
  revenue: number;
  appointments: number;
  completed: number;
};

export type ReportServiceRow = {
  servico_id: string | null;
  nome: string;
  count: number;
  revenue: number;
};

export type ReportSummary = {
  range: ReportDateRange;
  counts: ReportCounts;
  financial: ReportFinancial;
  uniqueClients: number;
  daily: ReportDailyPoint[];
  byService: ReportServiceRow[];
  insights: string[];
};
