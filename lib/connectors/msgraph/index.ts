/**
 * Microsoft Graph connector public API.
 */

export { GraphClient, createGraphClient } from "./client";
export type { GraphConfig, GraphResponse, DeltaResponse } from "./client";
export type {
  GraphMessage,
  GraphDriveItem,
  GraphSite,
  GraphMailFolder,
  MESSAGE_ALLOWLIST,
  DRIVEITEM_ALLOWLIST,
} from "./types";
export {
  fetchMailFolders,
  fetchMailFolderDelta,
  fetchMailDelta,
  fetchDriveDelta,
  getLatestDeltaLink,
  shouldResync,
} from "./fetchers";
export type {
  DeltaState,
  MailDeltaResult,
  DriveDeltaResult,
} from "./fetchers";
