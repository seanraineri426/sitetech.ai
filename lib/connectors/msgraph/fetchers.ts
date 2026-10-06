/**
 * Microsoft Graph fetchers for Mail and SharePoint delta sync.
 * Yields page by page with resumable checkpoints.
 */

import type { GraphClient } from "./client";
import type { GraphMessage, GraphDriveItem, GraphMailFolder } from "./types";
import { MESSAGE_ALLOWLIST, DRIVEITEM_ALLOWLIST } from "./types";

export interface MailDeltaPage {
  messages: GraphMessage[];
  removed: string[];
  checkpoint: {
    nextLink?: string;
    deltaLink?: string;
  };
}

export interface DriveDeltaPage {
  items: GraphDriveItem[];
  removed: string[];
  checkpoint: {
    nextLink?: string;
    deltaLink?: string;
  };
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
 * Delta sync for a single mail folder.
 * Returns page with checkpoint for resumption.
 */
export async function fetchMailFolderDelta(
  client: GraphClient,
  mailbox: string,
  folderId: string,
  checkpoint?: string
): Promise<MailDeltaPage> {
  const selectFields = MESSAGE_ALLOWLIST.join(",");
  const path = `/users/${encodeURIComponent(mailbox)}/mailFolders/${folderId}/messages`;

  const result = await client.delta<GraphMessage>(
    path,
    checkpoint,
    selectFields
  );

  return {
    messages: result.items,
    removed: result.removed,
    checkpoint: {
      nextLink: result.nextLink,
      deltaLink: result.deltaLink,
    },
  };
}

/**
 * Delta sync for SharePoint drive.
 * Returns page with checkpoint for resumption.
 */
export async function fetchDriveDelta(
  client: GraphClient,
  siteId: string,
  checkpoint?: string
): Promise<DriveDeltaPage> {
  const selectFields = DRIVEITEM_ALLOWLIST.join(",");
  const path = `/sites/${encodeURIComponent(siteId)}/drive/root`;

  const result = await client.delta<GraphDriveItem>(
    path,
    checkpoint,
    selectFields
  );

  return {
    items: result.items,
    removed: result.removed,
    checkpoint: {
      nextLink: result.nextLink,
      deltaLink: result.deltaLink,
    },
  };
}

/**
 * Check if a 410 Gone error means resync is required.
 */
export function shouldResync(error: unknown): boolean {
  if (error instanceof Error) {
    return error.message.includes("410");
  }
  return false;
}
