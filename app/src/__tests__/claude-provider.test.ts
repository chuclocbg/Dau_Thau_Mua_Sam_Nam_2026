/**
 * P6-10B: Unit tests for ClaudeProvider.
 *
 * Groups:
 *   VC — validateConfig()  (11 tests)
 *   MI — getModelInfo()    ( 8 tests)
 *   CH — chat() success    ( 8 tests)
 *   CE — chat() errors     (10 tests)
 *   CR — request payload   (12 tests)
 *
 * Total: 49 tests
 *
 * Rules:
 *   - No real network calls; fetchFn is always injected.
 *   - Tests are pure synchronous assertions after awaiting the Result.
 *   - Helpers mirror openai-provider.test.ts naming conventions.
 */

import { describe, it, expect } from 'vitest';
import {
  ClaudeProvider,
  type ClaudeProviderConfig,
} from '../providers/ClaudeProvider';

// ─── Mock helpers ─────────────────────────────────────────────────────────────

/** Build a well-formed Anthropic Messages API success body. */
function apiSuccess(
  text:       string,
  model      = 'claude-3-5-sonnet-20241022',
  stopReason = 'end_turn',
  inputTokens  = 10,
  outputTokens = 20,
) {
  return {
    id:            'msg_01ABCDEF',
    type:          'message',
    role:          'assistant',
    content:       [{ type: 'text', text }],
    model,
    stop_reason:   stopReason,
    stop_sequence: null,
    usage: {
      input_tokens:  inputTokens,
      output_tokens: outputTokens,
    },
  };
}

/** fetchFn that returns a JSON response with the given status. */
function mockFetch(
  status: number,
  body:   unknown,
): ClaudeProviderConfig['fetchFn'] {
  return async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
}

/** fetchFn that throws (simulates network failure). */
function throwingFetch(error: unknown): ClaudeProviderConfig['fetchFn'] {
  return async () => { throw error; };
}

/** fetchFn that returns invalid JSON. */
function badJsonFetch(): ClaudeProviderConfig['fetchFn'] {
  return async () => new Response('}{not-valid-json', { status: 200 });
}

/** Captures every call so tests can inspect the exact request sent. */
interface Capture { url: string; init: RequestInit; }
function capturingFetch(
  status: number,
  body:   unknown,
  out:    Capture[],
): ClaudeProviderConfig['fetchFn'] {
  return async (url, init) => {
    out.push({ url, init });
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  };
}

/** Minimal valid config shared across most tests. */
function baseConfig(overrides: Partial<ClaudeProviderConfig> = {}): ClaudeProviderConfig {
  return {
    apiKey:  'test-anthropic-key',
    model:   'claude-3-5-sonnet-latest',
    fetchFn: mockFetch(200, apiSuccess('hello')),
    ...overrides,
  };
}

// ─── VC: validateConfig ───────────────────────────────────────────────────────

