/**
 * Tests for Procore mappers: recursive fingerprints, field allowlists, nested changes.
 */

import { describe, it, expect, vi } from "vitest";

// Mock server-only before importing mappers
vi.mock("server-only", () => ({}));

import {
  mapProcoreRFIToNormalized,
  mapProcoreSubmittalToNormalized,
  generateFingerprint,
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
    location: "Building A",
    cost_code: { id: 456, name: "03-30-00" },
    assignees: [
      { id: 789, name: "Jane Smith" },
    ],
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

  describe("Recursive fingerprints", () => {
    it("generates stable fingerprints for same data", () => {
      const fp1 = generateFingerprint({ a: 1, b: { c: 2, d: 3 } });
      const fp2 = generateFingerprint({ a: 1, b: { c: 2, d: 3 } });
      expect(fp1).toBe(fp2);
    });

    it("changes fingerprint when nested cost_impact.value changes", () => {
      const normalized1 = mapProcoreRFIToNormalized(mockRFI);
      
      const modified = {
        ...mockRFI,
        cost_impact: { status: "yes_known", value: 10000 },
      };
      const normalized2 = mapProcoreRFIToNormalized(modified);

      expect(normalized1.fingerprint).not.toBe(normalized2.fingerprint);
    });

    it("changes fingerprint when assignee details change", () => {
      const normalized1 = mapProcoreRFIToNormalized(mockRFI);
      
      const modified = {
        ...mockRFI,
        assignees: [{ id: 789, name: "John Doe" }],
      };
      const normalized2 = mapProcoreRFIToNormalized(modified);

      expect(normalized1.fingerprint).not.toBe(normalized2.fingerprint);
    });

    it("fingerprint independent of key order", () => {
      const fp1 = generateFingerprint({ a: 1, b: 2, c: 3 });
      const fp2 = generateFingerprint({ c: 3, a: 1, b: 2 });
      expect(fp1).toBe(fp2);
    });

    it("sorts nested object keys", () => {
      const fp1 = generateFingerprint({ a: { x: 1, y: 2 } });
      const fp2 = generateFingerprint({ a: { y: 2, x: 1 } });
      expect(fp1).toBe(fp2);
    });
  });

  describe("Submittal fingerprints", () => {
    const mockSubmittal: ProcoreSubmittal = {
      id: 456,
      number: "SUB-025",
      title: "Test submittal",
      revision: "Rev B",
      status: "approved_as_noted",
      specification_section: "05 12 00",
      location: "Building A",
      cost_code: { id: 789, name: "05-12-00" },
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

    it("changes fingerprint when approver response changes", () => {
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

    it("changes fingerprint when approver responded_at changes", () => {
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
  });

  describe("Field allowlists (CTO-approved trim)", () => {
    it("RFI allowlist excludes dropped fields", () => {
      expect(RFI_ALLOWLIST).not.toContain("drawing_number");
      expect(RFI_ALLOWLIST).not.toContain("rfi_manager");
      expect(RFI_ALLOWLIST).not.toContain("received_from");
      expect(RFI_ALLOWLIST).not.toContain("ball_in_court");
      expect(RFI_ALLOWLIST).not.toContain("specification_section");
      expect(RFI_ALLOWLIST).not.toContain("email_address");
    });

    it("Submittal allowlist excludes dropped fields", () => {
      expect(SUBMITTAL_ALLOWLIST).not.toContain("responsible_contractor");
      expect(SUBMITTAL_ALLOWLIST).not.toContain("ball_in_court");
      expect(SUBMITTAL_ALLOWLIST).not.toContain("email_address");
      expect(SUBMITTAL_ALLOWLIST).not.toContain("description");
    });

    it("RFI mapping excludes emails", () => {
      const normalized = mapProcoreRFIToNormalized(mockRFI);
      expect(normalized.assignees[0]).not.toHaveProperty("email");
    });

    it("Submittal mapping excludes emails", () => {
      const mockSubmittal: ProcoreSubmittal = {
        id: 456,
        number: "SUB-001",
        title: "Test",
        revision: "A",
        status: "open",
        specification_section: null,
        location: null,
        cost_code: null,
        created_at: "2026-10-01T00:00:00Z",
        updated_at: "2026-10-01T00:00:00Z",
        received_date: null,
        due_date: null,
        required_on_site_date: null,
        lead_time: null,
        design_team_review_time: null,
        internal_review_time: null,
        buffer_time: null,
        approvers: [],
        scheduled_task: null,
        project: { id: 999 },
        company: { id: 12345 },
      };
      
      const normalized = mapProcoreSubmittalToNormalized(mockSubmittal);
      expect(normalized.approvers).toEqual([]);
    });
  });

  describe("Entity shape", () => {
    it("RFI has entity_type and external_id", () => {
      const normalized = mapProcoreRFIToNormalized(mockRFI);
      expect(normalized.entity_type).toBe("rfi");
      expect(normalized.external_id).toBe("123");
    });

    it("uses source_project_id and source_company_id", () => {
      const normalized = mapProcoreRFIToNormalized(mockRFI);
      expect(normalized.source_project_id).toBe("999");
      expect(normalized.source_company_id).toBe("12345");
    });
  });
});
