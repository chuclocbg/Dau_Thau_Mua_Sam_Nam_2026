/**
 * P6-12A: RestClient — generic HTTP client (fetch-based, SSR-compatible).
 *
 * Wraps the platform `fetch` function with method helpers, query-parameter
 * serialisation, header merging, request timeout via AbortController, and
 * automatic JSON body / response handling.  All methods return a typed
 * RestClientResult<T> and never throw.
 *
 * Public API:
 *   get(url, options?)          — HTTP GET
 *   post(url, body?, options?)  — HTTP POST
 *   put(url, body?, options?)   — HTTP PUT
 *   delete(url, options?)       — HTTP DELETE
 *
 * Result shape:
 *   ok: true  → { value: RestResponse<T> }     (HTTP 2xx)
 *   ok: false → { error: RestClientError }     (network / timeout / HTTP error)
 *
 * Error codes:
 *   INVALID_URL       — url argument is missing or not a string
 *   NETWORK_ERROR     — fetch rejected (connection refused, DNS, etc.)
 *   TIMEOUT           — AbortController fired before a response arrived
 *   PARSE_ERROR       — response body could not be read
 *   HTTP_ERROR        — server returned a non-2xx HTTP status
 *   REST_CLIENT_ERROR — catch-all for unexpected failures
 *
 * SSR compatibility:
 *   fetch, AbortController, and URLSearchParams are universally available in
 *   Node.js 18 +, modern browsers, and jsdom 29 + (the test runtime).
 *   No window, document, or other browser-exclusive globals are used.
 *   The `fetchFn` constructor option allows full dependency injection in tests.
 */

// ─── Response types ───────────────────────────────────────────────────────────

/** Parsed successful HTTP response returned by every 2xx request. */
export interface RestResponse<T> {
  /** HTTP status code (200–299). */
  readonly status: number;
  /** Response headers — keys are lower-cased, values are strings. */
  readonly headers: Record<string, string>;
  /** Parsed response body.  JSON when Content-Type is application/json, string otherwise. */
  readonly body: T;
}

// ─── Error types ──────────────────────────────────────────────────────────────

export type RestClientErrorCode =
  | 'INVALID_URL'        // url argument missing or not a string
  | 'NETWORK_ERROR'      // fetch() threw a network-level error
  | 'TIMEOUT'            // AbortController fired
  | 'PARSE_ERROR'        // failed to read response body
  | 'HTTP_ERROR'         // non-2xx HTTP status
  | 'REST_CLIENT_ERROR'; // catch-all

export interface RestClientError {
  code:      RestClientErrorCode;
  message:   string;
  /** HTTP status code; present only for HTTP_ERROR. */
  status?:   number;
  /** Parsed response body; present only for HTTP_ERROR when a body was returned. */
  body?:     unknown;
}

export type RestClientResult<T> =
  | { ok: true;  value: RestResponse<T> }
  | { ok: false; error: RestClientError };

// ─── Options ─────────────────────────────────────────────────────────────────

/** Injectable fetch signature — compatible with the global fetch. */
export type RestClientFetch = (url: string, init?: RequestInit) => Promise<Response>;

/** Constructor-level defaults applied to every request. */
export interface RestClientOptions {
  /** Prepended to every relative path. Trailing slashes are normalised. */
  baseUrl?: string;
  /** Headers merged (at lower precedence) with per-request headers. */
  defaultHeaders?: Record<string, string>;
  /** Request timeout in milliseconds (0 = disabled).  Default: 0. */
  timeout?: number;
  /**
   * Custom fetch implementation.  Defaults to the global `fetch`.
   * Inject a mock in unit tests to avoid real network calls.
   */
  fetchFn?: RestClientFetch;
}

