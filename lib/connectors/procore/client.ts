/**
 * Procore GET-only HTTP client with OAuth client credentials (DMSA).
 * 
 * Features:
 * - In-memory token caching until expiry
 * - GET-only enforcement (throws on other verbs)
 * - Pagination handling with Link headers
 * - Rate limit handling (429 + Procore headers with backoff)
 * - Optional record mode for fixture generation
 * - Configurable sandbox/production base URLs
 */

import { z } from "zod";

const ProcoreConfigSchema = z.object({
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  baseUrl: z.string().url().default("https://api.procore.com"),
  authUrl: z.string().url().default("https://login.procore.com"),
  companyId: z.string().min(1),
  recordMode: z.boolean().default(false),
  recordPath: z.string().default("./fixtures/procore"),
});

export type ProcoreConfig = z.infer<typeof ProcoreConfigSchema>;

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  created_at: number;
}

interface CachedToken {
  token: string;
  expiresAt: number;
}

interface RateLimitInfo {
  limit: number | null;
  remaining: number | null;
  reset: number | null; // Unix timestamp
}

export interface ProcoreResponse<T> {
  data: T;
  headers: {
    link: string | null;
    total: string | null;
    perPage: string | null;
    rateLimit: RateLimitInfo;
  };
}

interface RecordedRequest {
  method: string;
  path: string;
  query: Record<string, string>;
  headers_redacted: Record<string, string>;
}

interface RecordedResponse {
  status: number;
  headers: {
    link?: string;
    total?: string;
    "per-page"?: string;
    "x-rate-limit-limit"?: string;
    "x-rate-limit-remaining"?: string;
    "x-rate-limit-reset"?: string;
  };
  body: unknown;
}

interface FixtureRecord {
  request: RecordedRequest;
  response: RecordedResponse;
  recorded_at: string;
  sandbox_company_id: string;
  app_version: string;
}

/**
 * GET-only HTTP client for Procore REST API.
 * Throws on non-GET verbs to enforce read-only policy.
 */
export class ProcoreClient {
  private config: ProcoreConfig;
  private tokenCache: CachedToken | null = null;
  private fixtureCounter = 0;

  constructor(config: Partial<ProcoreConfig>) {
    this.config = ProcoreConfigSchema.parse(config);
  }

  /**
   * Fetch an access token via OAuth client credentials.
   * Caches in memory until 5 minutes before expiry.
   */
  private async getAccessToken(): Promise<string> {
    // Return cached token if still valid (with 5min buffer)
    if (
      this.tokenCache &&
      this.tokenCache.expiresAt > Date.now() + 5 * 60 * 1000
    ) {
      return this.tokenCache.token;
    }

    const response = await fetch(`${this.config.authUrl}/oauth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Procore token fetch failed: ${response.status} ${await response.text()}`
      );
    }

    const data: TokenResponse = await response.json();
    
    this.tokenCache = {
      token: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };

