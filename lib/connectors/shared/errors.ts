/**
 * Base error class for connector errors with stable error codes.
 */
export class ConnectorError extends Error {
  public readonly code: string;
  public readonly status?: number;

  constructor(message: string, code: string, status?: number) {
    super(message);
    this.name = "ConnectorError";
    this.code = code;
    this.status = status;
  }
}

/**
 * Error codes used across connectors.
 */
export const ERROR_CODES = {
  // URL validation
  INVALID_URL: "INVALID_URL",
  FOREIGN_ORIGIN: "FOREIGN_ORIGIN",
  OUT_OF_SCOPE: "OUT_OF_SCOPE",
  
  // Method validation
  METHOD_NOT_ALLOWED: "METHOD_NOT_ALLOWED",
  
  // API errors
  API_ERROR: "API_ERROR",
  
  // Rate limiting
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
  
  // Retry exhaustion
  RETRIES_EXHAUSTED: "RETRIES_EXHAUSTED",
  
  // Config validation
  BASEURL_NOT_ALLOWED: "BASEURL_NOT_ALLOWED",
  AUTHURL_NOT_ALLOWED: "AUTHURL_NOT_ALLOWED",
} as const;
