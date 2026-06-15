/**
 * P6-10E: End-to-end multi-provider integration tests.
 *
 * Uses all four provider modules together with mocked fetchFn — no real
 * network calls.  Tests verify the full path from ProviderRegistry → concrete
 * provider → request construction → response mapping → typed result.
 *
 * Groups:
 *   E1 — Registry setup with all three providers   ( 6 tests)
 *   E2 — Chat success + full response mapping       ( 6 tests)
 *   E3 — Per-request overrides (3 providers × 3)   ( 9 tests)
 *   E4 — Error codes (3 providers × 4 errors)      (12 tests)
 *   E5 — Parse error paths                         ( 8 tests)
 *   E6 — Registry lifecycle                        ( 5 tests)
 *   E7 — Concurrent requests and provider isolation (10 tests)
 *
 * Total: 56 tests
 */

import { describe, it, expect } from 'vitest';
import { OpenAIProvider,  type OpenAIProviderConfig  } from '../providers/OpenAIProvider';
import { ClaudeProvider,  type ClaudeProviderConfig  } from '../providers/ClaudeProvider';
import { GeminiProvider,  type GeminiProviderConfig  } from '../providers/GeminiProvider';
import { ProviderRegistry, type ProviderEntry        } from '../providers/ProviderRegistry';

// ─── Shared mock response builders ───────────────────────────────────────────

