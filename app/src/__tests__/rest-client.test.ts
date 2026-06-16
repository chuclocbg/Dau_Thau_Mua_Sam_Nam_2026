/**
 * P6-12A: RestClient — test suite (56 tests, RC1–RC12).
 *
 * All tests inject a mock `fetchFn` so no real network calls are made.
 * The mock returns plain objects shaped like the `Response` interface
 * (ok, status, headers.forEach/get, text()) — no need for a global Response
 * constructor.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RestClient } from '../providers/RestClient';
import type { RestClientFetch } from '../providers/RestClient';

// ─── Test helpers ─────────────────────────────────────────────────────────────

/**
 * Builds a minimal mock Response-shaped object.
 * The RestClient only uses: ok, status, headers.{forEach,get}, and text().
 */
function mockResponse(
  status:  number,
  body:    unknown,
  headers: Record<string, string> = {},
) {
  const bodyText  = typeof body === 'string' ? body : JSON.stringify(body);
  const hdrs      = new Map(
    Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]),
  );
  return {
    ok:      status >= 200 && status < 300,
    status,
    headers: {
      get:     (name: string) => hdrs.get(name.toLowerCase()) ?? null,
      forEach: (cb: (value: string, key: string) => void) => {
        hdrs.forEach((v, k) => cb(v, k));
      },
    },
    text: () => Promise.resolve(bodyText),
  } as unknown as Response;
}

/** Creates a vi.fn() that resolves with the given mock response. */
function makeFetch(
  status:  number,
  body:    unknown       = {},
  headers: Record<string, string> = {},
): ReturnType<typeof vi.fn> {
  return vi.fn().mockResolvedValue(mockResponse(status, body, headers));
}

/** Creates a vi.fn() that rejects with a network-style error. */
function makeNetworkErrorFetch(message = 'Failed to fetch'): ReturnType<typeof vi.fn> {
  return vi.fn().mockRejectedValue(new Error(message));
}

/** Creates a vi.fn() that rejects with an AbortError (simulates timeout). */
function makeAbortFetch(): ReturnType<typeof vi.fn> {
  return vi.fn().mockRejectedValue(
    Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }),
  );
}

// ─── RC1: Constructor (4 tests) ───────────────────────────────────────────────

describe('RC1: constructor', () => {
  it('RC1-01: new RestClient() does not throw', () => {
    expect(() => new RestClient()).not.toThrow();
  });

  it('RC1-02: new RestClient({ baseUrl }) does not throw', () => {
    expect(() => new RestClient({ baseUrl: 'https://api.example.com' })).not.toThrow();
  });

  it('RC1-03: new RestClient({ defaultHeaders, timeout }) does not throw', () => {
    expect(() => new RestClient({
      defaultHeaders: { Authorization: 'Bearer token' },
      timeout: 5000,
    })).not.toThrow();
  });

  it('RC1-04: fetchFn option is accepted without throwing', () => {
    const fn = makeFetch(200, {}) as unknown as RestClientFetch;
    expect(() => new RestClient({ fetchFn: fn })).not.toThrow();
  });
});

// ─── RC2: get() (5 tests) ────────────────────────────────────────────────────

describe('RC2: get()', () => {
  let fetchFn: ReturnType<typeof vi.fn>;
  let client: RestClient;

  beforeEach(() => {
    fetchFn = makeFetch(200, { id: 1 });
    client  = new RestClient({ fetchFn: fetchFn as unknown as RestClientFetch });
  });

  it('RC2-01: get() returns ok:true for a 200 response', async () => {
    const result = await client.get('/users');
    expect(result.ok).toBe(true);
  });

  it('RC2-02: get() returns the correct HTTP status', async () => {
    const result = await client.get('/users');
    expect(result.ok && result.value.status).toBe(200);
  });

  it('RC2-03: get() returns the parsed JSON body', async () => {
    const result = await client.get<{ id: number }>('/users');
    expect(result.ok && result.value.body.id).toBe(1);
  });

  it('RC2-04: get() sends the GET HTTP method', async () => {
    await client.get('/users');
    const init = fetchFn.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('GET');
  });

  it('RC2-05: get() with baseUrl builds full URL', async () => {
    const c = new RestClient({
      baseUrl: 'https://api.example.com',
      fetchFn: fetchFn as unknown as RestClientFetch,
    });
    await c.get('/users');
    const url = fetchFn.mock.calls[0][0] as string;
    expect(url).toBe('https://api.example.com/users');
  });
});

