/**
 * P6-10A: Tests for OpenAIProvider.
 *
 * All tests use injected mock fetch — no real HTTP calls are made.
 * Groups:
 *   VC — validateConfig()
 *   MI — getModelInfo()
 *   CH — chat() success paths
 *   CE — chat() error paths
 *   CR — chat() request payload inspection
 */

import { describe, it, expect } from 'vitest';
import {
  OpenAIProvider,
  type OpenAIProviderConfig,
  type OpenAIChatRequest,
} from '../providers/OpenAIProvider';

// ─── Mock fetch helpers ───────────────────────────────────────────────────────

/** Builds an OpenAI-shaped success response body. */
function apiSuccess(content: string, model = 'gpt-4o', finishReason = 'stop') {
  return {
    id:      'chatcmpl-test',
    model,
    choices: [
      {
        index:         0,
        message:       { role: 'assistant', content },
        finish_reason: finishReason,
      },
    ],
    usage: {
      prompt_tokens:     10,
      completion_tokens: 20,
      total_tokens:      30,
    },
  };
}

/** Returns a mock fetch that responds with the given status + JSON body. */
function mockFetch(status: number, body: unknown): OpenAIProviderConfig['fetchFn'] {
  return async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
}

/** Returns a mock fetch that throws a network error. */
function throwingFetch(error: Error): OpenAIProviderConfig['fetchFn'] {
  return async () => { throw error; };
}

/** Returns a mock fetch that responds with non-JSON text. */
function badJsonFetch(): OpenAIProviderConfig['fetchFn'] {
  return async () =>
    new Response('not-valid-json{{', {
      status:  200,
      headers: { 'Content-Type': 'application/json' },
    });
}

/** Captures the last request details for assertion. */
interface Capture { url: string; init: RequestInit; }
function capturingFetch(
  status: number,
  body:   unknown,
  out:    Capture[],
): OpenAIProviderConfig['fetchFn'] {
  return async (url, init) => {
    out.push({ url, init });
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  };
}

/** Minimal valid config for most tests. */
const VALID: OpenAIProviderConfig = {
  apiKey:  'sk-test-key',
  model:   'gpt-4o',
  fetchFn: mockFetch(200, apiSuccess('Hello')),
};

const BASIC_REQUEST: OpenAIChatRequest = {
  messages: [{ role: 'user', content: 'Phương thức nào phù hợp?' }],
};

// ─── VC: validateConfig ───────────────────────────────────────────────────────

describe('validateConfig', () => {
  it('VC-01: empty apiKey → INVALID_CONFIG', () => {
    const p = new OpenAIProvider({ ...VALID, apiKey: '' });
    const r = p.validateConfig();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_CONFIG');
  });

  it('VC-02: whitespace-only apiKey → INVALID_CONFIG', () => {
    const p = new OpenAIProvider({ ...VALID, apiKey: '   ' });
    const r = p.validateConfig();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_CONFIG');
  });

  it('VC-03: empty model → INVALID_CONFIG', () => {
    const p = new OpenAIProvider({ ...VALID, model: '' });
    const r = p.validateConfig();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_CONFIG');
  });

  it('VC-04: temperature below 0 → INVALID_CONFIG', () => {
    const p = new OpenAIProvider({ ...VALID, temperature: -0.1 });
    const r = p.validateConfig();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_CONFIG');
  });

  it('VC-05: temperature above 2 → INVALID_CONFIG', () => {
    const p = new OpenAIProvider({ ...VALID, temperature: 2.1 });
    const r = p.validateConfig();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_CONFIG');
  });

  it('VC-06: maxTokens = 0 → INVALID_CONFIG', () => {
    const p = new OpenAIProvider({ ...VALID, maxTokens: 0 });
    const r = p.validateConfig();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_CONFIG');
  });

  it('VC-07: maxTokens negative → INVALID_CONFIG', () => {
    const p = new OpenAIProvider({ ...VALID, maxTokens: -1 });
    const r = p.validateConfig();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_CONFIG');
  });

  it('VC-08: valid minimal config (apiKey + model only) → ok:true', () => {
    const p = new OpenAIProvider({ apiKey: 'sk-x', model: 'gpt-4o' });
    const r = p.validateConfig();
    expect(r.ok).toBe(true);
  });

  it('VC-09: valid config with all options → ok:true', () => {
    const p = new OpenAIProvider({
      ...VALID, temperature: 1.0, maxTokens: 512, baseUrl: 'https://proxy.example.com/v1',
    });
    expect(p.validateConfig().ok).toBe(true);
  });

  it('VC-10: temperature boundary 0.0 → ok:true', () => {
    const p = new OpenAIProvider({ ...VALID, temperature: 0 });
    expect(p.validateConfig().ok).toBe(true);
  });

  it('VC-11: temperature boundary 2.0 → ok:true', () => {
    const p = new OpenAIProvider({ ...VALID, temperature: 2 });
    expect(p.validateConfig().ok).toBe(true);
  });

  it('VC-12: INVALID_CONFIG error contains descriptive message', () => {
    const p = new OpenAIProvider({ ...VALID, apiKey: '' });
    const r = p.validateConfig();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message.length).toBeGreaterThan(0);
  });
});

