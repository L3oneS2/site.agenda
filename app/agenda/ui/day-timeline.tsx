"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { getBarberAppointmentsForDay } from "@/app/actions/barber";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { logClientDebug, logJsonLine } from "@/lib/supabase/debug-env";
import { Button } from "@/components/ui/button";
import { timeStrToMinutes } from "@/lib/scheduling";
import type { Appointment } from "@/lib/types";

const DAY_START_MIN = 7 * 60;
const DAY_END_MIN = 21 * 60;
const RANGE_MIN = DAY_END_MIN - DAY_START_MIN;
const TRACK_PX = 520;

function serviceAccent(
  serviceId: string | null
): { background: string; borderColor: string } {
  if (!serviceId) {
    return { background: "rgba(113,113,122,0.28)", borderColor: "rgb(161,161,170)" };
  }
  let h = 0;
  for (let i = 0; i < serviceId.length; i++) {
    h = (h * 31 + serviceId.charCodeAt(i)) >>> 0;
  }
  const hue = h % 360;
  return {
    background: `hsla(${hue}, 52%, 42%, 0.4)`,
    borderColor: `hsl(${hue}, 58%, 38%)`,
  };
}

function formatLabel(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function DayTimeline({
  initialDate,
  initialAppointments,
  barberUserId,
}: {
  initialDate: string;
  initialAppointments: Appointment[];
  barberUserId: string;
}) {
  const [date, setDate] = useState(initialDate);
  const [rows, setRows] = useState<Appointment[]>(initialAppointments);
  const [loading, setLoading] = useState(false);
  const [fetchHint, setFetchHint] = useState<string | null>(null);
  const isFirstEffect = useRef(true);

  const loadDay = useCallback(async (signal: AbortSignal) => {
    setLoading(true);
    setFetchHint(null);
    try {
      const r = await getBarberAppointmentsForDay(date);
      if (signal.aborted) return;
      if (r.error) {
        logClientDebug("agenda", "getBarberAppointmentsForDay retornou erro", {
          date,
          error: r.error,
        });
        toast.error("Não foi possível carregar a agenda deste dia.");
        setRows([]);
        setFetchHint(
          "Falha ao buscar agendamentos. Verifique a conexão ou tente novamente."
        );
        return;
      }
      setRows(r.appointments ?? []);
    } catch (e) {
      if (signal.aborted) return;
      const message = e instanceof Error ? e.message : String(e);
      logJsonLine({
        where: "DayTimeline.getBarberAppointmentsForDay",
        date,
        message,
      });
      logClientDebug("agenda", "getBarberAppointmentsForDay exceção", {
        date,
        message,
      });
      toast.error("Erro inesperado ao carregar a agenda.");
      setRows([]);
      setFetchHint(
        "Não foi possível atualizar. Tente novamente ou recarregue a página."
      );
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    if (isFirstEffect.current) {
      isFirstEffect.current = false;
      if (date === initialDate) {
        return;
      }
    }

    const ac = new AbortController();
    void loadDay(ac.signal);
    return () => ac.abort();
  }, [date, initialDate, loadDay]);

  useEffect(() => {
    const supabase = createBrowserSupabase();
    if (!supabase || !barberUserId) return;

    const run = () => {
      const ac = new AbortController();
      void loadDay(ac.signal);
    };

    const ch = supabase
      .channel(`day-timeline-${barberUserId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
          filter: `barber_id=eq.${barberUserId}`,
        },
        run
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(ch);
    };
  }, [barberUserId, loadDay]);

  const ticks = useMemo(() => {
    const out: number[] = [];
    for (let m = DAY_START_MIN; m <= DAY_END_MIN; m += 60) {
      out.push(m);
    }
    return out;
  }, []);

  const pxPerMin = TRACK_PX / RANGE_MIN;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <label className="block text-sm font-medium text-[var(--muted)]">
          Dia
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1.5 w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-2.5 text-[var(--fg)] outline-none focus:border-gold-500/60 focus:ring-2 focus:ring-gold-500/20 sm:max-w-xs"
          />
        </label>
        {loading ? (
          <span className="text-xs text-[var(--muted)]">Atualizando…</span>
        ) : null}
      </div>
      {fetchHint ? (
        <div className="flex flex-col gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
          <p>{fetchHint}</p>
          <Button
            type="button"
            variant="outline"
            className="w-fit !py-2 text-xs"
            disabled={loading}
            onClick={() => {
              const ac = new AbortController();
              void loadDay(ac.signal);
            }}
          >
            Tentar novamente
          </Button>
        </div>
      ) : null}
      <p className="text-xs capitalize text-[var(--muted)]">{formatLabel(date)}</p>

      <div className="relative flex gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3 pl-2">
        <div
          className="relative flex shrink-0 flex-col text-[10px] text-[var(--muted)]"
          style={{ width: 40, height: TRACK_PX }}
        >
          {ticks.map((m) => {
            const top = (m - DAY_START_MIN) * pxPerMin;
            const h = Math.floor(m / 60);
            return (
              <span
                key={m}
                className="absolute right-1 -translate-y-1/2 tabular-nums"
                style={{ top }}
              >
                {String(h).padStart(2, "0")}:00
              </span>
            );
          })}
        </div>
        <div
          className="relative flex-1 border-l border-[var(--border)] pl-2"
          style={{ minHeight: TRACK_PX }}
        >
          <div
            className="absolute left-2 top-0 w-[calc(100%-0.5rem)] rounded-lg bg-gradient-to-b from-black/[0.03] to-transparent dark:from-white/[0.04]"
            style={{ height: TRACK_PX }}
          />
          {ticks.slice(0, -1).map((m) => {
            const y = (m - DAY_START_MIN) * pxPerMin;
            return (
              <div
                key={m}
                className="pointer-events-none absolute left-2 right-0 border-t border-dashed border-[var(--border)] opacity-60"
                style={{ top: y }}
              />
            );
          })}
          {!loading && rows.length === 0 && !fetchHint ? (
            <p className="pointer-events-none absolute left-2 right-2 top-1/2 -translate-y-1/2 text-center text-xs text-[var(--muted)]">
              Nenhum agendamento neste dia.
            </p>
          ) : null}
          {rows.map((a) => {
            const start = timeStrToMinutes(String(a.hora_inicio));
            const end = timeStrToMinutes(String(a.hora_fim));
            const visStart = Math.max(start, DAY_START_MIN);
            const visEnd = Math.min(end, DAY_END_MIN);
            if (visEnd <= visStart) return null;
            const top = (visStart - DAY_START_MIN) * pxPerMin;
            const height = Math.max((visEnd - visStart) * pxPerMin, 20);
            const accent = serviceAccent(a.servico_id);
            const svc = a.services;
            return (
              <div
                key={a.id}
                className="absolute left-2 right-2 overflow-hidden rounded-xl border-2 px-2 py-1.5 text-xs shadow-soft backdrop-blur-sm"
                style={{
                  top,
                  height,
                  background: accent.background,
                  borderColor: accent.borderColor,
                }}
              >
                <p className="truncate font-semibold text-[var(--fg)]">
                  {a.cliente_nome}
                </p>
                <p className="truncate text-[10px] text-[var(--muted)]">
                  {String(a.hora_inicio).slice(0, 5)} – {String(a.hora_fim).slice(0, 5)}
                  {svc?.nome ? ` · ${svc.nome}` : ""}
                </p>
                <span className="mt-0.5 inline-block rounded bg-black/10 px-1.5 py-0.5 text-[10px] font-medium text-gold-800 dark:bg-white/15 dark:text-gold-200">
                  agendado
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
