"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireBarber } from "@/lib/auth";
import { barberWriteDeniedMessage } from "@/lib/barber-write-guard";
import { normalizeJoinedAppointments } from "@/lib/appointment-rows";
import { appointmentPublicUrl } from "@/lib/public-app-url";
import { logJsonLine } from "@/lib/supabase/debug-env";
import { runAutoCompleteAppointments } from "@/lib/appointments/auto-complete";
import {
  canShowCancelButton,
  canShowNoShowButton,
} from "@/lib/appointments/lifecycle";
import {
  APPOINTMENT_STATUS,
  normalizeAppointmentStatus,
} from "@/lib/appointments/status";
import {
  bookedRowsToIntervals,
  discreteSlotsFreeAndBlocked,
  normalizeIsoDateFromDb,
  normalizeTimeInput,
} from "@/lib/scheduling";
import { tryCreateAdminClient } from "@/lib/supabaseAdmin";
import type { AgendaDayMarker, AgendaDaySlot, Appointment } from "@/lib/types";

async function revalidatePublicBarbershopPage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
) {
  const { data: shop } = await supabase
    .from("barbershops")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (shop?.id) {
    revalidatePath(`/barbearia/${shop.id}`);
  }
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function monthRangeISO(year: number, monthIndex: number): { first: string; last: string } {
  const first = `${year}-${pad2(monthIndex + 1)}-01`;
  const lastD = new Date(Date.UTC(year, monthIndex + 1, 0, 12, 0, 0)).getUTCDate();
  const last = `${year}-${pad2(monthIndex + 1)}-${pad2(lastD)}`;
  return { first, last };
}

export async function listAgendaDaySlots(
  date: string
): Promise<{ slots?: AgendaDaySlot[]; error?: string }> {
  const { user } = await requireBarber();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("agenda_day_slots")
    .select("id, user_id, data, hora, created_at")
    .eq("user_id", user.id)
    .eq("data", date)
    .order("hora");

  if (error) return { error: error.message };
  return { slots: (data ?? []) as AgendaDaySlot[] };
}

export async function addAgendaDaySlot(formData: FormData) {
  const { user } = await requireBarber();
  const denied = await barberWriteDeniedMessage();
  if (denied) return { error: denied };

  const data = String(formData.get("data") ?? "").trim();
  const horaRaw = String(formData.get("hora") ?? "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return { error: "Data inválida." };
  }
  if (!horaRaw) {
    return { error: "Informe o horário." };
  }

  const hora = normalizeTimeInput(horaRaw.length <= 5 ? horaRaw : horaRaw.slice(0, 8));

  const supabase = await createClient();
  const { error } = await supabase.from("agenda_day_slots").insert({
    user_id: user.id,
    data,
    hora,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "Este horário já está cadastrado nesta data." };
    }
    return { error: error.message };
  }

  revalidatePath("/agenda");
  await revalidatePublicBarbershopPage(supabase, user.id);
  return { ok: true };
}

export async function deleteAgendaDaySlot(id: string) {
  const { user } = await requireBarber();
  const denied = await barberWriteDeniedMessage();
  if (denied) return { error: denied };
  const supabase = await createClient();
  const { error } = await supabase
    .from("agenda_day_slots")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/agenda");
  await revalidatePublicBarbershopPage(supabase, user.id);
  return { ok: true };
}