// ─── RC3: post() (5 tests) ───────────────────────────────────────────────────

describe('RC3: post()', () => {
  let fetchFn: ReturnType<typeof vi.fn>;
  let client: RestClient;

  beforeEach(() => {
    fetchFn = makeFetch(201, { created: true });
    client  = new RestClient({ fetchFn: fetchFn as unknown as RestClientFetch });
  });

  it('RC3-01: post() returns ok:true for a 201 response', async () => {
    const result = await client.post('/items', { name: 'test' });
    expect(result.ok).toBe(true);
  });

  it('RC3-02: post() sends the POST HTTP method', async () => {
    await client.post('/items', { name: 'x' });
    const init = fetchFn.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('POST');
  });

  it('RC3-03: post() sends the serialised JSON body', async () => {
    const payload = { name: 'widget', qty: 5 };
    await client.post('/items', payload);
    const init = fetchFn.mock.calls[0][1] as RequestInit;
    expect(init.body).toBe(JSON.stringify(payload));
  });

  it('RC3-04: post() auto-adds Content-Type: application/json for object body', async () => {
    await client.post('/items', { foo: 'bar' });
    const init    = fetchFn.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    const ct      = Object.entries(headers)
      .find(([k]) => k.toLowerCase() === 'content-type')?.[1];
    expect(ct).toBe('application/json');
  });

  it('RC3-05: post() returns the parsed response body', async () => {
    const result = await client.post<{ created: boolean }>('/items', {});
    expect(result.ok && result.value.body.created).toBe(true);
  });
});

// ─── RC4: put() (4 tests) ────────────────────────────────────────────────────

describe('RC4: put()', () => {
  let fetchFn: ReturnType<typeof vi.fn>;
  let client: RestClient;

  beforeEach(() => {
    fetchFn = makeFetch(200, { updated: true });
    client  = new RestClient({ fetchFn: fetchFn as unknown as RestClientFetch });
  });

  it('RC4-01: put() returns ok:true for a 200 response', async () => {
    const result = await client.put('/items/1', { name: 'updated' });
    expect(result.ok).toBe(true);
  });

  it('RC4-02: put() sends the PUT HTTP method', async () => {
    await client.put('/items/1', { name: 'x' });
    const init = fetchFn.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('PUT');
  });

  it('RC4-03: put() sends a JSON-serialised body', async () => {
    const body = { name: 'updated' };
    await client.put('/items/1', body);
    const init = fetchFn.mock.calls[0][1] as RequestInit;
    expect(init.body).toBe(JSON.stringify(body));
  });

  it('RC4-04: put() returns the correct status code', async () => {
    const result = await client.put('/items/1', {});
    expect(result.ok && result.value.status).toBe(200);
  });
});

// ─── RC5: delete() (4 tests) ─────────────────────────────────────────────────

describe('RC5: delete()', () => {
  let fetchFn: ReturnType<typeof vi.fn>;
  let client: RestClient;

  beforeEach(() => {
    fetchFn = makeFetch(204, '');
    client  = new RestClient({ fetchFn: fetchFn as unknown as RestClientFetch });
  });

  it('RC5-01: delete() returns ok:true for a 204 response', async () => {
    const result = await client.delete('/items/1');
    expect(result.ok).toBe(true);
  });

  it('RC5-02: delete() sends the DELETE HTTP method', async () => {
    await client.delete('/items/1');
    const init = fetchFn.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('DELETE');
  });

  it('RC5-03: delete() returns the correct status code', async () => {
    const result = await client.delete('/items/1');
    expect(result.ok && result.value.status).toBe(204);
  });

  it('RC5-04: delete() sends no request body', async () => {
    await client.delete('/items/1');
    const init = fetchFn.mock.calls[0][1] as RequestInit;
    expect(init.body).toBeUndefined();
  });
});

// ─── RC6: headers (5 tests) ──────────────────────────────────────────────────

