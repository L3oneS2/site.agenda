"use server";

/**
 * Agendamento público: acoplado a Supabase admin + `lib/scheduling`.
 * Disponibilidade por data explícita (`agenda_day_slots`).
 */
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  tryCreateAdminClient,
  tryCreateAnonReadOnlyClient,
} from "@/lib/supabaseAdmin";
import { logAppDebug, logJsonLine } from "@/lib/supabase/debug-env";
import {
  addMinutesToTimeStr,
  bookedRowsToIntervals,
  discreteSlotsFreeAndBlocked,
  hasOverlapWithBooked,
  normalizeTimeInput,
  normalizeIsoDateFromDb,
  timeStrToMinutes,
} from "@/lib/scheduling";
import { APPOINTMENT_STATUS } from "@/lib/appointments/status";
import { mapServiceRows } from "@/lib/map-service-row";
import type { AgendaDayMarker, Service } from "@/lib/types";
import { appointmentPublicUrl } from "@/lib/public-app-url";

const ADMIN_MISSING =
  "Agendamento indisponível no servidor: configure SUPABASE_SERVICE_ROLE_KEY (ex.: na Vercel) e faça redeploy.";

function bookingAdminMissing(source: string) {
  logAppDebug("booking", `cliente admin ausente · ${source}`, {});
}

function isBookingConflictInsertError(insError: {
  code?: string;
  message?: string;
}): boolean {
  const code = insError.code;
  const msg = insError.message ?? "";
  return (
    code === "23505" ||
    code === "23514" ||
    code === "40P01" ||
    msg.includes("Este horário acabou de ser reservado") ||
    msg.includes("duplicate key") ||
    msg.includes("idx_appointments_unique_barber_date_start_scheduled")
  );
}

function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
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

