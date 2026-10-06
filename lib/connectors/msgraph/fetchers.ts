/**
 * Microsoft Graph fetchers for Mail and SharePoint delta sync.
 * Implements per-folder mail delta and drive delta with state management.
 */

import type { GraphClient } from "./client";
import type { GraphMessage, GraphDriveItem, GraphMailFolder } from "./types";
import { MESSAGE_ALLOWLIST, DRIVEITEM_ALLOWLIST } from "./types";

export interface DeltaState {
  [key: string]: string; // folder/drive ID -> deltaLink
}

export interface MailDeltaResult {
  messages: GraphMessage[];
  removed: string[];
  nextDeltaLink: string;
}

export interface DriveDeltaResult {
  items: GraphDriveItem[];
  removed: string[];
  nextDeltaLink: string;
}

/**
 * Fetch mail folders for a mailbox.
 */
export async function fetchMailFolders(
  client: GraphClient,
  mailbox: string
): Promise<GraphMailFolder[]> {
  const folders: GraphMailFolder[] = [];
  
  for await (const page of client.paginate<GraphMailFolder>(
    `/users/${mailbox}/mailFolders`
  )) {
    folders.push(...page);
  }
  
  return folders;
}

/**
 * Delta sync for a single mail folder.
 * 
 * @param client Graph client
 * @param mailbox UPN or alias
 * @param folderId Folder ID (or 'inbox', 'sentitems')
 * @param deltaLink Previous deltaLink from last sync (optional)
 * @returns Messages, removed IDs, and new deltaLink
 */
export async function fetchMailFolderDelta(
  client: GraphClient,
  mailbox: string,
  folderId: string,
  deltaLink?: string
): Promise<MailDeltaResult> {
  const path = `/users/${mailbox}/mailFolders/${folderId}/messages`;
  
  // Use $select to only fetch allowlisted fields (no attachment content)
  const selectFields = MESSAGE_ALLOWLIST.join(",");
  
  const result = await client.delta<GraphMessage>(
    deltaLink ? "" : `${path}?$select=${selectFields}`,
    deltaLink
  );
  
  return {
    messages: result.items,
    removed: result.removed,
    nextDeltaLink: result.deltaLink,
  };
}

/**
 * Delta sync for multiple mail folders (Inbox + Sent Items).
 * Returns combined results with per-folder delta state.
 */
export async function fetchMailDelta(
  client: GraphClient,
  mailbox: string,
  deltaState: DeltaState = {}
): Promise<{
  messages: GraphMessage[];
  removed: string[];
  nextDeltaState: DeltaState;
}> {
  const folders = ["inbox", "sentitems"];
  const allMessages: GraphMessage[] = [];
  const allRemoved: string[] = [];
  const nextDeltaState: DeltaState = {};

  for (const folderId of folders) {
    const result = await fetchMailFolderDelta(
      client,
      mailbox,
      folderId,
      deltaState[folderId]
    );

    allMessages.push(...result.messages);
    allRemoved.push(...result.removed);
    nextDeltaState[folderId] = result.nextDeltaLink;
  }

  return {
    messages: allMessages,
    removed: allRemoved,
    nextDeltaState,
  };
}

/**
 * Delta sync for a SharePoint drive (Sites.Selected model).
 * 
 * @param client Graph client
 * @param siteId SharePoint site ID
 * @param deltaLink Previous deltaLink from last sync (optional)
 * @returns Drive items, removed IDs, and new deltaLink
 */
export async function fetchDriveDelta(
  client: GraphClient,
  siteId: string,
  deltaLink?: string
): Promise<DriveDeltaResult> {
  const path = `/sites/${siteId}/drive/root`;
  
  // Use $select to only fetch allowlisted fields (no file content)
  const selectFields = DRIVEITEM_ALLOWLIST.join(",");
  
  const result = await client.delta<GraphDriveItem>(
    deltaLink ? "" : `${path}?$select=${selectFields}`,
    deltaLink
  );
  
  return {
    items: result.items,
    removed: result.removed,
    nextDeltaLink: result.deltaLink,
  };
}

/**
 * Get the latest deltaLink without fetching all items (token=latest).
 * Useful for initializing delta state.
 */
export async function getLatestDeltaLink(
  client: GraphClient,
  path: string
): Promise<string> {
  const url = `${path}/delta?$deltaToken=latest`;
  const response = await client.get<never>(url);
  return response["@odata.deltaLink"] || "";
}

/**
 * Handle 410 Gone (resync required).
 * Clears delta state and starts fresh.
 */
export function shouldResync(error: unknown): boolean {
  if (error instanceof Error) {
    return error.message.includes("410");
  }
  return false;
}
