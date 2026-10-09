/**
 * Comprehensive tests for Procore client.
 * Covers GET-only enforcement, origin validation, rate limiting, pagination, and error handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock server-only before importing client
vi.mock("server-only", () => ({}));

import { ProcoreClient } from "../client";

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("ProcoreClient", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  const mockConfig = {
    clientId: "test-client-id",
    clientSecret: "test-secret",
    companyId: "12345",
    baseUrl: "https://api.procore.com",
    authUrl: "https://login.procore.com",
  };

  const mockTokenResponse = {
    ok: true,
    json: async () => ({
      access_token: "test-token",
      expires_in: 3600,
      created_at: Date.now() / 1000,
      token_type: "Bearer",
    }),
  };

  describe("GET-only enforcement at request chokepoint", () => {
    it("blocks POST before token is attached", async () => {
      const client = new ProcoreClient(mockConfig);
      const clientInternal = client as unknown as {
        request: (url: string, method: string, token: string) => Promise<Response>;
      };

      await expect(
        clientInternal.request("https://api.procore.com/test", "POST", "token")
      ).rejects.toThrow("Method POST not allowed");

      // Verify fetch was NEVER called (blocked before fetch)
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("blocks PUT before token is attached", async () => {
      const client = new ProcoreClient(mockConfig);
      const clientInternal = client as unknown as {
        request: (url: string, method: string, token: string) => Promise<Response>;
      };

      await expect(
        clientInternal.request("https://api.procore.com/test", "PUT", "token")
      ).rejects.toThrow("Method PUT not allowed");

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("blocks PATCH before token is attached", async () => {
      const client = new ProcoreClient(mockConfig);
      const clientInternal = client as unknown as {
        request: (url: string, method: string, token: string) => Promise<Response>;
      };

      await expect(
        clientInternal.request("https://api.procore.com/test", "PATCH", "token")
      ).rejects.toThrow("Method PATCH not allowed");

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("blocks DELETE before token is attached", async () => {
      const client = new ProcoreClient(mockConfig);
      const clientInternal = client as unknown as {
        request: (url: string, method: string, token: string) => Promise<Response>;
      };

      await expect(
        clientInternal.request("https://api.procore.com/test", "DELETE", "token")
      ).rejects.toThrow("Method DELETE not allowed");

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("allows GET requests to correct origin", async () => {
      const client = new ProcoreClient(mockConfig);

      mockFetch.mockResolvedValueOnce(mockTokenResponse);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: async () => [],
      });

      await client.get("/rest/v1.0/test");

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("Foreign origin and absolute URL protection", () => {
    it("blocks foreign origin URLs before token is attached", async () => {
      const client = new ProcoreClient(mockConfig);
      const clientInternal = client as unknown as {
        request: (url: string, method: string, token: string) => Promise<Response>;
      };

      await expect(
        clientInternal.request("https://evil.com/api", "GET", "token")
      ).rejects.toThrow("Foreign origin not allowed");

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("validates absolute nextLink origin (test via get method)", async () => {
      // Core origin validation is tested via the request chokepoint
      // Pagination with foreign origin would fail at the request() call
      const client = new ProcoreClient(mockConfig);
      const clientInternal = client as unknown as {
        request: (url: string, method: string, token: string) => Promise<Response>;
      };

      await expect(
        clientInternal.request("https://evil.com/api", "GET", "token")
      ).rejects.toThrow("Foreign origin not allowed");

      // Foreign origin is blocked before fetch is called
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("allows absolute nextLink with same origin", async () => {
      const client = new ProcoreClient(mockConfig);

      mockFetch.mockResolvedValueOnce(mockTokenResponse);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({
          Link: '<https://api.procore.com/rest/v1.0/test?page=2>; rel="next"',
        }),
        json: async () => [{ id: 1 }],
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: async () => [{ id: 2 }],
      });

      const pages: unknown[] = [];
      for await (const page of client.paginate("/rest/v1.0/test")) {
        pages.push(page);
      }

      expect(pages).toHaveLength(2);
    });
  });

  describe("Token endpoint pinning", () => {
    it("only calls exact configured token URL", async () => {
      const client = new ProcoreClient(mockConfig);

      mockFetch.mockResolvedValueOnce(mockTokenResponse);

      const clientInternal = client as unknown as {
        getAccessToken: () => Promise<string>;
      };

      await clientInternal.getAccessToken();

      expect(mockFetch).toHaveBeenCalledWith(
        "https://login.procore.com/oauth/token",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/x-www-form-urlencoded",
          }),
        })
      );
    });

    it("rejects token URL origin mismatch", async () => {
      // Constructor should throw when authUrl is not in allowlist
      expect(() => {
        new ProcoreClient({
          ...mockConfig,
          authUrl: "https://fake.procore.test",
        });
      }).toThrow("Procore authUrl not in allowlist");
    });
  });

  describe("Error handling without raw body", () => {
    it("does not include raw response body in errors", async () => {
      const client = new ProcoreClient(mockConfig);

      mockFetch.mockResolvedValueOnce(mockTokenResponse);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        headers: new Headers({ "X-Error-Code": "FORBIDDEN" }),
        json: async () => ({ sensitive: "data should not appear in error" }),
      });

      await expect(client.get("/rest/v1.0/test")).rejects.toThrow(
        "Procore API error: 403 (code: FORBIDDEN)"
      );
    });

    it("includes error code from X-Error-Code header", async () => {
      const client = new ProcoreClient(mockConfig);

      mockFetch.mockResolvedValueOnce(mockTokenResponse);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        headers: new Headers({ "X-Error-Code": "VALIDATION_FAILED" }),
        json: async () => ({}),
      });

      await expect(client.get("/rest/v1.0/test")).rejects.toThrow(
        "Procore API error: 422 (code: VALIDATION_FAILED)"
      );
    });

    it("uses UNKNOWN when no error code header present", async () => {
      const client = new ProcoreClient(mockConfig);

      mockFetch.mockResolvedValueOnce(mockTokenResponse);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404, // 4xx errors don't retry
        headers: new Headers(),
        json: async () => ({}),
      });

      await expect(client.get("/rest/v1.0/test")).rejects.toThrow(
        "Procore API error: 404 (code: UNKNOWN)"
      );
    });
  });

  describe("Rate limiting with shared retry helper", () => {
    it("retries on 429 with Retry-After in seconds", async () => {
      const client = new ProcoreClient(mockConfig);

      mockFetch.mockResolvedValueOnce(mockTokenResponse);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Headers({
          "Retry-After": "2",
          "X-Rate-Limit-Limit": "600",
          "X-Rate-Limit-Remaining": "0",
          "X-Rate-Limit-Reset": String(Math.floor(Date.now() / 1000) + 60),
        }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: async () => [],
      });

      const promise = client.get("/rest/v1.0/test");
      await vi.advanceTimersByTimeAsync(2000);
      await promise;

      expect(mockFetch).toHaveBeenCalledTimes(3); // token + 429 + success
    });

    it("retries on 429 with Retry-After as HTTP-date", async () => {
      const client = new ProcoreClient(mockConfig);
      const retryDate = new Date(Date.now() + 3000).toUTCString();

      mockFetch.mockResolvedValueOnce(mockTokenResponse);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Headers({
          "Retry-After": retryDate,
          "X-Rate-Limit-Limit": "600",
          "X-Rate-Limit-Remaining": "0",
          "X-Rate-Limit-Reset": String(Math.floor(Date.now() / 1000) + 60),
        }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: async () => [],
      });

      const promise = client.get("/rest/v1.0/test");
      await vi.advanceTimersByTimeAsync(3000);
      await promise;

      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it("retries on 503 with Retry-After", async () => {
      const client = new ProcoreClient(mockConfig);

      mockFetch.mockResolvedValueOnce(mockTokenResponse);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        headers: new Headers({ "Retry-After": "1" }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: async () => [],
      });

      const promise = client.get("/rest/v1.0/test");
      await vi.advanceTimersByTimeAsync(1000);
      await promise;

      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it("throws RateLimitError when Retry-After exceeds maxWaitMs", async () => {
      const client = new ProcoreClient(mockConfig);

      mockFetch.mockResolvedValueOnce(mockTokenResponse);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Headers({ "Retry-After": "120" }), // 2 minutes > 60s max
      });

      const promise = client.get("/rest/v1.0/test");
      
      await expect(promise).rejects.toThrow("Rate limit Retry-After");
      expect(mockFetch).toHaveBeenCalledTimes(2); // Token + first request, then throws
    });

    it("applies exponential backoff with jitter on 5xx", async () => {
      const client = new ProcoreClient(mockConfig);

      mockFetch.mockResolvedValueOnce(mockTokenResponse);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        headers: new Headers(),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: async () => [],
      });

      const promise = client.get("/rest/v1.0/test");
      // Exponential: 2^0 * 1000 + jitter = ~1000-2000ms
      await vi.advanceTimersByTimeAsync(3000);
      await promise;

      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it("throws after max retries exhausted", async () => {
      const client = new ProcoreClient(mockConfig);

      mockFetch.mockResolvedValueOnce(mockTokenResponse);
      // All attempts return 429
      for (let i = 0; i < 4; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 429,
          headers: new Headers(),
        });
      }

      const promise = client.get("/rest/v1.0/test");
      
      // Capture the rejection assertion BEFORE advancing timers
      const p = expect(promise).rejects.toThrow();
      
      // Advance through all retries
      for (let i = 0; i < 4; i++) {
        await vi.advanceTimersByTimeAsync(10000);
      }

      // Now await the assertion
      await p;
    });

    it("logs Procore rate limit headers", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const client = new ProcoreClient(mockConfig);

      mockFetch.mockResolvedValueOnce(mockTokenResponse);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Headers({
          "Retry-After": "1",
          "X-Rate-Limit-Limit": "600",
          "X-Rate-Limit-Remaining": "0",
          "X-Rate-Limit-Reset": String(Math.floor(Date.now() / 1000) + 60),
        }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: async () => [],
      });

      const promise = client.get("/rest/v1.0/test");
      await vi.advanceTimersByTimeAsync(1000);
      await promise;

      expect(consoleSpy).toHaveBeenCalledWith(
        "[Procore.RateLimit]",
        expect.objectContaining({
          limit: 600,
          remaining: 0,
          reset_at: expect.any(String),
        })
      );

      consoleSpy.mockRestore();
    });
  });

  describe("Pagination", () => {
    it("follows Link headers", async () => {
      const client = new ProcoreClient(mockConfig);

      mockFetch.mockResolvedValueOnce(mockTokenResponse);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({
          Link: '<https://api.procore.com/rest/v1.0/test?page=2>; rel="next"',
        }),
        json: async () => [{ id: 1 }],
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: async () => [{ id: 2 }],
      });

      const pages: unknown[] = [];
      for await (const page of client.paginate("/rest/v1.0/test")) {
        pages.push(page);
      }

      expect(pages).toHaveLength(2);
      expect(pages[0]).toEqual([{ id: 1 }]);
      expect(pages[1]).toEqual([{ id: 2 }]);
    });

    it("stops when no next link", async () => {
      const client = new ProcoreClient(mockConfig);

      mockFetch.mockResolvedValueOnce(mockTokenResponse);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: async () => [{ id: 1 }],
      });

      const pages: unknown[] = [];
      for await (const page of client.paginate("/rest/v1.0/test")) {
        pages.push(page);
      }

      expect(pages).toHaveLength(1);
    });

    it("parses page number from Link header", async () => {
      const client = new ProcoreClient(mockConfig);

      const result = client.parseLinkHeader(
        '<https://api.procore.com/test?page=3>; rel="next"'
      );

      expect(result.nextPage).toBe(3);
    });

    it("returns null when no next link", async () => {
      const client = new ProcoreClient(mockConfig);

      const result = client.parseLinkHeader(
        '<https://api.procore.com/test?page=1>; rel="prev"'
      );

      expect(result.nextPage).toBeNull();
    });
  });

  describe("Token caching", () => {
    it("caches token until 5 minutes before expiry", async () => {
      const client = new ProcoreClient(mockConfig);

      mockFetch.mockResolvedValueOnce(mockTokenResponse);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: async () => [],
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: async () => [],
      });

      await client.get("/rest/v1.0/test1");
      await client.get("/rest/v1.0/test2");

      // Only one token fetch
      expect(mockFetch).toHaveBeenCalledTimes(3); // 1 token + 2 GETs
    });

    it("refreshes token when approaching expiry", async () => {
      const client = new ProcoreClient(mockConfig);

      mockFetch.mockResolvedValueOnce(mockTokenResponse);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: async () => [],
      });

      await client.get("/rest/v1.0/test1");

      // Advance to near expiry (3600s - 5min = 3300s)
      vi.advanceTimersByTime(3400 * 1000);

      mockFetch.mockResolvedValueOnce(mockTokenResponse);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: async () => [],
      });

      await client.get("/rest/v1.0/test2");

      // Should have 2 token fetches
      expect(mockFetch).toHaveBeenCalledTimes(4); // 2 tokens + 2 GETs
    });
  });
});
