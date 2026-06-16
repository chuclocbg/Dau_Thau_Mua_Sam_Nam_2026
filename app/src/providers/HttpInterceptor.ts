/**
 * P6-12C: HttpInterceptor — composable request/response interceptor pipeline.
 *
 * Manages an ordered list of interceptors that transform HttpRequest objects
 * before a handler is called and HttpInterceptorResult objects after it
 * returns.  Any number of interceptors may be registered; each may provide a
 * request hook, a response hook, or both.
 *
 * Public API:
 *   addInterceptor(entry)     — register an interceptor; returns a stable ID
 *   removeInterceptor(id)     — unregister by ID; returns true if found
 *   clear()                   — remove all interceptors
 *   execute(request, handler) — run the full pipeline; return typed result
 *
 * Execution order:
 *   1. Request interceptors  in registration order (first-in → first-run)
 *   2. handler(transformedRequest)
 *   3. Response interceptors in registration order (first-in → first-run)
 *
 * Error codes:
 *   REQUEST_INTERCEPTOR_ERROR  — a request interceptor threw
 *   RESPONSE_INTERCEPTOR_ERROR — a response interceptor threw
 *   HANDLER_ERROR              — the handler threw, or is not callable
 *   HTTP_INTERCEPTOR_ERROR     — catch-all / malformed intermediate value
 *
 * Design rules (consistent with the provider layer):
 *   - Never throws — all errors surface as { ok: false, error }.
 *   - execute() returns Promise<HttpInterceptorResult<T>>.
 *   - addInterceptor / removeInterceptor / clear are synchronous; never fail.
 *   - SSR-compatible: no browser-exclusive globals, no hooks, no DOM.
 *   - Defensive copies everywhere: each interceptor receives and produces
 *     isolated copies; callers cannot corrupt the pipeline through references.
 */

// ─── Core context types ───────────────────────────────────────────────────────

/**
 * Request context passed through the request-interceptor chain and ultimately
 * delivered to the handler.  Fields are readonly; interceptors must return a
 * new object to make changes (returning the same reference is also safe — the
 * pipeline clones at every handoff).
 */
export interface HttpRequest {
  readonly url:      string;
  readonly method:   string;
  readonly headers:  Record<string, string>;
  readonly body?:    unknown;
  /** Arbitrary per-request metadata for passing data between interceptors. */
  readonly meta:     Record<string, unknown>;
}

/**
 * Successful response context passed through the response-interceptor chain.
 * Produced by the handler and optionally transformed by response interceptors.
 */
export interface HttpResponse<T = unknown> {
  readonly status:   number;
  readonly headers:  Record<string, string>;
  readonly body:     T;
  /** Arbitrary per-response metadata (e.g. latency, trace IDs). */
  readonly meta:     Record<string, unknown>;
}

// ─── Error types ──────────────────────────────────────────────────────────────

export type HttpInterceptorErrorCode =
  | 'REQUEST_INTERCEPTOR_ERROR'   // a request interceptor threw
  | 'RESPONSE_INTERCEPTOR_ERROR'  // a response interceptor threw
  | 'HANDLER_ERROR'               // handler threw or is not callable
  | 'HTTP_INTERCEPTOR_ERROR';     // catch-all / malformed value

export interface HttpInterceptorError {
  code:    HttpInterceptorErrorCode;
  message: string;
}

export type HttpInterceptorResult<T = unknown> =
  | { ok: true;  value: HttpResponse<T> }
  | { ok: false; error: HttpInterceptorError };

// ─── Interceptor function types ───────────────────────────────────────────────

/**
 * Transforms an HttpRequest before it reaches the handler.
 * Must return the (possibly modified) request synchronously or as a Promise.
 * Throwing causes the pipeline to abort with REQUEST_INTERCEPTOR_ERROR.
 */
export type RequestInterceptorFn = (
  req: HttpRequest,
) => HttpRequest | Promise<HttpRequest>;