export async function getBarberAgendaMonthMarkers(
  year: number,
  monthIndex: number
): Promise<{ markers?: Record<string, AgendaDayMarker>; error?: string }> {
  const { user } = await requireBarber();
  const supabase = await createClient();

  const { data: services } = await supabase
    .from("services")
    .select("duracao_minutos")
    .eq("user_id", user.id);

  const minDur = (() => {
    const arr = (services ?? [])
      .map((s) => Number((s as { duracao_minutos: number }).duracao_minutos))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (arr.length === 0) return 30;
    return Math.min(...arr);
  })();

  const { first, last } = monthRangeISO(year, monthIndex);

  const [{ data: slotRows, error: slotErr }, { data: apptRows, error: apErr }] =
    await Promise.all([
      supabase
        .from("agenda_day_slots")
        .select("data, hora")
        .eq("user_id", user.id)
        .gte("data", first)
        .lte("data", last),
      supabase
        .from("appointments")
        .select("data, hora_inicio, hora_fim")
        .eq("barber_id", user.id)
        .eq("status", APPOINTMENT_STATUS.SCHEDULED)
        .gte("data", first)
        .lte("data", last),
    ]);

  if (slotErr) return { error: slotErr.message };
  if (apErr) return { error: apErr.message };

  const slotsByDate = new Map<string, string[]>();
  for (const row of slotRows ?? []) {
    const d = normalizeIsoDateFromDb((row as { data: unknown }).data);
    const h = normalizeTimeInput(String((row as { hora: string }).hora));
    const list = slotsByDate.get(d);
    if (list) list.push(h);
    else slotsByDate.set(d, [h]);
  }

  const apptsByDate = new Map<string, { hora_inicio: string; hora_fim: string }[]>();
  for (const row of apptRows ?? []) {
    const d = normalizeIsoDateFromDb((row as { data: unknown }).data);
    const slice = {
      hora_inicio: String((row as { hora_inicio: string }).hora_inicio),
      hora_fim: String((row as { hora_fim: string }).hora_fim),
    };
    const list = apptsByDate.get(d);
    if (list) list.push(slice);
    else apptsByDate.set(d, [slice]);
  }

  const markers: Record<string, AgendaDayMarker> = {};
  const lastD = new Date(Date.UTC(year, monthIndex + 1, 0, 12, 0, 0)).getUTCDate();

  for (let day = 1; day <= lastD; day++) {
    const iso = `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`;
    const starts = slotsByDate.get(iso) ?? [];
    if (starts.length === 0) {
      markers[iso] = "none";
      continue;
    }
    const intervals = bookedRowsToIntervals(apptsByDate.get(iso) ?? []);
    const { free } = discreteSlotsFreeAndBlocked(starts, intervals, minDur);
    markers[iso] = free.length > 0 ? "open" : "full";
  }

  return { markers };
}

const APPOINTMENT_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function getScheduledAppointmentRow(appointmentId: string, barberId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("appointments")
    .select("id, data, hora_fim, status")
    .eq("id", appointmentId)
    .eq("barber_id", barberId)
    .maybeSingle();

  if (error) return { error: error.message as string };
  if (
    !data ||
    normalizeAppointmentStatus(String(data.status)) !== APPOINTMENT_STATUS.SCHEDULED
  ) {
    return { error: "Agendamento não encontrado ou já alterado." };
  }

  return {
    row: {
      data: normalizeIsoDateFromDb(data.data),
      hora_fim: String(data.hora_fim),
    },
  };
}

/** Finalização automática (fim + 20 min) para o barbeiro logado. */
export async function autoCompleteBarberAppointments() {
  const { user } = await requireBarber();
  const admin = tryCreateAdminClient();
  if (!admin) return { updated: 0 };

  const result = await runAutoCompleteAppointments(admin, { barberId: user.id });
  if (result.updated > 0) {
    revalidatePath("/dashboard");
    revalidatePath("/agenda");
    revalidatePath("/relatorios");
  }
  return result;
}

/**
 * Cancelamento pelo barbeiro: `scheduled` → `cancelled`.
 * Disponibilidade pública deriva de `appointments` agendados (não há `agenda_bookings` nem `is_available` em `agenda_day_slots`).
 * Um único `UPDATE` com filtros em linha é atómico no Postgres.
 */
export async function cancelBarberAppointment(appointmentId: string) {
  const { user } = await requireBarber();
  const denied = await barberWriteDeniedMessage();
  if (denied) return { error: denied };

  if (!APPOINTMENT_ID_RE.test(appointmentId)) {
    return { error: "Identificador do agendamento inválido." };
  }

  const rowCheck = await getScheduledAppointmentRow(appointmentId, user.id);
  if (rowCheck.error || !rowCheck.row) {
    return { error: rowCheck.error ?? "Agendamento inválido." };
  }

  if (!canShowCancelButton(rowCheck.row.data, rowCheck.row.hora_fim)) {
    return {
      error:
        "O prazo para cancelar este horário expirou (janela de 20 minutos após o término).",
    };
  }

  const supabase = await createClient();

  const { data: updated, error } = await supabase
    .from("appointments")
    .update({ status: APPOINTMENT_STATUS.CANCELLED })
    .eq("id", appointmentId)
    .eq("barber_id", user.id)
    .eq("status", APPOINTMENT_STATUS.SCHEDULED)
    .select("id")
    .maybeSingle();

  if (error) {
    logJsonLine({
      where: "cancelBarberAppointment",
      code: error.code,
      message: error.message,
    });
    return { error: error.message };
  }

  if (!updated) {
    return {
      error:
        "Agendamento não encontrado, já cancelado ou não pertence à sua conta.",
    };
  }

  revalidatePath("/dashboard");
  revalidatePath("/agenda");
  revalidatePath("/relatorios");
  await revalidatePublicBarbershopPage(supabase, user.id);
  return { ok: true as const };
}