/** Per-request options that override or extend the constructor defaults. */
export interface RequestOptions {
  /** Merged with — and override — constructor defaultHeaders. */
  headers?: Record<string, string>;
  /** Key-value pairs appended as a query string.  Values are coerced to strings. */
  query?: Record<string, string | number | boolean>;
  /**
   * Request-level timeout in milliseconds.
   * When > 0, overrides the constructor timeout for this request.
   * When 0, disables timeout for this request even if constructor timeout > 0.
   */
  timeout?: number;
}

// ─── Private helpers ──────────────────────────────────────────────────────────

function restErr(
  code:    RestClientErrorCode,
  message: string,
  extra?:  { status?: number; body?: unknown },
): RestClientResult<never> {
  const error: RestClientError = { code, message, ...extra };
  return { ok: false, error };
}

/**
 * Shallow-clones objects and arrays; returns primitives as-is.
 * Consistent with the rest of the provider layer.
 */
function cloneValue<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return [...value] as unknown as T;
  if (typeof value === 'object') return { ...(value as object) } as unknown as T;
  return value;
}

/**
 * Builds the full request URL by joining baseUrl + path and appending
 * serialised query parameters.
 */
function buildUrl(
  baseUrl: string,
  path:    string,
  query?:  Record<string, string | number | boolean>,
): string {
  const base = baseUrl ? baseUrl.replace(/\/+$/, '') : '';
  const sep  = base && !path.startsWith('/') ? '/' : '';
  let url = base ? `${base}${sep}${path}` : path;

  if (query && Object.keys(query).length > 0) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v !== null && v !== undefined) {
        params.set(k, String(v));
      }
    }
    const qs = params.toString();
    if (qs) url = `${url}?${qs}`;
  }

  return url;
}

/**
 * Reads the response body as text then attempts JSON.parse.
 * Falls back to the raw text string if JSON parsing fails.
 * Returns undefined for empty bodies.
 */
async function parseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.length === 0) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * Collects `Headers` entries into a plain `Record<string, string>`.
 * All keys are lower-cased for consistency.
 */
function collectHeaders(headers: Response['headers']): Record<string, string> {
  const result: Record<string, string> = {};
  headers.forEach((value, key) => {
    result[key.toLowerCase()] = value;
  });
  return result;
}

// ─── RestClient ───────────────────────────────────────────────────────────────

export class RestClient {
  private readonly baseUrl:        string;
  private readonly defaultHeaders: Record<string, string>;
  private readonly timeout:        number;
  private readonly fetchFn:        RestClientFetch;

  constructor(options?: RestClientOptions) {
    this.baseUrl        = (options?.baseUrl ?? '').replace(/\/+$/, '');
    this.defaultHeaders = { ...(options?.defaultHeaders ?? {}) };
    this.timeout        = (typeof options?.timeout === 'number' && options.timeout > 0)
                            ? options.timeout
                            : 0;
    this.fetchFn        = options?.fetchFn
                            ?? ((url: string, init?: RequestInit) => fetch(url, init));
  }

  // ── get ──────────────────────────────────────────────────────────────────────

  /**
   * Performs an HTTP GET request.
   * Returns RestClientResult<T> — never throws.
   */
  async get<T = unknown>(
    url:      string,
    options?: RequestOptions,
  ): Promise<RestClientResult<T>> {
    return this.request<T>('GET', url, undefined, options);
  }

  // ── post ─────────────────────────────────────────────────────────────────────

  /**
   * Performs an HTTP POST request.
   * Object bodies are JSON-serialised; Content-Type is auto-set when absent.
   * Returns RestClientResult<T> — never throws.
   */
  async post<T = unknown>(
    url:      string,
    body?:    unknown,
    options?: RequestOptions,
  ): Promise<RestClientResult<T>> {
    return this.request<T>('POST', url, body, options);
  }

  // ── put ──────────────────────────────────────────────────────────────────────

  /**
   * Performs an HTTP PUT request.
   * Object bodies are JSON-serialised; Content-Type is auto-set when absent.
   * Returns RestClientResult<T> — never throws.
   */
  async put<T = unknown>(
    url:      string,
    body?:    unknown,
    options?: RequestOptions,
  ): Promise<RestClientResult<T>> {
    return this.request<T>('PUT', url, body, options);
  }