function openaiOk(text: string, model = 'gpt-4o') {
  return {
    id: 'chatcmpl-test', model,
    choices: [{ index: 0, message: { role: 'assistant', content: text }, finish_reason: 'stop' }],
    usage:   { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
  };
}

function claudeOk(text: string, model = 'claude-3-5-sonnet-20241022') {
  return {
    id: 'msg_test', type: 'message', role: 'assistant',
    content: [{ type: 'text', text }],
    model, stop_reason: 'end_turn', stop_sequence: null,
    usage: { input_tokens: 15, output_tokens: 25 },
  };
}

function geminiOk(text: string, finishReason = 'STOP', modelVersion = 'gemini-2.5-flash') {
  return {
    candidates: [{ content: { parts: [{ text }], role: 'model' }, finishReason, index: 0 }],
    usageMetadata: { promptTokenCount: 8, candidatesTokenCount: 12, totalTokenCount: 20 },
    modelVersion,
  };
}

/** fetchFn returning a JSON body at given status. */
function mockFetch(status: number, body: unknown) {
  return async (): Promise<Response> =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
}

/** fetchFn that throws a network-level error. */
function throwingFetch(err: unknown) {
  return async (): Promise<Response> => { throw err; };
}

/** fetchFn returning malformed JSON. */
function badJsonFetch() {
  return async (): Promise<Response> => new Response('}{bad', { status: 200 });
}

/** Captures the URL and RequestInit for inspection. */
interface Capture { url: string; init: RequestInit; }
function capturingFetch(body: unknown, out: Capture[]) {
  return async (url: string, init: RequestInit): Promise<Response> => {
    out.push({ url, init });
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
}

// ─── Provider factories ───────────────────────────────────────────────────────

function openai(overrides: Partial<OpenAIProviderConfig> = {}): OpenAIProvider {
  return new OpenAIProvider({
    apiKey: 'sk-openai-test', model: 'gpt-4o',
    fetchFn: mockFetch(200, openaiOk('ok')),
    ...overrides,
  });
}

function claude(overrides: Partial<ClaudeProviderConfig> = {}): ClaudeProvider {
  return new ClaudeProvider({
    apiKey: 'sk-ant-test', model: 'claude-3-5-sonnet-latest',
    fetchFn: mockFetch(200, claudeOk('ok')),
    ...overrides,
  });
}

function gemini(overrides: Partial<GeminiProviderConfig> = {}): GeminiProvider {
  return new GeminiProvider({
    apiKey: 'goog-test', model: 'gemini-2.5-flash',
    fetchFn: mockFetch(200, geminiOk('ok')),
    ...overrides,
  });
}

/** A fresh registry with all three real providers registered. */
function fullRegistry(
  openaiOverrides: Partial<OpenAIProviderConfig> = {},
  claudeOverrides: Partial<ClaudeProviderConfig> = {},
  geminiOverrides: Partial<GeminiProviderConfig> = {},
): ProviderRegistry {
  const r = new ProviderRegistry();
  r.register({ id: 'openai', type: 'openai',    name: 'OpenAI GPT-4o',     provider: openai(openaiOverrides) });
  r.register({ id: 'claude', type: 'anthropic',  name: 'Anthropic Claude',  provider: claude(claudeOverrides) });
  r.register({ id: 'gemini', type: 'google',     name: 'Google Gemini',     provider: gemini(geminiOverrides) });
  return r;
}

const USER_MSG_OAI  = [{ role: 'user' as const, content: 'Xin chào từ OpenAI'  }];
const USER_MSG_CLA  = [{ role: 'user' as const, content: 'Xin chào từ Claude'  }];
const USER_MSG_GEM  = [{ role: 'user' as const, content: 'Xin chào từ Gemini'  }];

// ─────────────────────────────────────────────────────────────────────────────
// E1: Registry setup
// ─────────────────────────────────────────────────────────────────────────────

describe('E1: registry setup with all three providers', () => {
  it('E1-01: register all three providers; list() returns 3 entries', () => {
    const r = fullRegistry();
    expect(r.list()).toHaveLength(3);
  });

  it('E1-02: all three ids are present via has()', () => {
    const r = fullRegistry();
    expect(r.has('openai')).toBe(true);
    expect(r.has('claude')).toBe(true);
    expect(r.has('gemini')).toBe(true);
  });

  it('E1-03: list() entries carry correct type metadata', () => {
    const r = fullRegistry();
    const types = r.list().map(e => e.type).sort();
    expect(types).toEqual(['anthropic', 'google', 'openai']);
  });

  it('E1-04: setDefault("claude"); getDefault() returns the Claude entry', () => {
    const r = fullRegistry();
    r.setDefault('claude');
    const d = r.getDefault();
    expect(d.ok && d.value.id).toBe('claude');
  });

  it('E1-05: getDefault() returns the actual provider instance', () => {
    const r = new ProviderRegistry();
    const instance = claude();
    r.register({ id: 'claude', type: 'anthropic', name: 'Claude', provider: instance });
    r.setDefault('claude');
    const d = r.getDefault();
    expect(d.ok && d.value.provider).toBe(instance);
  });

  it('E1-06: get() returns the exact registered provider for each id', () => {
    const oai = openai();
    const cla = claude();
    const gem = gemini();
    const r = new ProviderRegistry();
    r.register({ id: 'openai', type: 'openai',    name: 'OpenAI', provider: oai });
    r.register({ id: 'claude', type: 'anthropic',  name: 'Claude', provider: cla });
    r.register({ id: 'gemini', type: 'google',     name: 'Gemini', provider: gem });
    expect(r.get('openai').ok && (r.get('openai') as { ok: true; value: ProviderEntry }).value.provider).toBe(oai);
    expect(r.get('claude').ok && (r.get('claude') as { ok: true; value: ProviderEntry }).value.provider).toBe(cla);
    expect(r.get('gemini').ok && (r.get('gemini') as { ok: true; value: ProviderEntry }).value.provider).toBe(gem);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// E2: Chat success + full response mapping
// ─────────────────────────────────────────────────────────────────────────────

describe('E2: chat() success and response mapping', () => {
  it('E2-01: OpenAI chat() returns ok:true with text content', async () => {
    const p = openai({ fetchFn: mockFetch(200, openaiOk('Hồ sơ mời thầu đã sẵn sàng')) });
    const r = await p.chat({ messages: USER_MSG_OAI });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.content).toBe('Hồ sơ mời thầu đã sẵn sàng');
  });

  it('E2-02: Claude chat() returns ok:true with text content', async () => {
    const p = claude({ fetchFn: mockFetch(200, claudeOk('Kế hoạch lựa chọn nhà thầu')) });
    const r = await p.chat({ messages: USER_MSG_CLA });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.content).toBe('Kế hoạch lựa chọn nhà thầu');
  });

  it('E2-03: Gemini chat() returns ok:true with text content', async () => {
    const p = gemini({ fetchFn: mockFetch(200, geminiOk('Tiêu chí đánh giá hồ sơ dự thầu')) });
    const r = await p.chat({ messages: USER_MSG_GEM });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.content).toBe('Tiêu chí đánh giá hồ sơ dự thầu');
  });

  it('E2-04: OpenAI usage maps promptTokens / completionTokens / totalTokens', async () => {
    const body = { ...openaiOk('x'), usage: { prompt_tokens: 5, completion_tokens: 15, total_tokens: 20 } };
    const p = openai({ fetchFn: mockFetch(200, body) });
    const r = await p.chat({ messages: USER_MSG_OAI });
    if (!r.ok) throw new Error('expected ok');
    expect(r.value.usage.promptTokens).toBe(5);
    expect(r.value.usage.completionTokens).toBe(15);
    expect(r.value.usage.totalTokens).toBe(20);
  });

  it('E2-05: Claude usage maps inputTokens / outputTokens / totalTokens', async () => {
    const body = claudeOk('x');
    (body.usage as Record<string, number>).input_tokens  = 30;
    (body.usage as Record<string, number>).output_tokens = 10;
    const p = claude({ fetchFn: mockFetch(200, body) });
    const r = await p.chat({ messages: USER_MSG_CLA });
    if (!r.ok) throw new Error('expected ok');
    expect(r.value.usage.inputTokens).toBe(30);
    expect(r.value.usage.outputTokens).toBe(10);
    expect(r.value.usage.totalTokens).toBe(40);
  });

  it('E2-06: Gemini usage maps promptTokens / candidateTokens / totalTokens', async () => {
    const p = gemini({ fetchFn: mockFetch(200, geminiOk('x', 'STOP', 'v', )) });
    // Use a more precise body
    const body = {
      candidates: [{ content: { parts: [{ text: 'y' }], role: 'model' }, finishReason: 'STOP', index: 0 }],
      usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 7, totalTokenCount: 10 },
    };
    const p2 = gemini({ fetchFn: mockFetch(200, body) });
    const r = await p2.chat({ messages: USER_MSG_GEM });
    if (!r.ok) throw new Error('expected ok');
    expect(r.value.usage.promptTokens).toBe(3);
    expect(r.value.usage.candidateTokens).toBe(7);
    expect(r.value.usage.totalTokens).toBe(10);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// E3: Per-request overrides
// ─────────────────────────────────────────────────────────────────────────────

describe('E3: per-request overrides (model / temperature / maxTokens)', () => {
  it('E3-01: OpenAI model override appears in request body', async () => {
    const caps: Capture[] = [];
    const p = openai({ fetchFn: capturingFetch(openaiOk('x'), caps) });
    await p.chat({ messages: USER_MSG_OAI, model: 'gpt-4o-mini' });
    const body = JSON.parse(caps[0]!.init.body as string);
    expect(body.model).toBe('gpt-4o-mini');
  });

  it('E3-02: Claude model override appears in request body', async () => {
    const caps: Capture[] = [];
    const p = claude({ fetchFn: capturingFetch(claudeOk('x'), caps) });
    await p.chat({ messages: USER_MSG_CLA, model: 'claude-opus-4-20250514' });
    const body = JSON.parse(caps[0]!.init.body as string);
    expect(body.model).toBe('claude-opus-4-20250514');
  });

  it('E3-03: Gemini model override appears in request URL', async () => {
    const caps: Capture[] = [];
    const p = gemini({ fetchFn: capturingFetch(geminiOk('x'), caps) });
    await p.chat({ messages: USER_MSG_GEM, model: 'gemini-2.5-pro' });
    expect(caps[0]!.url).toContain('gemini-2.5-pro');
  });

  it('E3-04: OpenAI temperature override appears in request body', async () => {
    const caps: Capture[] = [];
    const p = openai({ fetchFn: capturingFetch(openaiOk('x'), caps) });
    await p.chat({ messages: USER_MSG_OAI, temperature: 0.1 });
    const body = JSON.parse(caps[0]!.init.body as string);
    expect(body.temperature).toBe(0.1);
  });

  it('E3-05: Claude temperature override appears in request body', async () => {
    const caps: Capture[] = [];
    const p = claude({ fetchFn: capturingFetch(claudeOk('x'), caps) });
    await p.chat({ messages: USER_MSG_CLA, temperature: 0.5 });
    const body = JSON.parse(caps[0]!.init.body as string);
    expect(body.temperature).toBe(0.5);
  });

  it('E3-06: Gemini temperature override appears in generationConfig', async () => {
    const caps: Capture[] = [];
    const p = gemini({ fetchFn: capturingFetch(geminiOk('x'), caps) });
    await p.chat({ messages: USER_MSG_GEM, temperature: 0.3 });
    const body = JSON.parse(caps[0]!.init.body as string);
    expect(body.generationConfig.temperature).toBe(0.3);
  });

  it('E3-07: OpenAI maxTokens override maps to max_tokens in body', async () => {
    const caps: Capture[] = [];
    const p = openai({ fetchFn: capturingFetch(openaiOk('x'), caps) });
    await p.chat({ messages: USER_MSG_OAI, maxTokens: 256 });
    const body = JSON.parse(caps[0]!.init.body as string);
    expect(body.max_tokens).toBe(256);
  });

  it('E3-08: Claude maxTokens override maps to max_tokens in body', async () => {
    const caps: Capture[] = [];
    const p = claude({ fetchFn: capturingFetch(claudeOk('x'), caps) });
    await p.chat({ messages: USER_MSG_CLA, maxTokens: 512 });
    const body = JSON.parse(caps[0]!.init.body as string);
    expect(body.max_tokens).toBe(512);
  });

  it('E3-09: Gemini maxTokens override maps to maxOutputTokens in generationConfig', async () => {
    const caps: Capture[] = [];
    const p = gemini({ fetchFn: capturingFetch(geminiOk('x'), caps) });
    await p.chat({ messages: USER_MSG_GEM, maxTokens: 128 });
    const body = JSON.parse(caps[0]!.init.body as string);
    expect(body.generationConfig.maxOutputTokens).toBe(128);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// E4: Error codes across all three providers
// ─────────────────────────────────────────────────────────────────────────────

describe('E4: error codes — UNAUTHORIZED / RATE_LIMITED / API_ERROR / NETWORK_ERROR', () => {
  it('E4-01: OpenAI 401 → UNAUTHORIZED', async () => {
    const p = openai({ fetchFn: mockFetch(401, {}) });
    const r = await p.chat({ messages: USER_MSG_OAI });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('UNAUTHORIZED');
  });

  it('E4-02: Claude 401 → UNAUTHORIZED', async () => {
    const p = claude({ fetchFn: mockFetch(401, {}) });
    const r = await p.chat({ messages: USER_MSG_CLA });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('UNAUTHORIZED');
  });

  it('E4-03: Gemini 401 → UNAUTHORIZED', async () => {
    const p = gemini({ fetchFn: mockFetch(401, {}) });
    const r = await p.chat({ messages: USER_MSG_GEM });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('UNAUTHORIZED');
  });

  it('E4-04: OpenAI 429 → RATE_LIMITED', async () => {
    const p = openai({ fetchFn: mockFetch(429, {}) });
    const r = await p.chat({ messages: USER_MSG_OAI });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('RATE_LIMITED');
  });

  it('E4-05: Claude 429 → RATE_LIMITED', async () => {
    const p = claude({ fetchFn: mockFetch(429, {}) });
    const r = await p.chat({ messages: USER_MSG_CLA });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('RATE_LIMITED');
  });

  it('E4-06: Gemini 429 → RATE_LIMITED', async () => {
    const p = gemini({ fetchFn: mockFetch(429, {}) });
    const r = await p.chat({ messages: USER_MSG_GEM });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('RATE_LIMITED');
  });

  it('E4-07: OpenAI 500 → API_ERROR with status 500', async () => {
    const p = openai({ fetchFn: mockFetch(500, { error: 'internal' }) });
    const r = await p.chat({ messages: USER_MSG_OAI });
    expect(r.ok).toBe(false);
    if (!r.ok) { expect(r.error.code).toBe('API_ERROR'); expect(r.error.status).toBe(500); }
  });

  it('E4-08: Claude 500 → API_ERROR with status 500', async () => {
    const p = claude({ fetchFn: mockFetch(500, { error: 'internal' }) });
    const r = await p.chat({ messages: USER_MSG_CLA });
    expect(r.ok).toBe(false);
    if (!r.ok) { expect(r.error.code).toBe('API_ERROR'); expect(r.error.status).toBe(500); }
  });

  it('E4-09: Gemini 500 → API_ERROR with status 500', async () => {
    const p = gemini({ fetchFn: mockFetch(500, { error: 'internal' }) });
    const r = await p.chat({ messages: USER_MSG_GEM });
    expect(r.ok).toBe(false);
    if (!r.ok) { expect(r.error.code).toBe('API_ERROR'); expect(r.error.status).toBe(500); }
  });

  it('E4-10: OpenAI network error → NETWORK_ERROR with cause', async () => {
    const cause = new TypeError('Failed to fetch');
    const p = openai({ fetchFn: throwingFetch(cause) });
    const r = await p.chat({ messages: USER_MSG_OAI });
    expect(r.ok).toBe(false);
    if (!r.ok) { expect(r.error.code).toBe('NETWORK_ERROR'); expect(r.error.cause).toBe(cause); }
  });

  it('E4-11: Claude network error → NETWORK_ERROR with cause', async () => {
    const cause = new TypeError('Failed to fetch');
    const p = claude({ fetchFn: throwingFetch(cause) });
    const r = await p.chat({ messages: USER_MSG_CLA });
    expect(r.ok).toBe(false);
    if (!r.ok) { expect(r.error.code).toBe('NETWORK_ERROR'); expect(r.error.cause).toBe(cause); }
  });

  it('E4-12: Gemini network error → NETWORK_ERROR with cause', async () => {
    const cause = new TypeError('Failed to fetch');
    const p = gemini({ fetchFn: throwingFetch(cause) });
    const r = await p.chat({ messages: USER_MSG_GEM });
    expect(r.ok).toBe(false);
    if (!r.ok) { expect(r.error.code).toBe('NETWORK_ERROR'); expect(r.error.cause).toBe(cause); }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// E5: Parse errors
// ─────────────────────────────────────────────────────────────────────────────

describe('E5: parse errors — malformed payloads and empty responses', () => {
  it('E5-01: OpenAI malformed JSON → PARSE_ERROR', async () => {
    const p = openai({ fetchFn: badJsonFetch() });
    const r = await p.chat({ messages: USER_MSG_OAI });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('PARSE_ERROR');
  });

  it('E5-02: Claude malformed JSON → PARSE_ERROR', async () => {
    const p = claude({ fetchFn: badJsonFetch() });
    const r = await p.chat({ messages: USER_MSG_CLA });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('PARSE_ERROR');
  });

  it('E5-03: Gemini malformed JSON → PARSE_ERROR', async () => {
    const p = gemini({ fetchFn: badJsonFetch() });
    const r = await p.chat({ messages: USER_MSG_GEM });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('PARSE_ERROR');
  });

  it('E5-04: OpenAI empty choices array → PARSE_ERROR', async () => {
    const body = { ...openaiOk('x'), choices: [] };
    const p = openai({ fetchFn: mockFetch(200, body) });
    const r = await p.chat({ messages: USER_MSG_OAI });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('PARSE_ERROR');
  });

  it('E5-05: Claude empty content array → PARSE_ERROR', async () => {
    const body = { ...claudeOk('x'), content: [] };
    const p = claude({ fetchFn: mockFetch(200, body) });
    const r = await p.chat({ messages: USER_MSG_CLA });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('PARSE_ERROR');
  });

  it('E5-06: Gemini empty candidates array → PARSE_ERROR', async () => {
    const body = { candidates: [], usageMetadata: { promptTokenCount: 0, candidatesTokenCount: 0, totalTokenCount: 0 } };
    const p = gemini({ fetchFn: mockFetch(200, body) });
    const r = await p.chat({ messages: USER_MSG_GEM });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('PARSE_ERROR');
  });

  it('E5-07: Claude non-text content block → PARSE_ERROR', async () => {
    const body = {
      ...claudeOk('x'),
      content: [{ type: 'tool_use', id: 'tu_01', name: 'search', input: {} }],
      stop_reason: 'tool_use',
    };
    const p = claude({ fetchFn: mockFetch(200, body) });
    const r = await p.chat({ messages: USER_MSG_CLA });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('PARSE_ERROR');
  });

  it('E5-08: Gemini candidate with empty parts array → PARSE_ERROR', async () => {
    const body = {
      candidates: [{ content: { parts: [], role: 'model' }, finishReason: 'STOP', index: 0 }],
      usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 0, totalTokenCount: 1 },
    };
    const p = gemini({ fetchFn: mockFetch(200, body) });
    const r = await p.chat({ messages: USER_MSG_GEM });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('PARSE_ERROR');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// E6: Registry lifecycle
// ─────────────────────────────────────────────────────────────────────────────

describe('E6: registry lifecycle — unregister, overwrite, re-register', () => {
  it('E6-01: unregistering the default clears it; getDefault() returns NO_DEFAULT', () => {
    const r = fullRegistry();
    r.setDefault('claude');
    expect(r.getDefault().ok).toBe(true);
    r.unregister('claude');
    const d = r.getDefault();
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.error.code).toBe('NO_DEFAULT');
    expect(r.list()).toHaveLength(2);
  });

  it('E6-02: overwrite replaces provider; get() returns new instance', () => {
    const r = fullRegistry();
    const newProvider = openai({ fetchFn: mockFetch(200, openaiOk('replaced')) });
    r.register({ id: 'openai', type: 'openai', name: 'OpenAI v2', provider: newProvider }, { overwrite: true });
    const entry = r.get('openai');
    expect(entry.ok && (entry as { ok: true; value: ProviderEntry }).value.provider).toBe(newProvider);
  });

  it('E6-03: re-register after unregister; chat() works on the new instance', async () => {
    const r = fullRegistry();
    r.unregister('gemini');
    const freshGemini = gemini({ fetchFn: mockFetch(200, geminiOk('fresh')) });
    r.register({ id: 'gemini', type: 'google', name: 'Gemini fresh', provider: freshGemini });
    const entry = r.get('gemini');
    expect(entry.ok).toBe(true);
    if (!entry.ok) return;
    const result = await (entry.value.provider as GeminiProvider).chat({ messages: USER_MSG_GEM });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.content).toBe('fresh');
  });

  it('E6-04: overwrite does not change list() count', () => {
    const r = fullRegistry();
    r.register({ id: 'openai', type: 'openai', name: 'OpenAI v2', provider: openai() }, { overwrite: true });
    expect(r.list()).toHaveLength(3);
  });

  it('E6-05: full lifecycle — register, setDefault, unregister, re-register, setDefault', () => {
    const r = new ProviderRegistry();
    r.register({ id: 'claude', type: 'anthropic', name: 'Claude A', provider: claude() });
    r.setDefault('claude');
    expect(r.getDefault().ok).toBe(true);
    r.unregister('claude');
    expect(r.getDefault().ok).toBe(false);
    r.register({ id: 'claude', type: 'anthropic', name: 'Claude B', provider: claude() });
    r.setDefault('claude');
    const d = r.getDefault();
    expect(d.ok).toBe(true);
    if (d.ok) expect(d.value.name).toBe('Claude B');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// E7: Concurrent requests and provider isolation
// ─────────────────────────────────────────────────────────────────────────────

describe('E7: concurrent requests and provider isolation', () => {
  it('E7-01: concurrent chats on three different providers all succeed', async () => {
    const [r1, r2, r3] = await Promise.all([
      openai({ fetchFn: mockFetch(200, openaiOk('oai')) }).chat({ messages: USER_MSG_OAI }),
      claude({ fetchFn: mockFetch(200, claudeOk('cla')) }).chat({ messages: USER_MSG_CLA }),
      gemini({ fetchFn: mockFetch(200, geminiOk('gem')) }).chat({ messages: USER_MSG_GEM }),
    ]);
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    expect(r3.ok).toBe(true);
    if (r1.ok) expect(r1.value.content).toBe('oai');
    if (r2.ok) expect(r2.value.content).toBe('cla');
    if (r3.ok) expect(r3.value.content).toBe('gem');
  });

  it('E7-02: five concurrent chats on the same OpenAI provider complete independently', async () => {
    const p = openai({ fetchFn: mockFetch(200, openaiOk('parallel')) });
    const results = await Promise.all(
      Array.from({ length: 5 }, () => p.chat({ messages: USER_MSG_OAI })),
    );
    for (const r of results) {
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value.content).toBe('parallel');
    }
  });

  it('E7-03: one provider error does not affect another concurrent call', async () => {
    const [fail, succeed] = await Promise.all([
      openai({ fetchFn: throwingFetch(new Error('net')) }).chat({ messages: USER_MSG_OAI }),
      claude({ fetchFn: mockFetch(200, claudeOk('safe'))  }).chat({ messages: USER_MSG_CLA }),
    ]);
    expect(fail.ok).toBe(false);
    expect(succeed.ok).toBe(true);
    if (succeed.ok) expect(succeed.value.content).toBe('safe');
  });

  it('E7-04: each provider uses its own apiKey (no cross-contamination)', async () => {
    const oaiCaps: Capture[] = [];
    const claCaps: Capture[] = [];
    await Promise.all([
      openai({ apiKey: 'key-openai-unique', fetchFn: capturingFetch(openaiOk('x'), oaiCaps) })
        .chat({ messages: USER_MSG_OAI }),
      claude({ apiKey: 'key-claude-unique', fetchFn: capturingFetch(claudeOk('x'), claCaps) })
        .chat({ messages: USER_MSG_CLA }),
    ]);
    const oaiHeaders = oaiCaps[0]!.init.headers as Record<string, string>;
    const claHeaders = claCaps[0]!.init.headers as Record<string, string>;
    expect(oaiHeaders['Authorization']).toBe('Bearer key-openai-unique');
    expect(claHeaders['x-api-key']).toBe('key-claude-unique');
    // Cross-check: Claude header must not carry the OpenAI key
    expect(claHeaders['x-api-key']).not.toBe('key-openai-unique');
  });

  it('E7-05: Gemini apiKey appears only in its own URL, not in headers', async () => {
    const gemCaps: Capture[] = [];
    const oaiCaps: Capture[] = [];
    await Promise.all([
      gemini({ apiKey: 'goog-secret-789', fetchFn: capturingFetch(geminiOk('x'), gemCaps) })
        .chat({ messages: USER_MSG_GEM }),
      openai({ apiKey: 'sk-oai-abc',      fetchFn: capturingFetch(openaiOk('x'), oaiCaps) })
        .chat({ messages: USER_MSG_OAI }),
    ]);
    expect(gemCaps[0]!.url).toContain('key=goog-secret-789');
    const gemHeaders = gemCaps[0]!.init.headers as Record<string, string>;
    // Gemini uses no Authorization header
    expect(gemHeaders['Authorization']).toBeUndefined();
    // OpenAI URL must not carry the Gemini key
    expect(oaiCaps[0]!.url).not.toContain('goog-secret-789');
  });

  it('E7-06: concurrent registry get() calls on all ids return correct results', async () => {
    const r = fullRegistry();
    const [e1, e2, e3] = await Promise.all([
      Promise.resolve(r.get('openai')),
      Promise.resolve(r.get('claude')),
      Promise.resolve(r.get('gemini')),
    ]);
    expect(e1.ok && (e1 as { ok: true; value: ProviderEntry }).value.type).toBe('openai');
    expect(e2.ok && (e2 as { ok: true; value: ProviderEntry }).value.type).toBe('anthropic');
    expect(e3.ok && (e3 as { ok: true; value: ProviderEntry }).value.type).toBe('google');
  });

  it('E7-07: ten concurrent Claude chats all return the same content', async () => {
    const p = claude({ fetchFn: mockFetch(200, claudeOk('batch-result')) });
    const results = await Promise.all(
      Array.from({ length: 10 }, () => p.chat({ messages: USER_MSG_CLA })),
    );
    for (const r of results) {
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value.content).toBe('batch-result');
    }
  });

  it('E7-08: mixed success/error concurrent Gemini requests complete independently', async () => {
    const [ok1, err1, ok2] = await Promise.all([
      gemini({ fetchFn: mockFetch(200, geminiOk('good-1')) }).chat({ messages: USER_MSG_GEM }),
      gemini({ fetchFn: mockFetch(429, {}) }               ).chat({ messages: USER_MSG_GEM }),
      gemini({ fetchFn: mockFetch(200, geminiOk('good-2')) }).chat({ messages: USER_MSG_GEM }),
    ]);
    expect(ok1.ok).toBe(true);
    expect(err1.ok).toBe(false);
    expect(ok2.ok).toBe(true);
    if (!err1.ok) expect(err1.error.code).toBe('RATE_LIMITED');
  });

  it('E7-09: Claude and Gemini auth headers are mutually exclusive', async () => {
    const claCaps: Capture[] = [];
    const gemCaps: Capture[] = [];
    await Promise.all([
      claude({ fetchFn: capturingFetch(claudeOk('x'), claCaps) }).chat({ messages: USER_MSG_CLA }),
      gemini({ fetchFn: capturingFetch(geminiOk('x'), gemCaps) }).chat({ messages: USER_MSG_GEM }),
    ]);
    const claH = claCaps[0]!.init.headers as Record<string, string>;
    const gemH = gemCaps[0]!.init.headers as Record<string, string>;
    expect(claH['x-api-key']).toBeDefined();
    expect(claH['anthropic-version']).toBeDefined();
    expect(gemH['x-api-key']).toBeUndefined();
    expect(gemH['anthropic-version']).toBeUndefined();
  });

  it('E7-10: concurrent validateConfig() calls on all providers are always synchronous and safe', () => {
    const results = [openai(), claude(), gemini()].map(p => p.validateConfig());
    for (const r of results) {
      expect(r.ok).toBe(true);
    }
  });
});
