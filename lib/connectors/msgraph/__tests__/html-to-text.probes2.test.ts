import { describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { htmlToText } from "../html-to-text";
import { mapGraphMessageToNormalized, emailToRawRecord, redactAddresses, MAX_BODY_CHARS } from "../mappers";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const base: any = { id: "m1", conversationId: "c1", subject: "s", bodyPreview: "p",
  from: { emailAddress: { name: "A", address: "alice@x.com" } }, toRecipients: [{ emailAddress: { name: "B", address: "bob+rfi@sub.y.com" } }],
  ccRecipients: [{ emailAddress: { name: "C", address: "carol@z.com" } }],
  receivedDateTime: "2026-10-09T12:00:00Z", sentDateTime: "2026-10-09T12:00:00Z",
  hasAttachments: false, importance: "normal", isRead: false, categories: [] };
const time = (f: () => unknown) => { const t0 = performance.now(); f(); return performance.now() - t0; };
const loneSurrogate = (s: string) => /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(s);

describe("comments / tags", () => {
  it("nested comment <!-- <!-- --> then text", () => { expect(htmlToText("a<!-- <!-- -->b")).toBe("ab"); });
  it("unclosed <!-- keeps preceding text", () => { expect(htmlToText("keep<!-- never closed")).toBe("keep"); });
  it("<scr<script>ipt> does not leak script body", () => { const o = htmlToText("<scr<script>ipt>alert(1)</script>ok"); console.log("scr<script>:", JSON.stringify(o)); expect(o).not.toContain("alert"); });
  it("uppercase <SCRIPT>", () => { expect(htmlToText("<SCRIPT>bad()</SCRIPT>ok")).toBe("ok"); });
  it("</script > with space", () => { expect(htmlToText("<script>bad()</script >ok")).toBe("ok"); });
  it("CDATA", () => { const o = htmlToText("<p>a</p><![CDATA[ x > y ]]><p>b</p>"); console.log("CDATA:", JSON.stringify(o)); expect(o).not.toContain("]]>"); });
  it("<header> must not eat the body", () => { const o = htmlToText("<header>Logo</header><p>Body text</p>"); console.log("header:", JSON.stringify(o)); expect(o).toContain("Body text"); });
  it("<header> with no </head... drops nothing", () => { const o = htmlToText("<header><p>Body text</p>"); console.log("header2:", JSON.stringify(o)); expect(o).toContain("Body text"); });
  it("<link> must not add a bullet", () => { expect(htmlToText("<link rel=x>Hi")).toBe("Hi"); });
  
  it("Turkish İ does not corrupt indices", () => {
    const withDot = 'İ'.repeat(7) + '</p><style></style><p>Important: notice due 10/15</p>';
    const withoutDot = 'I'.repeat(7) + '</p><style></style><p>Important: notice due 10/15</p>';
    const o1 = htmlToText(withDot);
    const o2 = htmlToText(withoutDot);
    console.log("Turkish İ:", JSON.stringify(o1));
    // Both should preserve their respective characters and the important text
    expect(o1).toContain("İİİİİİİ");
    expect(o1).toContain("Important: notice due 10/15");
    expect(o2).toContain("IIIIIII");
    expect(o2).toContain("Important: notice due 10/15");
    // Structure should match (same number of lines and content positions)
    expect(o1.split('\n').length).toBe(o2.split('\n').length);
  });
  
  it("Turkish Outlook sample: sender İnşaat Co", () => {
    const html = `<html><head><style>body{font-family:Calibri}</style></head><!--[if gte mso 9]><xml><o:PixelsPerInch>96</o:PixelsPerInch></xml><![endif]--><body><p>From: İnşaat Co <info@insaat.tr></p><p>Subject: Construction update</p><p>The project is on schedule.</p></body></html>`;
    const o = htmlToText(html);
    console.log("Turkish Outlook:", JSON.stringify(o));
    expect(o).toContain("İnşaat Co");
    expect(o).toContain("Construction update");
    expect(o).toContain("project is on schedule");
    expect(o).not.toContain("Calibri");
    expect(o).not.toContain("PixelsPerInch");
  });
});
describe("timing", () => {
  it("1MB of <!--", () => { const ms = time(() => htmlToText("<!--".repeat(250_000))); console.log("1MB <!--", ms.toFixed(0), "ms"); expect(ms).toBeLessThan(200); });
  it("4MB raw HTML through the mapper", () => {
    const html = "<div><p>" + "word ".repeat(800_000) + "</p></div>";
    const ms = time(() => mapGraphMessageToNormalized({ ...base, body: { contentType: "html", content: html } }, "mb"));
    console.log("4MB mapper", ms.toFixed(0), "ms"); expect(ms).toBeLessThan(500);
  });
  it("many <script></script> pairs (800KB, under raw cap)", () => {
    for (const n of [5_000, 10_000, 20_000]) { const ms = time(() => htmlToText("<script>x</script>".repeat(n))); console.log("script pairs", n, ms.toFixed(0), "ms"); }
    const ms = time(() => mapGraphMessageToNormalized({ ...base, body: { contentType: "html", content: "<style>x</style>".repeat(50_000) } }, "mb"));
    console.log("800KB <style> pairs via mapper", ms.toFixed(0), "ms"); expect(ms).toBeLessThan(500);
  });
  it("redactAddresses on 200KB with no @", () => {
    for (const n of [25_000, 50_000, 100_000, 200_000]) { const ms = time(() => redactAddresses("a".repeat(n))); console.log("redact", n, ms.toFixed(0), "ms"); }
    expect(time(() => redactAddresses("a".repeat(200_000)))).toBeLessThan(500);
  });
  
  it("nested < quadratic fix: 800KB '<' through mapper", () => {
    const ms = time(() => mapGraphMessageToNormalized({ ...base, body: { contentType: "html", content: "<".repeat(800_000) } }, "mb"));
    console.log("800KB '<'", ms.toFixed(0), "ms"); expect(ms).toBeLessThan(200);
  });
  
  it("nested < quadratic fix: 800KB '<a' through mapper", () => {
    const ms = time(() => mapGraphMessageToNormalized({ ...base, body: { contentType: "html", content: "<a".repeat(400_000) } }, "mb"));
    console.log("800KB '<a'", ms.toFixed(0), "ms"); expect(ms).toBeLessThan(200);
  });
  
  it("nested < quadratic fix: 100K <b>x</b> pairs", () => {
    const ms = time(() => htmlToText("<b>x</b>".repeat(100_000)));
    console.log("100K <b>x</b>", ms.toFixed(0), "ms"); expect(ms).toBeLessThan(200);
  });
  
  it("nested < quadratic fix: 200K <br>", () => {
    const ms = time(() => htmlToText("<br>".repeat(200_000)));
    console.log("200K <br>", ms.toFixed(0), "ms"); expect(ms).toBeLessThan(200);
  });
});
describe("entities", () => {
  it("&#x110000; left literal", () => { expect(htmlToText("a&#x110000;b")).toBe("a&#x110000;b"); });
  it("&#1114112; left literal", () => { expect(htmlToText("a&#1114112;b")).toBe("a&#1114112;b"); });
  it("&#xD800; left literal, no lone surrogate", () => { const o = htmlToText("a&#xD800;b"); expect(loneSurrogate(o)).toBe(false); });
  it("entity at raw-HTML cap boundary does not crash/decode partially", () => {
    const html = "x".repeat(MAX_BODY_CHARS * 4 - 3) + "&amp;tail";
    const n = mapGraphMessageToNormalized({ ...base, body: { contentType: "html", content: html } }, "mb");
    console.log("boundary tail:", JSON.stringify(n.body_text!.slice(-20)));
    expect(n.body_text!.endsWith("[truncated]")).toBe(true);
  });
});
describe("truncation & surrogates", () => {
  it("text body: emoji straddling the 200K cut", () => {
    const content = "x".repeat(MAX_BODY_CHARS - 1) + "😀".repeat(10);
    const n = mapGraphMessageToNormalized({ ...base, body: { contentType: "text", content } }, "mb");
    expect(loneSurrogate(n.body_text!)).toBe(false);
  });
  it("html body: emoji straddling the 200K output cut", () => {
    const content = "<p>" + "x".repeat(MAX_BODY_CHARS - 1) + "&#128512;".repeat(10) + "</p>";
    const n = mapGraphMessageToNormalized({ ...base, body: { contentType: "html", content } }, "mb");
    expect(loneSurrogate(n.body_text!)).toBe(false);
  });
  it("html body: emoji straddling the 800K raw cut", () => {
    const content = "x".repeat(MAX_BODY_CHARS * 4 - 1) + "😀".repeat(10);
    const n = mapGraphMessageToNormalized({ ...base, body: { contentType: "html", content } }, "mb");
    expect(loneSurrogate(n.body_text!)).toBe(false);
  });
});
describe("addresses", () => {
  it("redact plus-addressing and subdomains", () => {
    expect(redactAddresses("ping bob+rfi@sub.y.co.uk now")).toBe("ping [email-sub.y.co.uk] now");
    expect(redactAddresses("First.Last@mail.gc-builders.com")).toBe("[email-mail.gc-builders.com]");
    expect(redactAddresses("<carol_99%x@z.io>")).toBe("<[email-z.io]>");
  });
  
  it("redact address followed by digit", () => {
    // With the new fallback rules, digits after domain are included in the piece
    // The primary pattern doesn't match these (lookahead rejects digit after TLD)
    // The fallback processes them as truncated addresses
    const result1 = redactAddresses("See alice@example.com2 for details");
    const result2 = redactAddresses("Contact bob@test.org9");
    expect(result1).not.toContain("alice@");
    expect(result2).not.toContain("bob@");
  });
  
  it("redact truncated addresses in body preview", () => {
    // Fallback catches truncated addresses that start with a letter after @
    expect(redactAddresses("From: bob@gc.c")).toBe("From: [email-gc.c]");
    expect(redactAddresses("Reply to: alice@exa")).toBe("Reply to: [email-exa]");
    // Trailing @ with no text after is not redacted (not an email address)
    expect(redactAddresses("bob@")).toBe("bob@");
  });
  it("raw_records allowlistedPayload contains no address anywhere", () => {
    const n = mapGraphMessageToNormalized({ ...base, subject: "RE: RFI 12 from dave@sub.x.com",
      bodyPreview: "From: Erin <erin+pm@gc.com> Sent: Tue...", body: { contentType: "text", content: "Thanks frank@x.com" } }, "mailbox@gc.com");
    const raw = emailToRawRecord(n);
    const s = JSON.stringify(raw);
    console.log("raw payload:", s);
    expect(s).not.toMatch(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  });
  it("raw_records: from/to/cc reduced to domains", () => {
    const raw = emailToRawRecord(mapGraphMessageToNormalized({ ...base, body: null }, "mb"));
    const p = raw.allowlistedPayload as Record<string, unknown>;
    expect(p.from_domain).toBe("x.com"); expect(p.to_domains).toEqual(["sub.y.com"]); expect(p.cc_domains).toEqual(["z.com"]);
    for (const k of ["from", "to_recipients", "cc_recipients", "body_text", "source_mailbox"]) expect(p).not.toHaveProperty(k);
  });
  it("fingerprint ignores local parts and names, but sees domains", () => {
    const f = (m: object) => mapGraphMessageToNormalized({ ...base, ...m, body: { contentType: "text", content: "b" } }, "mb").fingerprint;
    const a = f({}); 
    expect(f({ from: { emailAddress: { name: "Z", address: "zed@x.com" } } })).toBe(a);
    expect(f({ toRecipients: [{ emailAddress: { name: "Q", address: "q@sub.y.com" } }] })).toBe(a);
    expect(f({ from: { emailAddress: { name: "A", address: "alice@other.com" } } })).not.toBe(a);
  });
});
