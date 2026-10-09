/**
 * CTO-approved logging utility for connectors.
 * 
 * Rule: NO customer field values in logs on ANY connector.
 * Logs may contain only:
 * - IDs (strings or numbers)
 * - Counts (numbers)
 * - Status codes (numbers)
 * - Durations (numbers)
 * - Endpoint paths with IDs (no query values)
 * - Error class names (strings)
 * - Enum-like status strings capped at 64 chars matching /^[A-Za-z0-9_.:\/-]+$/
 * 
 * Anything else gets dropped and replaced with '[dropped]'.
 */

import "server-only";

type AllowedValue = string | number | boolean | null | undefined;

interface LogFields {
  [key: string]: AllowedValue | AllowedValue[] | { [key: string]: AllowedValue };
}

const ENUM_PATTERN = /^[A-Za-z0-9_.:\/-]+$/;
const MAX_STRING_LENGTH = 64;

/**
 * Sanitize a single value according to CTO rules.
 */
function sanitizeValue(value: unknown): AllowedValue {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    // Allow only enum-like strings capped at 64 chars
    if (value.length <= MAX_STRING_LENGTH && ENUM_PATTERN.test(value)) {
      return value;
    }
    return "[dropped]";
  }

  return "[dropped]";
}

/**
 * Sanitize a log field object recursively (one level deep).
 */
function sanitizeFields(fields: LogFields): Record<string, AllowedValue | AllowedValue[]> {
  const sanitized: Record<string, AllowedValue | AllowedValue[]> = {};

  for (const [key, value] of Object.entries(fields)) {
    if (Array.isArray(value)) {
      sanitized[key] = value.map(sanitizeValue);
    } else if (value !== null && typeof value === "object") {
      // One level deep object sanitization
      const nestedSanitized: Record<string, AllowedValue> = {};
      for (const [nestedKey, nestedValue] of Object.entries(value)) {
        nestedSanitized[nestedKey] = sanitizeValue(nestedValue);
      }
      sanitized[key] = nestedSanitized as unknown as AllowedValue;
    } else {
      sanitized[key] = sanitizeValue(value);
    }
  }

  return sanitized;
}

/**
 * Log an event with allowlisted fields only.
 * 
 * @param name Event name (e.g., "Procore.RateLimitHeaders", "Graph.Retry")
 * @param fields Key-value pairs of allowlisted fields
 */
export function logEvent(name: string, fields: LogFields): void {
  const sanitized = sanitizeFields(fields);
  console.log(`[${name}]`, sanitized);
}

/**
 * Log a retry event (common pattern across connectors).
 * 
 * @param provider Provider name (e.g., "Procore", "Graph")
 * @param attempt Current attempt number
 * @param maxRetries Maximum retries
 * @param waitMs Wait time in milliseconds
 */
export function logRetry(provider: string, attempt: number, maxRetries: number, waitMs: number): void {
  const sanitizedProvider = sanitizeValue(provider);
  console.log(`[${sanitizedProvider}] Retrying after ${waitMs}ms (attempt ${attempt + 1}/${maxRetries})`);
}

/**
 * Log a warning with sanitized context.
 * 
 * @param name Warning name
 * @param fields Allowlisted fields
 */
export function logWarning(name: string, fields: LogFields): void {
  const sanitized = sanitizeFields(fields);
  console.warn(`[${name}]`, sanitized);
}
