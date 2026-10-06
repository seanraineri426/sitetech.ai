/**
 * Microsoft Graph API response types (allowlist-aligned).
 */

export interface GraphMessage {
  id: string;
  conversationId: string;
  subject: string;
  bodyPreview: string;
  from: {
    emailAddress: {
      name: string;
      address: string;
    };
  };
  toRecipients: Array<{
    emailAddress: {
      name: string;
      address: string;
    };
  }>;
  ccRecipients: Array<{
    emailAddress: {
      name: string;
      address: string;
    };
  }>;
  receivedDateTime: string;
  sentDateTime: string;
  hasAttachments: boolean;
  importance: "low" | "normal" | "high";
  isRead: boolean;
  categories: string[];
}

export const MESSAGE_ALLOWLIST = [
  "id",
  "conversationId",
  "subject",
  "bodyPreview",
  "from",
  "toRecipients",
  "ccRecipients",
  "receivedDateTime",
  "sentDateTime",
  "hasAttachments",
  "importance",
  "isRead",
  "categories",
] as const;

export interface GraphDriveItem {
  id: string;
  name: string;
  webUrl: string;
  size: number;
  createdDateTime: string;
  lastModifiedDateTime: string;
  createdBy: {
    user: {
      displayName: string;
      email: string;
    };
  };
  lastModifiedBy: {
    user: {
      displayName: string;
      email: string;
    };
  };
  file?: {
    mimeType: string;
    hashes: {
      sha256Hash?: string;
    };
  };
  folder?: {
    childCount: number;
  };
  parentReference: {
    driveId: string;
    id: string;
    path: string;
  };
  deleted?: {
    state: string;
  };
}

export const DRIVEITEM_ALLOWLIST = [
  "id",
  "name",
  "webUrl",
  "size",
  "createdDateTime",
  "lastModifiedDateTime",
  "createdBy",
  "lastModifiedBy",
  "file",
  "folder",
  "parentReference",
  "deleted",
] as const;

export interface GraphSite {
  id: string;
  displayName: string;
  webUrl: string;
  createdDateTime: string;
}

export interface GraphMailFolder {
  id: string;
  displayName: string;
  parentFolderId: string | null;
  childFolderCount: number;
  unreadItemCount: number;
  totalItemCount: number;
}
