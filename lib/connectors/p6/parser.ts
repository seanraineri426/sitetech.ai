/**
 * Primavera P6 XER (Extended Exchange Rate) format parser.
 * 
 * **External ID Strategy:**
 * Uses `{proj_short_name}:{task_code}` as the stable external_id.
 * 
 * **Rationale:**
 * - `task_id` is an internal database primary key that changes when a schedule
 *   is exported from one P6 database and imported into another
 * - `task_code` (Activity ID) is the user-visible, scheduler-maintained field
 *   that remains stable across database migrations and updates
 * - Combining with `proj_short_name` ensures uniqueness across projects while
 *   maintaining stability within a project's lifecycle
 * - `task_id` is preserved as a secondary field for reference but NOT used as
 *   the external identifier
 * 
 * **XER Format:**
 * - %T lines: table names
 * - %F lines: field names
 * - %R lines: data rows (tab-delimited)
 * 
 * **Encoding:**
 * - windows-1252 by default
 * - UTF-8 if BOM present
 * 
 * **Tables extracted:** PROJECT, PROJWBS, TASK, TASKPRED
 */

import { createHash } from "crypto";
import { Readable } from "stream";
import { createInterface } from "readline";
import { canonicalStringify } from "../shared/canonical-stringify";
import type { NormalizedScheduleActivity } from "../types";

interface XERTable {
  name: string;
  fields: string[];
  rows: Record<string, string>[];
}

interface XERTask {
  task_id: string;
  proj_id: string;
  wbs_id: string;
  task_code: string;
  task_name: string;
  target_start_date: string | null;
  target_end_date: string | null;
  act_start_date: string | null;
  act_end_date: string | null;
  early_start_date: string | null;
  early_end_date: string | null;
  late_start_date: string | null;
  late_end_date: string | null;
  phys_complete_pct: string | null;
  total_float_hr_cnt: string | null;
  status_code: string;
}

const PRED_TYPE_MAP: Record<string, string> = {
  PR_FS: "FS",
  PR_SS: "SS",
  PR_FF: "FF",
  PR_SF: "SF",
};

const NEEDED_TABLES = ["PROJECT", "PROJWBS", "TASK", "TASKPRED"];

/**
 * Detect BOM and return encoding.
 * Uses TextDecoder with windows-1252 support (Node's full ICU).
 */
function detectEncoding(buffer: Buffer): string {
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return "utf-8";
  }
  return "windows-1252";
}

/**
 * Parse XER from Buffer or stream, line by line.
 * Only extracts needed tables for efficiency.
 */
