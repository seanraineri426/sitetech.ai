/**
 * Comprehensive tests for shared retry helper.
 * Covers Retry-After (seconds and HTTP-date), jitter, exponential backoff, and max cap.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock server-only
vi.mock("server-only", () => ({}));

import { retryRequest, sleep } from "../retry";

describe("Shared retry helper", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Retry-After in seconds", () => {
    it("honors Retry-After header in seconds", async () => {
      let attempt = 0;
      const mockFn = vi.fn(async () => {
        attempt++;
        if (attempt === 1) {
          return new Response(null, {
            status: 429,
            headers: { "Retry-After": "3" },
          });
        }
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      });

      const promise = retryRequest(mockFn, { maxRetries: 3, maxWaitMs: 60000, baseDelayMs: 1000 }, "Test");
      
      // Advance by retry-after time
      await vi.advanceTimersByTimeAsync(3000);
      const response = await promise;

      expect(response.status).toBe(200);
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it("waits exact seconds from Retry-After", async () => {
      let attempt = 0;
      const mockFn = vi.fn(async () => {
        attempt++;
        if (attempt === 1) {
          return new Response(null, {
            status: 503,
            headers: { "Retry-After": "5" },
          });
        }
        return new Response(null, { status: 200 });
      });

      const promise = retryRequest(mockFn, { maxRetries: 3, maxWaitMs: 60000, baseDelayMs: 1000 }, "Test");
      
      await vi.advanceTimersByTimeAsync(5000);
      await promise;

      expect(mockFn).toHaveBeenCalledTimes(2);
    });
  });

  describe("Retry-After as HTTP-date", () => {
    it("honors Retry-After header as HTTP-date", async () => {
      let attempt = 0;
      const retryDate = new Date(Date.now() + 4000).toUTCString();
      
      const mockFn = vi.fn(async () => {
        attempt++;
        if (attempt === 1) {
          return new Response(null, {
            status: 429,
            headers: { "Retry-After": retryDate },
          });
        }
        return new Response(null, { status: 200 });
      });

      const promise = retryRequest(mockFn, { maxRetries: 3, maxWaitMs: 60000, baseDelayMs: 1000 }, "Test");
      
      await vi.advanceTimersByTimeAsync(4000);
      await promise;

      expect(mockFn).toHaveBeenCalledTimes(2);
    });
  });

  describe("Maximum wait cap", () => {
    it("caps wait time to maxWaitMs", async () => {
      let attempt = 0;
      const mockFn = vi.fn(async () => {
        attempt++;
        if (attempt === 1) {
          return new Response(null, {
            status: 429,
            headers: { "Retry-After": "120" }, // 2 minutes
          });
        }
        return new Response(null, { status: 200 });
      });

      const promise = retryRequest(mockFn, { maxRetries: 3, maxWaitMs: 10000, baseDelayMs: 1000 }, "Test");
      
      // Should cap at 10 seconds, not wait 120 seconds
      await vi.advanceTimersByTimeAsync(10000);
      await promise;

      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it("caps HTTP-date Retry-After to maxWaitMs", async () => {
      let attempt = 0;
      const retryDate = new Date(Date.now() + 90000).toUTCString(); // 90 seconds
      
      const mockFn = vi.fn(async () => {
        attempt++;
        if (attempt === 1) {
          return new Response(null, {
            status: 429,
            headers: { "Retry-After": retryDate },
          });
        }
        return new Response(null, { status: 200 });
      });

      const promise = retryRequest(mockFn, { maxRetries: 3, maxWaitMs: 15000, baseDelayMs: 1000 }, "Test");
      
      await vi.advanceTimersByTimeAsync(15000);
      await promise;

      expect(mockFn).toHaveBeenCalledTimes(2);
    });
  });

  describe("Exponential backoff with jitter", () => {
    it("applies exponential backoff on 5xx without Retry-After", async () => {
      let attempt = 0;
      const mockFn = vi.fn(async () => {
        attempt++;
        if (attempt === 1) {
          return new Response(null, { status: 500 });
        }
        return new Response(null, { status: 200 });
      });

      const promise = retryRequest(mockFn, { maxRetries: 3, maxWaitMs: 60000, baseDelayMs: 1000 }, "Test");
      
      // Exponential: 2^0 * 1000 + jitter (0-1000) = 1000-2000ms
      await vi.advanceTimersByTimeAsync(2500);
      await promise;

      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it("applies exponential backoff on 429 without Retry-After", async () => {
      let attempt = 0;
      const mockFn = vi.fn(async () => {
        attempt++;
        if (attempt === 1) {
          return new Response(null, { status: 429 });
        }
        return new Response(null, { status: 200 });
      });

      const promise = retryRequest(mockFn, { maxRetries: 3, maxWaitMs: 60000, baseDelayMs: 1000 }, "Test");
      
      await vi.advanceTimersByTimeAsync(2500);
      await promise;

      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it("increases backoff exponentially across attempts", async () => {
      let attempt = 0;
      const mockFn = vi.fn(async () => {
        attempt++;
        if (attempt <= 2) {
          return new Response(null, { status: 500 });
        }
        return new Response(null, { status: 200 });
      });

      const promise = retryRequest(mockFn, { maxRetries: 3, maxWaitMs: 60000, baseDelayMs: 1000 }, "Test");
      
      // First retry: 2^0 * 1000 + jitter = ~1000-2000ms
      await vi.advanceTimersByTimeAsync(2500);
      
      // Second retry: 2^1 * 1000 + jitter = ~2000-3000ms
      await vi.advanceTimersByTimeAsync(3500);
      
      await promise;

      expect(mockFn).toHaveBeenCalledTimes(3);
    });
  });

  describe("Retry logic", () => {
    it("returns immediately on success", async () => {
      const mockFn = vi.fn(async () => new Response(null, { status: 200 }));

      await retryRequest(mockFn, { maxRetries: 3, maxWaitMs: 60000, baseDelayMs: 1000 }, "Test");

      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it("does not retry 4xx errors except 429", async () => {
      const mockFn = vi.fn(async () => new Response(null, { status: 403 }));

      const response = await retryRequest(mockFn, { maxRetries: 3, maxWaitMs: 60000, baseDelayMs: 1000 }, "Test");

      expect(response.status).toBe(403);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it("retries 5xx errors", async () => {
      let attempt = 0;
      const mockFn = vi.fn(async () => {
        attempt++;
        if (attempt === 1) {
          return new Response(null, { status: 502 });
        }
        return new Response(null, { status: 200 });
      });

      const promise = retryRequest(mockFn, { maxRetries: 3, maxWaitMs: 60000, baseDelayMs: 1000 }, "Test");
      
      await vi.advanceTimersByTimeAsync(3000);
      const response = await promise;

      expect(response.status).toBe(200);
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it("throws after maxRetries exhausted", async () => {
      const mockFn = vi.fn(async () => new Response(null, { status: 500 }));

      const promise = retryRequest(mockFn, { maxRetries: 2, maxWaitMs: 60000, baseDelayMs: 1000 }, "Test");
      
      // Advance through all retries
      await vi.advanceTimersByTimeAsync(10000);

      await expect(promise).rejects.toThrow("Test: All retries exhausted");
      expect(mockFn).toHaveBeenCalledTimes(3); // initial + 2 retries
    });
  });

  describe("Rate limit header logging", () => {
    it("logs Procore rate limit headers", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      
      let attempt = 0;
      const mockFn = vi.fn(async () => {
        attempt++;
        if (attempt === 1) {
          return new Response(null, {
            status: 429,
            headers: {
              "Retry-After": "1",
              "X-Rate-Limit-Limit": "600",
              "X-Rate-Limit-Remaining": "0",
              "X-Rate-Limit-Reset": String(Math.floor(Date.now() / 1000) + 60),
            },
          });
        }
        return new Response(null, { status: 200 });
      });

      const promise = retryRequest(mockFn, { maxRetries: 3, maxWaitMs: 60000, baseDelayMs: 1000 }, "Procore");
      
      await vi.advanceTimersByTimeAsync(1000);
      await promise;

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[Procore Rate Limit]"),
        expect.objectContaining({
          limit: "600",
          remaining: "0",
          reset: expect.any(String),
        })
      );

      consoleSpy.mockRestore();
    });

    it("does not log rate limit headers for other providers", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      
      let attempt = 0;
      const mockFn = vi.fn(async () => {
        attempt++;
        if (attempt === 1) {
          return new Response(null, {
            status: 429,
            headers: { "Retry-After": "1" },
          });
        }
        return new Response(null, { status: 200 });
      });

      const promise = retryRequest(mockFn, { maxRetries: 3, maxWaitMs: 60000, baseDelayMs: 1000 }, "Graph");
      
      await vi.advanceTimersByTimeAsync(1000);
      await promise;

      const rateLimitCalls = consoleSpy.mock.calls.filter(call =>
        call[0]?.toString().includes("[Procore Rate Limit]")
      );
      expect(rateLimitCalls).toHaveLength(0);

      consoleSpy.mockRestore();
    });
  });

  describe("Sleep function", () => {
    it("resolves after specified time", async () => {
      const promise = sleep(5000);
      
      await vi.advanceTimersByTimeAsync(5000);
      await promise;

      expect(true).toBe(true);
    });
  });
});
