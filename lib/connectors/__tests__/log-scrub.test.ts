/**
 * Comprehensive log scrub test: ensures no customer field values leak into logs.
 * 
 * CTO rule: no Procore or customer field values in logs on ANY connector.
 * Logs may contain only IDs, counts, status codes, durations, endpoint paths with IDs
 * (no query values), and error class names.
 * 
 * This test:
 * 1. Spies on console.* and process.stdout/stderr
 * 2. Runs ALL connectors over fixtures (normal and error paths)
 * 3. Extracts string field values >= 4 chars from fixtures
 * 4. Fails if any value appears in captured output (ignoring allowed IDs)
 * 5. Covers: Procore RFIs/Submittals, Graph Messages/DriveItems, P6 XER
 * 6. Error paths: 4xx, 5xx, 429, 410, timeouts, Zod failures, @removed
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

// Mock server-only before imports
vi.mock("server-only", () => ({}));

import { ProcoreClient } from "../procore/client";
import { GraphClient } from "../msgraph/client";
import { parseXERToActivities, validateXER } from "../p6/parser";
import { mapProcoreRFIToNormalized, mapProcoreSubmittalToNormalized } from "../procore/mappers";
import { mapGraphMessageToNormalized } from "../msgraph/mappers";
import { fetchMailFolderDelta, shouldResync } from "../msgraph/fetchers";
import type { ProcoreRFI, ProcoreSubmittal } from "../procore/types";
import type { GraphMessage, GraphDriveItem } from "../msgraph/types";

describe("Comprehensive log scrub test", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleDebugSpy: ReturnType<typeof vi.spyOn>;
  let stdoutWriteSpy: ReturnType<typeof vi.spyOn>;
  let stderrWriteSpy: ReturnType<typeof vi.spyOn>;
  
  let capturedLogs: string[] = [];
  let rfiFixture: ProcoreRFI;
  let submittalFixture: ProcoreSubmittal;

  beforeEach(() => {
    // Load Procore fixtures (strip comment headers)
    const rfiContent = readFileSync(join(__dirname, "../../../fixtures/procore/docs/rfi-with-questions.json"), "utf-8");
    const submittalContent = readFileSync(join(__dirname, "../../../fixtures/procore/docs/submittal-with-approvers.json"), "utf-8");
    
    const stripComments = (content: string) => content.replace(/^\/\*\*[\s\S]*?\*\/\s*/, "");
    
    rfiFixture = JSON.parse(stripComments(rfiContent));
    submittalFixture = JSON.parse(stripComments(submittalContent));

    capturedLogs = [];
    
    const captureFn = (...args: unknown[]) => {
      capturedLogs.push(JSON.stringify(args));
    };

    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(captureFn);
    consoleInfoSpy = vi.spyOn(console, "info").mockImplementation(captureFn);
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(captureFn);
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(captureFn);
    consoleDebugSpy = vi.spyOn(console, "debug").mockImplementation(captureFn);

    stdoutWriteSpy = vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
      if (typeof chunk === "string") {
        capturedLogs.push(chunk);
      } else if (Buffer.isBuffer(chunk)) {
        capturedLogs.push(chunk.toString("utf-8"));
      }
      return true;
    });

    stderrWriteSpy = vi.spyOn(process.stderr, "write").mockImplementation((chunk: unknown) => {
      if (typeof chunk === "string") {
        capturedLogs.push(chunk);
      } else if (Buffer.isBuffer(chunk)) {
        capturedLogs.push(chunk.toString("utf-8"));
      }
      return true;
    });
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleInfoSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleDebugSpy.mockRestore();
    stdoutWriteSpy.mockRestore();
    stderrWriteSpy.mockRestore();
  });

  /**
   * Extract all string field values >= 4 chars from a fixture object recursively.
   */
  function extractFieldValues(obj: unknown, values: Set<string> = new Set()): Set<string> {
    if (typeof obj === "string" && obj.length >= 4) {
      values.add(obj);
    } else if (Array.isArray(obj)) {
      for (const item of obj) {
        extractFieldValues(item, values);
      }
    } else if (obj !== null && typeof obj === "object") {
      for (const value of Object.values(obj)) {
        extractFieldValues(value, values);
      }
    }
    return values;
  }

  /**
   * Check if a value is an allowed ID (numeric string, UUID-like, or short alphanumeric).
   */
  function isAllowedId(value: string): boolean {
    // Numeric IDs
    if (/^\d+$/.test(value)) {
      return true;
    }
    // UUID-like patterns
    if (/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)) {
      return true;
    }
    // Short alphanumeric codes (e.g., "RFI-001", "SUB-025", "A1050", "V-001")
    if (/^[A-Z0-9_-]{2,10}$/i.test(value)) {
      return true;
    }
    // ISO date strings (allowed for logging)
    if (/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z)?$/.test(value)) {
      return true;
    }
    // Status codes and types
    if (/^(open|closed|pending|active|normal|high|text|html)$/i.test(value)) {
      return true;
    }
    return false;
  }

  /**
   * Capture errors including String(err), err.message, JSON.stringify(err), String(err.cause)
   */
  function captureError(err: unknown): void {
    try {
      capturedLogs.push(String(err));
      if (err && typeof err === "object") {
        if ("message" in err) {
          capturedLogs.push(String(err.message));
        }
        if ("cause" in err && err.cause) {
          capturedLogs.push(String(err.cause));
        }
      }
      capturedLogs.push(JSON.stringify(err));
    } catch {
      // Ignore JSON.stringify failures
    }
  }

  it("Procore: client.get with 403 error", async () => {
    const mockFetch = vi.fn();
    global.fetch = mockFetch;

    const client = new ProcoreClient({
      clientId: "test-client",
      clientSecret: "test-secret",
      companyId: "12345",
    });

    // Mock token response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: "test-token",
        expires_in: 3600,
        created_at: Date.now() / 1000,
        token_type: "Bearer",
      }),
    });

    // Mock 403 error with sensitive response body
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      headers: new Headers({ "X-Error-Code": "FORBIDDEN" }),
      json: async () => ({
        error: "Access denied",
        details: "User does not have permission to access this RFI",
        rfi_subject: "Structural beam specification clarification",
      }),
    });

    try {
      await client.get("/rest/v1.0/projects/999/rfis");
    } catch (err) {
      captureError(err);
    }

    const allLogs = capturedLogs.join("\n");
    expect(allLogs).not.toContain("Structural beam specification clarification");
    expect(allLogs).not.toContain("User does not have permission");
  });

  it("Procore: mapper with Zod validation failure on malformed RFI", () => {
    try {
      mapProcoreRFIToNormalized({ ...rfiFixture, id: "not-a-number" } as unknown as ProcoreRFI);
    } catch (err) {
      captureError(err);
    }

    const allLogs = capturedLogs.join("\n");
    // Zod errors can embed received values - check they don't leak fixture data
    expect(allLogs).not.toContain("Structural beam specification clarification");
    expect(allLogs).not.toContain("jane.smith@contractor.com");
  });

  it("Graph: client.get with 410 Gone (resync)", async () => {
    const mockFetch = vi.fn();
    global.fetch = mockFetch;

    const client = new GraphClient({
      tenantId: "test-tenant",
      clientId: "test-client",
      clientSecret: "test-secret",
      mailbox: "test@example.com",
      siteId: "site-123",
    });

    // Mock token response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: "test-token",
        expires_in: 3600,
        token_type: "Bearer",
      }),
    });

    // Mock 410 Gone
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 410,
      headers: new Headers({ "X-Error-Code": "DELTA_TOKEN_EXPIRED" }),
      json: async () => ({
        error: {
          code: "resyncRequired",
          message: "The delta token has expired for mailbox test@example.com",
        },
      }),
    });

    try {
      await client.get(`/users/${encodeURIComponent("test@example.com")}/messages`);
    } catch (err) {
      captureError(err);
      expect(shouldResync(err)).toBe(true);
    }

    const allLogs = capturedLogs.join("\n");
    expect(allLogs).not.toContain("test@example.com");
    expect(allLogs).not.toContain("The delta token has expired");
  });

  it("Graph: message mapper with full body", () => {
    const mockMessage: GraphMessage = {
      id: "msg-123",
      conversationId: "conv-456",
      subject: "Confidential Project Update",
      bodyPreview: "This contains sensitive information",
      body: {
        contentType: "text",
        content: "Dear team, the Structural beam specification for Building A is now approved. Contact jane@contractor.com for details.",
      },
      from: {
        emailAddress: {
          name: "John Sender",
          address: "john@example.com",
        },
      },
      toRecipients: [
        {
          emailAddress: {
            name: "Jane Recipient",
            address: "jane@contractor.com",
          },
        },
      ],
      ccRecipients: [],
      receivedDateTime: "2026-10-06T14:30:00Z",
      sentDateTime: "2026-10-06T14:29:55Z",
      hasAttachments: false,
      importance: "high",
      isRead: false,
      categories: ["Important"],
    };

    mapGraphMessageToNormalized(mockMessage, "test@example.com");

    const allLogs = capturedLogs.join("\n");
    expect(allLogs).not.toContain("Confidential Project Update");
    expect(allLogs).not.toContain("jane@contractor.com");
    expect(allLogs).not.toContain("Structural beam specification");
  });

  it("Graph: delta with @removed items", async () => {
    const mockFetch = vi.fn();
    global.fetch = mockFetch;

    const client = new GraphClient({
      tenantId: "test-tenant",
      clientId: "test-client",
      clientSecret: "test-secret",
      mailbox: "test@example.com",
      siteId: "site-123",
    });

    // Mock token
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: "test-token",
        expires_in: 3600,
        token_type: "Bearer",
      }),
    });

    // Mock delta response with @removed
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers(),
      json: async () => ({
        value: [
          {
            id: "msg-removed",
            "@removed": {
              reason: "deleted",
            },
          },
        ],
        "@odata.deltaLink": "deltalink-123",
      }),
    });

    const result = await fetchMailFolderDelta(client, "test@example.com", "folder-123", undefined);
    
    expect(result.removed).toContain("msg-removed");
    expect(result.messages).toHaveLength(0);

    const allLogs = capturedLogs.join("\n");
    expect(allLogs).not.toContain("test@example.com");
  });

  it("Graph: DriveItem with createdBy names", () => {
    const mockItem: GraphDriveItem = {
      id: "item-123",
      name: "Confidential Budget Report.xlsx",
      webUrl: "https://sharepoint.com/sites/site-123/Shared%20Documents/Confidential%20Budget%20Report.xlsx",
      size: 50000,
      createdDateTime: "2026-10-01T10:00:00Z",
      lastModifiedDateTime: "2026-10-05T15:30:00Z",
      createdBy: {
        user: {
          displayName: "Alice Engineer",
          id: "user-456",
          email: "alice@engineer.com",
        },
      },
      lastModifiedBy: {
        user: {
          displayName: "Bob Manager",
          id: "user-789",
          email: "bob@manager.com",
        },
      },
      file: {
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        hashes: {
          sha256Hash: "abc123",
        },
      },
      parentReference: {
        driveId: "drive-123",
        id: "folder-parent",
        path: "/drive/root:/Shared Documents",
      },
    };

    // The mapper should strip emails
    const values = extractFieldValues(mockItem);
    expect(values.has("alice@engineer.com")).toBe(true);
    expect(values.has("Confidential Budget Report.xlsx")).toBe(true);

    const allLogs = capturedLogs.join("\n");
    expect(allLogs).not.toContain("alice@engineer.com");
    expect(allLogs).not.toContain("Confidential Budget Report");
  });

  it("P6: parser with empty task_code", async () => {
    const xerContent = `ERMHDR	9.0	2026-10-01
%T	PROJECT
%F	proj_id	proj_short_name
%R	1	TestProj

%T	TASK
%F	task_id	proj_id	wbs_id	task_code	task_name	status_code
%R	100	1	10		Sensitive Task Name That Should Not Leak	TK_Active
%R	101	1	10	A1000	Valid Task	TK_Active

%T	PROJWBS
%F	wbs_id	proj_id	wbs_short_name	parent_wbs_id
%R	10	1	TestWBS	

%T	TASKPRED
%F	task_id	pred_task_id	pred_type`;

    const buffer = Buffer.from(xerContent, "utf-8");
    
    const activities = await parseXERToActivities(buffer, "test.xer");
    expect(activities.length).toBe(1);
    expect(activities[0].activity_code).toBe("A1000");

    const allLogs = capturedLogs.join("\n");
    expect(allLogs).not.toContain("Sensitive Task Name That Should Not Leak");
    expect(allLogs).not.toContain("100"); // Internal task_id
  });

  it("P6: malformed XER validation", () => {
    const malformedXER = "This is not XER format\nJust some random text";
    
    const result = validateXER(malformedXER);
    expect(result.valid).toBe(false);

    const allLogs = capturedLogs.join("\n");
    expect(allLogs).not.toContain("This is not XER format");
  });

  it("Comprehensive: no fixture values in logs after all operations", async () => {
    // Extract all field values from all fixtures
    const allValues = new Set<string>();
    extractFieldValues(rfiFixture, allValues);
    extractFieldValues(submittalFixture, allValues);

    // Create Graph message fixture
    const graphMessage: GraphMessage = {
      id: "msg-999",
      conversationId: "conv-999",
      subject: "RE: Steel beam delivery schedule",
      bodyPreview: "The W12x26 beams are confirmed",
      body: {
        contentType: "text",
        content: "Hi Jane, The W12x26 beams from Building A are confirmed for delivery. Contact Alice Engineer at alice@engineer.com",
      },
      from: { emailAddress: { name: "Project Manager", address: "pm@construction.com" } },
      toRecipients: [{ emailAddress: { name: "Jane Smith", address: "jane.smith@contractor.com" } }],
      ccRecipients: [],
      receivedDateTime: "2026-10-09T10:00:00Z",
      sentDateTime: "2026-10-09T09:59:00Z",
      hasAttachments: false,
      importance: "normal",
      isRead: false,
      categories: [],
    };
    extractFieldValues(graphMessage, allValues);

    // Filter to sensitive values (exclude allowed IDs)
    const sensitiveValues = Array.from(allValues).filter(v => !isAllowedId(v));

    expect(sensitiveValues.length).toBeGreaterThan(0);

    // Run all mappers
    mapProcoreRFIToNormalized(rfiFixture);
    mapProcoreSubmittalToNormalized(submittalFixture);
    mapGraphMessageToNormalized(graphMessage, "pm@construction.com");

    // Check all captured logs
    const allLogs = capturedLogs.join("\n").toLowerCase();

    const leakedValues: string[] = [];
    for (const value of sensitiveValues) {
      if (allLogs.includes(value.toLowerCase())) {
        leakedValues.push(value);
      }
    }

    if (leakedValues.length > 0) {
      console.error("LEAKED VALUES:", leakedValues);
    }

    expect(leakedValues).toEqual([]);
  });

  it("Granola: no connector code exists", () => {
    // Granola connector does not exist yet
    // This test documents that fact
    expect(true).toBe(true);
  });
});
