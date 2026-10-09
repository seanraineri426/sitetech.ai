import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "../proxy";

// Mock @supabase/ssr
vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(),
    },
  })),
}));

describe("proxy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  });

  describe("authentication protection", () => {
    it("redirects unauthenticated user from /app to /login with next param", async () => {
      const { createServerClient } = await import("@supabase/ssr");
      (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
        },
      });

      const request = new NextRequest(new URL("http://localhost:3000/app"));
      const response = await proxy(request);

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toContain("/login");
      expect(response.headers.get("location")).toContain("next=%2Fapp");
    });

    it("redirects unauthenticated user from /app/dashboard to /login with correct next param", async () => {
      const { createServerClient } = await import("@supabase/ssr");
      (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
        },
      });

      const request = new NextRequest(new URL("http://localhost:3000/app/dashboard"));
      const response = await proxy(request);

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toContain("/login");
      expect(response.headers.get("location")).toContain("next=%2Fapp%2Fdashboard");
    });

    it("allows authenticated user to access /app", async () => {
      const { createServerClient } = await import("@supabase/ssr");
      (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: "123", email: "test@example.com" } },
          }),
        },
      });

      const request = new NextRequest(new URL("http://localhost:3000/app"));
      const response = await proxy(request);

      // Should not redirect (status 200 or undefined for next())
      expect(response.status).not.toBe(307);
      expect(response.headers.get("location")).toBeNull();
    });

    it("allows unauthenticated access to /login", async () => {
      const { createServerClient } = await import("@supabase/ssr");
      (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
        },
      });

      const request = new NextRequest(new URL("http://localhost:3000/login"));
      const response = await proxy(request);

      // Should not redirect
      expect(response.status).not.toBe(307);
      expect(response.headers.get("location")).toBeNull();
    });

    it("allows unauthenticated access to /auth/callback", async () => {
      const { createServerClient } = await import("@supabase/ssr");
      (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
        },
      });

      const request = new NextRequest(new URL("http://localhost:3000/auth/callback"));
      const response = await proxy(request);

      // Should not redirect
      expect(response.status).not.toBe(307);
      expect(response.headers.get("location")).toBeNull();
    });
  });
});
