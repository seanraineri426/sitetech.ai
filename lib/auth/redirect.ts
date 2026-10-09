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

    // Resolve against site URL to normalize path (handles dot segments)
    const siteUrlObj = new URL(siteUrl);
    const resolvedUrl = new URL(decoded, siteUrl);

    // Extract the normalized path
    const normalizedPath = resolvedUrl.pathname + resolvedUrl.search + resolvedUrl.hash;

    // Re-check the OUTPUT: must start with exactly one / and no backslashes
    if (!normalizedPath.startsWith("/") || normalizedPath.startsWith("//")) {
      return defaultUrl;
    }

    if (normalizedPath.includes("\\")) {
      return defaultUrl;
    }

    // Verify same origin after normalization
    if (resolvedUrl.origin !== siteUrlObj.origin) {
      return defaultUrl;
    }

    // Return the original input (preserving encoding) since we've validated it's safe
    // Extract just the path portion from the original input
    const inputUrl = new URL(url, siteUrl);
    return inputUrl.pathname + inputUrl.search + inputUrl.hash;
  } catch {
    return defaultUrl;
  }
}
