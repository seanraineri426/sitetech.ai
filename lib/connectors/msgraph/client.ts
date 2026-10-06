/**
 * Microsoft Graph GET-only HTTP client for Mail and SharePoint.
 * 
 * Features:
 * - App-only client credentials (multi-tenant support)
 * - GET-only enforcement
 * - Throttling handling (429, 503 with Retry-After)
 * - Delta sync support (deltaLink storage)
 * - Mail folder delta (Inbox, Sent Items)
 * - SharePoint drive delta (Sites.Selected)
 */

import { z } from "zod";

const GraphConfigSchema = z.object({
  tenantId: z.string().min(1),
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  scopes: z.array(z.string()).default(["https://graph.microsoft.com/.default"]),
  baseUrl: z.string().url().default("https://graph.microsoft.com/v1.0"),
});

export type GraphConfig = z.infer<typeof GraphConfigSchema>;

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface CachedToken {
  token: string;
  expiresAt: number;
}

export interface GraphResponse<T> {
  value: T[];
  "@odata.nextLink"?: string;
  "@odata.deltaLink"?: string;
}

export interface DeltaResponse<T> extends GraphResponse<T> {
  "@odata.deltaLink"?: string;
  "@removed"?: Array<{ id: string; reason: string }>;
}

/**
 * GET-only HTTP client for Microsoft Graph.
 * Throws on non-GET verbs to enforce read-only policy.
 */
export class GraphClient {
  private config: GraphConfig;
  private tokenCache: CachedToken | null = null;

  constructor(config: Partial<GraphConfig>) {
    this.config = GraphConfigSchema.parse(config);
  }

  /**
   * Fetch access token via OAuth client credentials.
   * Caches in memory until 5 minutes before expiry.
   */
  private async getAccessToken(): Promise<string> {
    if (
      this.tokenCache &&
      this.tokenCache.expiresAt > Date.now() + 5 * 60 * 1000
    ) {
      return this.tokenCache.token;
    }

    const tokenUrl = `https://login.microsoftonline.com/${this.config.tenantId}/oauth2/v2.0/token`;

    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        scope: this.config.scopes.join(" "),
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Graph token fetch failed: ${response.status} ${await response.text()}`
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
   * GET request with throttling handling.
   * Honors 429 and 503 with Retry-After.
   */
  async get<T>(
    path: string,
    params?: Record<string, string>
  ): Promise<GraphResponse<T>> {
    const token = await this.getAccessToken();

    const url = new URL(
      path.startsWith("http") ? path : `${this.config.baseUrl}${path}`
    );
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
    }

    let attempt = 0;
    const maxRetries = 3;

    while (attempt <= maxRetries) {
      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "User-Agent": "ISV|SiteTech|1.0",
        },
      });

      // Handle throttling (429 or 503)
      if (response.status === 429 || response.status === 503) {
        const retryAfter = response.headers.get("Retry-After");
        if (retryAfter && attempt < maxRetries) {
          const waitTime = parseInt(retryAfter, 10) * 1000;
          await this.sleep(waitTime);
          attempt++;
          continue;
        }
        throw new Error(`Throttled after ${maxRetries} retries: ${response.status}`);
      }

      if (!response.ok) {
        throw new Error(
          `Graph API error: ${response.status} ${await response.text()}`
        );
      }

      return (await response.json()) as GraphResponse<T>;
    }

    throw new Error("Unexpected: exceeded retry loop");
  }

  /**
   * Paginate through all results using @odata.nextLink.
   */
  async *paginate<T>(
    path: string,
    params?: Record<string, string>
  ): AsyncIterable<T[]> {
    let nextUrl: string | undefined = path;

    while (nextUrl) {
      const response: GraphResponse<T> = await this.get<T>(nextUrl, nextUrl === path ? params : undefined);
      yield response.value;
      nextUrl = response["@odata.nextLink"];
    }
  }

  /**
   * Delta query support.
   * Returns items and a deltaLink for the next sync.
   */
  async delta<T>(
    path: string,
    deltaLink?: string
  ): Promise<{ items: T[]; deltaLink: string; removed: string[] }> {
    const items: T[] = [];
    const removed: string[] = [];
    let currentUrl = deltaLink || `${this.config.baseUrl}${path}/delta`;
    let finalDeltaLink = "";

    while (currentUrl) {
      const response: GraphResponse<T> = await this.get<T>(currentUrl);
      
      items.push(...response.value);

      // Track removed items (marked with @removed annotation)
      const deltaResponse = response as DeltaResponse<T>;
      if (deltaResponse["@removed"]) {
        removed.push(...deltaResponse["@removed"].map((r) => r.id));
      }

      if (deltaResponse["@odata.deltaLink"]) {
        finalDeltaLink = deltaResponse["@odata.deltaLink"];
        break;
      }

      currentUrl = response["@odata.nextLink"] || "";
    }

    return { items, deltaLink: finalDeltaLink, removed };
  }

  /**
   * Enforce GET-only policy: throws on write verbs.
   */
  async post(): Promise<never> {
    throw new Error("POST not allowed: Graph client is GET-only");
  }

  async put(): Promise<never> {
    throw new Error("PUT not allowed: Graph client is GET-only");
  }

  async patch(): Promise<never> {
    throw new Error("PATCH not allowed: Graph client is GET-only");
  }

  async delete(): Promise<never> {
    throw new Error("DELETE not allowed: Graph client is GET-only");
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Create a Graph client from environment variables.
 */
export function createGraphClient(): GraphClient {
  return new GraphClient({
    tenantId: process.env.GRAPH_TENANT_ID!,
    clientId: process.env.GRAPH_CLIENT_ID!,
    clientSecret: process.env.GRAPH_CLIENT_SECRET!,
  });
}
