/**
 * Typed Procore API fetchers for RFIs and Submittals.
 */

import type { ProcoreClient } from "./client";
import type { ProcoreRFI, ProcoreSubmittal, ProcoreProject } from "./types";
import { mapProcoreRFIToNormalized, mapProcoreSubmittalToNormalized } from "./mappers";
import type { NormalizedRFI, NormalizedSubmittal } from "../types";

export interface FetchOptions {
  updatedSince?: string;
  deletedOnly?: boolean;
  perPage?: number;
}

export async function fetchProjects(
  client: ProcoreClient
): Promise<ProcoreProject[]> {
  const projects: ProcoreProject[] = [];
  
  for await (const page of client.paginate<ProcoreProject>(
    "/rest/v1.1/projects"
  )) {
    projects.push(...page);
  }
  
  return projects;
}

export async function* fetchRFIs(
  client: ProcoreClient,
  projectId: string,
  options: FetchOptions = {}
): AsyncIterable<NormalizedRFI[]> {
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
  
  for await (const page of client.paginate<ProcoreRFI>(
    `/rest/v1.0/projects/${projectId}/rfis`,
    params,
    options.perPage ?? 100
  )) {
    const normalized = page.map(mapProcoreRFIToNormalized);
    yield normalized;
  }
}

export async function listRFIIds(
  client: ProcoreClient,
  projectId: string
): Promise<string[]> {
  const ids: string[] = [];
  
  for await (const page of client.paginate<ProcoreRFI>(
    `/rest/v1.0/projects/${projectId}/rfis`,
    {},
    1000
  )) {
    ids.push(...page.map((rfi) => String(rfi.id)));
  }
  
  return ids;
}

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
  
  for await (const page of client.paginate<ProcoreSubmittal>(
    `/rest/v1.1/projects/${projectId}/submittals`,
    params,
    options.perPage ?? 100
  )) {
    const normalized = page.map(mapProcoreSubmittalToNormalized);
    yield normalized;
  }
}

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
