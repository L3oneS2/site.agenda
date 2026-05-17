import { describe, expect, it } from "vitest";
import {
  AUTO_COMPLETE_GRACE_MINUTES,
  canShowCancelButton,
  canShowNoShowButton,
  isInAutoCompleteGraceWindow,
  shouldAutoCompleteToFinalized,
} from "@/lib/appointments/lifecycle";

/** 17/05/2026 15:10 em São Paulo ≈ 18:10 UTC */
const TZ = "America/Sao_Paulo";

function spTime(isoDate: string, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  const probe = new Date(`${isoDate}T12:00:00.000Z`);
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    timeZoneName: "shortOffset",
  }).formatToParts(probe);
  const tzPart = fmt.find((p) => p.type === "timeZoneName")?.value ?? "GMT-3";
  const offsetMatch = /GMT([+-])(\d+)/.exec(tzPart);
  const sign = offsetMatch?.[1] === "-" ? -1 : 1;
  const hours = Number(offsetMatch?.[2] ?? 3);
  const offsetMs = sign * hours * 3600000;
  const [y, mo, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y!, mo! - 1, d!, h! - sign * hours, m!, 0));
}

describe("appointment lifecycle grace", () => {
  const data = "2026-05-17";
  const horaFim = "15:00:00";

  it("janela de tolerância 15:00–15:19", () => {
    const at1500 = spTime(data, "15:00");
    const at1519 = spTime(data, "15:19");
    const at1520 = spTime(data, "15:20");
    expect(isInAutoCompleteGraceWindow(data, horaFim, at1500)).toBe(true);
    expect(isInAutoCompleteGraceWindow(data, horaFim, at1519)).toBe(true);
    expect(isInAutoCompleteGraceWindow(data, horaFim, at1520)).toBe(false);
  });

  it("auto-finaliza a partir de 15:20", () => {
    const at1520 = spTime(data, "15:20");
    const at1519 = spTime(data, "15:19");
    expect(shouldAutoCompleteToFinalized(data, horaFim, at1519)).toBe(false);
    expect(shouldAutoCompleteToFinalized(data, horaFim, at1520)).toBe(true);
  });

  it("botões na janela: cancel e não compareceu", () => {
    const inGrace = spTime(data, "15:05");
    const beforeEnd = spTime(data, "14:30");
    expect(canShowNoShowButton(data, horaFim, inGrace)).toBe(true);
    expect(canShowCancelButton(data, horaFim, inGrace)).toBe(true);
    expect(canShowNoShowButton(data, horaFim, beforeEnd)).toBe(false);
    expect(canShowCancelButton(data, horaFim, beforeEnd)).toBe(false);
  });

  it("constante de tolerância", () => {
    expect(AUTO_COMPLETE_GRACE_MINUTES).toBe(20);
  });
});
