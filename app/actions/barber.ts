"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireBarber } from "@/lib/auth";
import { barberWriteDeniedMessage } from "@/lib/barber-write-guard";
import { normalizeJoinedAppointments } from "@/lib/appointment-rows";
import { logJsonLine } from "@/lib/supabase/debug-env";
import type { Appointment } from "@/lib/types";

export async function addAvailability(formData: FormData) {
  const { user } = await requireBarber();
  const denied = await barberWriteDeniedMessage();
  if (denied) return { error: denied };
  const dia_semana = Number(formData.get("dia_semana"));
  const hora_inicio = String(formData.get("hora_inicio"));
  const hora_fim = String(formData.get("hora_fim"));

  if (Number.isNaN(dia_semana) || dia_semana < 0 || dia_semana > 6) {
    return { error: "Dia da semana inválido." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("availability").insert({
    user_id: user.id,
    dia_semana,
    hora_inicio: hora_inicio.length === 5 ? `${hora_inicio}:00` : hora_inicio,
    hora_fim: hora_fim.length === 5 ? `${hora_fim}:00` : hora_fim,
  });

  if (error) return { error: error.message };

  revalidatePath("/agenda");
  return { ok: true };
}

export async function deleteAvailability(id: string) {
  const { user } = await requireBarber();
  const denied = await barberWriteDeniedMessage();
  if (denied) return { error: denied };
  const supabase = await createClient();
  const { error } = await supabase
    .from("availability")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/agenda");
  return { ok: true };
}

export async function cancelAppointment(id: string) {
  const { user } = await requireBarber();
  const denied = await barberWriteDeniedMessage();
  if (denied) return { error: denied };
  const supabase = await createClient();
  const { error } = await supabase
    .from("appointments")
    .update({ status: "canceled" })
    .eq("id", id)
    .eq("barber_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  revalidatePath("/agenda");
  return { ok: true };
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
    .eq("status", "scheduled")
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
