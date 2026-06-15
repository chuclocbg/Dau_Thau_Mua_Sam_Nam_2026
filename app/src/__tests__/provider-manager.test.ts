/**
 * P6-10G: Unit tests for ProviderManager.
 *
 * Groups:
 *   PM — basic manager + metadata methods  ( 8 tests)
 *   PC — chat() success paths              (10 tests)
 *   PE — chat() error paths                (10 tests)
 *   PR — routing and dispatch              ( 8 tests)
 *   PU — usage normalization               ( 6 tests)
 *
 * Total: 42 tests
 *
 * Rules:
 *   - fetchFn always injected — no real network calls.
 *   - capturingFetch used to verify per-provider request shape.
 *   - Each test builds its own registry + manager for full isolation.
 */

import { describe, it, expect } from 'vitest';
import { ProviderManager, type ProviderManagerConfig } from '../providers/ProviderManager';
import { ProviderRegistry, type ProviderEntry }        from '../providers/ProviderRegistry';
import { OpenAIProvider }  from '../providers/OpenAIProvider';
import { ClaudeProvider }  from '../providers/ClaudeProvider';
import { GeminiProvider }  from '../providers/GeminiProvider';

// ─── Mock response builders ───────────────────────────────────────────────────

function openaiBody(text: string, model = 'gpt-4o') {
  return {
    id: 'chatcmpl-x', model,
    choices: [{ index: 0, message: { role: 'assistant', content: text }, finish_reason: 'stop' }],
    usage:   { prompt_tokens: 5, completion_tokens: 10, total_tokens: 15 },
  };
}

function claudeBody(text: string, model = 'claude-3-5-sonnet-20241022') {
  return {
    id: 'msg_x', type: 'message', role: 'assistant',
    content: [{ type: 'text', text }],
    model, stop_reason: 'end_turn', stop_sequence: null,
    usage: { input_tokens: 8, output_tokens: 12 },
  };
}

function geminiBody(text: string, modelVersion = 'gemini-2.5-flash') {
  return {
    candidates: [{ content: { parts: [{ text }], role: 'model' }, finishReason: 'STOP', index: 0 }],
    usageMetadata: { promptTokenCount: 6, candidatesTokenCount: 9, totalTokenCount: 15 },
    modelVersion,
  };
}

function mockFetch(status: number, body: unknown) {
  return async (): Promise<Response> =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
}

function throwingFetch(err: unknown) {
  return async (): Promise<Response> => { throw err; };
}

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

function oai(fetchBody: unknown = openaiBody('ok')) {
  return new OpenAIProvider({ apiKey: 'sk-test', model: 'gpt-4o', fetchFn: mockFetch(200, fetchBody) });
}
function cla(fetchBody: unknown = claudeBody('ok')) {
  return new ClaudeProvider({ apiKey: 'sk-ant', model: 'claude-3-5-sonnet-latest', fetchFn: mockFetch(200, fetchBody) });
}
function gem(fetchBody: unknown = geminiBody('ok')) {
  return new GeminiProvider({ apiKey: 'goog', model: 'gemini-2.5-flash', fetchFn: mockFetch(200, fetchBody) });
}

// ─── Registry / Manager helpers ───────────────────────────────────────────────

function mgr(registry: ProviderRegistry): ProviderManager {
  return new ProviderManager({ registry });
}

/** Fully-loaded registry with all three providers; OpenAI as default. */
function fullMgr(defaultId: 'openai' | 'claude' | 'gemini' = 'openai', providers?: {
  openai?: OpenAIProvider;
  claude?: ClaudeProvider;
  gemini?: GeminiProvider;
}): ProviderManager {
  const r = new ProviderRegistry();
  r.register({ id: 'openai', type: 'openai',    name: 'OpenAI', provider: providers?.openai ?? oai() });
  r.register({ id: 'claude', type: 'anthropic',  name: 'Claude', provider: providers?.claude ?? cla() });
  r.register({ id: 'gemini', type: 'google',     name: 'Gemini', provider: providers?.gemini ?? gem() });
  r.setDefault(defaultId);
  return mgr(r);
}

const MSGS = [{ role: 'user' as const, content: 'Test message' }];

