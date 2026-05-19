"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchAppointmentByAccessToken,
  type PublicAppointmentByToken,
} from "@/app/actions/appointment-public-token";
import {
  APPOINTMENT_STATUS,
  appointmentStatusLabel,
  normalizeAppointmentStatus,
} from "@/lib/appointments/status";
import { formatarDataBR } from "@/lib/formatar-data-br";

function statusPresentation(status: PublicAppointmentByToken["status"]) {
  const s = normalizeAppointmentStatus(status);
  const label = appointmentStatusLabel(s);
  switch (s) {
    case APPOINTMENT_STATUS.SCHEDULED:
      return {
        label,
        dot: "bg-emerald-500",
        text: "text-emerald-700 dark:text-emerald-400",
      };
    case APPOINTMENT_STATUS.COMPLETED:
      return {
        label,
        dot: "bg-gold-500",
        text: "text-gold-700 dark:text-gold-400",
      };
    case APPOINTMENT_STATUS.CANCELLED:
      return {
        label,
        dot: "bg-red-500",
        text: "text-red-700 dark:text-red-400",
      };
    case APPOINTMENT_STATUS.NO_SHOW:
      return {
        label,
        dot: "bg-amber-500",
        text: "text-amber-800 dark:text-amber-300",
      };
    default:
      return { label, dot: "bg-zinc-400", text: "text-zinc-600" };
  }
}

export function AppointmentTokenView({
  token,
  initial,
}: {
  token: string;
  initial: PublicAppointmentByToken;
}) {
  const [row, setRow] = useState<PublicAppointmentByToken>(initial);
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const r = await fetchAppointmentByAccessToken(token);
      if (!mountedRef.current) return;
      if (r.row) setRow(r.row);
    } catch {
      /* polling silencioso; dados iniciais permanecem */
    }
  }, [token]);

  useEffect(() => {
    mountedRef.current = true;
    const id = window.setInterval(() => {
      void refresh();
    }, 14000);
    return () => {
      mountedRef.current = false;
      window.clearInterval(id);
    };
  }, [refresh]);

  const st = statusPresentation(row.status);
  const dataFmt = formatarDataBR(row.data);

  return (
    <article className="mx-auto max-w-md px-4 py-10">
      <header className="mb-8 text-center">
        <p className="font-display text-2xl font-semibold tracking-tight text-[var(--fg)]">
          Seu agendamento
        </p>
      </header>

      <div className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <dl className="space-y-3 text-sm">
          <div className="flex gap-2">
            <dt className="shrink-0 text-[var(--muted)]">Data</dt>
            <dd className="font-medium text-[var(--fg)]">{dataFmt}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="shrink-0 text-[var(--muted)]">Horário</dt>
            <dd className="font-medium text-[var(--fg)]">
              {row.hora_inicio} – {row.hora_fim}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="shrink-0 text-[var(--muted)]">Barbearia</dt>
            <dd className="font-medium text-[var(--fg)]">{row.nome_barbearia}</dd>
          </div>
          {row.nome_servico ? (
            <div className="flex gap-2">
              <dt className="shrink-0 text-[var(--muted)]">Serviço</dt>
              <dd className="font-medium text-[var(--fg)]">{row.nome_servico}</dd>
            </div>
          ) : null}
          <div className="flex gap-2">
            <dt className="shrink-0 text-[var(--muted)]">Cliente</dt>
            <dd className="font-medium text-[var(--fg)]">{row.cliente_nome}</dd>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border)] pt-4">
            <dt className="text-[var(--muted)]">Status</dt>
            <dd className={`inline-flex items-center gap-2 font-semibold ${st.text}`}>
              <span className={`h-2.5 w-2.5 rounded-full ${st.dot}`} aria-hidden />
              {st.label}
            </dd>
          </div>
        </dl>

        <div className="mt-6 border-t border-dashed border-[var(--border)] pt-5 text-center text-xs text-[var(--muted)]">
          <p className="font-medium text-amber-800/90 dark:text-amber-200/90">Atenção</p>
          <p className="mt-2 leading-relaxed">
            Para cancelar ou reagendar, entre em contato diretamente com a barbearia.
          </p>
        </div>
      </div>
    </article>
  );
}
