"use client";

import { useEffect, useState } from "react";
import {
  canShowCancelButton,
  canShowNoShowButton,
  isInAutoCompleteGraceWindow,
} from "@/lib/appointments/lifecycle";
import { CancelAppointmentButton, MarkAppointmentNoShowButton } from "./agenda-client";

const CLOCK_TICK_MS = 30_000;

export function AppointmentGraceActions({
  appointmentId,
  data,
  horaFim,
  className,
  compact,
}: {
  appointmentId: string;
  data: string;
  horaFim: string;
  className?: string;
  compact?: boolean;
}) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), CLOCK_TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  const showCancel = canShowCancelButton(data, horaFim, now);
  const showNoShow = canShowNoShowButton(data, horaFim, now);
  const inGrace = isInAutoCompleteGraceWindow(data, horaFim, now);

  if (!showCancel && !showNoShow) {
    return null;
  }

  const btnClass = compact ? "!py-1 !px-2 text-[10px] font-medium" : className;

  return (
    <div className={`flex flex-wrap items-center gap-1 ${compact ? "" : "gap-2"}`}>
      {inGrace ? (
        <span className="inline-block rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:text-amber-200">
          tolerância 20 min
        </span>
      ) : null}
      {showCancel ? (
        <CancelAppointmentButton id={appointmentId} className={btnClass} label="Cancelar" />
      ) : null}
      {showNoShow ? (
        <MarkAppointmentNoShowButton
          id={appointmentId}
          className={btnClass}
          label="Não compareceu"
        />
      ) : null}
    </div>
  );
}
