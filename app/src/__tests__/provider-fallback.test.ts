/**
 * P6-10J: Tests for RetryPolicy and ProviderManager retry/fallback.
 *
 * Groups:
 *   FB1 — RetryPolicy standalone           ( 8 tests)
 *   FB2 — chatWithFallback                 (14 tests)
 *   FB3 — streamWithFallback               (12 tests)
 *   FB4 — Edge cases                       ( 8 tests)
 *
 * Total: 42 tests
 *
 * Rules:
 *   - fetchFn always injected — no real network calls.
 *   - retryDelayMs: 0 in all tests to avoid actual waits.
 *   - Error responses reuse both chat and stream paths (HTTP status is checked
 *     before body consumption in both OpenAIProvider.chat() and .stream()).
 */

import { describe, it, expect } from 'vitest';
import { RetryPolicy }         from '../providers/RetryPolicy';
import { OpenAIProvider }      from '../providers/OpenAIProvider';
import { ClaudeProvider }      from '../providers/ClaudeProvider';
import { GeminiProvider }      from '../providers/GeminiProvider';
import { ProviderRegistry }    from '../providers/ProviderRegistry';
import { ProviderManager }     from '../providers/ProviderManager';
import { ConversationMemory }  from '../providers/ConversationMemory';
import type { StreamChunk }    from '../providers/StreamingTypes';
import type { ProviderId }     from '../providers/ProviderRegistry';

// ─── Response factories ───────────────────────────────────────────────────────

