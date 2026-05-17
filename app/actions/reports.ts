"use server";

import { createClient } from "@/lib/supabase/server";
import { autoCompleteBarberAppointments } from "@/app/actions/barber";
import { requireBarber } from "@/lib/auth";
import { buildReportSummary } from "@/lib/reports/aggregate";
import {
  previousPeriodRange,
  resolveReportDateRange,
  type ReportPeriodPreset,
} from "@/lib/reports/date-range";
import { prepareReportExportPayload } from "@/lib/reports/export-types";
import type { ReportAppointmentRow, ReportSummary } from "@/lib/reports/types";
import { REPORT_TIMEZONE } from "@/lib/reports/timezone";
import { normalizeAppointmentStatus } from "@/lib/appointments/status";
import { normalizeIsoDateFromDb } from "@/lib/scheduling";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function mapRows(data: unknown[] | null): ReportAppointmentRow[] {
  if (!data?.length) return [];
  return data.map((raw) => {
    const row = raw as Record<string, unknown>;
    const services = row.services;
    let joined: Record<string, unknown> | null = null;
    if (Array.isArray(services) && services[0] && typeof services[0] === "object") {
      joined = services[0] as Record<string, unknown>;
    } else if (services && typeof services === "object") {
      joined = services as Record<string, unknown>;
    }
    return {
      id: String(row.id),
      data: normalizeIsoDateFromDb(row.data),
      hora_fim: String(row.hora_fim ?? ""),
      status: normalizeAppointmentStatus(String(row.status ?? "scheduled")),
      servico_id: row.servico_id != null ? String(row.servico_id) : null,
      service_nome: joined?.nome != null ? String(joined.nome) : null,
      preco: joined?.preco != null ? Number(joined.preco) : null,
      cliente_telefone: String(row.cliente_telefone ?? ""),
    };
  });
}

async function fetchAppointmentsForRange(
  barberId: string,
  from: string,
  to: string
): Promise<{ rows?: ReportAppointmentRow[]; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("appointments")
    .select(
      "id, data, hora_fim, status, servico_id, cliente_telefone, services ( nome, preco )"
    )
    .eq("barber_id", barberId)
    .gte("data", from)
    .lte("data", to)
    .order("data")
    .order("hora_inicio")
    .limit(5000);

  if (error) return { error: error.message };
  return { rows: mapRows(data ?? []) };
}

export type GetBarberReportInput = {
  preset: ReportPeriodPreset;
  customFrom?: string;
  customTo?: string;
  /** MVP: só o próprio barbeiro; futuro multi-profissional. */
  barberId?: string;
};

export async function getBarberReport(
  input: GetBarberReportInput
): Promise<{ summary?: ReportSummary; error?: string }> {
  const { user } = await requireBarber();
  await autoCompleteBarberAppointments();

  const targetBarberId = input.barberId?.trim() || user.id;
  if (!UUID_RE.test(targetBarberId)) {
    return { error: "Barbeiro inválido." };
  }
  if (targetBarberId !== user.id) {
    return { error: "Filtro por outro barbeiro ainda não disponível nesta conta." };
  }

  const resolved = resolveReportDateRange(
    input.preset,
    input.customFrom,
    input.customTo
  );
  if (resolved.error || !resolved.range) {
    return { error: resolved.error ?? "Período inválido." };
  }

  const range = resolved.range;
  const prev = previousPeriodRange(range);

  const [current, previous] = await Promise.all([
    fetchAppointmentsForRange(targetBarberId, range.from, range.to),
    fetchAppointmentsForRange(targetBarberId, prev.from, prev.to),
  ]);

  if (current.error) return { error: current.error };
  if (previous.error) return { error: previous.error };

  const summary = buildReportSummary(
    current.rows ?? [],
    range,
    previous.rows ?? []
  );

  return { summary };
}

export async function getBarberReportExportPayload(input: GetBarberReportInput) {
  const r = await getBarberReport(input);
  if (r.error || !r.summary) {
    return { error: r.error ?? "Relatório indisponível." };
  }
  return {
    payload: prepareReportExportPayload(r.summary, REPORT_TIMEZONE),
  };
}

/** Lista para filtro de barbeiro (MVP: apenas o usuário atual). */
export async function getReportBarberOptions(): Promise<{
  barbers?: { id: string; label: string }[];
  error?: string;
}> {
  const { user, profile } = await requireBarber();
  const label = profile.nome?.trim() || "Você";
  return {
    barbers: [{ id: user.id, label }],
  };
}
