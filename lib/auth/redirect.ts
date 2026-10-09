const CONTROL_OR_SPACE = /[\x00-\x1F\x7F\s]/;

function isSafeLocalPath(p: string): boolean {
  return p.startsWith("/") && !p.startsWith("//") && !p.includes("\\");
}

/**
 * Sanitize redirect URL to prevent open redirects.
 * Validates the exact string that is returned, so what we check is what we redirect to.
 */
export function sanitizeRedirectUrl(
  url: string | null,
  siteUrl: string,
  defaultUrl: string = "/app"
): string {
  if (!url) return defaultUrl;
  try {
    if (CONTROL_OR_SPACE.test(url) || url.includes("\\")) return defaultUrl;
    if (!isSafeLocalPath(url)) return defaultUrl; // raw input must itself start with exactly one '/'

    const decoded = decodeURIComponent(url);
    if (CONTROL_OR_SPACE.test(decoded) || decoded.includes("\\")) return defaultUrl;
    if (!isSafeLocalPath(decoded)) return defaultUrl;

    const site = new URL(siteUrl);
    // Normalize the decoded form too (catches /.%2F/evil.com -> //evil.com)
    const viaDecoded = new URL(decoded, site);
    if (viaDecoded.origin !== site.origin || !isSafeLocalPath(viaDecoded.pathname)) return defaultUrl;
    const parsed = new URL(url, site); // raw parse: normalizes dot segments, keeps encoding
    const out = parsed.pathname + parsed.search + parsed.hash;

    // Re-check the OUTPUT we will actually return
    if (parsed.origin !== site.origin || !isSafeLocalPath(out)) return defaultUrl;
    if (new URL(out, site).origin !== site.origin) return defaultUrl;
    // Encoded slashes/backslashes in the normalized path must not decode to '//' or '\'
    if (!isSafeLocalPath(decodeURIComponent(parsed.pathname))) return defaultUrl;

    return out;
  } catch {
    return defaultUrl;
  }
}