describe('VC: validateConfig()', () => {
  it('VC-01: empty apiKey returns INVALID_CONFIG', () => {
    const p = new ClaudeProvider(baseConfig({ apiKey: '' }));
    const r = p.validateConfig();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_CONFIG');
  });

  it('VC-02: whitespace-only apiKey returns INVALID_CONFIG', () => {
    const p = new ClaudeProvider(baseConfig({ apiKey: '   ' }));
    const r = p.validateConfig();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_CONFIG');
  });

  it('VC-03: empty model returns INVALID_CONFIG', () => {
    const p = new ClaudeProvider(baseConfig({ model: '' }));
    const r = p.validateConfig();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_CONFIG');
  });

  it('VC-04: whitespace-only model returns INVALID_CONFIG', () => {
    const p = new ClaudeProvider(baseConfig({ model: '   ' }));
    const r = p.validateConfig();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_CONFIG');
  });

  it('VC-05: temperature below 0 returns INVALID_CONFIG', () => {
    const p = new ClaudeProvider(baseConfig({ temperature: -0.1 }));
    const r = p.validateConfig();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_CONFIG');
  });

  it('VC-06: temperature above 1 returns INVALID_CONFIG (Anthropic max is 1.0)', () => {
    const p = new ClaudeProvider(baseConfig({ temperature: 1.1 }));
    const r = p.validateConfig();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_CONFIG');
  });

  it('VC-07: maxTokens = 0 returns INVALID_CONFIG', () => {
    const p = new ClaudeProvider(baseConfig({ maxTokens: 0 }));
    const r = p.validateConfig();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_CONFIG');
  });

  it('VC-08: negative maxTokens returns INVALID_CONFIG', () => {
    const p = new ClaudeProvider(baseConfig({ maxTokens: -1 }));
    const r = p.validateConfig();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_CONFIG');
  });

  it('VC-09: valid minimal config returns ok:true', () => {
    const p = new ClaudeProvider(baseConfig());
    const r = p.validateConfig();
    expect(r.ok).toBe(true);
  });

  it('VC-10: temperature = 0 (lower boundary) is valid', () => {
    const p = new ClaudeProvider(baseConfig({ temperature: 0 }));
    const r = p.validateConfig();
    expect(r.ok).toBe(true);
  });

  it('VC-11: temperature = 1 (upper boundary) is valid', () => {
    const p = new ClaudeProvider(baseConfig({ temperature: 1 }));
    const r = p.validateConfig();
    expect(r.ok).toBe(true);
  });
});

// ─── MI: getModelInfo ─────────────────────────────────────────────────────────

describe('MI: getModelInfo()', () => {
  const p = new ClaudeProvider(baseConfig());

  it('MI-01: claude-3-5-sonnet-latest → 200K context, vision', () => {
    const info = p.getModelInfo('claude-3-5-sonnet-latest');
    expect(info.modelId).toBe('claude-3-5-sonnet-latest');
    expect(info.maxContextTokens).toBe(200_000);
    expect(info.supportsVision).toBe(true);
  });

  it('MI-02: claude-3-7-sonnet-latest → 200K context, vision', () => {
    const info = p.getModelInfo('claude-3-7-sonnet-latest');
    expect(info.modelId).toBe('claude-3-7-sonnet-latest');
    expect(info.maxContextTokens).toBe(200_000);
    expect(info.supportsVision).toBe(true);
  });

  it('MI-03: claude-sonnet-4-20250514 → 200K context, vision', () => {
    const info = p.getModelInfo('claude-sonnet-4-20250514');
    expect(info.modelId).toBe('claude-sonnet-4-20250514');
    expect(info.maxContextTokens).toBe(200_000);
    expect(info.supportsVision).toBe(true);
  });

  it('MI-04: claude-opus-4-20250514 → 200K context, vision', () => {
    const info = p.getModelInfo('claude-opus-4-20250514');
    expect(info.modelId).toBe('claude-opus-4-20250514');
    expect(info.maxContextTokens).toBe(200_000);
    expect(info.supportsVision).toBe(true);
  });

  it('MI-05: claude-haiku-3-5-latest → 200K context, vision', () => {
    const info = p.getModelInfo('claude-haiku-3-5-latest');
    expect(info.modelId).toBe('claude-haiku-3-5-latest');
    expect(info.maxContextTokens).toBe(200_000);
    expect(info.supportsVision).toBe(true);
  });

  it('MI-06: unknown model falls back, preserves modelId', () => {
    const info = p.getModelInfo('claude-unknown-xyz');
    expect(info.modelId).toBe('claude-unknown-xyz');
    expect(info.description).toContain('claude-unknown-xyz');
  });

  it('MI-07: override param takes precedence over config model', () => {
    const p2 = new ClaudeProvider(baseConfig({ model: 'claude-haiku-3-5-latest' }));
    const info = p2.getModelInfo('claude-opus-4-20250514');
    expect(info.modelId).toBe('claude-opus-4-20250514');
  });

  it('MI-08: all 5 known models have non-empty description', () => {
    const knownModels = [
      'claude-3-5-sonnet-latest',
      'claude-3-7-sonnet-latest',
      'claude-sonnet-4-20250514',
      'claude-opus-4-20250514',
      'claude-haiku-3-5-latest',
    ];
    for (const modelId of knownModels) {
      expect(p.getModelInfo(modelId).description.length).toBeGreaterThan(0);
    }
  });
});

