/**
 * Microsoft Graph message mappers.
 * Maps Graph API messages to normalized SiteTech email records.
 * 
 * CTO Decision (2026-10-07):
 * - Email addresses ARE stored (from/to/cc) - approved for email records only
 * - Email addresses are NOT fingerprinted as content (change signal)
 * - Fingerprint: message id + received_at + subject + body preview + participant domains + categories
 * - Exclude isRead from fingerprint (read status is not content)
 * - Model layer will map addresses to company+role; we store them under RLS + 30-day purge
 */

import { createHash } from "crypto";
import { canonicalStringify } from "../shared/canonical-stringify";
import type { NormalizedEmail, RawRecord } from "../types";
import type { GraphMessage } from "./types";

/**
 * Extract domain from email address for fingerprinting.
 * Returns domain only, not the full address.
 */
function extractDomain(address: string): string {
  const atIndex = address.indexOf("@");
  return atIndex >= 0 ? address.substring(atIndex + 1).toLowerCase() : "";
}

/**
 * Build fingerprint payload for email.
 * Includes message identity, content, and participant domains (NOT full addresses).
 * Excludes isRead (read status is not content).
 */
function buildEmailFingerprintPayload(message: GraphMessage): Record<string, unknown> {
  return {
    id: message.id,
    conversationId: message.conversationId,
    subject: message.subject,
    bodyPreview: message.bodyPreview,
    receivedDateTime: message.receivedDateTime,
    sentDateTime: message.sentDateTime,
    hasAttachments: message.hasAttachments,
    importance: message.importance,
    categories: message.categories,
    // Participant domains only, NOT full addresses
    fromDomain: extractDomain(message.from.emailAddress.address),
    toDomains: message.toRecipients.map((r) => extractDomain(r.emailAddress.address)).sort(),
    ccDomains: message.ccRecipients.map((r) => extractDomain(r.emailAddress.address)).sort(),
  };
}

/**
 * Map Graph message to normalized SiteTech email.
 * Raw email addresses are stored but NOT fingerprinted as content.
 */
export function mapGraphMessageToNormalized(
  message: GraphMessage,
  mailbox: string
): NormalizedEmail {
  const fingerprintPayload = buildEmailFingerprintPayload(message);
  const fingerprint = createHash("sha256")
    .update(canonicalStringify(fingerprintPayload))
    .digest("hex");

  return {
    entity_type: "email",
    external_id: message.id,
    fingerprint,
    
    source_mailbox: mailbox,
    
    subject: message.subject,
    body_preview: message.bodyPreview,
    // Raw addresses stored (CTO approved for email records only)
    from: {
      name: message.from.emailAddress.name,
      address: message.from.emailAddress.address,
    },
    to_recipients: message.toRecipients.map((r) => ({
      name: r.emailAddress.name,
      address: r.emailAddress.address,
    })),
    cc_recipients: message.ccRecipients.map((r) => ({
      name: r.emailAddress.name,
      address: r.emailAddress.address,
    })),
    
    // Keep as ISO UTC strings
    received_at: message.receivedDateTime,
    sent_at: message.sentDateTime,
    received_at_source: "graph",
    
    has_attachments: message.hasAttachments,
    importance: message.importance,
    is_read: message.isRead, // Stored but not fingerprinted
    categories: message.categories,
    conversation_id: message.conversationId,
  };
}

/**
 * Convert normalized email to raw record shape for storage layer.
 */
export function emailToRawRecord(email: NormalizedEmail): RawRecord {
  return {
    entityType: "email",
    externalId: email.external_id,
    allowlistedPayload: {
      subject: email.subject,
      body_preview: email.body_preview,
      from: email.from,
      to_recipients: email.to_recipients,
      cc_recipients: email.cc_recipients,
      received_at: email.received_at,
      sent_at: email.sent_at,
      received_at_source: email.received_at_source,
      has_attachments: email.has_attachments,
      importance: email.importance,
      is_read: email.is_read,
      categories: email.categories,
      conversation_id: email.conversation_id,
    },
    fingerprint: email.fingerprint,
  };
}

/**
 * Strip email addresses from DriveItem user objects before storage/fingerprint.
 * CTO Decision (2026-10-07): createdBy.user.email and lastModifiedBy.user.email DROPPED.
 * Returns only {displayName, id}.
 */
export function stripDriveItemEmails(item: Record<string, unknown>): Record<string, unknown> {
  const result = { ...item };
  
  if (result.createdBy && typeof result.createdBy === "object" && "user" in result.createdBy) {
    const user = (result.createdBy as { user: Record<string, unknown> }).user;
    result.createdBy = {
      user: {
        displayName: user.displayName,
        id: user.id,
      },
    };
  }
  
  if (result.lastModifiedBy && typeof result.lastModifiedBy === "object" && "user" in result.lastModifiedBy) {
    const user = (result.lastModifiedBy as { user: Record<string, unknown> }).user;
    result.lastModifiedBy = {
      user: {
        displayName: user.displayName,
        id: user.id,
      },
    };
  }
  
  return result;
}
