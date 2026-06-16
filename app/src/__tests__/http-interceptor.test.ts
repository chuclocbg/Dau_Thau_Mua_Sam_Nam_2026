import { describe, it, expect, vi } from 'vitest';
import {
  HttpInterceptor,
  type HttpRequest,
  type HttpResponse,
  type HttpInterceptorEntry,
  type HttpInterceptorResult,
  type HttpHandler,
  type HttpInterceptorErrorCode,
} from '../providers/HttpInterceptor';

// ─── Test helpers ─────────────────────────────────────────────────────────────

const sampleRequest: HttpRequest = {
  url:     '/api/test',
  method:  'GET',
  headers: { 'x-test': '1' },
  meta:    {},
};

function okResult<T>(body: T, status = 200): HttpInterceptorResult<T> {
  return { ok: true, value: { status, headers: { 'content-type': 'application/json' }, body, meta: {} } };
}

const errResult: HttpInterceptorResult<unknown> = {
  ok: false,
  error: { code: 'HANDLER_ERROR', message: 'deliberate failure' },
};

function makeHandler<T>(result: HttpInterceptorResult<T>): HttpHandler<T> {
  return vi.fn(async () => result);
}

function makeThrowingHandler<T = unknown>(): HttpHandler<T> {
  return vi.fn(async () => { throw new Error('handler boom'); }) as unknown as HttpHandler<T>;
}

// ─── HI1: Constructor / initial state ────────────────────────────────────────

