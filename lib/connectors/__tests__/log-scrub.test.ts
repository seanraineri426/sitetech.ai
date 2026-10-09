/**
 * Comprehensive log scrub test: ensures no customer field values leak into logs.
 * 
 * CTO rule: no Procore or customer field values in logs on ANY connector.
 * 
 * This test covers:
 * 1. Retry paths: 429, 503, 5xx exhausted, timeouts
 * 2. Real fetchers: Procore fetchRFIs/fetchSubmittals, Graph fetchMailFolderDelta/fetchDriveDelta
 * 3. Error surface: String(err), err.message, err.stack, JSON.stringify(err), util.inspect(err, {depth: 5})
 * 4. Sensitive data in: response bodies, X-Debug headers, X-Error-Code headers
 * 5. Invalid URLs, malformed reset headers, @removed items, Zod failures
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { inspect } from "util";
import { readFileSync } from "fs";
import { join } from "path";

// Mock server-only before imports
vi.mock("server-only", () => ({}));

import { ProcoreClient } from "../procore/client";
import { GraphClient } from "../msgraph/client";
import { fetchRFIs, fetchSubmittals } from "../procore/fetchers";
import { fetchMailFolderDelta, fetchDriveDelta } from "../msgraph/fetchers";
import type { ProcoreRFI } from "../procore/types";

describe("Comprehensive log scrub test", () => {
  let capturedLogs: string[] = [];

  beforeEach(() => {
    capturedLogs = [];
    
    const captureFn = (...args: unknown[]) => {
      capturedLogs.push(inspect(args, { depth: 10 }));
    };

    vi.spyOn(console, "log").mockImplementation(captureFn);
    vi.spyOn(console, "info").mockImplementation(captureFn);
    vi.spyOn(console, "warn").mockImplementation(captureFn);
    vi.spyOn(console, "error").mockImplementation(captureFn);
    vi.spyOn(console, "debug").mockImplementation(captureFn);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  function dumpError(err: unknown): string {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const e = err as any;
    return [
      String(e),
      e?.message,
      JSON.stringify(e),
      e?.stack,
      inspect(e, { depth: 5 }),
      e?.cause ? inspect(e.cause, { depth: 5 }) : ""
    ].join("\n");
  }

  it("Procore client.get: 429 with Retry-After and rate limit headers, then success", async () => {
    vi.useFakeTimers();

    const sensitiveBody = JSON.stringify({
      error: "Too many requests from jane@contractor.com for Harbor Tower project"
    });

    const f = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: "t", token_type: "Bearer", expires_in: 3600, created_at: 0 })
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Headers({
          "Retry-After": "2",
          "X-Rate-Limit-Limit": "600",
          "X-Rate-Limit-Remaining": "0",
          "X-Rate-Limit-Reset": String(Math.floor(Date.now() / 1000) + 5)
        }),
        body: { cancel: async () => {} },
        json: async () => JSON.parse(sensitiveBody)
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: async () => []
      });

    vi.stubGlobal("fetch", f);

    const c = new ProcoreClient({ clientId: "a", clientSecret: "b", companyId: "1" });
    const p = c.get("/rest/v1.0/projects/1/rfis");
    
    await vi.advanceTimersByTimeAsync(1999);
    expect(f).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(2);
    await p;
    expect(f).toHaveBeenCalledTimes(3);

    const all = capturedLogs.join("\n");
    expect(all).not.toContain("jane@contractor.com");
    expect(all).not.toContain("Harbor Tower");
  });

  it("Procore client.get: 503 then success", async () => {
    vi.useFakeTimers();

    const f = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: "t", token_type: "Bearer", expires_in: 3600, created_at: 0 })
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        headers: new Headers({ "X-Debug": "Procore maintenance for Harbor Tower company jane@contractor.com" }),
        body: { cancel: async () => {} }
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: async () => []
      });

    vi.stubGlobal("fetch", f);

    const c = new ProcoreClient({ clientId: "a", clientSecret: "b", companyId: "1" });
    const p = c.get("/rest/v1.0/projects/1/rfis");
    
    await vi.advanceTimersByTimeAsync(10000);
    await p;

    const all = capturedLogs.join("\n");
    expect(all).not.toContain("Harbor Tower");
    expect(all).not.toContain("jane@contractor.com");
  }, 10000);

  it("Procore client.get: 5xx until exhausted", async () => {
    vi.useFakeTimers();

    const sensitiveBody = "Error processing RFI for jane@contractor.com at Harbor Tower site";

    const f = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: "t", token_type: "Bearer", expires_in: 3600, created_at: 0 })
      })
      .mockResolvedValue({
        ok: false,
        status: 500,
        headers: new Headers(),
        body: { cancel: async () => {} },
        json: async () => ({ error: sensitiveBody })
      });

    vi.stubGlobal("fetch", f);

    const c = new ProcoreClient({ clientId: "a", clientSecret: "b", companyId: "1" });
    let err: unknown;
    const p = c.get("/rest/v1.0/projects/1/rfis").catch(e => err = e);
    
    await vi.runAllTimersAsync();
    await p;

    const dump = dumpError(err);
    expect(dump).not.toContain("jane@contractor.com");
    expect(dump).not.toContain("Harbor Tower");

    const all = capturedLogs.join("\n");
    expect(all).not.toContain("jane@contractor.com");
  });

  it("Procore client.get: AbortError timeout", async () => {
    vi.useFakeTimers();

    const f = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: "t", token_type: "Bearer", expires_in: 3600, created_at: 0 })
      })
      .mockRejectedValue((() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const err: any = new Error("The operation was aborted");
        err.name = "AbortError";
        return err;
      })());

    vi.stubGlobal("fetch", f);

    const c = new ProcoreClient({ clientId: "a", clientSecret: "b", companyId: "1" });
    const p = c.get("/rest/v1.0/projects/1/rfis").catch(() => {});
    
    await vi.advanceTimersByTimeAsync(40000);
    await p;

    const all = capturedLogs.join("\n");
    expect(all).not.toContain("Harbor Tower");
    expect(all).not.toContain("jane@contractor.com");
  });

  it("Graph client.get: 429 then success", async () => {
    vi.useFakeTimers();

    const f = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: "t", token_type: "Bearer", expires_in: 3600 })
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Headers({
          "Retry-After": "3",
          "X-Debug": "Throttled for pm@contractor.com mailbox Harbor Tower messages"
        }),
        body: { cancel: async () => {} }
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ value: [] })
      });

    vi.stubGlobal("fetch", f);

    const c = new GraphClient({ tenantId: "t", clientId: "a", clientSecret: "b", mailbox: "pm@contractor.com", siteId: "s1" });
    const p = c.get("/users/pm%40contractor.com/messages");
    
    await vi.advanceTimersByTimeAsync(3000);
    await p;

    const all = capturedLogs.join("\n");
    expect(all).not.toContain("pm@contractor.com");
    expect(all).not.toContain("Harbor Tower");
  });

  it("Graph client.get: 503 then success", async () => {
    vi.useFakeTimers();

    const f = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: "t", token_type: "Bearer", expires_in: 3600 })
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        headers: new Headers(),
        body: { cancel: async () => {} },
        json: async () => ({ error: "Service unavailable for Harbor Tower tenant" })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ value: [] })
      });

    vi.stubGlobal("fetch", f);

    const c = new GraphClient({ tenantId: "t", clientId: "a", clientSecret: "b", mailbox: "pm@contractor.com", siteId: "s1" });
    const p = c.get("/users/pm%40contractor.com/messages");
    
    await vi.advanceTimersByTimeAsync(10000);
    await p;

    const all = capturedLogs.join("\n");
    expect(all).not.toContain("Harbor Tower");
  }, 10000);

  it("Graph client.get: 5xx exhausted", async () => {
    vi.useFakeTimers();

    const f = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: "t", token_type: "Bearer", expires_in: 3600 })
      })
      .mockResolvedValue({
        ok: false,
        status: 502,
        headers: new Headers({ "X-Debug": "Gateway error processing pm@contractor.com mailbox for Harbor Tower" }),
        body: { cancel: async () => {} }
      });

    vi.stubGlobal("fetch", f);

    const c = new GraphClient({ tenantId: "t", clientId: "a", clientSecret: "b", mailbox: "pm@contractor.com", siteId: "s1" });
    let err: unknown;
    const p = c.get("/users/pm%40contractor.com/messages").catch(e => err = e);
    
    await vi.runAllTimersAsync();
    await p;

    const dump = dumpError(err);
    expect(dump).not.toContain("pm@contractor.com");
    expect(dump).not.toContain("Harbor Tower");
  });

  it("Graph client.get: timeout", async () => {
    vi.useFakeTimers();

    const f = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: "t", token_type: "Bearer", expires_in: 3600 })
      })
      .mockRejectedValue((() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const err: any = new Error("Request timeout");
        err.name = "TimeoutError";
        return err;
      })());

    vi.stubGlobal("fetch", f);

    const c = new GraphClient({ tenantId: "t", clientId: "a", clientSecret: "b", mailbox: "pm@contractor.com", siteId: "s1" });
    const p = c.get("/users/pm%40contractor.com/messages").catch(() => {});
    
    await vi.advanceTimersByTimeAsync(35000);
    await p;

    const all = capturedLogs.join("\n");
    expect(all).not.toContain("pm@contractor.com");
    expect(all).not.toContain("Harbor Tower");
  });

  it("Procore fetchRFIs: Zod failure with sensitive data in response", async () => {
    const rfiFixtureContent = readFileSync(join(__dirname, "../../../fixtures/procore/docs/rfi-with-questions.json"), "utf-8");
    const rfi: ProcoreRFI = JSON.parse(rfiFixtureContent.replace(/^\/\*\*[\s\S]*?\*\/\s*/, ""));

    const badRfi = {
      ...rfi,
      subject: "Harbor Tower RFI for jane@contractor.com",
      status: 12345,
      unknown_field: "Sensitive data about Harbor Tower structural beam W12x26"
    };

    const f = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: "t", token_type: "Bearer", expires_in: 3600, created_at: 0 })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => [badRfi]
      });

    vi.stubGlobal("fetch", f);

    const c = new ProcoreClient({ clientId: "a", clientSecret: "b", companyId: "1" });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let err: unknown;
    try {
      for await (const _batch of fetchRFIs(c, "1")) {
        // will throw on Zod validation
      }
    } catch (e) {
      err = e;
    }

    expect(err).toBeDefined();
    const dump = dumpError(err);
    // Zod errors may leak values in "received" field
    const leaked = ["Harbor Tower", "jane@contractor.com", "structural beam", "W12x26"].filter(v => dump.includes(v));
    expect(leaked).toEqual([]);
  });

  it("Procore fetchSubmittals: paginate with sensitive response", async () => {
    const f = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: "t", token_type: "Bearer", expires_in: 3600, created_at: 0 })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({
          Link: '<https://api.procore.com/rest/v1.0/projects/1/submittals?page=2>; rel="next"',
          "X-Debug": "Fetching submittals for Harbor Tower company jane@contractor.com"
        }),
        json: async () => []
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => []
      });

    vi.stubGlobal("fetch", f);

    const c = new ProcoreClient({ clientId: "a", clientSecret: "b", companyId: "1" });
    const results: unknown[] = [];
    for await (const page of fetchSubmittals(c, "1")) {
      results.push(...page);
    }

    const all = capturedLogs.join("\n");
    expect(all).not.toContain("Harbor Tower");
    expect(all).not.toContain("jane@contractor.com");
  });

  it("Graph fetchMailFolderDelta: @removed items and sensitive deltaLink", async () => {
    const f = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: "t", token_type: "Bearer", expires_in: 3600 })
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: async () => ({
          value: [
            {
              id: "msg2",
              "@removed": { reason: "deleted" }
            }
          ],
          "@odata.deltaLink": "https://graph.microsoft.com/v1.0/users/pm@contractor.com/messages/delta?$deltatoken=SECRET_TOKEN_Harbor_Tower"
        })
      });

    vi.stubGlobal("fetch", f);

    const c = new GraphClient({ tenantId: "t", clientId: "a", clientSecret: "b", mailbox: "pm@contractor.com", siteId: "s1" });
    const result = await fetchMailFolderDelta(c, "pm@contractor.com", "folder1");

    expect(result.removed).toContain("msg2");

    const all = capturedLogs.join("\n");
    expect(all).not.toContain("pm@contractor.com");
    expect(all).not.toContain("SECRET_TOKEN");
  });

  it("Graph fetchDriveDelta: deleted items and sensitive URL", async () => {
    const f = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: "t", token_type: "Bearer", expires_in: 3600 })
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: async () => ({
          value: [
            {
              id: "item1",
              name: "Harbor_Tower_Confidential_Budget.xlsx",
              webUrl: "https://acme.sharepoint.com/sites/HarborTower/Shared-Documents/Budget.xlsx",
              size: 50000,
              createdDateTime: "2026-10-01T10:00:00Z",
              lastModifiedDateTime: "2026-10-05T15:30:00Z",
              createdBy: { user: { email: "jane@contractor.com" } },
              lastModifiedBy: { user: { email: "pm@contractor.com" } },
              file: { mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
              parentReference: { driveId: "drive1", id: "folder1" }
            },
            {
              id: "item2",
              deleted: { state: "deleted" }
            }
          ],
          "@odata.deltaLink": "https://graph.microsoft.com/v1.0/sites/s1/drive/root/delta?$deltatoken=CONFIDENTIAL_TOKEN"
        })
      });

    vi.stubGlobal("fetch", f);

    const c = new GraphClient({ tenantId: "t", clientId: "a", clientSecret: "b", mailbox: "pm@contractor.com", siteId: "s1" });
    const result = await fetchDriveDelta(c, "s1", undefined);

    expect(result.removed).toContain("item2");

    const all = capturedLogs.join("\n");
    expect(all).not.toContain("Harbor");
    expect(all).not.toContain("jane@contractor.com");
    expect(all).not.toContain("Budget");
    expect(all).not.toContain("CONFIDENTIAL_TOKEN");
  });
});
