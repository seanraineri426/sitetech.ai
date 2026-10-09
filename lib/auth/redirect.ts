/**
 * Sanitize redirect URL to prevent open redirects.
 * Only allows same-origin relative paths.
 * Rejects absolute URLs, protocol-relative URLs, control characters, and path traversal attempts.
 */
export function sanitizeRedirectUrl(
  url: string | null,
  siteUrl: string,
  defaultUrl: string = "/app"
): string {
  if (!url) {
    return defaultUrl;
  }

  try {
    // Reject control characters and whitespace (both raw and after decoding)
    // This catches tab (\t, %09), newline (\n, %0A), and other control chars
    if (/[\x00-\x1F\x7F\s]/.test(url)) {
      return defaultUrl;
    }

    // Decode and check again for encoded control characters
    const decoded = decodeURIComponent(url);
    if (/[\x00-\x1F\x7F\s]/.test(decoded)) {
      return defaultUrl;
    }

    // Reject any backslash (raw or encoded)
    if (url.includes("\\") || decoded.includes("\\")) {
      return defaultUrl;
    }

    // Must start with exactly one / followed by a non-/ character
    if (!decoded.startsWith("/") || decoded.startsWith("//")) {
      return defaultUrl;
    }

    // Resolve against site URL and verify same origin
    const siteUrlObj = new URL(siteUrl);
    const resolvedUrl = new URL(decoded, siteUrl);

    if (resolvedUrl.origin !== siteUrlObj.origin) {
      return defaultUrl;
    }

    // Return the pathname with query and hash
    return resolvedUrl.pathname + resolvedUrl.search + resolvedUrl.hash;
  } catch {
    return defaultUrl;
  }
}
