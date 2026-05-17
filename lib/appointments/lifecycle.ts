import { REPORT_TIMEZONE, todayYmdInReportTz } from "@/lib/reports/timezone";

/** Minutos após `hora_fim` antes de finalizar automaticamente (`scheduled` → `completed`). */
export const AUTO_COMPLETE_GRACE_MINUTES = 20;

export function timeStrToMinutes(t: string): number {
  const clean = t.slice(0, 8);
  const [h, m, s] = clean.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0) + ((s ?? 0) > 0 ? 1 : 0);
}

export function nowMinutesInReportTz(now = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: REPORT_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const hh = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const mm = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return hh * 60 + mm;
}

/** Término do atendimento já ocorreu (fuso America/Sao_Paulo). */
export function isAtOrAfterAppointmentEnd(
  data: string,
  horaFim: string,
  now = new Date()
): boolean {
  const today = todayYmdInReportTz(now);
  if (data < today) return true;
  if (data > today) return false;
  return nowMinutesInReportTz(now) >= timeStrToMinutes(horaFim);
}

/**
 * Janela de tolerância: [hora_fim, hora_fim + 20min) no dia do agendamento.
 * Ex.: 15:00–15:19 → true; 15:20 → false (auto-finaliza no minuto 20+).
 */
export function isInAutoCompleteGraceWindow(
  data: string,
  horaFim: string,
  now = new Date()
): boolean {
  const today = todayYmdInReportTz(now);
  if (data !== today) return false;
  const nowMin = nowMinutesInReportTz(now);
  const endMin = timeStrToMinutes(horaFim);
  const graceEnd = endMin + AUTO_COMPLETE_GRACE_MINUTES;
  return nowMin >= endMin && nowMin < graceEnd;
}

/** Pode finalizar automaticamente: passou o fim + 20 min (ou dia anterior ainda `scheduled`). */
export function shouldAutoCompleteToFinalized(
  data: string,
  horaFim: string,
  now = new Date()
): boolean {
  const today = todayYmdInReportTz(now);
  if (data > today) return false;
  if (data < today) return true;
  return nowMinutesInReportTz(now) >= timeStrToMinutes(horaFim) + AUTO_COMPLETE_GRACE_MINUTES;
}

/**
 * Cancelar: dia futuro, ou na janela de tolerância (20 min após o fim).
 * Não exibe antes do término no mesmo dia — use a tolerância para cancelar/no-show.
 */
export function canShowCancelButton(
  data: string,
  horaFim: string,
  now = new Date()
): boolean {
  const today = todayYmdInReportTz(now);
  if (data > today) return true;
  return isInAutoCompleteGraceWindow(data, horaFim, now);
}

/** Não compareceu: somente na janela de tolerância após o fim. */
export function canShowNoShowButton(
  data: string,
  horaFim: string,
  now = new Date()
): boolean {
  return isInAutoCompleteGraceWindow(data, horaFim, now);
}

/** Ambos os botões de ação na janela (cancel + não compareceu na tolerância). */
export function canShowGracePeriodActionButtons(
  data: string,
  horaFim: string,
  now = new Date()
): boolean {
  return isInAutoCompleteGraceWindow(data, horaFim, now);
}
