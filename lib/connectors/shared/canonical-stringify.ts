/**
 * Canonical JSON stringification with sorted keys at every depth.
 * Used for stable fingerprint generation.
 */

/**
 * Recursively sort object keys at every depth.
 * Arrays are kept in order.
 */
function sortKeysRecursive(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sortKeysRecursive);
  }

  if (typeof obj === "object") {
    const sorted: Record<string, unknown> = {};
    const keys = Object.keys(obj).sort();

    for (const key of keys) {
      sorted[key] = sortKeysRecursive((obj as Record<string, unknown>)[key]);
    }

    return sorted;
  }

  return obj;
}

/**
 * Canonical JSON stringify with sorted keys at every depth.
 * Produces consistent output regardless of key order.
 */
export function canonicalStringify(obj: unknown): string {
  const sorted = sortKeysRecursive(obj);
  return JSON.stringify(sorted);
}
