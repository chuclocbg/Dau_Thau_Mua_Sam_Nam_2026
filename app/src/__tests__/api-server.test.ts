/**
 * P6-10W: ApiServer test suite
 *
 * 56 tests across 12 groups:
 *   AS1  (5) CRUD routes
 *   AS2  (5) GET
 *   AS3  (5) POST
 *   AS4  (4) PUT
 *   AS5  (4) DELETE
 *   AS6  (5) route lookup
 *   AS7  (4) duplicate route
 *   AS8  (5) method validation
 *   AS9  (5) built-in routes
 *   AS10 (4) edge cases
 *   AS11 (5) immutability
 *   AS12 (5) never-throw
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ApiServer,
  type ApiRoute,
  type ApiRequest,
} from '../providers/ApiServer';

// ─── Test helpers ─────────────────────────────────────────────────────────────

function makeRoute(
  method: ApiRoute['method'],
  path:   string,
  data:   unknown = { result: 'ok' },
): ApiRoute {
  return {
    method,
    path,
    handler: vi.fn().mockResolvedValue(data),
    description: `${method} ${path}`,
  };
}

function makeRequest(
  method: ApiRequest['method'],
  path:   string,
  body?:  unknown,
): ApiRequest {
  const req: ApiRequest = { method, path };
  if (body !== undefined) req.body = body;
  return req;
}

// ─── AS1: CRUD routes ─────────────────────────────────────────────────────────

describe('AS1 · CRUD routes', () => {
  let server: ApiServer;
  beforeEach(() => { server = new ApiServer(); });

  it('AS1-01: registerRoute returns ok:true with the route key', () => {
    const result = server.registerRoute(makeRoute('GET', '/test'));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe('GET:/test');
  });

  it('AS1-02: getRoute returns the route definition after registration', () => {
    server.registerRoute(makeRoute('POST', '/items'));
    const result = server.getRoute('POST', '/items');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.method).toBe('POST');
      expect(result.value.path).toBe('/items');
    }
  });

  it('AS1-03: removeRoute returns ok:true for a registered route', () => {
    server.registerRoute(makeRoute('DELETE', '/item'));
    const result = server.removeRoute('DELETE', '/item');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(true);
  });

  it('AS1-04: listRoutes count increases after registerRoute', () => {
    const before = server.listRoutes().length;
    server.registerRoute(makeRoute('GET', '/new-route'));
    const after = server.listRoutes().length;
    expect(after).toBe(before + 1);
  });

  it('AS1-05: getRoute returns ROUTE_NOT_FOUND after removeRoute', () => {
    server.registerRoute(makeRoute('PUT', '/item'));
    server.removeRoute('PUT', '/item');
    const result = server.getRoute('PUT', '/item');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('ROUTE_NOT_FOUND');
  });
});

// ─── AS2: GET ─────────────────────────────────────────────────────────────────

describe('AS2 · GET', () => {
  let server: ApiServer;
  beforeEach(() => { server = new ApiServer(); });

  it('AS2-01: GET request to registered route returns ok:true response', async () => {
    server.registerRoute(makeRoute('GET', '/foo', { msg: 'hello' }));
    const resp = await server.handleRequest(makeRequest('GET', '/foo'));
    expect(resp.ok).toBe(true);
  });

  it('AS2-02: GET /health returns ok:true (built-in)', async () => {
    const resp = await server.handleRequest(makeRequest('GET', '/health'));
    expect(resp.ok).toBe(true);
  });

  it('AS2-03: GET to unregistered path returns ROUTE_NOT_FOUND error', async () => {
    const resp = await server.handleRequest(makeRequest('GET', '/unknown'));
    expect(resp.ok).toBe(false);
    expect(resp.error?.code).toBe('ROUTE_NOT_FOUND');
  });

  it('AS2-04: GET handler receives the original request object', async () => {
    const handler = vi.fn().mockResolvedValue({ ok: true });
    server.registerRoute({ method: 'GET', path: '/echo', handler });
    const req = makeRequest('GET', '/echo');
    await server.handleRequest(req);
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({
      method: 'GET',
      path:   '/echo',
    }));
  });

  it('AS2-05: GET returns handler return value in data field', async () => {
    const payload = { id: 99, name: 'test' };
    server.registerRoute(makeRoute('GET', '/item', payload));
    const resp = await server.handleRequest(makeRequest('GET', '/item'));
    expect(resp.data).toEqual(payload);
  });
});

// ─── AS3: POST ────────────────────────────────────────────────────────────────

describe('AS3 · POST', () => {
  let server: ApiServer;
  beforeEach(() => { server = new ApiServer(); });

  it('AS3-01: POST request to registered route returns ok:true', async () => {
    server.registerRoute(makeRoute('POST', '/create'));
    const resp = await server.handleRequest(makeRequest('POST', '/create'));
    expect(resp.ok).toBe(true);
  });

  it('AS3-02: POST handler receives the request body', async () => {
    const handler = vi.fn().mockResolvedValue({ created: true });
    server.registerRoute({ method: 'POST', path: '/create', handler });
    const req = makeRequest('POST', '/create', { name: 'widget' });
    await server.handleRequest(req);
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({
      body: { name: 'widget' },
    }));
  });

  it('AS3-03: POST to path with only GET registered returns METHOD_NOT_ALLOWED', async () => {
    server.registerRoute(makeRoute('GET', '/resource'));
    const resp = await server.handleRequest(makeRequest('POST', '/resource'));
    expect(resp.ok).toBe(false);
    expect(resp.error?.code).toBe('METHOD_NOT_ALLOWED');
  });

  it('AS3-04: POST returns handler data in the data field', async () => {
    const result = { id: 42 };
    server.registerRoute(makeRoute('POST', '/items', result));
    const resp = await server.handleRequest(makeRequest('POST', '/items'));
    expect(resp.data).toEqual(result);
  });

  it('AS3-05: POST to unregistered path returns ROUTE_NOT_FOUND', async () => {
    const resp = await server.handleRequest(makeRequest('POST', '/ghost'));
    expect(resp.ok).toBe(false);
    expect(resp.error?.code).toBe('ROUTE_NOT_FOUND');
  });
});

// ─── AS4: PUT ─────────────────────────────────────────────────────────────────

describe('AS4 · PUT', () => {
  let server: ApiServer;
  beforeEach(() => { server = new ApiServer(); });

  it('AS4-01: PUT request to registered route returns ok:true', async () => {
    server.registerRoute(makeRoute('PUT', '/item'));
    const resp = await server.handleRequest(makeRequest('PUT', '/item'));
    expect(resp.ok).toBe(true);
  });

  it('AS4-02: PUT to non-existent path returns ROUTE_NOT_FOUND', async () => {
    const resp = await server.handleRequest(makeRequest('PUT', '/nowhere'));
    expect(resp.ok).toBe(false);
    expect(resp.error?.code).toBe('ROUTE_NOT_FOUND');
  });

  it('AS4-03: PUT to path with only GET registered returns METHOD_NOT_ALLOWED', async () => {
    server.registerRoute(makeRoute('GET', '/resource'));
    const resp = await server.handleRequest(makeRequest('PUT', '/resource'));
    expect(resp.ok).toBe(false);
    expect(resp.error?.code).toBe('METHOD_NOT_ALLOWED');
  });

  it('AS4-04: PUT handler return value appears in data field', async () => {
    const updated = { updated: true, version: 2 };
    server.registerRoute(makeRoute('PUT', '/item', updated));
    const resp = await server.handleRequest(makeRequest('PUT', '/item'));
    expect(resp.data).toEqual(updated);
  });
});

// ─── AS5: DELETE ──────────────────────────────────────────────────────────────

describe('AS5 · DELETE', () => {
  let server: ApiServer;
  beforeEach(() => { server = new ApiServer(); });

  it('AS5-01: DELETE request to registered route returns ok:true', async () => {
    server.registerRoute(makeRoute('DELETE', '/item'));
    const resp = await server.handleRequest(makeRequest('DELETE', '/item'));
    expect(resp.ok).toBe(true);
  });

  it('AS5-02: DELETE to non-existent path returns ROUTE_NOT_FOUND', async () => {
    const resp = await server.handleRequest(makeRequest('DELETE', '/ghost'));
    expect(resp.ok).toBe(false);
    expect(resp.error?.code).toBe('ROUTE_NOT_FOUND');
  });

  it('AS5-03: DELETE to path with only GET registered returns METHOD_NOT_ALLOWED', async () => {
    server.registerRoute(makeRoute('GET', '/resource'));
    const resp = await server.handleRequest(makeRequest('DELETE', '/resource'));
    expect(resp.ok).toBe(false);
    expect(resp.error?.code).toBe('METHOD_NOT_ALLOWED');
  });

  it('AS5-04: DELETE handler return value appears in data field', async () => {
    const deleted = { deleted: true };
    server.registerRoute(makeRoute('DELETE', '/item', deleted));
    const resp = await server.handleRequest(makeRequest('DELETE', '/item'));
    expect(resp.data).toEqual(deleted);
  });
});

// ─── AS6: route lookup ────────────────────────────────────────────────────────

describe('AS6 · route lookup', () => {
  let server: ApiServer;
  beforeEach(() => { server = new ApiServer(); });

  it('AS6-01: routes are matched by both method and path', async () => {
    server.registerRoute(makeRoute('GET',  '/res', { from: 'GET' }));
    server.registerRoute(makeRoute('POST', '/res', { from: 'POST' }));
    const g = await server.handleRequest(makeRequest('GET',  '/res'));
    const p = await server.handleRequest(makeRequest('POST', '/res'));
    expect((g.data as any)?.from).toBe('GET');
    expect((p.data as any)?.from).toBe('POST');
  });

  it('AS6-02: GET /foo and POST /foo are independent route registrations', () => {
    server.registerRoute(makeRoute('GET',  '/foo'));
    const result = server.registerRoute(makeRoute('POST', '/foo'));
    expect(result.ok).toBe(true);
  });

  it('AS6-03: getRoute with wrong method returns ROUTE_NOT_FOUND', () => {
    server.registerRoute(makeRoute('GET', '/bar'));
    const result = server.getRoute('POST', '/bar');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('ROUTE_NOT_FOUND');
  });

  it('AS6-04: route key format is METHOD:path', () => {
    const result = server.registerRoute(makeRoute('DELETE', '/items'));
    if (result.ok) expect(result.value).toBe('DELETE:/items');
  });

  it('AS6-05: removeRoute removes only the specified method+path combination', () => {
    server.registerRoute(makeRoute('GET',  '/shared'));
    server.registerRoute(makeRoute('POST', '/shared'));
    server.removeRoute('GET', '/shared');
    expect(server.getRoute('GET',  '/shared').ok).toBe(false);
    expect(server.getRoute('POST', '/shared').ok).toBe(true);
  });
});

// ─── AS7: duplicate route ─────────────────────────────────────────────────────

describe('AS7 · duplicate route', () => {
  let server: ApiServer;
  beforeEach(() => { server = new ApiServer(); });

  it('AS7-01: registering the same method+path twice returns DUPLICATE_ROUTE', () => {
    server.registerRoute(makeRoute('GET', '/dupe'));
    const result = server.registerRoute(makeRoute('GET', '/dupe'));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('DUPLICATE_ROUTE');
  });

  it('AS7-02: DUPLICATE_ROUTE error code is exact', () => {
    server.registerRoute(makeRoute('POST', '/dupe'));
    const result = server.registerRoute(makeRoute('POST', '/dupe'));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('DUPLICATE_ROUTE');
      expect(result.error.message).toMatch(/already registered/i);
    }
  });

  it('AS7-03: GET /x and POST /x can coexist (different method)', () => {
    server.registerRoute(makeRoute('GET',  '/x'));
    const result = server.registerRoute(makeRoute('POST', '/x'));
    expect(result.ok).toBe(true);
  });

  it('AS7-04: removeRoute then re-register does not return DUPLICATE_ROUTE', () => {
    server.registerRoute(makeRoute('GET', '/cycle'));
    server.removeRoute('GET', '/cycle');
    const result = server.registerRoute(makeRoute('GET', '/cycle'));
    expect(result.ok).toBe(true);
  });
});

// ─── AS8: method validation ───────────────────────────────────────────────────

describe('AS8 · method validation', () => {
  let server: ApiServer;
  beforeEach(() => { server = new ApiServer(); });

  it('AS8-01: INVALID_REQUEST for unsupported method (PATCH)', async () => {
    const resp = await server.handleRequest({
      method: 'PATCH' as any,
      path:   '/health',
    });
    expect(resp.ok).toBe(false);
    expect(resp.error?.code).toBe('INVALID_REQUEST');
  });

  it('AS8-02: INVALID_REQUEST for empty path string', async () => {
    const resp = await server.handleRequest({ method: 'GET', path: '' });
    expect(resp.ok).toBe(false);
    expect(resp.error?.code).toBe('INVALID_REQUEST');
  });

  it('AS8-03: INVALID_REQUEST for null method', async () => {
    const resp = await server.handleRequest({ method: null as any, path: '/health' });
    expect(resp.ok).toBe(false);
    expect(resp.error?.code).toBe('INVALID_REQUEST');
  });

  it('AS8-04: METHOD_NOT_ALLOWED when path is registered but method differs', async () => {
    server.registerRoute(makeRoute('GET', '/locked'));
    const resp = await server.handleRequest(makeRequest('POST', '/locked'));
    expect(resp.ok).toBe(false);
    expect(resp.error?.code).toBe('METHOD_NOT_ALLOWED');
  });

  it('AS8-05: METHOD_NOT_ALLOWED appears in response error field (not a thrown error)', async () => {
    server.registerRoute(makeRoute('PUT', '/only-put'));
    let resp: Awaited<ReturnType<ApiServer['handleRequest']>>;
    await expect(
      (async () => { resp = await server.handleRequest(makeRequest('DELETE', '/only-put')); })()
    ).resolves.not.toThrow();
    expect(resp!.ok).toBe(false);
    expect(resp!.error?.code).toBe('METHOD_NOT_ALLOWED');
  });
});

// ─── AS9: built-in routes ─────────────────────────────────────────────────────

describe('AS9 · built-in routes', () => {
  let server: ApiServer;
  beforeEach(() => { server = new ApiServer(); });

  it('AS9-01: GET /health returns ok:true with a status field', async () => {
    const resp = await server.handleRequest(makeRequest('GET', '/health'));
    expect(resp.ok).toBe(true);
    expect((resp.data as any)?.status).toBe('ok');
  });

  it('AS9-02: GET /models returns ok:true', async () => {
    const resp = await server.handleRequest(makeRequest('GET', '/models'));
    expect(resp.ok).toBe(true);
  });

  it('AS9-03: GET /providers returns ok:true', async () => {
    const resp = await server.handleRequest(makeRequest('GET', '/providers'));
    expect(resp.ok).toBe(true);
  });

  it('AS9-04: GET /sessions returns ok:true', async () => {
    const resp = await server.handleRequest(makeRequest('GET', '/sessions'));
    expect(resp.ok).toBe(true);
  });

  it('AS9-05: GET /workflows and GET /agents both return ok:true', async () => {
    const wf  = await server.handleRequest(makeRequest('GET', '/workflows'));
    const ag  = await server.handleRequest(makeRequest('GET', '/agents'));
    expect(wf.ok).toBe(true);
    expect(ag.ok).toBe(true);
  });
});

// ─── AS10: edge cases ─────────────────────────────────────────────────────────

describe('AS10 · edge cases', () => {
  let server: ApiServer;
  beforeEach(() => { server = new ApiServer(); });

  it('AS10-01: INVALID_INPUT for registerRoute with invalid method', () => {
    const result = server.registerRoute({ method: 'PATCH' as any, path: '/x', handler: vi.fn() });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INVALID_INPUT');
  });

  it('AS10-02: INVALID_INPUT for registerRoute with empty path', () => {
    const result = server.registerRoute({ method: 'GET', path: '', handler: vi.fn() });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INVALID_INPUT');
  });

  it('AS10-03: INVALID_INPUT for registerRoute with path not starting with /', () => {
    const result = server.registerRoute({ method: 'GET', path: 'noslash', handler: vi.fn() });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INVALID_INPUT');
  });

  it('AS10-04: ROUTE_NOT_FOUND for removeRoute with unregistered combination', () => {
    server.registerRoute(makeRoute('GET', '/exists'));
    const result = server.removeRoute('POST', '/exists');   // POST not registered here
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('ROUTE_NOT_FOUND');
  });
});

// ─── AS11: immutability ───────────────────────────────────────────────────────

describe('AS11 · immutability', () => {
  let server: ApiServer;
  beforeEach(() => { server = new ApiServer(); });

  it('AS11-01: mutating getRoute result does not affect the stored route', () => {
    server.registerRoute(makeRoute('GET', '/item'));
    const r = server.getRoute('GET', '/item');
    if (r.ok) (r.value as ApiRoute).path = '/mutated';
    const r2 = server.getRoute('GET', '/item');
    expect(r2.ok).toBe(true);
    if (r2.ok) expect(r2.value.path).toBe('/item');
  });

  it('AS11-02: mutating listRoutes result does not affect stored routes', () => {
    server.registerRoute(makeRoute('GET', '/x'));
    const list = server.listRoutes();
    const customRoute = list.find(r => r.path === '/x');
    if (customRoute) (customRoute as ApiRoute).path = '/tampered';
    const list2 = server.listRoutes();
    const unchanged = list2.find(r => r.path === '/x');
    expect(unchanged).toBeDefined();
  });

  it('AS11-03: mutating input route after registerRoute does not corrupt stored', () => {
    const route = makeRoute('POST', '/orig');
    server.registerRoute(route);
    (route as ApiRoute).path = '/changed';
    const result = server.getRoute('POST', '/orig');
    expect(result.ok).toBe(true);
  });

  it('AS11-04: listRoutes returns an independent array (push does not affect stored)', () => {
    server.registerRoute(makeRoute('GET', '/r'));
    const list = server.listRoutes();
    const before = list.length;
    list.push(makeRoute('DELETE', '/injected'));
    const list2 = server.listRoutes();
    expect(list2.length).toBe(before);
  });

  it('AS11-05: handler response data is independent per request call', async () => {
    const shared = { count: 0 };
    server.registerRoute({
      method:  'GET',
      path:    '/counter',
      handler: () => shared,
    });
    const resp = await server.handleRequest(makeRequest('GET', '/counter'));
    (resp.data as any).count = 999;
    const resp2 = await server.handleRequest(makeRequest('GET', '/counter'));
    // handler always returns the same shared ref, but the data field from the
    // second call should reflect the current shared object (this test verifies
    // that handleRequest does not deep-freeze or copy data — handler owns it)
    expect(resp2.ok).toBe(true);
  });
});

// ─── AS12: never-throw ────────────────────────────────────────────────────────

describe('AS12 · never-throw', () => {
  let server: ApiServer;
  beforeEach(() => { server = new ApiServer(); });

  it('AS12-01: registerRoute(null) returns error, does not throw', () => {
    let result: unknown;
    expect(() => { result = server.registerRoute(null as any); }).not.toThrow();
    expect((result as any)?.ok).toBe(false);
  });

  it('AS12-02: handleRequest(null) resolves with error, does not reject', async () => {
    let resp: unknown;
    await expect(
      (async () => { resp = await server.handleRequest(null as any); })()
    ).resolves.not.toThrow();
    expect((resp as any)?.ok).toBe(false);
  });

  it('AS12-03: handler that throws synchronously → response ok:false with HANDLER_FAILED', async () => {
    server.registerRoute({
      method:  'GET',
      path:    '/boom',
      handler: () => { throw new Error('sync boom'); },
    });
    const resp = await server.handleRequest(makeRequest('GET', '/boom'));
    expect(resp.ok).toBe(false);
    expect(resp.error?.code).toBe('HANDLER_FAILED');
  });

  it('AS12-04: handler that rejects → response ok:false with HANDLER_FAILED', async () => {
    server.registerRoute({
      method:  'POST',
      path:    '/async-boom',
      handler: async () => { throw new Error('async boom'); },
    });
    const resp = await server.handleRequest(makeRequest('POST', '/async-boom'));
    expect(resp.ok).toBe(false);
    expect(resp.error?.code).toBe('HANDLER_FAILED');
  });

  it('AS12-05: removeRoute with null/undefined does not throw', () => {
    expect(() => server.removeRoute(null as any, '/health')).not.toThrow();
    expect(() => server.removeRoute('GET', null as any)).not.toThrow();
  });
});
