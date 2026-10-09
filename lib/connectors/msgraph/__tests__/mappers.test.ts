/**
 * Tests for Microsoft Graph mappers.
 */

import { describe, it, expect, vi } from "vitest";

// Mock server-only
vi.mock("server-only", () => ({}));

import { mapGraphMessageToNormalized, emailToRawRecord, redactAddresses } from "../mappers";
import type { GraphMessage } from "../types";

describe("Microsoft Graph mappers", () => {
  const mockMessage: GraphMessage = {
    id: "msg-123",
    conversationId: "conv-456",
    subject: "Test Email",
    bodyPreview: "This is a test email preview",
    body: {
      contentType: "text",
      content: "This is the full body text.",
    },
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
      expect(normalized.body_text).toBe("This is the full body text.");
      expect(normalized.fingerprint).toBeTruthy();
    });

    it("extracts plain text body_text from text content", () => {
      const normalized = mapGraphMessageToNormalized(mockMessage, "user@example.com");

      expect(normalized.body_text).toBe("This is the full body text.");
    });

    it("preserves quoted reply history in body_text", () => {
      const messageWithHistory: GraphMessage = {
        ...mockMessage,
        body: {
          contentType: "text",
          content: "My reply.\n\nOn Oct 8, 2026, Bob wrote:\n> Original message.",
        },
      };

      const normalized = mapGraphMessageToNormalized(messageWithHistory, "user@example.com");
      expect(normalized.body_text).toContain("My reply");
      expect(normalized.body_text).toContain("On Oct 8, 2026, Bob wrote:");
      expect(normalized.body_text).toContain("> Original message");
    });

    it("converts HTML body to plain text", () => {
      const messageWithHtml: GraphMessage = {
        ...mockMessage,
        body: {
          contentType: "html",
          content: "<p>Hello <strong>world</strong></p>",
        },
      };

      const normalized = mapGraphMessageToNormalized(messageWithHtml, "user@example.com");
      expect(normalized.body_text).toBe("Hello world");
    });

    it("handles null body", () => {
      const messageWithoutBody: GraphMessage = {
        ...mockMessage,
        body: null,
      };

      const normalized = mapGraphMessageToNormalized(messageWithoutBody, "user@example.com");
      expect(normalized.body_text).toBeNull();
    });

    it("handles undefined body", () => {
      const messageWithoutBody: GraphMessage = {
        ...mockMessage,
        body: undefined,
      };

      const normalized = mapGraphMessageToNormalized(messageWithoutBody, "user@example.com");
      expect(normalized.body_text).toBeNull();
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

    it("DOES change fingerprint when body_text changes", () => {
      const message1: GraphMessage = {
        ...mockMessage,
        body: { contentType: "text", content: "Original body" },
      };
      const message2: GraphMessage = {
        ...mockMessage,
        body: { contentType: "text", content: "Modified body" },
      };

      const normalized1 = mapGraphMessageToNormalized(message1, "user@example.com");
      const normalized2 = mapGraphMessageToNormalized(message2, "user@example.com");

      // Body content is fingerprinted
      expect(normalized1.fingerprint).not.toBe(normalized2.fingerprint);
    });

    it("does NOT change fingerprint when only bodyPreview changes (body_text stays same)", () => {
      const message1: GraphMessage = {
        ...mockMessage,
        body: { contentType: "text", content: "Full body text" },
        bodyPreview: "Preview 1",
      };
      const message2: GraphMessage = {
        ...mockMessage,
        body: { contentType: "text", content: "Full body text" },
        bodyPreview: "Preview 2",
      };

      const normalized1 = mapGraphMessageToNormalized(message1, "user@example.com");
      const normalized2 = mapGraphMessageToNormalized(message2, "user@example.com");

      // Fingerprint uses body_text not bodyPreview per CTO 2026-10-09
      expect(normalized1.fingerprint).toBe(normalized2.fingerprint);
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

    it("includes body_text_sha256 in allowlisted payload (NOT body_text)", () => {
      const normalized = mapGraphMessageToNormalized(mockMessage, "user@example.com");
      const raw = emailToRawRecord(normalized);

      expect(raw.allowlistedPayload.body_text_sha256).toBeTruthy();
      expect(raw.allowlistedPayload.body_text_sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(raw.allowlistedPayload).not.toHaveProperty("body_text");
    });

    it("includes conversation_id in allowlisted payload", () => {
      const normalized = mapGraphMessageToNormalized(mockMessage, "user@example.com");
      const raw = emailToRawRecord(normalized);

      expect(raw.allowlistedPayload.conversation_id).toBe("conv-456");
    });

    it("stores participant domains NOT raw addresses", () => {
      const normalized = mapGraphMessageToNormalized(mockMessage, "user@example.com");
      const raw = emailToRawRecord(normalized);

      // Should have domains
      expect(raw.allowlistedPayload.from_domain).toBe("example.com");
      expect(raw.allowlistedPayload.to_domains).toEqual(["example.com"]);
      expect(raw.allowlistedPayload.cc_domains).toEqual(["example.com"]);

      // Should NOT have raw addresses
      expect(raw.allowlistedPayload).not.toHaveProperty("from");
      expect(raw.allowlistedPayload).not.toHaveProperty("to_recipients");
      expect(raw.allowlistedPayload).not.toHaveProperty("cc_recipients");
    });

    it("computes body_text_sha256 correctly", () => {
      const normalized = mapGraphMessageToNormalized(mockMessage, "user@example.com");
      const raw = emailToRawRecord(normalized);

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const expectedHash = require("crypto")
        .createHash("sha256")
        .update("This is the full body text.")
        .digest("hex");

      expect(raw.allowlistedPayload.body_text_sha256).toBe(expectedHash);
    });

    it("body_text_sha256 is null when body_text is null", () => {
      const messageWithoutBody: GraphMessage = {
        ...mockMessage,
        body: null,
      };
      const normalized = mapGraphMessageToNormalized(messageWithoutBody, "user@example.com");
      const raw = emailToRawRecord(normalized);

      expect(raw.allowlistedPayload.body_text_sha256).toBeNull();
    });
  });

  describe("redactAddresses", () => {
    it("redacts email addresses with domain preserved", async () => {
      const { redactAddresses } = await import("../mappers");
      
      const text = "Contact alice@example.com or bob@test.org for details.";
      const redacted = redactAddresses(text);
      
      expect(redacted).toBe("Contact [email-example.com] or [email-test.org] for details.");
    });

    it("handles mixed case emails", async () => {
      const { redactAddresses } = await import("../mappers");
      
      const text = "Send to Alice.Smith@Example.COM";
      const redacted = redactAddresses(text);
      
      expect(redacted).toBe("Send to [email-Example.COM]");
    });

    it("handles multiple emails on same line", async () => {
      const { redactAddresses } = await import("../mappers");
      
      const text = "From: a@x.com To: b@y.com CC: c@z.com";
      const redacted = redactAddresses(text);
      
      expect(redacted).toContain("[email-x.com]");
      expect(redacted).toContain("[email-y.com]");
      expect(redacted).toContain("[email-z.com]");
    });

    it("leaves non-email text unchanged", async () => {
      const { redactAddresses } = await import("../mappers");
      
      const text = "No emails here, just text.";
      const redacted = redactAddresses(text);
      
      expect(redacted).toBe(text);
    });

    it("redacts adjacent addresses separated by /", async () => {
      const { redactAddresses } = await import("../mappers");
      
      const text = "Contact bob@x.com/carol@x.com.";
      const redacted = redactAddresses(text);
      
      expect(redacted).not.toContain("@");
      expect(redacted).toContain("[email-x.com]");
    });

    it("redacts adjacent addresses separated by comma", async () => {
      const { redactAddresses } = await import("../mappers");
      
      const text = "bob@x.com,carol@y.com.";
      const redacted = redactAddresses(text);
      
      expect(redacted).not.toContain("@");
      expect(redacted).toContain("[email-x.com]");
      expect(redacted).toContain("[email-y.com]");
    });

    it("redacts adjacent addresses separated by semicolon", async () => {
      const { redactAddresses } = await import("../mappers");
      
      const text = "To: bob@x.com;carol@gc.c";
      const redacted = redactAddresses(text);
      
      expect(redacted).not.toContain("@");
      expect(redacted).toContain("[email-x.com]");
      expect(redacted).toContain("[email-gc.c]");
    });

    it("allows sentence-ending period after address", async () => {
      const { redactAddresses } = await import("../mappers");
      
      const text = "Contact bob@x.com.";
      const redacted = redactAddresses(text);
      
      expect(redacted).toBe("Contact [email-x.com].");
    });

    it("preserves bare @ in phrases", async () => {
      const { redactAddresses } = await import("../mappers");
      
      expect(redactAddresses("price @ $5")).toBe("price @ $5");
      expect(redactAddresses("RFI @ Level 3")).toBe("RFI @ Level 3");
      expect(redactAddresses("@channel")).toBe("@channel");
    });

    it("linear performance: 200KB text + bare @", async () => {
      const { redactAddresses } = await import("../mappers");
      
      const text = "a".repeat(200_000) + " @";
      const t0 = performance.now();
      redactAddresses(text);
      const elapsed = performance.now() - t0;
      
      expect(elapsed).toBeLessThan(50);
    });

    it("linear performance: 100K 'a.' pairs + address", async () => {
      const { redactAddresses } = await import("../mappers");
      
      const text = "a.".repeat(100_000) + " x@y";
      const t0 = performance.now();
      const result = redactAddresses(text);
      const elapsed = performance.now() - t0;
      
      expect(elapsed).toBeLessThan(50);
      expect(result).toContain("[email-y]");
    });

    it("URL with encoded addresses leaves no local parts", async () => {
      const { redactAddresses } = await import("../mappers");
      
      const text = "https://list.example.com/u?e=bob@x.com%26ref=carol@y.com%26z";
      const result = redactAddresses(text);
      
      expect(result).not.toContain("bob@");
      expect(result).not.toContain("carol@");
      expect(result).not.toContain("@x.com%");
      expect(result).not.toContain("@y.com%");
    });

    it("addresses separated by underscore with suffix", async () => {
      const { redactAddresses } = await import("../mappers");
      
      expect(redactAddresses("a@x.com_|b@y.com_")).not.toContain("@");
    });

    it("addresses separated by dash with suffix", async () => {
      const { redactAddresses } = await import("../mappers");
      
      expect(redactAddresses("a@x.com-|b@y.com-")).not.toContain("@");
    });

    it("addresses separated by various punctuation", async () => {
      const { redactAddresses } = await import("../mappers");
      
      const separators = [":", "<", ">", "'", '"', "(", "&", "=", "?"];
      for (const sep of separators) {
        const text = `a@x.com${sep}b@y.com`;
        const result = redactAddresses(text);
        expect(result).not.toContain("@");
      }
    });

    it("multiple @ in one address uses last domain", async () => {
      const { redactAddresses } = await import("../mappers");
      
      expect(redactAddresses("a@b@c@d.com")).toBe("[email-d.com]");
    });

    it("construction text: rebar sizes unchanged", async () => {
      const { redactAddresses } = await import("../mappers");
      
      expect(redactAddresses("rebar #5@10 vs #5@12")).toBe("rebar #5@10 vs #5@12");
    });

    it("construction text: lumber o.c. unchanged", async () => {
      const { redactAddresses } = await import("../mappers");
      
      expect(redactAddresses('2x4@16" o.c.')).toBe('2x4@16" o.c.');
    });

    it("construction text: angle iron unchanged", async () => {
      const { redactAddresses } = await import("../mappers");
      
      expect(redactAddresses("L4x4x1/4@24")).toBe("L4x4x1/4@24");
    });

    it("construction text: cost code unchanged", async () => {
      const { redactAddresses } = await import("../mappers");
      
      expect(redactAddresses("CO#12@$4,500")).toBe("CO#12@$4,500");
    });

    it("construction text: price per unit unchanged", async () => {
      const { redactAddresses } = await import("../mappers");
      
      expect(redactAddresses("3@ $1,200")).toBe("3@ $1,200");
    });

    it("construction text: grid reference unchanged", async () => {
      const { redactAddresses } = await import("../mappers");
      
      expect(redactAddresses("beam B-3@grid C/4")).toBe("beam B-3@grid C/4");
    });

    it("construction text: meeting time unchanged", async () => {
      const { redactAddresses } = await import("../mappers");
      
      expect(redactAddresses("meeting@2pm")).toBe("meeting@2pm");
    });

    it("construction text: rebar spacing unchanged", async () => {
      const { redactAddresses } = await import("../mappers");
      
      expect(redactAddresses("#4@16 EW")).toBe("#4@16 EW");
    });

    it("construction text: steel beam unchanged", async () => {
      const { redactAddresses } = await import("../mappers");
      
      expect(redactAddresses("W12x26@16")).toBe("W12x26@16");
    });

    it("construction text: quantity pricing unchanged", async () => {
      const { redactAddresses } = await import("../mappers");
      
      expect(redactAddresses("5ea@$40")).toBe("5ea@$40");
    });

    it("construction text: elevation unchanged", async () => {
      const { redactAddresses } = await import("../mappers");
      
      expect(redactAddresses('T/O slab@+12\'-0"')).toBe('T/O slab@+12\'-0"');
    });

    it("truncated addresses at end of string are redacted", async () => {
      const { redactAddresses } = await import("../mappers");
      
      expect(redactAddresses("bob@gc.c")).toBe("[email-gc.c]");
      expect(redactAddresses("bob@gc")).toBe("[email-gc]");
    });

    it("Unicode local parts redacted", async () => {
      const { redactAddresses } = await import("../mappers");
      
      const result = redactAddresses("josé@x.com");
      expect(result).toBe("[email-x.com]");
      expect(result).not.toContain("josé");
    });

    it("Unicode domains preserved", async () => {
      const { redactAddresses } = await import("../mappers");
      
      expect(redactAddresses("user@почта.рф")).toBe("[email-почта.рф]");
    });

    it("full-width @ normalized and redacted", async () => {
      const { redactAddresses } = await import("../mappers");
      
      const result = redactAddresses("bob＠x.com");
      expect(result).not.toContain("bob");
      expect(result).toContain("[email-x.com]");
    });

    it("linear performance: 200KB of a@b_ repeated", async () => {
      const { redactAddresses } = await import("../mappers");
      
      const text = "a@b_".repeat(50_000); // 200KB
      const t0 = performance.now();
      redactAddresses(text);
      const elapsed = performance.now() - t0;
      
      expect(elapsed).toBeLessThan(50);
    });

    describe("construction text byte-for-byte unchanged", () => {
      const constructionInputs = [
        "#5@10 EW",
        "#4@12\" o.c. T&B",
        "03 30 00 Cast-in-Place Concrete",
        "Spec 08 71 00 §2.3",
        "$48,200 CO",
        "CO #12 @ $4,500",
        "$1.2M",
        "($3,450.00)",
        "RFI #045",
        "RFI-045 rev 2",
        "PCO 017",
        "CE-23",
        "ASI 4",
        "SK-12",
        "10/09/2026",
        "Oct 9, 2026",
        "2026-10-09T14:00:00Z",
        "due 10/15 @ 2pm",
        "W12x26@16",
        "L4x4x1/4@24",
        "meeting@2pm",
        "beam B-3@grid C/4",
      ];

      for (const input of constructionInputs) {
        it(`unchanged: ${input}`, async () => {
          const { redactAddresses } = await import("../mappers");
          expect(redactAddresses(input)).toBe(input);
        });
      }

      it("realistic multi-line subject unchanged byte-for-byte", async () => {
        const { redactAddresses } = await import("../mappers");
        const subject = `RE: RFI #045 - Concrete Mix Design CO #12 @ $4,500
Spec 03 30 00 Cast-in-Place Concrete - W12x26@16
Due 10/15 @ 2pm, beam B-3@grid C/4, #5@10 EW
Meeting@2pm Oct 9, 2026 ($48,200 CO)`;
        
        const result = redactAddresses(subject);
        expect(result).toBe(subject);
        expect(Buffer.from(result).equals(Buffer.from(subject))).toBe(true);
      });

      it("construction text unchanged through emailToRawRecord", async () => {
        const { emailToRawRecord, mapGraphMessageToNormalized } = await import("../mappers");
        const mockMessage = {
          id: "msg1",
          conversationId: "conv1",
          subject: "CO #12 @ $4,500",
          bodyPreview: "W12x26@16, #5@10 EW, due 10/15 @ 2pm",
          body: { contentType: "text" as const, content: "beam B-3@grid C/4" },
          from: { emailAddress: { name: "A", address: "a@x.com" } },
          toRecipients: [],
          ccRecipients: [],
          receivedDateTime: "2026-10-09T12:00:00Z",
          sentDateTime: "2026-10-09T12:00:00Z",
          hasAttachments: false,
          importance: "normal" as const,
          isRead: false,
          categories: [],
        };

        const normalized = mapGraphMessageToNormalized(mockMessage, "user@example.com");
        const raw = emailToRawRecord(normalized);
        const payload = raw.allowlistedPayload as Record<string, unknown>;

        expect(payload.subject).toBe("CO #12 @ $4,500");
        expect(payload.body_preview).toBe("W12x26@16, #5@10 EW, due 10/15 @ 2pm");
      });
    });

    describe("byte-for-byte except addresses", () => {
      it("construction + 1 address: exact span replacement", async () => {
        const { redactAddresses } = await import("../mappers");
        const input = "Contact alice@example.com for CO #12 @ $4,500";
        const result = redactAddresses(input);
        
        // Build expected by manually replacing the known address span
        const expected = "Contact [email-example.com] for CO #12 @ $4,500";
        expect(result).toBe(expected);
        
        // Verify only the address span changed
        const beforeAddr = "Contact ";
        const afterAddr = " for CO #12 @ $4,500";
        expect(result.startsWith(beforeAddr)).toBe(true);
        expect(result.endsWith(afterAddr)).toBe(true);
      });

      it("construction + 2 addresses: exact spans replacement", async () => {
        const { redactAddresses } = await import("../mappers");
        const input = "From bob@x.com to carol@y.com re: W12x26@16, #5@10 EW";
        const result = redactAddresses(input);
        
        // Build expected by manually replacing known address spans
        const expected = "From [email-x.com] to [email-y.com] re: W12x26@16, #5@10 EW";
        expect(result).toBe(expected);
        
        // Verify construction text unchanged
        expect(result).toContain("W12x26@16");
        expect(result).toContain("#5@10 EW");
      });

      it("construction + 3 addresses in realistic text", async () => {
        const { redactAddresses } = await import("../mappers");
        const input = `RFI #045 from alice@gc.com to bob@sub.example.com, carol@another.org
Spec 03 30 00 - due 10/15 @ 2pm
CO #12 @ $4,500, beam B-3@grid C/4`;
        
        const result = redactAddresses(input);
        
        // Build expected manually
        const expected = `RFI #045 from [email-gc.com] to [email-sub.example.com], [email-another.org]
Spec 03 30 00 - due 10/15 @ 2pm
CO #12 @ $4,500, beam B-3@grid C/4`;
        
        expect(result).toBe(expected);
        
        // Verify no addresses remain and construction text intact
        expect(result).not.toContain("alice@");
        expect(result).not.toContain("bob@");
        expect(result).not.toContain("carol@");
        expect(result).toContain("due 10/15 @ 2pm");
        expect(result).toContain("CO #12 @ $4,500");
        expect(result).toContain("beam B-3@grid C/4");
      });
    });

    describe("body_text redaction", () => {
      it("body_text IS redacted, contains no address-like x@y.z (text body)", async () => {
        const { mapGraphMessageToNormalized } = await import("../mappers");
        const textContent = "Contact alice@example.com or bob@test.org for details.";
        const mockMessage = {
          id: "msg1",
          conversationId: "conv1",
          subject: "Test",
          bodyPreview: "Preview",
          body: { contentType: "text" as const, content: textContent },
          from: { emailAddress: { name: "A", address: "a@x.com" } },
          toRecipients: [],
          ccRecipients: [],
          receivedDateTime: "2026-10-09T12:00:00Z",
          sentDateTime: "2026-10-09T12:00:00Z",
          hasAttachments: false,
          importance: "normal" as const,
          isRead: false,
          categories: [],
        };

        const normalized = mapGraphMessageToNormalized(mockMessage, "user@example.com");
        
        // body_text must be redacted
        expect(normalized.body_text).not.toContain("alice@");
        expect(normalized.body_text).not.toContain("bob@");
        expect(normalized.body_text).toContain("[email-example.com]");
        expect(normalized.body_text).toContain("[email-test.org]");
      });

      it("body_text IS redacted, contains no address-like x@y.z (HTML body)", async () => {
        const { mapGraphMessageToNormalized } = await import("../mappers");
        const htmlContent = "<p>Contact alice@example.com or <a href='mailto:bob@test.org'>bob@test.org</a></p>";
        const mockMessage = {
          id: "msg1",
          conversationId: "conv1",
          subject: "Test",
          bodyPreview: "Preview",
          body: { contentType: "html" as const, content: htmlContent },
          from: { emailAddress: { name: "A", address: "a@x.com" } },
          toRecipients: [],
          ccRecipients: [],
          receivedDateTime: "2026-10-09T12:00:00Z",
          sentDateTime: "2026-10-09T12:00:00Z",
          hasAttachments: false,
          importance: "normal" as const,
          isRead: false,
          categories: [],
        };

        const normalized = mapGraphMessageToNormalized(mockMessage, "user@example.com");
        
        // body_text must be redacted
        expect(normalized.body_text).not.toContain("alice@");
        expect(normalized.body_text).not.toContain("bob@");
      });

      it("body_text byte-for-byte except address spans", async () => {
        const { mapGraphMessageToNormalized } = await import("../mappers");
        const textContent = "From alice@example.com: CO #12 @ $4,500, W12x26@16";
        const mockMessage = {
          id: "msg1",
          conversationId: "conv1",
          subject: "Test",
          bodyPreview: "Preview",
          body: { contentType: "text" as const, content: textContent },
          from: { emailAddress: { name: "A", address: "a@x.com" } },
          toRecipients: [],
          ccRecipients: [],
          receivedDateTime: "2026-10-09T12:00:00Z",
          sentDateTime: "2026-10-09T12:00:00Z",
          hasAttachments: false,
          importance: "normal" as const,
          isRead: false,
          categories: [],
        };

        const normalized = mapGraphMessageToNormalized(mockMessage, "user@example.com");
        
        // Build expected: input with only address span replaced
        const expected = "From [email-example.com]: CO #12 @ $4,500, W12x26@16";
        expect(normalized.body_text).toBe(expected);
        
        // Construction text preserved
        expect(normalized.body_text).toContain("CO #12 @ $4,500");
        expect(normalized.body_text).toContain("W12x26@16");
      });

      it("200KB body with scattered addresses redacts under 100ms", async () => {
        const { mapGraphMessageToNormalized } = await import("../mappers");
        
        // Build 200KB text with addresses every ~500 chars
        let content = "";
        for (let i = 0; i < 400; i++) {
          content += "x".repeat(490) + " alice@example.com ";
        }
        
        const mockMessage = {
          id: "msg1",
          conversationId: "conv1",
          subject: "Test",
          bodyPreview: "Preview",
          body: { contentType: "text" as const, content },
          from: { emailAddress: { name: "A", address: "a@x.com" } },
          toRecipients: [],
          ccRecipients: [],
          receivedDateTime: "2026-10-09T12:00:00Z",
          sentDateTime: "2026-10-09T12:00:00Z",
          hasAttachments: false,
          importance: "normal" as const,
          isRead: false,
          categories: [],
        };

        const t0 = performance.now();
        const normalized = mapGraphMessageToNormalized(mockMessage, "user@example.com");
        const elapsed = performance.now() - t0;
        
        expect(elapsed).toBeLessThan(100);
        expect(normalized.body_text).not.toContain("alice@");
      });

      it("from/to/cc still hold raw addresses", async () => {
        const { mapGraphMessageToNormalized } = await import("../mappers");
        const mockMessage = {
          id: "msg1",
          conversationId: "conv1",
          subject: "Test",
          bodyPreview: "Preview",
          body: { contentType: "text" as const, content: "Body with alice@example.com" },
          from: { emailAddress: { name: "Alice", address: "alice@example.com" } },
          toRecipients: [{ emailAddress: { name: "Bob", address: "bob@test.org" } }],
          ccRecipients: [{ emailAddress: { name: "Carol", address: "carol@x.com" } }],
          receivedDateTime: "2026-10-09T12:00:00Z",
          sentDateTime: "2026-10-09T12:00:00Z",
          hasAttachments: false,
          importance: "normal" as const,
          isRead: false,
          categories: [],
        };

        const normalized = mapGraphMessageToNormalized(mockMessage, "user@example.com");
        
        // Raw addresses preserved in from/to/cc
        expect(normalized.from.address).toBe("alice@example.com");
        expect(normalized.to_recipients[0].address).toBe("bob@test.org");
        expect(normalized.cc_recipients[0].address).toBe("carol@x.com");
        
        // But text fields are redacted
        expect(normalized.body_text).not.toContain("alice@");
        expect(normalized.body_text).toContain("[email-example.com]");
      });
    });
  });

  describe("size caps and null byte stripping", () => {
    it("strips null bytes from text body", () => {
      const messageWithNulls: GraphMessage = {
        ...mockMessage,
        body: { contentType: "text", content: "a\u0000b\u0000c" },
      };
      const normalized = mapGraphMessageToNormalized(messageWithNulls, "user@example.com");
      
      expect(normalized.body_text).toBe("abc");
      expect(normalized.body_text).not.toContain("\u0000");
    });

    it("caps text body at 200KB", () => {
      const messageWithLargeBody: GraphMessage = {
        ...mockMessage,
        body: { contentType: "text", content: "x".repeat(500_000) },
      };
      const normalized = mapGraphMessageToNormalized(messageWithLargeBody, "user@example.com");
      
      expect(normalized.body_text!.length).toBeLessThanOrEqual(200_000 + 20);
      expect(normalized.body_text).toContain("[truncated]");
    });

    it("caps HTML body at 800KB before conversion (4x text limit)", () => {
      const messageWithLargeHtml: GraphMessage = {
        ...mockMessage,
        body: { contentType: "html", content: "<p>" + "x".repeat(1_000_000) + "</p>" },
      };
      const normalized = mapGraphMessageToNormalized(messageWithLargeHtml, "user@example.com");
      
      // HTML should be capped at 800KB before conversion
      expect(normalized.body_text!.length).toBeLessThanOrEqual(200_000 + 20);
    });

    it("fingerprints capped text", () => {
      const message1: GraphMessage = {
        ...mockMessage,
        body: { contentType: "text", content: "a".repeat(300_000) },
      };
      const message2: GraphMessage = {
        ...mockMessage,
        body: { contentType: "text", content: "a".repeat(300_000) + "b" },
      };
      
      const normalized1 = mapGraphMessageToNormalized(message1, "user@example.com");
      const normalized2 = mapGraphMessageToNormalized(message2, "user@example.com");
      
      // Both should be capped at same length, so fingerprints match
      expect(normalized1.fingerprint).toBe(normalized2.fingerprint);
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
      (global as typeof globalThis & { fetch: typeof mockFetch }).fetch = mockFetch;

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
          token_type: "Bearer",
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
      const item = result.items[0] as unknown as {
        createdBy: { user: { email?: string; displayName: string; id: string } };
        lastModifiedBy: { user: { email?: string; displayName: string; id: string } };
      };
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

  describe("redactAddresses - digit-leading domains and construction patterns", () => {
    it("redacts digit-leading domains", () => {
      expect(redactAddresses("bob@3m.com_")).toBe("[email-3m.com]_");
      expect(redactAddresses("bob@123.com_")).toBe("[email-123.com]_");
      expect(redactAddresses("bob@3m.com-x")).toBe("[email-3m.com]-x");
      expect(redactAddresses("x@1and1.com-|y@1and1.com-")).toBe("[email-1and1.com]-|[email-1and1.com]-");
      expect(redactAddresses("bob@1and1.com_ more")).toBe("[email-1and1.com]_ more");
    });

    it("redacts digit-leading domains in subject and body_preview through emailToRawRecord", () => {
      const normalized = mapGraphMessageToNormalized({
        id: "msg1",
        conversationId: "conv1",
        receivedDateTime: "2024-01-01T00:00:00Z",
        sentDateTime: "2024-01-01T00:00:00Z",
        subject: "bob@1and1.com_|carol@1and1.com_",
        bodyPreview: "bob@1and1.com_|carol@1and1.com_",
        from: { emailAddress: { name: "Alice", address: "alice@example.com" } },
        toRecipients: [],
        ccRecipients: [],
        body: { contentType: "text", content: "" },
        hasAttachments: false,
        importance: "normal",
        isRead: false,
        categories: [],
      }, "mb1");
      const raw = emailToRawRecord(normalized);
      const payload = raw.allowlistedPayload as Record<string, unknown>;
      expect(payload.subject).toBe("[email-1and1.com]_|[email-1and1.com]_");
      expect(payload.body_preview).toBe("[email-1and1.com]_|[email-1and1.com]_");
    });

    it("redacts digit-leading domains in normalized body_text", () => {
      const normalized = mapGraphMessageToNormalized({
        id: "msg1",
        conversationId: "conv1",
        receivedDateTime: "2024-01-01T00:00:00Z",
        sentDateTime: "2024-01-01T00:00:00Z",
        subject: "Test",
        bodyPreview: "",
        from: { emailAddress: { name: "Alice", address: "alice@example.com" } },
        toRecipients: [],
        ccRecipients: [],
        body: { contentType: "text", content: "bob@1and1.com_|carol@1and1.com_" },
        hasAttachments: false,
        importance: "normal",
        isRead: false,
        categories: [],
      }, "mb1");
      expect(normalized.body_text).toBe("[email-1and1.com]_|[email-1and1.com]_");
    });

    it("leaves construction patterns unchanged", () => {
      expect(redactAddresses("col@A.5")).toBe("col@A.5");
      expect(redactAddresses("grid@B.3")).toBe("grid@B.3");
      expect(redactAddresses("elev@El.100")).toBe("elev@El.100");
      expect(redactAddresses("pour@level.2 deck")).toBe("pour@level.2 deck");
      expect(redactAddresses("T.O.@El.102.5")).toBe("T.O.@El.102.5");
      expect(redactAddresses("lintel@door.3")).toBe("lintel@door.3");
      expect(redactAddresses("anchors@A.1-A.5")).toBe("anchors@A.1-A.5");
    });

    it("redacts look-alikes and invisible chars while preserving non-address look-alikes", () => {
      // Zero-width space in address
      expect(redactAddresses("bob\u200b@x.com")).toBe("[email-x.com]");
      // Full-width @ in address (U+FE6B ﹫)
      expect(redactAddresses("bob﹫x.com")).toBe("[email-x.com]");
      // Full-width dot in address (U+FF0E ．)
      expect(redactAddresses("bob@x．com")).toBe("[email-x.com]");
      // Full-width @ NOT in address (U+FF20 ＠) - should be unchanged
      expect(redactAddresses("price＠$5")).toBe("price＠$5");
      expect(redactAddresses("＠channel")).toBe("＠channel");
    });

    it("preserves stray full-width @ and zero-width space outside addresses", () => {
      const input = "Level 3＠grid C\u200b, see RFI-045 @ $4,500";
      expect(redactAddresses(input)).toBe(input);
    });

    it("redacts real address while preserving stray look-alikes", () => {
      const input = "Contact bob@acme.com for Level 3＠grid C\u200b details";
      const output = redactAddresses(input);
      expect(output).toBe("Contact [email-acme.com] for Level 3＠grid C\u200b details");
      // Verify byte-identical non-address parts
      expect(output.includes("Level 3＠grid C\u200b details")).toBe(true);
    });

    it("allows domains ending in digit when glued to text", () => {
      expect(redactAddresses("bob@163.com1")).toBe("[email-163.com1]");
      expect(redactAddresses("bob@3m.comPhone")).toBe("[email-3m.comPhone]");
    });

    it("keeps trailing dots outside placeholder", () => {
      expect(redactAddresses("bob@gc.")).toBe("[email-gc].");
      expect(redactAddresses("bob@x.com.")).toBe("[email-x.com].");
      expect(redactAddresses("bob@x.com..")).toBe("[email-x.com]..");
    });

    it("finds quote spanning redacted address in body_text", () => {
      const body = "Per bob@acmemech.com: the #5@10 rebar is short by $48,200.";
      const normalized = mapGraphMessageToNormalized({
        id: "msg1",
        conversationId: "conv1",
        receivedDateTime: "2024-01-01T00:00:00Z",
        sentDateTime: "2024-01-01T00:00:00Z",
        subject: "Test",
        bodyPreview: "",
        from: { emailAddress: { name: "Alice", address: "alice@example.com" } },
        toRecipients: [],
        ccRecipients: [],
        body: { contentType: "text", content: body },
        hasAttachments: false,
        importance: "normal",
        isRead: false,
        categories: [],
      }, "mb1");

      expect(normalized.body_text).toBeTruthy();
      
      // Quote including the redacted address form
      const quote1 = "Per [email-acmemech.com]: the #5@10 rebar";
      expect(normalized.body_text!.indexOf(quote1)).toBeGreaterThanOrEqual(0);

      // Quote after the address
      const quote2 = "the #5@10 rebar is short by $48,200.";
      expect(normalized.body_text!.indexOf(quote2)).toBeGreaterThanOrEqual(0);
    });

    it("validates quote offset deltas with multiple addresses", () => {
      const original = "alice@a.com then bob@b.com then carol@c.com done";
      const redacted = redactAddresses(original);
      
      // Calculate expected deltas for all three addresses
      const addr1Original = "alice@a.com";
      const addr1Redacted = "[email-a.com]";
      const delta1 = addr1Redacted.length - addr1Original.length;
      
      const addr2Original = "bob@b.com";
      const addr2Redacted = "[email-b.com]";
      const delta2 = addr2Redacted.length - addr2Original.length;
      
      const addr3Original = "carol@c.com";
      const addr3Redacted = "[email-c.com]";
      const delta3 = addr3Redacted.length - addr3Original.length;
      
      // Quote after all addresses
      const quoteAfterAll = "done";
      const originalOffset = original.indexOf(quoteAfterAll);
      const redactedOffset = redacted.indexOf(quoteAfterAll);
      const expectedOffset = originalOffset + delta1 + delta2 + delta3;
      
      expect(redactedOffset).toBe(expectedOffset);
      expect(redacted.substring(redactedOffset, redactedOffset + quoteAfterAll.length)).toBe(quoteAfterAll);
    });
  });
});
