/**
 * Microsoft Graph message mappers.
 * Maps Graph API messages to normalized SiteTech email records.
 */

import { createHash } from "crypto";
import { canonicalStringify } from "../shared/canonical-stringify";
import type { NormalizedEmail, RawRecord } from "../types";
import type { GraphMessage } from "./types";

/**
 * Map Graph message to normalized SiteTech email.
 * Preserves receivedDateTime and sentDateTime as ISO UTC strings.
 */
export function mapGraphMessageToNormalized(
  message: GraphMessage,
  mailbox: string
): NormalizedEmail {
  const allowlistedFields = {
    id: message.id,
    conversationId: message.conversationId,
    subject: message.subject,
    bodyPreview: message.bodyPreview,
    from: message.from,
    toRecipients: message.toRecipients,
    ccRecipients: message.ccRecipients,
    receivedDateTime: message.receivedDateTime,
    sentDateTime: message.sentDateTime,
    hasAttachments: message.hasAttachments,
    importance: message.importance,
    isRead: message.isRead,
    categories: message.categories,
  };

  const fingerprint = createHash("sha256")
    .update(canonicalStringify(allowlistedFields))
    .digest("hex");

  return {
    entity_type: "email",
    external_id: message.id,
    fingerprint,
    
    source_mailbox: mailbox,
    
    subject: message.subject,
    body_preview: message.bodyPreview,
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
    is_read: message.isRead,
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
