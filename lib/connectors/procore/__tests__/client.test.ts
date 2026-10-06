/**
 * Tests for Procore client GET-only enforcement, pagination, and rate limiting.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProcoreClient } from "../client";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("ProcoreClient", () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  const mockConfig = {
    clientId: "test-client-id",
    clientSecret: "test-secret",
    companyId: "12345",
    baseUrl: "https://api.procore.test",
    authUrl: "https://login.procore.test",
  };

  describe("GET-only enforcement", () => {
    it("throws on POST", async () => {
      const client = new ProcoreClient(mockConfig);
      await expect(client.post()).rejects.toThrow("POST not allowed");
    });

    it("throws on PUT", async () => {
      const client = new ProcoreClient(mockConfig);
      await expect(client.put()).rejects.toThrow("PUT not allowed");
    });

    it("throws on PATCH", async () => {
      const client = new ProcoreClient(mockConfig);
      await expect(client.patch()).rejects.toThrow("PATCH not allowed");
    });

    it("throws on DELETE", async () => {
      const client = new ProcoreClient(mockConfig);
      await expect(client.delete()).rejects.toThrow("DELETE not allowed");
    });

    it("allows GET requests", async () => {
      const client = new ProcoreClient(mockConfig);

      // Mock token fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "test-token",
          expires_in: 3600,
          created_at: Date.now() / 1000,
        }),
      });

      // Mock GET request
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({
          "X-Rate-Limit-Limit": "600",
          "X-Rate-Limit-Remaining": "599",
          "X-Rate-Limit-Reset": String(Date.now() / 1000 + 3600),
        }),
        json: async () => ({ data: "test" }),
      });

      const response = await client.get("/rest/v1.0/test");
      expect(response.data).toEqual({ data: "test" });
    });
  });

  describe("OAuth client credentials", () => {
    it("fetches access token on first request", async () => {
      const client = new ProcoreClient(mockConfig);

      // Mock token fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "test-token-123",
          expires_in: 5400,
          created_at: Date.now() / 1000,
        }),
      });

      // Mock GET request
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: async () => ({}),
      });

      await client.get("/rest/v1.0/test");

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockConfig.authUrl}/oauth/token`,
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        })
      );
    });

    it("caches token until near expiry", async () => {
      const client = new ProcoreClient(mockConfig);

      // Mock token fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "cached-token",
          expires_in: 5400,
          created_at: Date.now() / 1000,
        }),
      });

      // Mock two GET requests
      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Headers(),
        json: async () => ({}),
      });

      await client.get("/rest/v1.0/test1");
      await client.get("/rest/v1.0/test2");

      // Token fetch should only happen once (first call)
      const tokenCalls = mockFetch.mock.calls.filter((call) =>
        call[0].includes("/oauth/token")
      );
      expect(tokenCalls).toHaveLength(1);
    });
  });

  describe("Pagination", () => {
    it("follows Link header for pagination", async () => {
      const client = new ProcoreClient(mockConfig);

      // Mock token
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "test-token",
          expires_in: 3600,
          created_at: Date.now() / 1000,
        }),
      });

      // Mock page 1
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({
          Link: '<https://api.procore.test/rest/v1.0/test?page=2>; rel="next"',
        }),
        json: async () => [{ id: 1 }],
      });

      // Mock page 2
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

    it("parses Link header correctly", () => {
      const client = new ProcoreClient(mockConfig);

      const link =
        '<https://api.procore.test/rest/v1.0/rfis?page=3&per_page=100>; rel="next"';
      const { nextPage } = client.parseLinkHeader(link);

      expect(nextPage).toBe(3);
    });

    it("returns null when no next page", () => {
      const client = new ProcoreClient(mockConfig);

      const { nextPage } = client.parseLinkHeader(null);
      expect(nextPage).toBeNull();
    });
  });

  describe("Rate limiting", () => {
    it("retries on 429 with exponential backoff", async () => {
      const client = new ProcoreClient(mockConfig);

      // Mock token
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "test-token",
          expires_in: 3600,
          created_at: Date.now() / 1000,
        }),
      });

      // Mock 429 response
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Headers({
          "X-Rate-Limit-Reset": String(Date.now() / 1000 + 1),
        }),
      });

      // Mock successful retry
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: async () => ({ success: true }),
      });

      const response = await client.get("/rest/v1.0/test");
      expect(response.data).toEqual({ success: true });
      expect(mockFetch).toHaveBeenCalledTimes(3); // token + 429 + success
    });

    it("throws after max retries", async () => {
      const client = new ProcoreClient(mockConfig);

      // Mock token
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "test-token",
          expires_in: 3600,
          created_at: Date.now() / 1000,
        }),
      });

      // Mock 429 responses
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        headers: new Headers(),
      });

      await expect(client.get("/rest/v1.0/test")).rejects.toThrow(
        "Rate limit exceeded"
      );
    }, 10000); // 10 second timeout for retry test

    it("honors Retry-After on 503", async () => {
      const client = new ProcoreClient(mockConfig);

      // Mock token
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "test-token",
          expires_in: 3600,
          created_at: Date.now() / 1000,
        }),
      });

      // Mock 503 with Retry-After
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        headers: new Headers({
          "Retry-After": "1",
        }),
      });

      // Mock success after retry
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: async () => ({ recovered: true }),
      });

      const response = await client.get("/rest/v1.0/test");
      expect(response.data).toEqual({ recovered: true });
    });
  });

  describe("Procore-Company-Id header", () => {
    it("includes Procore-Company-Id header in all requests", async () => {
      const client = new ProcoreClient(mockConfig);

      // Mock token
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "test-token",
          expires_in: 3600,
          created_at: Date.now() / 1000,
        }),
      });

      // Mock GET request
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: async () => ({}),
      });

      await client.get("/rest/v1.0/test");

      const getCall = mockFetch.mock.calls[1]; // Second call is the GET request
      expect(getCall[1].headers["Procore-Company-Id"]).toBe(mockConfig.companyId);
    });
  });
});
