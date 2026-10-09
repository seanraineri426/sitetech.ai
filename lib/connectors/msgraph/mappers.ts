/**
 * Microsoft Graph message mappers.
 * Maps Graph API messages to normalized SiteTech email records.
 * 
 * CTO Decision (2026-10-07):
 * - Email addresses ARE stored (from/to/cc) - approved for email records only
 * - Email addresses are NOT fingerprinted as content (change signal)
 * - Fingerprint: message id + received_at + subject + body text + participant domains + categories
 * - Exclude isRead from fingerprint (read status is not content)
 * - Model layer will map addresses to company+role; we store them under RLS + 30-day purge
 * 
 * CTO Decision (2026-10-09):
 * - Store full email body as plain text including quoted reply history
 * - Use body_text (not bodyPreview) in fingerprint
 * - Request plain text via Prefer header; strip HTML if Graph returns HTML anyway
 * - Size cap: 200KB for body text, sha256 in raw records
 */

import { createHash } from "crypto";
import { canonicalStringify } from "../shared/canonical-stringify";
import type { NormalizedEmail, RawRecord } from "../types";
import type { GraphMessage } from "./types";
import { htmlToText } from "./html-to-text";

/**
 * Maximum body text size (200KB).
 * Raw HTML capped at 4x this before conversion.
 */
export const MAX_BODY_CHARS = 200_000;

/**
 * Extract domain from email address for fingerprinting.
 * Returns domain only, not the full address.
 */
function extractDomain(address: string): string {
  const atIndex = address.indexOf("@");
  return atIndex >= 0 ? address.substring(atIndex + 1).toLowerCase() : "";
}

/**
 * Strip null bytes from text.
 */
function stripNullBytes(text: string): string {
  return text.replace(/\u0000/g, '');
}

/**
 * Cap text at max length and append truncation marker.
 * Checks for surrogate pairs at boundary to avoid splitting them.
 */
function capText(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text;
  }
  
  // Check if we're about to split a surrogate pair
  let cutPos = maxChars;
  const charCode = text.charCodeAt(cutPos - 1);
  
  // If the last kept character is a high surrogate (0xD800-0xDBFF), cut one earlier
  if (charCode >= 0xD800 && charCode <= 0xDBFF) {
    cutPos--;
  }
  
  return text.slice(0, cutPos) + ' [truncated]';
}

/**
 * Extract body text from Graph message body.
 * Converts HTML to text if content type is HTML.
 * Strips null bytes, caps size at MAX_BODY_CHARS.
 */
function extractBodyText(body: GraphMessage["body"]): string | null {
  if (!body?.content) {
    return null;
  }

  let text: string;

  if (body.contentType === "text") {
    text = body.content;
  } else {
    // Cap raw HTML at 4x the text limit before conversion
    const cappedHtml = capText(body.content, MAX_BODY_CHARS * 4);
    text = htmlToText(cappedHtml);
  }

  // Strip null bytes
  text = stripNullBytes(text);

  // Cap output
  text = capText(text, MAX_BODY_CHARS);

  return text;
}

/**
 * Build fingerprint payload for email.
 * Includes message identity, content, and participant domains (NOT full addresses).
 * Excludes isRead (read status is not content).
 * 
 * CTO 2026-10-09: Use body_text (full body including quoted history) instead of bodyPreview.
 */
function buildEmailFingerprintPayload(
  message: GraphMessage,
  bodyText: string | null
): Record<string, unknown> {
  return {
    id: message.id,
    conversationId: message.conversationId,
    subject: message.subject,
    bodyText: bodyText,
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
 * Redact email addresses from text.
 * Replaces user@domain.com with [email-domain.com] to preserve domain while ensuring
 * the output doesn't match email regex patterns.
 * 
 * Currently used in emailToRawRecord to redact subject and body_preview before storage.
 * Also available for future model-facing paths.
 * 
 * Uses negative lookahead/lookbehind to avoid quadratic behavior on text with no '@'.
 * Limits local part to 256 chars (RFC 5321 max), domain labels to 63 chars, and TLD to 2-63 chars.
 * Relaxed trailing lookahead allows digits and underscores after the address.
 */
export function redactAddresses(text: string): string {
  // Quick check: if there's no '@', skip entirely for performance
  if (!text.includes('@')) return text;
  
  // Primary pattern: well-formed addresses (relaxed lookahead allows digits/underscores)
  let result = text.replace(
    /(?<![A-Z0-9._%+-])[A-Z0-9._%+-]{1,256}@([A-Z0-9-]{1,63}(?:\.[A-Z0-9-]{1,63})*\.[A-Z]{2,63})(?![A-Z._%-])/gi,
    '[email-$1]'
  );
  
  // Fallback: catch truncated or malformed addresses (e.g., "bob@gc.c" in previews)
  // Only runs if there are still '@' signs left after primary pass
  if (result.includes('@')) {
    result = result.replace(
      /\S*@\S*/g,
      (match) => {
        // If already redacted, leave it
        if (match.startsWith('[email-')) return match;
        // Otherwise redact, preserving any domain-like suffix
        const atIndex = match.indexOf('@');
        const domain = match.slice(atIndex + 1);
        return `[email-${domain}]`;
      }
    );
  }
  
  return result;
}

/**
 * Map Graph message to normalized SiteTech email.
 * Raw email addresses are stored but NOT fingerprinted as content.
 * 
 * CTO 2026-10-09: Extract full body text including quoted reply history.
 */
export function mapGraphMessageToNormalized(
  message: GraphMessage,
  mailbox: string
): NormalizedEmail {
  const bodyText = extractBodyText(message.body);
  const fingerprintPayload = buildEmailFingerprintPayload(message, bodyText);
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
    body_text: bodyText,
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
 * 
 * CTO 2026-10-09: Store body_text_sha256 (NOT body_text itself).
 * Store participant domains only (NOT raw addresses) in allowlistedPayload.
 * Redact addresses from subject and body_preview before storage.
 */
export function emailToRawRecord(email: NormalizedEmail): RawRecord {
  // Compute body_text_sha256
  const bodyTextSha256 = email.body_text
    ? createHash('sha256').update(email.body_text).digest('hex')
    : null;

  // Extract participant domains
  const fromDomain = email.from ? extractDomain(email.from.address) : null;
  const toDomains = email.to_recipients.map(r => extractDomain(r.address)).sort();
  const ccDomains = email.cc_recipients.map(r => extractDomain(r.address)).sort();

  // Redact addresses from subject and body_preview
  const redactedSubject = redactAddresses(email.subject);
  const redactedBodyPreview = redactAddresses(email.body_preview);

  return {
    entityType: "email",
    externalId: email.external_id,
    allowlistedPayload: {
      subject: redactedSubject,
      body_preview: redactedBodyPreview,
      body_text_sha256: bodyTextSha256,
      // Participant domains only (NOT raw addresses)
      from_domain: fromDomain,
      to_domains: toDomains,
      cc_domains: ccDomains,
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