describe('HI1: Constructor / initial state', () => {
  it('HI1-01: new HttpInterceptor() constructs without error', () => {
    expect(() => new HttpInterceptor()).not.toThrow();
  });

  it('HI1-02: addInterceptor() returns a non-empty string ID', () => {
    const hi = new HttpInterceptor();
    const id = hi.addInterceptor({ request: async req => req });
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('HI1-03: addInterceptor() with only a request hook is accepted', () => {
    const hi = new HttpInterceptor();
    expect(() => hi.addInterceptor({ request: async req => req })).not.toThrow();
  });

  it('HI1-04: addInterceptor() with only a response hook is accepted', () => {
    const hi = new HttpInterceptor();
    expect(() => hi.addInterceptor({ response: async res => res })).not.toThrow();
  });

  it('HI1-05: addInterceptor() with both request and response hooks is accepted', () => {
    const hi = new HttpInterceptor();
    expect(() => hi.addInterceptor({ request: async req => req, response: async res => res })).not.toThrow();
  });
});

// ─── HI2: execute() with no interceptors ─────────────────────────────────────

describe('HI2: execute() with no interceptors', () => {
  it('HI2-01: handler is called once when there are no interceptors', async () => {
    const hi = new HttpInterceptor();
    const handler = makeHandler(okResult('body'));
    await hi.execute(sampleRequest, handler);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('HI2-02: returns { ok: true } from handler with no interceptors', async () => {
    const hi = new HttpInterceptor();
    const r = await hi.execute(sampleRequest, makeHandler(okResult('body')));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.body).toBe('body');
  });

  it('HI2-03: returns { ok: false } from handler (passthrough)', async () => {
    const hi = new HttpInterceptor();
    const r = await hi.execute(sampleRequest, makeHandler(errResult));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('HANDLER_ERROR');
  });

  it('HI2-04: handler receives the url from the input request', async () => {
    const hi = new HttpInterceptor();
    let capturedUrl = '';
    await hi.execute(sampleRequest, async req => {
      capturedUrl = req.url;
      return okResult('ok');
    });
    expect(capturedUrl).toBe('/api/test');
  });

  it('HI2-05: execute() returns a Promise', () => {
    const hi = new HttpInterceptor();
    const result = hi.execute(sampleRequest, makeHandler(okResult('x')));
    expect(result).toBeInstanceOf(Promise);
  });
});

// ─── HI3: Request interceptors ───────────────────────────────────────────────

describe('HI3: Request interceptors', () => {
  it('HI3-01: request interceptor can modify the url seen by the handler', async () => {
    const hi = new HttpInterceptor();
    hi.addInterceptor({ request: async req => ({ ...req, url: '/intercepted' }) });
    let seen = '';
    await hi.execute(sampleRequest, async req => { seen = req.url; return okResult('ok'); });
    expect(seen).toBe('/intercepted');
  });

  it('HI3-02: request interceptor can add headers', async () => {
    const hi = new HttpInterceptor();
    hi.addInterceptor({
      request: async req => ({ ...req, headers: { ...req.headers, 'x-auth': 'token' } }),
    });
    let capturedHeaders: Record<string, string> = {};
    await hi.execute(sampleRequest, async req => { capturedHeaders = req.headers; return okResult('ok'); });
    expect(capturedHeaders['x-auth']).toBe('token');
  });

  it('HI3-03: async request interceptor is awaited before calling handler', async () => {
    const hi = new HttpInterceptor();
    const order: string[] = [];
    hi.addInterceptor({
      request: async req => {
        await Promise.resolve();
        order.push('interceptor');
        return req;
      },
    });
    await hi.execute(sampleRequest, async req => { order.push('handler'); return okResult('ok'); });
    expect(order).toEqual(['interceptor', 'handler']);
  });

  it('HI3-04: request interceptor receives all request fields', async () => {
    const hi = new HttpInterceptor();
    let received: HttpRequest | null = null;
    hi.addInterceptor({ request: async req => { received = req; return req; } });
    const input: HttpRequest = { url: '/u', method: 'POST', headers: { 'h': '1' }, body: { x: 1 }, meta: { k: 'v' } };
    await hi.execute(input, makeHandler(okResult('ok')));
    expect(received?.url).toBe('/u');
    expect(received?.method).toBe('POST');
    expect(received?.headers['h']).toBe('1');
    expect(received?.meta['k']).toBe('v');
  });

  it('HI3-05: handler receives the modified request produced by the interceptor', async () => {
    const hi = new HttpInterceptor();
    hi.addInterceptor({ request: async req => ({ ...req, method: 'POST' }) });
    let handlerMethod = '';
    await hi.execute(sampleRequest, async req => { handlerMethod = req.method; return okResult('ok'); });
    expect(handlerMethod).toBe('POST');
  });
});

// ─── HI4: Response interceptors ──────────────────────────────────────────────

describe('HI4: Response interceptors', () => {
  it('HI4-01: response interceptor can modify the response body', async () => {
    const hi = new HttpInterceptor();
    hi.addInterceptor({
      response: async res => res.ok
        ? { ok: true, value: { ...res.value, body: 'modified' } }
        : res,
    });
    const r = await hi.execute(sampleRequest, makeHandler(okResult('original')));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.body).toBe('modified');
  });

  it('HI4-02: response interceptor receives the result produced by the handler', async () => {
    const hi = new HttpInterceptor();
    let interceptedStatus = 0;
    hi.addInterceptor({
      response: async res => { if (res.ok) interceptedStatus = res.value.status; return res; },
    });
    await hi.execute(sampleRequest, makeHandler(okResult('ok', 201)));
    expect(interceptedStatus).toBe(201);
  });

  it('HI4-03: async response interceptor is awaited', async () => {
    const hi = new HttpInterceptor();
    const order: string[] = [];
    hi.addInterceptor({
      response: async res => { await Promise.resolve(); order.push('response-interceptor'); return res; },
    });
    await hi.execute(sampleRequest, async req => { order.push('handler'); return okResult('ok'); });
    expect(order).toEqual(['handler', 'response-interceptor']);
  });

  it('HI4-04: response interceptor runs even when handler returns ok: false', async () => {
    const hi = new HttpInterceptor();
    let ran = false;
    hi.addInterceptor({ response: async res => { ran = true; return res; } });
    await hi.execute(sampleRequest, makeHandler(errResult));
    expect(ran).toBe(true);
  });

  it('HI4-05: response interceptor can convert ok: false to ok: true', async () => {
    const hi = new HttpInterceptor();
    hi.addInterceptor({
      response: async () => okResult('recovered') as HttpInterceptorResult<unknown>,
    });
    const r = await hi.execute(sampleRequest, makeHandler(errResult));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.body).toBe('recovered');
  });
});

// ─── HI5: Execution order ─────────────────────────────────────────────────────

describe('HI5: Execution order', () => {
  it('HI5-01: multiple request interceptors execute in registration order', async () => {
    const hi = new HttpInterceptor();
    const order: number[] = [];
    hi.addInterceptor({ request: async req => { order.push(1); return req; } });
    hi.addInterceptor({ request: async req => { order.push(2); return req; } });
    hi.addInterceptor({ request: async req => { order.push(3); return req; } });
    await hi.execute(sampleRequest, makeHandler(okResult('ok')));
    expect(order).toEqual([1, 2, 3]);
  });

  it('HI5-02: each request interceptor receives the output of the previous one', async () => {
    const hi = new HttpInterceptor();
    hi.addInterceptor({ request: async req => ({ ...req, url: req.url + '/a' }) });
    hi.addInterceptor({ request: async req => ({ ...req, url: req.url + '/b' }) });
    let finalUrl = '';
    await hi.execute({ ...sampleRequest, url: '/base' }, async req => { finalUrl = req.url; return okResult('ok'); });
    expect(finalUrl).toBe('/base/a/b');
  });

  it('HI5-03: multiple response interceptors execute in registration order', async () => {
    const hi = new HttpInterceptor();
    const order: number[] = [];
    hi.addInterceptor({ response: async res => { order.push(1); return res; } });
    hi.addInterceptor({ response: async res => { order.push(2); return res; } });
    hi.addInterceptor({ response: async res => { order.push(3); return res; } });
    await hi.execute(sampleRequest, makeHandler(okResult('ok')));
    expect(order).toEqual([1, 2, 3]);
  });

  it('HI5-04: each response interceptor receives the output of the previous one', async () => {
    const hi = new HttpInterceptor();
    hi.addInterceptor({
      response: async res => res.ok ? { ok: true, value: { ...res.value, body: 'step1' } } : res,
    });
    hi.addInterceptor({
      response: async res => res.ok ? { ok: true, value: { ...res.value, body: (res.value.body as string) + '+step2' } } : res,
    });
    const r = await hi.execute(sampleRequest, makeHandler(okResult('original')));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.body).toBe('step1+step2');
  });

  it('HI5-05: full pipeline order is req-interceptors → handler → res-interceptors', async () => {
    const hi = new HttpInterceptor();
    const order: string[] = [];
    hi.addInterceptor({
      request:  async req => { order.push('req1'); return req; },
      response: async res => { order.push('res1'); return res; },
    });
    hi.addInterceptor({
      request:  async req => { order.push('req2'); return req; },
      response: async res => { order.push('res2'); return res; },
    });
    await hi.execute(sampleRequest, async req => { order.push('handler'); return okResult('ok'); });
    expect(order).toEqual(['req1', 'req2', 'handler', 'res1', 'res2']);
  });
});

