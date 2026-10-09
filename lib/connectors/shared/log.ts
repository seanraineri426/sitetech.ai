/**
 * CTO-approved logging utility for connectors.
 * 
 * Rule: NO customer field values in logs on ANY connector.
 * 
 * Allowlisting is done BY KEY:
 * - Event names must be from a fixed set (validated at runtime)
 * - Field keys must be from a fixed set
 * - Numbers are allowed ONLY on specific keys
 * - Strings are allowed ONLY from per-key enums or ID formats
 * - Unknown keys are omitted entirely (never shown, not even as "[dropped]")
 * - Everything else becomes '[dropped]'
 */

import "server-only";

/**
 * Allowed event names. Unknown names throw an error.
 */
const ALLOWED_EVENT_NAMES = new Set<string>([
  "Procore.RateLimit",
  "Graph.RateLimit",
  "P6.Parser.EmptyTaskCode",
]);

/**
 * Production code passes only these keys to logEvent/logWarning.
 * Grep call sites: skipped_count (P6), limit/remaining/reset_at (retry).
 */
const ALLOWED_KEYS = new Set<string>([
  "skipped_count",
  "limit",
  "remaining",
  "reset_at",
  "provider", // Used internally by logRetry
]);

/**
 * Keys that can hold numeric values.
 */
const NUMERIC_KEYS = new Set<string>([
  "skipped_count",
  "limit",
  "remaining",
]);

const PROVIDER_VALUES = new Set<string>(["Procore", "Graph", "P6"]);

const ISO_8601_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;

function sanitizeValue(key: string, value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "number") {
    if (NUMERIC_KEYS.has(key)) {
      return value;
    }
    return "[dropped]";
  }

  if (typeof value === "string") {
    if (key === "provider") {
      return PROVIDER_VALUES.has(value) ? value : "[dropped]";
    }
    if (key === "reset_at") {
      return ISO_8601_REGEX.test(value) ? value : "[dropped]";
    }
    return "[dropped]";
  }

  return "[dropped]";
}

function sanitizeFields(fields: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    // Omit unknown keys entirely - never show them, not even as "[dropped]"
    if (ALLOWED_KEYS.has(key)) {
      sanitized[key] = sanitizeValue(key, value);
    }
  }
  return sanitized;
}

export function logEvent(name: string, fields: Record<string, unknown> = {}): void {
  if (!ALLOWED_EVENT_NAMES.has(name)) {
    throw new Error(`Unknown event name: ${name}`);
  }
  const sanitized = sanitizeFields(fields);
  console.log(`[${name}]`, sanitized);
}

export function logRetry(provider: string, attempt: number, maxRetries: number, waitMs: number): void {
  const sanitizedProvider = sanitizeValue("provider", provider);
  console.log(`[${sanitizedProvider}] Retrying after ${waitMs}ms (attempt ${attempt + 1}/${maxRetries})`);
}

export function logWarning(name: string, fields: Record<string, unknown> = {}): void {
  if (!ALLOWED_EVENT_NAMES.has(name)) {
    throw new Error(`Unknown event name: ${name}`);
  }
  const sanitized = sanitizeFields(fields);
  console.warn(`[${name}]`, sanitized);
}
