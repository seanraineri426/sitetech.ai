/**
 * Tests for Microsoft Graph fetchers.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

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
  let mockClient: GraphClient;

  beforeEach(() => {
    mockClient = {
      delta: vi.fn(),
      paginate: vi.fn(),
    } as unknown as GraphClient;
  });

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

      (mockClient.paginate as ReturnType<typeof vi.fn>).mockReturnValue(
        (async function* () {
          yield mockFolders;
        })()
      );

      const folders = await fetchMailFolders(mockClient, "user@example.com");

      expect(folders).toEqual(mockFolders);
      expect(mockClient.paginate).toHaveBeenCalledWith(
        "/users/user%40example.com/mailFolders"
      );
    });
  });

  describe("fetchMailFolderDelta", () => {
    it("yields page with checkpoint", async () => {
      const mockMessages: GraphMessage[] = [
        {
          id: "msg1",
          conversationId: "conv1",
          subject: "Test",
          bodyPreview: "Preview",
          from: { emailAddress: { name: "Sender", address: "sender@example.com" } },
          toRecipients: [],
          ccRecipients: [],
          receivedDateTime: "2026-10-01",
          sentDateTime: "2026-10-01",
          hasAttachments: false,
          importance: "normal",
          isRead: false,
          categories: [],
        },
      ];

      (mockClient.delta as ReturnType<typeof vi.fn>).mockResolvedValue({
        items: mockMessages,
        removed: [],
        deltaLink: "delta-link-123",
      });

      const result = await fetchMailFolderDelta(mockClient, "user@example.com", "inbox");

      expect(result.messages).toEqual(mockMessages);
      expect(result.removed).toEqual([]);
      expect(result.checkpoint.deltaLink).toBe("delta-link-123");
    });

    it("resumes from checkpoint", async () => {
      const checkpoint = "previous-delta-link";

      (mockClient.delta as ReturnType<typeof vi.fn>).mockResolvedValue({
        items: [],
        removed: [],
        deltaLink: "new-delta-link",
      });

      const result = await fetchMailFolderDelta(
        mockClient,
        "user@example.com",
        "inbox",
        checkpoint
      );

      expect(mockClient.delta).toHaveBeenCalledWith(
        "/users/user%40example.com/mailFolders/inbox/messages",
        checkpoint,
        expect.any(String)
      );
      expect(result.checkpoint.deltaLink).toBe("new-delta-link");
    });

    it("includes removed items", async () => {
      (mockClient.delta as ReturnType<typeof vi.fn>).mockResolvedValue({
        items: [],
        removed: ["msg1", "msg2"],
        deltaLink: "delta-link",
      });

      const result = await fetchMailFolderDelta(mockClient, "user@example.com", "inbox");

      expect(result.removed).toEqual(["msg1", "msg2"]);
    });

    it("handles nextLink for pagination", async () => {
      (mockClient.delta as ReturnType<typeof vi.fn>).mockResolvedValue({
        items: [],
        removed: [],
        nextLink: "next-page-link",
      });

      const result = await fetchMailFolderDelta(mockClient, "user@example.com", "inbox");

      expect(result.checkpoint.nextLink).toBe("next-page-link");
    });
  });

  describe("fetchDriveDelta", () => {
    it("yields page with checkpoint", async () => {
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

      (mockClient.delta as ReturnType<typeof vi.fn>).mockResolvedValue({
        items: mockItems,
        removed: [],
        deltaLink: "drive-delta-link",
      });

      const result = await fetchDriveDelta(mockClient, "site-123");

      expect(result.items).toEqual(mockItems);
      expect(result.removed).toEqual([]);
      expect(result.checkpoint.deltaLink).toBe("drive-delta-link");
    });

    it("resumes from checkpoint", async () => {
      const checkpoint = "previous-drive-delta";

      (mockClient.delta as ReturnType<typeof vi.fn>).mockResolvedValue({
        items: [],
        removed: [],
        deltaLink: "new-drive-delta",
      });

      const result = await fetchDriveDelta(mockClient, "site-123", checkpoint);

      expect(mockClient.delta).toHaveBeenCalledWith(
        "/sites/site-123/drive/root",
        checkpoint,
        expect.any(String)
      );
      expect(result.checkpoint.deltaLink).toBe("new-drive-delta");
    });

    it("includes removed items with deleted facet", async () => {
      (mockClient.delta as ReturnType<typeof vi.fn>).mockResolvedValue({
        items: [],
        removed: ["item1", "item2"],
        deltaLink: "delta-link",
      });

      const result = await fetchDriveDelta(mockClient, "site-123");

      expect(result.removed).toEqual(["item1", "item2"]);
    });
  });
});
