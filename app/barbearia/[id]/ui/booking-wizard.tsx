"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  bookPublicAppointment,
  getDatesWithAvailability,
  getPublicSlots,
} from "@/app/actions/booking";
import { logClientDebug } from "@/lib/supabase/debug-env";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Service } from "@/lib/types";

function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

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

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

type Step = 1 | 2 | 3 | 4;

export function BookingWizard({
  barbershopId,
  services,
}: {
  barbershopId: string;
  services: Service[];
}) {
  const minDate = useMemo(() => todayISODate(), []);
  const [step, setStep] = useState<Step>(1);
  const [service, setService] = useState<Service | null>(null);
  const [availableDates, setAvailableDates] = useState<Set<string>>(new Set());
  const [loadingDates, setLoadingDates] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const t = new Date();
    return { y: t.getFullYear(), m: t.getMonth() };
  });
  const [date, setDate] = useState<string>(minDate);
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [horaInicio, setHoraInicio] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (step !== 2 || !service) return;
    let cancelled = false;
    (async () => {
      setLoadingDates(true);
      try {
        const r = await getDatesWithAvailability(
          barbershopId,
          service.duracao_minutos,
          minDate,
          28
        );
        if (cancelled) return;
        if (r.error) {
          toast.error(r.error);
          setAvailableDates(new Set());
          return;
        }
        logClientDebug("booking", "datas disponíveis", {
          barbershopId,
          serviceMin: service.duracao_minutos,
          from: minDate,
          count: r.dates?.length ?? 0,
        });
        const next = new Set(r.dates ?? []);
        setAvailableDates(next);
        const sorted = [...next].sort();
        if (sorted.length) {
          setDate((prev) => (next.has(prev) ? prev : sorted[0]!));
        }
      } catch (e) {
        if (!cancelled) {
          logClientDebug("booking", "getDatesWithAvailability falhou", {
            message: e instanceof Error ? e.message : String(e),
          });
          toast.error("Não foi possível carregar o calendário. Tente de novo em instantes.");
          setAvailableDates(new Set());
        }
      } finally {
        if (!cancelled) setLoadingDates(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [step, service, barbershopId, minDate]);

  const loadSlots = useCallback(
    async (d: string, svc: Service) => {
      setLoadingSlots(true);
      setHoraInicio(null);
      try {
        const r = await getPublicSlots(barbershopId, d, svc.duracao_minutos);
        if (r.error) {
          toast.error(r.error);
          setSlots([]);
          return;
        }
        logClientDebug("booking", "horários carregados", {
          barbershopId,
          data: d,
          duracao: svc.duracao_minutos,
          qtd: r.slots?.length ?? 0,
        });
        setSlots(r.slots ?? []);
        if ((r.slots ?? []).length === 0) {
          toast.message("Sem horários nesta data para este serviço.");
        }
      } catch (e) {
        logClientDebug("booking", "getPublicSlots falhou", {
          message: e instanceof Error ? e.message : String(e),
        });
        toast.error("Não foi possível carregar os horários.");
        setSlots([]);
      } finally {
        setLoadingSlots(false);
      }
    },
    [barbershopId]
  );

  useEffect(() => {
    if (step >= 3 && service && date) {
      void loadSlots(date, service);
    }
  }, [step, service, date, loadSlots]);

  const monthCells = useMemo(
    () => monthMatrix(calendarMonth.y, calendarMonth.m),
    [calendarMonth.y, calendarMonth.m]
  );

  if (services.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-8 text-center text-sm text-[var(--muted)]">
        Cadastre serviços no painel do barbeiro para habilitar agendamentos.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <nav aria-label="Etapas" className="flex flex-wrap gap-2 text-xs text-[var(--muted)]">
        {(
          [
            [1, "Serviço"],
            [2, "Data"],
            [3, "Horário"],
            [4, "Seus dados"],
          ] as const
        ).map(([n, label]) => (
          <span
            key={n}
            className={`rounded-full px-3 py-1 ${
              step === n
                ? "bg-gold-500/15 font-medium text-gold-700 ring-1 ring-gold-500/30 dark:text-gold-300"
                : step > n
                  ? "text-[var(--fg)]"
                  : ""
            }`}
          >
            {n}. {label}
          </span>
        ))}
      </nav>

      <AnimatePresence mode="wait">
        {step === 1 ? (
          <motion.div
            key="s1"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            <p className="text-sm text-[var(--muted)]">
              Selecione o serviço. A duração define os horários disponíveis.
            </p>
            <ul className="grid gap-3 sm:grid-cols-2">
              {services.map((s) => {
                const active = service?.id === s.id;
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => setService(s)}
                      className={`w-full rounded-2xl border p-4 text-left transition ${
                        active
                          ? "border-gold-500 bg-gold-500/10 shadow-gold ring-2 ring-gold-500/30"
                          : "border-[var(--border)] hover:border-gold-500/40"
                      }`}
                    >
                      <span className="font-medium">{s.nome}</span>
                      <span className="mt-1 flex items-center justify-between text-sm text-[var(--muted)]">
                        <span>{brl.format(s.preco)}</span>
                        <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs dark:bg-white/10">
                          ⏱ {s.duracao_minutos} min
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <Button
              type="button"
              className="w-full sm:w-auto"
              disabled={!service}
              onClick={() => setStep(2)}
            >
              Continuar
            </Button>
          </motion.div>
        ) : null}

        {step === 2 && service ? (
          <motion.div
            key="s2"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-[var(--muted)]">
                Só aparecem dias com espaço para{" "}
                <strong className="text-[var(--fg)]">
                  {service.duracao_minutos} min
                </strong>
                .
              </p>
              {loadingDates ? (
                <span className="text-xs text-[var(--muted)]">Carregando…</span>
              ) : null}
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
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
                  const isPast = iso < minDate;
                  const hasSlot = availableDates.has(iso);
                  const isSelected = date === iso;
                  return (
                    <button
                      key={iso}
                      type="button"
                      disabled={isPast || !hasSlot || loadingDates}
                      title={
                        isPast
                          ? "Data passada"
                          : !hasSlot
                            ? "Indisponível"
                            : "Disponível"
                      }
                      onClick={() => {
                        setDate(iso);
                        setStep(3);
                      }}
                      className={`aspect-square rounded-xl text-sm font-medium transition ${
                        isSelected
                          ? "bg-gold-500 text-white shadow-gold"
                          : hasSlot && !isPast
                            ? "bg-gold-500/15 text-[var(--fg)] hover:bg-gold-500/25"
                            : isPast
                              ? "cursor-not-allowed text-[var(--muted)] opacity-40"
                              : "cursor-not-allowed text-[var(--muted)] opacity-35"
                      }`}
                    >
                      {cell.day}
                    </button>
                  );
                })}
              </div>
            </div>
            {!loadingDates && availableDates.size === 0 ? (
              <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
                Nenhum dia com horário livre nos próximos 28 dias para este serviço.
                Tente outro ou fale com a barbearia.
              </p>
            ) : null}
            <Button type="button" variant="outline" onClick={() => setStep(1)}>
              Voltar
            </Button>
          </motion.div>
        ) : null}

        {step === 3 && service ? (
          <motion.div
            key="s3"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            <p className="text-sm text-[var(--muted)]">
              {new Date(date + "T12:00:00").toLocaleDateString("pt-BR", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}{" "}
              · {service.nome}
            </p>
            {loadingSlots ? (
              <p className="text-sm text-[var(--muted)]">Carregando horários…</p>
            ) : slots.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">
                Nenhum horário livre. Escolha outra data.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {slots.map((s) => {
                  const label = s.slice(0, 5);
                  const active = horaInicio === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setHoraInicio(s)}
                      className={`rounded-2xl border px-4 py-2 text-sm transition ${
                        active
                          ? "border-gold-500 bg-gold-500/10 text-[var(--fg)] shadow-gold"
                          : "border-[var(--border)] hover:border-gold-500/40"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="outline" onClick={() => setStep(2)}>
                Voltar
              </Button>
              <Button
                type="button"
                disabled={!horaInicio}
                onClick={() => setStep(4)}
              >
                Continuar
              </Button>
            </div>
          </motion.div>
        ) : null}

        {step === 4 && service && horaInicio ? (
          <motion.div
            key="s4"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.2 }}
          >
            <form
              className="space-y-4 border-t border-[var(--border)] pt-6"
              onSubmit={(e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                form.set("barbershop_id", barbershopId);
                form.set("data", date);
                form.set("servico_id", service.id);
                form.set("hora_inicio", horaInicio);
                startTransition(async () => {
                  try {
                    const r = await bookPublicAppointment(form);
                    if (r.error) toast.error(r.error);
                    else {
                      toast.success("Agendamento confirmado! Entraremos em contato.");
                      setHoraInicio(null);
                      setStep(1);
                      setService(null);
                    }
                  } catch (e) {
                    logClientDebug("booking", "bookPublicAppointment falhou", {
                      message: e instanceof Error ? e.message : String(e),
                    });
                    toast.error(
                      "Não foi possível concluir o agendamento. Verifique a conexão e tente novamente."
                    );
                  }
                });
              }}
            >
              <p className="text-sm text-[var(--muted)]">
                Resumo: {service.nome} ·{" "}
                {new Date(date + "T12:00:00").toLocaleDateString("pt-BR")} às{" "}
                {horaInicio.slice(0, 5)}
              </p>
              <Input name="cliente_nome" label="Seu nome" required autoComplete="name" />
              <Input
                name="cliente_telefone"
                label="Telefone / WhatsApp"
                required
                autoComplete="tel"
              />
              <div className="flex flex-wrap gap-3">
                <Button type="button" variant="outline" onClick={() => setStep(3)}>
                  Voltar
                </Button>
                <Button type="submit" className="!py-3" disabled={pending}>
                  {pending ? "Reservando…" : "Confirmar agendamento"}
                </Button>
              </div>
            </form>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