/** Leituras públicas (RLS): prefere anon; fallback admin se anon indisponível. */
function publicReadClient(anon: SupabaseClient | null, admin: SupabaseClient): SupabaseClient {
  return anon ?? admin;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validatePublicBookingPayload(input: {
  barbershop_id: string;
  data: string;
  servico_id: string;
  cliente_nome: string;
  cliente_telefone: string;
}): string | null {
  if (!UUID_RE.test(input.barbershop_id)) return "Identificador da barbearia inválido.";
  if (!UUID_RE.test(input.servico_id)) return "Serviço inválido.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.data)) return "Data inválida.";
  if (input.cliente_nome.length < 1 || input.cliente_nome.length > 120) {
    return "Informe um nome válido (até 120 caracteres).";
  }
  const tel = input.cliente_telefone.replace(/\D/g, "");
  if (tel.length < 8 || tel.length > 15) {
    return "Informe um telefone válido (8 a 15 dígitos).";
  }
  return null;
}

export async function getPublicServices(
  barbershopId: string
): Promise<{ services?: Service[]; error?: string }> {
  const admin = tryCreateAdminClient();
  const anon = tryCreateAnonReadOnlyClient();
  const read = admin ? publicReadClient(anon, admin) : anon;
  if (!read) {
    bookingAdminMissing("getPublicServices");
    return { error: ADMIN_MISSING };
  }

  if (!UUID_RE.test(barbershopId)) {
    return { error: "Identificador da barbearia inválido." };
  }

  const { data: shop, error: shopError } = await read
    .from("barbershops")
    .select("user_id")
    .eq("id", barbershopId)
    .single();

  if (shopError || !shop) {
    return { error: "Barbearia não encontrada." };
  }

  const barberId = shop.user_id as string;

  const { data, error } = await read
    .from("services")
    .select("id, user_id, nome, preco, duracao_minutos, created_at, updated_at")
    .eq("user_id", barberId)
    .order("nome");

  if (error) return { error: error.message };

  return { services: mapServiceRows(data as unknown[] | null) };
}

/**
 * Horários disponíveis para reserva pública: apenas inícios em `agenda_day_slots` que
 * cabem a duração sem sobrepor agendamentos `scheduled` (cancelados não bloqueiam).
 * Não retorna horários ocupados — o cliente só deve receber esta lista filtrada.
 */
export async function getPublicSlots(
  barbershopId: string,
  date: string,
  durationMinutes: number
): Promise<{
  slots?: string[];
  error?: string;
  barberId?: string;
}> {
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    return { error: "Duração inválida." };
  }

  const admin = tryCreateAdminClient();
  if (!admin) {
    bookingAdminMissing("getPublicSlots");
    return { error: ADMIN_MISSING };
  }

  const anon = tryCreateAnonReadOnlyClient();
  const read = publicReadClient(anon, admin);

  if (!UUID_RE.test(barbershopId)) {
    return { error: "Identificador da barbearia inválido." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { error: "Data inválida." };
  }

  const { data: shop, error: shopError } = await read
    .from("barbershops")
    .select("user_id")
    .eq("id", barbershopId)
    .single();

  if (shopError || !shop) {
    return { error: "Barbearia não encontrada." };
  }

  const barberId = shop.user_id as string;

  const { data: slotRows, error: slotErr } = await read
    .from("agenda_day_slots")
    .select("hora")
    .eq("user_id", barberId)
    .eq("data", date)
    .order("hora");

  if (slotErr) return { error: slotErr.message };

  const defined = (slotRows ?? []).map((r) =>
    normalizeTimeInput(String((r as { hora: string }).hora))
  );

  const { data: booked, error: apError } = await admin
    .from("appointments")
    .select("hora_inicio, hora_fim")
    .eq("barber_id", barberId)
    .eq("data", date)
    .eq("status", APPOINTMENT_STATUS.SCHEDULED);

  if (apError) return { error: apError.message };

  const intervals = bookedRowsToIntervals(
    (booked ?? []) as { hora_inicio: string; hora_fim: string }[]
  );

  const { free } = discreteSlotsFreeAndBlocked(defined, intervals, durationMinutes);

  return { slots: free, barberId };
}

export async function getPublicMonthDayMarkers(
  barbershopId: string,
  durationMinutes: number,
  year: number,
  monthIndex: number
): Promise<{ markers?: Record<string, AgendaDayMarker>; error?: string }> {
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    return { error: "Duração inválida." };
  }

  if (!Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    return { error: "Mês inválido." };
  }
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return { error: "Ano inválido." };
  }
  if (!UUID_RE.test(barbershopId)) {
    return { error: "Identificador da barbearia inválido." };
  }

  const admin = tryCreateAdminClient();
  if (!admin) {
    bookingAdminMissing("getPublicMonthDayMarkers");
    return { error: ADMIN_MISSING };
  }

  const anon = tryCreateAnonReadOnlyClient();
  const read = publicReadClient(anon, admin);

  const { data: shop, error: shopError } = await read
    .from("barbershops")
    .select("user_id")
    .eq("id", barbershopId)
    .single();

  if (shopError || !shop) {
    return { error: "Barbearia não encontrada." };
  }

  const barberId = shop.user_id as string;
  const { first, last } = monthRangeISO(year, monthIndex);

  const [{ data: slotRows, error: slotErr }, { data: apptRows, error: apErr }] =
    await Promise.all([
      read
        .from("agenda_day_slots")
        .select("data, hora")
        .eq("user_id", barberId)
        .gte("data", first)
        .lte("data", last),
      admin
        .from("appointments")
        .select("data, hora_inicio, hora_fim")
        .eq("barber_id", barberId)
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
    const { free } = discreteSlotsFreeAndBlocked(starts, intervals, durationMinutes);
    markers[iso] = free.length > 0 ? "open" : "full";
  }

  return { markers };
}