// ─────────────────────────────────────────────────────────────────────────────
// PM: basic metadata methods
// ─────────────────────────────────────────────────────────────────────────────

describe('PM: basic manager + metadata methods', () => {
  it('PM-01: listProviders() on empty registry returns []', () => {
    const m = mgr(new ProviderRegistry());
    expect(m.listProviders()).toEqual([]);
  });

  it('PM-02: listProviders() returns all registered entries', () => {
    const m = fullMgr();
    expect(m.listProviders()).toHaveLength(3);
  });

  it('PM-03: getProvider() registered id returns ok:true with entry', () => {
    const m = fullMgr();
    const r = m.getProvider('claude');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.id).toBe('claude');
  });

  it('PM-04: getProvider() unregistered id returns NO_PROVIDER', () => {
    const m = mgr(new ProviderRegistry());
    const r = m.getProvider('openai');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('NO_PROVIDER');
  });

  it('PM-05: getDefaultProvider() no default set → NO_DEFAULT_PROVIDER', () => {
    const reg = new ProviderRegistry();
    reg.register({ id: 'openai', type: 'openai', name: 'OpenAI', provider: oai() });
    const r = mgr(reg).getDefaultProvider();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('NO_DEFAULT_PROVIDER');
  });

  it('PM-06: getDefaultProvider() after setDefaultProvider → ok:true with correct entry', () => {
    const m = fullMgr('gemini');
    const r = m.getDefaultProvider();
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.id).toBe('gemini');
  });

  it('PM-07: setDefaultProvider() registered id returns ok:true with id', () => {
    const m = fullMgr('openai');
    const r = m.setDefaultProvider('claude');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe('claude');
  });

  it('PM-08: setDefaultProvider() unregistered id returns NO_PROVIDER', () => {
    const m = mgr(new ProviderRegistry());
    const r = m.setDefaultProvider('gemini');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('NO_PROVIDER');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PC: chat() success paths
// ─────────────────────────────────────────────────────────────────────────────

describe('PC: chat() success paths', () => {
  it('PC-01: chat() via OpenAI default → ok:true with content', async () => {
    const m = fullMgr('openai', { openai: oai(openaiBody('Đấu thầu')) });
    const r = await m.chat({ messages: MSGS });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.content).toBe('Đấu thầu');
  });

  it('PC-02: chat() via Claude default → ok:true with content', async () => {
    const m = fullMgr('claude', { claude: cla(claudeBody('Mua sắm')) });
    const r = await m.chat({ messages: MSGS });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.content).toBe('Mua sắm');
  });

  it('PC-03: chat() via Gemini default → ok:true with content', async () => {
    const m = fullMgr('gemini', { gemini: gem(geminiBody('Nhà thầu')) });
    const r = await m.chat({ messages: MSGS });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.content).toBe('Nhà thầu');
  });

  it('PC-04: explicit providerId overrides default provider', async () => {
    const m = fullMgr('openai', { claude: cla(claudeBody('Từ Claude')) });
    const r = await m.chat({ messages: MSGS, providerId: 'claude' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.content).toBe('Từ Claude');
  });

  it('PC-05: response includes providerId matching the dispatched provider', async () => {
    const m = fullMgr('claude');
    const r = await m.chat({ messages: MSGS });
    expect(r.ok && r.value.providerId).toBe('claude');
  });

  it('PC-06: response includes providerType', async () => {
    const m = fullMgr('gemini');
    const r = await m.chat({ messages: MSGS });
    expect(r.ok && r.value.providerType).toBe('google');
  });

  it('PC-07: response includes model from provider response', async () => {
    const m = fullMgr('openai', { openai: oai(openaiBody('x', 'gpt-4o-mini')) });
    const r = await m.chat({ messages: MSGS });
    expect(r.ok && r.value.model).toBe('gpt-4o-mini');
  });

  it('PC-08: setDefaultProvider then chat() uses new default', async () => {
    const m = fullMgr('openai', { claude: cla(claudeBody('Switched')) });
    m.setDefaultProvider('claude');
    const r = await m.chat({ messages: MSGS });
    expect(r.ok && r.value.content).toBe('Switched');
    expect(r.ok && r.value.providerId).toBe('claude');
  });

  it('PC-09: finishReason present in response', async () => {
    const m = fullMgr('openai');
    const r = await m.chat({ messages: MSGS });
    expect(r.ok).toBe(true);
    if (r.ok) expect(typeof r.value.finishReason).toBe('string');
  });

  it('PC-10: multi-turn conversation (user/assistant/user) succeeds', async () => {
    const m = fullMgr('claude');
    const r = await m.chat({
      messages: [
        { role: 'user',      content: 'Câu hỏi đầu' },
        { role: 'assistant', content: 'Câu trả lời' },
        { role: 'user',      content: 'Câu hỏi tiếp' },
      ],
    });
    expect(r.ok).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PE: chat() error paths
// ─────────────────────────────────────────────────────────────────────────────

describe('PE: chat() error paths', () => {
  it('PE-01: empty registry with no providerId → NO_DEFAULT_PROVIDER', async () => {
    const r = await mgr(new ProviderRegistry()).chat({ messages: MSGS });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('NO_DEFAULT_PROVIDER');
  });

  it('PE-02: explicit providerId not registered → NO_PROVIDER', async () => {
    const m = fullMgr('openai');
    // Ask for 'gemini' by an explicit providerId NOT in a separate registry
    const reg = new ProviderRegistry();
    reg.register({ id: 'openai', type: 'openai', name: 'OpenAI', provider: oai() });
    reg.setDefault('openai');
    const m2 = mgr(reg);
    const r = await m2.chat({ messages: MSGS, providerId: 'gemini' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('NO_PROVIDER');
  });

  it('PE-03: empty messages array → INVALID_REQUEST', async () => {
    const m = fullMgr('openai');
    const r = await m.chat({ messages: [] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_REQUEST');
  });

  it('PE-04: provider network error → PROVIDER_ERROR', async () => {
    const m = fullMgr('openai', { openai: new OpenAIProvider({ apiKey: 'k', model: 'gpt-4o', fetchFn: throwingFetch(new TypeError('net')) }) });
    const r = await m.chat({ messages: MSGS });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('PROVIDER_ERROR');
  });

  it('PE-05: provider 401 → PROVIDER_ERROR', async () => {
    const m = fullMgr('claude', { claude: new ClaudeProvider({ apiKey: 'k', model: 'claude-3-5-sonnet-latest', fetchFn: mockFetch(401, {}) }) });
    const r = await m.chat({ messages: MSGS });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('PROVIDER_ERROR');
  });

  it('PE-06: provider 429 → PROVIDER_ERROR', async () => {
    const m = fullMgr('gemini', { gemini: new GeminiProvider({ apiKey: 'k', model: 'gemini-2.5-flash', fetchFn: mockFetch(429, {}) }) });
    const r = await m.chat({ messages: MSGS });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('PROVIDER_ERROR');
  });

  it('PE-07: provider PARSE_ERROR → PROVIDER_ERROR with cause', async () => {
    const badJson = async (): Promise<Response> => new Response('}{bad', { status: 200 });
    const m = fullMgr('openai', { openai: new OpenAIProvider({ apiKey: 'k', model: 'gpt-4o', fetchFn: badJson }) });
    const r = await m.chat({ messages: MSGS });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe('PROVIDER_ERROR');
      expect(r.error.cause).toBeDefined();
    }
  });

  it('PE-08: no default + registry empty + no providerId → NO_DEFAULT_PROVIDER', async () => {
    const reg = new ProviderRegistry();
    const r = await mgr(reg).chat({ messages: MSGS });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('NO_DEFAULT_PROVIDER');
  });

  it('PE-09: chat() never throws regardless of error type', async () => {
    const cases = [
      mgr(new ProviderRegistry()).chat({ messages: [] }),
      mgr(new ProviderRegistry()).chat({ messages: MSGS }),
      fullMgr('openai', { openai: new OpenAIProvider({ apiKey: 'k', model: 'gpt-4o', fetchFn: throwingFetch('string error') }) }).chat({ messages: MSGS }),
      fullMgr('openai', { openai: new OpenAIProvider({ apiKey: 'k', model: 'gpt-4o', fetchFn: throwingFetch(null) }) }).chat({ messages: MSGS }),
    ];
    const results = await Promise.all(cases);
    for (const r of results) {
      expect(r.ok).toBe(false);
    }
  });

  it('PE-10: listProviders() never fails regardless of registry state', () => {
    const m = mgr(new ProviderRegistry());
    expect(() => m.listProviders()).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PR: routing and dispatch
// ─────────────────────────────────────────────────────────────────────────────

describe('PR: routing and dispatch per provider type', () => {
  it('PR-01: routes to OpenAI when providerId: "openai"', async () => {
    const m = fullMgr('claude', { openai: oai(openaiBody('OpenAI result')) });
    const r = await m.chat({ messages: MSGS, providerId: 'openai' });
    expect(r.ok && r.value.providerId).toBe('openai');
    expect(r.ok && r.value.content).toBe('OpenAI result');
  });

  it('PR-02: routes to Claude when providerId: "claude"', async () => {
    const m = fullMgr('openai', { claude: cla(claudeBody('Claude result')) });
    const r = await m.chat({ messages: MSGS, providerId: 'claude' });
    expect(r.ok && r.value.providerId).toBe('claude');
    expect(r.ok && r.value.content).toBe('Claude result');
  });

  it('PR-03: routes to Gemini when providerId: "gemini"', async () => {
    const m = fullMgr('openai', { gemini: gem(geminiBody('Gemini result')) });
    const r = await m.chat({ messages: MSGS, providerId: 'gemini' });
    expect(r.ok && r.value.providerId).toBe('gemini');
    expect(r.ok && r.value.content).toBe('Gemini result');
  });

  it('PR-04: OpenAI system → prepended as role:system in messages array', async () => {
    const caps: Capture[] = [];
    const p = new OpenAIProvider({ apiKey: 'k', model: 'gpt-4o', fetchFn: capturingFetch(openaiBody('x'), caps) });
    const reg = new ProviderRegistry();
    reg.register({ id: 'openai', type: 'openai', name: 'OpenAI', provider: p });
    reg.setDefault('openai');
    await mgr(reg).chat({ messages: MSGS, system: 'Hệ thống đấu thầu' });
    const body = JSON.parse(caps[0]!.init.body as string);
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[0].content).toBe('Hệ thống đấu thầu');
    expect(body.messages[1].role).toBe('user');
  });

  it('PR-05: Claude system → top-level "system" field in request body', async () => {
    const caps: Capture[] = [];
    const p = new ClaudeProvider({ apiKey: 'k', model: 'claude-3-5-sonnet-latest', fetchFn: capturingFetch(claudeBody('x'), caps) });
    const reg = new ProviderRegistry();
    reg.register({ id: 'claude', type: 'anthropic', name: 'Claude', provider: p });
    reg.setDefault('claude');
    await mgr(reg).chat({ messages: MSGS, system: 'Chuyên gia mua sắm' });
    const body = JSON.parse(caps[0]!.init.body as string);
    expect(body.system).toBe('Chuyên gia mua sắm');
    // system must NOT appear in the messages array
    for (const msg of body.messages as Array<{ role: string }>) {
      expect(msg.role).not.toBe('system');
    }
  });

  it('PR-06: Gemini system → systemInstruction field in request body', async () => {
    const caps: Capture[] = [];
    const p = new GeminiProvider({ apiKey: 'k', model: 'gemini-2.5-flash', fetchFn: capturingFetch(geminiBody('x'), caps) });
    const reg = new ProviderRegistry();
    reg.register({ id: 'gemini', type: 'google', name: 'Gemini', provider: p });
    reg.setDefault('gemini');
    await mgr(reg).chat({ messages: MSGS, system: 'Chuyên gia Gemini' });
    const body = JSON.parse(caps[0]!.init.body as string);
    expect(body.systemInstruction).toBeDefined();
    expect(body.systemInstruction.parts[0].text).toBe('Chuyên gia Gemini');
  });

  it('PR-07: model override forwarded to OpenAI request body', async () => {
    const caps: Capture[] = [];
    const p = new OpenAIProvider({ apiKey: 'k', model: 'gpt-4o', fetchFn: capturingFetch(openaiBody('x'), caps) });
    const reg = new ProviderRegistry();
    reg.register({ id: 'openai', type: 'openai', name: 'OpenAI', provider: p });
    reg.setDefault('openai');
    await mgr(reg).chat({ messages: MSGS, model: 'gpt-4o-mini' });
    const body = JSON.parse(caps[0]!.init.body as string);
    expect(body.model).toBe('gpt-4o-mini');
  });

  it('PR-08: no system field → body.system absent for Claude', async () => {
    const caps: Capture[] = [];
    const p = new ClaudeProvider({ apiKey: 'k', model: 'claude-3-5-sonnet-latest', fetchFn: capturingFetch(claudeBody('x'), caps) });
    const reg = new ProviderRegistry();
    reg.register({ id: 'claude', type: 'anthropic', name: 'Claude', provider: p });
    reg.setDefault('claude');
    await mgr(reg).chat({ messages: MSGS });
    const body = JSON.parse(caps[0]!.init.body as string);
    expect(Object.prototype.hasOwnProperty.call(body, 'system')).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PU: usage normalization
// ─────────────────────────────────────────────────────────────────────────────

describe('PU: usage normalization across providers', () => {
  it('PU-01: OpenAI promptTokens → normalized inputTokens', async () => {
    const body = { ...openaiBody('x'), usage: { prompt_tokens: 7, completion_tokens: 3, total_tokens: 10 } };
    const m = fullMgr('openai', { openai: oai(body) });
    const r = await m.chat({ messages: MSGS });
    expect(r.ok && r.value.usage.inputTokens).toBe(7);
  });

  it('PU-02: OpenAI completionTokens → normalized outputTokens', async () => {
    const body = { ...openaiBody('x'), usage: { prompt_tokens: 7, completion_tokens: 3, total_tokens: 10 } };
    const m = fullMgr('openai', { openai: oai(body) });
    const r = await m.chat({ messages: MSGS });
    expect(r.ok && r.value.usage.outputTokens).toBe(3);
  });

  it('PU-03: Claude inputTokens passes through normalized', async () => {
    const body = claudeBody('x');
    (body.usage as Record<string, number>).input_tokens  = 20;
    (body.usage as Record<string, number>).output_tokens = 5;
    const m = fullMgr('claude', { claude: cla(body) });
    const r = await m.chat({ messages: MSGS });
    expect(r.ok && r.value.usage.inputTokens).toBe(20);
    expect(r.ok && r.value.usage.outputTokens).toBe(5);
  });

  it('PU-04: Claude totalTokens = inputTokens + outputTokens', async () => {
    const body = claudeBody('x');
    (body.usage as Record<string, number>).input_tokens  = 20;
    (body.usage as Record<string, number>).output_tokens = 5;
    const m = fullMgr('claude', { claude: cla(body) });
    const r = await m.chat({ messages: MSGS });
    expect(r.ok && r.value.usage.totalTokens).toBe(25);
  });

  it('PU-05: Gemini promptTokens → normalized inputTokens', async () => {
    const body = {
      candidates: [{ content: { parts: [{ text: 'x' }], role: 'model' }, finishReason: 'STOP', index: 0 }],
      usageMetadata: { promptTokenCount: 11, candidatesTokenCount: 4, totalTokenCount: 15 },
    };
    const m = fullMgr('gemini', { gemini: gem(body) });
    const r = await m.chat({ messages: MSGS });
    expect(r.ok && r.value.usage.inputTokens).toBe(11);
  });

  it('PU-06: Gemini candidateTokens → normalized outputTokens', async () => {
    const body = {
      candidates: [{ content: { parts: [{ text: 'x' }], role: 'model' }, finishReason: 'STOP', index: 0 }],
      usageMetadata: { promptTokenCount: 11, candidatesTokenCount: 4, totalTokenCount: 15 },
    };
    const m = fullMgr('gemini', { gemini: gem(body) });
    const r = await m.chat({ messages: MSGS });
    expect(r.ok && r.value.usage.outputTokens).toBe(4);
  });
});
