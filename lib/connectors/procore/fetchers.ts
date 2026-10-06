/**
 * Typed Procore API fetchers for RFIs and Submittals.
 * Handles pagination, filtering, and ID-only listings for deletion detection.
 */

import type { ProcoreClient } from "./client";
import type { ProcoreRFI, ProcoreSubmittal, ProcoreProject } from "./types";
import { mapProcoreRFIToNormalized, mapProcoreSubmittalToNormalized } from "./mappers";
import type { NormalizedRFI, NormalizedSubmittal } from "../types";

export interface FetchOptions {
  /**
   * ISO-8601 timestamp for incremental sync.
   * Uses Procore's filters[updated_at] parameter.
   */
  updatedSince?: string;
  
  /**
   * Include only deleted records (for deletion detection).
   */
  deletedOnly?: boolean;
  
  /**
   * Maximum results per page (default 100).
   */
  perPage?: number;
}

/**
 * Fetch all projects for the configured company.
 */
export async function fetchProjects(
  client: ProcoreClient
): Promise<ProcoreProject[]> {
  const projects: ProcoreProject[] = [];
  
  for await (const page of client.paginate<ProcoreProject>(
    "/rest/v1.1/projects",
    { company_id: client["config"].companyId }
  )) {
    projects.push(...page);
  }
  
  return projects;
}

/**
 * Fetch RFIs for a project with optional filtering.
 * Returns normalized SiteTech RFIs.
 */
export async function* fetchRFIs(
  client: ProcoreClient,
  projectId: string,
  options: FetchOptions = {}
): AsyncIterable<NormalizedRFI[]> {
  const params: Record<string, string | number> = {};
  
  if (options.updatedSince) {
    // Add 15-minute overlap for safety as per evaluation doc
    const since = new Date(
      new Date(options.updatedSince).getTime() - 15 * 60 * 1000
    ).toISOString();
    params["filters[updated_at]"] = `${since}...${new Date().toISOString()}`;
  }
  
  if (options.deletedOnly) {
    params["filters[include_deleted]"] = "only";
  }
  
  const endpoint = `/rest/v1.0/projects/${projectId}/rfis`;
  
  for await (const page of client.paginate<ProcoreRFI>(
    endpoint,
    params,
    options.perPage ?? 100
  )) {
    const normalized = page.map((rfi) =>
      mapProcoreRFIToNormalized(rfi, endpoint)
    );
    yield normalized;
  }
}

/**
 * List all RFI IDs for a project (for deletion detection).
 * Returns only string IDs for efficient comparison.
 */
export async function listRFIIds(
  client: ProcoreClient,
  projectId: string
): Promise<string[]> {
  const ids: string[] = [];
  
  for await (const page of client.paginate<ProcoreRFI>(
    `/rest/v1.0/projects/${projectId}/rfis`,
    {},
    1000 // Higher page size for ID-only fetches
  )) {
    ids.push(...page.map((rfi) => String(rfi.id)));
  }
  
  return ids;
}

/**
 * Fetch Submittals for a project with optional filtering.
 * Returns normalized SiteTech Submittals.
 */
export async function* fetchSubmittals(
  client: ProcoreClient,
  projectId: string,
  options: FetchOptions = {}
): AsyncIterable<NormalizedSubmittal[]> {
  const params: Record<string, string | number> = {};
  
  if (options.updatedSince) {
    const since = new Date(
      new Date(options.updatedSince).getTime() - 15 * 60 * 1000
    ).toISOString();
    params["filters[updated_at]"] = `${since}...${new Date().toISOString()}`;
  }
  
  if (options.deletedOnly) {
    params["filters[include_deleted]"] = "only";
  }
  
  const endpoint = `/rest/v1.1/projects/${projectId}/submittals`;
  
  for await (const page of client.paginate<ProcoreSubmittal>(
    endpoint,
    params,
    options.perPage ?? 100
  )) {
    const normalized = page.map((submittal) =>
      mapProcoreSubmittalToNormalized(submittal, endpoint)
    );
    yield normalized;
  }
}

/**
 * List all Submittal IDs for a project (for deletion detection).
 */
export async function listSubmittalIds(
  client: ProcoreClient,
  projectId: string
): Promise<string[]> {
  const ids: string[] = [];
  
  for await (const page of client.paginate<ProcoreSubmittal>(
    `/rest/v1.1/projects/${projectId}/submittals`,
    {},
    1000
  )) {
    ids.push(...page.map((submittal) => String(submittal.id)));
  }
  
  return ids;
}