// ─── MI: getModelInfo ─────────────────────────────────────────────────────────

describe('getModelInfo', () => {
  it('MI-01: gpt-4o → correct maxContextTokens', () => {
    const p    = new OpenAIProvider({ ...VALID, model: 'gpt-4o' });
    const info = p.getModelInfo();
    expect(info.modelId).toBe('gpt-4o');
    expect(info.maxContextTokens).toBe(128_000);
  });

  it('MI-02: gpt-4o → supportsVision = true', () => {
    const info = new OpenAIProvider({ ...VALID, model: 'gpt-4o' }).getModelInfo();
    expect(info.supportsVision).toBe(true);
  });

  it('MI-03: gpt-4-turbo → supportsVision = true', () => {
    const info = new OpenAIProvider({ ...VALID, model: 'gpt-4-turbo' }).getModelInfo();
    expect(info.supportsVision).toBe(true);
    expect(info.maxContextTokens).toBe(128_000);
  });

  it('MI-04: gpt-3.5-turbo → supportsVision = false', () => {
    const info = new OpenAIProvider({ ...VALID, model: 'gpt-3.5-turbo' }).getModelInfo();
    expect(info.supportsVision).toBe(false);
    expect(info.maxContextTokens).toBe(16_385);
  });

  it('MI-05: gpt-4 → supportsVision = false, 8K context', () => {
    const info = new OpenAIProvider({ ...VALID, model: 'gpt-4' }).getModelInfo();
    expect(info.supportsVision).toBe(false);
    expect(info.maxContextTokens).toBe(8_192);
  });

  it('MI-06: unknown model → default fallback with modelId preserved', () => {
    const info = new OpenAIProvider({ ...VALID, model: 'gpt-9-ultra' }).getModelInfo();
    expect(info.modelId).toBe('gpt-9-ultra');
    expect(info.maxContextTokens).toBe(4_096);
    expect(info.supportsVision).toBe(false);
  });

  it('MI-07: getModelInfo(model) overrides config model for lookup', () => {
    const p    = new OpenAIProvider({ ...VALID, model: 'gpt-3.5-turbo' });
    const info = p.getModelInfo('gpt-4o');
    expect(info.modelId).toBe('gpt-4o');
    expect(info.supportsVision).toBe(true);
  });

  it('MI-08: every known model has non-empty description', () => {
    const models = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'];
    for (const m of models) {
      const info = new OpenAIProvider({ ...VALID, model: m }).getModelInfo();
      expect(info.description.length).toBeGreaterThan(0);
    }
  });
});

