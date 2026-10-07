/**
 * Comprehensive tests for Procore mappers.
 * Covers recursive fingerprints, allowlist trimming, and field mapping.
 */

import { describe, it, expect, vi } from "vitest";

// Mock server-only before importing mappers
vi.mock("server-only", () => ({}));

import {
  mapProcoreRFIToNormalized,
  mapProcoreSubmittalToNormalized,
  generateFingerprint,
  rfiToRawRecord,
  submittalToRawRecord,
  RFI_ALLOWLIST,
  SUBMITTAL_ALLOWLIST,
} from "../mappers";
import type { ProcoreRFI, ProcoreSubmittal } from "../types";

describe("Procore mappers", () => {
  const mockRFI: ProcoreRFI = {
    id: 123,
    number: "RFI-001",
    subject: "Test subject",
    question: "Test question?",
    official_response: "Test response",
    status: "answered",
    location: { id: 100, name: "Building A" },
    cost_code: { id: 456, code: "03-30-00", name: "Concrete" },
    assignees: [{ id: 789, name: "Jane Smith" }],
    responsible_contractor: { id: 111, name: "ABC Construction" },
    initiated_at: "2026-10-01T10:00:00Z",
    due_date: "2026-10-10",
    created_at: "2026-10-01T10:00:00Z",
    updated_at: "2026-10-05T14:30:00Z",
    cost_impact: { status: "yes_known", value: 5000 },
    schedule_impact: { status: "yes_unknown", value: null },
    project: { id: 999 },
    company: { id: 12345 },
  };

  const mockSubmittal: ProcoreSubmittal = {
    id: 456,
    number: "SUB-025",
    title: "Test submittal",
    revision: "Rev B",
    status: "approved_as_noted",
    specification_section: "05 12 00",
    location: { id: 200, name: "Building A" },
    cost_code: { id: 789, code: "05-12-00", name: "Structural Steel" },
    created_at: "2026-09-15T08:00:00Z",
    updated_at: "2026-10-05T16:00:00Z",
    received_date: "2026-09-15",
    due_date: "2026-09-30",
    required_on_site_date: "2026-11-01",
    lead_time: 45,
    design_team_review_time: 10,
    internal_review_time: 5,
    buffer_time: 3,
    approvers: [
      {
        id: 222,
        name: "Sarah Engineer",
        revision: "Rev A",
        response: "revise_resubmit",
        responded_at: "2026-09-25T14:00:00Z",
      },
    ],
    scheduled_task: { id: 333, code: "A1020", name: "Install Steel" },
    project: { id: 999 },
    company: { id: 12345 },
  };

  describe("Recursive fingerprints", () => {
    it("generates stable fingerprints for same data", () => {
      const fp1 = generateFingerprint({ a: 1, b: { c: 2, d: 3 } });
      const fp2 = generateFingerprint({ a: 1, b: { c: 2, d: 3 } });
      expect(fp1).toBe(fp2);
    });

    it("generates same fingerprint regardless of key order", () => {
      const fp1 = generateFingerprint({ a: 1, b: 2, c: 3 });
      const fp2 = generateFingerprint({ c: 3, a: 1, b: 2 });
      expect(fp1).toBe(fp2);
    });

    it("generates same fingerprint regardless of nested key order", () => {
      const fp1 = generateFingerprint({ outer: { a: 1, b: 2 }, x: 5 });
      const fp2 = generateFingerprint({ x: 5, outer: { b: 2, a: 1 } });
      expect(fp1).toBe(fp2);
    });

    it("generates same fingerprint regardless of deep nested key order", () => {
      const fp1 = generateFingerprint({
        a: { b: { c: 1, d: 2 }, e: 3 },
        f: 4,
      });
      const fp2 = generateFingerprint({
        f: 4,
        a: { e: 3, b: { d: 2, c: 1 } },
      });
      expect(fp1).toBe(fp2);
    });

    it("preserves array order", () => {
      const fp1 = generateFingerprint({ items: [1, 2, 3] });
      const fp2 = generateFingerprint({ items: [3, 2, 1] });
      expect(fp1).not.toBe(fp2);
    });
  });

  describe("RFI fingerprint changes", () => {
    it("changes when cost_impact.value changes", () => {
      const normalized1 = mapProcoreRFIToNormalized(mockRFI);
      const modified = {
        ...mockRFI,
        cost_impact: { status: "yes_known", value: 10000 },
      };
      const normalized2 = mapProcoreRFIToNormalized(modified);

      expect(normalized1.fingerprint).not.toBe(normalized2.fingerprint);
    });

    it("changes when cost_impact.status changes", () => {
      const normalized1 = mapProcoreRFIToNormalized(mockRFI);
      const modified = {
        ...mockRFI,
        cost_impact: { status: "no_impact", value: 5000 },
      };
      const normalized2 = mapProcoreRFIToNormalized(modified);

      expect(normalized1.fingerprint).not.toBe(normalized2.fingerprint);
    });

    it("changes when schedule_impact.value changes", () => {
      const normalized1 = mapProcoreRFIToNormalized(mockRFI);
      const modified = {
        ...mockRFI,
        schedule_impact: { status: "yes_unknown", value: 7 },
      };
      const normalized2 = mapProcoreRFIToNormalized(modified);

      expect(normalized1.fingerprint).not.toBe(normalized2.fingerprint);
    });

    it("changes when assignee name changes", () => {
      const normalized1 = mapProcoreRFIToNormalized(mockRFI);
      const modified = {
        ...mockRFI,
        assignees: [{ id: 789, name: "John Doe" }],
      };
      const normalized2 = mapProcoreRFIToNormalized(modified);

      expect(normalized1.fingerprint).not.toBe(normalized2.fingerprint);
    });

    it("changes when assignee id changes", () => {
      const normalized1 = mapProcoreRFIToNormalized(mockRFI);
      const modified = {
        ...mockRFI,
        assignees: [{ id: 999, name: "Jane Smith" }],
      };
      const normalized2 = mapProcoreRFIToNormalized(modified);

      expect(normalized1.fingerprint).not.toBe(normalized2.fingerprint);
    });

    it("changes when assignee is added", () => {
      const normalized1 = mapProcoreRFIToNormalized(mockRFI);
      const modified = {
        ...mockRFI,
        assignees: [
          ...mockRFI.assignees,
          { id: 888, name: "Bob Builder" },
        ],
      };
      const normalized2 = mapProcoreRFIToNormalized(modified);

      expect(normalized1.fingerprint).not.toBe(normalized2.fingerprint);
    });
  });

  describe("Submittal fingerprint changes", () => {
    it("changes when approver response changes", () => {
      const normalized1 = mapProcoreSubmittalToNormalized(mockSubmittal);
      const modified = {
        ...mockSubmittal,
        approvers: [
          {
            ...mockSubmittal.approvers[0],
            response: "approved",
          },
        ],
      };
      const normalized2 = mapProcoreSubmittalToNormalized(modified);

      expect(normalized1.fingerprint).not.toBe(normalized2.fingerprint);
    });

    it("changes when approver responded_at changes", () => {
      const normalized1 = mapProcoreSubmittalToNormalized(mockSubmittal);
      const modified = {
        ...mockSubmittal,
        approvers: [
          {
            ...mockSubmittal.approvers[0],
            responded_at: "2026-09-26T14:00:00Z",
          },
        ],
      };
      const normalized2 = mapProcoreSubmittalToNormalized(modified);

      expect(normalized1.fingerprint).not.toBe(normalized2.fingerprint);
    });

    it("changes when approver name changes", () => {
      const normalized1 = mapProcoreSubmittalToNormalized(mockSubmittal);
      const modified = {
        ...mockSubmittal,
        approvers: [
          {
            ...mockSubmittal.approvers[0],
            name: "John Architect",
          },
        ],
      };
      const normalized2 = mapProcoreSubmittalToNormalized(modified);

      expect(normalized1.fingerprint).not.toBe(normalized2.fingerprint);
    });

    it("changes when approver revision changes", () => {
      const normalized1 = mapProcoreSubmittalToNormalized(mockSubmittal);
      const modified = {
        ...mockSubmittal,
        approvers: [
          {
            ...mockSubmittal.approvers[0],
            revision: "Rev B",
          },
        ],
      };
      const normalized2 = mapProcoreSubmittalToNormalized(modified);

      expect(normalized1.fingerprint).not.toBe(normalized2.fingerprint);
    });

    it("does NOT change when non-allowlisted field changes (approver email)", () => {
      const normalized1 = mapProcoreSubmittalToNormalized(mockSubmittal);
      const modified = {
        ...mockSubmittal,
        approvers: [
          {
            ...mockSubmittal.approvers[0],
            email: "new-email@example.com", // Non-allowlisted field
          } as unknown as typeof mockSubmittal.approvers[0],
        ],
      };
      const normalized2 = mapProcoreSubmittalToNormalized(modified);

      // Fingerprint should be SAME because email is not in allowlist
      expect(normalized1.fingerprint).toBe(normalized2.fingerprint);
    });
  });

  describe("RFI nested object fingerprinting", () => {
    it("does NOT change when non-allowlisted contractor field changes (email)", () => {
      const normalized1 = mapProcoreRFIToNormalized(mockRFI);
      const modified = {
        ...mockRFI,
        responsible_contractor: {
          ...mockRFI.responsible_contractor!,
          email: "new-email@contractor.com", // Non-allowlisted field
        } as unknown as typeof mockRFI.responsible_contractor,
      };
      const normalized2 = mapProcoreRFIToNormalized(modified);

      // Fingerprint should be SAME because contractor email is not in allowlist
      expect(normalized1.fingerprint).toBe(normalized2.fingerprint);
    });

    it("does NOT change when non-allowlisted cost_code field changes", () => {
      const normalized1 = mapProcoreRFIToNormalized(mockRFI);
      const modified = {
        ...mockRFI,
        cost_code: {
          ...mockRFI.cost_code!,
          description: "New description", // Non-allowlisted field
        } as unknown as typeof mockRFI.cost_code,
      };
      const normalized2 = mapProcoreRFIToNormalized(modified);

      // Fingerprint should be SAME because description is not in allowlist
      expect(normalized1.fingerprint).toBe(normalized2.fingerprint);
    });

    it("does NOT change when non-allowlisted assignee field changes (login)", () => {
      const normalized1 = mapProcoreRFIToNormalized(mockRFI);
      const modified = {
        ...mockRFI,
        assignees: [
          {
            ...mockRFI.assignees[0],
            login: "new-login@example.com", // Non-allowlisted field per CTO
          } as unknown as typeof mockRFI.assignees[0],
        ],
      };
      const normalized2 = mapProcoreRFIToNormalized(modified);

      // Fingerprint should be SAME because login/email is not in allowlist
      expect(normalized1.fingerprint).toBe(normalized2.fingerprint);
    });
  });

  describe("Field allowlists (CTO-approved trim)", () => {
    it("RFI allowlist excludes dropped fields", () => {
      expect(RFI_ALLOWLIST).not.toContain("drawing_number");
      expect(RFI_ALLOWLIST).not.toContain("rfi_manager");
      expect(RFI_ALLOWLIST).not.toContain("received_from");
      expect(RFI_ALLOWLIST).not.toContain("ball_in_court");
      expect(RFI_ALLOWLIST).not.toContain("specification_section");
      expect(RFI_ALLOWLIST).not.toContain("email_address");
      expect(RFI_ALLOWLIST).not.toContain("email");
    });

    it("RFI allowlist includes approved fields", () => {
      expect(RFI_ALLOWLIST).toContain("id");
      expect(RFI_ALLOWLIST).toContain("number");
      expect(RFI_ALLOWLIST).toContain("subject");
      expect(RFI_ALLOWLIST).toContain("question");
      expect(RFI_ALLOWLIST).toContain("official_response");
      expect(RFI_ALLOWLIST).toContain("status");
      expect(RFI_ALLOWLIST).toContain("cost_impact");
      expect(RFI_ALLOWLIST).toContain("schedule_impact");
      expect(RFI_ALLOWLIST).toContain("assignees");
      expect(RFI_ALLOWLIST).toContain("responsible_contractor");
    });

    it("Submittal allowlist excludes dropped fields", () => {
      expect(SUBMITTAL_ALLOWLIST).not.toContain("responsible_contractor");
      expect(SUBMITTAL_ALLOWLIST).not.toContain("ball_in_court");
      expect(SUBMITTAL_ALLOWLIST).not.toContain("email_address");
      expect(SUBMITTAL_ALLOWLIST).not.toContain("email");
      expect(SUBMITTAL_ALLOWLIST).not.toContain("description");
    });

    it("Submittal allowlist includes approved fields", () => {
      expect(SUBMITTAL_ALLOWLIST).toContain("id");
      expect(SUBMITTAL_ALLOWLIST).toContain("number");
      expect(SUBMITTAL_ALLOWLIST).toContain("title");
      expect(SUBMITTAL_ALLOWLIST).toContain("specification_section");
      expect(SUBMITTAL_ALLOWLIST).toContain("approvers");
      expect(SUBMITTAL_ALLOWLIST).toContain("scheduled_task");
    });

    it("RFI mapping excludes emails from assignees", () => {
      const normalized = mapProcoreRFIToNormalized(mockRFI);
      expect(normalized.assignees[0]).not.toHaveProperty("email");
      expect(normalized.assignees[0]).not.toHaveProperty("email_address");
    });

    it("Submittal mapping excludes emails from approvers", () => {
      const normalized = mapProcoreSubmittalToNormalized(mockSubmittal);
      expect(normalized.approvers[0]).not.toHaveProperty("email");
      expect(normalized.approvers[0]).not.toHaveProperty("email_address");
    });

    it("RFI mapping drops description field", () => {
      const normalized = mapProcoreRFIToNormalized(mockRFI);
      expect(normalized).not.toHaveProperty("description");
    });

    it("Submittal mapping drops description field", () => {
      const normalized = mapProcoreSubmittalToNormalized(mockSubmittal);
      expect(normalized).not.toHaveProperty("description");
    });

    it("RFI mapping drops attachments", () => {
      const normalized = mapProcoreRFIToNormalized(mockRFI);
      expect(normalized).not.toHaveProperty("attachments");
    });

    it("Submittal mapping drops attachments", () => {
      const normalized = mapProcoreSubmittalToNormalized(mockSubmittal);
      expect(normalized).not.toHaveProperty("attachments");
    });
  });

  describe("Entity shape", () => {
    it("RFI has entity_type", () => {
      const normalized = mapProcoreRFIToNormalized(mockRFI);
      expect(normalized.entity_type).toBe("rfi");
    });

    it("RFI has external_id", () => {
      const normalized = mapProcoreRFIToNormalized(mockRFI);
      expect(normalized.external_id).toBe("123");
    });

    it("RFI uses source_project_id", () => {
      const normalized = mapProcoreRFIToNormalized(mockRFI);
      expect(normalized.source_project_id).toBe("999");
      expect(normalized).not.toHaveProperty("project_id");
    });

    it("RFI uses source_company_id", () => {
      const normalized = mapProcoreRFIToNormalized(mockRFI);
      expect(normalized.source_company_id).toBe("12345");
      expect(normalized).not.toHaveProperty("company_id");
    });

    it("RFI does not have synced_at", () => {
      const normalized = mapProcoreRFIToNormalized(mockRFI);
      expect(normalized).not.toHaveProperty("synced_at");
    });

    it("Submittal has entity_type", () => {
      const normalized = mapProcoreSubmittalToNormalized(mockSubmittal);
      expect(normalized.entity_type).toBe("submittal");
    });

    it("Submittal has external_id", () => {
      const normalized = mapProcoreSubmittalToNormalized(mockSubmittal);
      expect(normalized.external_id).toBe("456");
    });

    it("Submittal does not have synced_at", () => {
      const normalized = mapProcoreSubmittalToNormalized(mockSubmittal);
      expect(normalized).not.toHaveProperty("synced_at");
    });
  });

  describe("Raw record conversion", () => {
    it("converts RFI to raw record shape", () => {
      const normalized = mapProcoreRFIToNormalized(mockRFI);
      const raw = rfiToRawRecord(normalized);

      expect(raw.entityType).toBe("rfi");
      expect(raw.externalId).toBe("123");
      expect(raw.fingerprint).toBe(normalized.fingerprint);
      expect(raw.allowlistedPayload).toHaveProperty("number");
      expect(raw.allowlistedPayload).toHaveProperty("subject");
      expect(raw.allowlistedPayload).toHaveProperty("cost_impact");
    });

    it("converts Submittal to raw record shape", () => {
      const normalized = mapProcoreSubmittalToNormalized(mockSubmittal);
      const raw = submittalToRawRecord(normalized);

      expect(raw.entityType).toBe("submittal");
      expect(raw.externalId).toBe("456");
      expect(raw.fingerprint).toBe(normalized.fingerprint);
      expect(raw.allowlistedPayload).toHaveProperty("number");
      expect(raw.allowlistedPayload).toHaveProperty("title");
      expect(raw.allowlistedPayload).toHaveProperty("approvers");
    });
  });

  describe("Null and missing field handling", () => {
    it("handles null cost_impact", () => {
      const rfi = { ...mockRFI, cost_impact: null };
      const normalized = mapProcoreRFIToNormalized(rfi);
      expect(normalized.cost_impact).toBeNull();
    });

    it("handles null schedule_impact", () => {
      const rfi = { ...mockRFI, schedule_impact: null };
      const normalized = mapProcoreRFIToNormalized(rfi);
      expect(normalized.schedule_impact).toBeNull();
    });

    it("handles null cost_code", () => {
      const rfi = { ...mockRFI, cost_code: null };
      const normalized = mapProcoreRFIToNormalized(rfi);
      expect(normalized.cost_code).toBeNull();
    });

    it("handles null responsible_contractor", () => {
      const rfi = { ...mockRFI, responsible_contractor: null };
      const normalized = mapProcoreRFIToNormalized(rfi);
      expect(normalized.responsible_contractor).toBeNull();
    });

    it("handles empty assignees array", () => {
      const rfi = { ...mockRFI, assignees: [] };
      const normalized = mapProcoreRFIToNormalized(rfi);
      expect(normalized.assignees).toEqual([]);
    });

    it("handles empty approvers array", () => {
      const submittal = { ...mockSubmittal, approvers: [] };
      const normalized = mapProcoreSubmittalToNormalized(submittal);
      expect(normalized.approvers).toEqual([]);
    });

    it("handles null scheduled_task", () => {
      const submittal = { ...mockSubmittal, scheduled_task: null };
      const normalized = mapProcoreSubmittalToNormalized(submittal);
      expect(normalized.scheduled_task).toBeNull();
    });
  });
});