/**
 * Transforms an HttpInterceptorResult after the handler returns.
 * Receives the result of the handler (or a previous response interceptor) and
 * may return any HttpInterceptorResult — including converting { ok: false }
 * to { ok: true } or vice versa.
 * Throwing causes the pipeline to abort with RESPONSE_INTERCEPTOR_ERROR.
 */
export type ResponseInterceptorFn = (
  res: HttpInterceptorResult<unknown>,
) => HttpInterceptorResult<unknown> | Promise<HttpInterceptorResult<unknown>>;

/**
 * An interceptor definition.  Either or both functions may be provided.
 * An entry with neither is registered as a no-op (safe but wasteful).
 */
export interface HttpInterceptorEntry {
  request?:  RequestInterceptorFn;
  response?: ResponseInterceptorFn;
}

/**
 * The handler function: receives the fully-transformed request and returns a
 * Promise<HttpInterceptorResult<T>>.  If it throws, the pipeline wraps the
 * error in HANDLER_ERROR and still runs response interceptors.
 */
export type HttpHandler<T = unknown> = (
  req: HttpRequest,
) => Promise<HttpInterceptorResult<T>>;

// ─── Private types ────────────────────────────────────────────────────────────

interface StoredEntry {
  id:    string;
  entry: HttpInterceptorEntry;
}

// ─── Private helpers ──────────────────────────────────────────────────────────

function cloneValue<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return [...value] as unknown as T;
  if (typeof value === 'object') return { ...(value as object) } as unknown as T;
  return value;
}

/**
 * Returns a fresh, isolated copy of an HttpRequest.
 * If the argument is null / undefined or not an object, a safe default is
 * returned so the pipeline never crashes due to malformed input.
 */
function cloneRequest(req: HttpRequest): HttpRequest {
  if (req == null || typeof req !== 'object') {
    return { url: '', method: 'GET', headers: {}, meta: {} };
  }
  return {
    url:     typeof req.url    === 'string' ? req.url    : '',
    method:  typeof req.method === 'string' ? req.method : 'GET',
    headers: { ...(req.headers ?? {}) },
    body:    cloneValue(req.body),
    meta:    { ...(req.meta    ?? {}) },
  };
}

/**
 * Returns a fresh, isolated copy of an HttpInterceptorResult.
 * If the argument is not a recognised result shape, returns HTTP_INTERCEPTOR_ERROR.
 */
function cloneResult<T>(result: HttpInterceptorResult<T>): HttpInterceptorResult<T> {
  if (result == null || typeof result !== 'object') {
    return {
      ok: false,
      error: {
        code:    'HTTP_INTERCEPTOR_ERROR',
        message: 'Interceptor returned a non-result value.',
      },
    };
  }
  if (!(result as { ok?: unknown }).ok) {
    const err = (result as { ok: false; error?: Partial<HttpInterceptorError> }).error;
    return {
      ok: false,
      error: {
        code:    err?.code    ?? 'HTTP_INTERCEPTOR_ERROR',
        message: err?.message ?? 'Unknown interceptor error.',
      },
    };
  }
  const res = (result as { ok: true; value: HttpResponse<T> }).value;
  return {
    ok: true,
    value: {
      status:  typeof res?.status === 'number' ? res.status : 0,
      headers: { ...(res?.headers ?? {}) },
      body:    cloneValue(res?.body) as T,
      meta:    { ...(res?.meta    ?? {}) },
    },
  };
}

// ─── HttpInterceptor ──────────────────────────────────────────────────────────

export class HttpInterceptor {
  private readonly stored: StoredEntry[] = [];
  private nextId = 1;

  // ── addInterceptor ────────────────────────────────────────────────────────

  /**
   * Registers a new interceptor entry.  Both `request` and `response` are
   * optional; an entry providing neither is accepted as a no-op.
   * Returns a stable string ID that can be passed to removeInterceptor().
   * Never throws.
   */
  addInterceptor(entry: HttpInterceptorEntry): string {
    const id = `hi_${this.nextId++}`;
    const src = (entry != null && typeof entry === 'object')
      ? (entry as HttpInterceptorEntry)
      : ({} as HttpInterceptorEntry);

    const safe: HttpInterceptorEntry = {};
    if (typeof src.request  === 'function') safe.request  = src.request;
    if (typeof src.response === 'function') safe.response = src.response;

    this.stored.push({ id, entry: safe });
    return id;
  }

