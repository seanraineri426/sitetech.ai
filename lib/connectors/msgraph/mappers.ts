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
 * Supports Unicode local parts and domains. Limits local part to 256 chars (RFC 5321 max).
 * Trailing lookahead allows sentence-ending periods but rejects addresses followed by dot+alnum.
 */
export function redactAddresses(text: string): string {
  // Build a 1:1 detection copy where look-alikes map to ASCII equivalents
  // U+FF20 ＠, U+FE6B ﹫ -> '@'
  // U+FF0E ．, U+3002 。, U+FF61 ｡ -> '.'
  // All are single UTF-16 code units, so indices line up
  const detection = text
    .replace(/[\uff20\ufe6b]/gu, '@')
    .replace(/[\uff0e\u3002\uff61]/gu, '.');
  
  // Quick check: if there's no '@', skip entirely for performance
  if (!detection.includes('@')) return text;
  
  // Track redaction spans: [start, end, replacement]
  const redactions: Array<[number, number, string]> = [];
  
  // Primary pattern: well-formed addresses with Unicode support
  // Include \p{Cf} (format/zero-width) and \p{M} (combining marks)
  const localPartChar = String.raw`[A-Z0-9._%+\-\p{L}\p{N}\p{Cf}\p{M}]`;
  const lookbehindChar = String.raw`[A-Z0-9._%+\-@\p{L}\p{N}\p{Cf}\p{M}]`;
  const domainChar = String.raw`[A-Z0-9\-\p{L}\p{N}\p{M}]`;
  const tldChar = String.raw`[A-Z\p{L}]`;
  const notAfterChar = String.raw`(?![A-Z_%\-\p{L}\p{N}\p{M}]|\.${domainChar})`;
  
  const primaryPattern = new RegExp(
    String.raw`(?<!${lookbehindChar})${localPartChar}{1,256}@(${domainChar}{1,63}(?:\.${domainChar}{1,63})*\.${tldChar}{2,63})${notAfterChar}`,
    'giu'
  );
  
  let match: RegExpExecArray | null;
  primaryPattern.lastIndex = 0;
  while ((match = primaryPattern.exec(detection)) !== null) {
    const domain = match[1];
    redactions.push([match.index, match.index + match[0].length, '[email-' + domain + ']']);
  }
  
  // Linear token-based fallback for remaining '@' (truncated, malformed, or adjacent addresses)
  if (detection.includes('@')) {
    // Split on whitespace, keeping separators
    const parts = detection.split(/(\s+)/u);
    let offset = 0;
    
    // Moving pointer for O(1) coverage check (redactions are sorted by start)
    let primaryIndex = 0;
    
    for (let i = 0; i < parts.length; i++) {
      const token = parts[i];
      if (token.trim() && token.includes('@')) {
        // Split token on any character outside [A-Za-z0-9._%+\-@] or Unicode letters/numbers/format/marks, keeping separators
        const piecePattern = /([^A-Za-z0-9._%+\-@\p{L}\p{N}\p{Cf}\p{M}])/u;
        const pieces = token.split(piecePattern);
        let tokenOffset = offset;
        
        for (let j = 0; j < pieces.length; j++) {
          const piece = pieces[j];
          if (piece.includes('@')) {
            // Find first '@' to check for local part
            const firstAtIndex = piece.indexOf('@');
            
            // Don't redact if '@' is at the start (like @channel) or no local part
            if (firstAtIndex > 0) {
              // Find last '@' for the domain
              const lastAtIndex = piece.lastIndexOf('@');
              
              // Extract valid domain characters after '@'
              // Domain chars: letters, numbers, dots, marks (no hyphen, no underscore)
              // Stops at hyphen so "3m.com-x" extracts "3m.com", but "3m.comPhone" extracts "3m.comPhone"
              const afterAt = piece.slice(lastAtIndex + 1);
              const domainMatch = afterAt.match(/^[A-Z0-9.\p{L}\p{N}\p{M}]+/iu);
              
              if (domainMatch) {
                const fullDomain = domainMatch[0];
                const domainEnd = lastAtIndex + 1 + fullDomain.length;
                
                // Check if this looks like a domain using Lead's tested logic
                const d = fullDomain.replace(/\.+$/u, '');
                const trailingDots = fullDomain.match(/\.+$/u)?.[0] || '';
                const labels = d.split('.');
                const isAtEnd = (i === parts.length - 1) && (j === pieces.length - 1);
                const dotted = labels.length > 1 && /^[\p{L}\p{N}]/u.test(d) &&
                  (/\.\p{L}{2}/u.test(d) || /\p{L}/u.test(labels[labels.length - 1]));
                const dotlessAtEnd = isAtEnd && labels.length === 1 && /^\p{L}/u.test(d);
                
                if (dotted || dotlessAtEnd) {
                  // Check if already covered by primary pattern using moving pointer
                  const addrStart = tokenOffset;
                  const addrEnd = tokenOffset + domainEnd;
                  
                  // Advance pointer to first redaction that could cover this address
                  while (primaryIndex < redactions.length && redactions[primaryIndex][1] < addrStart) {
                    primaryIndex++;
                  }
                  
                  // Check if current redaction covers this address
                  const alreadyCovered = primaryIndex < redactions.length &&
                    redactions[primaryIndex][0] <= addrStart &&
                    redactions[primaryIndex][1] >= addrEnd;
                  
                  if (!alreadyCovered) {
                    const replacement = '[email-' + d + ']' + trailingDots;
                    redactions.push([addrStart, addrEnd, replacement]);
                  }
                }
              }
            }
          }
          tokenOffset += piece.length;
        }
      }
      offset += token.length;
    }
  }
  
  // Sort redactions by start position and merge overlapping spans
  redactions.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number, string]> = [];
  for (const [start, end, replacement] of redactions) {
    if (merged.length === 0 || merged[merged.length - 1][1] < start) {
      merged.push([start, end, replacement]);
    } else {
      // Overlapping: keep the longer span
      const prev = merged[merged.length - 1];
      if (end > prev[1]) {
        prev[1] = end;
        prev[2] = replacement;
      }
    }
  }
  
  // Splice replacements into original text
  if (merged.length === 0) return text;
  
  let result = '';
  let pos = 0;
  for (const [start, end, replacement] of merged) {
    result += text.slice(pos, start) + replacement;
    pos = end;
  }
  result += text.slice(pos);
  
  return result;
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
  // Extract body text (null bytes stripped, capped)
  const bodyText = extractBodyText(message.body);
  
  // Redact addresses in all text fields
  const redactedSubject = redactAddresses(message.subject);
  const redactedBodyPreview = redactAddresses(message.bodyPreview);
  const redactedBodyText = bodyText ? redactAddresses(bodyText) : null;
  
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
