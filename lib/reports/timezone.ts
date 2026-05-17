/** Fuso padrão do produto (barbearias BR). Futuro: campo no perfil. */
export const REPORT_TIMEZONE = "America/Sao_Paulo";

const dtfDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: REPORT_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const dtfParts = new Intl.DateTimeFormat("en-US", {
  timeZone: REPORT_TIMEZONE,
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** `YYYY-MM-DD` no fuso de relatórios. */
export function todayYmdInReportTz(now = new Date()): string {
  return dtfDate.format(now);
}

export function parseYmd(ymd: string): { y: number; m: number; d: number } {
  const [y, m, d] = ymd.split("-").map(Number);
  return { y: y ?? 0, m: (m ?? 1) - 1, d: d ?? 1 };
}

export function addDaysYmd(ymd: string, days: number): string {
  const { y, m, d } = parseYmd(ymd);
  const dt = new Date(Date.UTC(y, m, d, 12, 0, 0));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** Dia da semana 0=Dom … 6=Sáb no fuso de relatórios. */
export function weekdayIndexInReportTz(ymd: string): number {
  const { y, m, d } = parseYmd(ymd);
  const noon = new Date(Date.UTC(y, m, d, 12, 0, 0));
  const wd = dtfParts.formatToParts(noon).find((p) => p.type === "weekday")?.value;
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[wd ?? "Mon"] ?? 1;
}

const WEEKDAY_PT = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
];

export function weekdayLabelPt(ymd: string): string {
  return WEEKDAY_PT[weekdayIndexInReportTz(ymd)] ?? ymd;
}

/** Fim do agendamento já passou no fuso de relatórios? */
export function appointmentEndPassed(
  data: string,
  horaFim: string,
  now = new Date()
): boolean {
  const end = horaFim.slice(0, 8);
  const today = todayYmdInReportTz(now);
  if (data < today) return true;
  if (data > today) return false;
  const nowParts = dtfParts.formatToParts(now);
  const hh = Number(nowParts.find((p) => p.type === "hour")?.value ?? 0);
  const mm = Number(nowParts.find((p) => p.type === "minute")?.value ?? 0);
  const nowMin = hh * 60 + mm;
  const [eh, em] = end.split(":").map(Number);
  const endMin = (eh ?? 0) * 60 + (em ?? 0);
  return nowMin >= endMin;
}
