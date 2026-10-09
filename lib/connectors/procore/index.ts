/**
 * Procore connector public API.
 */

export { ProcoreClient, createProcoreClient } from "./client";
export type { ProcoreConfig, ProcoreResponse } from "./client";
export type { ProcoreRFI, ProcoreSubmittal, ProcoreProject } from "./types";
export {
  mapProcoreRFIToNormalized,
  mapProcoreSubmittalToNormalized,
  generateFingerprint,
  rfiToRawRecord,
  submittalToRawRecord,
  RFI_ALLOWLIST,
  SUBMITTAL_ALLOWLIST,
} from "./mappers";
export {
  fetchProjects,
  fetchRFIs,
  listRFIIds,
  fetchSubmittals,
  listSubmittalIds,
} from "./fetchers";
export type { FetchOptions } from "./fetchers";
