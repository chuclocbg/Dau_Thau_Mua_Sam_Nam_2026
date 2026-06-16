/**
 * P6-10W: ApiServer — lightweight in-process HTTP-style router.
 *
 * Public API:
 *   registerRoute()  — store a route definition (CRUD)
 *   removeRoute()    — unregister by method + path (CRUD)
 *   getRoute()       — retrieve a defensive copy (CRUD)
 *   listRoutes()     — list all route definitions in insertion order (CRUD)
 *   handleRequest()  — match incoming request to a route and invoke its handler
 *
 * Supported methods:  GET | POST | PUT | DELETE
 *
 * Built-in routes (pre-registered in the constructor):
 *   GET /health      — liveness probe
 *   GET /models      — list of available models (empty by default)
 *   GET /providers   — list of registered providers (empty by default)
 *   GET /sessions    — list of active sessions (empty by default)
 *   GET /workflows   — list of registered workflows (empty by default)
 *   GET /agents      — list of registered agents (empty by default)
 *
 * Response format (ApiResponse — always returned, never thrown):
 *   { ok: true,  data: unknown }
 *   { ok: false, error: { code: string, message: string } }
 *
 * Error codes:
 *   ROUTE_NOT_FOUND    — path (for any method) is not registered
 *   DUPLICATE_ROUTE    — registerRoute with an already-registered method+path
 *   METHOD_NOT_ALLOWED — path is registered but not for the requested method
 *   INVALID_REQUEST    — malformed ApiRequest (bad method, missing/invalid path)
 *   HANDLER_FAILED     — registered handler threw or rejected
 *   INVALID_INPUT      — malformed route definition (empty path, invalid method)
 *
 * Design rules (consistent with the rest of the provider layer):
 *   - Never throws — CRUD ops return ApiServerResult<T>; handleRequest always
 *     resolves to ApiResponse (even on handler errors).
 *   - Defensive copies: registerRoute clones the definition; getRoute and
 *     listRoutes return independent snapshots.
 *   - listRoutes() never fails.
 *   - Route keys are formatted as "METHOD:path" (e.g. "GET:/health").
 */

// ─── Supported HTTP methods ───────────────────────────────────────────────────

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

const VALID_METHODS: ReadonlySet<string> = new Set<HttpMethod>([
  'GET', 'POST', 'PUT', 'DELETE',
]);

// ─── ApiRoute ─────────────────────────────────────────────────────────────────

export interface ApiRoute {
  /** HTTP method for this route. */
  method:       HttpMethod;
  /** URL path including leading slash (e.g. "/health"). */
  path:         string;
  /** Request handler; may be async. */
  handler:      (req: ApiRequest) => unknown | Promise<unknown>;
  /** Optional human-readable description. */
  description?: string;
}

// ─── ApiRequest ───────────────────────────────────────────────────────────────

export interface ApiRequest {
  /** HTTP method of the incoming request. */
  method:   HttpMethod;
  /** URL path of the incoming request (e.g. "/health"). */
  path:     string;
  /** Optional request body (POST / PUT). */
  body?:    unknown;
  /** Optional HTTP headers. */
  headers?: Record<string, string>;
  /** Optional path parameters (e.g. { id: "42" }). */
  params?:  Record<string, string>;
  /** Optional query-string parameters. */
  query?:   Record<string, string>;
}

// ─── ApiResponse ──────────────────────────────────────────────────────────────

/** Wire-format response returned by handleRequest. */
export interface ApiResponse {
  ok:     boolean;
  data?:  unknown;
  error?: { code: string; message: string };
}

// ─── ApiServerOptions ─────────────────────────────────────────────────────────

/** Per-request options for handleRequest(). */
export interface ApiServerOptions {
  // Reserved for future options.
}

// ─── Error types ──────────────────────────────────────────────────────────────

