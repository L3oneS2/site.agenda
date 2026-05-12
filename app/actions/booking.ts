"use server";

/**
 * Agendamento público: acoplado a Supabase admin + `lib/scheduling`.
 * Ver `README.md` nesta pasta para notas de arquitetura e evolução futura.
 */
import { tryCreateAdminClient } from "@/lib/supabaseAdmin";
import { logAppDebug, logJsonLine } from "@/lib/supabase/debug-env";
import {
  addMinutesToTimeStr,
  bookedRowsToIntervals,
  generateSlotStartsForDuration,
  hasOverlapWithBooked,
  normalizeTimeInput,
  timeStrToMinutes,
} from "@/lib/scheduling";
import { mapServiceRows } from "@/lib/map-service-row";
import type { Availability, Service } from "@/lib/types";

function jsDayFromISODate(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0)).getUTCDay();
}

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

export async function getPublicServices(
  barbershopId: string
): Promise<{ services?: Service[]; error?: string }> {
  const admin = tryCreateAdminClient();
  if (!admin) {
    bookingAdminMissing("getPublicServices");
    return { error: ADMIN_MISSING };
  }

  const { data: shop, error: shopError } = await admin
    .from("barbershops")
    .select("user_id")
    .eq("id", barbershopId)
    .single();

  if (shopError || !shop) {
    return { error: "Barbearia não encontrada." };
  }

  const barberId = shop.user_id as string;

  const { data, error } = await admin
    .from("services")
    .select("id, user_id, nome, preco, duracao_minutos, created_at, updated_at")
    .eq("user_id", barberId)
    .order("nome");

  if (error) return { error: error.message };

  return { services: mapServiceRows(data as unknown[] | null) };
}

export async function getPublicSlots(
  barbershopId: string,
  date: string,
  durationMinutes: number
): Promise<{ slots?: string[]; error?: string; barberId?: string }> {
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    return { error: "Duração inválida." };
  }

  const admin = tryCreateAdminClient();
  if (!admin) {
    bookingAdminMissing("getPublicSlots");
    return { error: ADMIN_MISSING };
  }

  const { data: shop, error: shopError } = await admin
    .from("barbershops")
    .select("user_id")
    .eq("id", barbershopId)
    .single();

  if (shopError || !shop) {
    return { error: "Barbearia não encontrada." };
  }

  const barberId = shop.user_id as string;
  const dia = jsDayFromISODate(date);

  const { data: blocks, error: avError } = await admin
    .from("availability")
    .select("dia_semana, hora_inicio, hora_fim")
    .eq("user_id", barberId)
    .eq("dia_semana", dia);

  if (avError) return { error: avError.message };

  const { data: booked, error: apError } = await admin
    .from("appointments")
    .select("hora_inicio, hora_fim")
    .eq("barber_id", barberId)
    .eq("data", date)
    .eq("status", "scheduled");

  if (apError) return { error: apError.message };

  const intervals = bookedRowsToIntervals(
    (booked ?? []) as { hora_inicio: string; hora_fim: string }[]
  );

  const slots = generateSlotStartsForDuration(
    (blocks ?? []) as Availability[],
    intervals,
    durationMinutes
  );

  return { slots, barberId };
}

function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
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

  const admin = tryCreateAdminClient();
  if (!admin) {
    bookingAdminMissing("getDatesWithAvailability");
    return { error: ADMIN_MISSING };
  }

  const { data: shop, error: shopError } = await admin
    .from("barbershops")
    .select("user_id")
    .eq("id", barbershopId)
    .single();

  if (shopError || !shop) {
    return { error: "Barbearia não encontrada." };
  }

  const barberId = shop.user_id as string;
  const endISO = addDaysISO(fromISO, horizonDays - 1);

  const [{ data: blocks, error: avError }, { data: appointments, error: apError }] =
    await Promise.all([
      admin
        .from("availability")
        .select("dia_semana, hora_inicio, hora_fim")
        .eq("user_id", barberId),
      admin
        .from("appointments")
        .select("data, hora_inicio, hora_fim")
        .eq("barber_id", barberId)
        .eq("status", "scheduled")
        .gte("data", fromISO)
        .lte("data", endISO),
    ]);

  if (avError) return { error: avError.message };
  if (apError) return { error: apError.message };

  const byDate = new Map<string, { hora_inicio: string; hora_fim: string }[]>();
  for (const row of appointments ?? []) {
    const d = String((row as { data: string }).data);
    const list = byDate.get(d);
    const slice = {
      hora_inicio: String((row as { hora_inicio: string }).hora_inicio),
      hora_fim: String((row as { hora_fim: string }).hora_fim),
    };
    if (list) list.push(slice);
    else byDate.set(d, [slice]);
  }

  const allBlocks = (blocks ?? []) as Availability[];
  const blocksByWeekday = new Map<number, Availability[]>();
  for (const b of allBlocks) {
    const list = blocksByWeekday.get(b.dia_semana);
    if (list) list.push(b);
    else blocksByWeekday.set(b.dia_semana, [b]);
  }

  const dates: string[] = [];

  for (let i = 0; i < horizonDays; i++) {
    const date = addDaysISO(fromISO, i);
    const dia = jsDayFromISODate(date);
    const dayBlocks = blocksByWeekday.get(dia) ?? [];
    const booked = byDate.get(date) ?? [];
    const intervals = bookedRowsToIntervals(booked);
    const slots = generateSlotStartsForDuration(
      dayBlocks,
      intervals,
      durationMinutes
    );
    if (slots.length > 0) {
      dates.push(date);
    }
  }

  return { dates };
}

