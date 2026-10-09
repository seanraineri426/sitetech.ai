import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../route";

// Mock dependencies
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  env: {
    NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
  },
}));

describe("/auth/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("error handling", () => {
    it("redirects to login with error when code is missing", async () => {
      const request = new NextRequest(new URL("http://localhost:3000/auth/callback"));
      const response = await GET(request);

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe(
        "http://localhost:3000/login?error=auth_failed"
      );
    });

    it("redirects to login with error when error param is present", async () => {
      const request = new NextRequest(
        new URL("http://localhost:3000/auth/callback?error=access_denied&code=abc123")
      );
      const response = await GET(request);

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe(
        "http://localhost:3000/login?error=auth_failed"
      );
    });

    it("redirects to login with error when error_description is present", async () => {
      const request = new NextRequest(
        new URL(
          "http://localhost:3000/auth/callback?error_description=User+cancelled&code=abc123"
        )
      );
      const response = await GET(request);

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe(
        "http://localhost:3000/login?error=auth_failed"
      );
    });

    it("redirects to login when exchangeCodeForSession fails", async () => {
      const { createClient } = await import("@/lib/supabase/server");
      (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
        auth: {
          exchangeCodeForSession: vi.fn().mockResolvedValue({
            error: { message: "Invalid code" },
          }),
        },
      });

      const request = new NextRequest(
        new URL("http://localhost:3000/auth/callback?code=invalid")
      );
      const response = await GET(request);

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe(
        "http://localhost:3000/login?error=auth_failed"
      );
    });
  });

  describe("successful authentication", () => {
    it("redirects to /app by default when no next param", async () => {
      const { createClient } = await import("@/lib/supabase/server");
      (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
        auth: {
          exchangeCodeForSession: vi.fn().mockResolvedValue({ error: null }),
        },
      });

      const request = new NextRequest(
        new URL("http://localhost:3000/auth/callback?code=valid123")
      );
      const response = await GET(request);

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("http://localhost:3000/app");
    });

    it("redirects to sanitized next param when provided", async () => {
      const { createClient } = await import("@/lib/supabase/server");
      (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
        auth: {
          exchangeCodeForSession: vi.fn().mockResolvedValue({ error: null }),
        },
      });

      const request = new NextRequest(
        new URL("http://localhost:3000/auth/callback?code=valid123&next=/dashboard")
      );
      const response = await GET(request);

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("http://localhost:3000/dashboard");
    });

    it("rejects malicious next param and uses default", async () => {
      const { createClient } = await import("@/lib/supabase/server");
      (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
        auth: {
          exchangeCodeForSession: vi.fn().mockResolvedValue({ error: null }),
        },
      });

      const request = new NextRequest(
        new URL("http://localhost:3000/auth/callback?code=valid123&next=//evil.com")
      );
      const response = await GET(request);

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("http://localhost:3000/app");
    });

    it("rejects encoded tab in next param", async () => {
      const { createClient } = await import("@/lib/supabase/server");
      (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
        auth: {
          exchangeCodeForSession: vi.fn().mockResolvedValue({ error: null }),
        },
      });

      const request = new NextRequest(
        new URL("http://localhost:3000/auth/callback?code=valid123&next=/%09/evil.com")
      );
      const response = await GET(request);

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("http://localhost:3000/app");
    });
  });

  describe("Location header origin validation (B1 attack vectors)", () => {
    const siteUrl = "http://localhost:3000";
    const siteOrigin = new URL(siteUrl).origin;

    beforeEach(async () => {
      const { createClient } = await import("@/lib/supabase/server");
      (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
        auth: {
          exchangeCodeForSession: vi.fn().mockResolvedValue({ error: null }),
        },
      });
    });

    const attackVectors = [
      "/x%3F/..//evil.com",
      "/x%3f/..//evil.com",
      "/x%23/..//evil.com",
      "/app%3F/../..//evil.com",
      "/a%3F/%2e%2e//evil.com",
      "%2Fx%3F/..//evil.com",
      "/..//..%3F/",
      "/.//evil.com",
      "/a/..//evil.com",
      "/%2e//evil.com",
      "/%2e%2e//evil.com",
      "/.%2F/evil.com",
      "/app/../..//evil.com",
      "/%2F%2Fevil.com",
      "//evil.com",
      "/%09/evil.com",
      "/%2509/evil.com",
    ];

    attackVectors.forEach((attack) => {
      it(`ensures Location header origin is same-origin for ${attack}`, async () => {
        const request = new NextRequest(
          new URL(`${siteUrl}/auth/callback?code=valid123&next=${encodeURIComponent(attack)}`)
        );
        const response = await GET(request);

        expect(response.status).toBe(307);
        const location = response.headers.get("location");
        expect(location).toBeTruthy();
        
        const locationUrl = new URL(location!);
        expect(locationUrl.origin).toBe(siteOrigin);
      });
    });
  });
});
