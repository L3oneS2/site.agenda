"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  addAvailability,
  cancelAppointment,
  deleteAvailability,
} from "@/app/actions/barber";
import { logAppDebug } from "@/lib/supabase/debug-env";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Availability } from "@/lib/types";

export function AgendaClient({
  dias,
  initialBlocks,
}: {
  dias: string[];
  initialBlocks: Availability[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function onAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    try {
      const r = await addAvailability(fd);
      if (r.error) toast.error(r.error);
      else {
        toast.success("Horário adicionado");
        e.currentTarget.reset();
        router.refresh();
      }
    } catch (err) {
      logAppDebug("agenda", "addAvailability exceção", {
        message: err instanceof Error ? err.message : String(err),
      });
      toast.error("Falha ao adicionar horário. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-6 space-y-6">
      <form onSubmit={onAdd} className="grid gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="text-sm font-medium text-[var(--muted)]">Dia</span>
          <select
            name="dia_semana"
            required
            className="mt-1.5 w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-[var(--fg)] outline-none focus:border-gold-500/60 focus:ring-2 focus:ring-gold-500/20"
            defaultValue="1"
          >
            {dias.map((label, i) => (
              <option key={label} value={i}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <Input name="hora_inicio" type="time" label="Início" required />
        <Input name="hora_fim" type="time" label="Fim" required />
        <div className="sm:col-span-2">
          <Button type="submit" className="w-full sm:w-auto" disabled={loading}>
            Adicionar faixa
          </Button>
        </div>
      </form>

      <ul className="space-y-2">
        {initialBlocks.length === 0 ? (
          <li className="text-sm text-[var(--muted)]">
            Nenhuma faixa cadastrada.
          </li>
        ) : (
          initialBlocks.map((b) => (
            <li
              key={b.id}
              className="flex items-center justify-between rounded-2xl border border-[var(--border)] px-4 py-3 text-sm"
            >
              <span>
                {dias[b.dia_semana]} · {String(b.hora_inicio).slice(0, 5)} –{" "}
                {String(b.hora_fim).slice(0, 5)}
              </span>
              <Button
                type="button"
                variant="danger"
                className="!py-1.5 !px-3 text-xs"
                disabled={deletingId !== null}
                onClick={async () => {
                  setDeletingId(b.id);
                  try {
                    const r = await deleteAvailability(b.id);
                    if (r.error) toast.error(r.error);
                    else {
                      toast.success("Removido");
                      router.refresh();
                    }
                  } catch (err) {
                    logAppDebug("agenda", "deleteAvailability exceção", {
                      message: err instanceof Error ? err.message : String(err),
                    });
                    toast.error("Falha ao excluir. Tente novamente.");
                  } finally {
                    setDeletingId(null);
                  }
                }}
              >
                {deletingId === b.id ? "…" : "Excluir"}
              </Button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

export function CancelAppointmentButton({ id }: { id: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      className="!py-2 !px-3 text-xs"
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        try {
          const r = await cancelAppointment(id);
          if (r.error) toast.error(r.error);
          else {
            toast.success("Agendamento cancelado");
            router.refresh();
          }
        } catch (err) {
          logAppDebug("agenda", "cancelAppointment exceção", {
            message: err instanceof Error ? err.message : String(err),
          });
          toast.error("Falha ao cancelar. Tente novamente.");
        } finally {
          setLoading(false);
        }
      }}
    >
      {loading ? "Cancelando…" : "Cancelar"}
    </Button>
  );
}
