import type { Service } from "@/lib/types";

/**
 * Normaliza uma linha retornada pelo PostgREST em `services` para o tipo `Service`.
 * Único ponto de verdade — evita divergência entre páginas e server actions.
 */
export function mapServiceRow(r: Record<string, unknown>): Service {
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

/** Mapeia um array PostgREST (ou null) sem repetir cast em cada página/action. */
export function mapServiceRows(rows: unknown[] | null | undefined): Service[] {
  if (!rows?.length) return [];
  return rows.map((r) => mapServiceRow(r as Record<string, unknown>));
}
