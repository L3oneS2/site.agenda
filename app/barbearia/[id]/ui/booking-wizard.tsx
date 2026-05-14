"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  bookPublicAppointment,
  getPublicMonthDayMarkers,
  getPublicSlots,
} from "@/app/actions/booking";
import { logClientDebug } from "@/lib/supabase/debug-env";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AgendaDayMarker, Service } from "@/lib/types";
import { formatarDataBR } from "@/lib/formatar-data-br";

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

type Step = 1 | 2 | 3;

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
  const [dayMarkers, setDayMarkers] = useState<Record<string, AgendaDayMarker>>({});
  const [loadingMarkers, setLoadingMarkers] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const t = new Date();
    return { y: t.getFullYear(), m: t.getMonth() };
  });
  const [date, setDate] = useState<string>(minDate);
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [horaInicio, setHoraInicio] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [confirmedLink, setConfirmedLink] = useState<{
    path: string;
    url?: string;
    bookingDate: string;
  } | null>(null);

  useEffect(() => {
    if (step !== 2 || !service) return;
    let cancelled = false;
    (async () => {
      setLoadingMarkers(true);
      try {
        const r = await getPublicMonthDayMarkers(
          barbershopId,
          service.duracao_minutos,
          calendarMonth.y,
          calendarMonth.m
        );
        if (cancelled) return;
        if (r.error) {
          toast.error(r.error);
          setDayMarkers({});
          return;
        }
        logClientDebug("booking", "marcadores do mês", {
          barbershopId,
          y: calendarMonth.y,
          m: calendarMonth.m,
          keys: Object.keys(r.markers ?? {}).length,
        });
        setDayMarkers(r.markers ?? {});
        const opens = Object.entries(r.markers ?? {}).filter(([, v]) => v === "open");
        opens.sort(([a], [b]) => a.localeCompare(b));
        if (opens.length) {
          const firstOpen = opens[0]![0];
          setDate((prev) => {
            const m = r.markers?.[prev];
            return m === "open" ? prev : firstOpen;
          });
        }
      } catch (e) {
        if (!cancelled) {
          logClientDebug("booking", "getPublicMonthDayMarkers falhou", {
            message: e instanceof Error ? e.message : String(e),
          });
          toast.error("Não foi possível carregar o calendário. Tente de novo em instantes.");
          setDayMarkers({});
        }
      } finally {
        if (!cancelled) setLoadingMarkers(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [step, service, barbershopId, calendarMonth.y, calendarMonth.m]);

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
          livres: r.slots?.length ?? 0,
        });
        setSlots(r.slots ?? []);
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
    if (step === 3 && service && date) {
      void loadSlots(date, service);
    }
  }, [step, service, date, loadSlots]);

  const monthCells = useMemo(
    () => monthMatrix(calendarMonth.y, calendarMonth.m),
    [calendarMonth.y, calendarMonth.m]
  );

  const monthHasAnyOpen = useMemo(
    () => Object.values(dayMarkers).some((v) => v === "open"),
    [dayMarkers]
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
      {confirmedLink ? (
        <div className="rounded-2xl border border-emerald-500/35 bg-emerald-500/10 p-4 text-sm text-emerald-950 dark:text-emerald-50">
          <p className="font-semibold">Reserva confirmada</p>
          <p className="mt-2 text-xs text-emerald-900/90 dark:text-emerald-100/90">
            Acesse os detalhes do seu agendamento quando quiser — guarde ou compartilhe o
            link abaixo (não é necessário criar conta).
          </p>
          <p className="mt-2 text-sm font-medium text-[var(--fg)]">
            Data da reserva: {formatarDataBR(confirmedLink.bookingDate)}
          </p>
          <p className="mt-3 break-all rounded-xl bg-black/[0.06] px-3 py-2 font-mono text-xs text-[var(--fg)] dark:bg-white/10">
            {confirmedLink.url ??
              (typeof window !== "undefined"
                ? `${window.location.origin}${confirmedLink.path}`
                : confirmedLink.path)}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="!py-2 !px-3 text-xs"
              onClick={async () => {
                const text =
                  confirmedLink.url ??
                  (typeof window !== "undefined"
                    ? `${window.location.origin}${confirmedLink.path}`
                    : confirmedLink.path);
                try {
                  await navigator.clipboard.writeText(text);
                  toast.success("Link copiado");
                } catch {
                  toast.error("Não foi possível copiar o link.");
                }
              }}
            >
              Copiar link
            </Button>
            <Button
              type="button"
              variant="outline"
              className="!py-2 !px-3 text-xs"
              onClick={() => setConfirmedLink(null)}
            >
              Fechar
            </Button>
          </div>
        </div>
      ) : null}

      <nav aria-label="Etapas" className="flex flex-wrap gap-2 text-xs text-[var(--muted)]">
        {(
          [
            [1, "Serviço"],
            [2, "Data"],
            [3, "Horário e confirmação"],
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
              Selecione o serviço. Os horários exibidos são os cadastrados pelo barbeiro
              para cada data.
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
                Verde: há pelo menos um horário livre para{" "}
                <strong className="text-[var(--fg)]">{service.duracao_minutos} min</strong>.
                Vermelho: nenhuma vaga neste dia. Cinza: sem horários cadastrados.
              </p>
              {loadingMarkers ? (
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
                  const marker = dayMarkers[iso] ?? "none";
                  const isSelected = date === iso;
                  return (
                    <button
                      key={iso}
                      type="button"
                      disabled={isPast || loadingMarkers}
                      title={
                        isPast
                          ? "Data passada"
                          : marker === "open"
                            ? "Horários livres"
                            : marker === "full"
                              ? "Horários ocupados"
                              : "Sem horários cadastrados"
                      }
                      onClick={() => {
                        if (isPast) return;
                        if (marker === "none") {
                          toast.message("Esta data não tem horários configurados pela barbearia.");
                          return;
                        }
                        if (marker === "full") {
                          toast.message("Todos os horários estão ocupados nesta data.");
                          return;
                        }
                        setDate(iso);
                        setStep(3);
                      }}
                      className={`aspect-square rounded-xl text-sm font-medium transition ${
                        isSelected
                          ? "ring-2 ring-gold-500 ring-offset-2 ring-offset-[var(--card)]"
                          : ""
                      } ${
                        isPast
                          ? "cursor-not-allowed text-[var(--muted)] opacity-40"
                          : marker === "open"
                            ? "bg-emerald-500/15 text-[var(--fg)] hover:bg-emerald-500/25"
                            : marker === "full"
                              ? "bg-red-500/15 text-[var(--fg)] hover:bg-red-500/20"
                              : "text-[var(--muted)] opacity-60 hover:opacity-90"
                      }`}
                    >
                      {cell.day}
                    </button>
                  );
                })}
              </div>
            </div>
            {!loadingMarkers && !monthHasAnyOpen ? (
              <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
                Nenhum dia com horário livre neste mês para este serviço. Tente outro mês
                ou outro serviço.
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
              {formatarDataBR(date)} · {service.nome}
            </p>
            {loadingSlots ? (
              <p className="text-sm text-[var(--muted)]">Carregando horários…</p>
            ) : slots.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">
                Nenhum horário disponível nesta data para este serviço. Escolha outra no
                calendário.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {slots.map((t) => {
                  const label = t.slice(0, 5);
                  const active = horaInicio === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setHoraInicio(t)}
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

            {horaInicio && service ? (
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
                      else if ("ok" in r && r.ok) {
                        const origin =
                          typeof window !== "undefined" ? window.location.origin : "";
                        setConfirmedLink({
                          path: r.appointmentPath,
                          url:
                            r.appointmentUrl ??
                            (origin ? `${origin}${r.appointmentPath}` : undefined),
                          bookingDate: date,
                        });
                        toast.success("Horário reservado com sucesso");
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
                  Resumo: {service.nome} · {formatarDataBR(date)} às{" "}
                  {horaInicio.slice(0, 5)}
                </p>
                <Input name="cliente_nome" label="Seu nome" required autoComplete="name" />
                <Input
                  name="cliente_email"
                  type="email"
                  label="E-mail (opcional)"
                  autoComplete="email"
                />
                <Input
                  name="cliente_telefone"
                  label="Telefone / WhatsApp"
                  required
                  autoComplete="tel"
                />
                <div className="flex flex-wrap gap-3">
                  <Button type="button" variant="outline" onClick={() => setStep(2)}>
                    Voltar
                  </Button>
                  <Button type="submit" className="!py-3" disabled={pending}>
                    {pending ? "Reservando…" : "Confirmar reserva"}
                  </Button>
                </div>
              </form>
            ) : null}

            {!horaInicio ? (
              <div className="flex flex-wrap gap-3">
                <Button type="button" variant="outline" onClick={() => setStep(2)}>
                  Voltar
                </Button>
              </div>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
