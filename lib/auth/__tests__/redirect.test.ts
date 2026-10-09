import { describe, it, expect } from "vitest";
import { sanitizeRedirectUrl } from "../redirect";

describe("sanitizeRedirectUrl", () => {
  const defaultUrl = "/app";

  describe("allows safe relative paths", () => {
    it("allows simple relative path", () => {
      expect(sanitizeRedirectUrl("/dashboard", defaultUrl)).toBe("/dashboard");
    });

    it("allows relative path with query params", () => {
      expect(sanitizeRedirectUrl("/dashboard?tab=projects", defaultUrl)).toBe(
        "/dashboard?tab=projects"
      );
    });

    it("allows relative path with hash", () => {
      expect(sanitizeRedirectUrl("/dashboard#section", defaultUrl)).toBe("/dashboard#section");
    });

    it("returns default when url is null", () => {
      expect(sanitizeRedirectUrl(null, defaultUrl)).toBe(defaultUrl);
    });

    it("returns default when url is empty string", () => {
      expect(sanitizeRedirectUrl("", defaultUrl)).toBe(defaultUrl);
    });
  });

  describe("rejects absolute URLs", () => {
    it("rejects https URLs", () => {
      expect(sanitizeRedirectUrl("https://evil.com", defaultUrl)).toBe(defaultUrl);
    });

    it("rejects http URLs", () => {
      expect(sanitizeRedirectUrl("http://evil.com", defaultUrl)).toBe(defaultUrl);
    });

    it("rejects https URL with path", () => {
      expect(sanitizeRedirectUrl("https://evil.com/phishing", defaultUrl)).toBe(defaultUrl);
    });
  });

  describe("rejects protocol-relative URLs", () => {
    it("rejects //evil.com", () => {
      expect(sanitizeRedirectUrl("//evil.com", defaultUrl)).toBe(defaultUrl);
    });

    it("rejects //evil.com/path", () => {
      expect(sanitizeRedirectUrl("//evil.com/path", defaultUrl)).toBe(defaultUrl);
    });
  });

  describe("rejects backslash variants", () => {
    it("rejects /\\evil", () => {
      expect(sanitizeRedirectUrl("/\\evil", defaultUrl)).toBe(defaultUrl);
    });

    it("rejects paths with backslashes", () => {
      expect(sanitizeRedirectUrl("/path\\evil", defaultUrl)).toBe(defaultUrl);
    });
  });

  describe("rejects javascript and other protocols", () => {
    it("rejects javascript: protocol", () => {
      expect(sanitizeRedirectUrl("javascript:alert(1)", defaultUrl)).toBe(defaultUrl);
    });

    it("rejects data: protocol", () => {
      expect(sanitizeRedirectUrl("data:text/html,<script>alert(1)</script>", defaultUrl)).toBe(
        defaultUrl
      );
    });

    it("rejects vbscript: protocol", () => {
      expect(sanitizeRedirectUrl("vbscript:alert(1)", defaultUrl)).toBe(defaultUrl);
    });
  });

  describe("rejects non-slash-starting paths", () => {
    it("rejects relative path without leading slash", () => {
      expect(sanitizeRedirectUrl("dashboard", defaultUrl)).toBe(defaultUrl);
    });

    it("rejects path starting with other character", () => {
      expect(sanitizeRedirectUrl("@dashboard", defaultUrl)).toBe(defaultUrl);
    });
  });
});