  // ── delete ───────────────────────────────────────────────────────────────────

  /**
   * Performs an HTTP DELETE request.
   * Returns RestClientResult<T> — never throws.
   */
  async delete<T = unknown>(
    url:      string,
    options?: RequestOptions,
  ): Promise<RestClientResult<T>> {
    return this.request<T>('DELETE', url, undefined, options);
  }

  // ── request (core) ───────────────────────────────────────────────────────────

  private async request<T>(
    method:   string,
    path:     string,
    body?:    unknown,
    options?: RequestOptions,
  ): Promise<RestClientResult<T>> {
    if (typeof path !== 'string' || path.trim().length === 0) {
      return restErr('INVALID_URL',
        `URL must be a non-empty string; received: ${typeof path}.`);
    }

    try {
      // ── Merge headers ───────────────────────────────────────────────────────
      const mergedHeaders: Record<string, string> = {
        ...this.defaultHeaders,
        ...(options?.headers ?? {}),
      };

      // ── Serialise body ──────────────────────────────────────────────────────
      let serialisedBody: string | undefined;
      if (body !== undefined) {
        if (typeof body === 'object' && body !== null) {
          serialisedBody = JSON.stringify(body);
          const alreadyHasContentType = Object.keys(mergedHeaders)
            .some(k => k.toLowerCase() === 'content-type');
          if (!alreadyHasContentType) {
            mergedHeaders['Content-Type'] = 'application/json';
          }
        } else {
          serialisedBody = String(body);
        }
      }

      // ── Build URL ───────────────────────────────────────────────────────────
      const url = buildUrl(this.baseUrl, path, options?.query);

      // ── Resolve effective timeout ────────────────────────────────────────────
      const effectiveTimeout = (typeof options?.timeout === 'number' && options.timeout >= 0)
        ? options.timeout
        : this.timeout;

      // ── Fetch with optional timeout ──────────────────────────────────────────
      const init: RequestInit = {
        method,
        headers: mergedHeaders,
        ...(serialisedBody !== undefined ? { body: serialisedBody } : {}),
      };

      let response: Response;

      if (effectiveTimeout > 0) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), effectiveTimeout);
        try {
          response = await this.fetchFn(url, { ...init, signal: controller.signal });
        } catch (err) {
          if ((err as { name?: string })?.name === 'AbortError') {
            return restErr('TIMEOUT',
              `Request timed out after ${effectiveTimeout}ms: ${url}.`);
          }
          throw err;
        } finally {
          clearTimeout(timer);
        }
      } else {
        response = await this.fetchFn(url, init);
      }

      // ── Parse response body ──────────────────────────────────────────────────
      let parsedBody: unknown;
      try {
        parsedBody = await parseBody(response);
      } catch (parseErr) {
        return restErr('PARSE_ERROR',
          `Failed to read response body: ${String(parseErr)}.`);
      }

      // ── Collect response headers ─────────────────────────────────────────────
      const responseHeaders = collectHeaders(response.headers);

      // ── Non-2xx → HTTP_ERROR ─────────────────────────────────────────────────
      if (!response.ok) {
        return restErr('HTTP_ERROR',
          `HTTP ${response.status}: ${url}.`,
          { status: response.status, body: parsedBody });
      }

      // ── Success ──────────────────────────────────────────────────────────────
      return {
        ok: true,
        value: {
          status:  response.status,
          headers: { ...responseHeaders },       // defensive copy
          body:    cloneValue(parsedBody) as T,
        },
      };
    } catch (err) {
      if ((err as { name?: string })?.name === 'AbortError') {
        return restErr('TIMEOUT', `Request was aborted: ${path}.`);
      }
      return restErr('NETWORK_ERROR',
        `Network request failed: ${String(err)}.`);
    }
  }
}
