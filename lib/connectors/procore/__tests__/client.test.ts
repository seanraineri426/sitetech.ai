/**
 * Tests for Procore client: GET-only enforcement, origin validation,
 * request chokepoint, rate limiting, and pagination.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock server-only before importing client
vi.mock("server-only", () => ({}));

import { ProcoreClient } from "../client";
import * as retry from "../../shared/retry";

const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock sleep to avoid actual delays in tests
vi.mock("../../shared/retry", async () => {
  const actual = await vi.importActual("../../shared/retry");
  return {
    ...actual,
    sleep: vi.fn().mockResolvedValue(undefined),
  };
});

describe("ProcoreClient", () => {
  beforeEach(() => {
    mockFetch.mockClear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockConfig = {
    clientId: "test-client-id",
    clientSecret: "test-secret",
    companyId: "12345",
    baseUrl: "https://api.procore.test",
    authUrl: "https://login.procore.test",
  };

  describe("GET-only enforcement at request chokepoint", () => {
    it("blocks POST before token is attached", async () => {
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

      // Try to make a POST request by accessing the internal method
      const clientInternal = client as unknown as {
        request: (url: string, method: string, token: string) => Promise<Response>;
      };
      
      await expect(
        clientInternal.request("https://api.procore.test/test", "POST", "token")
      ).rejects.toThrow("Method POST not allowed");

      // Verify fetch was NEVER called (blocked before fetch)
      expect(mockFetch).toHaveBeenCalledTimes(1); // Only token fetch
    });

    it("blocks foreign origin before token is attached", async () => {
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

      // Try to make a request to foreign origin
      const clientInternal = client as unknown as {
        request: (url: string, method: string, token: string) => Promise<Response>;
      };
      
      await expect(
        clientInternal.request("https://evil.com/api", "GET", "token")
      ).rejects.toThrow("Foreign origin not allowed");

      // Verify fetch was NEVER called with Bearer token
      expect(mockFetch).toHaveBeenCalledTimes(1); // Only token fetch
    });

    it("allows GET requests to correct origin", async () => {
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

      // Mock successful GET
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: async () => ({ data: "test" }),
      });

      await client.get("/rest/v1.0/test");

      // Verify GET request was made
      expect(mockFetch).toHaveBeenCalledTimes(2); // Token + GET
    });
  });

  describe("Token endpoint pinning", () => {
    it("only calls exact configured token URL", async () => {
      const client = new ProcoreClient(mockConfig);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "token",
          expires_in: 3600,
          created_at: Date.now() / 1000,
        }),
      });

      const clientInternal = client as unknown as {
        getAccessToken: () => Promise<string>;
      };
      
      await clientInternal.getAccessToken();

      expect(mockFetch).toHaveBeenCalledWith(
        "https://login.procore.test/oauth/token",
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  describe("Error handling without raw body", () => {
    it("does not include raw response body in errors", async () => {
      const client = new ProcoreClient(mockConfig);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "token",
          expires_in: 3600,
          created_at: Date.now() / 1000,
        }),
      });

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
  });

  describe("Rate limiting with shared retry helper", () => {
    it("retries on 429 with Retry-After", async () => {
      const client = new ProcoreClient(mockConfig);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "token",
          expires_in: 3600,
          created_at: Date.now() / 1000,
        }),
      });

      // First attempt: 429
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Headers({
          "Retry-After": "1",
          "X-Rate-Limit-Limit": "600",
          "X-Rate-Limit-Remaining": "0",
          "X-Rate-Limit-Reset": String(Date.now() / 1000 + 60),
        }),
      });

      // Second attempt: success
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: async () => ({}),
      });

      await client.get("/rest/v1.0/test");

      // Verify sleep was called
      expect(retry.sleep).toHaveBeenCalledWith(expect.any(Number));
    });

    it("throws after max retries", async () => {
      const client = new ProcoreClient(mockConfig);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "token",
          expires_in: 3600,
          created_at: Date.now() / 1000,
        }),
      });

      // All attempts fail with 429
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        headers: new Headers(),
      });

      await expect(client.get("/rest/v1.0/test")).rejects.toThrow();
    });
  });

  describe("Pagination", () => {
    it("follows Link headers", async () => {
      const client = new ProcoreClient(mockConfig);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "token",
          expires_in: 3600,
          created_at: Date.now() / 1000,
        }),
      });

      // Page 1
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({
          Link: '<https://api.procore.test/rest/v1.0/test?page=2>; rel="next"',
        }),
        json: async () => [{ id: 1 }],
      });

      // Page 2
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
});