function oaiSuccessResp(content: string): Response {
  return new Response(
    JSON.stringify({
      id: 'x', model: 'gpt-4o',
      choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
      usage:   { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

function claudeSuccessResp(content: string): Response {
  return new Response(
    JSON.stringify({
      id: 'x', type: 'message', role: 'assistant',
      model:        'claude-3-5-sonnet-latest',
      content:      [{ type: 'text', text: content }],
      stop_reason:  'end_turn',
      stop_sequence: null,
      usage: { input_tokens: 5, output_tokens: 3 },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

function geminiSuccessResp(content: string): Response {
  return new Response(
    JSON.stringify({
      candidates: [{
        content: { parts: [{ text: content }], role: 'model' },
        finishReason: 'STOP', index: 0,
      }],
      usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 3, totalTokenCount: 8 },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

function errResp(status: number): Response {
  return new Response(JSON.stringify({ error: 'err' }), { status });
}

type FetchFn = (url: string, init: RequestInit) => Promise<Response>;

function seqFetch(responses: Response[]): FetchFn {
  let i = 0;
  return async () => responses[Math.min(i++, responses.length - 1)]!;
}

function throwFetch(): FetchFn {
  return async () => { throw new Error('Network failure'); };
}

function throwThenFetch(throwCount: number, resp: Response): FetchFn {
  let i = 0;
  return async () => {
    if (i++ < throwCount) throw new Error('Network failure');
    return resp;
  };
}

// ─── SSE response factories ───────────────────────────────────────────────────

function oaiSseResp(content: string): Response {
  const enc = new TextEncoder();
  const lines = [
    `data: ${JSON.stringify({ model: 'gpt-4o', choices: [{ index: 0, delta: { content }, finish_reason: null }] })}\n`,
    `data: ${JSON.stringify({ model: 'gpt-4o', choices: [{ index: 0, delta: {}, finish_reason: 'stop' }], usage: { prompt_tokens: 5, completion_tokens: 1, total_tokens: 6 } })}\n`,
    'data: [DONE]\n',
  ];
  const body = new ReadableStream<Uint8Array>({ start(ctrl) { for (const l of lines) ctrl.enqueue(enc.encode(l)); ctrl.close(); } });
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

function claudeSseResp(content: string): Response {
  const enc = new TextEncoder();
  const lines = [
    `data: ${JSON.stringify({ type: 'message_start', message: { model: 'claude-3-5-sonnet-latest', usage: { input_tokens: 5 } } })}\n`,
    `data: ${JSON.stringify({ type: 'content_block_delta', delta: { type: 'text_delta', text: content } })}\n`,
    `data: ${JSON.stringify({ type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 3 } })}\n`,
  ];
  const body = new ReadableStream<Uint8Array>({ start(ctrl) { for (const l of lines) ctrl.enqueue(enc.encode(l)); ctrl.close(); } });
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

function geminiSseResp(content: string): Response {
  const enc = new TextEncoder();
  const lines = [
    `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: content }], role: 'model' }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 1, totalTokenCount: 6 }, modelVersion: 'gemini-2.5-pro' })}\n`,
  ];
  const body = new ReadableStream<Uint8Array>({ start(ctrl) { for (const l of lines) ctrl.enqueue(enc.encode(l)); ctrl.close(); } });
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

// ─── Manager factory ──────────────────────────────────────────────────────────

interface RegSetup {
  openai?:  FetchFn;
  claude?:  FetchFn;
  gemini?:  FetchFn;
  memory?:  ConversationMemory;
}

function makeManager(setup: RegSetup): ProviderManager {
  const r = new ProviderRegistry();
  let first: ProviderId | null = null;

  if (setup.openai) {
    const p = new OpenAIProvider({ apiKey: 'sk-test', model: 'gpt-4o', fetchFn: setup.openai });
    r.register({ id: 'openai', type: 'openai', name: 'OpenAI', provider: p });
    if (!first) first = 'openai';
  }
  if (setup.claude) {
    const p = new ClaudeProvider({ apiKey: 'sk-test', model: 'claude-3-5-sonnet-latest', fetchFn: setup.claude });
    r.register({ id: 'claude', type: 'anthropic', name: 'Claude', provider: p });
    if (!first) first = 'claude';
  }
  if (setup.gemini) {
    const p = new GeminiProvider({ apiKey: 'key', model: 'gemini-2.5-pro', fetchFn: setup.gemini });
    r.register({ id: 'gemini', type: 'google', name: 'Gemini', provider: p });
    if (!first) first = 'gemini';
  }

  if (first) r.setDefault(first);
  return new ProviderManager({ registry: r, memory: setup.memory });
}

async function collectChunks(stream: AsyncIterable<StreamChunk>): Promise<StreamChunk[]> {
  const out: StreamChunk[] = [];
  for await (const c of stream) out.push(c);
  return out;
}

type MetaChunk = Extract<StreamChunk, { event: 'meta' }>;

const NO_DELAY = { retryDelayMs: 0 } as const;
const U1 = { role: 'user' as const, content: 'Câu hỏi 1' };
const U2 = { role: 'user' as const, content: 'Câu hỏi 2' };

// ─────────────────────────────────────────────────────────────────────────────
// FB1: RetryPolicy standalone
// ─────────────────────────────────────────────────────────────────────────────

describe('FB1: RetryPolicy standalone', () => {
  it('FB1-01: default maxAttempts is 3', () => {
    expect(new RetryPolicy().maxAttempts).toBe(3);
  });

  it('FB1-02: default retryDelayMs is 100', () => {
    expect(new RetryPolicy().retryDelayMs).toBe(100);
  });

  it('FB1-03: NETWORK_ERROR is transient', () => {
    expect(new RetryPolicy().isTransient('NETWORK_ERROR')).toBe(true);
  });

  it('FB1-04: RATE_LIMITED is transient', () => {
    expect(new RetryPolicy().isTransient('RATE_LIMITED')).toBe(true);
  });

  it('FB1-05: INVALID_CONFIG is non-retryable', () => {
    expect(new RetryPolicy().isNonRetryable('INVALID_CONFIG')).toBe(true);
  });

  it('FB1-06: UNAUTHORIZED is non-retryable', () => {
    expect(new RetryPolicy().isNonRetryable('UNAUTHORIZED')).toBe(true);
  });

  it('FB1-07: PARSE_ERROR is non-retryable', () => {
    expect(new RetryPolicy().isNonRetryable('PARSE_ERROR')).toBe(true);
  });

  it('FB1-08: sleep resolves immediately when retryDelayMs is 0', async () => {
    const policy = new RetryPolicy({ retryDelayMs: 0 });
    const start  = Date.now();
    await policy.sleep(5);
    expect(Date.now() - start).toBeLessThan(50);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FB2: chatWithFallback
// ─────────────────────────────────────────────────────────────────────────────

describe('FB2: chatWithFallback', () => {
  it('FB2-01: success on first attempt — metadata correct', async () => {
    const m = makeManager({ openai: seqFetch([oaiSuccessResp('ok')]) });
    const r = await m.chatWithFallback({ messages: [U1] }, NO_DELAY);
    expect(r.ok).toBe(true);
    expect(r.providerUsed).toBe('openai');
    expect(r.attempts).toBe(1);
    expect(r.fallbackCount).toBe(0);
  });

  it('FB2-02: NETWORK_ERROR → retry → success in 2 attempts', async () => {
    const m = makeManager({ openai: throwThenFetch(1, oaiSuccessResp('ok')) });
    const r = await m.chatWithFallback({ messages: [U1] }, { maxAttempts: 3, retryDelayMs: 0 });
    expect(r.ok).toBe(true);
    expect(r.attempts).toBe(2);
    expect(r.fallbackCount).toBe(0);
  });

  it('FB2-03: RATE_LIMITED exhausted → fallback → second provider succeeds', async () => {
    const m = makeManager({
      openai: seqFetch([errResp(429), errResp(429), errResp(429)]),
      claude: seqFetch([claudeSuccessResp('ok')]),
    });
    const r = await m.chatWithFallback({ messages: [U1] }, { maxAttempts: 3, retryDelayMs: 0 });
    expect(r.ok).toBe(true);
    expect(r.providerUsed).toBe('claude');
    expect(r.attempts).toBe(4);     // 3 on openai + 1 on claude
    expect(r.fallbackCount).toBe(1);
  });

  it('FB2-04: UNAUTHORIZED → immediate fallback (1 openai attempt + 1 claude attempt)', async () => {
    const m = makeManager({
      openai: seqFetch([errResp(401)]),
      claude: seqFetch([claudeSuccessResp('ok')]),
    });
    const r = await m.chatWithFallback({ messages: [U1] }, { maxAttempts: 3, retryDelayMs: 0 });
    expect(r.ok).toBe(true);
    expect(r.attempts).toBe(2);
    expect(r.fallbackCount).toBe(1);
  });

  it('FB2-05: INVALID_CONFIG → immediate fallback', async () => {
    const bad = new OpenAIProvider({ apiKey: '', model: 'gpt-4o' });
    const good = new OpenAIProvider({ apiKey: 'sk-ok', model: 'gpt-4o', fetchFn: seqFetch([oaiSuccessResp('ok')]) });
    const r = new ProviderRegistry();
    r.register({ id: 'openai', type: 'openai', name: 'bad', provider: bad });
    r.register({ id: 'claude', type: 'anthropic', name: 'good', provider: good as unknown as typeof bad });
    r.setDefault('openai');
    const m = new ProviderManager({ registry: r });
    const result = await m.chatWithFallback({ messages: [U1] }, { maxAttempts: 3, retryDelayMs: 0 });
    // INVALID_CONFIG is non-retryable: 1 attempt on openai, then fallback to claude
    expect(result.attempts).toBe(2);
    expect(result.fallbackCount).toBe(1);
  });

  it('FB2-06: PARSE_ERROR → immediate fallback to next provider', async () => {
    const m = makeManager({
      openai: async () => new Response('not json at all', { status: 200, headers: { 'Content-Type': 'application/json' } }),
      claude: seqFetch([claudeSuccessResp('ok')]),
    });
    const r = await m.chatWithFallback({ messages: [U1] }, { maxAttempts: 3, retryDelayMs: 0 });
    expect(r.ok).toBe(true);
    expect(r.attempts).toBe(2);
    expect(r.fallbackCount).toBe(1);
  });

  it('FB2-07: all providers fail → ok:false', async () => {
    const m = makeManager({
      openai: seqFetch([errResp(429)]),
      claude: seqFetch([errResp(429)]),
    });
    const r = await m.chatWithFallback({ messages: [U1] }, { maxAttempts: 1, retryDelayMs: 0 });
    expect(r.ok).toBe(false);
  });

  it('FB2-08: providerUsed is the last-tried provider when all fail', async () => {
    const m = makeManager({
      openai: seqFetch([errResp(500)]),
      claude: seqFetch([errResp(500)]),
    });
    const r = await m.chatWithFallback({ messages: [U1] }, { maxAttempts: 1, retryDelayMs: 0 });
    expect(r.providerUsed).toBe('claude');
  });

  it('FB2-09: attempts accumulates across all providers', async () => {
    const m = makeManager({
      openai: seqFetch([errResp(500), errResp(500)]),
      claude: seqFetch([errResp(500), errResp(500)]),
    });
    const r = await m.chatWithFallback({ messages: [U1] }, { maxAttempts: 2, retryDelayMs: 0 });
    // openai: 2 attempts (API_ERROR, not transient → skip after 1), actually API_ERROR breaks on first
    // Wait — API_ERROR is not transient, so it breaks after 1 attempt per provider
    // openai: 1, claude: 1 = 2 total (but we said maxAttempts: 2...)
    // Actually: for non-transient, non-non-retryable errors (like API_ERROR), the code hits `break`
    // immediately. So it's 1 attempt per provider.
    expect(r.attempts).toBe(2);
    expect(r.fallbackCount).toBe(1);
  });

  it('FB2-10: fallbackCount increments for each provider switch', async () => {
    const m = makeManager({
      openai: seqFetch([errResp(429)]),
      claude: seqFetch([errResp(429)]),
      gemini: seqFetch([geminiSuccessResp('ok')]),
    });
    const r = await m.chatWithFallback({ messages: [U1] }, { maxAttempts: 1, retryDelayMs: 0 });
    expect(r.ok).toBe(true);
    expect(r.fallbackCount).toBe(2);
    expect(r.providerUsed).toBe('gemini');
  });

  it('FB2-11: memory updated on success', async () => {
    const mem = new ConversationMemory();
    const m   = makeManager({ openai: seqFetch([oaiSuccessResp('Reply')]), memory: mem });
    await m.chatWithFallback({ messages: [U1] }, NO_DELAY);
    expect(mem.size()).toBe(2);
    expect(mem.getMessages()[1]!.content).toBe('Reply');
  });

  it('FB2-12: memory NOT updated on failure', async () => {
    const mem = new ConversationMemory();
    const m   = makeManager({ openai: seqFetch([errResp(401)]), memory: mem });
    const r   = await m.chatWithFallback({ messages: [U1] }, { maxAttempts: 1, retryDelayMs: 0 });
    expect(r.ok).toBe(false);
    expect(mem.size()).toBe(0);
  });

  it('FB2-13: INVALID_REQUEST returns immediately with attempts=0', async () => {
    const m = makeManager({ openai: seqFetch([oaiSuccessResp('ok')]) });
    const r = await m.chatWithFallback({ messages: [] }, NO_DELAY);
    expect(r.ok).toBe(false);
    expect(r.attempts).toBe(0);
    expect(r.fallbackCount).toBe(0);
    if (!r.ok) expect(r.error.code).toBe('INVALID_REQUEST');
  });

  it('FB2-14: explicit providerOrder overrides registry default', async () => {
    const m = makeManager({
      openai: seqFetch([oaiSuccessResp('ok')]),
      claude: seqFetch([claudeSuccessResp('ok')]),
    });
    // Registry default is openai, but we force claude first
    const r = await m.chatWithFallback(
      { messages: [U1] },
      NO_DELAY,
      { providerOrder: ['claude', 'openai'] },
    );
    expect(r.ok).toBe(true);
    expect(r.providerUsed).toBe('claude');
    expect(r.attempts).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FB3: streamWithFallback
// ─────────────────────────────────────────────────────────────────────────────

describe('FB3: streamWithFallback', () => {
  it('FB3-01: success emits a meta chunk', async () => {
    const m      = makeManager({ openai: seqFetch([oaiSseResp('ok')]) });
    const chunks = await collectChunks(m.streamWithFallback({ messages: [U1] }, NO_DELAY));
    expect(chunks.some(c => c.event === 'meta')).toBe(true);
  });

  it('FB3-02: meta.providerUsed = first provider on direct success', async () => {
    const m      = makeManager({ openai: seqFetch([oaiSseResp('ok')]) });
    const chunks = await collectChunks(m.streamWithFallback({ messages: [U1] }, NO_DELAY));
    const meta   = chunks.find(c => c.event === 'meta') as MetaChunk | undefined;
    expect(meta?.providerUsed).toBe('openai');
  });

  it('FB3-03: meta.attempts = 1 on first-try success', async () => {
    const m      = makeManager({ openai: seqFetch([oaiSseResp('ok')]) });
    const chunks = await collectChunks(m.streamWithFallback({ messages: [U1] }, NO_DELAY));
    const meta   = chunks.find(c => c.event === 'meta') as MetaChunk | undefined;
    expect(meta?.attempts).toBe(1);
  });

  it('FB3-04: meta.fallbackCount = 0 on direct success', async () => {
    const m      = makeManager({ openai: seqFetch([oaiSseResp('ok')]) });
    const chunks = await collectChunks(m.streamWithFallback({ messages: [U1] }, NO_DELAY));
    const meta   = chunks.find(c => c.event === 'meta') as MetaChunk | undefined;
    expect(meta?.fallbackCount).toBe(0);
  });

  it('FB3-05: meta chunk appears immediately before done', async () => {
    const m      = makeManager({ openai: seqFetch([oaiSseResp('ok')]) });
    const chunks = await collectChunks(m.streamWithFallback({ messages: [U1] }, NO_DELAY));
    const metaIdx = chunks.findIndex(c => c.event === 'meta');
    const doneIdx = chunks.findIndex(c => c.event === 'done');
    expect(metaIdx).toBeGreaterThanOrEqual(0);
    expect(doneIdx).toBe(metaIdx + 1);
  });

  it('FB3-06: NETWORK_ERROR retry: meta.attempts = 2 after one throw + success', async () => {
    const m      = makeManager({ openai: throwThenFetch(1, oaiSseResp('ok')) });
    const chunks = await collectChunks(m.streamWithFallback({ messages: [U1] }, { maxAttempts: 3, retryDelayMs: 0 }));
    const meta   = chunks.find(c => c.event === 'meta') as MetaChunk | undefined;
    expect(meta?.attempts).toBe(2);
    expect(meta?.fallbackCount).toBe(0);
  });

  it('FB3-07: RATE_LIMITED exhausted → fallback to claude: correct meta', async () => {
    const m = makeManager({
      openai: seqFetch([errResp(429), errResp(429), errResp(429)]),
      claude: seqFetch([claudeSseResp('ok')]),
    });
    const chunks = await collectChunks(m.streamWithFallback({ messages: [U1] }, { maxAttempts: 3, retryDelayMs: 0 }));
    const meta   = chunks.find(c => c.event === 'meta') as MetaChunk | undefined;
    expect(meta?.providerUsed).toBe('claude');
    expect(meta?.attempts).toBe(4);     // 3 on openai + 1 on claude
    expect(meta?.fallbackCount).toBe(1);
  });

  it('FB3-08: all providers fail → error + meta + done', async () => {
    const m = makeManager({
      openai: seqFetch([errResp(401)]),
      claude: seqFetch([errResp(401)]),
    });
    const chunks = await collectChunks(m.streamWithFallback({ messages: [U1] }, { maxAttempts: 1, retryDelayMs: 0 }));
    expect(chunks.some(c => c.event === 'error')).toBe(true);
    expect(chunks.some(c => c.event === 'meta')).toBe(true);
    expect(chunks.at(-1)?.event).toBe('done');
  });

  it('FB3-09: memory updated after successful stream', async () => {
    const mem = new ConversationMemory();
    const m   = makeManager({ openai: seqFetch([oaiSseResp('StreamReply')]), memory: mem });
    await collectChunks(m.streamWithFallback({ messages: [U1] }, NO_DELAY));
    expect(mem.size()).toBe(2);
    expect(mem.getMessages()[1]!.content).toBe('StreamReply');
  });

  it('FB3-10: memory NOT updated when all providers fail', async () => {
    const mem = new ConversationMemory();
    const m   = makeManager({ openai: seqFetch([errResp(401)]), memory: mem });
    await collectChunks(m.streamWithFallback({ messages: [U1] }, { maxAttempts: 1, retryDelayMs: 0 }));
    expect(mem.size()).toBe(0);
  });

  it('FB3-11: done is always the last chunk', async () => {
    for (const fetch of [
      seqFetch([oaiSseResp('ok')]),
      seqFetch([errResp(500)]),
      throwFetch(),
    ]) {
      const m      = makeManager({ openai: fetch });
      const chunks = await collectChunks(m.streamWithFallback({ messages: [U1] }, { maxAttempts: 1, retryDelayMs: 0 }));
      expect(chunks.at(-1)?.event).toBe('done');
    }
  });

  it('FB3-12: INVALID_REQUEST yields error+done with no meta', async () => {
    const m      = makeManager({ openai: seqFetch([oaiSseResp('ok')]) });
    const chunks = await collectChunks(m.streamWithFallback({ messages: [] }, NO_DELAY));
    expect(chunks.some(c => c.event === 'error')).toBe(true);
    expect(chunks.some(c => c.event === 'meta')).toBe(false);
    expect(chunks.at(-1)?.event).toBe('done');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FB4: Edge cases
// ─────────────────────────────────────────────────────────────────────────────

describe('FB4: Edge cases', () => {
  it('FB4-01: explicit providerOrder overrides registry default chain', async () => {
    const m = makeManager({
      openai: seqFetch([oaiSuccessResp('ok')]),
      claude: seqFetch([claudeSuccessResp('ok')]),
      gemini: seqFetch([geminiSuccessResp('ok')]),
    });
    // Registry default = openai; we force gemini first
    const r = await m.chatWithFallback(
      { messages: [U1] },
      NO_DELAY,
      { providerOrder: ['gemini', 'claude', 'openai'] },
    );
    expect(r.ok).toBe(true);
    expect(r.providerUsed).toBe('gemini');
    expect(r.attempts).toBe(1);
  });

  it('FB4-02: request.providerId sets first provider in auto-chain', async () => {
    const m = makeManager({
      openai: seqFetch([oaiSuccessResp('ok')]),
      claude: seqFetch([claudeSuccessResp('ok')]),
    });
    // Default = openai, but we force claude as primary via providerId
    const r = await m.chatWithFallback({ messages: [U1], providerId: 'claude' }, NO_DELAY);
    expect(r.providerUsed).toBe('claude');
    expect(r.attempts).toBe(1);
  });

  it('FB4-03: maxAttempts=1 means no retries — one try per provider', async () => {
    let calls = 0;
    const countFetch: FetchFn = async () => { calls++; throw new Error('net'); };
    const m = makeManager({ openai: countFetch, claude: seqFetch([claudeSuccessResp('ok')]) });
    await m.chatWithFallback({ messages: [U1] }, { maxAttempts: 1, retryDelayMs: 0 });
    expect(calls).toBe(1);   // openai tried exactly once
  });

  it('FB4-04: three-provider chain — first two fail, third succeeds', async () => {
    const m = makeManager({
      openai: seqFetch([errResp(429)]),
      claude: seqFetch([errResp(429)]),
      gemini: seqFetch([geminiSuccessResp('From Gemini')]),
    });
    const r = await m.chatWithFallback({ messages: [U1] }, { maxAttempts: 1, retryDelayMs: 0 });
    expect(r.ok).toBe(true);
    expect(r.providerUsed).toBe('gemini');
    expect(r.fallbackCount).toBe(2);
    expect(r.attempts).toBe(3);
  });

  it('FB4-05: PARSE_ERROR is non-retryable — skips retry but tries next provider', async () => {
    let oaiCalls = 0;
    const parseErrFetch: FetchFn = async () => {
      oaiCalls++;
      return new Response('!!notjson', { status: 200, headers: { 'Content-Type': 'application/json' } });
    };
    const m = makeManager({
      openai: parseErrFetch,
      claude: seqFetch([claudeSuccessResp('ok')]),
    });
    const r = await m.chatWithFallback({ messages: [U1] }, { maxAttempts: 3, retryDelayMs: 0 });
    expect(oaiCalls).toBe(1);    // no retry on PARSE_ERROR
    expect(r.ok).toBe(true);
    expect(r.fallbackCount).toBe(1);
  });

  it('FB4-06: empty registry → ok:false, attempts=0, providerUsed=""', async () => {
    const m = new ProviderManager({ registry: new ProviderRegistry() });
    const r = await m.chatWithFallback({ messages: [U1] }, NO_DELAY);
    expect(r.ok).toBe(false);
    expect(r.attempts).toBe(0);
    expect(r.providerUsed).toBe('');
  });

  it('FB4-07: chatWithFallback preserves usage normalization from fallback provider', async () => {
    const m = makeManager({
      openai: seqFetch([errResp(500)]),
      claude: seqFetch([claudeSuccessResp('ok')]),
    });
    const r = await m.chatWithFallback({ messages: [U1] }, { maxAttempts: 1, retryDelayMs: 0 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.usage.inputTokens).toBe(5);
      expect(r.value.usage.outputTokens).toBe(3);
      expect(r.value.usage.totalTokens).toBe(8);
    }
  });

  it('FB4-08: streamWithFallback never throws when all providers and retries fail', async () => {
    const m = makeManager({
      openai: throwFetch(),
      claude: throwFetch(),
      gemini: throwFetch(),
    });
    let threw = false;
    try {
      await collectChunks(
        m.streamWithFallback(
          { messages: [U1] },
          { maxAttempts: 2, retryDelayMs: 0 },
        ),
      );
    } catch {
      threw = true;
    }
    expect(threw).toBe(false);
  });
});
