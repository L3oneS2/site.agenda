import { afterEach, describe, expect, it, vi } from "vitest";
import { isPublicSubscriptionBypassEnabled } from "./public-subscription-bypass";

describe("isPublicSubscriptionBypassEnabled", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is always false when NODE_ENV is production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PUBLIC_BYPASS_SUBSCRIPTION", "1");
    expect(isPublicSubscriptionBypassEnabled()).toBe(false);
  });

  it("is false when VERCEL_ENV is production even in development node", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("PUBLIC_BYPASS_SUBSCRIPTION", "1");
    expect(isPublicSubscriptionBypassEnabled()).toBe(false);
  });

  it("honors flag in local development", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VERCEL_ENV", "development");
    vi.stubEnv("PUBLIC_BYPASS_SUBSCRIPTION", "1");
    expect(isPublicSubscriptionBypassEnabled()).toBe(true);
  });
});