// ─── CH: chat() success ───────────────────────────────────────────────────────

describe('CH: chat() success paths', () => {
  const msgs = [{ role: 'user' as const, content: 'Xin chào' }];

  it('CH-01: returns ok:true on 200', async () => {
    const p = new ClaudeProvider(baseConfig());
    const r = await p.chat({ messages: msgs });
    expect(r.ok).toBe(true);
  });

  it('CH-02: content extracted from content[0].text', async () => {
    const p = new ClaudeProvider(
      baseConfig({ fetchFn: mockFetch(200, apiSuccess('Kết quả đấu thầu')) }),
    );
    const r = await p.chat({ messages: msgs });
    if (!r.ok) throw new Error('expected ok');
    expect(r.value.content).toBe('Kết quả đấu thầu');
  });

  it('CH-03: model is taken from response body', async () => {
    const p = new ClaudeProvider(
      baseConfig({ fetchFn: mockFetch(200, apiSuccess('x', 'claude-sonnet-4-20250514')) }),
    );
    const r = await p.chat({ messages: msgs });
    if (!r.ok) throw new Error('expected ok');
    expect(r.value.model).toBe('claude-sonnet-4-20250514');
  });

  it('CH-04: usage.inputTokens maps from input_tokens', async () => {
    const p = new ClaudeProvider(
      baseConfig({ fetchFn: mockFetch(200, apiSuccess('x', 'c', 'end_turn', 42, 7)) }),
    );
    const r = await p.chat({ messages: msgs });
    if (!r.ok) throw new Error('expected ok');
    expect(r.value.usage.inputTokens).toBe(42);
  });

  it('CH-05: usage.outputTokens maps from output_tokens', async () => {
    const p = new ClaudeProvider(
      baseConfig({ fetchFn: mockFetch(200, apiSuccess('x', 'c', 'end_turn', 42, 7)) }),
    );
    const r = await p.chat({ messages: msgs });
    if (!r.ok) throw new Error('expected ok');
    expect(r.value.usage.outputTokens).toBe(7);
  });

  it('CH-06: usage.totalTokens = inputTokens + outputTokens', async () => {
    const p = new ClaudeProvider(
      baseConfig({ fetchFn: mockFetch(200, apiSuccess('x', 'c', 'end_turn', 42, 7)) }),
    );
    const r = await p.chat({ messages: msgs });
    if (!r.ok) throw new Error('expected ok');
    expect(r.value.usage.totalTokens).toBe(49);
  });

  it('CH-07: stopReason maps from stop_reason field', async () => {
    const p = new ClaudeProvider(
      baseConfig({ fetchFn: mockFetch(200, apiSuccess('x', 'c', 'max_tokens')) }),
    );
    const r = await p.chat({ messages: msgs });
    if (!r.ok) throw new Error('expected ok');
    expect(r.value.stopReason).toBe('max_tokens');
  });

  it('CH-08: per-request model override is sent', async () => {
    const captures: Capture[] = [];
    const p = new ClaudeProvider(
      baseConfig({
        model:    'claude-haiku-3-5-latest',
        fetchFn:  capturingFetch(200, apiSuccess('x'), captures),
      }),
    );
    await p.chat({ messages: msgs, model: 'claude-opus-4-20250514' });
    const body = JSON.parse(captures[0]!.init.body as string);
    expect(body.model).toBe('claude-opus-4-20250514');
  });
});

// ─── CE: chat() error paths ───────────────────────────────────────────────────