export async function getDatesWithAvailability(
  barbershopId: string,
  durationMinutes: number,
  fromISO: string,
  horizonDays: number
): Promise<{ dates?: string[]; error?: string }> {
  if (horizonDays < 1 || horizonDays > 60) {
    return { error: "Horizonte de dias inválido." };
  }

  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    return { error: "Duração inválida." };
  }

  if (!UUID_RE.test(barbershopId)) {
    return { error: "Identificador da barbearia inválido." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromISO)) {
    return { error: "Data inicial inválida." };
  }

  const admin = tryCreateAdminClient();
  if (!admin) {
    bookingAdminMissing("getDatesWithAvailability");
    return { error: ADMIN_MISSING };
  }

  const anon = tryCreateAnonReadOnlyClient();
  const read = publicReadClient(anon, admin);

  const { data: shop, error: shopError } = await read
    .from("barbershops")
    .select("user_id")
    .eq("id", barbershopId)
    .single();

  if (shopError || !shop) {
    return { error: "Barbearia não encontrada." };
  }

  const barberId = shop.user_id as string;
  const endISO = addDaysISO(fromISO, horizonDays - 1);

  const [{ data: slotRows, error: slotErr }, { data: appointments, error: apError }] =
    await Promise.all([
      read
        .from("agenda_day_slots")
        .select("data, hora")
        .eq("user_id", barberId)
        .gte("data", fromISO)
        .lte("data", endISO),
      admin
        .from("appointments")
        .select("data, hora_inicio, hora_fim")
        .eq("barber_id", barberId)
        .eq("status", APPOINTMENT_STATUS.SCHEDULED)
        .gte("data", fromISO)
        .lte("data", endISO),
    ]);

  if (slotErr) return { error: slotErr.message };
  if (apError) return { error: apError.message };

  const slotsByDate = new Map<string, string[]>();
  for (const row of slotRows ?? []) {
    const d = normalizeIsoDateFromDb((row as { data: unknown }).data);
    const h = normalizeTimeInput(String((row as { hora: string }).hora));
    const list = slotsByDate.get(d);
    if (list) list.push(h);
    else slotsByDate.set(d, [h]);
  }

  const byDate = new Map<string, { hora_inicio: string; hora_fim: string }[]>();
  for (const row of appointments ?? []) {
    const d = normalizeIsoDateFromDb((row as { data: unknown }).data);
    const list = byDate.get(d);
    const slice = {
      hora_inicio: String((row as { hora_inicio: string }).hora_inicio),
      hora_fim: String((row as { hora_fim: string }).hora_fim),
    };
    if (list) list.push(slice);
    else byDate.set(d, [slice]);
  }

  const dates: string[] = [];

  for (let i = 0; i < horizonDays; i++) {
    const date = addDaysISO(fromISO, i);
    const starts = slotsByDate.get(date) ?? [];
    if (starts.length === 0) continue;
    const intervals = bookedRowsToIntervals(byDate.get(date) ?? []);
    const { free } = discreteSlotsFreeAndBlocked(starts, intervals, durationMinutes);
    if (free.length > 0) {
      dates.push(date);
    }
  }

  return { dates };
}