// ─── HI6: removeInterceptor() ────────────────────────────────────────────────

describe('HI6: removeInterceptor()', () => {
  it('HI6-01: removeInterceptor() returns true for a known ID', () => {
    const hi = new HttpInterceptor();
    const id = hi.addInterceptor({ request: async req => req });
    expect(hi.removeInterceptor(id)).toBe(true);
  });

  it('HI6-02: removeInterceptor() returns false for an unknown ID', () => {
    const hi = new HttpInterceptor();
    expect(hi.removeInterceptor('non-existent')).toBe(false);
  });

  it('HI6-03: removed interceptor does not run in subsequent execute() calls', async () => {
    const hi = new HttpInterceptor();
    let callCount = 0;
    const id = hi.addInterceptor({ request: async req => { callCount++; return req; } });
    hi.removeInterceptor(id);
    await hi.execute(sampleRequest, makeHandler(okResult('ok')));
    expect(callCount).toBe(0);
  });

  it('HI6-04: removeInterceptor() with the same ID a second time returns false', () => {
    const hi = new HttpInterceptor();
    const id = hi.addInterceptor({ request: async req => req });
    hi.removeInterceptor(id);
    expect(hi.removeInterceptor(id)).toBe(false);
  });
});

// ─── HI7: clear() ────────────────────────────────────────────────────────────

describe('HI7: clear()', () => {
  it('HI7-01: clear() on an empty interceptor list is a safe no-op', () => {
    const hi = new HttpInterceptor();
    expect(() => hi.clear()).not.toThrow();
  });

  it('HI7-02: execute() calls no interceptors after clear()', async () => {
    const hi = new HttpInterceptor();
    let ran = false;
    hi.addInterceptor({ request: async req => { ran = true; return req; } });
    hi.clear();
    await hi.execute(sampleRequest, makeHandler(okResult('ok')));
    expect(ran).toBe(false);
  });

  it('HI7-03: clear() removes all registered interceptors', async () => {
    const hi = new HttpInterceptor();
    const calls: number[] = [];
    hi.addInterceptor({ request: async req => { calls.push(1); return req; } });
    hi.addInterceptor({ request: async req => { calls.push(2); return req; } });
    hi.clear();
    await hi.execute(sampleRequest, makeHandler(okResult('ok')));
    expect(calls).toHaveLength(0);
  });

  it('HI7-04: addInterceptor() works normally after clear()', async () => {
    const hi = new HttpInterceptor();
    hi.addInterceptor({ request: async req => req });
    hi.clear();
    let ran = false;
    hi.addInterceptor({ request: async req => { ran = true; return req; } });
    await hi.execute(sampleRequest, makeHandler(okResult('ok')));
    expect(ran).toBe(true);
  });
});

// ─── HI8: Request interceptor errors ─────────────────────────────────────────

