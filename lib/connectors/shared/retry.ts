/**
 * Shared retry logic for HTTP clients.
 * Handles exponential backoff with jitter, Retry-After, and rate limit headers.
 */

import "server-only";
import { logEvent, logRetry } from "./log";

export interface RetryOptions {
  maxRetries: number;
  maxWaitMs: number;
  baseDelayMs: number;
}

export interface RetryContext {
  attempt: number;
  lastError?: Error;
}

interface RateLimitHeaders {
  limit?: string | null;
  remaining?: string | null;
  reset?: string | null;
}

/**
 * Thrown when Retry-After exceeds maxWaitMs cap.
 */
export class RateLimitError extends Error {
  constructor(
    public retryAfterMs: number,
    public maxWaitMs: number
  ) {
    super(`Rate limit Retry-After (${retryAfterMs}ms) exceeds max wait cap (${maxWaitMs}ms)`);
    this.name = "RateLimitError";
  }
}

/**
 * Parse Retry-After header (seconds or HTTP-date).
 */
function parseRetryAfter(retryAfter: string | null): number | null {
  if (!retryAfter) return null;

  // Try parsing as seconds
  const seconds = parseInt(retryAfter, 10);
  if (!isNaN(seconds)) {
    return seconds * 1000;
  }

  // Try parsing as HTTP-date
  const date = new Date(retryAfter);
  if (!isNaN(date.getTime())) {
    return Math.max(0, date.getTime() - Date.now());
  }

  return null;
}

/**
 * Calculate exponential backoff with jitter.
 */
function calculateBackoff(attempt: number, baseDelayMs: number): number {
  const exponential = Math.pow(2, attempt) * baseDelayMs;
  const jitter = Math.random() * baseDelayMs;
  return exponential + jitter;
}

/**
 * Log rate limit headers (Procore).
 */
function logRateLimitHeaders(headers: RateLimitHeaders, provider: string): void {
  if (headers.limit || headers.remaining || headers.reset) {
    logEvent(`${provider}.RateLimit`, {
      limit: headers.limit || null,
      remaining: headers.remaining || null,
      reset: headers.reset
        ? new Date(parseInt(headers.reset) * 1000).toISOString()
        : null,
    });
  }
}

/**
 * Sleep for a given duration.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a request with exponential backoff.
 * 
 * @param fn Function that returns a Response
 * @param options Retry configuration
 * @param provider Provider name for logging (e.g., "Procore", "Graph")
 * @returns The successful Response
 * @throws Error if all retries exhausted
 */
export async function retryRequest(
  fn: () => Promise<Response>,
  options: RetryOptions,
  provider: string
): Promise<Response> {
  const { maxRetries, maxWaitMs, baseDelayMs } = options;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fn();

    // Success
    if (response.ok) {
      return response;
    }

    // Non-retryable errors
    if (response.status < 500 && response.status !== 429) {
      return response;
    }

    // Last attempt exhausted
    if (attempt === maxRetries) {
      if (response.ok) {
        return response;
      }
      throw new Error(`${provider}: All retries exhausted`);
    }

    // Calculate wait time
    let waitMs: number;

    if (response.status === 429 || response.status === 503) {
      const retryAfter = parseRetryAfter(response.headers.get("Retry-After"));
      
      if (retryAfter !== null) {
        if (retryAfter > maxWaitMs) {
          // Throw RateLimitError when Retry-After exceeds cap
          throw new RateLimitError(retryAfter, maxWaitMs);
        }
        waitMs = retryAfter;
      } else {
        // No Retry-After header, use exponential backoff
        waitMs = Math.min(calculateBackoff(attempt, baseDelayMs), maxWaitMs);
      }

      // Log rate limit headers if present (Procore)
      if (provider === "Procore") {
        logRateLimitHeaders(
          {
            limit: response.headers.get("X-Rate-Limit-Limit"),
            remaining: response.headers.get("X-Rate-Limit-Remaining"),
            reset: response.headers.get("X-Rate-Limit-Reset"),
          },
          provider
        );
      }
    } else {
      // 5xx errors use exponential backoff
      waitMs = Math.min(calculateBackoff(attempt, baseDelayMs), maxWaitMs);
    }

    // Cancel/consume response body before retry
    try {
      await response.body?.cancel();
    } catch {
      // Ignore cancellation errors
    }

    logRetry(provider, attempt, maxRetries, waitMs);

    await sleep(waitMs);
  }

  throw new Error(`${provider}: All retries exhausted`);
}
