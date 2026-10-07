/**
 * Microsoft Graph GET-only HTTP client for Mail and SharePoint.
 * 
 * Features:
 * - Server-only (import check)
 * - GET-only enforcement at request chokepoint (before token attached)
 * - Scoped to configured mailbox and siteId (no foreign paths)
 * - Shared retry helper with throttling
 * - Delta sync support
 */

import "server-only";
import { z } from "zod";
import { retryRequest } from "../shared/retry";

const GraphConfigSchema = z.object({
  tenantId: z.string().min(1),
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  mailbox: z.string().min(1), // Required scope
  siteId: z.string().min(1),  // Required scope
  scopes: z.array(z.string()).default(["https://graph.microsoft.com/.default"]),
  baseUrl: z.string().url().default("https://graph.microsoft.com/v1.0"),
});

export type GraphConfig = z.infer<typeof GraphConfigSchema>;

const TokenResponseSchema = z.object({
  access_token: z.string(),
  token_type: z.string(),
  expires_in: z.number(),
});

interface CachedToken {
  token: string;
  expiresAt: number;
}

export interface GraphResponse<T> {
  value: T[];
  "@odata.nextLink"?: string;
  "@odata.deltaLink"?: string;
}

export interface DeltaResult<T> {
  items: T[];
  removed: string[];
  checkpoint?: string; // nextLink while paging, deltaLink at the end
}

/**
 * GET-only HTTP client for Microsoft Graph.
 */
export class GraphClient {
  private config: GraphConfig;
  private tokenCache: CachedToken | null = null;
  private apiOrigin: string;
  private authOrigin: string;

  constructor(config: Partial<GraphConfig>) {
    this.config = GraphConfigSchema.parse(config);
    this.apiOrigin = new URL(this.config.baseUrl).origin;
    this.authOrigin = "https://login.microsoftonline.com";
  }

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
      throw new Error(`Graph token fetch failed: ${response.status}`);
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
   * Request chokepoint: validates method, origin, and scope BEFORE attaching token.
   */
  private async request(
    url: string,
    method: string,
    token: string
  ): Promise<Response> {
    // Enforce GET-only
    if (method !== "GET") {
      throw new Error(`Method ${method} not allowed: client is GET-only`);
    }

    // Validate origin
    const urlObj = new URL(url);
    if (urlObj.origin !== this.apiOrigin) {
      throw new Error(
        `Foreign origin not allowed: ${urlObj.origin} (expected ${this.apiOrigin})`
      );
    }

    // Validate scope: must be under /users/{mailbox}/ or /sites/{siteId}/
    // Parse and decode path segments to handle nextLinks with plain commas, @ signs, etc.
    const pathSegments = urlObj.pathname.split("/").map((seg) => decodeURIComponent(seg));

    // Expected patterns:
    // /v1.0/users/{mailbox}/...
    // /v1.0/sites/{siteId}/...
    const isMailboxPath =
      pathSegments.length >= 4 &&
      pathSegments[1] === "v1.0" &&
      pathSegments[2] === "users" &&
      pathSegments[3] === this.config.mailbox;

    const isSitePath =
      pathSegments.length >= 4 &&
      pathSegments[1] === "v1.0" &&
      pathSegments[2] === "sites" &&
      pathSegments[3] === this.config.siteId;

    if (!isMailboxPath && !isSitePath) {
      throw new Error(
        `Path outside allowed scope: ${urlObj.pathname} (must be under /users/${this.config.mailbox}/ or /sites/${this.config.siteId}/)`
      );
    }

    return retryRequest(
      () =>
        fetch(url, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            "User-Agent": "ISV|SiteTech|1.0",
          },
        }),
      {
        maxRetries: 3,
        maxWaitMs: 60000,
        baseDelayMs: 1000,
      },
      "Graph"
    );
  }

  async get<T>(
    path: string,
    params?: Record<string, string>,
    schema?: z.ZodType<GraphResponse<T>>
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

    const response = await this.request(url.toString(), "GET", token);

    if (!response.ok) {
      const errorCode = response.headers.get("X-Error-Code") || "UNKNOWN";
      throw new Error(`Graph API error: ${response.status} (code: ${errorCode})`);
    }

    const json = await response.json();
    
    // Validate with Zod if schema provided
    return schema ? schema.parse(json) : (json as GraphResponse<T>);
  }

  async *paginate<T>(
    path: string,
    params?: Record<string, string>
  ): AsyncIterable<T[]> {
    let nextUrl: string | undefined = path;

    while (nextUrl) {
      const response: GraphResponse<T> = await this.get<T>(
        nextUrl,
        nextUrl === path ? params : undefined
      );
      yield response.value;
      nextUrl = response["@odata.nextLink"];
    }
  }

  /**
   * Delta query support - returns ONE page with checkpoint for resumability.
   * The fetcher drives the loop page-by-page.
   * Handles removals correctly: items with @removed property in value array,
   * and drive items with deleted facet.
   */
  async delta<T extends { id: string }>(
    path: string,
    deltaLink?: string,
    selectFields?: string
  ): Promise<DeltaResult<T>> {
    // Build initial URL: /delta first, then query params
    let currentUrl: string;
    
    if (deltaLink) {
      currentUrl = deltaLink;
    } else {
      const url = new URL(`${this.config.baseUrl}${path}/delta`);
      if (selectFields) {
        url.searchParams.set("$select", selectFields);
      }
      currentUrl = url.toString();
    }

    const response: GraphResponse<T> = await this.get<T>(currentUrl);

    const items: T[] = [];
    const removed: string[] = [];

    // Process items: check for @removed property or deleted facet
    for (const item of response.value) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const itemAny = item as any;
      
      if (itemAny["@removed"]) {
        // Message or other item with @removed annotation
        removed.push(item.id);
      } else if (itemAny.deleted) {
        // DriveItem with deleted facet
        removed.push(item.id);
      } else {
        items.push(item);
      }
    }

    // Return checkpoint: nextLink while paging, deltaLink at the end
    const checkpoint = response["@odata.deltaLink"] || response["@odata.nextLink"];

    return {
      items,
      removed,
      checkpoint,
    };
  }
}

export function createGraphClient(): GraphClient {
  return new GraphClient({
    tenantId: process.env.GRAPH_TENANT_ID!,
    clientId: process.env.GRAPH_CLIENT_ID!,
    clientSecret: process.env.GRAPH_CLIENT_SECRET!,
    mailbox: process.env.GRAPH_MAILBOX!,
    siteId: process.env.GRAPH_SITE_ID!,
  });
}
