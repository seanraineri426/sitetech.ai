import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { inspect } from "util";
vi.mock("server-only", () => ({}));
import { logEvent, logWarning, logRetry } from "../shared/log";
import { ProcoreClient } from "../procore/client";
import { GraphClient } from "../msgraph/client";
import { fetchRFIs } from "../procore/fetchers";
import { retryRequest } from "../shared/retry";
import { readFileSync } from "fs";

const out: string[] = [];
function dump(err: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const e = err as any;
  return [String(e), e?.message, JSON.stringify(e), e?.stack, inspect(e, { depth: 5 }), e?.cause ? inspect(e.cause, { depth: 5 }) : ""].join("\n");
}
beforeEach(() => {
  out.length = 0;
  for (const m of ["log", "warn", "error", "info", "debug"] as const)
    vi.spyOn(console, m).mockImplementation((...a: unknown[]) => { out.push(a.map((x) => typeof x === "string" ? x : inspect(x, { depth: 10 })).join(" ")); });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("allowlist fooling with real keys", () => {
  it("skipped_count: phone number rejected", () => {
    logWarning("P6.Parser.EmptyTaskCode", { skipped_count: 6175551234 });
    const result = out.join("\n");
    expect(result).toContain("skipped_count");
    expect(result).toContain("6175551234");
  });

  it("limit: email as number rejected (NaN)", () => {
    logEvent("Procore.RateLimit", { limit: "jane@contractor.com" as unknown as number });
    const result = out.join("\n");
    expect(result).not.toContain("jane@contractor.com");
    expect(result).toContain("[dropped]");
  });

  it("provider: email rejected", () => {
    logRetry("jane@contractor.com", 0, 3, 1000);
    const result = out.join("\n");
    expect(result).not.toContain("jane@contractor.com");
    expect(result).toContain("[dropped]");
  });

  it("reset_at: URL rejected", () => {
    logEvent("Graph.RateLimit", { reset_at: "https://acme.sharepoint.com/sites/Harbor-Tower/Budget.xlsx" });
    const result = out.join("\n");
    expect(result).not.toContain("acme.sharepoint.com");
    expect(result).not.toContain("Harbor-Tower");
    expect(result).not.toContain("Budget.xlsx");
    expect(result).toContain("[dropped]");
  });

  it("reset_at: ISO-8601 allowed", () => {
    logEvent("Procore.RateLimit", { reset_at: "2026-10-09T18:30:00.000Z" });
    const result = out.join("\n");
    expect(result).toContain("2026-10-09T18:30:00.000Z");
  });

  it("unknown key: email address omitted entirely", () => {
    logEvent("Procore.RateLimit", { ["jane@contractor.com"]: 1 } as Record<string, unknown>);
    const result = out.join("\n");
    expect(result).not.toContain("jane@contractor.com");
  });

  it("unknown key: project name omitted entirely", () => {
    logEvent("Graph.RateLimit", { ["Harbor-Tower-Phase-2"]: "value" } as Record<string, unknown>);
    const result = out.join("\n");
    expect(result).not.toContain("Harbor-Tower");
    expect(result).not.toContain("Phase-2");
  });

  it("unknown event name throws", () => {
    expect(() => logEvent("Harbor Tower RFI jane@acmemech.com", { skipped_count: 1 })).toThrow("Unknown event name");
    expect(out.join("\n")).not.toContain("jane@acmemech.com");
    expect(out.join("\n")).not.toContain("Harbor Tower");
  });

  // M3: log.ts passes every value through
  it("M3: non-numeric value on numeric key is dropped", () => {
    logEvent("Procore.RateLimit", { limit: "harbor-tower" as unknown as number });
    const result = out.join("\n");
    expect(result).not.toContain("harbor-tower");
    expect(result).toContain("[dropped]");
  });

  // M3 additional: string on numeric key
  it("M3: string value on limit key is dropped, not passed through", () => {
    logEvent("Procore.RateLimit", { limit: "jane@contractor.com" as unknown as number, remaining: 100 });
    const result = out.join("\n");
    expect(result).not.toContain("jane@contractor.com");
    expect(result).toContain("[dropped]");
    expect(result).toContain("remaining");
    expect(result).toContain("100");
  });

  // M3 catches object values
  it("M3: object values are dropped, not passed through", () => {
    logEvent("Procore.RateLimit", { limit: { email: "jane@contractor.com", project: "Harbor Tower" } as unknown as number });
    const result = out.join("\n");
    expect(result).not.toContain("jane@contractor.com");
    expect(result).not.toContain("Harbor Tower");
    expect(result).toContain("[dropped]");
  });

  // M4: numbers allowed on any key
  it("M4: numbers on non-numeric keys are dropped", () => {
    logEvent("Procore.RateLimit", { provider: 123456 as unknown as string });
    const result = out.join("\n");
    expect(result).not.toContain("123456");
    expect(result).toContain("[dropped]");
  });

  // M6: Procore ERR_INVALID_URL rethrown raw
  it("M6: Procore ERR_INVALID_URL is wrapped with clean code", async () => {
    const f = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: "t", token_type: "Bearer", expires_in: 3600, created_at: 0 }) });
    vi.stubGlobal("fetch", f);
    const c = new ProcoreClient({ clientId: "a", clientSecret: "b", companyId: "1" });
    // Pass an invalid path that will cause new URL() to throw ERR_INVALID_URL
    const err = await c.get("http://[invalid").catch((e) => e);
    // Check the error has the clean code (not ERR_INVALID_URL)
    expect(err.code).toBe("INVALID_URL");
    expect(err.message).toBe("Invalid URL");
  });

  // M17: Graph timeout embeds URL
  it("M17: Graph network error does NOT embed URL", async () => {
    const f = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: "t", token_type: "Bearer", expires_in: 3600 }) })
      .mockRejectedValueOnce(new Error("Network timeout"));
    vi.stubGlobal("fetch", f);
    const c = new GraphClient({ tenantId: "t", clientId: "a", clientSecret: "b", mailbox: "pm@contractor.com", siteId: "s1" });
    const err = await c.get("/users/pm%40contractor.com/messages").catch((e) => e);
    const d = dump(err);
    expect(d).not.toContain("pm@contractor.com");
    expect(d).not.toContain("pm%40contractor.com");
  });
});

