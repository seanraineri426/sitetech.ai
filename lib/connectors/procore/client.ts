/**
 * Procore GET-only HTTP client with OAuth client credentials (DMSA).
 * 
 * Features:
 * - Server-only (import check)
 * - GET-only enforcement at request chokepoint (before token attached)
 * - Origin validation (no foreign-origin requests)
 * - Shared retry helper with rate limit logging
 * - In-memory token caching
 * - Pagination via Link headers
 * - Zod validation of responses
 */

import "server-only";
import { z } from "zod";
import { retryRequest } from "../shared/retry";

const ProcoreConfigSchema = z.object({
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  baseUrl: z.string().url().default("https://api.procore.com"),
  authUrl: z.string().url().default("https://login.procore.com"),
  companyId: z.string().min(1),
});

export type ProcoreConfig = z.infer<typeof ProcoreConfigSchema>;

const TokenResponseSchema = z.object({
  access_token: z.string(),
  token_type: z.string(),
  expires_in: z.number(),
  created_at: z.number(),
});

interface CachedToken {
  token: string;
  expiresAt: number;
}

export interface ProcoreResponse<T> {
  data: T;
  headers: {
    link: string | null;
    total: string | null;
    perPage: string | null;
  };
}

/**
 * GET-only HTTP client for Procore REST API.
 */
export class ProcoreClient {
  private config: ProcoreConfig;
  private tokenCache: CachedToken | null = null;
  private apiOrigin: string;
  private authOrigin: string;

  constructor(config: Partial<ProcoreConfig>) {
    this.config = ProcoreConfigSchema.parse(config);
    this.apiOrigin = new URL(this.config.baseUrl).origin;
    this.authOrigin = new URL(this.config.authUrl).origin;
  }

  /**
   * Fetch an access token via OAuth client credentials.
   * Caches in memory until 5 minutes before expiry.
   */
  private async getAccessToken(): Promise<string> {
    if (
      this.tokenCache &&
      this.tokenCache.expiresAt > Date.now() + 5 * 60 * 1000
    ) {
      return this.tokenCache.token;
    }

    const tokenUrl = `${this.config.authUrl}/oauth/token`;
    
    // Token endpoint is pinned to exact configured auth URL
    if (new URL(tokenUrl).origin !== this.authOrigin) {
      throw new Error("Token URL origin mismatch");
    }

    const response = await fetch(tokenUrl, {
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
      throw new Error(`Procore token fetch failed: ${response.status}`);
    }

    const json = await response.json();
    const data = TokenResponseSchema.parse(json);

    this.tokenCache = {
      token: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };

    return this.tokenCache.token;
  }

  /**
   * Request chokepoint: validates method and origin BEFORE attaching token.
   * 
   * @throws Error if method is not GET
   * @throws Error if URL origin doesn't match configured API origin
   */
  private async request(
    url: string,
    method: string,
    token: string
  ): Promise<Response> {
    // Enforce GET-only BEFORE attaching Bearer token
    if (method !== "GET") {
      throw new Error(`Method ${method} not allowed: client is GET-only`);
    }

    // Validate origin BEFORE attaching Bearer token
    const urlOrigin = new URL(url).origin;
    if (urlOrigin !== this.apiOrigin) {
      throw new Error(
        `Foreign origin not allowed: ${urlOrigin} (expected ${this.apiOrigin})`
      );
    }

    // Now safe to make the request with token
    return retryRequest(
      () =>
        fetch(url, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Procore-Company-Id": this.config.companyId,
            Accept: "application/json",
          },
        }),
      {
        maxRetries: 3,
        maxWaitMs: 60000, // 60 seconds max wait
        baseDelayMs: 1000,
      },
      "Procore"
    );
  }

  /**
   * GET request with retry and rate limit handling.
   * 
   * @throws Error if response is not ok
   */
  async get<T>(
    path: string,
    params?: Record<string, string | number | boolean>
  ): Promise<ProcoreResponse<T>> {
    const token = await this.getAccessToken();

    // Build URL (supports absolute paths and relative paths)
    const url = new URL(path, this.config.baseUrl);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, String(value));
      });
    }

    const response = await this.request(url.toString(), "GET", token);

    if (!response.ok) {
      // Don't include raw response body in error
      const errorCode = response.headers.get("X-Error-Code") || "UNKNOWN";
      throw new Error(
        `Procore API error: ${response.status} (code: ${errorCode})`
      );
    }

    const data = await response.json();

    return {
      data: data as T,
      headers: {
        link: response.headers.get("Link"),
        total: response.headers.get("Total"),
        perPage: response.headers.get("Per-Page"),
      },
    };
  }

  /**
   * Parse Link header for pagination.
   */
  parseLinkHeader(linkHeader: string | null): { nextPage: number | null } {
    if (!linkHeader) return { nextPage: null };

    const nextMatch = linkHeader.match(
      /<[^>]+[?&]page=(\d+)[^>]*>;\s*rel="next"/
    );
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
}

/**
 * Create a Procore client from environment variables.
 */
export function createProcoreClient(): ProcoreClient {
  return new ProcoreClient({
    clientId: process.env.PROCORE_CLIENT_ID!,
    clientSecret: process.env.PROCORE_CLIENT_SECRET!,
    companyId: process.env.PROCORE_COMPANY_ID!,
    baseUrl: process.env.PROCORE_BASE_URL,
    authUrl: process.env.PROCORE_AUTH_URL,
  });
}