describe('CE: chat() error paths', () => {
  const msgs = [{ role: 'user' as const, content: 'test' }];

  it('CE-01: invalid config short-circuits before fetch', async () => {
    let called = false;
    const p = new ClaudeProvider(
      baseConfig({
        apiKey:  '',
        fetchFn: async () => { called = true; return new Response('{}', { status: 200 }); },
      }),
    );
    const r = await p.chat({ messages: msgs });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_CONFIG');
    expect(called).toBe(false);
  });

  it('CE-02: network error returns NETWORK_ERROR with cause', async () => {
    const netErr = new TypeError('Failed to fetch');
    const p = new ClaudeProvider(baseConfig({ fetchFn: throwingFetch(netErr) }));
    const r = await p.chat({ messages: msgs });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe('NETWORK_ERROR');
      expect(r.error.cause).toBe(netErr);
    }
  });

  it('CE-03: HTTP 401 returns UNAUTHORIZED with status', async () => {
    const p = new ClaudeProvider(baseConfig({ fetchFn: mockFetch(401, {}) }));
    const r = await p.chat({ messages: msgs });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe('UNAUTHORIZED');
      expect(r.error.status).toBe(401);
    }
  });

  it('CE-04: HTTP 429 returns RATE_LIMITED with status', async () => {
    const p = new ClaudeProvider(baseConfig({ fetchFn: mockFetch(429, {}) }));
    const r = await p.chat({ messages: msgs });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe('RATE_LIMITED');
      expect(r.error.status).toBe(429);
    }
  });

  it('CE-05: HTTP 500 returns API_ERROR with status 500', async () => {
    const p = new ClaudeProvider(baseConfig({ fetchFn: mockFetch(500, { error: 'server error' }) }));
    const r = await p.chat({ messages: msgs });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe('API_ERROR');
      expect(r.error.status).toBe(500);
    }
  });

  it('CE-06: HTTP 404 returns API_ERROR with status 404', async () => {
    const p = new ClaudeProvider(baseConfig({ fetchFn: mockFetch(404, { error: 'not found' }) }));
    const r = await p.chat({ messages: msgs });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe('API_ERROR');
      expect(r.error.status).toBe(404);
    }
  });

  it('CE-07: malformed JSON returns PARSE_ERROR', async () => {
    const p = new ClaudeProvider(baseConfig({ fetchFn: badJsonFetch() }));
    const r = await p.chat({ messages: msgs });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('PARSE_ERROR');
  });

  it('CE-08: empty content array returns PARSE_ERROR', async () => {
    const bodyNoContent = {
      id: 'x', type: 'message', role: 'assistant',
      content: [],
      model: 'claude-3-5-sonnet-latest',
      stop_reason: 'end_turn', stop_sequence: null,
      usage: { input_tokens: 1, output_tokens: 1 },
    };
    const p = new ClaudeProvider(baseConfig({ fetchFn: mockFetch(200, bodyNoContent) }));
    const r = await p.chat({ messages: msgs });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('PARSE_ERROR');
  });

  it('CE-09: content block with non-text type returns PARSE_ERROR', async () => {
    const bodyToolUse = {
      id: 'x', type: 'message', role: 'assistant',
      content: [{ type: 'tool_use', id: 'tu_01', name: 'web_search', input: {} }],
      model: 'claude-3-5-sonnet-latest',
      stop_reason: 'tool_use', stop_sequence: null,
      usage: { input_tokens: 1, output_tokens: 1 },
    };
    const p = new ClaudeProvider(baseConfig({ fetchFn: mockFetch(200, bodyToolUse) }));
    const r = await p.chat({ messages: msgs });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('PARSE_ERROR');
  });

  it('CE-10: chat() never throws regardless of error type', async () => {
    const cases: ClaudeProviderConfig['fetchFn'][] = [
      throwingFetch(new Error('boom')),
      throwingFetch('string error'),
      throwingFetch(null),
      throwingFetch(undefined),
      badJsonFetch(),
      mockFetch(401, {}),
      mockFetch(500, {}),
    ];
    for (const fetchFn of cases) {
      const p = new ClaudeProvider(baseConfig({ fetchFn }));
      // Must not throw
      const r = await p.chat({ messages: msgs });
      expect(r.ok).toBe(false);
    }
  });
});