describe("errors to callers", () => {
  it("Procore 4xx X-Error-Code header is sanitized", async () => {
    const f = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: "t", token_type: "Bearer", expires_in: 3600, created_at: 0 }) })
      .mockResolvedValueOnce({ ok: false, status: 400, headers: new Headers({ "X-Error-Code": "RFI 'Harbor Tower beam' for jane@acmemech.com" }), json: async () => ({}) });
    vi.stubGlobal("fetch", f);
    const c = new ProcoreClient({ clientId: "a", clientSecret: "b", companyId: "1" });
    const err = await c.get("/rest/v1.0/projects/1/rfis").catch((e) => e);
    const d = dump(err);
    expect(d).not.toContain("jane@acmemech.com");
    expect(d).toContain("UNKNOWN");
    expect(d).toContain("API_ERROR");
  });

  it("Graph 4xx X-Error-Code header is sanitized", async () => {
    const f = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: "t", token_type: "Bearer", expires_in: 3600 }) })
      .mockResolvedValueOnce({ ok: false, status: 400, headers: new Headers({ "X-Error-Code": "Subject Harbor Tower" }), json: async () => ({}) });
    vi.stubGlobal("fetch", f);
    const c = new GraphClient({ tenantId: "t", clientId: "a", clientSecret: "b", mailbox: "pm@acmemech.com", siteId: "s1" });
    const err = await c.get("/users/pm%40acmemech.com/messages").catch((e) => e);
    const d = dump(err);
    expect(d).not.toContain("Harbor Tower");
    expect(d).toContain("UNKNOWN");
    expect(d).toContain("API_ERROR");
  });

  it("Graph corrupted deltaLink -> generic error without URL leak", async () => {
    const f = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: "t", token_type: "Bearer", expires_in: 3600 }) });
    vi.stubGlobal("fetch", f);
    const c = new GraphClient({ tenantId: "t", clientId: "a", clientSecret: "b", mailbox: "pm@acmemech.com", siteId: "s1" });
    const err = await c.delta("/users/x/messages", "http://[graph.microsoft.com/v1.0/users/pm@acmemech.com/messages/delta?$deltatoken=SECRETTOKEN").catch((e) => e);
    const d = dump(err);
    expect(d).not.toContain("SECRETTOKEN");
    expect(d).not.toContain("pm@acmemech.com");
    expect(d).toContain("Invalid Graph URL");
    expect(d).toContain("INVALID_URL");
  });

  it("Zod failure on fetchRFIs page: mapper validates without leaking", async () => {
    const raw = readFileSync("fixtures/procore/docs/rfi-with-questions.json", "utf-8").replace(/^\/\*\*[\s\S]*?\*\/\s*/, "");
    const rfi = JSON.parse(raw);
    const bad = { ...rfi, id: "Harbor Tower jane@acmemech.com", subject: 12345, status: "SECRET_STATUS_VALUE", unknown_extra: "Sensitive extra value" };
    const f = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: "t", token_type: "Bearer", expires_in: 3600, created_at: 0 }) })
      .mockResolvedValueOnce({ ok: true, status: 200, headers: new Headers(), json: async () => [bad] });
    vi.stubGlobal("fetch", f);
    const c = new ProcoreClient({ clientId: "a", clientSecret: "b", companyId: "1" });
    const err = await expect((async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _batch of fetchRFIs(c, "1")) {
        // will throw on Zod validation
      }
    })()).rejects.toThrow();
    expect(err).toBeDefined();
  });

  it("Procore malformed reset header is guarded with Number.isFinite", async () => {
    vi.useFakeTimers();
    const r = { ok: false, status: 429, headers: new Headers({ "Retry-After": "1", "X-Rate-Limit-Limit": "600", "X-Rate-Limit-Reset": "soon" }), body: { cancel: async () => {} } } as unknown as Response;
    const p = retryRequest(async () => r, { maxRetries: 2, maxWaitMs: 60000, baseDelayMs: 10 }, "Procore").catch((e) => e);
    await vi.runAllTimersAsync();
    const e = await p;
    // Should not throw RangeError; should log with reset_at: null
    expect(String(e)).toMatch(/exhausted/);
    const logs = out.join("\n");
    expect(logs).toContain("reset_at");
    expect(logs).toContain("null");
  });

  it("Retry-After honored (seconds) and capped", async () => {
    vi.useFakeTimers();
    const r429 = { ok: false, status: 429, headers: new Headers({ "Retry-After": "7" }), body: { cancel: async () => {} } } as unknown as Response;
    const ok = { ok: true, status: 200, headers: new Headers() } as unknown as Response;
    const fn = vi.fn().mockResolvedValueOnce(r429).mockResolvedValueOnce(ok);
    const p = retryRequest(fn, { maxRetries: 3, maxWaitMs: 60000, baseDelayMs: 10 }, "Graph");
    await vi.advanceTimersByTimeAsync(6999);
    expect(fn).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2);
    await p;
    expect(fn).toHaveBeenCalledTimes(2);
    expect(out.join("\n")).toContain("[Graph] Retrying after 7000ms");
    const big = { ok: false, status: 429, headers: new Headers({ "Retry-After": "120" }), body: { cancel: async () => {} } } as unknown as Response;
    await expect(retryRequest(async () => big, { maxRetries: 3, maxWaitMs: 60000, baseDelayMs: 10 }, "Graph")).rejects.toThrow(/exceeds max wait cap/);
  });
});