describe('HI8: Request interceptor errors', () => {
  it('HI8-01: throwing request interceptor → ok: false, code: REQUEST_INTERCEPTOR_ERROR', async () => {
    const hi = new HttpInterceptor();
    hi.addInterceptor({ request: async () => { throw new Error('req error'); } });
    const r = await hi.execute(sampleRequest, makeHandler(okResult('ok')));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('REQUEST_INTERCEPTOR_ERROR');
  });

  it('HI8-02: handler is NOT called when a request interceptor throws', async () => {
    const hi = new HttpInterceptor();
    hi.addInterceptor({ request: async () => { throw new Error('abort'); } });
    const handler = makeHandler(okResult('ok'));
    await hi.execute(sampleRequest, handler);
    expect(handler).not.toHaveBeenCalled();
  });

  it('HI8-03: subsequent request interceptors do not run after a throw', async () => {
    const hi = new HttpInterceptor();
    hi.addInterceptor({ request: async () => { throw new Error('stop'); } });
    let secondRan = false;
    hi.addInterceptor({ request: async req => { secondRan = true; return req; } });
    await hi.execute(sampleRequest, makeHandler(okResult('ok')));
    expect(secondRan).toBe(false);
  });

  it('HI8-04: async request interceptor that rejects → REQUEST_INTERCEPTOR_ERROR', async () => {
    const hi = new HttpInterceptor();
    hi.addInterceptor({ request: async () => Promise.reject(new Error('async req error')) });
    const r = await hi.execute(sampleRequest, makeHandler(okResult('ok')));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('REQUEST_INTERCEPTOR_ERROR');
  });
});

// ─── HI9: Response interceptor errors ────────────────────────────────────────

describe('HI9: Response interceptor errors', () => {
  it('HI9-01: throwing response interceptor → ok: false, code: RESPONSE_INTERCEPTOR_ERROR', async () => {
    const hi = new HttpInterceptor();
    hi.addInterceptor({ response: async () => { throw new Error('res error'); } });
    const r = await hi.execute(sampleRequest, makeHandler(okResult('ok')));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('RESPONSE_INTERCEPTOR_ERROR');
  });

  it('HI9-02: handler IS called before a later response interceptor throws', async () => {
    const hi = new HttpInterceptor();
    hi.addInterceptor({ response: async () => { throw new Error('res error'); } });
    const handler = makeHandler(okResult('ok'));
    await hi.execute(sampleRequest, handler);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('HI9-03: subsequent response interceptors do not run after a throw', async () => {
    const hi = new HttpInterceptor();
    hi.addInterceptor({ response: async () => { throw new Error('stop'); } });
    let secondRan = false;
    hi.addInterceptor({ response: async res => { secondRan = true; return res; } });
    await hi.execute(sampleRequest, makeHandler(okResult('ok')));
    expect(secondRan).toBe(false);
  });

  it('HI9-04: async response interceptor that rejects → RESPONSE_INTERCEPTOR_ERROR', async () => {
    const hi = new HttpInterceptor();
    hi.addInterceptor({ response: async () => Promise.reject(new Error('async res error')) });
    const r = await hi.execute(sampleRequest, makeHandler(okResult('ok')));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('RESPONSE_INTERCEPTOR_ERROR');
  });
});

// ─── HI10: Handler errors ─────────────────────────────────────────────────────

describe('HI10: Handler errors', () => {
  it('HI10-01: throwing handler → ok: false, code: HANDLER_ERROR', async () => {
    const hi = new HttpInterceptor();
    const r = await hi.execute(sampleRequest, makeThrowingHandler());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('HANDLER_ERROR');
  });

  it('HI10-02: null handler → ok: false, code: HANDLER_ERROR', async () => {
    const hi = new HttpInterceptor();
    const r = await hi.execute(sampleRequest, null as unknown as HttpHandler<unknown>);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('HANDLER_ERROR');
  });

  it('HI10-03: response interceptors still run when handler throws', async () => {
    const hi = new HttpInterceptor();
    let interceptorRan = false;
    hi.addInterceptor({ response: async res => { interceptorRan = true; return res; } });
    await hi.execute(sampleRequest, makeThrowingHandler());
    expect(interceptorRan).toBe(true);
  });

  it('HI10-04: error.message is non-empty when handler throws', async () => {
    const hi = new HttpInterceptor();
    const r = await hi.execute(sampleRequest, makeThrowingHandler());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message.length).toBeGreaterThan(0);
  });
});

// ─── HI11: Defensive copies ───────────────────────────────────────────────────

describe('HI11: Defensive copies', () => {
  it('HI11-01: execute() does not mutate the caller\'s input request', async () => {
    const hi = new HttpInterceptor();
    hi.addInterceptor({ request: async req => ({ ...req, url: '/changed', headers: { added: 'yes' } }) });
    const input: HttpRequest = { url: '/original', method: 'GET', headers: {}, meta: {} };
    await hi.execute(input, makeHandler(okResult('ok')));
    expect(input.url).toBe('/original');
    expect(input.headers).toEqual({});
  });

  it('HI11-02: handler receives a separate reference from the caller\'s request', async () => {
    const hi = new HttpInterceptor();
    const input: HttpRequest = { url: '/ref', method: 'GET', headers: {}, meta: {} };
    let handlerRef: HttpRequest | null = null;
    await hi.execute(input, async req => { handlerRef = req; return okResult('ok'); });
    expect(handlerRef).not.toBe(input);
  });

  it('HI11-03: each response interceptor receives its own isolated copy of the result', async () => {
    const hi = new HttpInterceptor();
    let firstInput: HttpInterceptorResult<unknown> | null = null;
    let secondInput: HttpInterceptorResult<unknown> | null = null;
    hi.addInterceptor({ response: async res => { firstInput = res; return res; } });
    hi.addInterceptor({ response: async res => { secondInput = res; return res; } });
    await hi.execute(sampleRequest, makeHandler(okResult('ok')));
    expect(firstInput).not.toBe(secondInput);
  });

  it('HI11-04: returned response headers are a clone — mutating them does not affect a re-run', async () => {
    const hi = new HttpInterceptor();
    const r1 = await hi.execute(sampleRequest, async () => ({
      ok: true as const,
      value: { status: 200, headers: { 'x-h': 'original' }, body: 'a', meta: {} },
    }));
    if (r1.ok) {
      (r1.value.headers as Record<string, string>)['x-h'] = 'mutated';
    }
    const r2 = await hi.execute(sampleRequest, async () => ({
      ok: true as const,
      value: { status: 200, headers: { 'x-h': 'original' }, body: 'b', meta: {} },
    }));
    if (r2.ok) {
      expect(r2.value.headers['x-h']).toBe('original');
    }
  });

  it('HI11-05: returned response body (object) is a clone, not the handler\'s reference', async () => {
    const hi = new HttpInterceptor();
    const handlerBody = { data: 'hello' };
    const r = await hi.execute(sampleRequest, makeHandler(okResult(handlerBody)));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.body).not.toBe(handlerBody);
  });
});

