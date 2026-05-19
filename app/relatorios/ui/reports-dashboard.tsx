"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  getBarberReport,
  getBarberReportExportPayload,
  getReportBarberOptions,
} from "@/app/actions/reports";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import type { ReportPeriodPreset } from "@/lib/reports/date-range";
import type { ReportSummary } from "@/lib/reports/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatarDataBR } from "@/lib/formatar-data-br";
import {
  AppointmentsByDayChart,
  RevenueByDayChart,
  TopServicesChart,
} from "./report-charts";

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const PRESETS: { id: ReportPeriodPreset; label: string }[] = [
  { id: "today", label: "Hoje" },
  { id: "week", label: "Esta semana" },
  { id: "month", label: "Este mês" },
  { id: "last30", label: "Últimos 30 dias" },
  { id: "custom", label: "Personalizado" },
];

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-black/[0.02] px-4 py-4 dark:bg-white/[0.03]">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">{label}</p>
      <p className="mt-2 font-display text-2xl font-semibold text-gold-600">{value}</p>
      {hint ? <p className="mt-1 text-xs text-[var(--muted)]">{hint}</p> : null}
    </div>
  );
}

export function ReportsDashboard({ barberUserId }: { barberUserId: string }) {
  const [preset, setPreset] = useState<ReportPeriodPreset>("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [barberFilter, setBarberFilter] = useState(barberUserId);
  const [barberOptions, setBarberOptions] = useState<{ id: string; label: string }[]>([]);
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const realtimeWarnedRef = useRef(false);

  useEffect(() => {
    void getReportBarberOptions()
      .then((r) => {
        if (r.barbers?.length) setBarberOptions(r.barbers);
      })
      .catch(() => {
        toast.error("Não foi possível carregar opções de barbeiro.");
      });
  }, []);

  const loadReport = useCallback(async (isStale?: () => boolean) => {
    setLoading(true);
    try {
      const r = await getBarberReport({
        preset,
        customFrom: preset === "custom" ? customFrom : undefined,
        customTo: preset === "custom" ? customTo : undefined,
        barberId: barberFilter,
      });
      if (isStale?.()) return;
      if (r.error) {
        toast.error(r.error);
        setSummary(null);
        return;
      }
      setSummary(r.summary ?? null);
    } catch {
      if (!isStale?.()) {
        toast.error("Não foi possível carregar o relatório.");
        setSummary(null);
      }
    } finally {
      if (!isStale?.()) setLoading(false);
    }
  }, [preset, customFrom, customTo, barberFilter]);

  useEffect(() => {
    let stale = false;
    if (preset === "custom" && (!customFrom || !customTo)) {
      setLoading(false);
      setSummary(null);
      return;
    }
    void loadReport(() => stale);
    return () => {
      stale = true;
    };
  }, [loadReport, preset, customFrom, customTo]);

  useEffect(() => {
    const supabase = createBrowserSupabase();
    if (!supabase) {
      if (!realtimeWarnedRef.current) {
        realtimeWarnedRef.current = true;
        toast.message("Tempo real indisponível. Atualize a página para ver mudanças.");
      }
      return;
    }

    const scheduleReload = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        void loadReport();
      }, 400);
    };

    const ch = supabase
      .channel(`reports-${barberUserId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
          filter: `barber_id=eq.${barberUserId}`,
        },
        scheduleReload
      )
      .subscribe();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      void supabase.removeChannel(ch);
    };
  }, [barberUserId, loadReport]);

  const periodLabel = useMemo(() => {
    if (!summary) return "";
    return `${formatarDataBR(summary.range.from)} – ${formatarDataBR(summary.range.to)}`;
  }, [summary]);

  function applyCustom() {
    startTransition(() => {
      void loadReport();
    });
  }

  async function onExportStub(format: "pdf" | "excel") {
    const r = await getBarberReportExportPayload({
      preset,
      customFrom: preset === "custom" ? customFrom : undefined,
      customTo: preset === "custom" ? customTo : undefined,
      barberId: barberFilter,
    });
    if (r.error) {
      toast.error(r.error);
      return;
    }
    const note = r.payload?.formats[format]?.note;
    toast.message(note ?? "Exportação em breve");
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-4xl font-bold">Relatórios</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Faturamento e desempenho operacional
            {periodLabel ? ` · ${periodLabel}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="!py-2 !px-3 text-xs"
            disabled
            title="Em breve"
            onClick={() => void onExportStub("pdf")}
          >
            Exportar PDF
          </Button>
          <Button
            type="button"
            variant="outline"
            className="!py-2 !px-3 text-xs"
            disabled
            title="Em breve"
            onClick={() => void onExportStub("excel")}
          >
            Exportar Excel
          </Button>
        </div>
      </div>

      <Card className="mt-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium">Período</p>
            <div className="mt-2 flex flex-wrap gap-2">
                  {PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPreset(p.id)}
                      className={`rounded-xl px-3 py-2 text-xs font-medium transition ${
                        preset === p.id
                          ? "bg-gold-500 text-ink-950 shadow-gold"
                          : "border border-[var(--border)] hover:border-gold-500/40"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
            </div>
          </div>

          {barberOptions.length > 0 ? (
            <div className="min-w-[12rem]">
              <label className="text-sm font-medium" htmlFor="barber-filter">
                Barbeiro
              </label>
              <select
                id="barber-filter"
                value={barberFilter}
                onChange={(e) => setBarberFilter(e.target.value)}
                className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm"
              >
                {barberOptions.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>

        {preset === "custom" ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-3 sm:items-end">
            <Input
              name="from"
              label="Data inicial"
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
            />
            <Input
              name="to"
              label="Data final"
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
            />
            <Button type="button" disabled={pending} onClick={applyCustom}>
              Aplicar
            </Button>
          </div>
        ) : null}
      </Card>

      {loading ? (
        <p className="mt-10 text-center text-sm text-[var(--muted)]">Carregando relatório…</p>
      ) : !summary ? (
        <p className="mt-10 text-center text-sm text-[var(--muted)]">
          Selecione um período válido para ver os dados.
        </p>
      ) : (
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <MetricCard
              label="Faturamento"
              value={brl.format(summary.financial.revenueTotal)}
              hint="Somente agendamentos realizados"
            />
            <MetricCard label="Ticket médio" value={brl.format(summary.financial.ticketMedio)} />
            <MetricCard label="Agendamentos" value={String(summary.counts.total)} />
            <MetricCard label="Realizados" value={String(summary.counts.completed)} />
            <MetricCard label="Clientes atendidos" value={String(summary.uniqueClients)} />
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Cancelados" value={String(summary.counts.cancelled)} />
            <MetricCard label="Não compareceu" value={String(summary.counts.no_show)} />
            <MetricCard label="Pendentes" value={String(summary.counts.pending)} />
            <MetricCard
              label="Serviços realizados"
              value={String(summary.financial.servicesCompletedCount)}
            />
          </div>

          {summary.insights.length > 0 ? (
            <Card className="mt-8">
              <h2 className="font-display text-xl font-semibold">Insights</h2>
              <ul className="mt-4 space-y-2">
                {summary.insights.map((line, i) => (
                  <li
                    key={`${i}-${line.slice(0, 24)}`}
                    className="flex gap-2 text-sm text-[var(--fg)]"
                  >
                    <span className="text-gold-500">•</span>
                    {line}
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <Card>
              <h2 className="font-display text-lg font-semibold">Faturamento por dia</h2>
              <div className="mt-4">
                <RevenueByDayChart data={summary.daily} />
              </div>
            </Card>
            <Card>
              <h2 className="font-display text-lg font-semibold">Agendamentos por dia</h2>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Cinza: total no dia · Dourado: realizados
              </p>
              <div className="mt-4">
                <AppointmentsByDayChart data={summary.daily} />
              </div>
            </Card>
          </div>

          <Card className="mt-6">
            <h2 className="font-display text-lg font-semibold">Serviços mais realizados</h2>
            <div className="mt-4">
              <TopServicesChart data={summary.byService} />
            </div>
          </Card>

          <Card className="mt-6">
            <h2 className="font-display text-lg font-semibold">Resumo por serviço</h2>
            {summary.byService.length === 0 ? (
              <p className="mt-4 text-sm text-[var(--muted)]">
                Nenhum serviço realizado no período.
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[28rem] text-left text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-[var(--muted)]">
                      <th className="py-2 pr-4 font-medium">Serviço</th>
                      <th className="py-2 pr-4 font-medium">Qtd.</th>
                      <th className="py-2 font-medium">Faturamento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.byService.map((s) => (
                      <tr
                        key={s.servico_id ?? s.nome}
                        className="border-b border-[var(--border)]/60"
                      >
                        <td className="py-3 pr-4">{s.nome}</td>
                        <td className="py-3 pr-4">{s.count}</td>
                        <td className="py-3">{brl.format(s.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
