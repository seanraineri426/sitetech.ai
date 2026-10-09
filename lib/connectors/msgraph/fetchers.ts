/**
 * Microsoft Graph fetchers for Mail and SharePoint delta sync.
 * Yields page by page with resumable checkpoints.
 */

import type { GraphClient } from "./client";
import type { GraphMessage, GraphDriveItem, GraphMailFolder } from "./types";
import { MESSAGE_ALLOWLIST, DRIVEITEM_ALLOWLIST, GraphMessageSchema } from "./types";

export interface MailDeltaPage {
  messages: GraphMessage[];
  removed: string[];
  checkpoint?: string; // nextLink while paging, deltaLink at the end
  skipped?: number; // Count of messages that failed schema validation
}

export interface DriveDeltaPage {
  items: GraphDriveItem[];
  removed: string[];
  checkpoint?: string; // nextLink while paging, deltaLink at the end
}

export async function fetchMailFolders(
  client: GraphClient,
  mailbox: string
): Promise<GraphMailFolder[]> {
  const folders: GraphMailFolder[] = [];

  for await (const page of client.paginate<GraphMailFolder>(
    `/users/${encodeURIComponent(mailbox)}/mailFolders`
  )) {
    folders.push(...page);
  }

  return folders;
}

/**
 * Delta sync for a single mail folder - ONE page at a time.
 * Returns page with checkpoint for resumption.
 * The caller drives the loop page-by-page.
 * 
 * Sends Prefer header to request plain text body content.
 * Validates each message with GraphMessageSchema; skips invalid messages.
 */
export async function fetchMailFolderDelta(
  client: GraphClient,
  mailbox: string,
  folderId: string,
  checkpoint?: string
): Promise<MailDeltaPage> {
  const selectFields = MESSAGE_ALLOWLIST.join(",");
  const encodedMailbox = encodeURIComponent(mailbox);
  const encodedFolderId = encodeURIComponent(folderId);
  const path = `/users/${encodedMailbox}/mailFolders/${encodedFolderId}/messages`;

  const result = await client.delta<GraphMessage>(
    path,
    checkpoint,
    selectFields,
    true // preferBodyText
  );

  // Validate and filter messages
  const validMessages: GraphMessage[] = [];
  let skipped = 0;

  for (const item of result.items) {
    const parseResult = GraphMessageSchema.safeParse(item);
    if (parseResult.success) {
      validMessages.push(parseResult.data);
    } else {
      skipped++;
    }
  }

  return {
    messages: validMessages,
    removed: result.removed,
    checkpoint: result.checkpoint,
    skipped: skipped > 0 ? skipped : undefined,
  };
}

/**
 * Delta sync for SharePoint drive - ONE page at a time.
 * Returns page with checkpoint for resumption.
 * The caller drives the loop page-by-page.
 */
export async function fetchDriveDelta(
  client: GraphClient,
  siteId: string,
  checkpoint?: string
): Promise<DriveDeltaPage> {
  const selectFields = DRIVEITEM_ALLOWLIST.join(",");
  const encodedSiteId = encodeURIComponent(siteId);
  const path = `/sites/${encodedSiteId}/drive/root`;

  const result = await client.delta<GraphDriveItem>(
    path,
    checkpoint,
    selectFields
  );

  // Import stripDriveItemEmails from mappers
  const { stripDriveItemEmails } = await import("./mappers");

  return {
    items: result.items.map((item) => stripDriveItemEmails(item) as GraphDriveItem),
    removed: result.removed,
    checkpoint: result.checkpoint,
  };
}

/**
 * Check if a 410 Gone error means resync is required.
 * Detects by HTTP status code (not error message text).
 */
export function shouldResync(error: unknown): boolean {
  // Check for status property (typed errors from client)
  if (error && typeof error === "object" && "status" in error) {
    return (error as { status: number }).status === 410;
  }
  return false;
}
