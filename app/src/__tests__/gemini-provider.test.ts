/**
 * P6-10C: Unit tests for GeminiProvider.
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
 *   - Gemini auth uses ?key= query param, not an auth header.
 *   - Gemini roles: 'user'→'user', 'assistant'→'model'.
 *   - System instruction maps to body.systemInstruction.parts[0].text.
 *   - Temperature range 0.0–2.0 (wider than Anthropic's 0–1).
 */

import { describe, it, expect } from 'vitest';
import {
  GeminiProvider,
  type GeminiProviderConfig,
} from '../providers/GeminiProvider';

// ─── Mock helpers ─────────────────────────────────────────────────────────────

/** Build a well-formed Gemini generateContent success response. */
function apiSuccess(
  text:            string,
  finishReason    = 'STOP',
  modelVersion    = 'gemini-2.5-flash',
  promptTokens    = 10,
  candidateTokens = 20,
) {
  return {
    candidates: [
      {
        content:      { parts: [{ text }], role: 'model' },
        finishReason,
        index:        0,
      },
    ],
    usageMetadata: {
      promptTokenCount:     promptTokens,
      candidatesTokenCount: candidateTokens,
      totalTokenCount:      promptTokens + candidateTokens,
    },
    modelVersion,
  };
}

/** fetchFn that returns a JSON response with the given status. */
function mockFetch(
  status: number,
  body:   unknown,
): GeminiProviderConfig['fetchFn'] {
  return async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
}

/** fetchFn that throws (simulates network failure). */
function throwingFetch(error: unknown): GeminiProviderConfig['fetchFn'] {
  return async () => { throw error; };
}

/** fetchFn that returns invalid JSON. */
function badJsonFetch(): GeminiProviderConfig['fetchFn'] {
  return async () => new Response('}{not-valid-json', { status: 200 });
}

/** Captures every call so tests can inspect the exact request sent. */
interface Capture { url: string; init: RequestInit; }
function capturingFetch(
  status: number,
  body:   unknown,
  out:    Capture[],
): GeminiProviderConfig['fetchFn'] {
  return async (url, init) => {
    out.push({ url, init });
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  };
}

/** Minimal valid config shared across most tests. */
function baseConfig(overrides: Partial<GeminiProviderConfig> = {}): GeminiProviderConfig {
  return {
    apiKey:  'test-gemini-key',
    model:   'gemini-2.5-flash',
    fetchFn: mockFetch(200, apiSuccess('xin chào')),
    ...overrides,
  };
}

// ─── VC: validateConfig ───────────────────────────────────────────────────────

describe('VC: validateConfig()', () => {
  it('VC-01: empty apiKey returns INVALID_CONFIG', () => {
    const p = new GeminiProvider(baseConfig({ apiKey: '' }));
    const r = p.validateConfig();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_CONFIG');
  });

  it('VC-02: whitespace-only apiKey returns INVALID_CONFIG', () => {
    const p = new GeminiProvider(baseConfig({ apiKey: '   ' }));
    const r = p.validateConfig();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_CONFIG');
  });

  it('VC-03: empty model returns INVALID_CONFIG', () => {
    const p = new GeminiProvider(baseConfig({ model: '' }));
    const r = p.validateConfig();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_CONFIG');
  });

  it('VC-04: whitespace-only model returns INVALID_CONFIG', () => {
    const p = new GeminiProvider(baseConfig({ model: '   ' }));
    const r = p.validateConfig();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_CONFIG');
  });

  it('VC-05: temperature below 0 returns INVALID_CONFIG', () => {
    const p = new GeminiProvider(baseConfig({ temperature: -0.1 }));
    const r = p.validateConfig();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_CONFIG');
  });

  it('VC-06: temperature above 2 returns INVALID_CONFIG', () => {
    const p = new GeminiProvider(baseConfig({ temperature: 2.1 }));
    const r = p.validateConfig();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_CONFIG');
  });

  it('VC-07: maxTokens = 0 returns INVALID_CONFIG', () => {
    const p = new GeminiProvider(baseConfig({ maxTokens: 0 }));
    const r = p.validateConfig();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_CONFIG');
  });

  it('VC-08: negative maxTokens returns INVALID_CONFIG', () => {
    const p = new GeminiProvider(baseConfig({ maxTokens: -1 }));
    const r = p.validateConfig();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_CONFIG');
  });

  it('VC-09: valid minimal config returns ok:true', () => {
    const p = new GeminiProvider(baseConfig());
    const r = p.validateConfig();
    expect(r.ok).toBe(true);
  });

  it('VC-10: temperature = 0 (lower boundary) is valid', () => {
    const p = new GeminiProvider(baseConfig({ temperature: 0 }));
    const r = p.validateConfig();
    expect(r.ok).toBe(true);
  });

  it('VC-11: temperature = 2 (upper boundary) is valid', () => {
    const p = new GeminiProvider(baseConfig({ temperature: 2 }));
    const r = p.validateConfig();
    expect(r.ok).toBe(true);
  });
});

