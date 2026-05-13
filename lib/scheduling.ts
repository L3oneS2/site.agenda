/** Granularidade legada (reservas por intervalo); mantida para referência futura. */
export const SLOT_STEP_MINUTES = 15;

export function timeStrToMinutes(t: string): number {
  const clean = t.slice(0, 8);
  const [h, m] = clean.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function minutesToTimeStr(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
}

export function normalizeTimeInput(t: string): string {
  if (t.length === 5) return `${t}:00`;
  return t;
}

/** Soma minutos a um horário HH:MM ou HH:MM:SS (sem cruzar meia-noite). */
export function addMinutesToTimeStr(start: string, add: number): string {
  const m = timeStrToMinutes(start) + add;
  if (m >= 24 * 60) {
    throw new Error("Horário ultrapassa o dia.");
  }
  return minutesToTimeStr(m);
}

/**
 * Sobreposição de intervalos semiabertos [início, fim) em minutos desde meia-noite.
 * Equivale a: (novoInicio < existenteFim) && (novoFim > existenteInicio)
 */
export function intervalsOverlapMinutes(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number
): boolean {
  return aStart < bEnd && aEnd > bStart;
}

export function hasOverlapWithBooked(
  startMin: number,
  endMin: number,
  booked: { startMin: number; endMin: number }[]
): boolean {
  for (const b of booked) {
    if (intervalsOverlapMinutes(startMin, endMin, b.startMin, b.endMin)) {
      return true;
    }
  }
  return false;
}

export function bookedRowsToIntervals(
  rows: { hora_inicio: string; hora_fim: string }[]
): { startMin: number; endMin: number }[] {
  return rows.map((r) => ({
    startMin: timeStrToMinutes(String(r.hora_inicio)),
    endMin: timeStrToMinutes(String(r.hora_fim)),
  }));
}

/**
 * Cada string é um início explícito (HH:MM:SS) cadastrado pelo barbeiro para a data.
 * Classifica em livres (cabem duration sem colidir) vs bloqueados (colidem ou estouram o dia).
 */
export function discreteSlotsFreeAndBlocked(
  slotStartsNormalized: string[],
  bookedIntervals: { startMin: number; endMin: number }[],
  durationMinutes: number
): { free: string[]; blocked: string[] } {
  const free: string[] = [];
  const blocked: string[] = [];
  const sorted = [...new Set(slotStartsNormalized)].sort(
    (a, b) => timeStrToMinutes(a) - timeStrToMinutes(b)
  );
  for (const hora of sorted) {
    const startMin = timeStrToMinutes(hora);
    const endMin = startMin + durationMinutes;
    if (endMin > 24 * 60) {
      blocked.push(hora);
      continue;
    }
    if (hasOverlapWithBooked(startMin, endMin, bookedIntervals)) {
      blocked.push(hora);
    } else {
      free.push(hora);
    }
  }
  return { free, blocked };
}
