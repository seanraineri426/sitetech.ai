/**
 * Microsoft Graph API response types.
 * Based on Graph REST API v1.0 documentation.
 */

/**
 * Graph Message (email)
 */
export interface GraphMessage {
  id: string;
  conversationId: string;
  subject: string;
  bodyPreview: string;
  body: {
    contentType: "text" | "html";
    content: string;
  };
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

/**
 * Graph Message field allowlist (no attachment content).
 */
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

/**
 * Graph DriveItem (file/folder)
 */
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
}

/**
 * DriveItem field allowlist (no file content).
 */
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
] as const;

/**
 * Graph Site
 */
export interface GraphSite {
  id: string;
  displayName: string;
  webUrl: string;
  createdDateTime: string;
}

/**
 * Graph MailFolder
 */
export interface GraphMailFolder {
  id: string;
  displayName: string;
  parentFolderId: string | null;
  childFolderCount: number;
  unreadItemCount: number;
  totalItemCount: number;
}
