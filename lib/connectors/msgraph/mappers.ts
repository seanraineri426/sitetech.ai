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
import { redactAddresses } from "../../redact/addresses";

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
 * Pre-cap text at max length with whitespace/tag boundary cutting.
 * Cuts on whitespace boundary (look back up to 512 chars) to avoid splitting addresses.
 * For text with no whitespace, backs off past address-like tokens.
 * Checks for surrogate pairs at boundary.
 * Does NOT append truncation marker (used before redaction).
 * 
 * @param text - Text to cap
 * @param maxChars - Maximum length
 * @param isHtml - If true, prefer cutting after '>' tag boundary
 * @returns Capped text
 */
function preCapText(text: string, maxChars: number, isHtml = false): string {
  if (text.length <= maxChars) {
    return text;
  }
  
  let cutPos = maxChars;
  
  // For HTML, try to cut after last '>' before limit
  if (isHtml) {
    const searchStart = Math.max(0, cutPos - 512);
    let lastTagClose = -1;
    for (let i = cutPos - 1; i >= searchStart; i--) {
      if (text[i] === '>') {
        lastTagClose = i + 1;
        break;
      }
    }
    if (lastTagClose !== -1) {
      cutPos = lastTagClose;
    } else {
      // No '>' found, fall through to text rules
    }
  }
  
  // Look back up to 512 chars for the last whitespace
  if (!isHtml || cutPos === maxChars) {
    const searchStart = Math.max(0, cutPos - 512);
    let lastWhitespace = -1;
    for (let i = cutPos - 1; i >= searchStart; i--) {
      const char = text[i];
      if (char === ' ' || char === '\t' || char === '\n' || char === '\r') {
        lastWhitespace = i;
        break;
      }
    }
    
    if (lastWhitespace !== -1) {
      cutPos = lastWhitespace;
    } else {
      // No whitespace within 512 chars - back off past any address-like token
      // Find start of token containing '@' or address characters at/near cut
      let tokenStart = cutPos;
      const addressChar = /[\p{L}\p{N}._%+\-@\p{Cf}]/u;
      
      // Scan backward from cut to find start of address-like token
      for (let i = cutPos - 1; i >= Math.max(0, cutPos - 1024); i--) {
        if (addressChar.test(text[i])) {
          tokenStart = i;
        } else {
          // Found non-address char, stop
          break;
        }
      }
      
      // Cut before the token if we found one
      if (tokenStart < cutPos) {
        cutPos = tokenStart;
      }
    }
  }
  
  // Check if we're about to split a surrogate pair
  if (cutPos > 0) {
    const charCode = text.charCodeAt(cutPos - 1);
    if (charCode >= 0xD800 && charCode <= 0xDBFF) {
      cutPos--;
    }
  }
  
  return text.slice(0, cutPos);
}

/**
 * Cap text at max length and append truncation marker.
 * Checks for surrogate pairs at boundary to avoid splitting them.
 * If cut point falls inside [email-...] placeholder, moves cut back before '['.
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
  
  // Check if cut point falls inside a [email-...] placeholder
  // Use lastIndexOf('[email-', cutPos) to find placeholder start (handles domains > 253 chars)
  const lastEmailStart = text.lastIndexOf('[email-', cutPos);
  
  if (lastEmailStart !== -1) {
    // Found a placeholder start before cut, check if it closes before cutPos
    const closeIndex = text.indexOf(']', lastEmailStart + 7);
    if (closeIndex === -1 || closeIndex >= cutPos) {
      // No close bracket, or it's at/after our cut point - move cut before '['
      cutPos = lastEmailStart;
    }
  }
  
  return text.slice(0, cutPos) + ' [truncated]';
}

/**
 * Extract body text from Graph message body.
 * Converts HTML to text if content type is HTML.
 * Pre-caps at 4x limit with whitespace/tag boundary before processing.
 * Strips null bytes but does NOT append truncation marker (caller must cap after redaction).
 * 
 * @returns Object with text and truncated flag, or null
 */