describe('RC6: headers', () => {
  it('RC6-01: defaultHeaders are included in every request', async () => {
    const fetchFn = makeFetch(200, {});
    const client  = new RestClient({
      defaultHeaders: { Authorization: 'Bearer token' },
      fetchFn: fetchFn as unknown as RestClientFetch,
    });
    await client.get('/test');
    const headers = (fetchFn.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer token');
  });

  it('RC6-02: per-request headers are merged with defaultHeaders', async () => {
    const fetchFn = makeFetch(200, {});
    const client  = new RestClient({
      defaultHeaders: { 'X-App': 'myapp' },
      fetchFn: fetchFn as unknown as RestClientFetch,
    });
    await client.get('/test', { headers: { 'X-Request-Id': 'abc123' } });
    const headers = (fetchFn.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers['X-App']).toBe('myapp');
    expect(headers['X-Request-Id']).toBe('abc123');
  });

  it('RC6-03: per-request headers override defaultHeaders for the same key', async () => {
    const fetchFn = makeFetch(200, {});
    const client  = new RestClient({
      defaultHeaders: { Authorization: 'Bearer old' },
      fetchFn: fetchFn as unknown as RestClientFetch,
    });
    await client.get('/test', { headers: { Authorization: 'Bearer new' } });
    const headers = (fetchFn.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer new');
  });

  it('RC6-04: response headers are returned in RestResponse', async () => {
    const fetchFn = makeFetch(200, {}, { 'X-Custom': 'value' });
    const client  = new RestClient({ fetchFn: fetchFn as unknown as RestClientFetch });
    const result  = await client.get('/test');
    expect(result.ok && result.value.headers['x-custom']).toBe('value');
  });

  it('RC6-05: response header keys are lower-cased in RestResponse', async () => {
    const fetchFn = makeFetch(200, {}, { 'Content-Type': 'application/json' });
    const client  = new RestClient({ fetchFn: fetchFn as unknown as RestClientFetch });
    const result  = await client.get('/test');
    expect(result.ok && 'content-type' in result.value.headers).toBe(true);
    expect(result.ok && 'Content-Type' in result.value.headers).toBe(false);
  });
});

// ─── RC7: query parameters (4 tests) ─────────────────────────────────────────

describe('RC7: query parameters', () => {
  it('RC7-01: a single query param is appended to the URL', async () => {
    const fetchFn = makeFetch(200, {});
    const client  = new RestClient({ fetchFn: fetchFn as unknown as RestClientFetch });
    await client.get('/users', { query: { page: '2' } });
    const url = fetchFn.mock.calls[0][0] as string;
    expect(url).toContain('page=2');
  });

  it('RC7-02: multiple query params are all present in the URL', async () => {
    const fetchFn = makeFetch(200, {});
    const client  = new RestClient({ fetchFn: fetchFn as unknown as RestClientFetch });
    await client.get('/users', { query: { page: '1', limit: '20', sort: 'asc' } });
    const url = fetchFn.mock.calls[0][0] as string;
    expect(url).toContain('page=1');
    expect(url).toContain('limit=20');
    expect(url).toContain('sort=asc');
  });

  it('RC7-03: numeric query values are serialised as strings', async () => {
    const fetchFn = makeFetch(200, {});
    const client  = new RestClient({ fetchFn: fetchFn as unknown as RestClientFetch });
    await client.get('/users', { query: { count: 10 } });
    const url = fetchFn.mock.calls[0][0] as string;
    expect(url).toContain('count=10');
  });

  it('RC7-04: empty query object produces no query string', async () => {
    const fetchFn = makeFetch(200, {});
    const client  = new RestClient({ fetchFn: fetchFn as unknown as RestClientFetch });
    await client.get('/users', { query: {} });
    const url = fetchFn.mock.calls[0][0] as string;
    expect(url).not.toContain('?');
  });
});

// ─── RC8: HTTP error responses (5 tests) ─────────────────────────────────────

describe('RC8: HTTP error responses', () => {
  it('RC8-01: 404 returns ok:false with HTTP_ERROR code', async () => {
    const fetchFn = makeFetch(404, { message: 'Not Found' });
    const client  = new RestClient({ fetchFn: fetchFn as unknown as RestClientFetch });
    const result  = await client.get('/missing');
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.code).toBe('HTTP_ERROR');
  });

  it('RC8-02: 500 returns ok:false with HTTP_ERROR code', async () => {
    const fetchFn = makeFetch(500, { message: 'Internal Server Error' });
    const client  = new RestClient({ fetchFn: fetchFn as unknown as RestClientFetch });
    const result  = await client.get('/crash');
    expect(!result.ok && result.error.code).toBe('HTTP_ERROR');
  });

  it('RC8-03: HTTP_ERROR includes the response status code', async () => {
    const fetchFn = makeFetch(403, {});
    const client  = new RestClient({ fetchFn: fetchFn as unknown as RestClientFetch });
    const result  = await client.get('/secret');
    expect(!result.ok && result.error.status).toBe(403);
  });

  it('RC8-04: HTTP_ERROR includes the parsed response body', async () => {
    const fetchFn = makeFetch(422, { detail: 'Validation failed' });
    const client  = new RestClient({ fetchFn: fetchFn as unknown as RestClientFetch });
    const result  = await client.post('/submit', {});
    expect(
      !result.ok && (result.error.body as { detail: string })?.detail,
    ).toBe('Validation failed');
  });

  it('RC8-05: 201 and 204 are successful (ok:true)', async () => {
    const f201 = makeFetch(201, { id: 42 });
    const c201 = new RestClient({ fetchFn: f201 as unknown as RestClientFetch });
    const r201 = await c201.post('/items', {});
    expect(r201.ok && r201.value.status).toBe(201);

    const f204 = makeFetch(204, '');
    const c204 = new RestClient({ fetchFn: f204 as unknown as RestClientFetch });
    const r204 = await c204.delete('/items/1');
    expect(r204.ok && r204.value.status).toBe(204);
  });
});

// ─── RC9: timeout (4 tests) ──────────────────────────────────────────────────

describe('RC9: timeout', () => {
  it('RC9-01: request that completes before timeout returns ok:true', async () => {
    const fetchFn = makeFetch(200, { data: 'fast' });
    const client  = new RestClient({
      timeout: 5000,
      fetchFn: fetchFn as unknown as RestClientFetch,
    });
    const result = await client.get('/test');
    expect(result.ok).toBe(true);
  });

  it('RC9-02: AbortError from fetch is mapped to TIMEOUT error code', async () => {
    const client = new RestClient({
      timeout: 100,
      fetchFn: makeAbortFetch() as unknown as RestClientFetch,
    });
    const result = await client.get('/slow');
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.code).toBe('TIMEOUT');
  });

  it('RC9-03: when timeout > 0, an AbortSignal is passed to fetch', async () => {
    const fetchFn = makeFetch(200, {});
    const client  = new RestClient({
      timeout: 1000,
      fetchFn: fetchFn as unknown as RestClientFetch,
    });
    await client.get('/test');
    const init = fetchFn.mock.calls[0][1] as RequestInit;
    expect(init.signal).toBeDefined();
  });

  it('RC9-04: per-request timeout overrides constructor timeout (signal present)', async () => {
    const fetchFn = makeFetch(200, {});
    const client  = new RestClient({
      timeout: 0,                          // no default timeout
      fetchFn: fetchFn as unknown as RestClientFetch,
    });
    await client.get('/test', { timeout: 500 }); // per-request timeout
    const init = fetchFn.mock.calls[0][1] as RequestInit;
    expect(init.signal).toBeDefined();   // signal IS added by per-request timeout
  });
});

