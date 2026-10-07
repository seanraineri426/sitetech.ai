/**
 * Comprehensive tests for Microsoft Graph client.
 * Covers scoping, delta sync, removals handling, and error handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock server-only
vi.mock("server-only", () => ({}));

import { GraphClient } from "../client";

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("GraphClient", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  const mockConfig = {
    tenantId: "tenant-123",
    clientId: "client-456",
    clientSecret: "secret-789",
    mailbox: "user@example.com",
    siteId: "site-abc",
    baseUrl: "https://graph.microsoft.com/v1.0",
  };

  const mockTokenResponse = {
    ok: true,
    json: async () => ({
      access_token: "test-token",
      token_type: "Bearer",
      expires_in: 3600,
    }),
  };

  describe("Mailbox and site scoping", () => {
    it("allows paths under /users/{mailbox}/", async () => {
      const client = new GraphClient(mockConfig);

      mockFetch.mockResolvedValueOnce(mockTokenResponse);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ value: [] }),
      });

      await client.get("/users/user%40example.com/messages");

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("allows paths under /sites/{siteId}/", async () => {
      const client = new GraphClient(mockConfig);

      mockFetch.mockResolvedValueOnce(mockTokenResponse);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ value: [] }),
      });

      await client.get("/sites/site-abc/drive/root");

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("refuses paths outside mailbox scope", async () => {
      const client = new GraphClient(mockConfig);

      mockFetch.mockResolvedValueOnce(mockTokenResponse);

      await expect(
        client.get("/users/other@example.com/messages")
      ).rejects.toThrow("Path outside allowed scope");
    });

    it("refuses paths outside site scope", async () => {
      const client = new GraphClient(mockConfig);

      mockFetch.mockResolvedValueOnce(mockTokenResponse);

      await expect(
        client.get("/sites/other-site/drive")
      ).rejects.toThrow("Path outside allowed scope");
    });

    it("URL-encodes mailbox in path validation", async () => {
      const client = new GraphClient({
        ...mockConfig,
        mailbox: "user+tag@example.com",
      });

      mockFetch.mockResolvedValueOnce(mockTokenResponse);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ value: [] }),
      });

      await client.get("/users/user%2Btag%40example.com/messages");

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("URL-encodes siteId in path validation", async () => {
      const client = new GraphClient({
        ...mockConfig,
        siteId: "site/with/slashes",
      });

      mockFetch.mockResolvedValueOnce(mockTokenResponse);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ value: [] }),
      });

      await client.get("/sites/site%2Fwith%2Fslashes/drive");

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("Delta sync URL construction", () => {
    it("builds URL with /delta before query string", async () => {
      const client = new GraphClient(mockConfig);

      mockFetch.mockResolvedValueOnce(mockTokenResponse);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          value: [],
          "@odata.deltaLink": "https://graph.microsoft.com/v1.0/users/user%40example.com/messages/delta?$deltatoken=abc",
        }),
      });

      const result = await client.delta(
        "/users/user%40example.com/messages",
        undefined,
        "id,subject"
      );

      expect(result.deltaLink).toBeDefined();
      
      // Verify the fetch was called with /delta path
      const fetchCalls = mockFetch.mock.calls;
      const deltaCall = fetchCalls[1];
      const url = deltaCall[0] as string;
      expect(url).toContain("/messages/delta");
      expect(url).toContain("select="); // URL-encoded or not, should have select param
    });

    it("resumes from deltaLink", async () => {
      const client = new GraphClient(mockConfig);
      const deltaLink = "https://graph.microsoft.com/v1.0/users/user%40example.com/messages/delta?$deltatoken=xyz";

      mockFetch.mockResolvedValueOnce(mockTokenResponse);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          value: [],
          "@odata.deltaLink": deltaLink,
        }),
      });

      const result = await client.delta(
        "/users/user%40example.com/messages",
        deltaLink
      );

      expect(result.deltaLink).toBe(deltaLink);
      
      const fetchCalls = mockFetch.mock.calls;
      expect(fetchCalls[1][0]).toBe(deltaLink);
    });

    it("saves nextLink for pagination", async () => {
      const client = new GraphClient(mockConfig);
      const nextLink = "https://graph.microsoft.com/v1.0/users/user%40example.com/messages/delta?$skiptoken=abc";

      mockFetch.mockResolvedValueOnce(mockTokenResponse);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          value: [{ id: "msg1", subject: "Test" }],
          "@odata.nextLink": nextLink,
        }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          value: [{ id: "msg2", subject: "Test 2" }],
          "@odata.deltaLink": "final-delta",
        }),
      });

      const result = await client.delta<{ id: string; subject: string }>(
        "/users/user%40example.com/messages",
        undefined,
        "id,subject"
      );

      expect(result.items).toHaveLength(2);
      expect(result.deltaLink).toBe("final-delta");
    });
  });

  describe("Removals handling", () => {
    it("handles @removed items in value array", async () => {
      const client = new GraphClient(mockConfig);

      mockFetch.mockResolvedValueOnce(mockTokenResponse);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          value: [
            { id: "msg1", subject: "Active" },
            { id: "msg2", "@removed": { reason: "deleted" } },
            { id: "msg3", subject: "Also active" },
          ],
          "@odata.deltaLink": "delta-link",
        }),
      });

      const result = await client.delta<{ id: string; subject?: string }>(
        "/users/user%40example.com/messages"
      );

      expect(result.items).toHaveLength(2);
      expect(result.removed).toEqual(["msg2"]);
    });

    it("handles deleted facet on drive items", async () => {
      const client = new GraphClient(mockConfig);

      mockFetch.mockResolvedValueOnce(mockTokenResponse);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          value: [
            { id: "item1", name: "file1.txt" },
            { id: "item2", name: "file2.txt", deleted: { state: "deleted" } },
          ],
          "@odata.deltaLink": "delta-link",
        }),
      });

      const result = await client.delta<{ id: string; name: string; deleted?: { state: string } }>(
        "/sites/site-abc/drive/root"
      );

      expect(result.items).toHaveLength(1);
      expect(result.removed).toEqual(["item2"]);
    });

    it("handles both @removed and deleted in same response", async () => {
      const client = new GraphClient(mockConfig);

      mockFetch.mockResolvedValueOnce(mockTokenResponse);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          value: [
            { id: "1", name: "active" },
            { id: "2", "@removed": { reason: "deleted" } },
            { id: "3", name: "also-deleted", deleted: { state: "deleted" } },
          ],
          "@odata.deltaLink": "delta-link",
        }),
      });

      const result = await client.delta<{ id: string; name?: string }>(
        "/sites/site-abc/drive/root"
      );

      expect(result.items).toHaveLength(1);
      expect(result.removed).toEqual(["2", "3"]);
    });
  });

  describe("Error handling", () => {
    it("does not include raw response body in errors", async () => {
      const client = new GraphClient(mockConfig);

      mockFetch.mockResolvedValueOnce(mockTokenResponse);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        headers: new Headers({ "X-Error-Code": "INSUFFICIENT_PERMISSIONS" }),
        json: async () => ({ error: { message: "sensitive data" } }),
      });

      await expect(
        client.get("/users/user%40example.com/messages")
      ).rejects.toThrow("Graph API error: 403 (code: INSUFFICIENT_PERMISSIONS)");
    });

    it("uses UNKNOWN when no error code", async () => {
      const client = new GraphClient(mockConfig);

      mockFetch.mockResolvedValueOnce(mockTokenResponse);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404, // 4xx errors don't retry
        headers: new Headers(),
      });

      await expect(
        client.get("/users/user%40example.com/messages")
      ).rejects.toThrow("Graph API error: 404 (code: UNKNOWN)");
    });
  });

  describe("GET-only enforcement", () => {
    it("only allows GET method", async () => {
      const client = new GraphClient(mockConfig);
      const clientInternal = client as unknown as {
        request: (url: string, method: string, token: string) => Promise<Response>;
      };

      await expect(
        clientInternal.request(
          "https://graph.microsoft.com/v1.0/users/user%40example.com/messages",
          "POST",
          "token"
        )
      ).rejects.toThrow("Method POST not allowed");

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("Rate limiting", () => {
    it("retries on 429 without Retry-After using backoff", async () => {
      const client = new GraphClient(mockConfig);

      mockFetch.mockResolvedValueOnce(mockTokenResponse);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Headers(),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ value: [] }),
      });

      const promise = client.get("/users/user%40example.com/messages");
      await vi.advanceTimersByTimeAsync(3000);
      await promise;

      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it("retries on 429 with Retry-After", async () => {
      const client = new GraphClient(mockConfig);

      mockFetch.mockResolvedValueOnce(mockTokenResponse);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Headers({ "Retry-After": "2" }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ value: [] }),
      });

      const promise = client.get("/users/user%40example.com/messages");
      await vi.advanceTimersByTimeAsync(2000);
      await promise;

      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });
});