async function markAppointmentNoShowInDb(appointmentId: string) {
  const { user } = await requireBarber();
  const denied = await barberWriteDeniedMessage();
  if (denied) return { error: denied };

  if (!APPOINTMENT_ID_RE.test(appointmentId)) {
    return { error: "Identificador do agendamento inválido." };
  }

  const supabase = await createClient();
  const { data: updated, error } = await supabase
    .from("appointments")
    .update({ status: APPOINTMENT_STATUS.NO_SHOW })
    .eq("id", appointmentId)
    .eq("barber_id", user.id)
    .eq("status", APPOINTMENT_STATUS.SCHEDULED)
    .select("id")
    .maybeSingle();

  if (error) return { error: error.message };
  if (!updated) {
    return {
      error: "Agendamento não encontrado ou status não permite esta alteração.",
    };
  }

  revalidatePath("/dashboard");
  revalidatePath("/agenda");
  revalidatePath("/relatorios");
  await revalidatePublicBarbershopPage(supabase, user.id);
  return { ok: true as const };
}

export async function markBarberAppointmentNoShow(appointmentId: string) {
  const { user } = await requireBarber();
  const denied = await barberWriteDeniedMessage();
  if (denied) return { error: denied };

  if (!APPOINTMENT_ID_RE.test(appointmentId)) {
    return { error: "Identificador do agendamento inválido." };
  }

  const rowCheck = await getScheduledAppointmentRow(appointmentId, user.id);
  if (rowCheck.error || !rowCheck.row) {
    return { error: rowCheck.error ?? "Agendamento inválido." };
  }

  if (!canShowNoShowButton(rowCheck.row.data, rowCheck.row.hora_fim)) {
    return {
      error:
        "Só é possível marcar não compareceu na janela de 20 minutos após o horário de término.",
    };
  }

  return markAppointmentNoShowInDb(appointmentId);
}

/** Link público do agendamento (token) para o barbeiro copiar e enviar ao cliente. */
export async function getBarberAppointmentPublicLink(appointmentId: string) {
  const { user } = await requireBarber();
  const denied = await barberWriteDeniedMessage();
  if (denied) return { error: denied };

  if (!APPOINTMENT_ID_RE.test(appointmentId)) {
    return { error: "Identificador inválido." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("appointments")
    .select("access_token")
    .eq("id", appointmentId)
    .eq("barber_id", user.id)
    .maybeSingle();

  if (error) return { error: error.message };

  const token = data?.access_token as string | undefined;
  if (!token) {
    return {
      error:
        "Link ainda não disponível para este registro. Confirme se a migração `access_token` foi aplicada no Supabase.",
    };
  }

  const path = `/agendamento/${token}`;
  const url = appointmentPublicUrl(token);
  return { path, fullUrl: url };
}

export async function getBarberAppointmentsForDay(
  date: string
): Promise<{ appointments?: Appointment[]; error?: string }> {
  const { user } = await requireBarber();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("appointments")
    .select(
      "id, barber_id, servico_id, cliente_nome, cliente_telefone, data, hora_inicio, hora_fim, status, created_at, updated_at, services ( id, nome, preco, duracao_minutos )"
    )
    .eq("barber_id", user.id)
    .eq("data", date)
    .eq("status", APPOINTMENT_STATUS.SCHEDULED)
    .order("hora_inicio")
    .limit(120);

  if (error) {
    logJsonLine({
      where: "getBarberAppointmentsForDay",
      code: error.code,
      message: error.message,
    });
    return { error: error.message };
  }

  return { appointments: normalizeJoinedAppointments(data ?? []) };
}