    return this.tokenCache.token;
  }

  /**
   * GET request with rate limit handling and optional recording.
   * 
   * @throws Error if method is not GET (enforces read-only policy)
   * @throws Error on 403 (permission denied, confirms read-only template)
   */
  async get<T>(
    path: string,
    params?: Record<string, string | number | boolean>
  ): Promise<ProcoreResponse<T>> {
    const token = await this.getAccessToken();
    
    const url = new URL(path, this.config.baseUrl);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, String(value));
      });
    }

    let attempt = 0;
    const maxRetries = 3;

    while (attempt <= maxRetries) {
      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Procore-Company-Id": this.config.companyId,
          Accept: "application/json",
        },
      });

      const rateLimit = this.extractRateLimit(response.headers);

      // Handle rate limiting with exponential backoff
      if (response.status === 429) {
        const resetTime = rateLimit.reset
          ? rateLimit.reset * 1000
          : Date.now() + Math.pow(2, attempt) * 1000;
        const waitTime = Math.max(resetTime - Date.now(), 1000);
        
        if (attempt < maxRetries) {
          await this.sleep(waitTime);
          attempt++;
          continue;
        }
        throw new Error(`Rate limit exceeded after ${maxRetries} retries`);
      }

      // Handle 503 with Retry-After
      if (response.status === 503) {
        const retryAfter = response.headers.get("Retry-After");
        if (retryAfter && attempt < maxRetries) {
          const waitTime = parseInt(retryAfter, 10) * 1000;
          await this.sleep(waitTime);
          attempt++;
          continue;
        }
        throw new Error(`Service unavailable: ${response.status}`);
      }

      if (!response.ok) {
        throw new Error(
          `Procore API error: ${response.status} ${await response.text()}`
        );
      }

      const data = await response.json();

      // Record if in record mode
      if (this.config.recordMode) {
        await this.recordFixture(url, response, data);
      }

      return {
        data: data as T,
        headers: {
          link: response.headers.get("Link"),
          total: response.headers.get("Total"),
          perPage: response.headers.get("Per-Page"),
          rateLimit,
        },
      };
    }

    throw new Error("Unexpected: exceeded retry loop");
  }

  /**
   * Enforce GET-only policy: throws on non-GET verbs.
   */
  async post(): Promise<never> {
    throw new Error("POST not allowed: Procore client is GET-only");
  }

  async put(): Promise<never> {
    throw new Error("PUT not allowed: Procore client is GET-only");
  }

  async patch(): Promise<never> {
    throw new Error("PATCH not allowed: Procore client is GET-only");
  }

  async delete(): Promise<never> {
    throw new Error("DELETE not allowed: Procore client is GET-only");
  }

  /**
   * Extract rate limit info from response headers.
   */
  private extractRateLimit(headers: Headers): RateLimitInfo {
    return {
      limit: this.parseIntHeader(headers.get("X-Rate-Limit-Limit")),
      remaining: this.parseIntHeader(headers.get("X-Rate-Limit-Remaining")),
      reset: this.parseIntHeader(headers.get("X-Rate-Limit-Reset")),
    };
  }

  private parseIntHeader(value: string | null): number | null {
    return value ? parseInt(value, 10) : null;
  }

  /**
   * Parse Link header for pagination.
   * Returns next page number if present.
   */
  parseLinkHeader(linkHeader: string | null): { nextPage: number | null } {
    if (!linkHeader) return { nextPage: null };

    const nextMatch = linkHeader.match(/<[^>]+[?&]page=(\d+)[^>]*>;\s*rel="next"/);
    return {
      nextPage: nextMatch ? parseInt(nextMatch[1], 10) : null,
    };
  }

  /**
   * Paginate through all results of a GET request.
   */
  async *paginate<T>(
    path: string,
    params?: Record<string, string | number | boolean>,
    perPage = 100
  ): AsyncIterable<T[]> {
    let currentPage = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await this.get<T[]>(path, {
        ...params,
        page: currentPage,
        per_page: perPage,
      });

      yield response.data;

      const { nextPage } = this.parseLinkHeader(response.headers.link);
      hasMore = nextPage !== null;
      if (hasMore) {
        currentPage = nextPage!;
      }
    }
  }

  /**
   * Record a fixture for testing.
   */
  private async recordFixture(
    url: URL,
    response: Response,
    body: unknown
  ): Promise<void> {
    const fs = await import("fs/promises");
    const path = await import("path");

    const fixture: FixtureRecord = {
      request: {
        method: "GET",
        path: url.pathname,
        query: Object.fromEntries(url.searchParams),
        headers_redacted: {
          Authorization: "Bearer [REDACTED]",
          "Procore-Company-Id": this.config.companyId,
        },
      },
      response: {
        status: response.status,
        headers: {
          link: response.headers.get("Link") || undefined,
          total: response.headers.get("Total") || undefined,
          "per-page": response.headers.get("Per-Page") || undefined,
          "x-rate-limit-limit": response.headers.get("X-Rate-Limit-Limit") || undefined,
          "x-rate-limit-remaining": response.headers.get("X-Rate-Limit-Remaining") || undefined,
          "x-rate-limit-reset": response.headers.get("X-Rate-Limit-Reset") || undefined,
        },
        body: this.redactPersonalData(body),
      },
      recorded_at: new Date().toISOString(),
      sandbox_company_id: this.config.companyId,
      app_version: "v1.0",
    };

    const fixturePath = path.join(
      this.config.recordPath,
      "sandbox",
      this.getResourceName(url.pathname),
      this.getApiVersion(url.pathname),
      `${this.getScenarioName(url)}_${this.fixtureCounter++}.json`
    );

    await fs.mkdir(path.dirname(fixturePath), { recursive: true });
    await fs.writeFile(fixturePath, JSON.stringify(fixture, null, 2));
  }

  /**
   * Redact personal data from recorded payloads.
   */
  private redactPersonalData(data: unknown): unknown {
    if (typeof data !== "object" || data === null) return data;
    
    const redacted = JSON.parse(JSON.stringify(data));
    
    const redactFields = (obj: Record<string, unknown>) => {
      if (typeof obj !== "object" || obj === null) return;
      
      for (const key in obj) {
        if (key.match(/email/i) && typeof obj[key] === "string") {
          obj[key] = (obj[key] as string).replace(/(.+)@(.+)/, "test$1@example.com");
        }
        if (key.match(/phone/i) && typeof obj[key] === "string") {
          obj[key] = "+1-555-0100";
        }
        if (typeof obj[key] === "object") {
          redactFields(obj[key] as Record<string, unknown>);
        }
      }
    };
    
    redactFields(redacted as Record<string, unknown>);
    return redacted;
  }

  private getResourceName(pathname: string): string {
    const match = pathname.match(/\/rest\/v[\d.]+\/(?:companies\/\d+\/)?(?:projects\/\d+\/)?([^/]+)/);
    return match ? match[1] : "unknown";
  }

  private getApiVersion(pathname: string): string {
    const match = pathname.match(/\/rest\/(v[\d.]+)\//);
    return match ? match[1] : "unknown";
  }

  private getScenarioName(url: URL): string {
    if (url.searchParams.has("filters[updated_at]")) return "incremental";
    if (url.searchParams.has("filters[include_deleted]")) return "deleted_only";
    if (url.searchParams.get("page") === "1") return "list_page1";
    if (url.searchParams.has("page")) return `list_page${url.searchParams.get("page")}`;
    return "list";
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Create a Procore client from environment variables.
 */
export function createProcoreClient(): ProcoreClient {
  return new ProcoreClient({
    clientId: process.env.PROCORE_CLIENT_ID!,
    clientSecret: process.env.PROCORE_CLIENT_SECRET!,
    companyId: process.env.PROCORE_COMPANY_ID!,
    baseUrl: process.env.PROCORE_BASE_URL || "https://api.procore.com",
    authUrl: process.env.PROCORE_AUTH_URL || "https://login.procore.com",
    recordMode: process.env.PROCORE_RECORD_MODE === "true",
  });
}