// ─── CH: chat() success ───────────────────────────────────────────────────────

describe('chat() — success paths', () => {
  it('CH-01: returns ok:true with content on 200 response', async () => {
    const p = new OpenAIProvider({
      ...VALID,
      fetchFn: mockFetch(200, apiSuccess('Đây là câu trả lời.')),
    });
    const r = await p.chat(BASIC_REQUEST);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.content).toBe('Đây là câu trả lời.');
  });

  it('CH-02: response contains model from API body', async () => {
    const p = new OpenAIProvider({
      ...VALID,
      fetchFn: mockFetch(200, apiSuccess('ok', 'gpt-4o-2024-11-20')),
    });
    const r = await p.chat(BASIC_REQUEST);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.model).toBe('gpt-4o-2024-11-20');
  });

  it('CH-03: response contains usage fields', async () => {
    const p = new OpenAIProvider({ ...VALID, fetchFn: mockFetch(200, apiSuccess('x')) });
    const r = await p.chat(BASIC_REQUEST);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.usage.promptTokens).toBe(10);
      expect(r.value.usage.completionTokens).toBe(20);
      expect(r.value.usage.totalTokens).toBe(30);
    }
  });

  it('CH-04: response contains finishReason from API', async () => {
    const p = new OpenAIProvider({
      ...VALID,
      fetchFn: mockFetch(200, apiSuccess('x', 'gpt-4o', 'length')),
    });
    const r = await p.chat(BASIC_REQUEST);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.finishReason).toBe('length');
  });

  it('CH-05: per-request model override used in response', async () => {
    const captured: Capture[] = [];
    const p = new OpenAIProvider({
      ...VALID,
      model:   'gpt-3.5-turbo',
      fetchFn: capturingFetch(200, apiSuccess('ok', 'gpt-4-turbo'), captured),
    });
    await p.chat({ ...BASIC_REQUEST, model: 'gpt-4-turbo' });
    const body = JSON.parse(captured[0].init.body as string) as { model: string };
    expect(body.model).toBe('gpt-4-turbo');
  });

  it('CH-06: per-request temperature override', async () => {
    const captured: Capture[] = [];
    const p = new OpenAIProvider({
      ...VALID,
      temperature: 0.7,
      fetchFn:     capturingFetch(200, apiSuccess('ok'), captured),
    });
    await p.chat({ ...BASIC_REQUEST, temperature: 0.1 });
    const body = JSON.parse(captured[0].init.body as string) as { temperature: number };
    expect(body.temperature).toBe(0.1);
  });

  it('CH-07: per-request maxTokens override sent as max_tokens', async () => {
    const captured: Capture[] = [];
    const p = new OpenAIProvider({
      ...VALID,
      maxTokens: 1024,
      fetchFn:   capturingFetch(200, apiSuccess('ok'), captured),
    });
    await p.chat({ ...BASIC_REQUEST, maxTokens: 256 });
    const body = JSON.parse(captured[0].init.body as string) as { max_tokens: number };
    expect(body.max_tokens).toBe(256);
  });
});

// ─── CE: chat() error paths ───────────────────────────────────────────────────

