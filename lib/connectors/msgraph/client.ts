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
import { ConnectorError, ERROR_CODES } from "../shared/errors";

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

  constructor(config: Partial<GraphConfig>) {
    this.config = GraphConfigSchema.parse(config);
    this.apiOrigin = new URL(this.config.baseUrl).origin;
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
      signal: AbortSignal.timeout(30000), // 30s timeout
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
   * Validates optional Prefer header (only value allowed: outlook.body-content-type="text").
   */
  private async request(
    url: string,
    method: string,
    token: string,
    preferBodyText?: boolean
  ): Promise<Response> {
    // Enforce GET-only
    if (method !== "GET") {
      throw new ConnectorError(
        `Method ${method} not allowed: client is GET-only`,
        ERROR_CODES.METHOD_NOT_ALLOWED
      );
    }

    // Validate origin
    let urlObj: URL;
    try {
      urlObj = new URL(url);
    } catch (e: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((e as any).code === "ERR_INVALID_URL") {
        throw new ConnectorError("Invalid Graph URL", ERROR_CODES.INVALID_URL);
      }
      throw e;
    }
    if (urlObj.origin !== this.apiOrigin) {
      throw new ConnectorError("Foreign origin not allowed", ERROR_CODES.FOREIGN_ORIGIN);
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
      throw new ConnectorError("Path outside allowed scope", ERROR_CODES.OUT_OF_SCOPE);
    }

    // Build headers: standard headers LAST to prevent override
    const headers: Record<string, string> = {};
    
    if (preferBodyText) {
      headers.Prefer = 'outlook.body-content-type="text"';
    }
    
    // Standard headers last - cannot be overridden
    headers.Authorization = `Bearer ${token}`;
    headers.Accept = "application/json";
    headers["User-Agent"] = "ISV|SiteTech|1.0";

    return retryRequest(
      () =>
        fetch(url, {
          method: "GET",
          headers,
          redirect: "error",
          signal: AbortSignal.timeout(30000), // 30s request timeout
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
    schema?: z.ZodType<GraphResponse<T>>,
    preferBodyText?: boolean
  ): Promise<GraphResponse<T>> {
    const token = await this.getAccessToken();

    let url: URL;
    try {
      url = new URL(
        path.startsWith("http") ? path : `${this.config.baseUrl}${path}`
      );
    } catch (e: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((e as any).code === "ERR_INVALID_URL") {
        throw new ConnectorError("Invalid Graph URL", ERROR_CODES.INVALID_URL);
      }
      throw e;
    }
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
    }

    const response = await this.request(url.toString(), "GET", token, preferBodyText);

    if (!response.ok) {
      const rawErrorCode = response.headers.get("X-Error-Code");
      const errorCode = rawErrorCode && /^[A-Za-z0-9_.-]{1,40}$/.test(rawErrorCode)
        ? rawErrorCode
        : "UNKNOWN";
      throw new ConnectorError(
        `Graph API error: ${response.status} (code: ${errorCode})`,
        ERROR_CODES.API_ERROR,
        response.status
      );
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
    selectFields?: string,
    preferBodyText?: boolean
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

    const response: GraphResponse<T> = await this.get<T>(
      currentUrl,
      undefined,
      undefined,
      preferBodyText
    );

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