export type ApiServerErrorCode =
  | 'ROUTE_NOT_FOUND'      // path not registered for any method
  | 'DUPLICATE_ROUTE'      // method+path already registered
  | 'METHOD_NOT_ALLOWED'   // path exists but not for this method
  | 'INVALID_REQUEST'      // malformed ApiRequest
  | 'HANDLER_FAILED'       // handler threw or rejected
  | 'INVALID_INPUT';       // malformed route definition

export interface ApiServerError {
  code:    ApiServerErrorCode;
  message: string;
  cause?:  unknown;
}

/** Discriminated-union result for CRUD operations. */
export type ApiServerResult<T> =
  | { ok: true;  value: T }
  | { ok: false; error: ApiServerError };

// ─── ApiServer ────────────────────────────────────────────────────────────────

export class ApiServer {
  /** Route store keyed by "METHOD:path". */
  private readonly routes: Map<string, ApiRoute> = new Map();

  constructor() {
    this.registerBuiltins();
  }

  // ─── CRUD ───────────────────────────────────────────────────────────────────

  /**
   * Registers a new route.
   *
   * Validates in order:
   *   1. method is one of GET | POST | PUT | DELETE.  → INVALID_INPUT
   *   2. path is a non-empty string starting with '/'. → INVALID_INPUT
   *   3. handler is a function.                        → INVALID_INPUT
   *   4. method+path is not already registered.        → DUPLICATE_ROUTE
   *
   * Returns the route key ("METHOD:path") on success.
   */
  registerRoute(route: ApiRoute): ApiServerResult<string> {
    if (!route?.method || !VALID_METHODS.has(route.method)) {
      return srvErr('INVALID_INPUT',
        `Route method must be one of ${[...VALID_METHODS].join(', ')}.`);
    }
    if (!route.path || typeof route.path !== 'string' || !route.path.startsWith('/')) {
      return srvErr('INVALID_INPUT',
        'Route path must be a non-empty string starting with \'/\'.');
    }
    if (typeof route.handler !== 'function') {
      return srvErr('INVALID_INPUT', 'Route handler must be a function.');
    }

    const key = routeKey(route.method, route.path);
    if (this.routes.has(key)) {
      return srvErr('DUPLICATE_ROUTE',
        `Route '${key}' is already registered.`);
    }

    this.routes.set(key, cloneRoute(route));
    return { ok: true, value: key };
  }

  /**
   * Unregisters a route by method + path.
   *
   * Returns ROUTE_NOT_FOUND if the combination is not registered.
   */
  removeRoute(method: HttpMethod, path: string): ApiServerResult<true> {
    const key = routeKey(method, path);
    if (!this.routes.has(key)) {
      return srvErr('ROUTE_NOT_FOUND',
        `Route '${key}' is not registered.`);
    }
    this.routes.delete(key);
    return { ok: true, value: true };
  }

  /**
   * Returns a defensive copy of the registered route.
   *
   * Returns ROUTE_NOT_FOUND if not registered.
   */
  getRoute(method: HttpMethod, path: string): ApiServerResult<ApiRoute> {
    const route = this.routes.get(routeKey(method, path));
    if (!route) {
      return srvErr('ROUTE_NOT_FOUND',
        `Route '${routeKey(method, path)}' is not registered.`);
    }
    return { ok: true, value: cloneRoute(route) };
  }

  /**
   * Returns defensive copies of all registered routes in insertion order.
   * Never fails.
   */
  listRoutes(): ApiRoute[] {
    return Array.from(this.routes.values()).map(cloneRoute);
  }

  // ─── Request handling ───────────────────────────────────────────────────────