describe('chat() — error paths', () => {
  it('CE-01: invalid config short-circuits before fetch → INVALID_CONFIG', async () => {
    let fetchCalled = false;
    const p = new OpenAIProvider({
      ...VALID,
      apiKey:  '',
      fetchFn: async () => { fetchCalled = true; return new Response('{}', { status: 200 }); },
    });
    const r = await p.chat(BASIC_REQUEST);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_CONFIG');
    expect(fetchCalled).toBe(false);
  });

  it('CE-02: network error → NETWORK_ERROR', async () => {
    const p = new OpenAIProvider({
      ...VALID,
      fetchFn: throwingFetch(new Error('Connection refused')),
    });
    const r = await p.chat(BASIC_REQUEST);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe('NETWORK_ERROR');
      expect(r.error.cause).toBeInstanceOf(Error);
    }
  });

  it('CE-03: HTTP 401 → UNAUTHORIZED', async () => {
    const p = new OpenAIProvider({ ...VALID, fetchFn: mockFetch(401, { error: 'invalid key' }) });
    const r = await p.chat(BASIC_REQUEST);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe('UNAUTHORIZED');
      expect(r.error.status).toBe(401);
    }
  });

  it('CE-04: HTTP 429 → RATE_LIMITED', async () => {
    const p = new OpenAIProvider({ ...VALID, fetchFn: mockFetch(429, { error: 'rate limit' }) });
    const r = await p.chat(BASIC_REQUEST);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe('RATE_LIMITED');
      expect(r.error.status).toBe(429);
    }
  });

  it('CE-05: HTTP 500 → API_ERROR with status 500', async () => {
    const p = new OpenAIProvider({ ...VALID, fetchFn: mockFetch(500, { error: 'server error' }) });
    const r = await p.chat(BASIC_REQUEST);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe('API_ERROR');
      expect(r.error.status).toBe(500);
    }
  });

  it('CE-06: HTTP 404 → API_ERROR with status 404', async () => {
    const p = new OpenAIProvider({ ...VALID, fetchFn: mockFetch(404, { error: 'not found' }) });
    const r = await p.chat(BASIC_REQUEST);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe('API_ERROR');
      expect(r.error.status).toBe(404);
    }
  });

  it('CE-07: unparseable JSON response → PARSE_ERROR', async () => {
    const p = new OpenAIProvider({ ...VALID, fetchFn: badJsonFetch() });
    const r = await p.chat(BASIC_REQUEST);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe('PARSE_ERROR');
      expect(r.error.cause).toBeDefined();
    }
  });

  it('CE-08: empty choices array → PARSE_ERROR', async () => {
    const body = { ...apiSuccess('x'), choices: [] };
    const p    = new OpenAIProvider({ ...VALID, fetchFn: mockFetch(200, body) });
    const r    = await p.chat(BASIC_REQUEST);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('PARSE_ERROR');
  });

  it('CE-09: missing choices key entirely → PARSE_ERROR', async () => {
    const body = { model: 'gpt-4o', usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 } };
    const p    = new OpenAIProvider({ ...VALID, fetchFn: mockFetch(200, body) });
    const r    = await p.chat(BASIC_REQUEST);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('PARSE_ERROR');
  });

  it('CE-10: chat() never throws — all errors are returned values', async () => {
    const p = new OpenAIProvider({ ...VALID, fetchFn: throwingFetch(new TypeError('fetch failed')) });
    await expect(p.chat(BASIC_REQUEST)).resolves.toMatchObject({ ok: false });
  });

  it('CE-11: HTTP 503 → API_ERROR', async () => {
    const p = new OpenAIProvider({ ...VALID, fetchFn: mockFetch(503, {}) });
    const r = await p.chat(BASIC_REQUEST);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe('API_ERROR');
      expect(r.error.status).toBe(503);
    }
  });
});

// ─── CR: chat() request payload ───────────────────────────────────────────────

