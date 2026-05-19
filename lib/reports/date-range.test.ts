import { describe, expect, it } from "vitest";
import {
  previousPeriodRange,
  resolveReportDateRange,
} from "@/lib/reports/date-range";

describe("resolveReportDateRange", () => {
  const now = new Date("2026-05-17T15:00:00.000Z");

  it("resolve hoje", () => {
    const r = resolveReportDateRange("today", undefined, undefined, now);
    expect(r.range?.from).toBe("2026-05-17");
    expect(r.range?.to).toBe("2026-05-17");
  });

  it("rejeita custom inválido", () => {
    const r = resolveReportDateRange("custom", "2026-05-20", "2026-05-10", now);
    expect(r.error).toBeTruthy();
  });

  it("calcula período anterior", () => {
    const r = resolveReportDateRange("today", undefined, undefined, now);
    const prev = previousPeriodRange(r.range!);
    expect(prev.from).toBe("2026-05-16");
    expect(prev.to).toBe("2026-05-16");
  });

  it("semana começa na segunda no fuso de relatórios", () => {
    const sunday = new Date("2026-05-17T15:00:00.000Z");
    const r = resolveReportDateRange("week", undefined, undefined, sunday);
    expect(r.range?.from).toBe("2026-05-11");
    expect(r.range?.to).toBe("2026-05-17");
  });
});
