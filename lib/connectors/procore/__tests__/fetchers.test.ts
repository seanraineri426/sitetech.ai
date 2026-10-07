/**
 * Tests for Procore fetchers.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock server-only before importing
vi.mock("server-only", () => ({}));

import { fetchRFIs, fetchSubmittals, listRFIIds, listSubmittalIds } from "../fetchers";
import { ProcoreClient } from "../client";
import type { ProcoreRFI, ProcoreSubmittal } from "../types";

describe("Procore fetchers", () => {
  let mockClient: ProcoreClient;

  beforeEach(() => {
    mockClient = {
      paginate: vi.fn(),
    } as unknown as ProcoreClient;
  });

  describe("fetchRFIs", () => {
    it("fetches RFIs and returns normalized entities", async () => {
      const mockRFIData: ProcoreRFI[] = [
        {
          id: 123,
          number: "RFI-001",
          subject: "Test",
          question: "Q",
          official_response: "A",
          status: "open",
          location: null,
          cost_code: null,
          assignees: [],
          responsible_contractor: null,
          initiated_at: "2026-10-01",
          due_date: null,
          created_at: "2026-10-01",
          updated_at: "2026-10-01",
          cost_impact: null,
          schedule_impact: null,
          project: { id: 999 },
          company: { id: 12345 },
        },
      ];

      (mockClient.paginate as ReturnType<typeof vi.fn>).mockReturnValue(
        (async function* () {
          yield mockRFIData;
        })()
      );

      const results: unknown[] = [];
      for await (const page of fetchRFIs(mockClient, "999")) {
        results.push(...page);
      }

      expect(results).toHaveLength(1);
      expect(results[0]).toHaveProperty("entity_type", "rfi");
      expect(results[0]).toHaveProperty("external_id", "123");
      expect(results[0]).toHaveProperty("fingerprint");
    });

    it("applies updatedSince filter with overlap", async () => {
      (mockClient.paginate as ReturnType<typeof vi.fn>).mockReturnValue(
        (async function* () {
          yield [];
        })()
      );

      for await (const page of fetchRFIs(mockClient, "999", {
        updatedSince: "2026-10-01T12:00:00Z",
      })) {
        // consume generator
        void page;
      }

      expect(mockClient.paginate).toHaveBeenCalledWith(
        "/rest/v1.0/projects/999/rfis",
        expect.objectContaining({
          "filters[updated_at]": expect.stringContaining("2026-10-01"),
        }),
        100
      );

      const call = (mockClient.paginate as ReturnType<typeof vi.fn>).mock.calls[0];
      const params = call[1] as Record<string, string>;
      const [start] = params["filters[updated_at]"].split("...");
      
      // Should subtract 15 minutes
      expect(new Date(start).getTime()).toBeLessThan(
        new Date("2026-10-01T12:00:00Z").getTime()
      );
    });

    it("applies deletedOnly filter", async () => {
      (mockClient.paginate as ReturnType<typeof vi.fn>).mockReturnValue(
        (async function* () {
          yield [];
        })()
      );

      for await (const page of fetchRFIs(mockClient, "999", {
        deletedOnly: true,
      })) {
        // consume generator
        void page;
      }

      expect(mockClient.paginate).toHaveBeenCalledWith(
        "/rest/v1.0/projects/999/rfis",
        expect.objectContaining({
          "filters[include_deleted]": "only",
        }),
        100
      );
    });

    it("respects perPage option", async () => {
      (mockClient.paginate as ReturnType<typeof vi.fn>).mockReturnValue(
        (async function* () {
          yield [];
        })()
      );

      for await (const page of fetchRFIs(mockClient, "999", {
        perPage: 50,
      })) {
        // consume generator
        void page;
      }

      expect(mockClient.paginate).toHaveBeenCalledWith(
        "/rest/v1.0/projects/999/rfis",
        {},
        50
      );
    });
  });

  describe("listRFIIds", () => {
    it("returns only IDs", async () => {
      const mockRFIData: ProcoreRFI[] = [
        {
          id: 123,
          number: "RFI-001",
          subject: "",
          question: null,
          official_response: null,
          status: "",
          location: null,
          cost_code: null,
          assignees: [],
          responsible_contractor: null,
          initiated_at: null,
          due_date: null,
          created_at: "",
          updated_at: "",
          cost_impact: null,
          schedule_impact: null,
          project: { id: 999 },
          company: { id: 12345 },
        },
        {
          id: 456,
          number: "RFI-002",
          subject: "",
          question: null,
          official_response: null,
          status: "",
          location: null,
          cost_code: null,
          assignees: [],
          responsible_contractor: null,
          initiated_at: null,
          due_date: null,
          created_at: "",
          updated_at: "",
          cost_impact: null,
          schedule_impact: null,
          project: { id: 999 },
          company: { id: 12345 },
        },
      ];

      (mockClient.paginate as ReturnType<typeof vi.fn>).mockReturnValue(
        (async function* () {
          yield mockRFIData;
        })()
      );

      const ids = await listRFIIds(mockClient, "999");

      expect(ids).toEqual(["123", "456"]);
    });

    it("uses higher perPage for efficiency", async () => {
      (mockClient.paginate as ReturnType<typeof vi.fn>).mockReturnValue(
        (async function* () {
          yield [];
        })()
      );

      await listRFIIds(mockClient, "999");

      expect(mockClient.paginate).toHaveBeenCalledWith(
        "/rest/v1.0/projects/999/rfis",
        {},
        1000
      );
    });
  });

  describe("fetchSubmittals", () => {
    it("fetches submittals and returns normalized entities", async () => {
      const mockSubmittalData: ProcoreSubmittal[] = [
        {
          id: 456,
          number: "SUB-001",
          title: "Test",
          revision: "A",
          status: "open",
          specification_section: null,
          location: null,
          cost_code: null,
          created_at: "2026-10-01",
          updated_at: "2026-10-01",
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
        },
      ];

      (mockClient.paginate as ReturnType<typeof vi.fn>).mockReturnValue(
        (async function* () {
          yield mockSubmittalData;
        })()
      );

      const results: unknown[] = [];
      for await (const page of fetchSubmittals(mockClient, "999")) {
        results.push(...page);
      }

      expect(results).toHaveLength(1);
      expect(results[0]).toHaveProperty("entity_type", "submittal");
      expect(results[0]).toHaveProperty("external_id", "456");
    });

    it("applies filters correctly", async () => {
      (mockClient.paginate as ReturnType<typeof vi.fn>).mockReturnValue(
        (async function* () {
          yield [];
        })()
      );

      for await (const page of fetchSubmittals(mockClient, "999", {
        updatedSince: "2026-10-01T12:00:00Z",
        deletedOnly: true,
        perPage: 25,
      })) {
        // consume generator
        void page;
      }

      expect(mockClient.paginate).toHaveBeenCalledWith(
        "/rest/v1.1/projects/999/submittals",
        expect.objectContaining({
          "filters[updated_at]": expect.any(String),
          "filters[include_deleted]": "only",
        }),
        25
      );
    });
  });

  describe("listSubmittalIds", () => {
    it("returns only IDs", async () => {
      const mockSubmittalData: ProcoreSubmittal[] = [
        {
          id: 456,
          number: "SUB-001",
          title: "",
          revision: null,
          status: "",
          specification_section: null,
          location: null,
          cost_code: null,
          created_at: "",
          updated_at: "",
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
        },
        {
          id: 789,
          number: "SUB-002",
          title: "",
          revision: null,
          status: "",
          specification_section: null,
          location: null,
          cost_code: null,
          created_at: "",
          updated_at: "",
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
        },
      ];

      (mockClient.paginate as ReturnType<typeof vi.fn>).mockReturnValue(
        (async function* () {
          yield mockSubmittalData;
        })()
      );

      const ids = await listSubmittalIds(mockClient, "999");

      expect(ids).toEqual(["456", "789"]);
    });
  });
});