// ─── HI12: Never throw / edge cases ──────────────────────────────────────────

describe('HI12: Never throw / edge cases', () => {
  it('HI12-01: execute() never throws when handler throws', async () => {
    const hi = new HttpInterceptor();
    await expect(hi.execute(sampleRequest, makeThrowingHandler())).resolves.toMatchObject({ ok: false });
  });

  it('HI12-02: execute() never throws when request interceptor throws', async () => {
    const hi = new HttpInterceptor();
    hi.addInterceptor({ request: async () => { throw new Error('x'); } });
    await expect(hi.execute(sampleRequest, makeHandler(okResult('ok')))).resolves.toMatchObject({ ok: false });
  });

  it('HI12-03: execute() never throws when response interceptor throws', async () => {
    const hi = new HttpInterceptor();
    hi.addInterceptor({ response: async () => { throw new Error('y'); } });
    await expect(hi.execute(sampleRequest, makeHandler(okResult('ok')))).resolves.toMatchObject({ ok: false });
  });

  it('HI12-04: addInterceptor() with null/undefined/malformed entry does not throw', () => {
    const hi = new HttpInterceptor();
    expect(() => hi.addInterceptor(null as unknown as HttpInterceptorEntry)).not.toThrow();
    expect(() => hi.addInterceptor(undefined as unknown as HttpInterceptorEntry)).not.toThrow();
    expect(() => hi.addInterceptor(42 as unknown as HttpInterceptorEntry)).not.toThrow();
    expect(() => hi.addInterceptor({} as HttpInterceptorEntry)).not.toThrow();
  });

  it('HI12-05: removeInterceptor() never throws', () => {
    const hi = new HttpInterceptor();
    expect(() => hi.removeInterceptor('unknown')).not.toThrow();
    expect(() => hi.removeInterceptor(null as unknown as string)).not.toThrow();
    expect(() => hi.removeInterceptor(undefined as unknown as string)).not.toThrow();
  });

  it('HI12-06: clear() never throws', () => {
    const hi = new HttpInterceptor();
    expect(() => hi.clear()).not.toThrow();
    expect(() => hi.clear()).not.toThrow(); // idempotent
  });
});
