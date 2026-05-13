"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";
import {
  addAgendaDaySlot,
  deleteAgendaDaySlot,
  getBarberAgendaMonthMarkers,
  listAgendaDaySlots,
} from "@/app/actions/barber";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import type { AgendaDayMarker, AgendaDaySlot } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function monthMatrix(year: number, month: number) {
  const first = new Date(year, month, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: ({ day: number } | null)[] = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d });
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function toISO(year: number, month: number, day: number) {
  const dt = new Date(Date.UTC(year, month, day, 12, 0, 0));
  return dt.toISOString().slice(0, 10);
}

export function AgendaPlanner({ barberUserId }: { barberUserId: string }) {
  const router = useRouter();
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const t = new Date();
    return { y: t.getFullYear(), m: t.getMonth() };
  });
  const [selectedDate, setSelectedDate] = useState(today);
  const [markers, setMarkers] = useState<Record<string, AgendaDayMarker>>({});
  const [slots, setSlots] = useState<AgendaDaySlot[]>([]);
  const [loadingMonth, setLoadingMonth] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [pending, startTransition] = useTransition();

  const monthCells = useMemo(
    () => monthMatrix(calendarMonth.y, calendarMonth.m),
    [calendarMonth.y, calendarMonth.m]
  );

  const loadMarkers = useCallback(async () => {
    setLoadingMonth(true);
    try {
      const r = await getBarberAgendaMonthMarkers(calendarMonth.y, calendarMonth.m);
      if (r.error) {
        toast.error(r.error);
        setMarkers({});
        return;
      }
      setMarkers(r.markers ?? {});
    } finally {
      setLoadingMonth(false);
    }
  }, [calendarMonth.y, calendarMonth.m]);

  const loadSlots = useCallback(async (date: string) => {
    setLoadingSlots(true);
    try {
      const r = await listAgendaDaySlots(date);
      if (r.error) {
        toast.error(r.error);
        setSlots([]);
        return;
      }
      setSlots(r.slots ?? []);
    } finally {
      setLoadingSlots(false);
    }
  }, []);

  useEffect(() => {
    void loadMarkers();
  }, [loadMarkers]);

  useEffect(() => {
    void loadSlots(selectedDate);
  }, [selectedDate, loadSlots]);

  useEffect(() => {
    const supabase = createBrowserSupabase();
    if (!supabase) return;

    const ch = supabase
      .channel(`agenda-sync-${barberUserId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
          filter: `barber_id=eq.${barberUserId}`,
        },
        () => {
          void loadMarkers();
          void loadSlots(selectedDate);
          router.refresh();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "agenda_day_slots",
          filter: `user_id=eq.${barberUserId}`,
        },
        () => {
          void loadMarkers();
          void loadSlots(selectedDate);
          router.refresh();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(ch);
    };
  }, [barberUserId, selectedDate, loadMarkers, loadSlots, router]);

  async function onAddSlot(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set("data", selectedDate);
    startTransition(async () => {
      const r = await addAgendaDaySlot(fd);
      if (r.error) toast.error(r.error);
      else {
        toast.success("Horário adicionado");
        form.reset();
        await loadMarkers();
        await loadSlots(selectedDate);
        router.refresh();
      }
    });
  }

  const markerForSelected = markers[selectedDate];

  return (
    <div className="mt-6 grid gap-8 lg:grid-cols-2">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-[var(--fg)]">Calendário</h3>
          {loadingMonth ? (
            <span className="text-xs text-[var(--muted)]">Atualizando…</span>
          ) : null}
        </div>
        <p className="mt-1 text-xs text-[var(--muted)]">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> com horário
            livre
          </span>
          {" · "}
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-red-500/80" /> cheio
          </span>
          {" · "}
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-zinc-400/60" /> sem cadastro
          </span>
        </p>
        <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
          <div className="mb-4 flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              className="!px-3 !py-2 text-xs"
              onClick={() =>
                setCalendarMonth((c) => {
                  const nm = c.m - 1;
                  if (nm < 0) return { y: c.y - 1, m: 11 };
                  return { y: c.y, m: nm };
                })
              }
            >
              ←
            </Button>
            <span className="text-sm font-medium capitalize">
              {new Date(calendarMonth.y, calendarMonth.m).toLocaleString("pt-BR", {
                month: "long",
                year: "numeric",
              })}
            </span>
            <Button
              type="button"
              variant="outline"
              className="!px-3 !py-2 text-xs"
              onClick={() =>
                setCalendarMonth((c) => {
                  const nm = c.m + 1;
                  if (nm > 11) return { y: c.y + 1, m: 0 };
                  return { y: c.y, m: nm };
                })
              }
            >
              →
            </Button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-medium uppercase tracking-wide text-[var(--muted)]">
            {WEEKDAYS.map((w) => (
              <div key={w} className="py-1">
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {monthCells.map((cell, i) => {
              if (!cell) {
                return <div key={`e-${i}`} className="aspect-square" />;
              }
              const iso = toISO(calendarMonth.y, calendarMonth.m, cell.day);
              const isPast = iso < today;
              const m = markers[iso] ?? "none";
              const isSelected = selectedDate === iso;
              return (
                <button
                  key={iso}
                  type="button"
                  disabled={isPast}
                  title={
                    isPast
                      ? "Data passada"
                      : m === "open"
                        ? "Horários livres"
                        : m === "full"
                          ? "Horários cadastrados, todos ocupados"
                          : "Sem horários cadastrados"
                  }
                  onClick={() => setSelectedDate(iso)}
                  className={`relative aspect-square rounded-xl text-sm font-medium transition ${
                    isSelected
                      ? "ring-2 ring-gold-500 ring-offset-2 ring-offset-[var(--card)]"
                      : ""
                  } ${
                    isPast
                      ? "cursor-not-allowed text-[var(--muted)] opacity-35"
                      : m === "open"
                        ? "bg-emerald-500/15 text-[var(--fg)] hover:bg-emerald-500/25"
                        : m === "full"
                          ? "bg-red-500/15 text-[var(--fg)] hover:bg-red-500/25"
                          : "bg-[var(--card)] text-[var(--muted)] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                  }`}
                >
                  {cell.day}
                  {!isPast && m !== "none" ? (
                    <span
                      className={`absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full ${
                        m === "open" ? "bg-emerald-500" : "bg-red-500"
                      }`}
                    />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-[var(--fg)]">
          {new Date(selectedDate + "T12:00:00").toLocaleDateString("pt-BR", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </h3>
        {markerForSelected === "none" ? (
          <p className="mt-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
            Data selecionada sem horários cadastrados. Adicione abaixo os inícios
            de atendimento (ex.: 09:00, 10:00).
          </p>
        ) : markerForSelected === "full" ? (
          <p className="mt-2 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-900 dark:text-red-100">
            Todos os horários desta data estão ocupados por reservas.
          </p>
        ) : (
          <p className="mt-2 text-xs text-[var(--muted)]">
            Esta data tem horários livres para agendamento público (considerando a
            duração mínima dos seus serviços).
          </p>
        )}

        <form onSubmit={onAddSlot} className="mt-4 flex flex-wrap items-end gap-2">
          <div className="min-w-[140px] flex-1">
            <Input name="hora" type="time" label="Novo horário" required />
          </div>
          <Button type="submit" disabled={pending} className="mb-0.5">
            {pending ? "Salvando…" : "Adicionar"}
          </Button>
        </form>

        <div className="mt-6">
          <p className="text-sm font-medium text-[var(--muted)]">Horários desta data</p>
          {loadingSlots ? (
            <p className="mt-2 text-sm text-[var(--muted)]">Carregando…</p>
          ) : slots.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--muted)]">Nenhum horário ainda.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {slots.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between rounded-2xl border border-[var(--border)] px-4 py-2.5 text-sm"
                >
                  <span className="tabular-nums font-medium">
                    {String(s.hora).slice(0, 5)}
                  </span>
                  <Button
                    type="button"
                    variant="danger"
                    className="!py-1.5 !px-3 text-xs"
                    disabled={pending}
                    onClick={() => {
                      startTransition(async () => {
                        const r = await deleteAgendaDaySlot(s.id);
                        if (r.error) toast.error(r.error);
                        else {
                          toast.success("Horário removido");
                          await loadMarkers();
                          await loadSlots(selectedDate);
                          router.refresh();
                        }
                      });
                    }}
                  >
                    Remover
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