// ─── RC10: defensive copies (4 tests) ────────────────────────────────────────

describe('RC10: defensive copies', () => {
  it('RC10-01: mutating the returned response headers does not corrupt future calls', async () => {
    const fetchFn = makeFetch(200, {}, { 'X-Count': '1' });
    const client  = new RestClient({ fetchFn: fetchFn as unknown as RestClientFetch });
    const r1 = await client.get('/test');
    if (r1.ok) r1.value.headers['x-count'] = '999'; // mutate returned headers
    const r2 = await client.get('/test');
    expect(r2.ok && r2.value.headers['x-count']).toBe('1');
  });

  it('RC10-02: mutating the returned object body does not affect subsequent calls', async () => {
    const fetchFn = makeFetch(200, { score: 5 });
    const client  = new RestClient({ fetchFn: fetchFn as unknown as RestClientFetch });
    const r1 = await client.get<{ score: number }>('/test');
    if (r1.ok) r1.value.body.score = 999; // mutate returned body
    const r2 = await client.get<{ score: number }>('/test');
    expect(r2.ok && r2.value.body.score).toBe(5);
  });

  it('RC10-03: mutating defaultHeaders after construction does not affect requests', async () => {
    const defaults: Record<string, string> = { 'X-Tenant': 'alpha' };
    const fetchFn = makeFetch(200, {});
    const client  = new RestClient({
      defaultHeaders: defaults,
      fetchFn: fetchFn as unknown as RestClientFetch,
    });
    defaults['X-Tenant'] = 'hacked'; // mutate original object after construction
    await client.get('/test');
    const headers = (fetchFn.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers['X-Tenant']).toBe('alpha');
  });

  it('RC10-04: per-request headers object is not mutated by the client', async () => {
    const fetchFn  = makeFetch(200, {});
    const client   = new RestClient({ fetchFn: fetchFn as unknown as RestClientFetch });
    const reqHdrs: Record<string, string> = { 'X-Id': 'req1' };
    await client.post('/test', { data: 1 }, { headers: reqHdrs });
    // The client should not have written Content-Type into the caller's object
    expect(reqHdrs['Content-Type']).toBeUndefined();
  });
});