function extractBodyText(body: GraphMessage["body"]): { text: string; truncated: boolean } | null {
  if (!body?.content) {
    return null;
  }

  let text: string;
  let truncated = false;

  if (body.contentType === "text") {
    // Pre-cap text at 4x limit with whitespace boundary (before strip/redact)
    const originalLength = body.content.length;
    text = preCapText(body.content, MAX_BODY_CHARS * 4, false);
    truncated = text.length < originalLength;
  } else {
    // Cap raw HTML at 4x the text limit before conversion (tag boundary)
    const originalLength = body.content.length;
    const cappedHtml = preCapText(body.content, MAX_BODY_CHARS * 4, true);
    truncated = cappedHtml.length < originalLength;
    text = htmlToText(cappedHtml);
  }

  // Strip null bytes
  text = stripNullBytes(text);

  // Note: Final capping with truncation marker happens AFTER redaction in the mapper
  return { text, truncated };
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
 * Map Graph message to normalized SiteTech email.
 * Raw email addresses are stored in from/to/cc fields only.
 * All text fields (subject, body_preview, body_text) are redacted.
 * 
 * CTO 2026-10-09: Extract full body text including quoted reply history.
 * CTO 2026-10-09 (updated): Redact addresses in stored body_text too.
 */
export function mapGraphMessageToNormalized(
  message: GraphMessage,
  mailbox: string
): NormalizedEmail {
  // Extract body text (null bytes stripped, pre-capped if > 4x limit)
  const bodyResult = extractBodyText(message.body);
  
  // Redact addresses in all text fields BEFORE final capping
  const redactedSubject = redactAddresses(message.subject);
  const redactedBodyPreview = redactAddresses(message.bodyPreview);
  let redactedBodyText = bodyResult ? redactAddresses(bodyResult.text) : null;
  
  // Cap body text AFTER redaction (so placeholder-aware cut works)
  // If pre-cap already truncated, append marker even if under MAX_BODY_CHARS
  if (redactedBodyText) {
    if (redactedBodyText.length > MAX_BODY_CHARS) {
      redactedBodyText = capText(redactedBodyText, MAX_BODY_CHARS);
    } else if (bodyResult && bodyResult.truncated) {
      // Pre-cap fired but result is under MAX_BODY_CHARS - still needs marker
      redactedBodyText = redactedBodyText + ' [truncated]';
    }
  }
  
  // Fingerprint uses redacted body text
  const fingerprintPayload = buildEmailFingerprintPayload(message, redactedBodyText);
  const fingerprint = createHash("sha256")
    .update(canonicalStringify(fingerprintPayload))
    .digest("hex");

  return {
    entity_type: "email",
    external_id: message.id,
    fingerprint,
    
    source_mailbox: mailbox,
    
    subject: redactedSubject,
    body_preview: redactedBodyPreview,
    body_text: redactedBodyText,
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
 * CTO 2026-10-09: Store body_text_sha256 of redacted body_text (NOT body_text itself).
 * Store participant domains only (NOT raw addresses) in allowlistedPayload.
 * Text fields (subject, body_preview, body_text) are already redacted in normalized email.
 */
export function emailToRawRecord(email: NormalizedEmail): RawRecord {
  // Compute body_text_sha256 from already-redacted body_text
  const bodyTextSha256 = email.body_text
    ? createHash('sha256').update(email.body_text).digest('hex')
    : null;

  // Extract participant domains
  const fromDomain = email.from ? extractDomain(email.from.address) : null;
  const toDomains = email.to_recipients.map(r => extractDomain(r.address)).sort();
  const ccDomains = email.cc_recipients.map(r => extractDomain(r.address)).sort();

  return {
    entityType: "email",
    externalId: email.external_id,
    allowlistedPayload: {
      // Already redacted in normalized email
      subject: email.subject,
      body_preview: email.body_preview,
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

// Re-export for backward compatibility with existing tests
export { redactAddresses };
