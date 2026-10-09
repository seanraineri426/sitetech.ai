import { describe, it, expect } from "vitest";
import { sanitizeRedirectUrl } from "../redirect";

describe("sanitizeRedirectUrl", () => {
  const siteUrl = "http://localhost:3000";
  const defaultUrl = "/app";

  describe("allows safe relative paths", () => {
    it("allows simple relative path", () => {
      expect(sanitizeRedirectUrl("/dashboard", siteUrl, defaultUrl)).toBe("/dashboard");
    });

    it("allows relative path with query params", () => {
      expect(sanitizeRedirectUrl("/dashboard?tab=projects", siteUrl, defaultUrl)).toBe(
        "/dashboard?tab=projects"
      );
    });

    it("allows /app with query params", () => {
      expect(sanitizeRedirectUrl("/app?x=1", siteUrl, defaultUrl)).toBe("/app?x=1");
    });

    it("allows relative path with hash", () => {
      expect(sanitizeRedirectUrl("/dashboard#section", siteUrl, defaultUrl)).toBe("/dashboard#section");
    });

    it("returns default when url is null", () => {
      expect(sanitizeRedirectUrl(null, siteUrl, defaultUrl)).toBe(defaultUrl);
    });

    it("returns default when url is empty string", () => {
      expect(sanitizeRedirectUrl("", siteUrl, defaultUrl)).toBe(defaultUrl);
    });
  });

  describe("rejects absolute URLs", () => {
    it("rejects https URLs", () => {
      expect(sanitizeRedirectUrl("https://evil.com", siteUrl, defaultUrl)).toBe(defaultUrl);
    });

    it("rejects http URLs", () => {
      expect(sanitizeRedirectUrl("http://evil.com", siteUrl, defaultUrl)).toBe(defaultUrl);
    });

    it("rejects https URL with path", () => {
      expect(sanitizeRedirectUrl("https://evil.com/phishing", siteUrl, defaultUrl)).toBe(defaultUrl);
    });
  });

  describe("rejects protocol-relative URLs", () => {
    it("rejects //evil.com", () => {
      expect(sanitizeRedirectUrl("//evil.com", siteUrl, defaultUrl)).toBe(defaultUrl);
    });

    it("rejects //evil.com/path", () => {
      expect(sanitizeRedirectUrl("//evil.com/path", siteUrl, defaultUrl)).toBe(defaultUrl);
    });
  });

  describe("rejects dot segment attacks", () => {
    it("rejects /.//evil.com", () => {
      expect(sanitizeRedirectUrl("/.//evil.com", siteUrl, defaultUrl)).toBe(defaultUrl);
    });

    it("rejects /a/..//evil.com", () => {
      expect(sanitizeRedirectUrl("/a/..//evil.com", siteUrl, defaultUrl)).toBe(defaultUrl);
    });

    it("rejects /%2e//evil.com", () => {
      expect(sanitizeRedirectUrl("/%2e//evil.com", siteUrl, defaultUrl)).toBe(defaultUrl);
    });

    it("rejects /%2e%2e//evil.com", () => {
      expect(sanitizeRedirectUrl("/%2e%2e//evil.com", siteUrl, defaultUrl)).toBe(defaultUrl);
    });

    it("rejects /.%2F/evil.com", () => {
      expect(sanitizeRedirectUrl("/.%2F/evil.com", siteUrl, defaultUrl)).toBe(defaultUrl);
    });

    it("rejects /app/../..//evil.com", () => {
      expect(sanitizeRedirectUrl("/app/../..//evil.com", siteUrl, defaultUrl)).toBe(defaultUrl);
    });

    it("rejects /%2F%2Fevil.com with leading slash", () => {
      expect(sanitizeRedirectUrl("/%2F%2Fevil.com", siteUrl, defaultUrl)).toBe(defaultUrl);
    });

    // B1 cases: encoded query/hash characters hiding path traversal
    it("rejects /x%3F/..//evil.com (? in path)", () => {
      expect(sanitizeRedirectUrl("/x%3F/..//evil.com", siteUrl, defaultUrl)).toBe(defaultUrl);
    });

    it("rejects /x%3f/..//evil.com (lowercase ? in path)", () => {
      expect(sanitizeRedirectUrl("/x%3f/..//evil.com", siteUrl, defaultUrl)).toBe(defaultUrl);
    });

    it("rejects /x%23/..//evil.com (# in path)", () => {
      expect(sanitizeRedirectUrl("/x%23/..//evil.com", siteUrl, defaultUrl)).toBe(defaultUrl);
    });

    it("rejects /app%3F/../..//evil.com", () => {
      expect(sanitizeRedirectUrl("/app%3F/../..//evil.com", siteUrl, defaultUrl)).toBe(defaultUrl);
    });

    it("rejects /a%3F/%2e%2e//evil.com", () => {
      expect(sanitizeRedirectUrl("/a%3F/%2e%2e//evil.com", siteUrl, defaultUrl)).toBe(defaultUrl);
    });

    it("rejects %2Fx%3F/..//evil.com", () => {
      expect(sanitizeRedirectUrl("%2Fx%3F/..//evil.com", siteUrl, defaultUrl)).toBe(defaultUrl);
    });

    it("rejects /..//..%3F/", () => {
      expect(sanitizeRedirectUrl("/..//..%3F/", siteUrl, defaultUrl)).toBe(defaultUrl);
    });
  });

  describe("rejects backslash variants", () => {
    it("rejects /\\evil", () => {
      expect(sanitizeRedirectUrl("/\\evil", siteUrl, defaultUrl)).toBe(defaultUrl);
    });

    it("rejects paths with backslashes", () => {
      expect(sanitizeRedirectUrl("/path\\evil", siteUrl, defaultUrl)).toBe(defaultUrl);
    });

    it("rejects \\\\evil", () => {
      expect(sanitizeRedirectUrl("\\\\evil", siteUrl, defaultUrl)).toBe(defaultUrl);
    });

    it("rejects encoded backslash /%5Cevil", () => {
      expect(sanitizeRedirectUrl("/%5Cevil", siteUrl, defaultUrl)).toBe(defaultUrl);
    });
  });

  describe("rejects control characters and whitespace", () => {
    it("rejects tab character /\\t/evil.com", () => {
      expect(sanitizeRedirectUrl("/\t/evil.com", siteUrl, defaultUrl)).toBe(defaultUrl);
    });

    it("rejects newline character /\\n/evil.com", () => {
      expect(sanitizeRedirectUrl("/\n/evil.com", siteUrl, defaultUrl)).toBe(defaultUrl);
    });

    it("rejects encoded tab /%09/evil.com", () => {
      expect(sanitizeRedirectUrl("/%09/evil.com", siteUrl, defaultUrl)).toBe(defaultUrl);
    });

    it("rejects encoded newline /%0A/evil.com", () => {
      expect(sanitizeRedirectUrl("/%0A/evil.com", siteUrl, defaultUrl)).toBe(defaultUrl);
    });

    it("rejects NUL character", () => {
      expect(sanitizeRedirectUrl("/\x00evil", siteUrl, defaultUrl)).toBe(defaultUrl);
    });

    it("rejects space character", () => {
      expect(sanitizeRedirectUrl("/ /evil.com", siteUrl, defaultUrl)).toBe(defaultUrl);
    });
  });

  describe("rejects double-encoded schemes", () => {
    it("rejects %2F%2Fevil (double-encoded //evil)", () => {
      expect(sanitizeRedirectUrl("%2F%2Fevil", siteUrl, defaultUrl)).toBe(defaultUrl);
    });
  });

  describe("rejects javascript and other protocols", () => {
    it("rejects javascript: protocol", () => {
      expect(sanitizeRedirectUrl("javascript:alert(1)", siteUrl, defaultUrl)).toBe(defaultUrl);
    });

    it("rejects https:evil.com (missing slashes)", () => {
      expect(sanitizeRedirectUrl("https:evil.com", siteUrl, defaultUrl)).toBe(defaultUrl);
    });

    it("rejects data: protocol", () => {
      expect(sanitizeRedirectUrl("data:text/html,<script>alert(1)</script>", siteUrl, defaultUrl)).toBe(
        defaultUrl
      );
    });

    it("rejects vbscript: protocol", () => {
      expect(sanitizeRedirectUrl("vbscript:alert(1)", siteUrl, defaultUrl)).toBe(defaultUrl);
    });
  });

  describe("rejects non-slash-starting paths", () => {
    it("rejects relative path without leading slash", () => {
      expect(sanitizeRedirectUrl("dashboard", siteUrl, defaultUrl)).toBe(defaultUrl);
    });

    it("rejects path starting with other character", () => {
      expect(sanitizeRedirectUrl("@dashboard", siteUrl, defaultUrl)).toBe(defaultUrl);
    });
  });

  describe("preserves encoding in safe paths", () => {
    it("preserves %26 encoding in query string /app?q=a%26b", () => {
      expect(sanitizeRedirectUrl("/app?q=a%26b", siteUrl, defaultUrl)).toBe("/app?q=a%26b");
    });
  });

  describe("fuzz testing", () => {
    it("rejects random combinations that might escape", () => {
      const charset = ["/", ".", "%", "2", "e", "E", "F", "3", "f", "2", "3", "\\", "?", "#", "a"];
      const site = new URL(siteUrl);
      
      // Test 1000 random combinations (scaled down from 10k for test speed)
      for (let i = 0; i < 1000; i++) {
        let input = "";
        const len = Math.floor(Math.random() * 30) + 1;
        for (let j = 0; j < len; j++) {
          input += charset[Math.floor(Math.random() * charset.length)];
        }
        
        const result = sanitizeRedirectUrl(input, siteUrl, defaultUrl);
        
        // If not rejected, must be same-origin
        if (result !== defaultUrl) {
          try {
            const resultUrl = new URL(result, siteUrl);
            expect(resultUrl.origin).toBe(site.origin);
          } catch {
            // If it throws, that's fine - just make sure it was rejected
            expect(result).toBe(defaultUrl);
          }
        }
      }
    });
  });
});
