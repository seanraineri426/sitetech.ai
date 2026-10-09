/**
 * Sanitize redirect URL to prevent open redirects.
 * Only allows same-origin relative paths.
 * Rejects absolute URLs, protocol-relative URLs, and path traversal attempts.
 */
export function sanitizeRedirectUrl(url: string | null, defaultUrl: string = "/app"): string {
  if (!url) {
    return defaultUrl;
  }

  try {
    // Reject absolute URLs (https://evil.com)
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return defaultUrl;
    }

    // Reject protocol-relative URLs (//evil.com)
    if (url.startsWith("//")) {
      return defaultUrl;
    }

    // Reject backslash variants (/\evil)
    if (url.includes("\\")) {
      return defaultUrl;
    }

    // Reject javascript: and other protocols
    if (url.includes(":")) {
      return defaultUrl;
    }

    // Only allow paths that start with /
    if (!url.startsWith("/")) {
      return defaultUrl;
    }

    return url;
  } catch {
    return defaultUrl;
  }
}
