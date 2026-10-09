import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock server-only to allow importing lib/env in tests
vi.mock("server-only", () => ({}));

describe("lib/env", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("NEXT_PUBLIC_SITE_URL", () => {
    it("production + unset rejects importing with /must be set in production/", async () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("NEXT_PUBLIC_SITE_URL", undefined as unknown as string);

      await expect(async () => {
        await import("@/lib/env");
      }).rejects.toThrow(/must be set in production/);
    });

    it("production + empty string also rejects", async () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");

      await expect(async () => {
        await import("@/lib/env");
      }).rejects.toThrow();
    });

    it("production + https://app.sitetech.ai gives exactly that URL", async () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://app.sitetech.ai");

      const { env } = await import("@/lib/env");
      expect(env.NEXT_PUBLIC_SITE_URL).toBe("https://app.sitetech.ai");
    });

    it("test + unset gives http://localhost:3000", async () => {
      vi.stubEnv("NODE_ENV", "test");
      vi.stubEnv("NEXT_PUBLIC_SITE_URL", undefined as unknown as string);

      const { env } = await import("@/lib/env");
      expect(env.NEXT_PUBLIC_SITE_URL).toBe("http://localhost:3000");
    });
  });

  describe("signInWithMagicLink in production", () => {
    it("signInWithOtp is never called in production with var unset", async () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("NEXT_PUBLIC_SITE_URL", undefined as unknown as string);

      // Attempting to import signInWithMagicLink should fail because it imports lib/env
      await expect(async () => {
        await import("@/app/login/actions");
      }).rejects.toThrow(/must be set in production/);
    });
  });
});
