import {
  addDaysYmd,
  parseYmd,
  todayYmdInReportTz,
  weekdayIndexInReportTz,
} from "@/lib/reports/timezone";

export type ReportPeriodPreset =
  | "today"
  | "week"
  | "month"
  | "last30"
  | "custom";

export type ReportDateRange = {
  preset: ReportPeriodPreset;
  from: string;
  to: string;
};

const MAX_CUSTOM_DAYS = 366;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Segunda-feira da semana civil que contém `ymd` (ISO semana iniciando segunda). */
export function startOfWeekMondayYmd(ymd: string): string {
  const wd = weekdayIndexInReportTz(ymd);
  const diff = wd === 0 ? -6 : 1 - wd;
  return addDaysYmd(ymd, diff);
}

export function startOfMonthYmd(ymd: string): string {
  const [y, m] = ymd.split("-");
  return `${y}-${m}-01`;
}

export function endOfMonthYmd(ymd: string): string {
  const { y, m } = parseYmd(ymd);
  const last = new Date(Date.UTC(y, m + 1, 0, 12, 0, 0)).getUTCDate();
  return `${y}-${pad2(m + 1)}-${pad2(last)}`;
}

export function resolveReportDateRange(
  preset: ReportPeriodPreset,
  customFrom?: string,
  customTo?: string,
  now = new Date()
): { range?: ReportDateRange; error?: string } {
  const today = todayYmdInReportTz(now);

  if (preset === "today") {
    return { range: { preset, from: today, to: today } };
  }

  if (preset === "week") {
    const from = startOfWeekMondayYmd(today);
    return { range: { preset, from, to: today } };
  }

  if (preset === "month") {
    const from = startOfMonthYmd(today);
    return { range: { preset, from, to: today } };
  }

  if (preset === "last30") {
    return { range: { preset, from: addDaysYmd(today, -29), to: today } };
  }

  if (preset === "custom") {
    const from = (customFrom ?? "").trim();
    const to = (customTo ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return { error: "Informe datas válidas (início e fim)." };
    }
    if (from > to) {
      return { error: "A data inicial não pode ser depois da final." };
    }
    const days =
      Math.round(
        (Date.parse(`${to}T12:00:00.000Z`) - Date.parse(`${from}T12:00:00.000Z`)) /
          86400000
      ) + 1;
    if (days > MAX_CUSTOM_DAYS) {
      return { error: `Período máximo de ${MAX_CUSTOM_DAYS} dias.` };
    }
    return { range: { preset, from, to } };
  }

  return { error: "Período inválido." };
}

/** Período anterior com a mesma quantidade de dias (inclusivo). */
export function previousPeriodRange(range: ReportDateRange): ReportDateRange {
  const days =
    Math.round(
      (Date.parse(`${range.to}T12:00:00.000Z`) -
        Date.parse(`${range.from}T12:00:00.000Z`)) /
        86400000
    ) + 1;
  const prevTo = addDaysYmd(range.from, -1);
  const prevFrom = addDaysYmd(prevTo, -(days - 1));
  return { preset: range.preset, from: prevFrom, to: prevTo };
}

export function eachDayInRange(from: string, to: string): string[] {
  const out: string[] = [];
  let cur = from;
  while (cur <= to) {
    out.push(cur);
    cur = addDaysYmd(cur, 1);
  }
  return out;
}
