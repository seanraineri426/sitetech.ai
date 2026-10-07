/**
 * Tests for Microsoft Graph mappers.
 */

import { describe, it, expect, vi } from "vitest";

// Mock server-only
vi.mock("server-only", () => ({}));

import { mapGraphMessageToNormalized, emailToRawRecord } from "../mappers";
import type { GraphMessage } from "../types";

describe("Microsoft Graph mappers", () => {
  const mockMessage: GraphMessage = {
    id: "msg-123",
    conversationId: "conv-456",
    subject: "Test Email",
    bodyPreview: "This is a test email preview",
    from: {
      emailAddress: {
        name: "John Sender",
        address: "john@example.com",
      },
    },
    toRecipients: [
      {
        emailAddress: {
          name: "Jane Recipient",
          address: "jane@example.com",
        },
      },
    ],
    ccRecipients: [
      {
        emailAddress: {
          name: "Bob CC",
          address: "bob@example.com",
        },
      },
    ],
    receivedDateTime: "2026-10-06T14:30:00Z",
    sentDateTime: "2026-10-06T14:29:55Z",
    hasAttachments: true,
    importance: "normal",
    isRead: false,
    categories: ["Important", "Work"],
  };

  describe("mapGraphMessageToNormalized", () => {
    it("maps Graph message to normalized email", () => {
      const normalized = mapGraphMessageToNormalized(mockMessage, "user@example.com");

      expect(normalized.entity_type).toBe("email");
      expect(normalized.external_id).toBe("msg-123");
      expect(normalized.source_mailbox).toBe("user@example.com");
      expect(normalized.subject).toBe("Test Email");
      expect(normalized.fingerprint).toBeTruthy();
    });

    it("preserves receivedDateTime as ISO UTC string in received_at", () => {
      const normalized = mapGraphMessageToNormalized(mockMessage, "user@example.com");

      expect(normalized.received_at).toBe("2026-10-06T14:30:00Z");
      expect(typeof normalized.received_at).toBe("string");
    });

    it("preserves sentDateTime as ISO UTC string in sent_at", () => {
      const normalized = mapGraphMessageToNormalized(mockMessage, "user@example.com");

      expect(normalized.sent_at).toBe("2026-10-06T14:29:55Z");
      expect(typeof normalized.sent_at).toBe("string");
    });

    it("sets received_at_source to 'graph'", () => {
      const normalized = mapGraphMessageToNormalized(mockMessage, "user@example.com");

      expect(normalized.received_at_source).toBe("graph");
    });

    it("maps from address correctly", () => {
      const normalized = mapGraphMessageToNormalized(mockMessage, "user@example.com");

      expect(normalized.from.name).toBe("John Sender");
      expect(normalized.from.address).toBe("john@example.com");
    });

    it("maps to_recipients correctly", () => {
      const normalized = mapGraphMessageToNormalized(mockMessage, "user@example.com");

      expect(normalized.to_recipients).toHaveLength(1);
      expect(normalized.to_recipients[0].name).toBe("Jane Recipient");
      expect(normalized.to_recipients[0].address).toBe("jane@example.com");
    });

    it("maps cc_recipients correctly", () => {
      const normalized = mapGraphMessageToNormalized(mockMessage, "user@example.com");

      expect(normalized.cc_recipients).toHaveLength(1);
      expect(normalized.cc_recipients[0].name).toBe("Bob CC");
      expect(normalized.cc_recipients[0].address).toBe("bob@example.com");
    });

    it("includes conversation_id", () => {
      const normalized = mapGraphMessageToNormalized(mockMessage, "user@example.com");

      expect(normalized.conversation_id).toBe("conv-456");
    });

    it("includes metadata fields", () => {
      const normalized = mapGraphMessageToNormalized(mockMessage, "user@example.com");

      expect(normalized.has_attachments).toBe(true);
      expect(normalized.importance).toBe("normal");
      expect(normalized.is_read).toBe(false);
      expect(normalized.categories).toEqual(["Important", "Work"]);
    });

    it("generates stable fingerprint", () => {
      const normalized1 = mapGraphMessageToNormalized(mockMessage, "user@example.com");
      const normalized2 = mapGraphMessageToNormalized(mockMessage, "user@example.com");

      expect(normalized1.fingerprint).toBe(normalized2.fingerprint);
    });

    it("changes fingerprint when message changes", () => {
      const normalized1 = mapGraphMessageToNormalized(mockMessage, "user@example.com");
      
      const modified = {
        ...mockMessage,
        subject: "Modified Subject",
      };
      const normalized2 = mapGraphMessageToNormalized(modified, "user@example.com");

      expect(normalized1.fingerprint).not.toBe(normalized2.fingerprint);
    });
  });

  describe("Email fingerprinting (CTO decision 2026-10-07)", () => {
    it("does NOT change fingerprint when isRead changes", () => {
      const normalized1 = mapGraphMessageToNormalized(mockMessage, "user@example.com");
      
      const modified = {
        ...mockMessage,
        isRead: !mockMessage.isRead,
      };
      const normalized2 = mapGraphMessageToNormalized(modified, "user@example.com");

      // isRead is stored but not fingerprinted as content
      expect(normalized1.fingerprint).toBe(normalized2.fingerprint);
    });

    it("does NOT change fingerprint when email address changes but domain stays same", () => {
      const normalized1 = mapGraphMessageToNormalized(mockMessage, "user@example.com");
      
      const modified = {
        ...mockMessage,
        from: {
          emailAddress: {
            name: "John Sender",
            address: "different-user@example.com", // Same domain
          },
        },
      };
      const normalized2 = mapGraphMessageToNormalized(modified, "user@example.com");

      // Only domains are fingerprinted, not full addresses
      expect(normalized1.fingerprint).toBe(normalized2.fingerprint);
    });

    it("DOES change fingerprint when email domain changes", () => {
      const normalized1 = mapGraphMessageToNormalized(mockMessage, "user@example.com");
      
      const modified = {
        ...mockMessage,
        from: {
          emailAddress: {
            name: "John Sender",
            address: "john@different-domain.com", // Different domain
          },
        },
      };
      const normalized2 = mapGraphMessageToNormalized(modified, "user@example.com");

      // Domain changes should affect fingerprint
      expect(normalized1.fingerprint).not.toBe(normalized2.fingerprint);
    });

    it("stores raw email addresses even though not fingerprinted", () => {
      const normalized = mapGraphMessageToNormalized(mockMessage, "user@example.com");

      // Addresses are stored per CTO approval for email records
      expect(normalized.from.address).toBe("john@example.com");
      expect(normalized.to_recipients[0].address).toBe("jane@example.com");
      expect(normalized.cc_recipients[0].address).toBe("bob@example.com");
    });
  });

  describe("emailToRawRecord", () => {
    it("converts normalized email to raw record shape", () => {
      const normalized = mapGraphMessageToNormalized(mockMessage, "user@example.com");
      const raw = emailToRawRecord(normalized);

      expect(raw.entityType).toBe("email");
      expect(raw.externalId).toBe("msg-123");
      expect(raw.fingerprint).toBe(normalized.fingerprint);
      expect(raw.allowlistedPayload).toHaveProperty("subject");
      expect(raw.allowlistedPayload).toHaveProperty("received_at");
      expect(raw.allowlistedPayload).toHaveProperty("received_at_source");
    });

    it("includes received_at_source in payload", () => {
      const normalized = mapGraphMessageToNormalized(mockMessage, "user@example.com");
      const raw = emailToRawRecord(normalized);

      expect(raw.allowlistedPayload.received_at_source).toBe("graph");
    });
  });

  describe("received_at_source type", () => {
    it("accepts 'graph' as received_at_source", () => {
      const normalized = mapGraphMessageToNormalized(mockMessage, "user@example.com");
      
      const source: "graph" | "forwarded_text" = normalized.received_at_source;
      expect(source).toBe("graph");
    });

    it("type allows 'forwarded_text' for future fallback", () => {
      // This is a compile-time test - if it compiles, the union type is correct
      const source: "graph" | "forwarded_text" = "forwarded_text";
      expect(source).toBe("forwarded_text");
    });
  });

  describe("DriveItem email stripping", () => {
    it("strips emails from createdBy and lastModifiedBy via real fetcher", async () => {
      const { fetchDriveDelta } = await import("../fetchers");
      const { GraphClient } = await import("../client");
      
      // Mock fetch
      const mockFetch = vi.fn();
      (global as any).fetch = mockFetch;

      const mockConfig = {
        tenantId: "tenant-123",
        clientId: "client-123",
        clientSecret: "secret",
        mailbox: "user@example.com",
        siteId: "site-123",
        scopes: ["https://graph.microsoft.com/.default"],
      };

      const client = new GraphClient(mockConfig);

      // Mock token response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "test-token",
          expires_in: 3600,
        }),
      });

      // Mock delta response with emails
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          value: [
            {
              id: "item123",
              name: "document.pdf",
              webUrl: "https://example.com",
              size: 1024,
              createdDateTime: "2026-01-01T00:00:00Z",
              lastModifiedDateTime: "2026-01-02T00:00:00Z",
              createdBy: {
                user: {
                  displayName: "Alice Creator",
                  id: "user-123",
                  email: "alice@example.com",
                },
              },
              lastModifiedBy: {
                user: {
                  displayName: "Bob Modifier",
                  id: "user-456",
                  email: "bob@example.com",
                },
              },
              file: {},
              parentReference: { driveId: "drive-123", id: "root", path: "/" },
            },
          ],
          "@odata.deltaLink": "https://graph.microsoft.com/delta",
        }),
      });

      const result = await fetchDriveDelta(client, "site-123");

      // Emails must not be present in exported items
      const item = result.items[0] as any;
      expect(item.createdBy.user.email).toBeUndefined();
      expect(item.lastModifiedBy.user.email).toBeUndefined();

      // displayName and id must be preserved
      expect(item.createdBy.user.displayName).toBe("Alice Creator");
      expect(item.createdBy.user.id).toBe("user-123");
      expect(item.lastModifiedBy.user.displayName).toBe("Bob Modifier");
      expect(item.lastModifiedBy.user.id).toBe("user-456");
    });

    it("handles missing createdBy/lastModifiedBy gracefully", async () => {
      const { stripDriveItemEmails } = await import("../mappers");
      
      const driveItem = {
        id: "item123",
        name: "document.pdf",
      };

      const stripped = stripDriveItemEmails(driveItem);
      expect(stripped).toEqual(driveItem);
    });
  });
});