  /**
   * Matches the incoming request to a registered route and invokes its handler.
   *
   * Routing logic:
   *   1. Validate the request (method + path).         → INVALID_REQUEST response
   *   2. Exact match on method+path.                    → call handler
   *   3. Path exists for a different method.            → METHOD_NOT_ALLOWED response
   *   4. Path not registered at all.                    → ROUTE_NOT_FOUND response
   *
   * Handler errors:
   *   If the handler throws or rejects, the response has ok:false and
   *   error.code === 'HANDLER_FAILED'.
   *
   * Always resolves.  Never rejects.
   */
  async handleRequest(
    req:      ApiRequest,
    _options?: ApiServerOptions,
  ): Promise<ApiResponse> {
    try {
      // ── Validate request ──────────────────────────────────────────────────
      if (!req?.method || !VALID_METHODS.has(req.method as string)) {
        return errResponse('INVALID_REQUEST',
          `Request method must be one of ${[...VALID_METHODS].join(', ')}.`);
      }
      if (!req.path || typeof req.path !== 'string' || req.path.trim() === '') {
        return errResponse('INVALID_REQUEST',
          'Request path must be a non-empty string.');
      }

      // ── Exact route match ─────────────────────────────────────────────────
      const key   = routeKey(req.method, req.path);
      const route = this.routes.get(key);

      if (route) {
        try {
          const data = await route.handler(req);
          return { ok: true, data };
        } catch (err) {
          return errResponse('HANDLER_FAILED',
            `Handler for '${key}' threw: ${String(err)}`);
        }
      }

      // ── Method not allowed (path exists for different method) ─────────────
      const pathHasOtherMethod = [...VALID_METHODS].some(
        m => m !== req.method && this.routes.has(routeKey(m as HttpMethod, req.path)),
      );
      if (pathHasOtherMethod) {
        return errResponse('METHOD_NOT_ALLOWED',
          `Method '${req.method}' is not allowed for path '${req.path}'.`);
      }

      // ── Route not found ───────────────────────────────────────────────────
      return errResponse('ROUTE_NOT_FOUND',
        `No route registered for '${key}'.`);

    } catch (err) {
      return errResponse('INVALID_REQUEST',
        `Unexpected error handling request: ${String(err)}`);
    }
  }

  // ─── Built-in routes ────────────────────────────────────────────────────────

  private registerBuiltins(): void {
    const builtins: Array<Pick<ApiRoute, 'path' | 'handler' | 'description'>> = [
      {
        path:        '/health',
        description: 'Liveness probe',
        handler:     () => ({ status: 'ok', timestamp: Date.now() }),
      },
      {
        path:        '/models',
        description: 'List available models',
        handler:     () => ({ models: [] }),
      },
      {
        path:        '/providers',
        description: 'List registered providers',
        handler:     () => ({ providers: [] }),
      },
      {
        path:        '/sessions',
        description: 'List active sessions',
        handler:     () => ({ sessions: [] }),
      },
      {
        path:        '/workflows',
        description: 'List registered workflows',
        handler:     () => ({ workflows: [] }),
      },
      {
        path:        '/agents',
        description: 'List registered agents',
        handler:     () => ({ agents: [] }),
      },
    ];

    for (const b of builtins) {
      const route: ApiRoute = { method: 'GET', ...b };
      this.routes.set(routeKey('GET', b.path), route);
    }
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function routeKey(method: HttpMethod | string, path: string): string {
  return `${method}:${path}`;
}

/**
 * Defensive clone of an ApiRoute.
 * The handler function reference is shared (functions are immutable by nature).
 */
function cloneRoute(route: ApiRoute): ApiRoute {
  const copy: ApiRoute = {
    method:  route.method,
    path:    route.path,
    handler: route.handler,
  };
  if (route.description !== undefined) copy.description = route.description;
  return copy;
}

function srvErr<T>(
  code:    ApiServerErrorCode,
  message: string,
  cause?:  unknown,
): ApiServerResult<T> {
  const error: ApiServerError = { code, message };
  if (cause !== undefined) error.cause = cause;
  return { ok: false, error };
}

function errResponse(code: ApiServerErrorCode, message: string): ApiResponse {
  return { ok: false, error: { code, message } };
}