async function parseXERStream(
  input: Buffer | Readable
): Promise<Map<string, XERTable>> {
  const tables = new Map<string, XERTable>();
  let currentTable: XERTable | null = null;

  let stream: Readable;
  
  if (Buffer.isBuffer(input)) {
    const encoding = detectEncoding(input);
    const decoder = new TextDecoder(encoding);
    const text = decoder.decode(input);
    stream = Readable.from(text);
  } else {
    // For streams, collect chunks first
    const chunks: Buffer[] = [];
    for await (const chunk of input) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const buffer = Buffer.concat(chunks);
    const encoding = detectEncoding(buffer);
    const decoder = new TextDecoder(encoding);
    const text = decoder.decode(buffer);
    stream = Readable.from(text);
  }

  const rl = createInterface({
    input: stream,
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const [marker, ...parts] = trimmed.split("\t");

    if (marker === "%T") {
      const tableName = parts[0];
      
      // Only track needed tables
      if (NEEDED_TABLES.includes(tableName)) {
        currentTable = {
          name: tableName,
          fields: [],
          rows: [],
        };
        tables.set(tableName, currentTable);
      } else {
        currentTable = null;
      }
    } else if (marker === "%F" && currentTable) {
      currentTable.fields = parts;
    } else if (marker === "%R" && currentTable && currentTable.fields.length > 0) {
      const row: Record<string, string> = {};
      parts.forEach((value, index) => {
        const fieldName = currentTable!.fields[index];
        if (fieldName) {
          row[fieldName] = value;
        }
      });
      currentTable.rows.push(row);
    }
  }

  return tables;
}

/**
 * Build WBS path map.
 */
function buildWBSMap(tables: Map<string, XERTable>): Map<string, string> {
  const wbsTable = tables.get("PROJWBS");
  if (!wbsTable) return new Map();

  const wbsMap = new Map<string, { name: string; parent: string | null }>();

  for (const row of wbsTable.rows) {
    wbsMap.set(row.wbs_id, {
      name: row.wbs_short_name || "",
      parent: row.parent_wbs_id || null,
    });
  }

  const pathMap = new Map<string, string>();

  for (const [wbsId, wbs] of wbsMap) {
    const path: string[] = [wbs.name];
    let current = wbs;

    while (current.parent) {
      const parent = wbsMap.get(current.parent);
      if (!parent) break;
      path.unshift(parent.name);
      current = parent;
    }

    pathMap.set(wbsId, path.join(" / "));
  }

  return pathMap;
}

/**
 * Build TASKPRED index for O(1) lookups.
 */
function buildPredecessorIndex(
  tables: Map<string, XERTable>
): Map<string, Array<{ pred_task_id: string; pred_type: string; lag_hr_cnt: string | null }>> {
  const predTable = tables.get("TASKPRED");
  if (!predTable) return new Map();

  const index = new Map<string, Array<{ pred_task_id: string; pred_type: string; lag_hr_cnt: string | null }>>();

  for (const row of predTable.rows) {
    const taskId = row.task_id;
    if (!index.has(taskId)) {
      index.set(taskId, []);
    }
    index.get(taskId)!.push({
      pred_task_id: row.pred_task_id,
      pred_type: row.pred_type,
      lag_hr_cnt: row.lag_hr_cnt || null,
    });
  }

  return index;
}

/**
 * Parse XER date to ISO date format (date only, no time or timezone).
 * 
 * XER dates are project-local wall-clock times with NO timezone information.
 * The rules layer applies projects.timezone for interpretation.
 * We extract just the date part (yyyy-mm-dd) for date-only fields.
 * 
 * @param dateStr XER date string (yyyy-mm-dd hh:mm)
 * @returns ISO date string (date only, no time)
 */
function parseXERDate(dateStr: string | null): string | null {
  if (!dateStr || dateStr === "") return null;

  try {
    // Extract date part only - XER dates are wall-clock times with no zone
    const [datePart] = dateStr.split(" ");
    return datePart || null;
  } catch {
    return null;
  }
}

function parsePercent(pct: string | null): number | null {
  if (!pct || pct === "") return null;
  const num = parseFloat(pct);
  return isNaN(num) ? null : num / 100;
}

function hoursToDays(hours: string | null): number | null {
  if (!hours || hours === "") return null;
  const num = parseFloat(hours);
  return isNaN(num) ? null : num / 8;
}

/**
 * Parse XER file and return normalized schedule activities.
 * 
 * @param input Buffer or Readable stream
 * @param _sourceFile Source filename for metadata (reserved for future use)
 */
export async function parseXERToActivities(
  input: Buffer | Readable,
  _sourceFile: string
): Promise<NormalizedScheduleActivity[]> {
  const tables = await parseXERStream(input);

  const projectTable = tables.get("PROJECT");
  if (!projectTable || projectTable.rows.length === 0) {
    throw new Error("No PROJECT table found in XER file");
  }

  // Build project ID to short name map
  const projectMap = new Map<string, string>();
  for (const row of projectTable.rows) {
    projectMap.set(row.proj_id, row.proj_short_name || row.proj_id);
  }

  const taskTable = tables.get("TASK");
  if (!taskTable) {
    throw new Error("No TASK table found in XER file");
  }

  const wbsMap = buildWBSMap(tables);
  const predIndex = buildPredecessorIndex(tables);

  // First pass: build task_id to composite external_id map
  // Guard empty task_code - skip with warning
  const taskIdToExternalId = new Map<string, string>();
  const validTasks: XERTask[] = [];

  for (const row of taskTable.rows) {
    const task: XERTask = {
      task_id: row.task_id,
      proj_id: row.proj_id,
      wbs_id: row.wbs_id,
      task_code: row.task_code || "",
      task_name: row.task_name || "",
      target_start_date: row.target_start_date || null,
      target_end_date: row.target_end_date || null,
      act_start_date: row.act_start_date || null,
      act_end_date: row.act_end_date || null,
      early_start_date: row.early_start_date || null,
      early_end_date: row.early_end_date || null,
      late_start_date: row.late_start_date || null,
      late_end_date: row.late_end_date || null,
      phys_complete_pct: row.phys_complete_pct || null,
      total_float_hr_cnt: row.total_float_hr_cnt || null,
      status_code: row.status_code || "",
    };

    // Guard empty task_code: skip + warning, never emit colliding PROJ: IDs
    if (!task.task_code || task.task_code.trim() === "") {
      console.warn(`[P6 Parser] Skipping task ${task.task_id} with empty task_code in project ${task.proj_id}`);
      continue;
    }

    const projShortName = projectMap.get(task.proj_id) || task.proj_id;
    const externalId = `${projShortName}:${task.task_code}`;
    taskIdToExternalId.set(task.task_id, externalId);
    validTasks.push(task);
  }

  // Second pass: build activities with mapped predecessors
  const activities: NormalizedScheduleActivity[] = [];

  for (const task of validTasks) {
    const wbsPath = wbsMap.get(task.wbs_id) || null;
    const totalFloat = hoursToDays(task.total_float_hr_cnt);
    const isCritical = totalFloat !== null && totalFloat <= 0;

    const projShortName = projectMap.get(task.proj_id) || task.proj_id;
    const externalId = `${projShortName}:${task.task_code}`;

    // Map predecessors to composite IDs, not raw pred_task_id
    const predecessors = (predIndex.get(task.task_id) || [])
      .map((pred) => {
        const predExternalId = taskIdToExternalId.get(pred.pred_task_id);
        if (!predExternalId) {
          // Predecessor task was skipped (empty task_code) or doesn't exist
          return null;
        }
        return {
          activity_id: predExternalId, // Composite ID, not internal P6 task_id
          type: PRED_TYPE_MAP[pred.pred_type] || "FS",
          lag: hoursToDays(pred.lag_hr_cnt),
        };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);

    // Fingerprint: keep internal P6 task_id OUT of fingerprint
    const fingerprintData = {
      proj_id: task.proj_id,
      task_code: task.task_code,
      task_name: task.task_name,
      wbs: wbsPath,
      target_start_date: task.target_start_date,
      target_end_date: task.target_end_date,
      act_start_date: task.act_start_date,
      act_end_date: task.act_end_date,
      phys_complete_pct: task.phys_complete_pct,
      total_float_hr_cnt: task.total_float_hr_cnt,
      status_code: task.status_code,
      predecessors, // Composite IDs only
    };

    const fingerprint = createHash("sha256")
      .update(canonicalStringify(fingerprintData))
      .digest("hex");

    activities.push({
      entity_type: "schedule_activity",
      external_id: externalId,
      fingerprint,
      
      source_project_id: task.proj_id,
      task_id: task.task_id, // Internal P6 ID (not in fingerprint)
      
      activity_code: task.task_code || null,
      name: task.task_name,
      wbs: wbsPath,
      
      planned_start: parseXERDate(task.target_start_date),
      planned_finish: parseXERDate(task.target_end_date),
      actual_start: parseXERDate(task.act_start_date),
      actual_finish: parseXERDate(task.act_end_date),
      early_start: parseXERDate(task.early_start_date),
      early_finish: parseXERDate(task.early_end_date),
      late_start: parseXERDate(task.late_start_date),
      late_finish: parseXERDate(task.late_end_date),
      
      percent_complete: parsePercent(task.phys_complete_pct),
      total_float: totalFloat,
      is_critical: isCritical,
      
      predecessors,
    });
  }

  return activities;
}

export function validateXER(content: string | Buffer): { valid: boolean; error?: string } {
  const str = Buffer.isBuffer(content) ? content.toString("utf-8", 0, 1000) : content.slice(0, 1000);

  if (!str || str.trim().length === 0) {
    return { valid: false, error: "Empty file" };
  }

  const hasTableMarker = str.includes("%T");
  const hasFieldMarker = str.includes("%F");
  const hasDataMarker = str.includes("%R");

  if (!hasTableMarker || !hasFieldMarker || !hasDataMarker) {
    return {
      valid: false,
      error: "Invalid XER format: missing table, field, or data markers",
    };
  }

  return { valid: true };
}
