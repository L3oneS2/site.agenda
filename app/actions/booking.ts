"use server";

import { createAdminClient } from "@/lib/supabaseAdmin";
import {
  addMinutesToTimeStr,
  bookedRowsToIntervals,
  generateSlotStartsForDuration,
  hasOverlapWithBooked,
  normalizeTimeInput,
  timeStrToMinutes,
} from "@/lib/scheduling";
import type { Availability, Service } from "@/lib/types";

function jsDayFromISODate(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0)).getUTCDay();
}

function mapServiceRow(r: Record<string, unknown>): Service {
  return {
    id: String(r.id),
    user_id: String(r.user_id),
    nome: String(r.nome),
    preco: Number(r.preco),
    duracao_minutos: Number(r.duracao_minutos),
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
  };
}

export async function getPublicServices(
  barbershopId: string
): Promise<{ services?: Service[]; error?: string }> {
  const admin = createAdminClient();

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
    .select("*")
    .eq("user_id", barberId)
    .order("nome");

  if (error) return { error: error.message };

  return { services: (data ?? []).map((r) => mapServiceRow(r as Record<string, unknown>)) };
}

export async function getPublicSlots(
  barbershopId: string,
  date: string,
  durationMinutes: number
): Promise<{ slots?: string[]; error?: string; barberId?: string }> {
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    return { error: "Duração inválida." };
  }

  const admin = createAdminClient();

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

  const admin = createAdminClient();

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
  const dates: string[] = [];

  for (let i = 0; i < horizonDays; i++) {
    const date = addDaysISO(fromISO, i);
    const dia = jsDayFromISODate(date);
    const dayBlocks = allBlocks.filter((b) => b.dia_semana === dia);
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

  const admin = createAdminClient();
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

  const { error: insError } = await admin.from("appointments").insert({
    barber_id: barberId,
    servico_id,
    cliente_nome,
    cliente_telefone,
    data,
    hora_inicio,
    hora_fim,
    status: "scheduled",
  });

  if (insError) {
    return { error: insError.message };
  }

  return { ok: true };
}