  // ── removeInterceptor ─────────────────────────────────────────────────────

  /**
   * Removes the interceptor with the given ID.
   * Returns true if found and removed; false if the ID was unknown.
   * Never throws.
   */
  removeInterceptor(id: string): boolean {
    if (typeof id !== 'string') return false;
    const idx = this.stored.findIndex(e => e.id === id);
    if (idx === -1) return false;
    this.stored.splice(idx, 1);
    return true;
  }

  // ── clear ─────────────────────────────────────────────────────────────────

  /**
   * Removes all registered interceptors.
   * Does not reset the internal ID counter, so IDs remain unique across the
   * lifetime of the instance.
   * Never throws.
   */
  clear(): void {
    this.stored.length = 0;
  }

  // ── execute ───────────────────────────────────────────────────────────────

  /**
   * Runs the full interceptor pipeline:
   *
   *   1. Clone the incoming request (defensive copy of caller's object).
   *   2. Pass a clone through each request interceptor in registration order.
   *      → If any throws: return REQUEST_INTERCEPTOR_ERROR; handler is NOT called.
   *   3. Call handler(transformedRequest).
   *      → If handler throws: record HANDLER_ERROR; response interceptors still run.
   *   4. Pass a clone of the current result through each response interceptor
   *      in registration order.
   *      → If any throws: return RESPONSE_INTERCEPTOR_ERROR immediately.
   *   5. Return a defensive clone of the final result.
   *
   * Never throws.
   */
  async execute<T>(
    request: HttpRequest,
    handler: HttpHandler<T>,
  ): Promise<HttpInterceptorResult<T>> {
    // Validate handler before touching anything else.
    if (typeof handler !== 'function') {
      return {
        ok: false,
        error: {
          code:    'HANDLER_ERROR',
          message: `execute() requires a callable handler; received: ${typeof handler}.`,
        },
      };
    }

    // Clone the caller's request so subsequent mutations cannot affect the pipeline.
    let req = cloneRequest(request);

    // ── 1. Request interceptors ─────────────────────────────────────────────
    for (const { entry } of this.stored) {
      if (typeof entry.request !== 'function') continue;
      try {
        const next = await entry.request(cloneRequest(req));
        // If the interceptor returned a valid object, clone it as the new req.
        if (next != null && typeof next === 'object') {
          req = cloneRequest(next as HttpRequest);
        }
      } catch (err) {
        return {
          ok: false,
          error: {
            code:    'REQUEST_INTERCEPTOR_ERROR',
            message: `Request interceptor threw: ${String(err)}.`,
          },
        };
      }
    }

    // ── 2. Handler ──────────────────────────────────────────────────────────
    let result: HttpInterceptorResult<unknown>;
    try {
      result = (await handler(cloneRequest(req))) as HttpInterceptorResult<unknown>;
    } catch (err) {
      // Handler threw — wrap and continue to response interceptors.
      result = {
        ok: false,
        error: {
          code:    'HANDLER_ERROR',
          message: `Handler threw: ${String(err)}.`,
        },
      };
    }

    // ── 3. Response interceptors ────────────────────────────────────────────
    for (const { entry } of this.stored) {
      if (typeof entry.response !== 'function') continue;
      try {
        const next = await entry.response(cloneResult(result));
        // Accept the interceptor's return only if it looks like a result object.
        if (next != null && typeof next === 'object' && 'ok' in next) {
          result = next as HttpInterceptorResult<unknown>;
        }
      } catch (err) {
        return {
          ok: false,
          error: {
            code:    'RESPONSE_INTERCEPTOR_ERROR',
            message: `Response interceptor threw: ${String(err)}.`,
          },
        };
      }
    }

    return cloneResult(result) as HttpInterceptorResult<T>;
  }
}
