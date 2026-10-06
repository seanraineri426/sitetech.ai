/**
 * Tests for Procore mappers: field allowlists, fingerprint stability, and mapping accuracy.
 */

import { describe, it, expect } from "vitest";
import {
  mapProcoreRFIToNormalized,
  mapProcoreSubmittalToNormalized,
  generateFingerprint,
  RFI_ALLOWLIST,
  SUBMITTAL_ALLOWLIST,
} from "../mappers";
import type { ProcoreRFI, ProcoreSubmittal } from "../types";

describe("Procore mappers", () => {
  describe("RFI mapping", () => {
    const mockRFI: ProcoreRFI = {
      id: 123,
      number: "RFI-001",
      subject: "Structural beam clarification",
      question: "What is the required beam size?",
      official_response: "Use W12x45 beam per detail A5",
      status: "answered",
      location: "Building A, Level 2",
      cost_code: {
        id: 456,
        name: "03-30-00",
      },
      specification_section: {
        number: "05 12 00",
        description: "Structural Steel Framing",
      },
      drawing_number: "S-201",
      ball_in_court: "Contractor",
      assignees: [
        {
          id: 789,
          name: "Jane Smith",
          email_address: "jane@example.com",
          company: {
            id: 111,
            name: "ABC Construction",
          },
        },
      ],
      responsible_contractor: {
        id: 111,
        name: "ABC Construction",
      },
      rfi_manager: {
        id: 222,
        name: "John Manager",
        email_address: "john@example.com",
      },
      received_from: {
        id: 333,
        name: "Bob Contractor",
        email_address: "bob@example.com",
        company: {
          id: 111,
          name: "ABC Construction",
        },
      },
      initiated_at: "2026-10-01T10:00:00Z",
      due_date: "2026-10-10",
      created_at: "2026-10-01T10:00:00Z",
      updated_at: "2026-10-05T14:30:00Z",
      cost_impact: {
        status: "yes_known",
        value: 5000,
      },
      schedule_impact: {
        status: "yes_unknown",
        value: null,
      },
      project: {
        id: 999,
      },
      company: {
        id: 12345,
      },
    };

    it("maps all allowlisted fields correctly", () => {
      const normalized = mapProcoreRFIToNormalized(mockRFI, "/rest/v1.0/projects/999/rfis");

      expect(normalized.source_id).toBe("123");
      expect(normalized.number).toBe("RFI-001");
      expect(normalized.subject).toBe("Structural beam clarification");
      expect(normalized.question).toBe("What is the required beam size?");
      expect(normalized.official_response).toBe("Use W12x45 beam per detail A5");
      expect(normalized.source_status).toBe("answered");
      expect(normalized.location).toBe("Building A, Level 2");
      expect(normalized.cost_code).toBe("03-30-00");
      expect(normalized.specification_section).toEqual({
        number: "05 12 00",
        description: "Structural Steel Framing",
      });
      expect(normalized.drawing_number).toBe("S-201");
      expect(normalized.ball_in_court).toBe("Contractor");
    });

    it("preserves raw cost_impact structure", () => {
      const normalized = mapProcoreRFIToNormalized(mockRFI, "/test");

      expect(normalized.cost_impact).toEqual({
        status: "yes_known",
        value: 5000,
      });
    });

    it("preserves raw schedule_impact structure", () => {
      const normalized = mapProcoreRFIToNormalized(mockRFI, "/test");

      expect(normalized.schedule_impact).toEqual({
        status: "yes_unknown",
        value: null,
      });
    });

    it("maps assignees with company", () => {
      const normalized = mapProcoreRFIToNormalized(mockRFI, "/test");

      expect(normalized.assignees).toHaveLength(1);
      expect(normalized.assignees[0]).toEqual({
        id: "789",
        name: "Jane Smith",
        email: "jane@example.com",
        company: "ABC Construction",
      });
    });

    it("generates stable fingerprint", () => {
      const normalized1 = mapProcoreRFIToNormalized(mockRFI, "/test");
      const normalized2 = mapProcoreRFIToNormalized(mockRFI, "/test");

      expect(normalized1.fingerprint).toBe(normalized2.fingerprint);
      expect(normalized1.fingerprint).toHaveLength(64); // SHA-256 hex
    });

    it("generates different fingerprint when data changes", () => {
      const normalized1 = mapProcoreRFIToNormalized(mockRFI, "/test");

      const modifiedRFI = {
        ...mockRFI,
        subject: "Modified subject",
      };
      const normalized2 = mapProcoreRFIToNormalized(modifiedRFI, "/test");

      expect(normalized1.fingerprint).not.toBe(normalized2.fingerprint);
    });

    it("includes source metadata", () => {
      const endpoint = "/rest/v1.0/projects/999/rfis";
      const normalized = mapProcoreRFIToNormalized(mockRFI, endpoint);

      expect(normalized.source_system).toBe("procore");
      expect(normalized.source_endpoint).toBe(endpoint);
      expect(normalized.synced_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe("Submittal mapping", () => {
    const mockSubmittal: ProcoreSubmittal = {
      id: 456,
      number: "SUB-025",
      title: "Structural Steel Shop Drawings",
      revision: "Rev B",
      status: "approved_as_noted",
      specification_section: "05 12 00",
      location: "Building A",
      cost_code: {
        id: 789,
        name: "05-12-00",
      },
      responsible_contractor: {
        id: 111,
        name: "Steel Fabricators Inc",
      },
      ball_in_court: "Design Team",
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
          email_address: "sarah@engineer.com",
          revision: "Rev A",
          response: "revise_resubmit",
          responded_at: "2026-09-25T14:00:00Z",
        },
        {
          id: 222,
          name: "Sarah Engineer",
          email_address: "sarah@engineer.com",
          revision: "Rev B",
          response: "approved_as_noted",
          responded_at: "2026-10-05T16:00:00Z",
        },
      ],
      scheduled_task: {
        id: 333,
        code: "A1020",
        name: "Install Structural Steel - Level 2",
      },
      project: {
        id: 999,
      },
      company: {
        id: 12345,
      },
    };

    it("maps all allowlisted fields correctly", () => {
      const normalized = mapProcoreSubmittalToNormalized(
        mockSubmittal,
        "/rest/v1.1/projects/999/submittals"
      );

      expect(normalized.source_id).toBe("456");
      expect(normalized.number).toBe("SUB-025");
      expect(normalized.title).toBe("Structural Steel Shop Drawings");
      expect(normalized.current_revision).toBe("Rev B");
      expect(normalized.source_status).toBe("approved_as_noted");
      expect(normalized.specification_section).toBe("05 12 00");
      expect(normalized.location).toBe("Building A");
      expect(normalized.cost_code).toBe("05-12-00");
    });

    it("preserves full approver revision history", () => {
      const normalized = mapProcoreSubmittalToNormalized(mockSubmittal, "/test");

      expect(normalized.approvers).toHaveLength(2);
      expect(normalized.approvers[0]).toEqual({
        id: "222",
        name: "Sarah Engineer",
        email: "sarah@engineer.com",
        revision: "Rev A",
        response: "revise_resubmit",
        responded_at: "2026-09-25T14:00:00Z",
      });
      expect(normalized.approvers[1].response).toBe("approved_as_noted");
    });

    it("keeps revise_resubmit as approver response", () => {
      const normalized = mapProcoreSubmittalToNormalized(mockSubmittal, "/test");

      const reviseResubmit = normalized.approvers.find(
        (a) => a.response === "revise_resubmit"
      );
      expect(reviseResubmit).toBeDefined();
    });

    it("includes timing fields", () => {
      const normalized = mapProcoreSubmittalToNormalized(mockSubmittal, "/test");

      expect(normalized.lead_time).toBe(45);
      expect(normalized.design_team_review_time).toBe(10);
      expect(normalized.internal_review_time).toBe(5);
      expect(normalized.buffer_time).toBe(3);
      expect(normalized.required_on_site_date).toBe("2026-11-01");
    });

    it("includes scheduled task linkage", () => {
      const normalized = mapProcoreSubmittalToNormalized(mockSubmittal, "/test");

      expect(normalized.scheduled_task).toEqual({
        id: "333",
        code: "A1020",
        name: "Install Structural Steel - Level 2",
      });
    });

    it("generates stable fingerprint", () => {
      const normalized1 = mapProcoreSubmittalToNormalized(mockSubmittal, "/test");
      const normalized2 = mapProcoreSubmittalToNormalized(mockSubmittal, "/test");

      expect(normalized1.fingerprint).toBe(normalized2.fingerprint);
      expect(normalized1.fingerprint).toHaveLength(64);
    });

    it("does NOT include description field", () => {
      const normalized = mapProcoreSubmittalToNormalized(mockSubmittal, "/test");

      expect(normalized).not.toHaveProperty("description");
    });
  });

  describe("Field allowlists", () => {
    it("RFI allowlist includes all CTO-approved fields", () => {
      const expectedFields = [
        "id",
        "number",
        "subject",
        "question",
        "official_response",
        "status",
        "location",
        "cost_code",
        "specification_section",
        "drawing_number",
        "ball_in_court",
        "assignees",
        "responsible_contractor",
        "rfi_manager",
        "received_from",
        "initiated_at",
        "due_date",
        "created_at",
        "updated_at",
        "cost_impact",
        "schedule_impact",
        "project.id",
        "company.id",
      ];

      expectedFields.forEach((field) => {
        expect(RFI_ALLOWLIST).toContain(field);
      });
    });

    it("Submittal allowlist includes all CTO-approved fields", () => {
      const expectedFields = [
        "id",
        "number",
        "title",
        "revision",
        "status",
        "specification_section",
        "location",
        "cost_code",
        "responsible_contractor",
        "ball_in_court",
        "created_at",
        "updated_at",
        "received_date",
        "due_date",
        "required_on_site_date",
        "lead_time",
        "design_team_review_time",
        "internal_review_time",
        "buffer_time",
        "approvers",
        "scheduled_task",
        "project.id",
        "company.id",
      ];

      expectedFields.forEach((field) => {
        expect(SUBMITTAL_ALLOWLIST).toContain(field);
      });
    });

    it("Submittal allowlist does NOT include description", () => {
      expect(SUBMITTAL_ALLOWLIST).not.toContain("description");
    });
  });

  describe("Fingerprint generation", () => {
    it("generates consistent fingerprints for same data", () => {
      const data = { id: 1, name: "test", value: 100 };
      const fp1 = generateFingerprint(data);
      const fp2 = generateFingerprint(data);

      expect(fp1).toBe(fp2);
    });

    it("generates different fingerprints for different data", () => {
      const data1 = { id: 1, name: "test" };
      const data2 = { id: 1, name: "different" };

      const fp1 = generateFingerprint(data1);
      const fp2 = generateFingerprint(data2);

      expect(fp1).not.toBe(fp2);
    });

    it("generates fingerprints independent of key order", () => {
      const data1 = { a: 1, b: 2, c: 3 };
      const data2 = { c: 3, a: 1, b: 2 };

      const fp1 = generateFingerprint(data1);
      const fp2 = generateFingerprint(data2);

      expect(fp1).toBe(fp2);
    });
  });
});