describe('chat() — request payload', () => {
  it('CR-01: sends POST to /chat/completions endpoint', async () => {
    const captured: Capture[] = [];
    const p = new OpenAIProvider({
      ...VALID,
      baseUrl: 'https://api.openai.com/v1',
      fetchFn: capturingFetch(200, apiSuccess('ok'), captured),
    });
    await p.chat(BASIC_REQUEST);
    expect(captured[0].url).toBe('https://api.openai.com/v1/chat/completions');
    expect(captured[0].init.method).toBe('POST');
  });

  it('CR-02: custom baseUrl is used in the endpoint', async () => {
    const captured: Capture[] = [];
    const p = new OpenAIProvider({
      ...VALID,
      baseUrl: 'https://proxy.example.com/v1',
      fetchFn: capturingFetch(200, apiSuccess('ok'), captured),
    });
    await p.chat(BASIC_REQUEST);
    expect(captured[0].url).toContain('proxy.example.com');
  });

  it('CR-03: Authorization header contains Bearer token', async () => {
    const captured: Capture[] = [];
    const p = new OpenAIProvider({
      ...VALID,
      apiKey:  'sk-abc-123',
      fetchFn: capturingFetch(200, apiSuccess('ok'), captured),
    });
    await p.chat(BASIC_REQUEST);
    const headers = captured[0].init.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer sk-abc-123');
  });

  it('CR-04: Content-Type header is application/json', async () => {
    const captured: Capture[] = [];
    const p = new OpenAIProvider({
      ...VALID,
      fetchFn: capturingFetch(200, apiSuccess('ok'), captured),
    });
    await p.chat(BASIC_REQUEST);
    const headers = captured[0].init.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('CR-05: body includes messages array verbatim', async () => {
    const captured: Capture[] = [];
    const p = new OpenAIProvider({ ...VALID, fetchFn: capturingFetch(200, apiSuccess('ok'), captured) });
    const msgs = [
      { role: 'system'    as const, content: 'Bạn là trợ lý đấu thầu.' },
      { role: 'user'      as const, content: 'Ngưỡng chỉ định thầu là bao nhiêu?' },
    ];
    await p.chat({ messages: msgs });
    const body = JSON.parse(captured[0].init.body as string) as { messages: unknown[] };
    expect(body.messages).toEqual(msgs);
  });

  it('CR-06: body includes config model when no per-request override', async () => {
    const captured: Capture[] = [];
    const p = new OpenAIProvider({
      ...VALID,
      model:   'gpt-4o-mini',
      fetchFn: capturingFetch(200, apiSuccess('ok'), captured),
    });
    await p.chat(BASIC_REQUEST);
    const body = JSON.parse(captured[0].init.body as string) as { model: string };
    expect(body.model).toBe('gpt-4o-mini');
  });

  it('CR-07: body uses default temperature 0.7 when not configured', async () => {
    const captured: Capture[] = [];
    const p = new OpenAIProvider({
      apiKey:  'sk-x',
      model:   'gpt-4o',
      fetchFn: capturingFetch(200, apiSuccess('ok'), captured),
    });
    await p.chat(BASIC_REQUEST);
    const body = JSON.parse(captured[0].init.body as string) as { temperature: number };
    expect(body.temperature).toBe(0.7);
  });

  it('CR-08: body uses default maxTokens 1024 as max_tokens', async () => {
    const captured: Capture[] = [];
    const p = new OpenAIProvider({
      apiKey:  'sk-x',
      model:   'gpt-4o',
      fetchFn: capturingFetch(200, apiSuccess('ok'), captured),
    });
    await p.chat(BASIC_REQUEST);
    const body = JSON.parse(captured[0].init.body as string) as { max_tokens: number };
    expect(body.max_tokens).toBe(1024);
  });

  it('CR-09: configured temperature overrides default', async () => {
    const captured: Capture[] = [];
    const p = new OpenAIProvider({
      ...VALID,
      temperature: 0.2,
      fetchFn:     capturingFetch(200, apiSuccess('ok'), captured),
    });
    await p.chat(BASIC_REQUEST);
    const body = JSON.parse(captured[0].init.body as string) as { temperature: number };
    expect(body.temperature).toBe(0.2);
  });

  it('CR-10: configured maxTokens overrides default and is sent as max_tokens', async () => {
    const captured: Capture[] = [];
    const p = new OpenAIProvider({
      ...VALID,
      maxTokens: 512,
      fetchFn:   capturingFetch(200, apiSuccess('ok'), captured),
    });
    await p.chat(BASIC_REQUEST);
    const body = JSON.parse(captured[0].init.body as string) as { max_tokens: number };
    expect(body.max_tokens).toBe(512);
  });
});
