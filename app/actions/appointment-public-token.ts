"use server";

import { createClient } from "@supabase/supabase-js";
import {
  type AppointmentStatus,
  normalizeAppointmentStatus,
} from "@/lib/appointments/status";
import { getPublicSupabaseEnv } from "@/lib/supabase/public-env";

const TOKEN_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type PublicAppointmentByToken = {
  data: string;
  hora_inicio: string;
  hora_fim: string;
  cliente_nome: string;
  status: AppointmentStatus;
  nome_barbearia: string;
  nome_servico: string | null;
};

function mapRpcRow(raw: Record<string, unknown>): PublicAppointmentByToken {
  const fmtTime = (v: unknown) => String(v ?? "").slice(0, 5);
  return {
    data: String(raw.data ?? ""),
    hora_inicio: fmtTime(raw.hora_inicio),
    hora_fim: fmtTime(raw.hora_fim),
    cliente_nome: String(raw.cliente_nome ?? ""),
    status: normalizeAppointmentStatus(String(raw.status)),
    nome_barbearia: String(raw.nome_barbearia ?? ""),
    nome_servico: raw.nome_servico != null ? String(raw.nome_servico) : null,
  };
}

/** Leitura pública por token (RPC `get_appointment_public_by_access_token`); sem autenticação. */
export async function fetchAppointmentByAccessToken(
  token: string
): Promise<{ row?: PublicAppointmentByToken; notFound?: true; error?: string }> {
  if (!TOKEN_RE.test(token)) {
    return { notFound: true };
  }

  const env = getPublicSupabaseEnv();
  if (!env.ok) {
    return { error: "Serviço indisponível." };
  }

  const supabase = createClient(env.url, env.anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase.rpc("get_appointment_public_by_access_token", {
    p_token: token,
  });

  if (error) {
    return { error: error.message };
  }

  const rows = data as Record<string, unknown>[] | null;
  const first = rows?.[0];
  if (!first) {
    return { notFound: true };
  }

  return { row: mapRpcRow(first) };
}
