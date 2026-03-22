/**
 * src/types/error.ts
 *
 * Typed errors thrown by adapters and caught by services.
 */

export type FetchErrorCode =
  | 'AUTH_ERROR' // 401 — token expired or invalid
  | 'FORBIDDEN' // 403 — account blocked or scraping detected
  | 'NOT_FOUND' // 404 — product reference unknown to this supplier
  | 'RATE_LIMIT' // 429 — too many requests
  | 'TIMEOUT' // request exceeded 10 s
  | 'NETWORK_ERROR' // no response from server
  | 'SEARCH_NOT_POSSIBLE' // no search endpoint and reference is not a direct match (e.g. no exact SKU match)
  | 'PARSE_ERROR'; // response received but JSON shape was unexpected

export class FetchError extends Error {
  readonly code: FetchErrorCode;
  readonly supplierId: string;
  readonly statusCode: number | null;
  readonly retryable: boolean;

  constructor(opts: {
    code: FetchErrorCode;
    supplierId: string;
    message: string;
    statusCode?: number;
    retryable?: boolean;
  }) {
    super(opts.message);
    this.name = 'FetchError';
    this.code = opts.code;
    this.supplierId = opts.supplierId;
    this.statusCode = opts.statusCode ?? null;
    this.retryable = opts.retryable ?? false;
  }
}
