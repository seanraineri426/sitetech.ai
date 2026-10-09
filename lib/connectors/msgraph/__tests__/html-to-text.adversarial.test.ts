import { describe, it, expect, vi, beforeEach } from "vitest";
import { htmlToText } from "../html-to-text";
import { mapGraphMessageToNormalized } from "../mappers";
import { GraphClient } from "../client";
import { fetchMailFolderDelta } from "../fetchers";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const base: any = { id: "m1", conversationId: "c1", subject: "s", bodyPreview: "p",
  from: { emailAddress: { name: "A", address: "a@x.com" } }, toRecipients: [], ccRecipients: [],
  receivedDateTime: "2026-10-09T12:00:00Z", sentDateTime: "2026-10-09T12:00:00Z",
  hasAttachments: false, importance: "normal", isRead: false, categories: [] };

// Mock server-only
vi.mock("server-only", () => ({}));

describe("PR5 review probes", () => {
  it("PR claim: &amp;lt; stays &lt;", () => { expect(htmlToText("&amp;lt;")).toBe("&lt;"); });
  it("double decode via numeric &#38;amp; (should be '&amp;')", () => { expect(htmlToText("&#38;amp;")).toBe("&amp;"); });
  it("double decode via numeric &#38;lt; (should be '&lt;')", () => { expect(htmlToText("&#38;lt;")).toBe("&lt;"); });
  it("&#0; must not yield NUL", () => { expect(htmlToText("a&#0;b")).not.toContain("\u0000"); });
  it("astral &#128512; decodes to emoji", () => { expect(htmlToText("&#128512;")).toBe("😀"); });
  it("text body NUL stripped", () => {
    const n = mapGraphMessageToNormalized({ ...base, body: { contentType: "text", content: "a\u0000b" } }, "mb");
    expect(n.body_text).not.toContain("\u0000");
  });
  it("text body capped at 200KB", () => {
    const n = mapGraphMessageToNormalized({ ...base, body: { contentType: "text", content: "x".repeat(5_000_000) } }, "mb");
    expect(n.body_text!.length).toBeLessThanOrEqual(200_000 + 100);
  });
  it("1MB <script repeated completes in under 200ms", () => {
    const input = "<script ".repeat(125_000);
    const t0 = performance.now();
    htmlToText(input);
    const elapsed = performance.now() - t0;
    console.log(`1MB <script repeated: ${elapsed.toFixed(0)}ms`);
    expect(elapsed).toBeLessThan(200);
  });
  it("5MB HTML body through mapGraphMessageToNormalized capped", () => {
    const largeHtml = "<p>" + "x".repeat(5_000_000) + "</p>";
    const n = mapGraphMessageToNormalized({ ...base, body: { contentType: "html", content: largeHtml } }, "mb");
    expect(n.body_text!.length).toBeLessThanOrEqual(200_000 + " [truncated]".length);
    expect(n.body_text).toMatch(/\[truncated\]$/);
  });
  it("5MB HTML body fingerprint stable across runs", () => {
    const largeHtml = "<p>" + "x".repeat(5_000_000) + "</p>";
    const n1 = mapGraphMessageToNormalized({ ...base, body: { contentType: "html", content: largeHtml } }, "mb");
    const n2 = mapGraphMessageToNormalized({ ...base, body: { contentType: "html", content: largeHtml } }, "mb");
    expect(n1.fingerprint).toBe(n2.fingerprint);
  });
  it("named entities &rsquo; &mdash; decoded", () => { expect(htmlToText("it&rsquo;s &mdash; ok")).toBe("it\u2019s \u2014 ok"); });
  it("Outlook conditional comment content dropped", () => {
    expect(htmlToText("<!--[if gte mso 9]><xml><o:PixelsPerInch>96</o:PixelsPerInch></xml><![endif]--><p>Hi</p>")).toBe("Hi");
  });
  for (const [name, mk] of [
    ["unclosed <style repeated", (n: number) => "<style>".repeat(n)],
    ["'<' without '>' repeated", (n: number) => "<a".repeat(n)],
    ["unclosed <script repeated", (n: number) => "<script ".repeat(n)],
  ] as const) {
    it(`timing: ${name}`, () => {
      const t: number[] = [];
      for (const n of [5_000, 10_000, 20_000]) { const s = mk(n); const t0 = performance.now(); htmlToText(s); t.push(performance.now() - t0); }
      console.log(name, t.map((x) => x.toFixed(0) + "ms").join(" "));
      expect(t[2]).toBeLessThan(500);
    });
  }
});

describe("Prefer header on every delta page", () => {
  const fetchMock = vi.fn(); beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); });
  it("sends Prefer on nextLink page (checkpoint resume)", async () => {
    const client = new GraphClient({ tenantId: "t", clientId: "c", clientSecret: "s", mailbox: "user@example.com", siteId: "site" });
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: "tok", token_type: "Bearer", expires_in: 3600 }) });
    fetchMock.mockResolvedValueOnce({ ok: true, headers: new Headers(), json: async () => ({ value: [], "@odata.deltaLink": "x" }) });
    await fetchMailFolderDelta(client, "user@example.com", "inbox",
      "https://graph.microsoft.com/v1.0/users/user@example.com/mailFolders/inbox/messages/delta?$skiptoken=abc");
    const [url, init] = fetchMock.mock.calls[1];
    expect(String(url)).toContain("skiptoken");
    expect(init.headers.Prefer).toBe('outlook.body-content-type="text"');
    expect(init.headers.Authorization).toBe("Bearer tok");
    expect(init.method).toBe("GET");
  });
});
