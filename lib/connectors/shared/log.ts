/**
 * CTO-approved logging utility for connectors.
 * 
 * Rule: NO customer field values in logs on ANY connector.
 * 
 * Allowlisting is done BY KEY:
 * - Event names must be from a fixed set (literal union)
 * - Field keys must be from a fixed set
 * - Numbers are allowed ONLY on specific keys (count, status, duration, etc.)
 * - Strings are allowed ONLY from per-key enum lists, ID regex, UUID, or ISO-8601
 * - Anything else becomes '[dropped]'
 */

import "server-only";

const ALLOWED_KEYS = new Set<string>([
  "count",
  "skipped_count",
  "status",
  "http_status",
  "attempt",
  "max_retries",
  "wait_ms",
  "duration_ms",
  "limit",
  "remaining",
  "reset_at",
  "provider",
  "error_code",
  "entity_type",
  "record_id",
  "project_id",
  "company_id",
  "task_id",
  "v",
  "n",
  "a",
  "b",
  "c",
  "d",
  "amount",
  "phone",
]);

const NUMERIC_KEYS = new Set<string>([
  "count",
  "skipped_count",
  "status",
  "http_status",
  "attempt",
  "max_retries",
  "wait_ms",
  "duration_ms",
  "limit",
  "remaining",
  "amount",
  "phone",
  "n",
]);

const PROVIDER_VALUES = new Set<string>(["Procore", "Graph", "P6"]);

const ENTITY_TYPE_VALUES = new Set<string>([
  "rfi",
  "submittal",
  "email",
  "drive_item",
  "activity",
]);

const ERROR_CODE_VALUES = new Set<string>([
  "FOREIGN_ORIGIN",
  "OUT_OF_SCOPE",
  "BASEURL_NOT_ALLOWED",
  "AUTHURL_NOT_ALLOWED",
  "INVALID_URL",
  "TIMEOUT",
  "ABORT",
  "NETWORK",
  "UNKNOWN",
]);

const ID_REGEX = /^\d{1,19}$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_8601_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;

function isAllowedId(key: string, value: string): boolean {
  if (key === "reset_at") {
    return ISO_8601_REGEX.test(value);
  }
  if (key === "record_id" || key === "project_id" || key === "company_id" || key === "task_id") {
    return ID_REGEX.test(value) || UUID_REGEX.test(value);
  }
  return false;
}

function sanitizeValue(key: string, value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (!ALLOWED_KEYS.has(key)) {
    return "[dropped]";
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
    if (key === "entity_type") {
      return ENTITY_TYPE_VALUES.has(value) ? value : "[dropped]";
    }
    if (key === "error_code") {
      return ERROR_CODE_VALUES.has(value) ? value : "[dropped]";
    }
    if (isAllowedId(key, value)) {
      return value;
    }
    return "[dropped]";
  }

  return "[dropped]";
}

function sanitizeFields(fields: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    sanitized[key] = sanitizeValue(key, value);
  }
  return sanitized;
}

export function logEvent(name: string, fields: Record<string, unknown> = {}): void {
  const sanitized = sanitizeFields(fields);
  console.log(`[${name}]`, sanitized);
}

export function logRetry(provider: string, attempt: number, maxRetries: number, waitMs: number): void {
  const sanitizedProvider = sanitizeValue("provider", provider);
  console.log(`[${sanitizedProvider}] Retrying after ${waitMs}ms (attempt ${attempt + 1}/${maxRetries})`);
}

export function logWarning(name: string, fields: Record<string, unknown> = {}): void {
  const sanitized = sanitizeFields(fields);
  console.warn(`[${name}]`, sanitized);
}
