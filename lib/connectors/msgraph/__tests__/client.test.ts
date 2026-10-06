/**
 * Tests for Microsoft Graph client GET-only enforcement and delta sync.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { GraphClient } from "../client";

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("GraphClient", () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  const mockConfig = {
    tenantId: "test-tenant-id",
    clientId: "test-client-id",
    clientSecret: "test-secret",
  };

  describe("GET-only enforcement", () => {
    it("throws on POST", async () => {
      const client = new GraphClient(mockConfig);
      await expect(client.post()).rejects.toThrow("POST not allowed");
    });

    it("throws on PUT", async () => {
      const client = new GraphClient(mockConfig);
      await expect(client.put()).rejects.toThrow("PUT not allowed");
    });

    it("throws on PATCH", async () => {
      const client = new GraphClient(mockConfig);
      await expect(client.patch()).rejects.toThrow("PATCH not allowed");
    });

    it("throws on DELETE", async () => {
      const client = new GraphClient(mockConfig);
      await expect(client.delete()).rejects.toThrow("DELETE not allowed");
    });
  });

  describe("OAuth client credentials", () => {
    it("fetches access token on first request", async () => {
      const client = new GraphClient(mockConfig);

      // Mock token fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "graph-token-123",
          expires_in: 3600,
        }),
      });

      // Mock GET request
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ value: [] }),
      });

      await client.get("/me");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(
          `https://login.microsoftonline.com/${mockConfig.tenantId}/oauth2/v2.0/token`
        ),
        expect.objectContaining({
          method: "POST",
        })
      );
    });
  });

  describe("Throttling handling", () => {
    it("retries on 429 with Retry-After", async () => {
      const client = new GraphClient(mockConfig);

      // Mock token
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "test-token",
          expires_in: 3600,
        }),
      });

      // Mock 429 response
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Headers({
          "Retry-After": "1",
        }),
      });

      // Mock successful retry
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ value: ["success"] }),
      });

      const response = await client.get("/users");
      expect(response.value).toEqual(["success"]);
    });

    it("retries on 503 with Retry-After", async () => {
      const client = new GraphClient(mockConfig);

      // Mock token
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "test-token",
          expires_in: 3600,
        }),
      });

      // Mock 503 response
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        headers: new Headers({
          "Retry-After": "1",
        }),
      });

      // Mock successful retry
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ value: ["recovered"] }),
      });

      const response = await client.get("/users");
      expect(response.value).toEqual(["recovered"]);
    });
  });

  describe("Pagination", () => {
    it("follows @odata.nextLink", async () => {
      const client = new GraphClient(mockConfig);

      // Mock token
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "test-token",
          expires_in: 3600,
        }),
      });

      // Mock page 1
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          value: [{ id: 1 }],
          "@odata.nextLink": "https://graph.microsoft.com/v1.0/users?$skip=1",
        }),
      });

      // Mock page 2
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          value: [{ id: 2 }],
        }),
      });

      const pages: unknown[] = [];
      for await (const page of client.paginate("/users")) {
        pages.push(page);
      }

      expect(pages).toHaveLength(2);
      expect(pages[0]).toEqual([{ id: 1 }]);
      expect(pages[1]).toEqual([{ id: 2 }]);
    });
  });

  describe("Delta sync", () => {
    it("returns items and deltaLink", async () => {
      const client = new GraphClient(mockConfig);

      // Mock token
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "test-token",
          expires_in: 3600,
        }),
      });

      // Mock delta response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          value: [{ id: "msg1" }, { id: "msg2" }],
          "@odata.deltaLink": "https://graph.microsoft.com/v1.0/users/me/messages/delta?$deltaToken=abc123",
        }),
      });

      const result = await client.delta("/users/me/messages");

      expect(result.items).toHaveLength(2);
      expect(result.deltaLink).toContain("$deltaToken=abc123");
      expect(result.removed).toEqual([]);
    });

    it("tracks removed items", async () => {
      const client = new GraphClient(mockConfig);

      // Mock token
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "test-token",
          expires_in: 3600,
        }),
      });

      // Mock delta response with removed items
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          value: [{ id: "msg1" }],
          "@removed": [{ id: "msg2", reason: "deleted" }],
          "@odata.deltaLink": "https://graph.microsoft.com/v1.0/delta?$deltaToken=xyz",
        }),
      });

      const result = await client.delta("/users/me/messages");

      expect(result.items).toHaveLength(1);
      expect(result.removed).toEqual(["msg2"]);
    });

    it("continues from previous deltaLink", async () => {
      const client = new GraphClient(mockConfig);

      // Mock token
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "test-token",
          expires_in: 3600,
        }),
      });

      const previousDeltaLink = "https://graph.microsoft.com/v1.0/delta?$deltaToken=previous";

      // Mock delta response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          value: [{ id: "new-msg" }],
          "@odata.deltaLink": "https://graph.microsoft.com/v1.0/delta?$deltaToken=new",
        }),
      });

      const result = await client.delta("/users/me/messages", previousDeltaLink);

      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toEqual({ id: "new-msg" });
      expect(result.deltaLink).toContain("$deltaToken=new");
    });
  });

  describe("User-Agent header", () => {
    it("includes ISV User-Agent for SharePoint throttling", async () => {
      const client = new GraphClient(mockConfig);

      // Mock token
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "test-token",
          expires_in: 3600,
        }),
      });

      // Mock GET request
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ value: [] }),
      });

      await client.get("/sites/root");

      const getCall = mockFetch.mock.calls[1];
      expect(getCall[1].headers["User-Agent"]).toBe("ISV|SiteTech|1.0");
    });
  });
});