export async function bookPublicAppointment(formData: FormData) {
  try {
    const barbershop_id = String(formData.get("barbershop_id") ?? "");
    const data = String(formData.get("data") ?? "");
    const servico_id = String(formData.get("servico_id") ?? "");
    const horaRaw = String(formData.get("hora_inicio") ?? "");
    const cliente_nome = String(formData.get("cliente_nome") ?? "").trim();
    const cliente_telefone = String(formData.get("cliente_telefone") ?? "").trim();
    const cliente_email_raw = String(formData.get("cliente_email") ?? "").trim();
    let cliente_email: string | null = null;
    if (cliente_email_raw) {
      if (cliente_email_raw.length > 254) {
        return { error: "E-mail muito longo." };
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cliente_email_raw)) {
        return { error: "E-mail inválido." };
      }
      cliente_email = cliente_email_raw;
    }

    const hora_inicio = normalizeTimeInput(horaRaw);

    if (!barbershop_id || !data || !hora_inicio || !cliente_nome || !cliente_telefone) {
      return { error: "Preencha todos os campos." };
    }

    if (!servico_id) {
      return { error: "Selecione um serviço." };
    }

    const payloadErr = validatePublicBookingPayload({
      barbershop_id,
      data,
      servico_id,
      cliente_nome,
      cliente_telefone,
    });
    if (payloadErr) {
      return { error: payloadErr };
    }

    const admin = tryCreateAdminClient();
    if (!admin) {
      bookingAdminMissing("bookPublicAppointment");
      return { error: ADMIN_MISSING };
    }

    const anon = tryCreateAnonReadOnlyClient();
    const read = publicReadClient(anon, admin);

    const { data: shop, error: shopError } = await read
      .from("barbershops")
      .select("user_id")
      .eq("id", barbershop_id)
      .single();

    if (shopError || !shop) return { error: "Barbearia inválida." };

    const barberId = shop.user_id as string;

    const { data: slotRow, error: slotQErr } = await read
      .from("agenda_day_slots")
      .select("id")
      .eq("user_id", barberId)
      .eq("data", data)
      .eq("hora", hora_inicio)
      .maybeSingle();

    if (slotQErr) return { error: slotQErr.message };
    if (!slotRow) {
      return { error: "Horário indisponível." };
    }

    const { data: serviceRow, error: svcErr } = await read
      .from("services")
      .select("duracao_minutos")
      .eq("id", servico_id)
      .eq("user_id", barberId)
      .maybeSingle();

    if (svcErr || !serviceRow) {
      return { error: "Serviço inválido." };
    }

    const duration = Number(serviceRow.duracao_minutos);
    if (!Number.isFinite(duration) || duration <= 0) {
      return { error: "Duração do serviço inválida." };
    }

    let hora_fim: string;
    try {
      hora_fim = addMinutesToTimeStr(hora_inicio, duration);
    } catch {
      return { error: "Horário inválido para a duração do serviço." };
    }

    const fresh = await getPublicSlots(barbershop_id, data, duration);
    if (fresh.error) return { error: fresh.error };
    if (!fresh.slots?.includes(hora_inicio)) {
      return { error: "Horário indisponível." };
    }

    const { data: existing, error: exErr } = await admin
      .from("appointments")
      .select("hora_inicio, hora_fim")
      .eq("barber_id", barberId)
      .eq("data", data)
      .eq("status", APPOINTMENT_STATUS.SCHEDULED);

    if (exErr) return { error: exErr.message };

    const newStart = timeStrToMinutes(hora_inicio);
    const newEnd = timeStrToMinutes(hora_fim);
    const booked = bookedRowsToIntervals(
      (existing ?? []) as { hora_inicio: string; hora_fim: string }[]
    );

    if (hasOverlapWithBooked(newStart, newEnd, booked)) {
      return { error: "Horário indisponível." };
    }

    const row = {
      barber_id: barberId,
      servico_id,
      cliente_nome,
      cliente_telefone,
      cliente_email,
      data,
      hora_inicio,
      hora_fim,
      status: APPOINTMENT_STATUS.SCHEDULED,
    };

    const insertOnce = () =>
      admin.from("appointments").insert(row).select("access_token").single();

    let insertedRow: { access_token: string } | null = null;
    let { data: inserted, error: insError } = await insertOnce();
    if (!insError && inserted?.access_token) {
      insertedRow = inserted;
    }

    if (insError && isBookingConflictInsertError(insError)) {
      logJsonLine({
        where: "bookPublicAppointment",
        phase: "insert_conflict_retry",
        code: insError.code,
        data,
        barbershopIdPrefix: barbershop_id.slice(0, 8),
      });

      const fresh2 = await getPublicSlots(barbershop_id, data, duration);
      if (fresh2.error) return { error: fresh2.error };
      if (!fresh2.slots?.includes(hora_inicio)) {
        return { error: "Horário indisponível." };
      }

      const { data: existing2, error: exErr2 } = await admin
        .from("appointments")
        .select("hora_inicio, hora_fim")
        .eq("barber_id", barberId)
        .eq("data", data)
        .eq("status", APPOINTMENT_STATUS.SCHEDULED);

      if (exErr2) return { error: exErr2.message };

      const booked2 = bookedRowsToIntervals(
        (existing2 ?? []) as { hora_inicio: string; hora_fim: string }[]
      );
      if (hasOverlapWithBooked(newStart, newEnd, booked2)) {
        return { error: "Horário indisponível." };
      }

      const second = await insertOnce();
      insError = second.error;
      if (!second.error && second.data?.access_token) {
        insertedRow = second.data;
      }
    }

    if (insError) {
      const code = insError.code;
      const msg = insError.message ?? "";
      if (isBookingConflictInsertError(insError)) {
        return { error: "Horário indisponível." };
      }
      if (code === "23503") {
        return {
          error:
            "Não foi possível confirmar o agendamento (referência inválida). Atualize a página e tente novamente.",
        };
      }
      logJsonLine({
        where: "bookPublicAppointment",
        phase: "insert_failed",
        code: insError.code,
        message: msg.slice(0, 200),
      });
      return { error: msg || "Falha ao salvar o agendamento." };
    }

    if (!insertedRow?.access_token) {
      return { error: "Falha ao obter o link do agendamento. Contacte o suporte." };
    }

    const token = insertedRow.access_token;
    const appointmentUrl = appointmentPublicUrl(token);
    const appointmentPath = `/agendamento/${token}`;

    revalidatePath(`/barbearia/${barbershop_id}`);
    return {
      ok: true as const,
      access_token: token,
      appointmentUrl: appointmentUrl ?? undefined,
      appointmentPath,
    };
  } catch (e) {
    logJsonLine({
      where: "bookPublicAppointment",
      phase: "unexpected_error",
      message: e instanceof Error ? e.message.slice(0, 200) : String(e).slice(0, 200),
    });
    return { error: "Falha inesperada ao processar o agendamento. Tente novamente." };
  }
}