// ─── MI: getModelInfo ─────────────────────────────────────────────────────────

describe('MI: getModelInfo()', () => {
  const p = new GeminiProvider(baseConfig());

  it('MI-01: gemini-2.5-pro → 2M context, vision', () => {
    const info = p.getModelInfo('gemini-2.5-pro');
    expect(info.modelId).toBe('gemini-2.5-pro');
    expect(info.maxContextTokens).toBe(2_000_000);
    expect(info.supportsVision).toBe(true);
  });

  it('MI-02: gemini-2.5-flash → 1M context, vision', () => {
    const info = p.getModelInfo('gemini-2.5-flash');
    expect(info.modelId).toBe('gemini-2.5-flash');
    expect(info.maxContextTokens).toBe(1_000_000);
    expect(info.supportsVision).toBe(true);
  });

  it('MI-03: gemini-2.5-flash-lite → 1M context, vision', () => {
    const info = p.getModelInfo('gemini-2.5-flash-lite');
    expect(info.modelId).toBe('gemini-2.5-flash-lite');
    expect(info.maxContextTokens).toBe(1_000_000);
    expect(info.supportsVision).toBe(true);
  });

  it('MI-04: gemini-1.5-pro → 2M context, vision', () => {
    const info = p.getModelInfo('gemini-1.5-pro');
    expect(info.modelId).toBe('gemini-1.5-pro');
    expect(info.maxContextTokens).toBe(2_000_000);
    expect(info.supportsVision).toBe(true);
  });

  it('MI-05: gemini-1.5-flash → 1M context, vision', () => {
    const info = p.getModelInfo('gemini-1.5-flash');
    expect(info.modelId).toBe('gemini-1.5-flash');
    expect(info.maxContextTokens).toBe(1_000_000);
    expect(info.supportsVision).toBe(true);
  });

  it('MI-06: unknown model falls back, preserves modelId', () => {
    const info = p.getModelInfo('gemini-unknown-xyz');
    expect(info.modelId).toBe('gemini-unknown-xyz');
    expect(info.description).toContain('gemini-unknown-xyz');
  });

  it('MI-07: override param takes precedence over config model', () => {
    const p2 = new GeminiProvider(baseConfig({ model: 'gemini-1.5-flash' }));
    const info = p2.getModelInfo('gemini-2.5-pro');
    expect(info.modelId).toBe('gemini-2.5-pro');
    expect(info.maxContextTokens).toBe(2_000_000);
  });

  it('MI-08: all 5 known models have non-empty description', () => {
    const known = [
      'gemini-2.5-pro',
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite',
      'gemini-1.5-pro',
      'gemini-1.5-flash',
    ];
    for (const modelId of known) {
      expect(p.getModelInfo(modelId).description.length).toBeGreaterThan(0);
    }
  });
});

// ─── CH: chat() success ───────────────────────────────────────────────────────

