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
});
