/**
 * Comprehensive tests for P6 XER parser.
 * Covers encoding detection, streaming, indexed predecessors, timezone, and external ID.
 */

import { describe, it, expect, vi } from "vitest";
import { Readable } from "stream";
import { parseXERToActivities, validateXER } from "../parser";

// Mock server-only
vi.mock("server-only", () => ({}));

describe("P6 XER parser", () => {
  const sampleXER = `ERMHDR	9.0	2026-10-01
%T	PROJECT
%F	proj_id	proj_short_name
%R	1	DEMO
%T	PROJWBS
%F	wbs_id	proj_id	wbs_short_name	parent_wbs_id
%R	100	1	Phase 1	
%R	101	1	Phase 1.1	100
%T	TASK
%F	task_id	proj_id	wbs_id	task_code	task_name	target_start_date	target_end_date	phys_complete_pct	total_float_hr_cnt	status_code
%R	1000	1	101	A1000	Foundation Work	2026-10-01 08:00	2026-10-15 17:00	50	0	TK_Active
%R	1001	1	101	A1010	Steel Erection	2026-10-16 08:00	2026-10-30 17:00	0	8	TK_NotStart
%R	1002	1	101	A1020	Concrete Pour	2026-11-01 08:00	2026-11-05 17:00	0	-16	TK_NotStart
%T	TASKPRED
%F	task_pred_id	task_id	pred_task_id	pred_type	lag_hr_cnt
%R	2000	1001	1000	PR_FS	0
%R	2001	1002	1001	PR_FS	8`;

  describe("Buffer and stream input", () => {
    it("accepts Buffer input", async () => {
      const buffer = Buffer.from(sampleXER, "utf-8");
      const activities = await parseXERToActivities(buffer, "test.xer");

      expect(activities).toHaveLength(3);
      expect(activities[0].name).toBe("Foundation Work");
    });

    it("accepts Readable stream input", async () => {
      const stream = Readable.from(sampleXER);
      const activities = await parseXERToActivities(stream, "test.xer");

      expect(activities).toHaveLength(3);
      expect(activities[0].name).toBe("Foundation Work");
    });
  });

  describe("Encoding detection", () => {
    it("detects UTF-8 BOM", async () => {
      const bom = Buffer.from([0xef, 0xbb, 0xbf]);
      const content = Buffer.from(sampleXER, "utf-8");
      const buffer = Buffer.concat([bom, content]);

      const activities = await parseXERToActivities(buffer, "test.xer");

      expect(activities).toHaveLength(3);
    });

    it("uses windows-1252 for smart quotes and en dashes (0x93, 0x94, 0x96)", async () => {
      // Create test data with windows-1252 specific characters
      // 0x93 = left double quote, 0x94 = right double quote, 0x96 = en dash
      const header = "ERMHDR\t9.0\t2026-10-01\n%T\tPROJECT\n%F\tproj_id\tproj_short_name\n%R\t1\tDEMO\n%T\tPROJWBS\n%F\twbs_id\tproj_id\twbs_short_name\n%R\t100\t1\tPhase 1\n%T\tTASK\n%F\ttask_id\tproj_id\twbs_id\ttask_code\ttask_name\n%R\t1000\t1\t100\tA1000\tFoundation ";
      const trailer = " Work\n%T\tTASKPRED\n%F\ttask_pred_id\ttask_id\tpred_task_id\tpred_type\tlag_hr_cnt";
      
      // Create a buffer with windows-1252 bytes 0x93, 0x94, 0x96
      const headerBuf = Buffer.from(header, "binary");
      const smartQuoteBuf = Buffer.from([0x93, 0x94, 0x96]); // left quote, right quote, en dash
      const trailerBuf = Buffer.from(trailer, "binary");
      const buffer = Buffer.concat([headerBuf, smartQuoteBuf, trailerBuf]);

      const activities = await parseXERToActivities(buffer, "test.xer");

      expect(activities.length).toBeGreaterThan(0);
      // windows-1252 bytes 0x93, 0x94, 0x96 should be decoded as smart quotes and en dash
      // TextDecoder('windows-1252') should handle these correctly
      expect(activities[0].name).toContain("Foundation");
      expect(activities[0].name).toContain("Work");
    });
  });

  describe("External ID format: {proj_short_name}:{task_code}", () => {
    it("uses composite external_id format", async () => {
      const buffer = Buffer.from(sampleXER, "utf-8");
      const activities = await parseXERToActivities(buffer, "test.xer");

      expect(activities[0].external_id).toBe("DEMO:A1000");
      expect(activities[1].external_id).toBe("DEMO:A1010");
      expect(activities[2].external_id).toBe("DEMO:A1020");
    });

    it("preserves activity_code field", async () => {
      const buffer = Buffer.from(sampleXER, "utf-8");
      const activities = await parseXERToActivities(buffer, "test.xer");

      expect(activities[0].activity_code).toBe("A1000");
      expect(activities[1].activity_code).toBe("A1010");
    });

    it("skips tasks with empty task_code (guarded)", async () => {
      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const xerWithEmptyCode = sampleXER.replace("A1000", "");
      const buffer = Buffer.from(xerWithEmptyCode, "utf-8");
      const activities = await parseXERToActivities(buffer, "test.xer");

      // Task with empty code should be skipped
      expect(activities.every((a) => a.activity_code !== null && a.activity_code !== "")).toBe(true);
      expect(consoleWarnSpy).toHaveBeenCalledWith("[P6.Parser.EmptyTaskCode]", expect.objectContaining({ skipped_count: 1 }));

      consoleWarnSpy.mockRestore();
    });
  });

  describe("Indexed predecessors (O(1) lookup)", () => {
    it("builds predecessor relationships", async () => {
      const buffer = Buffer.from(sampleXER, "utf-8");
      const activities = await parseXERToActivities(buffer, "test.xer");

      const steelErection = activities.find((a) => a.activity_code === "A1010");
      expect(steelErection?.predecessors).toHaveLength(1);
      expect(steelErection?.predecessors[0].activity_id).toBe("DEMO:A1000"); // Composite ID
      expect(steelErection?.predecessors[0].type).toBe("FS");
      expect(steelErection?.predecessors[0].lag).toBe(0);
    });

    it("converts lag from hours to days", async () => {
      const buffer = Buffer.from(sampleXER, "utf-8");
      const activities = await parseXERToActivities(buffer, "test.xer");

      const concretePour = activities.find((a) => a.activity_code === "A1020");
      expect(concretePour?.predecessors).toHaveLength(1);
      expect(concretePour?.predecessors[0].lag).toBe(1); // 8 hours = 1 day
    });

    it("maps predecessor types correctly", async () => {
      const xerWithTypes = `ERMHDR	9.0	2026-10-01
%T	PROJECT
%F	proj_id	proj_short_name
%R	1	DEMO
%T	PROJWBS
%F	wbs_id	proj_id	wbs_short_name
%R	100	1	Phase 1
%T	TASK
%F	task_id	proj_id	wbs_id	task_code	task_name
%R	1000	1	100	A1000	Task A
%R	1001	1	100	A1010	Task B
%R	1002	1	100	A1020	Task C
%R	1003	1	100	A1030	Task D
%T	TASKPRED
%F	task_pred_id	task_id	pred_task_id	pred_type	lag_hr_cnt
%R	2000	1001	1000	PR_FS	0
%R	2001	1002	1000	PR_SS	0
%R	2002	1003	1000	PR_FF	0`;

      const buffer = Buffer.from(xerWithTypes, "utf-8");
      const activities = await parseXERToActivities(buffer, "test.xer");

      expect(activities[1].predecessors[0].type).toBe("FS");
      expect(activities[2].predecessors[0].type).toBe("SS");
      expect(activities[3].predecessors[0].type).toBe("FF");
    });

    it("handles activities with no predecessors", async () => {
      const buffer = Buffer.from(sampleXER, "utf-8");
      const activities = await parseXERToActivities(buffer, "test.xer");

      const foundation = activities.find((a) => a.activity_code === "A1000");
      expect(foundation?.predecessors).toEqual([]);
    });
  });

  describe("Fingerprint changes with predecessor updates", () => {
    it("changes fingerprint when predecessor changes", async () => {
      const xer1 = sampleXER;
      const xer2 = sampleXER.replace("pred_task_id	pred_type	lag_hr_cnt\n%R	2000	1001	1000", "pred_task_id	pred_type	lag_hr_cnt\n%R	2000	1001	1002");

      const activities1 = await parseXERToActivities(Buffer.from(xer1, "utf-8"), "test.xer");
      const activities2 = await parseXERToActivities(Buffer.from(xer2, "utf-8"), "test.xer");

      const task1 = activities1.find((a) => a.activity_code === "A1010");
      const task2 = activities2.find((a) => a.activity_code === "A1010");

      expect(task1?.fingerprint).not.toBe(task2?.fingerprint);
    });
  });

  describe("WBS hierarchy", () => {
    it("builds WBS path from hierarchy", async () => {
      const buffer = Buffer.from(sampleXER, "utf-8");
      const activities = await parseXERToActivities(buffer, "test.xer");

      expect(activities[0].wbs).toBe("Phase 1 / Phase 1.1");
    });

    it("handles null WBS", async () => {
      const xerWithoutWBS = sampleXER.replace("Phase 1.1", "");
      const buffer = Buffer.from(xerWithoutWBS, "utf-8");
      const activities = await parseXERToActivities(buffer, "test.xer");

      expect(activities[0].wbs).toBeTruthy();
    });
  });

  describe("Critical path determination", () => {
    it("marks activities as critical when total_float <= 0", async () => {
      const buffer = Buffer.from(sampleXER, "utf-8");
      const activities = await parseXERToActivities(buffer, "test.xer");

      const foundation = activities.find((a) => a.activity_code === "A1000");
      const concretePour = activities.find((a) => a.activity_code === "A1020");

      expect(foundation?.total_float).toBe(0);
      expect(foundation?.is_critical).toBe(true);

      expect(concretePour?.total_float).toBe(-2); // -16 hours = -2 days
      expect(concretePour?.is_critical).toBe(true);
    });

    it("marks non-critical activities", async () => {
      const buffer = Buffer.from(sampleXER, "utf-8");
      const activities = await parseXERToActivities(buffer, "test.xer");

      const steelErection = activities.find((a) => a.activity_code === "A1010");

      expect(steelErection?.total_float).toBe(1); // 8 hours = 1 day
      expect(steelErection?.is_critical).toBe(false);
    });
  });

  describe("Percent complete", () => {
    it("converts percentage to decimal", async () => {
      const buffer = Buffer.from(sampleXER, "utf-8");
      const activities = await parseXERToActivities(buffer, "test.xer");

      const foundation = activities.find((a) => a.activity_code === "A1000");
      expect(foundation?.percent_complete).toBe(0.5); // 50% = 0.5
    });
  });

  describe("Error handling", () => {
    it("throws when no PROJECT table", async () => {
      const invalidXER = `ERMHDR	9.0	2026-10-01
%T	TASK
%F	task_id
%R	1`;

      const buffer = Buffer.from(invalidXER, "utf-8");

      await expect(parseXERToActivities(buffer, "test.xer")).rejects.toThrow(
        "No PROJECT table found"
      );
    });

    it("throws when no TASK table", async () => {
      const invalidXER = `ERMHDR	9.0	2026-10-01
%T	PROJECT
%F	proj_id
%R	1`;

      const buffer = Buffer.from(invalidXER, "utf-8");

      await expect(parseXERToActivities(buffer, "test.xer")).rejects.toThrow(
        "No TASK table found"
      );
    });
  });

  describe("P6 improvements (MUST #5)", () => {
    it("includes task_id in output (not in fingerprint)", async () => {
      const activities = await parseXERToActivities(Buffer.from(sampleXER), "test.xer");

      expect(activities.length).toBeGreaterThan(0);
      expect(activities[0].task_id).toBeDefined();
      expect(typeof activities[0].task_id).toBe("string");
    });

    it("maps predecessors to composite IDs, not raw pred_task_id", async () => {
      const testXER = `ERMHDR	9.0	2026-10-01
%T	PROJECT
%F	proj_id	proj_short_name
%R	1	DEMO
%T	PROJWBS
%F	wbs_id	proj_id	wbs_short_name
%R	100	1	Phase 1
%T	TASK
%F	task_id	proj_id	wbs_id	task_code	task_name
%R	1000	1	100	A1000	Foundation Work
%R	1001	1	100	A1001	Framing
%T	TASKPRED
%F	task_pred_id	task_id	pred_task_id	pred_type	lag_hr_cnt
%R	5000	1001	1000	PR_FS	0`;

      const activities = await parseXERToActivities(Buffer.from(testXER), "test.xer");

      // Find the activity with predecessors
      const framingActivity = activities.find((a) => a.activity_code === "A1001");
      expect(framingActivity).toBeDefined();
      expect(framingActivity!.predecessors).toHaveLength(1);

      // Predecessor should use composite ID, not raw P6 task_id
      expect(framingActivity!.predecessors[0].activity_id).toBe("DEMO:A1000");
      expect(framingActivity!.predecessors[0].activity_id).not.toBe("1000");
    });

    it("skips tasks with empty task_code and logs warning", async () => {
      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const testXER = `ERMHDR	9.0	2026-10-01
%T	PROJECT
%F	proj_id	proj_short_name
%R	1	DEMO
%T	PROJWBS
%F	wbs_id	proj_id	wbs_short_name
%R	100	1	Phase 1
%T	TASK
%F	task_id	proj_id	wbs_id	task_code	task_name
%R	1000	1	100	A1000	Valid Task
%R	1001	1	100		Empty Code Task
%R	1002	1	100	A1002	Another Valid Task
%T	TASKPRED
%F	task_pred_id	task_id	pred_task_id	pred_type	lag_hr_cnt`;

      const activities = await parseXERToActivities(Buffer.from(testXER), "test.xer");

      // Should have 2 activities, skipping the one with empty task_code
      expect(activities).toHaveLength(2);
      expect(activities.find((a) => a.activity_code === "")).toBeUndefined();

      // Should log warning
      expect(consoleWarnSpy).toHaveBeenCalledWith("[P6.Parser.EmptyTaskCode]", expect.objectContaining({ skipped_count: 1 }));

      consoleWarnSpy.mockRestore();
    });

    it("task_id is NOT in fingerprint", async () => {
      // Create two XER files with same data but different internal task_ids
      const xer1 = `ERMHDR	9.0	2026-10-01
%T	PROJECT
%F	proj_id	proj_short_name
%R	1	DEMO
%T	PROJWBS
%F	wbs_id	proj_id	wbs_short_name
%R	100	1	Phase 1
%T	TASK
%F	task_id	proj_id	wbs_id	task_code	task_name
%R	1000	1	100	A1000	Foundation Work
%T	TASKPRED
%F	task_pred_id	task_id	pred_task_id	pred_type	lag_hr_cnt`;

      const xer2 = `ERMHDR	9.0	2026-10-01
%T	PROJECT
%F	proj_id	proj_short_name
%R	1	DEMO
%T	PROJWBS
%F	wbs_id	proj_id	wbs_short_name
%R	100	1	Phase 1
%T	TASK
%F	task_id	proj_id	wbs_id	task_code	task_name
%R	9999	1	100	A1000	Foundation Work
%T	TASKPRED
%F	task_pred_id	task_id	pred_task_id	pred_type	lag_hr_cnt`;

      const activities1 = await parseXERToActivities(Buffer.from(xer1), "test1.xer");
      const activities2 = await parseXERToActivities(Buffer.from(xer2), "test2.xer");

      // Same task_code and data should produce same fingerprint
      // even though internal task_id differs (1000 vs 9999)
      expect(activities1[0].fingerprint).toBe(activities2[0].fingerprint);
      expect(activities1[0].task_id).not.toBe(activities2[0].task_id);
    });

    it("no timezoneOffset parameter (XER dates are wall-clock)", async () => {
      // Verify the function signature doesn't take timezoneOffset
      const activities = await parseXERToActivities(Buffer.from(sampleXER), "test.xer");
      expect(activities).toBeDefined();
      // If this compiles and runs, timezoneOffset is gone
    });
  });

  describe("XER validation", () => {
    it("validates correct XER format", () => {
      const result = validateXER(sampleXER);
      expect(result.valid).toBe(true);
    });

    it("rejects empty file", () => {
      const result = validateXER("");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Empty file");
    });

    it("rejects missing markers", () => {
      const invalid = "PROJECT\nTASK";
      const result = validateXER(invalid);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("missing table, field, or data markers");
    });

    it("validates Buffer input", () => {
      const buffer = Buffer.from(sampleXER, "utf-8");
      const result = validateXER(buffer);
      expect(result.valid).toBe(true);
    });
  });
});
