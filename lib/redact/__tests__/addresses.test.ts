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

  describe("trailing '@' and address chains", () => {
    it("redacts address chains with trailing '@'", () => {
      // Multiple addresses separated by '-' with trailing '@'
      expect(redactAddresses("alice@acme.com-bob@acme.com-carol@acme.com@")).not.toContain("alice");
      expect(redactAddresses("alice@acme.com-bob@acme.com-carol@acme.com@")).not.toContain("bob");
      expect(redactAddresses("alice@acme.com-bob@acme.com-carol@acme.com@")).not.toContain("carol");
      expect(redactAddresses("alice@acme.com-bob@acme.com-carol@acme.com@")).not.toMatch(/\w@\w/);
    });

    it("redacts addresses with trailing '@' variations", () => {
      expect(redactAddresses("bob@x.com_@")).not.toContain("bob");
      expect(redactAddresses("bob@x.com_@")).not.toMatch(/\w@\w/);
      
      expect(redactAddresses("bob@3m.com_carol@3m.com_@")).not.toContain("bob");
      expect(redactAddresses("bob@3m.com_carol@3m.com_@")).not.toContain("carol");
      expect(redactAddresses("bob@3m.com_carol@3m.com_@")).not.toMatch(/\w@\w/);
    });

    it("redacts glued address chains with trailing '@'", () => {
      const result = redactAddresses("alice@acme.combob@acme.comcarol@acme.com@");
      expect(result).not.toContain("alice");
      expect(result).not.toContain("bob");
      expect(result).not.toContain("carol");
      expect(result).not.toMatch(/\w@\w/);
    });

    it("handles various trailing punctuation with '@'", () => {
      // Trailing '@' alone
      const result1 = redactAddresses("bob@x.com@");
      expect(result1).not.toContain("bob");
      expect(result1).not.toMatch(/\w@\w/);
      
      // Trailing '@@'
      const result2 = redactAddresses("bob@x.com@@");
      expect(result2).not.toContain("bob");
      expect(result2).not.toMatch(/\w@\w/);
      
      // Trailing '@.'
      const result3 = redactAddresses("bob@x.com@.");
      expect(result3).not.toContain("bob");
      expect(result3).not.toMatch(/\w@\w/);
      
      // Trailing '@-'
      const result4 = redactAddresses("bob@x.com@-");
      expect(result4).not.toContain("bob");
      expect(result4).not.toMatch(/\w@\w/);
      
      // Trailing '@_'
      const result5 = redactAddresses("bob@x.com@_");
      expect(result5).not.toContain("bob");
      expect(result5).not.toMatch(/\w@\w/);
    });

    it("handles full-width '@' at end", () => {
      const result = redactAddresses("bob@x.com＠");
      expect(result).not.toContain("bob");
      expect(result).not.toMatch(/\w@\w/);
    });

    it("giant glued run with trailing '@' in bounded time, no leak", () => {
      // 900K of repeated addresses with no separators, ending in '@'
      const chunk = "a1@acme1.coma2@acme2.coma3@acme3.com";
      const iterations = Math.ceil(900000 / chunk.length);
      const hugeText = chunk.repeat(iterations) + "@";
      
      const t0 = performance.now();
      const result = redactAddresses(hugeText);
      const elapsed = performance.now() - t0;
      
      console.log("900K glued addresses", elapsed.toFixed(0), "ms");
      expect(elapsed).toBeLessThan(1000);
      
      // Must not leak local parts
      expect(result).not.toContain("a1");
      expect(result).not.toContain("a2");
      expect(result).not.toContain("a3");
      expect(result).not.toMatch(/\w@\w/);
    });

    it("giant full-width glued run with trailing '@' in bounded time, no leak", () => {
      // 900K of repeated addresses with full-width '@', ending in '＠'
      const chunk = "a1＠acme1.coma2＠acme2.coma3＠acme3.com";
      const iterations = Math.ceil(900000 / chunk.length);
      const hugeText = chunk.repeat(iterations) + "＠";
      
      const t0 = performance.now();
      const result = redactAddresses(hugeText);
      const elapsed = performance.now() - t0;
      
      console.log("900K full-width glued addresses", elapsed.toFixed(0), "ms");
      expect(elapsed).toBeLessThan(1000);
      
      // Must not leak local parts
      expect(result).not.toContain("a1");
      expect(result).not.toContain("a2");
      expect(result).not.toContain("a3");
      expect(result).not.toMatch(/\w@\w/);
    });
  });
});