// ─── CR: request payload ──────────────────────────────────────────────────────

describe('CR: request payload to Anthropic Messages API', () => {
  const msgs = [{ role: 'user' as const, content: 'Tư vấn đấu thầu' }];

  async function capture(overrides: Partial<ClaudeProviderConfig> = {}, req: Parameters<ClaudeProvider['chat']>[0] = { messages: msgs }): Promise<Capture> {
    const captured: Capture[] = [];
    const p = new ClaudeProvider({
      apiKey:  'sk-ant-test',
      model:   'claude-3-5-sonnet-latest',
      fetchFn: capturingFetch(200, apiSuccess('ok'), captured),
      ...overrides,
    });
    await p.chat(req);
    return captured[0]!;
  }

  it('CR-01: POST to /messages endpoint', async () => {
    const c = await capture();
    expect(c.url).toMatch(/\/messages$/);
    expect((c.init.method ?? '').toUpperCase()).toBe('POST');
  });

  it('CR-02: x-api-key header carries the API key', async () => {
    const c = await capture({ apiKey: 'sk-ant-abc123' });
    const headers = c.init.headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('sk-ant-abc123');
  });

  it('CR-03: anthropic-version header is present', async () => {
    const c = await capture();
    const headers = c.init.headers as Record<string, string>;
    expect(headers['anthropic-version']).toBeTruthy();
  });

  it('CR-04: Content-Type is application/json', async () => {
    const c = await capture();
    const headers = c.init.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('CR-05: request body contains messages array', async () => {
    const c = await capture();
    const body = JSON.parse(c.init.body as string);
    expect(Array.isArray(body.messages)).toBe(true);
    expect(body.messages[0].role).toBe('user');
    expect(body.messages[0].content).toBe('Tư vấn đấu thầu');
  });

  it('CR-06: request body contains model field', async () => {
    const c = await capture({ model: 'claude-opus-4-20250514' });
    const body = JSON.parse(c.init.body as string);
    expect(body.model).toBe('claude-opus-4-20250514');
  });

  it('CR-07: request body contains max_tokens field', async () => {
    const c = await capture({ maxTokens: 512 });
    const body = JSON.parse(c.init.body as string);
    expect(body.max_tokens).toBe(512);
  });

  it('CR-08: request body contains temperature field', async () => {
    const c = await capture({ temperature: 0.3 });
    const body = JSON.parse(c.init.body as string);
    expect(body.temperature).toBe(0.3);
  });

  it('CR-09: system field included in body when provided', async () => {
    const c = await capture({}, { messages: msgs, system: 'Bạn là chuyên gia đấu thầu.' });
    const body = JSON.parse(c.init.body as string);
    expect(body.system).toBe('Bạn là chuyên gia đấu thầu.');
  });

  it('CR-10: system field omitted when not provided', async () => {
    const c = await capture({}, { messages: msgs });
    const body = JSON.parse(c.init.body as string);
    expect(Object.prototype.hasOwnProperty.call(body, 'system')).toBe(false);
  });

  it('CR-11: per-request temperature override applied in body', async () => {
    const c = await capture({ temperature: 1.0 }, { messages: msgs, temperature: 0.1 });
    const body = JSON.parse(c.init.body as string);
    expect(body.temperature).toBe(0.1);
  });

  it('CR-12: per-request maxTokens override applied in body', async () => {
    const c = await capture({ maxTokens: 1024 }, { messages: msgs, maxTokens: 256 });
    const body = JSON.parse(c.init.body as string);
    expect(body.max_tokens).toBe(256);
  });
});
