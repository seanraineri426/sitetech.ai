/**
 * Tests for address redaction module.
 * 
 * This module is isomorphic and must work without server-only dependencies.
 */

import { describe, it, expect } from "vitest";
import { redactAddresses } from "../addresses";

// NOTE: No vi.mock("server-only") here - this proves the module has no server-only dependency

describe("redactAddresses - isomorphic module", () => {
  it("imports without server-only mock", () => {
    // If this test runs, the module imported successfully without server-only
    expect(redactAddresses).toBeDefined();
    expect(typeof redactAddresses).toBe("function");
  });

  it("redacts basic email addresses", () => {
    const text = "Contact alice@example.com or bob@test.org for details.";
    const redacted = redactAddresses(text);
    
    expect(redacted).toBe("Contact [email-example.com] or [email-test.org] for details.");
  });

  it("handles unicode domains", () => {
    const result = redactAddresses("user@почта.рф test");
    expect(result).toBe("[email-почта.рф] test");
  });

  it("handles look-alike characters", () => {
    // Full-width @ (U+FF20)
    expect(redactAddresses("bob＠x.com")).toBe("[email-x.com]");
    
    // Full-width dot (U+FF0E)
    expect(redactAddresses("bob@x．com")).toBe("[email-x.com]");
  });

  it("handles invisible format characters", () => {
    // Zero-width space after @
    expect(redactAddresses("bob@\u200bx.com")).toBe("[email-x.com]");
    
    // Soft hyphen in domain
    expect(redactAddresses("bob@acme\u00admech.com")).toBe("[email-acmemech.com]");
  });

  it("preserves construction notation", () => {
    expect(redactAddresses("#5@10 rebar")).toBe("#5@10 rebar");
    expect(redactAddresses("beam@grid.3")).toBe("beam@grid.3");
    expect(redactAddresses("col@A.5")).toBe("col@A.5");
  });

  it("redacts digit-leading domains", () => {
    expect(redactAddresses("bob@3m.com_")).toBe("[email-3m.com]_");
    expect(redactAddresses("alice@123.com test")).toBe("[email-123.com] test");
  });

  it("handles adjacent addresses", () => {
    const text = "bob@x.com,carol@y.com";
    const result = redactAddresses(text);
    expect(result).not.toContain("@");
    expect(result).toContain("[email-x.com]");
    expect(result).toContain("[email-y.com]");
  });

  it("leaves non-email @ symbols unchanged", () => {
    expect(redactAddresses("price @ $5")).toBe("price @ $5");
    expect(redactAddresses("@channel")).toBe("@channel");
  });

  it("strips format chars from placeholder domain", () => {
    const result = redactAddresses("bob@\u200bx\u00ad.com");
    expect(result).toBe("[email-x.com]");
    expect(result).not.toContain("\u200b");
    expect(result).not.toContain("\u00ad");
  });

  it("performance: handles 200KB with no addresses quickly", () => {
    const text = "a".repeat(200_000);
    const t0 = performance.now();
    const result = redactAddresses(text);
    const elapsed = performance.now() - t0;
    
    expect(result).toBe(text);
    expect(elapsed).toBeLessThan(50);
  });

  it("performance: handles many addresses without quadratic behavior", () => {
    const text = "alice@example.com ".repeat(10000);
    const t0 = performance.now();
    redactAddresses(text);
    const elapsed = performance.now() - t0;
    
    // Should be fast even with many addresses (O(n) not O(n²))
    expect(elapsed).toBeLessThan(200);
  });
});
