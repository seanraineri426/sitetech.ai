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

    it("defaults to windows-1252 without BOM", async () => {
      // Create test data with windows-1252 specific character
      const testXER = sampleXER.replace("Foundation Work", "Foundation © Work");
      const buffer = Buffer.from(testXER, "binary");

      const activities = await parseXERToActivities(buffer, "test.xer");

      expect(activities.length).toBeGreaterThan(0);
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

    it("handles missing task_code gracefully", async () => {
      const xerWithEmptyCode = sampleXER.replace("A1000", "");
      const buffer = Buffer.from(xerWithEmptyCode, "utf-8");
      const activities = await parseXERToActivities(buffer, "test.xer");

      expect(activities[0].external_id).toBe("DEMO:");
      expect(activities[0].activity_code).toBeNull();
    });
  });

  describe("Indexed predecessors (O(1) lookup)", () => {
    it("builds predecessor relationships", async () => {
      const buffer = Buffer.from(sampleXER, "utf-8");
      const activities = await parseXERToActivities(buffer, "test.xer");

      const steelErection = activities.find((a) => a.activity_code === "A1010");
      expect(steelErection?.predecessors).toHaveLength(1);
      expect(steelErection?.predecessors[0].activity_id).toBe("1000");
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

  describe("Timezone parameter", () => {
    it("accepts timezone parameter", async () => {
      const buffer = Buffer.from(sampleXER, "utf-8");
      const activities = await parseXERToActivities(buffer, "test.xer", -8);

      expect(activities).toHaveLength(3);
      expect(activities[0].planned_start).toBe("2026-10-01");
    });

    it("extracts date part regardless of timezone", async () => {
      const buffer = Buffer.from(sampleXER, "utf-8");
      
      const activitiesUTC = await parseXERToActivities(buffer, "test.xer", 0);
      const activitiesPST = await parseXERToActivities(buffer, "test.xer", -8);

      // Currently we extract date-only, so timezone doesn't affect output
      expect(activitiesUTC[0].planned_start).toBe(activitiesPST[0].planned_start);
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