// ─── RC11: error handling (4 tests) ──────────────────────────────────────────

describe('RC11: error handling', () => {
  it('RC11-01: network failure returns ok:false with NETWORK_ERROR code', async () => {
    const client = new RestClient({
      fetchFn: makeNetworkErrorFetch() as unknown as RestClientFetch,
    });
    const result = await client.get('/test');
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.code).toBe('NETWORK_ERROR');
  });

  it('RC11-02: null URL returns ok:false with INVALID_URL code', async () => {
    const client = new RestClient({ fetchFn: makeFetch(200, {}) as unknown as RestClientFetch });
    const result = await client.get(null as unknown as string);
    expect(!result.ok && result.error.code).toBe('INVALID_URL');
  });

  it('RC11-03: empty-string URL returns ok:false with INVALID_URL code', async () => {
    const client = new RestClient({ fetchFn: makeFetch(200, {}) as unknown as RestClientFetch });
    const result = await client.get('');
    expect(!result.ok && result.error.code).toBe('INVALID_URL');
  });

  it('RC11-04: NETWORK_ERROR message includes the original error description', async () => {
    const client = new RestClient({
      fetchFn: makeNetworkErrorFetch('ECONNREFUSED') as unknown as RestClientFetch,
    });
    const result = await client.get('/test');
    expect(!result.ok && result.error.message).toContain('ECONNREFUSED');
  });
});

// ─── RC12: never-throw (8 tests) ─────────────────────────────────────────────

describe('RC12: never-throw', () => {
  it('RC12-01: get() with network failure resolves (does not throw)', async () => {
    const client = new RestClient({
      fetchFn: makeNetworkErrorFetch() as unknown as RestClientFetch,
    });
    await expect(client.get('/test')).resolves.toBeDefined();
  });

  it('RC12-02: post() with network failure resolves (does not throw)', async () => {
    const client = new RestClient({
      fetchFn: makeNetworkErrorFetch() as unknown as RestClientFetch,
    });
    await expect(client.post('/test', {})).resolves.toBeDefined();
  });

  it('RC12-03: put() with network failure resolves (does not throw)', async () => {
    const client = new RestClient({
      fetchFn: makeNetworkErrorFetch() as unknown as RestClientFetch,
    });
    await expect(client.put('/test', {})).resolves.toBeDefined();
  });

  it('RC12-04: delete() with network failure resolves (does not throw)', async () => {
    const client = new RestClient({
      fetchFn: makeNetworkErrorFetch() as unknown as RestClientFetch,
    });
    await expect(client.delete('/test')).resolves.toBeDefined();
  });

  it('RC12-05: get(null) resolves with INVALID_URL (does not throw)', async () => {
    const client = new RestClient({ fetchFn: makeFetch(200, {}) as unknown as RestClientFetch });
    await expect(client.get(null as unknown as string)).resolves.toMatchObject({
      ok: false,
      error: { code: 'INVALID_URL' },
    });
  });

  it('RC12-06: get(undefined) resolves with INVALID_URL (does not throw)', async () => {
    const client = new RestClient({ fetchFn: makeFetch(200, {}) as unknown as RestClientFetch });
    await expect(client.get(undefined as unknown as string)).resolves.toMatchObject({
      ok: false,
      error: { code: 'INVALID_URL' },
    });
  });

  it('RC12-07: every method returns a RestClientResult-shaped object', async () => {
    const fetchFn = makeFetch(200, { ok: true });
    const client  = new RestClient({ fetchFn: fetchFn as unknown as RestClientFetch });
    const results = await Promise.all([
      client.get('/a'),
      client.post('/b', {}),
      client.put('/c', {}),
      client.delete('/d'),
    ]);
    for (const r of results) {
      expect(typeof r.ok).toBe('boolean');
    }
  });

  it('RC12-08: network error result has ok:false and a non-empty message', async () => {
    const client = new RestClient({
      fetchFn: makeNetworkErrorFetch('timeout') as unknown as RestClientFetch,
    });
    const result = await client.get('/test');
    expect(result.ok).toBe(false);
    expect(!result.ok && typeof result.error.message).toBe('string');
    expect(!result.ok && result.error.message.length).toBeGreaterThan(0);
  });
});
