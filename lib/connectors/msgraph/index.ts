/**
 * Microsoft Graph connector public API.
 */

export { GraphClient, createGraphClient } from "./client";
export type { GraphConfig, GraphResponse, DeltaResult } from "./client";
export type {
  GraphMessage,
  GraphDriveItem,
  GraphSite,
  GraphMailFolder,
} from "./types";
export { MESSAGE_ALLOWLIST, DRIVEITEM_ALLOWLIST } from "./types";
export {
  GraphMessageSchema,
  GraphDriveItemSchema,
  GraphSiteSchema,
  GraphMailFolderSchema,
} from "./types";
export {
  fetchMailFolders,
  fetchMailFolderDelta,
  fetchDriveDelta,
  shouldResync,
} from "./fetchers";
export type {
  MailDeltaPage,
  DriveDeltaPage,
} from "./fetchers";
export {
  mapGraphMessageToNormalized,
  emailToRawRecord,
} from "./mappers";