describe('CH: chat() success paths', () => {
  const msgs = [{ role: 'user' as const, content: 'Tóm tắt quy trình đấu thầu' }];

  it('CH-01: returns ok:true on 200', async () => {
    const p = new GeminiProvider(baseConfig());
    const r = await p.chat({ messages: msgs });
    expect(r.ok).toBe(true);
  });

  it('CH-02: content extracted from candidates[0].content.parts[0].text', async () => {
    const p = new GeminiProvider(
      baseConfig({ fetchFn: mockFetch(200, apiSuccess('Kết quả mua sắm')) }),
    );
    const r = await p.chat({ messages: msgs });
    if (!r.ok) throw new Error('expected ok');
    expect(r.value.content).toBe('Kết quả mua sắm');
  });

  it('CH-03: finishReason from candidates[0].finishReason', async () => {
    const p = new GeminiProvider(
      baseConfig({ fetchFn: mockFetch(200, apiSuccess('x', 'MAX_TOKENS')) }),
    );
    const r = await p.chat({ messages: msgs });
    if (!r.ok) throw new Error('expected ok');
    expect(r.value.finishReason).toBe('MAX_TOKENS');
  });

  it('CH-04: usage.promptTokens from usageMetadata.promptTokenCount', async () => {
    const p = new GeminiProvider(
      baseConfig({ fetchFn: mockFetch(200, apiSuccess('x', 'STOP', 'm', 42, 7)) }),
    );
    const r = await p.chat({ messages: msgs });
    if (!r.ok) throw new Error('expected ok');
    expect(r.value.usage.promptTokens).toBe(42);
  });

  it('CH-05: usage.candidateTokens from usageMetadata.candidatesTokenCount', async () => {
    const p = new GeminiProvider(
      baseConfig({ fetchFn: mockFetch(200, apiSuccess('x', 'STOP', 'm', 42, 7)) }),
    );
    const r = await p.chat({ messages: msgs });
    if (!r.ok) throw new Error('expected ok');
    expect(r.value.usage.candidateTokens).toBe(7);
  });

  it('CH-06: usage.totalTokens from usageMetadata.totalTokenCount', async () => {
    const p = new GeminiProvider(
      baseConfig({ fetchFn: mockFetch(200, apiSuccess('x', 'STOP', 'm', 42, 7)) }),
    );
    const r = await p.chat({ messages: msgs });
    if (!r.ok) throw new Error('expected ok');
    expect(r.value.usage.totalTokens).toBe(49);
  });

  it('CH-07: per-request model override appears in URL', async () => {
    const captures: Capture[] = [];
    const p = new GeminiProvider(
      baseConfig({
        model:   'gemini-1.5-flash',
        fetchFn: capturingFetch(200, apiSuccess('x'), captures),
      }),
    );
    await p.chat({ messages: msgs, model: 'gemini-2.5-pro' });
    expect(captures[0]!.url).toContain('gemini-2.5-pro');
  });

  it('CH-08: model from response modelVersion field', async () => {
    const p = new GeminiProvider(
      baseConfig({
        fetchFn: mockFetch(200, apiSuccess('x', 'STOP', 'gemini-2.5-pro-exp')),
      }),
    );
    const r = await p.chat({ messages: msgs });
    if (!r.ok) throw new Error('expected ok');
    expect(r.value.model).toBe('gemini-2.5-pro-exp');
  });
});

// ─── CE: chat() error paths ───────────────────────────────────────────────────

describe('CE: chat() error paths', () => {
  const msgs = [{ role: 'user' as const, content: 'test' }];

  it('CE-01: invalid config short-circuits before fetch', async () => {
    let called = false;
    const p = new GeminiProvider(
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
    const p = new GeminiProvider(baseConfig({ fetchFn: throwingFetch(netErr) }));
    const r = await p.chat({ messages: msgs });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe('NETWORK_ERROR');
      expect(r.error.cause).toBe(netErr);
    }
  });

  it('CE-03: HTTP 401 returns UNAUTHORIZED with status', async () => {
    const p = new GeminiProvider(baseConfig({ fetchFn: mockFetch(401, {}) }));
    const r = await p.chat({ messages: msgs });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe('UNAUTHORIZED');
      expect(r.error.status).toBe(401);
    }
  });

  it('CE-04: HTTP 429 returns RATE_LIMITED with status', async () => {
    const p = new GeminiProvider(baseConfig({ fetchFn: mockFetch(429, {}) }));
    const r = await p.chat({ messages: msgs });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe('RATE_LIMITED');
      expect(r.error.status).toBe(429);
    }
  });

  it('CE-05: HTTP 500 returns API_ERROR with status 500', async () => {
    const p = new GeminiProvider(baseConfig({ fetchFn: mockFetch(500, { error: 'internal' }) }));
    const r = await p.chat({ messages: msgs });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe('API_ERROR');
      expect(r.error.status).toBe(500);
    }
  });

  it('CE-06: HTTP 403 (permission denied) returns UNAUTHORIZED', async () => {
    const p = new GeminiProvider(baseConfig({ fetchFn: mockFetch(403, { error: 'forbidden' }) }));
    const r = await p.chat({ messages: msgs });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe('UNAUTHORIZED');
      expect(r.error.status).toBe(403);
    }
  });

  it('CE-07: malformed JSON returns PARSE_ERROR', async () => {
    const p = new GeminiProvider(baseConfig({ fetchFn: badJsonFetch() }));
    const r = await p.chat({ messages: msgs });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('PARSE_ERROR');
  });

  it('CE-08: empty candidates array returns PARSE_ERROR', async () => {
    const body = {
      candidates:    [],
      usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1, totalTokenCount: 2 },
    };
    const p = new GeminiProvider(baseConfig({ fetchFn: mockFetch(200, body) }));
    const r = await p.chat({ messages: msgs });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('PARSE_ERROR');
  });

  it('CE-09: candidate with empty parts returns PARSE_ERROR', async () => {
    const body = {
      candidates: [{ content: { parts: [], role: 'model' }, finishReason: 'STOP', index: 0 }],
      usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 0, totalTokenCount: 1 },
    };
    const p = new GeminiProvider(baseConfig({ fetchFn: mockFetch(200, body) }));
    const r = await p.chat({ messages: msgs });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('PARSE_ERROR');
  });

  it('CE-10: chat() never throws regardless of error type', async () => {
    const cases: GeminiProviderConfig['fetchFn'][] = [
      throwingFetch(new Error('boom')),
      throwingFetch('string error'),
      throwingFetch(null),
      throwingFetch(undefined),
      badJsonFetch(),
      mockFetch(401, {}),
      mockFetch(500, {}),
    ];
    for (const fetchFn of cases) {
      const p = new GeminiProvider(baseConfig({ fetchFn }));
      const r = await p.chat({ messages: msgs });
      expect(r.ok).toBe(false);
    }
  });
});

