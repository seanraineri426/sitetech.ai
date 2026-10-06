/**
 * Tests for P6 XER parser.
 */

import { describe, it, expect } from "vitest";
import { parseXER, parseXERToActivities, validateXER } from "../parser";

describe("P6 XER parser", () => {
  const sampleXER = `%T\tPROJECT
%F\tproj_id\tproj_short_name\texport_flag
%R\t1\tDemo Project\tY

%T\tPROJWBS
%F\twbs_id\tproj_id\twbs_short_name\tparent_wbs_id
%R\t10\t1\tProject Root\t
%R\t20\t1\tPhase 1\t10
%R\t30\t1\tPhase 2\t10

%T\tTASK
%F\ttask_id\tproj_id\twbs_id\ttask_code\ttask_name\ttarget_start_date\ttarget_end_date\tact_start_date\tact_end_date\tearly_start_date\tearly_end_date\tlate_start_date\tlate_end_date\tphys_complete_pct\ttotal_float_hr_cnt\tstatus_code
%R\t100\t1\t20\tA100\tFoundation Work\t2026-10-01 08:00\t2026-10-10 17:00\t2026-10-01 08:00\t\t2026-10-01 08:00\t2026-10-10 17:00\t2026-10-01 08:00\t2026-10-10 17:00\t50.0\t0.0\tTK_Active
%R\t200\t1\t20\tA200\tFraming\t2026-10-11 08:00\t2026-10-25 17:00\t\t\t2026-10-11 08:00\t2026-10-25 17:00\t2026-10-11 08:00\t2026-10-25 17:00\t0.0\t0.0\tTK_NotStart
%R\t300\t1\t30\tB100\tElectrical Rough-in\t2026-10-15 08:00\t2026-10-30 17:00\t\t\t2026-10-15 08:00\t2026-10-30 17:00\t2026-10-20 08:00\t2026-11-05 17:00\t0.0\t40.0\tTK_NotStart

%T\tTASKPRED
%F\ttask_pred_id\ttask_id\tpred_task_id\tpred_type\tlag_hr_cnt
%R\t1\t200\t100\tPR_FS\t0.0
%R\t2\t300\t100\tPR_FS\t8.0
`;

  describe("parseXER", () => {
    it("parses XER format into tables", () => {
      const tables = parseXER(sampleXER);

      expect(tables.has("PROJECT")).toBe(true);
      expect(tables.has("PROJWBS")).toBe(true);
      expect(tables.has("TASK")).toBe(true);
      expect(tables.has("TASKPRED")).toBe(true);
    });

    it("parses PROJECT table correctly", () => {
      const tables = parseXER(sampleXER);
      const project = tables.get("PROJECT");

      expect(project).toBeDefined();
      expect(project!.rows).toHaveLength(1);
      expect(project!.rows[0].proj_short_name).toBe("Demo Project");
    });

    it("parses TASK table with all fields", () => {
      const tables = parseXER(sampleXER);
      const task = tables.get("TASK");

      expect(task).toBeDefined();
      expect(task!.rows).toHaveLength(3);
      expect(task!.rows[0].task_code).toBe("A100");
      expect(task!.rows[0].task_name).toBe("Foundation Work");
    });

    it("parses TASKPRED relationships", () => {
      const tables = parseXER(sampleXER);
      const pred = tables.get("TASKPRED");

      expect(pred).toBeDefined();
      expect(pred!.rows).toHaveLength(2);
      expect(pred!.rows[0].pred_type).toBe("PR_FS");
    });
  });

  describe("parseXERToActivities", () => {
    it("converts XER to normalized activities", () => {
      const activities = parseXERToActivities(sampleXER, "demo.xer");

      expect(activities).toHaveLength(3);
      expect(activities[0].name).toBe("Foundation Work");
      expect(activities[0].activity_code).toBe("A100");
    });

    it("builds WBS paths correctly", () => {
      const activities = parseXERToActivities(sampleXER, "demo.xer");

      const foundationTask = activities.find((a) => a.activity_code === "A100");
      expect(foundationTask?.wbs).toBe("Project Root / Phase 1");

      const electricalTask = activities.find((a) => a.activity_code === "B100");
      expect(electricalTask?.wbs).toBe("Project Root / Phase 2");
    });

    it("parses dates correctly", () => {
      const activities = parseXERToActivities(sampleXER, "demo.xer");

      const foundationTask = activities[0];
      expect(foundationTask.planned_start).toBe("2026-10-01");
      expect(foundationTask.planned_finish).toBe("2026-10-10");
      expect(foundationTask.actual_start).toBe("2026-10-01");
      expect(foundationTask.actual_finish).toBeNull();
    });

    it("converts percent complete correctly", () => {
      const activities = parseXERToActivities(sampleXER, "demo.xer");

      const foundationTask = activities[0];
      expect(foundationTask.percent_complete).toBe(0.5); // 50% -> 0.5
    });

    it("converts float hours to days", () => {
      const activities = parseXERToActivities(sampleXER, "demo.xer");

      const criticalTask = activities[0];
      expect(criticalTask.total_float).toBe(0); // 0 hours -> 0 days

      const nonCriticalTask = activities[2];
      expect(nonCriticalTask.total_float).toBe(5); // 40 hours -> 5 days
    });

    it("identifies critical activities", () => {
      const activities = parseXERToActivities(sampleXER, "demo.xer");

      const criticalTasks = activities.filter((a) => a.is_critical);
      expect(criticalTasks).toHaveLength(2); // Float <= 0

      const nonCriticalTasks = activities.filter((a) => !a.is_critical);
      expect(nonCriticalTasks).toHaveLength(1); // Float > 0
    });

    it("maps predecessors correctly", () => {
      const activities = parseXERToActivities(sampleXER, "demo.xer");

      const framingTask = activities.find((a) => a.activity_code === "A200");
      expect(framingTask?.predecessors).toHaveLength(1);
      expect(framingTask?.predecessors[0]).toEqual({
        activity_id: "100",
        type: "FS",
        lag: 0,
      });

      const electricalTask = activities.find((a) => a.activity_code === "B100");
      expect(electricalTask?.predecessors).toHaveLength(1);
      expect(electricalTask?.predecessors[0]).toEqual({
        activity_id: "100",
        type: "FS",
        lag: 1, // 8 hours -> 1 day
      });
    });

    it("generates stable fingerprints", () => {
      const activities1 = parseXERToActivities(sampleXER, "demo.xer");
      const activities2 = parseXERToActivities(sampleXER, "demo.xer");

      expect(activities1[0].fingerprint).toBe(activities2[0].fingerprint);
      expect(activities1[0].fingerprint).toHaveLength(64); // SHA-256 hex
    });

    it("includes source metadata", () => {
      const activities = parseXERToActivities(sampleXER, "demo.xer");

      expect(activities[0].source_system).toBe("p6_xer");
      expect(activities[0].source_file).toBe("demo.xer");
      expect(activities[0].parsed_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe("validateXER", () => {
    it("validates correct XER format", () => {
      const result = validateXER(sampleXER);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("rejects empty content", () => {
      const result = validateXER("");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Empty file");
    });

    it("rejects content without table markers", () => {
      const invalid = "Some random text\nNo XER markers here";
      const result = validateXER(invalid);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid XER format");
    });

    it("rejects content with only %T markers", () => {
      const invalid = "%T\tTASK\nNo field or data markers";
      const result = validateXER(invalid);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid XER format");
    });
  });

  describe("Edge cases", () => {
    it("handles empty task name gracefully", () => {
      const xerWithEmptyName = `%T\tPROJECT
%F\tproj_id\tproj_short_name\texport_flag
%R\t1\tTest\tY

%T\tPROJWBS
%F\twbs_id\tproj_id\twbs_short_name\tparent_wbs_id
%R\t10\t1\tRoot\t

%T\tTASK
%F\ttask_id\tproj_id\twbs_id\ttask_code\ttask_name\ttarget_start_date\ttarget_end_date\tphys_complete_pct\ttotal_float_hr_cnt\tstatus_code
%R\t100\t1\t10\tA100\t\t2026-10-01 08:00\t2026-10-10 17:00\t0.0\t0.0\tTK_NotStart

%T\tTASKPRED
%F\ttask_pred_id\ttask_id\tpred_task_id\tpred_type\tlag_hr_cnt
`;

      const activities = parseXERToActivities(xerWithEmptyName, "test.xer");
      expect(activities).toHaveLength(1);
      expect(activities[0].name).toBe("");
    });

    it("handles null dates gracefully", () => {
      const xerWithNullDates = `%T\tPROJECT
%F\tproj_id\tproj_short_name\texport_flag
%R\t1\tTest\tY

%T\tPROJWBS
%F\twbs_id\tproj_id\twbs_short_name\tparent_wbs_id
%R\t10\t1\tRoot\t

%T\tTASK
%F\ttask_id\tproj_id\twbs_id\ttask_code\ttask_name\tact_start_date\tact_end_date\tphys_complete_pct\ttotal_float_hr_cnt\tstatus_code
%R\t100\t1\t10\tA100\tTask\t\t\t0.0\t0.0\tTK_NotStart

%T\tTASKPRED
%F\ttask_pred_id\ttask_id\tpred_task_id\tpred_type\tlag_hr_cnt
`;

      const activities = parseXERToActivities(xerWithNullDates, "test.xer");
      expect(activities[0].actual_start).toBeNull();
      expect(activities[0].actual_finish).toBeNull();
    });

    it("handles Windows line endings (CRLF)", () => {
      const xerWithCRLF = sampleXER.replace(/\n/g, "\r\n");
      const activities = parseXERToActivities(xerWithCRLF, "test.xer");
      expect(activities).toHaveLength(3);
    });
  });
});
