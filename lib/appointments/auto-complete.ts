import type { SupabaseClient } from "@supabase/supabase-js";
import { shouldAutoCompleteToFinalized } from "@/lib/appointments/lifecycle";
import { APPOINTMENT_STATUS } from "@/lib/appointments/status";
import { normalizeIsoDateFromDb } from "@/lib/scheduling";
import { logJsonLine } from "@/lib/supabase/debug-env";

type Row = {
  id: string;
  data: string;
  hora_fim: string;
  barber_id: string;
};

/**
 * Finaliza `scheduled` → `completed` quando fim + 20 min já passou (America/Sao_Paulo).
 * Nunca altera `canceled` nem `no_show`.
 */
export async function runAutoCompleteAppointments(
  admin: SupabaseClient,
  options?: { barberId?: string; now?: Date }
): Promise<{ updated: number; error?: string }> {
  const now = options?.now ?? new Date();

  let query = admin
    .from("appointments")
    .select("id, data, hora_fim, barber_id")
    .eq("status", APPOINTMENT_STATUS.SCHEDULED)
    .limit(500);

  if (options?.barberId) {
    query = query.eq("barber_id", options.barberId);
  }

  const { data, error } = await query;

  if (error) {
    logJsonLine({
      where: "runAutoCompleteAppointments",
      phase: "select_failed",
      message: error.message,
    });
    return { updated: 0, error: error.message };
  }

  const toComplete: string[] = [];
  for (const raw of data ?? []) {
    const row = raw as Row;
    const dataIso = normalizeIsoDateFromDb(row.data);
    const horaFim = String(row.hora_fim ?? "");
    if (shouldAutoCompleteToFinalized(dataIso, horaFim, now)) {
      toComplete.push(row.id);
    }
  }

  if (toComplete.length === 0) {
    return { updated: 0 };
  }

  const { data: updatedRows, error: updErr } = await admin
    .from("appointments")
    .update({
      status: APPOINTMENT_STATUS.COMPLETED,
      updated_at: now.toISOString(),
    })
    .in("id", toComplete)
    .eq("status", APPOINTMENT_STATUS.SCHEDULED)
    .select("id");

  if (updErr) {
    const enumMissing = /invalid input value for enum appointment_status/i.test(
      updErr.message ?? ""
    );
    logJsonLine({
      where: "runAutoCompleteAppointments",
      phase: "update_failed",
      message: updErr.message,
      candidates: toComplete.length,
      enumMissing,
    });
    return {
      updated: 0,
      error: enumMissing
        ? "Status completed ainda não existe no banco. Aplique database/migrations/20260519_appointment_status_enum_sync.sql no Supabase."
        : updErr.message,
    };
  }

  return { updated: updatedRows?.length ?? 0 };
}