export async function bookPublicAppointment(formData: FormData) {
  const barbershop_id = String(formData.get("barbershop_id") ?? "");
  const data = String(formData.get("data") ?? "");
  const servico_id = String(formData.get("servico_id") ?? "");
  const horaRaw = String(formData.get("hora_inicio") ?? "");
  const cliente_nome = String(formData.get("cliente_nome") ?? "").trim();
  const cliente_telefone = String(formData.get("cliente_telefone") ?? "").trim();

  const hora_inicio = normalizeTimeInput(horaRaw);

  if (!barbershop_id || !data || !hora_inicio || !cliente_nome || !cliente_telefone) {
    return { error: "Preencha todos os campos." };
  }

  if (!servico_id) {
    return { error: "Selecione um serviço." };
  }

  const admin = tryCreateAdminClient();
  if (!admin) {
    bookingAdminMissing("bookPublicAppointment");
    return { error: ADMIN_MISSING };
  }

  const { data: shop, error: shopError } = await admin
    .from("barbershops")
    .select("user_id")
    .eq("id", barbershop_id)
    .single();

  if (shopError || !shop) return { error: "Barbearia inválida." };

  const barberId = shop.user_id as string;

  const { data: serviceRow, error: svcErr } = await admin
    .from("services")
    .select("duracao_minutos")
    .eq("id", servico_id)
    .eq("user_id", barberId)
    .maybeSingle();

  if (svcErr || !serviceRow) {
    return { error: "Serviço inválido." };
  }

  const duration = Number(serviceRow.duracao_minutos);
  let hora_fim: string;
  try {
    hora_fim = addMinutesToTimeStr(hora_inicio, duration);
  } catch {
    return { error: "Horário inválido para a duração do serviço." };
  }

  const fresh = await getPublicSlots(barbershop_id, data, duration);
  if (fresh.error) return { error: fresh.error };
  if (!fresh.slots?.includes(hora_inicio)) {
    return { error: "Horário não disponível." };
  }

  const { data: existing, error: exErr } = await admin
    .from("appointments")
    .select("hora_inicio, hora_fim")
    .eq("barber_id", barberId)
    .eq("data", data)
    .eq("status", "scheduled");

  if (exErr) return { error: exErr.message };

  const newStart = timeStrToMinutes(hora_inicio);
  const newEnd = timeStrToMinutes(hora_fim);
  const booked = bookedRowsToIntervals(
    (existing ?? []) as { hora_inicio: string; hora_fim: string }[]
  );

  if (hasOverlapWithBooked(newStart, newEnd, booked)) {
    return { error: "Este horário conflita com outro agendamento." };
  }

  const row = {
    barber_id: barberId,
    servico_id,
    cliente_nome,
    cliente_telefone,
    data,
    hora_inicio,
    hora_fim,
    status: "scheduled" as const,
  };

  const insertOnce = () => admin.from("appointments").insert(row);

  let { error: insError } = await insertOnce();

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
      return { error: "Este horário não está mais disponível. Escolha outro." };
    }

    const { data: existing2, error: exErr2 } = await admin
      .from("appointments")
      .select("hora_inicio, hora_fim")
      .eq("barber_id", barberId)
      .eq("data", data)
      .eq("status", "scheduled");

    if (exErr2) return { error: exErr2.message };

    const booked2 = bookedRowsToIntervals(
      (existing2 ?? []) as { hora_inicio: string; hora_fim: string }[]
    );
    if (hasOverlapWithBooked(newStart, newEnd, booked2)) {
      return { error: "Este horário conflita com outro agendamento." };
    }

    const second = await insertOnce();
    insError = second.error;
  }

  if (insError) {
    const code = insError.code;
    const msg = insError.message ?? "";
    if (isBookingConflictInsertError(insError)) {
      return { error: "Este horário não está mais disponível. Escolha outro." };
    }
    if (code === "23503") {
      return {
        error:
          "Não foi possível confirmar o agendamento (referência inválida). Atualize a página e tente novamente.",
      };
    }
    return { error: msg || "Falha ao salvar o agendamento." };
  }

  return { ok: true };
}
