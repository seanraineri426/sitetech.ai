/**
 * Primavera P6 XER (Extended Exchange Rate) format parser.
 * 
 * XER is a tab-delimited text format with:
 * - %T lines defining table names
 * - %F lines defining field names
 * - %R lines containing data rows
 * 
 * This parser extracts PROJECT, PROJWBS, TASK, and TASKPRED tables
 * and maps them to normalized schedule activities.
 */

import { createHash } from "crypto";
import type { NormalizedScheduleActivity } from "../types";

interface XERTable {
  name: string;
  fields: string[];
  rows: Record<string, string>[];
}

interface XERProject {
  proj_id: string;
  proj_short_name: string;
  export_flag: string;
}

interface XERWBS {
  wbs_id: string;
  proj_id: string;
  wbs_short_name: string;
  parent_wbs_id: string | null;
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
  cstr_type: string | null;
}

// XERPred type is documented but extracted inline in extractPredecessors
// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface XERPred {
  task_pred_id: string;
  task_id: string;
  pred_task_id: string;
  pred_type: string; // PR_FS, PR_SS, PR_FF, PR_SF
  lag_hr_cnt: string | null;
}

const PRED_TYPE_MAP: Record<string, string> = {
  PR_FS: "FS",
  PR_SS: "SS",
  PR_FF: "FF",
  PR_SF: "SF",
};

/**
 * Parse XER file content into structured tables.
 */
export function parseXER(content: string): Map<string, XERTable> {
  const lines = content.split(/\r?\n/);
  const tables = new Map<string, XERTable>();
  
  let currentTable: XERTable | null = null;
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    const [marker, ...parts] = trimmed.split("\t");
    
    if (marker === "%T") {
      // Table definition
      const tableName = parts[0];
      currentTable = {
        name: tableName,
        fields: [],
        rows: [],
      };
      tables.set(tableName, currentTable);
    } else if (marker === "%F" && currentTable) {
      // Field definition
      currentTable.fields = parts;
    } else if (marker === "%R" && currentTable && currentTable.fields.length > 0) {
      // Data row
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
 * Extract PROJECT table records.
 */
function extractProjects(tables: Map<string, XERTable>): XERProject[] {
  const projectTable = tables.get("PROJECT");
  if (!projectTable) return [];
  
  return projectTable.rows.map((row) => ({
    proj_id: row.proj_id || "",
    proj_short_name: row.proj_short_name || "",
    export_flag: row.export_flag || "N",
  }));
}

/**
 * Build WBS path map for activities.
 */
function buildWBSMap(tables: Map<string, XERTable>): Map<string, string> {
  const wbsTable = tables.get("PROJWBS");
  if (!wbsTable) return new Map();
  
  const wbsMap = new Map<string, XERWBS>();
  
  wbsTable.rows.forEach((row) => {
    wbsMap.set(row.wbs_id, {
      wbs_id: row.wbs_id,
      proj_id: row.proj_id,
      wbs_short_name: row.wbs_short_name || "",
      parent_wbs_id: row.parent_wbs_id || null,
    });
  });
  
  // Build full WBS paths
  const pathMap = new Map<string, string>();
  
  for (const [wbsId, wbs] of wbsMap) {
    const path: string[] = [wbs.wbs_short_name];
    let current = wbs;
    
    while (current.parent_wbs_id) {
      const parent = wbsMap.get(current.parent_wbs_id);
      if (!parent) break;
      path.unshift(parent.wbs_short_name);
      current = parent;
    }
    
    pathMap.set(wbsId, path.join(" / "));
  }
  
  return pathMap;
}

/**
 * Parse XER date (format: yyyy-mm-dd hh:mm).
 * Returns ISO date string (date only, no time).
 */
function parseXERDate(dateStr: string | null): string | null {
  if (!dateStr || dateStr === "") return null;
  
  try {
    // XER dates are like "2026-10-15 08:00"
    const [datePart] = dateStr.split(" ");
    return datePart || null;
  } catch {
    return null;
  }
}

/**
 * Parse XER percentage (0-100) to decimal (0-1).
 */
function parsePercent(pct: string | null): number | null {
  if (!pct || pct === "") return null;
  const num = parseFloat(pct);
  return isNaN(num) ? null : num / 100;
}

/**
 * Parse XER hours to days (assuming 8-hour days).
 */
function hoursToDays(hours: string | null): number | null {
  if (!hours || hours === "") return null;
  const num = parseFloat(hours);
  return isNaN(num) ? null : num / 8;
}

/**
 * Extract predecessors for a task.
 */
function extractPredecessors(
  taskId: string,
  tables: Map<string, XERTable>
): Array<{ activity_id: string; type: string; lag: number | null }> {
  const predTable = tables.get("TASKPRED");
  if (!predTable) return [];
  
  return predTable.rows
    .filter((row) => row.task_id === taskId)
    .map((row) => ({
      activity_id: row.pred_task_id,
      type: PRED_TYPE_MAP[row.pred_type] || "FS",
      lag: hoursToDays(row.lag_hr_cnt),
    }));
}

/**
 * Parse XER file and return normalized schedule activities.
 */
export function parseXERToActivities(
  content: string,
  sourceFile: string
): NormalizedScheduleActivity[] {
  const tables = parseXER(content);
  
  const projects = extractProjects(tables);
  if (projects.length === 0) {
    throw new Error("No PROJECT table found in XER file");
  }
  
  const wbsMap = buildWBSMap(tables);
  const taskTable = tables.get("TASK");
  
  if (!taskTable) {
    throw new Error("No TASK table found in XER file");
  }
  
  const activities: NormalizedScheduleActivity[] = [];
  const parsedAt = new Date().toISOString();
  
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
      cstr_type: row.cstr_type || null,
    };
    
    const predecessors = extractPredecessors(task.task_id, tables);
    const wbsPath = wbsMap.get(task.wbs_id) || null;
    
    // Determine criticality (total float <= 0)
    const totalFloat = hoursToDays(task.total_float_hr_cnt);
    const isCritical = totalFloat !== null && totalFloat <= 0;
    
    // Generate fingerprint
    const fingerprintData = {
      task_id: task.task_id,
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
      predecessors,
    };
    
    const fingerprint = createHash("sha256")
      .update(JSON.stringify(fingerprintData, Object.keys(fingerprintData).sort()))
      .digest("hex");
    
    activities.push({
      fingerprint,
      source_id: task.task_id,
      activity_code: task.task_code || null,
      name: task.task_name,
      wbs: wbsPath,
      project_id: task.proj_id,
      
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
      
      source_system: "p6_xer",
      source_file: sourceFile,
      parsed_at: parsedAt,
    });
  }
  
  return activities;
}

/**
 * Validate XER file encoding and format.
 */
export function validateXER(content: string): { valid: boolean; error?: string } {
  if (!content || content.trim().length === 0) {
    return { valid: false, error: "Empty file" };
  }
  
  const lines = content.split(/\r?\n/);
  const hasTableMarker = lines.some((line) => line.startsWith("%T"));
  const hasFieldMarker = lines.some((line) => line.startsWith("%F"));
  const hasDataMarker = lines.some((line) => line.startsWith("%R"));
  
  if (!hasTableMarker || !hasFieldMarker || !hasDataMarker) {
    return {
      valid: false,
      error: "Invalid XER format: missing table, field, or data markers",
    };
  }
  
  return { valid: true };
}
