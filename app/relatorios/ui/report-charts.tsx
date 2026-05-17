"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ReportDailyPoint, ReportServiceRow } from "@/lib/reports/types";
import { formatarDataBR } from "@/lib/formatar-data-br";

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function shortDate(iso: string) {
  return formatarDataBR(iso).slice(0, 5);
}

const tooltipStyle = {
  borderRadius: "12px",
  border: "1px solid var(--border)",
  background: "var(--card)",
  color: "var(--fg)",
};

export function RevenueByDayChart({ data }: { data: ReportDailyPoint[] }) {
  const chartData = data.map((d) => ({
    ...d,
    label: shortDate(d.date),
  }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="var(--muted)" />
          <YAxis tick={{ fontSize: 11 }} stroke="var(--muted)" width={48} />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v: number) => [brl.format(v), "Faturamento"]}
            labelFormatter={(_, payload) => {
              const p = payload?.[0]?.payload as { date?: string } | undefined;
              return p?.date ? formatarDataBR(p.date) : "";
            }}
          />
          <Line
            type="monotone"
            dataKey="revenue"
            stroke="#d4af37"
            strokeWidth={2}
            dot={{ r: 3, fill: "#d4af37" }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AppointmentsByDayChart({ data }: { data: ReportDailyPoint[] }) {
  const chartData = data.map((d) => ({
    ...d,
    label: shortDate(d.date),
  }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="var(--muted)" />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="var(--muted)" width={32} />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v: number, name: string) => [
              v,
              name === "completed" ? "Realizados" : "Total",
            ]}
          />
          <Bar
            dataKey="appointments"
            fill="rgba(113,113,122,0.45)"
            radius={[6, 6, 0, 0]}
            name="appointments"
          />
          <Bar dataKey="completed" fill="#d4af37" radius={[6, 6, 0, 0]} name="completed" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TopServicesChart({ data }: { data: ReportServiceRow[] }) {
  const top = data.slice(0, 8).map((s) => ({
    name: s.nome.length > 18 ? `${s.nome.slice(0, 16)}…` : s.nome,
    count: s.count,
  }));

  if (top.length === 0) {
    return (
      <p className="flex h-64 items-center justify-center text-sm text-[var(--muted)]">
        Sem serviços realizados no período.
      </p>
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={top} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} stroke="var(--muted)" />
          <YAxis
            type="category"
            dataKey="name"
            width={100}
            tick={{ fontSize: 11 }}
            stroke="var(--muted)"
          />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar dataKey="count" fill="#d4af37" radius={[0, 6, 6, 0]} name="Quantidade" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