// ─── CR: request payload ──────────────────────────────────────────────────────

describe('CR: request payload to Gemini generateContent API', () => {
  const msgs = [
    { role: 'user'      as const, content: 'Hỏi về đấu thầu' },
    { role: 'assistant' as const, content: 'Tôi có thể giúp bạn.' },
    { role: 'user'      as const, content: 'Cụ thể hơn?' },
  ];

  async function capture(
    overrides: Partial<GeminiProviderConfig> = {},
    req:       Parameters<GeminiProvider['chat']>[0] = { messages: msgs },
  ): Promise<Capture> {
    const captured: Capture[] = [];
    const p = new GeminiProvider({
      apiKey:  'goog-test-key',
      model:   'gemini-2.5-flash',
      fetchFn: capturingFetch(200, apiSuccess('ok'), captured),
      ...overrides,
    });
    await p.chat(req);
    return captured[0]!;
  }

  it('CR-01: method is POST', async () => {
    const c = await capture();
    expect((c.init.method ?? '').toUpperCase()).toBe('POST');
  });

  it('CR-02: URL embeds model in path', async () => {
    const c = await capture({ model: 'gemini-2.5-pro' });
    expect(c.url).toContain('models/gemini-2.5-pro:generateContent');
  });

  it('CR-03: URL carries apiKey as query param', async () => {
    const c = await capture({ apiKey: 'goog-abc-secret' });
    expect(c.url).toContain('key=goog-abc-secret');
  });

  it('CR-04: Content-Type header is application/json', async () => {
    const c = await capture();
    const headers = c.init.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('CR-05: body.contents maps all messages', async () => {
    const c = await capture();
    const body = JSON.parse(c.init.body as string);
    expect(body.contents).toHaveLength(3);
  });

  it('CR-06: assistant role is mapped to "model" in contents', async () => {
    const c = await capture();
    const body = JSON.parse(c.init.body as string);
    const assistantEntry = body.contents[1];   // second message was assistant
    expect(assistantEntry.role).toBe('model');
  });

  it('CR-07: body.generationConfig.temperature present', async () => {
    const c = await capture({ temperature: 0.4 });
    const body = JSON.parse(c.init.body as string);
    expect(body.generationConfig.temperature).toBe(0.4);
  });

  it('CR-08: body.generationConfig.maxOutputTokens present', async () => {
    const c = await capture({ maxTokens: 512 });
    const body = JSON.parse(c.init.body as string);
    expect(body.generationConfig.maxOutputTokens).toBe(512);
  });

  it('CR-09: systemInstruction included when system provided', async () => {
    const c = await capture(
      {},
      { messages: msgs, system: 'Bạn là chuyên gia mua sắm công.' },
    );
    const body = JSON.parse(c.init.body as string);
    expect(body.systemInstruction).toBeDefined();
    expect(body.systemInstruction.parts[0].text).toBe('Bạn là chuyên gia mua sắm công.');
  });

  it('CR-10: systemInstruction omitted when system not provided', async () => {
    const c = await capture({}, { messages: msgs });
    const body = JSON.parse(c.init.body as string);
    expect(Object.prototype.hasOwnProperty.call(body, 'systemInstruction')).toBe(false);
  });

  it('CR-11: per-request temperature override applied in generationConfig', async () => {
    const c = await capture({ temperature: 1.0 }, { messages: msgs, temperature: 0.2 });
    const body = JSON.parse(c.init.body as string);
    expect(body.generationConfig.temperature).toBe(0.2);
  });

  it('CR-12: per-request maxTokens override applied in generationConfig', async () => {
    const c = await capture({ maxTokens: 1024 }, { messages: msgs, maxTokens: 256 });
    const body = JSON.parse(c.init.body as string);
    expect(body.generationConfig.maxOutputTokens).toBe(256);
  });
});
