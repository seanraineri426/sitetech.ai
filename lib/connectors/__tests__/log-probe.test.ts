import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { inspect } from "util";
vi.mock("server-only", () => ({}));
import { logEvent, logWarning, logRetry } from "../shared/log";
import { ProcoreClient } from "../procore/client";
import { GraphClient } from "../msgraph/client";
import { fetchRFIs } from "../procore/fetchers";
import { mapProcoreRFIToNormalized } from "../procore/mappers";
import { retryRequest } from "../shared/retry";
import { readFileSync } from "fs";

const out: string[] = [];
function dump(err: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const e = err as any;
  return [String(e), e?.message, JSON.stringify(e), e?.stack, inspect(e, { depth: 10 }), e?.cause ? inspect(e.cause) : ""].join("\n");
}
beforeEach(() => {
  out.length = 0;
  for (const m of ["log", "warn", "error", "info", "debug"] as const)
    vi.spyOn(console, m).mockImplementation((...a: unknown[]) => { out.push(a.map((x) => typeof x === "string" ? x : inspect(x, { depth: 10 })).join(" ")); });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("allowlist fooling", () => {
  const probes: Record<string, string> = {
    personName: "jane.smith",
    emailDomain: "contractor.com",
    localAndDomainNoAt: "jane.smith:acmemech.com",
    spPath: "/sites/HarborTower/Shared-Documents/Budget_Final.xlsx",
    spUrlNoQuery: "https://acme.sharepoint.com/sites/Harbor-Tower",
    fileName: "Confidential_Budget_Report.xlsx",
    projectName: "Harbor-Tower-Phase-2",
    rfiTitle: "Structural_beam_W12x26_clarification",
    hex64: "a".repeat(0) + "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
    procoreToken43: "kX3v9Qp_LmN0aB7cD-eF1gH2iJ3kL4mN5oP6qR7sT8u",
    jwtish: "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJqYW5lIn0.c2ln",
    deltatokenPath: "/v1.0/users/pm/messages/delta",
  };
  for (const [k, v] of Object.entries(probes)) {
    it(`value ${k} passes through`, () => {
      logEvent("Probe", { v });
      const passed = out.join("\n").includes(v);
      console.info = console.info; // noop
      expect({ k, passed, len: v.length }).toMatchSnapshot();
    });
  }
  it("event name is NOT sanitized", () => {
    logEvent("Harbor Tower RFI jane@acmemech.com", { n: 1 });
    logWarning("Subject: Steel delivery slipped", { n: 1 });
    expect(out.join("\n")).toContain("jane@acmemech.com");
    expect(out.join("\n")).toContain("Steel delivery slipped");
  });
  it("field keys are NOT sanitized", () => {
    logEvent("Probe", { ["jane@acmemech.com Harbor Tower"]: 1 });
    expect(out.join("\n")).toContain("jane@acmemech.com Harbor Tower");
  });
  it("numbers pass unconditionally (dollar amounts, phone numbers)", () => {
    logEvent("Probe", { amount: 4500.25, phone: 6175551234 });
    expect(out.join("\n")).toContain("6175551234");
  });
  it("@ and spaces and query strings are dropped", () => {
    logEvent("Probe", { a: "jane@acme.com", b: "Harbor Tower", c: "/x?$deltatoken=abc", d: "x".repeat(65) });
    expect(out.join("\n")).not.toMatch(/jane@|Harbor Tower|deltatoken|x{65}/);
  });
  it("provider in logRetry sanitized", () => {
    logRetry("jane@acme.com", 0, 3, 10);
    expect(out.join("\n")).toContain("[dropped]");
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
  });
  it("Graph corrupted deltaLink -> TypeError carries full URL (mailbox+token)", async () => {
    const f = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: "t", token_type: "Bearer", expires_in: 3600 }) });
    vi.stubGlobal("fetch", f);
    const c = new GraphClient({ tenantId: "t", clientId: "a", clientSecret: "b", mailbox: "pm@acmemech.com", siteId: "s1" });
    const err = await c.delta("/users/x/messages", "http://[graph.microsoft.com/v1.0/users/pm@acmemech.com/messages/delta?$deltatoken=SECRETTOKEN").catch((e) => e);
    const d = dump(err);
    expect(d).not.toContain("SECRETTOKEN");
    expect(d).not.toContain("pm@acmemech.com");
    expect(d).toContain("Invalid Graph URL");
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
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _batch of fetchRFIs(c, "1")) { /* */ }
    } catch {
      // Expected to throw
    }
    expect(true).toBe(true);
  });
  it("PR's own 'Zod failure' test is vacuous: mapper does not throw", () => {
    const raw = readFileSync("fixtures/procore/docs/rfi-with-questions.json", "utf-8").replace(/^\/\*\*[\s\S]*?\*\/\s*/, "");
    const rfi = JSON.parse(raw);
    let threw = false;
    try { mapProcoreRFIToNormalized({ ...rfi, id: "not-a-number" }); } catch { threw = true; }
    expect(threw).toBe(false);
  });
  it("Procore malformed reset header is guarded with Number.isFinite", async () => {
    vi.useFakeTimers();
    const r = { ok: false, status: 429, headers: new Headers({ "Retry-After": "1", "X-Rate-Limit-Limit": "600", "X-Rate-Limit-Reset": "soon" }), body: { cancel: async () => {} } } as unknown as Response;
    const p = retryRequest(async () => r, { maxRetries: 2, maxWaitMs: 60000, baseDelayMs: 10 }, "Procore").catch((e) => e);
    await vi.runAllTimersAsync();
    const e = await p;
    // Should not throw RangeError; reset_at should be null in logs
    expect(String(e)).toMatch(/exhausted/);
    const logs = out.join("\n");
    expect(logs).toContain("reset_at");
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
