import { describe, expect, it } from "vitest";
import { cronBearerMatchesSecret } from "./cron-auth";

describe("cronBearerMatchesSecret", () => {
  it("accepts matching Bearer token", () => {
    const secret = "test-secret-value-16";
    expect(cronBearerMatchesSecret(secret, `Bearer ${secret}`)).toBe(true);
  });

  it("rejects wrong token", () => {
    expect(cronBearerMatchesSecret("secret-a", "Bearer secret-b")).toBe(false);
  });

  it("rejects missing or malformed Authorization", () => {
    expect(cronBearerMatchesSecret("x", null)).toBe(false);
    expect(cronBearerMatchesSecret("x", "Basic abc")).toBe(false);
    expect(cronBearerMatchesSecret("x", "Bearer")).toBe(false);
  });
});
