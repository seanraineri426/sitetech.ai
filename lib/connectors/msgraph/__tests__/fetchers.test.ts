/**
 * Tests for Microsoft Graph fetchers with real client and mocked fetch.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock server-only
vi.mock("server-only", () => ({}));

import {
  fetchMailFolderDelta,
  fetchDriveDelta,
  fetchMailFolders,
} from "../fetchers";
import { GraphClient } from "../client";
import type { GraphMessage, GraphDriveItem, GraphMailFolder } from "../types";

describe("Microsoft Graph fetchers", () => {
  let mockFetch: ReturnType<typeof vi.fn>;
  let client: GraphClient;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch;

    client = new GraphClient({
      tenantId: "tenant-123",
      clientId: "client-123",
      clientSecret: "secret-123",
      mailbox: "user@example.com",
      siteId: "site-123",
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockTokenResponse = {
    ok: true,
    json: async () => ({
      access_token: "token-123",
      token_type: "Bearer",
      expires_in: 3600,
    }),
  };

  describe("fetchMailFolders", () => {
    it("fetches all mail folders", async () => {
      const mockFolders: GraphMailFolder[] = [
        {
          id: "inbox",
          displayName: "Inbox",
          parentFolderId: null,
          childFolderCount: 0,
          unreadItemCount: 5,
          totalItemCount: 100,
        },
        {
          id: "sent",
          displayName: "Sent Items",
          parentFolderId: null,
          childFolderCount: 0,
          unreadItemCount: 0,
          totalItemCount: 50,
        },
      ];

      mockFetch.mockResolvedValueOnce(mockTokenResponse);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          value: mockFolders,
        }),
      });

      const folders = await fetchMailFolders(client, "user@example.com");

      expect(folders).toEqual(mockFolders);
    });
  });

  describe("fetchMailFolderDelta - page-by-page with real client", () => {
    it("returns ONE page with nextLink checkpoint", async () => {
      const mockMessages: GraphMessage[] = [
        {
          id: "msg1",
          conversationId: "conv1",
          subject: "Test",
          bodyPreview: "Preview",
          from: { emailAddress: { name: "Sender", address: "sender@example.com" } },
          toRecipients: [],
          ccRecipients: [],
          receivedDateTime: "2026-10-01T10:00:00Z",
          sentDateTime: "2026-10-01T09:59:00Z",
          hasAttachments: false,
          importance: "normal",
          isRead: false,
          categories: [],
        },
      ];

      mockFetch.mockResolvedValueOnce(mockTokenResponse);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          value: mockMessages,
          "@odata.nextLink": "https://graph.microsoft.com/v1.0/users/user%40example.com/mailFolders/inbox/messages/delta?$skiptoken=abc",
        }),
      });

      const result = await fetchMailFolderDelta(client, "user@example.com", "inbox");

      expect(result.messages).toEqual(mockMessages);
      expect(result.removed).toEqual([]);
      expect(result.checkpoint).toBe("https://graph.microsoft.com/v1.0/users/user%40example.com/mailFolders/inbox/messages/delta?$skiptoken=abc");
    });

    it("returns ONE page with deltaLink at the end", async () => {
      mockFetch.mockResolvedValueOnce(mockTokenResponse);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          value: [],
          "@odata.deltaLink": "https://graph.microsoft.com/v1.0/users/user%40example.com/mailFolders/inbox/messages/delta?$deltatoken=xyz",
        }),
      });

      const result = await fetchMailFolderDelta(client, "user@example.com", "inbox");

      expect(result.messages).toEqual([]);
      expect(result.checkpoint).toBe("https://graph.microsoft.com/v1.0/users/user%40example.com/mailFolders/inbox/messages/delta?$deltatoken=xyz");
    });

    it("resumes from checkpoint (nextLink)", async () => {
      const checkpoint = "https://graph.microsoft.com/v1.0/users/user%40example.com/mailFolders/inbox/messages/delta?$skiptoken=abc";

      mockFetch.mockResolvedValueOnce(mockTokenResponse);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          value: [],
          "@odata.deltaLink": "https://graph.microsoft.com/v1.0/users/user%40example.com/mailFolders/inbox/messages/delta?$deltatoken=xyz",
        }),
      });

      const result = await fetchMailFolderDelta(client, "user@example.com", "inbox", checkpoint);

      expect(result.checkpoint).toBe("https://graph.microsoft.com/v1.0/users/user%40example.com/mailFolders/inbox/messages/delta?$deltatoken=xyz");
    });

    it("includes removed items with @removed", async () => {
      mockFetch.mockResolvedValueOnce(mockTokenResponse);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          value: [
            { id: "msg1", "@removed": { reason: "deleted" } },
            { id: "msg2", "@removed": { reason: "deleted" } },
          ],
          "@odata.deltaLink": "https://graph.microsoft.com/v1.0/delta-link",
        }),
      });

      const result = await fetchMailFolderDelta(client, "user@example.com", "inbox");

      expect(result.removed).toEqual(["msg1", "msg2"]);
    });

    it("page-by-page: fetcher drives the loop, not the client", async () => {
      // First page
      mockFetch.mockResolvedValueOnce(mockTokenResponse);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          value: [{ id: "msg1", subject: "Page 1", conversationId: "", bodyPreview: "", from: { emailAddress: { name: "", address: "" } }, toRecipients: [], ccRecipients: [], receivedDateTime: "", sentDateTime: "", hasAttachments: false, importance: "normal", isRead: false, categories: [] }],
          "@odata.nextLink": "https://graph.microsoft.com/v1.0/next-page",
        }),
      });

      const page1 = await fetchMailFolderDelta(client, "user@example.com", "inbox");
      expect(page1.messages).toHaveLength(1);
      expect(page1.checkpoint).toBeTruthy();

      // Second page - fetcher drives with checkpoint
      mockFetch.mockResolvedValueOnce(mockTokenResponse);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          value: [{ id: "msg2", subject: "Page 2", conversationId: "", bodyPreview: "", from: { emailAddress: { name: "", address: "" } }, toRecipients: [], ccRecipients: [], receivedDateTime: "", sentDateTime: "", hasAttachments: false, importance: "normal", isRead: false, categories: [] }],
          "@odata.deltaLink": "https://graph.microsoft.com/v1.0/delta-final",
        }),
      });

      const page2 = await fetchMailFolderDelta(client, "user@example.com", "inbox", page1.checkpoint);
      expect(page2.messages).toHaveLength(1);
      expect(page2.checkpoint).toContain("delta-final");
    });
  });

  describe("fetchDriveDelta - page-by-page with real client", () => {
    it("returns ONE page with nextLink checkpoint", async () => {
      const mockItems: GraphDriveItem[] = [
        {
          id: "item1",
          name: "file.txt",
          webUrl: "https://example.com/file.txt",
          size: 1024,
          createdDateTime: "2026-10-01",
          lastModifiedDateTime: "2026-10-01",
          createdBy: { user: { displayName: "User", email: "user@example.com" } },
          lastModifiedBy: { user: { displayName: "User", email: "user@example.com" } },
          parentReference: { driveId: "drive1", id: "parent1", path: "/path" },
        },
      ];

      mockFetch.mockResolvedValueOnce(mockTokenResponse);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          value: mockItems,
          "@odata.nextLink": "https://graph.microsoft.com/v1.0/sites/site-123/drive/root/delta?$skiptoken=abc",
        }),
      });

      const result = await fetchDriveDelta(client, "site-123");

      expect(result.items).toEqual(mockItems);
      expect(result.removed).toEqual([]);
      expect(result.checkpoint).toContain("skiptoken");
    });

    it("returns ONE page with deltaLink at the end", async () => {
      mockFetch.mockResolvedValueOnce(mockTokenResponse);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          value: [],
          "@odata.deltaLink": "https://graph.microsoft.com/v1.0/sites/site-123/drive/root/delta?$deltatoken=xyz",
        }),
      });

      const result = await fetchDriveDelta(client, "site-123");

      expect(result.items).toEqual([]);
      expect(result.checkpoint).toContain("deltatoken");
    });

    it("includes removed items with deleted facet", async () => {
      mockFetch.mockResolvedValueOnce(mockTokenResponse);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          value: [
            { id: "item1", deleted: { state: "deleted" } },
            { id: "item2", deleted: { state: "deleted" } },
          ],
          "@odata.deltaLink": "https://graph.microsoft.com/v1.0/delta-link",
        }),
      });

      const result = await fetchDriveDelta(client, "site-123");

      expect(result.removed).toEqual(["item1", "item2"]);
    });

    it("page-by-page: fetcher drives the loop", async () => {
      // First page
      mockFetch.mockResolvedValueOnce(mockTokenResponse);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          value: [{ id: "item1", name: "Page 1", webUrl: "", size: 0, createdDateTime: "", lastModifiedDateTime: "", createdBy: { user: { displayName: "" } }, lastModifiedBy: { user: { displayName: "" } }, parentReference: { driveId: "", id: "", path: "" } }],
          "@odata.nextLink": "https://graph.microsoft.com/v1.0/next",
        }),
      });

      const page1 = await fetchDriveDelta(client, "site-123");
      expect(page1.items).toHaveLength(1);

      // Second page
      mockFetch.mockResolvedValueOnce(mockTokenResponse);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          value: [{ id: "item2", name: "Page 2", webUrl: "", size: 0, createdDateTime: "", lastModifiedDateTime: "", createdBy: { user: { displayName: "" } }, lastModifiedBy: { user: { displayName: "" } }, parentReference: { driveId: "", id: "", path: "" } }],
          "@odata.deltaLink": "https://graph.microsoft.com/v1.0/delta-final",
        }),
      });

      const page2 = await fetchDriveDelta(client, "site-123", page1.checkpoint);
      expect(page2.items).toHaveLength(1);
      expect(page2.checkpoint).toContain("delta-final");
    });
  });
});
