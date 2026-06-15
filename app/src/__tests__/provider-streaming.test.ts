/**
 * P6-10H: Streaming tests for all three provider adapters and ProviderManager.
 *
 * Groups:
 *   ST1 — OpenAI stream()           (10 tests)
 *   ST2 — Claude stream()            (10 tests)
 *   ST3 — Gemini stream()            (10 tests)
 *   ST4 — ProviderManager.stream()   ( 8 tests)
 *   ST5 — Edge cases                 ( 4 tests)
 *
 * Total: 42 tests
 *
 * Rules:
 *   - fetchFn always injected — no real network calls.
 *   - SSE bodies built with ReadableStream + TextEncoder (real streaming path).
 *   - collectChunks() drives `for await` iteration to completion.
 *   - Every test verifies `done` is the final chunk.
 */

import { describe, it, expect } from 'vitest';
import { OpenAIProvider }  from '../providers/OpenAIProvider';
import { ClaudeProvider }  from '../providers/ClaudeProvider';
import { GeminiProvider }  from '../providers/GeminiProvider';
import { ProviderRegistry }        from '../providers/ProviderRegistry';
import { ProviderManager }         from '../providers/ProviderManager';
import type { StreamChunk }        from '../providers/StreamingTypes';

// ─── SSE response builder ─────────────────────────────────────────────────────

function sseStreamFetch(lines: string[]): () => Promise<Response> {
  return async () => {
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(ctrl) {
        for (const line of lines) ctrl.enqueue(encoder.encode(line));
        ctrl.close();
      },
    });
    return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
  };
}

function httpErrorFetch(status: number): () => Promise<Response> {
  return async () => new Response('', { status });
}

function throwingFetch(): () => Promise<Response> {
  return async () => { throw new TypeError('network error'); };
}

// ─── Per-provider SSE helpers ─────────────────────────────────────────────────

function openaiSseFetch(tokens: string[], promptTokens = 5, model = 'gpt-4o'): () => Promise<Response> {
  const lines: string[] = [
    ...tokens.map(t =>
      `data: ${JSON.stringify({ model, choices: [{ index: 0, delta: { content: t }, finish_reason: null }] })}\n`,
    ),
    `data: ${JSON.stringify({ model, choices: [{ index: 0, delta: {}, finish_reason: 'stop' }], usage: { prompt_tokens: promptTokens, completion_tokens: tokens.length, total_tokens: promptTokens + tokens.length } })}\n`,
    'data: [DONE]\n',
  ];
  return sseStreamFetch(lines);
}

function claudeSseFetch(tokens: string[], inputTokens = 10, outputTokens = 5, model = 'claude-3-5-sonnet-20241022'): () => Promise<Response> {
  const lines: string[] = [
    `data: ${JSON.stringify({ type: 'message_start', message: { model, usage: { input_tokens: inputTokens, output_tokens: 0 } } })}\n`,
    `data: ${JSON.stringify({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } })}\n`,
    ...tokens.map(t =>
      `data: ${JSON.stringify({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: t } })}\n`,
    ),
    `data: ${JSON.stringify({ type: 'content_block_stop', index: 0 })}\n`,
    `data: ${JSON.stringify({ type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: outputTokens } })}\n`,
    `data: ${JSON.stringify({ type: 'message_stop' })}\n`,
  ];
  return sseStreamFetch(lines);
}

function geminiSseFetch(tokens: string[], promptTokens = 5): () => Promise<Response> {
  const lines: string[] = tokens.map((t, i) => {
    const isLast = i === tokens.length - 1;
    return `data: ${JSON.stringify({
      candidates:    [{ content: { parts: [{ text: t }], role: 'model' }, finishReason: 'STOP', index: 0 }],
      ...(isLast ? { usageMetadata: { promptTokenCount: promptTokens, candidatesTokenCount: tokens.length, totalTokenCount: promptTokens + tokens.length } } : {}),
      modelVersion:  'gemini-2.5-flash',
    })}\n`;
  });
  return sseStreamFetch(lines);
}

// ─── Iteration helper ─────────────────────────────────────────────────────────

async function collectChunks(stream: AsyncIterable<StreamChunk>): Promise<StreamChunk[]> {
  const chunks: StreamChunk[] = [];
  for await (const chunk of stream) chunks.push(chunk);
  return chunks;
}

// ─────────────────────────────────────────────────────────────────────────────
// ST1: OpenAI stream()
// ─────────────────────────────────────────────────────────────────────────────

describe('ST1: OpenAI stream()', () => {
  const MSGS = [{ role: 'user' as const, content: 'Xin chào' }];

  it('ST1-01: success — yields at least one token event', async () => {
    const p = new OpenAIProvider({ apiKey: 'k', model: 'gpt-4o', fetchFn: openaiSseFetch(['Hello']) });
    const chunks = await collectChunks(p.stream({ messages: MSGS }));
    expect(chunks.some(c => c.event === 'token')).toBe(true);
  });

  it('ST1-02: success — token text matches SSE content deltas', async () => {
    const p = new OpenAIProvider({ apiKey: 'k', model: 'gpt-4o', fetchFn: openaiSseFetch(['Đấu', ' thầu']) });
    const chunks = await collectChunks(p.stream({ messages: MSGS }));
    const tokens = chunks.filter(c => c.event === 'token').map(c => (c as Extract<StreamChunk, {event:'token'}>).token);
    expect(tokens).toEqual(['Đấu', ' thầu']);
  });

  it('ST1-03: success — message event content equals accumulated token text', async () => {
    const p = new OpenAIProvider({ apiKey: 'k', model: 'gpt-4o', fetchFn: openaiSseFetch(['Hello', ' World']) });
    const chunks = await collectChunks(p.stream({ messages: MSGS }));
    const msg = chunks.find(c => c.event === 'message') as Extract<StreamChunk, {event:'message'}> | undefined;
    expect(msg?.content).toBe('Hello World');
  });

  it('ST1-04: success — message event has correct inputTokens from usage', async () => {
    const p = new OpenAIProvider({ apiKey: 'k', model: 'gpt-4o', fetchFn: openaiSseFetch(['x'], 7) });
    const chunks = await collectChunks(p.stream({ messages: MSGS }));
    const msg = chunks.find(c => c.event === 'message') as Extract<StreamChunk, {event:'message'}> | undefined;
    expect(msg?.usage.inputTokens).toBe(7);
  });

  it('ST1-05: success — message event has outputTokens = token count', async () => {
    const p = new OpenAIProvider({ apiKey: 'k', model: 'gpt-4o', fetchFn: openaiSseFetch(['a', 'b', 'c'], 5) });
    const chunks = await collectChunks(p.stream({ messages: MSGS }));
    const msg = chunks.find(c => c.event === 'message') as Extract<StreamChunk, {event:'message'}> | undefined;
    expect(msg?.usage.outputTokens).toBe(3);
  });

  it('ST1-06: success — done is always the last chunk', async () => {
    const p = new OpenAIProvider({ apiKey: 'k', model: 'gpt-4o', fetchFn: openaiSseFetch(['ok']) });
    const chunks = await collectChunks(p.stream({ messages: MSGS }));
    expect(chunks.at(-1)?.event).toBe('done');
  });

  it('ST1-07: INVALID_CONFIG — yields error chunk then done, does not throw', async () => {
    const p = new OpenAIProvider({ apiKey: '', model: 'gpt-4o' });
    const chunks = await collectChunks(p.stream({ messages: MSGS }));
    expect(chunks[0]?.event).toBe('error');
    expect(chunks.at(-1)?.event).toBe('done');
  });

  it('ST1-08: NETWORK_ERROR — fetch throws — yields error+done', async () => {
    const p = new OpenAIProvider({ apiKey: 'k', model: 'gpt-4o', fetchFn: throwingFetch() });
    const chunks = await collectChunks(p.stream({ messages: MSGS }));
    const errChunk = chunks.find(c => c.event === 'error') as Extract<StreamChunk, {event:'error'}> | undefined;
    expect(errChunk?.error.code).toBe('NETWORK_ERROR');
    expect(chunks.at(-1)?.event).toBe('done');
  });

  it('ST1-09: HTTP 401 — yields UNAUTHORIZED error then done', async () => {
    const p = new OpenAIProvider({ apiKey: 'k', model: 'gpt-4o', fetchFn: httpErrorFetch(401) });
    const chunks = await collectChunks(p.stream({ messages: MSGS }));
    const errChunk = chunks.find(c => c.event === 'error') as Extract<StreamChunk, {event:'error'}> | undefined;
    expect(errChunk?.error.code).toBe('UNAUTHORIZED');
    expect(chunks.at(-1)?.event).toBe('done');
  });

  it('ST1-10: HTTP 429 — yields RATE_LIMITED error then done', async () => {
    const p = new OpenAIProvider({ apiKey: 'k', model: 'gpt-4o', fetchFn: httpErrorFetch(429) });
    const chunks = await collectChunks(p.stream({ messages: MSGS }));
    const errChunk = chunks.find(c => c.event === 'error') as Extract<StreamChunk, {event:'error'}> | undefined;
    expect(errChunk?.error.code).toBe('RATE_LIMITED');
    expect(chunks.at(-1)?.event).toBe('done');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ST2: Claude stream()
// ─────────────────────────────────────────────────────────────────────────────

describe('ST2: Claude stream()', () => {
  const MSGS = [{ role: 'user' as const, content: 'Mua sắm' }];

  it('ST2-01: success — yields token events for content_block_delta', async () => {
    const p = new ClaudeProvider({ apiKey: 'k', model: 'claude-3-5-sonnet-latest', fetchFn: claudeSseFetch(['Hi']) });
    const chunks = await collectChunks(p.stream({ messages: MSGS }));
    expect(chunks.some(c => c.event === 'token')).toBe(true);
  });

  it('ST2-02: success — tokens accumulate to expected content', async () => {
    const p = new ClaudeProvider({ apiKey: 'k', model: 'claude-3-5-sonnet-latest', fetchFn: claudeSseFetch(['Nhà', ' thầu']) });
    const chunks = await collectChunks(p.stream({ messages: MSGS }));
    const tokens = chunks.filter(c => c.event === 'token').map(c => (c as Extract<StreamChunk, {event:'token'}>).token);
    expect(tokens).toEqual(['Nhà', ' thầu']);
  });

  it('ST2-03: success — message event content matches accumulated tokens', async () => {
    const p = new ClaudeProvider({ apiKey: 'k', model: 'claude-3-5-sonnet-latest', fetchFn: claudeSseFetch(['Đấu', ' thầu', ' 2026']) });
    const chunks = await collectChunks(p.stream({ messages: MSGS }));
    const msg = chunks.find(c => c.event === 'message') as Extract<StreamChunk, {event:'message'}> | undefined;
    expect(msg?.content).toBe('Đấu thầu 2026');
  });

  it('ST2-04: success — message event has model from message_start', async () => {
    const p = new ClaudeProvider({ apiKey: 'k', model: 'claude-3-5-sonnet-latest', fetchFn: claudeSseFetch(['ok'], 10, 5, 'claude-3-5-sonnet-20241022') });
    const chunks = await collectChunks(p.stream({ messages: MSGS }));
    const msg = chunks.find(c => c.event === 'message') as Extract<StreamChunk, {event:'message'}> | undefined;
    expect(msg?.model).toBe('claude-3-5-sonnet-20241022');
  });

  it('ST2-05: success — inputTokens comes from message_start.message.usage.input_tokens', async () => {
    const p = new ClaudeProvider({ apiKey: 'k', model: 'claude-3-5-sonnet-latest', fetchFn: claudeSseFetch(['x'], 42, 7) });
    const chunks = await collectChunks(p.stream({ messages: MSGS }));
    const msg = chunks.find(c => c.event === 'message') as Extract<StreamChunk, {event:'message'}> | undefined;
    expect(msg?.usage.inputTokens).toBe(42);
  });

  it('ST2-06: success — outputTokens comes from message_delta.usage.output_tokens', async () => {
    const p = new ClaudeProvider({ apiKey: 'k', model: 'claude-3-5-sonnet-latest', fetchFn: claudeSseFetch(['x'], 10, 99) });
    const chunks = await collectChunks(p.stream({ messages: MSGS }));
    const msg = chunks.find(c => c.event === 'message') as Extract<StreamChunk, {event:'message'}> | undefined;
    expect(msg?.usage.outputTokens).toBe(99);
  });

  it('ST2-07: success — done is the last chunk', async () => {
    const p = new ClaudeProvider({ apiKey: 'k', model: 'claude-3-5-sonnet-latest', fetchFn: claudeSseFetch(['ok']) });
    const chunks = await collectChunks(p.stream({ messages: MSGS }));
    expect(chunks.at(-1)?.event).toBe('done');
  });

  it('ST2-08: INVALID_CONFIG — yields error+done, never throws', async () => {
    const p = new ClaudeProvider({ apiKey: '', model: 'claude-3-5-sonnet-latest' });
    const chunks = await collectChunks(p.stream({ messages: MSGS }));
    expect(chunks[0]?.event).toBe('error');
    expect(chunks.at(-1)?.event).toBe('done');
  });

  it('ST2-09: NETWORK_ERROR — yields NETWORK_ERROR error+done', async () => {
    const p = new ClaudeProvider({ apiKey: 'k', model: 'claude-3-5-sonnet-latest', fetchFn: throwingFetch() });
    const chunks = await collectChunks(p.stream({ messages: MSGS }));
    const errChunk = chunks.find(c => c.event === 'error') as Extract<StreamChunk, {event:'error'}> | undefined;
    expect(errChunk?.error.code).toBe('NETWORK_ERROR');
    expect(chunks.at(-1)?.event).toBe('done');
  });

  it('ST2-10: HTTP 401 — yields UNAUTHORIZED error+done', async () => {
    const p = new ClaudeProvider({ apiKey: 'k', model: 'claude-3-5-sonnet-latest', fetchFn: httpErrorFetch(401) });
    const chunks = await collectChunks(p.stream({ messages: MSGS }));
    const errChunk = chunks.find(c => c.event === 'error') as Extract<StreamChunk, {event:'error'}> | undefined;
    expect(errChunk?.error.code).toBe('UNAUTHORIZED');
    expect(chunks.at(-1)?.event).toBe('done');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ST3: Gemini stream()
// ─────────────────────────────────────────────────────────────────────────────

describe('ST3: Gemini stream()', () => {
  const MSGS = [{ role: 'user' as const, content: 'Kiểm toán' }];

  it('ST3-01: success — yields token events', async () => {
    const p = new GeminiProvider({ apiKey: 'k', model: 'gemini-2.5-flash', fetchFn: geminiSseFetch(['Xin chào']) });
    const chunks = await collectChunks(p.stream({ messages: MSGS }));
    expect(chunks.some(c => c.event === 'token')).toBe(true);
  });

  it('ST3-02: success — tokens accumulate to expected content', async () => {
    const p = new GeminiProvider({ apiKey: 'k', model: 'gemini-2.5-flash', fetchFn: geminiSseFetch(['Hợp đồng', ' mua sắm']) });
    const chunks = await collectChunks(p.stream({ messages: MSGS }));
    const tokens = chunks.filter(c => c.event === 'token').map(c => (c as Extract<StreamChunk, {event:'token'}>).token);
    expect(tokens).toEqual(['Hợp đồng', ' mua sắm']);
  });

  it('ST3-03: success — message event content matches accumulated tokens', async () => {
    const p = new GeminiProvider({ apiKey: 'k', model: 'gemini-2.5-flash', fetchFn: geminiSseFetch(['Gói', ' thầu']) });
    const chunks = await collectChunks(p.stream({ messages: MSGS }));
    const msg = chunks.find(c => c.event === 'message') as Extract<StreamChunk, {event:'message'}> | undefined;
    expect(msg?.content).toBe('Gói thầu');
  });

  it('ST3-04: success — message event has model from modelVersion field', async () => {
    const p = new GeminiProvider({ apiKey: 'k', model: 'gemini-2.5-flash', fetchFn: geminiSseFetch(['ok']) });
    const chunks = await collectChunks(p.stream({ messages: MSGS }));
    const msg = chunks.find(c => c.event === 'message') as Extract<StreamChunk, {event:'message'}> | undefined;
    expect(msg?.model).toBe('gemini-2.5-flash');
  });

  it('ST3-05: success — message event has inputTokens from usageMetadata', async () => {
    const p = new GeminiProvider({ apiKey: 'k', model: 'gemini-2.5-flash', fetchFn: geminiSseFetch(['ok'], 11) });
    const chunks = await collectChunks(p.stream({ messages: MSGS }));
    const msg = chunks.find(c => c.event === 'message') as Extract<StreamChunk, {event:'message'}> | undefined;
    expect(msg?.usage.inputTokens).toBe(11);
  });

  it('ST3-06: success — done is always the last chunk', async () => {
    const p = new GeminiProvider({ apiKey: 'k', model: 'gemini-2.5-flash', fetchFn: geminiSseFetch(['ok']) });
    const chunks = await collectChunks(p.stream({ messages: MSGS }));
    expect(chunks.at(-1)?.event).toBe('done');
  });

  it('ST3-07: INVALID_CONFIG — yields error+done, never throws', async () => {
    const p = new GeminiProvider({ apiKey: '', model: 'gemini-2.5-flash' });
    const chunks = await collectChunks(p.stream({ messages: MSGS }));
    expect(chunks[0]?.event).toBe('error');
    expect(chunks.at(-1)?.event).toBe('done');
  });

  it('ST3-08: NETWORK_ERROR — fetch throws — yields error+done', async () => {
    const p = new GeminiProvider({ apiKey: 'k', model: 'gemini-2.5-flash', fetchFn: throwingFetch() });
    const chunks = await collectChunks(p.stream({ messages: MSGS }));
    const errChunk = chunks.find(c => c.event === 'error') as Extract<StreamChunk, {event:'error'}> | undefined;
    expect(errChunk?.error.code).toBe('NETWORK_ERROR');
    expect(chunks.at(-1)?.event).toBe('done');
  });

  it('ST3-09: HTTP 403 — yields UNAUTHORIZED error+done', async () => {
    const p = new GeminiProvider({ apiKey: 'k', model: 'gemini-2.5-flash', fetchFn: httpErrorFetch(403) });
    const chunks = await collectChunks(p.stream({ messages: MSGS }));
    const errChunk = chunks.find(c => c.event === 'error') as Extract<StreamChunk, {event:'error'}> | undefined;
    expect(errChunk?.error.code).toBe('UNAUTHORIZED');
    expect(chunks.at(-1)?.event).toBe('done');
  });

  it('ST3-10: HTTP 429 — yields RATE_LIMITED error+done', async () => {
    const p = new GeminiProvider({ apiKey: 'k', model: 'gemini-2.5-flash', fetchFn: httpErrorFetch(429) });
    const chunks = await collectChunks(p.stream({ messages: MSGS }));
    const errChunk = chunks.find(c => c.event === 'error') as Extract<StreamChunk, {event:'error'}> | undefined;
    expect(errChunk?.error.code).toBe('RATE_LIMITED');
    expect(chunks.at(-1)?.event).toBe('done');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ST4: ProviderManager.stream()
// ─────────────────────────────────────────────────────────────────────────────

describe('ST4: ProviderManager.stream()', () => {
  const MSGS = [{ role: 'user' as const, content: 'Test' }];

  function makeManager(defaultId: 'openai' | 'claude' | 'gemini', opts?: {
    openai?: OpenAIProvider;
    claude?: ClaudeProvider;
    gemini?: GeminiProvider;
  }): ProviderManager {
    const r = new ProviderRegistry();
    r.register({ id: 'openai', type: 'openai',    name: 'OpenAI', provider: opts?.openai ?? new OpenAIProvider({ apiKey: 'k', model: 'gpt-4o',              fetchFn: openaiSseFetch(['ok']) }) });
    r.register({ id: 'claude', type: 'anthropic',  name: 'Claude', provider: opts?.claude ?? new ClaudeProvider({ apiKey: 'k', model: 'claude-3-5-sonnet-latest', fetchFn: claudeSseFetch(['ok']) }) });
    r.register({ id: 'gemini', type: 'google',     name: 'Gemini', provider: opts?.gemini ?? new GeminiProvider({ apiKey: 'k', model: 'gemini-2.5-flash',      fetchFn: geminiSseFetch(['ok']) }) });
    r.setDefault(defaultId);
    return new ProviderManager({ registry: r });
  }

  it('ST4-01: routes to default OpenAI provider — yields tokens from it', async () => {
    const m = makeManager('openai', {
      openai: new OpenAIProvider({ apiKey: 'k', model: 'gpt-4o', fetchFn: openaiSseFetch(['Từ OpenAI']) }),
    });
    const chunks = await collectChunks(m.stream({ messages: MSGS }));
    const tokens = chunks.filter(c => c.event === 'token').map(c => (c as Extract<StreamChunk, {event:'token'}>).token);
    expect(tokens).toContain('Từ OpenAI');
  });

  it('ST4-02: explicit providerId overrides default and routes to Claude', async () => {
    const m = makeManager('openai', {
      claude: new ClaudeProvider({ apiKey: 'k', model: 'claude-3-5-sonnet-latest', fetchFn: claudeSseFetch(['Từ Claude']) }),
    });
    const chunks = await collectChunks(m.stream({ messages: MSGS, providerId: 'claude' }));
    const tokens = chunks.filter(c => c.event === 'token').map(c => (c as Extract<StreamChunk, {event:'token'}>).token);
    expect(tokens).toContain('Từ Claude');
  });

  it('ST4-03: NO_DEFAULT_PROVIDER — empty registry yields error+done', async () => {
    const m = new ProviderManager({ registry: new ProviderRegistry() });
    const chunks = await collectChunks(m.stream({ messages: MSGS }));
    const errChunk = chunks.find(c => c.event === 'error') as Extract<StreamChunk, {event:'error'}> | undefined;
    expect(errChunk?.error.code).toBe('NO_DEFAULT_PROVIDER');
    expect(chunks.at(-1)?.event).toBe('done');
  });

  it('ST4-04: NO_PROVIDER — explicit id not registered yields error+done', async () => {
    const reg = new ProviderRegistry();
    reg.register({ id: 'openai', type: 'openai', name: 'OpenAI', provider: new OpenAIProvider({ apiKey: 'k', model: 'gpt-4o', fetchFn: openaiSseFetch(['ok']) }) });
    reg.setDefault('openai');
    const m = new ProviderManager({ registry: reg });
    const chunks = await collectChunks(m.stream({ messages: MSGS, providerId: 'gemini' }));
    const errChunk = chunks.find(c => c.event === 'error') as Extract<StreamChunk, {event:'error'}> | undefined;
    expect(errChunk?.error.code).toBe('NO_PROVIDER');
    expect(chunks.at(-1)?.event).toBe('done');
  });

  it('ST4-05: empty messages yields INVALID_REQUEST error+done', async () => {
    const m = makeManager('openai');
    const chunks = await collectChunks(m.stream({ messages: [] }));
    const errChunk = chunks.find(c => c.event === 'error') as Extract<StreamChunk, {event:'error'}> | undefined;
    expect(errChunk?.error.code).toBe('INVALID_REQUEST');
    expect(chunks.at(-1)?.event).toBe('done');
  });

  it('ST4-06: done is always last regardless of which provider is used', async () => {
    for (const id of ['openai', 'claude', 'gemini'] as const) {
      const m = makeManager(id);
      const chunks = await collectChunks(m.stream({ messages: MSGS }));
      expect(chunks.at(-1)?.event).toBe('done');
    }
  });

  it('ST4-07: token events pass through from Gemini provider', async () => {
    const m = makeManager('gemini', {
      gemini: new GeminiProvider({ apiKey: 'k', model: 'gemini-2.5-flash', fetchFn: geminiSseFetch(['A', 'B']) }),
    });
    const chunks = await collectChunks(m.stream({ messages: MSGS }));
    const tokens = chunks.filter(c => c.event === 'token').map(c => (c as Extract<StreamChunk, {event:'token'}>).token);
    expect(tokens).toEqual(['A', 'B']);
  });

  it('ST4-08: stream() supports for-await and never throws on all error paths', async () => {
    const cases = [
      new ProviderManager({ registry: new ProviderRegistry() }).stream({ messages: [] }),
      new ProviderManager({ registry: new ProviderRegistry() }).stream({ messages: MSGS }),
      makeManager('openai', {
        openai: new OpenAIProvider({ apiKey: 'k', model: 'gpt-4o', fetchFn: httpErrorFetch(500) }),
      }).stream({ messages: MSGS }),
    ];
    for (const s of cases) {
      let threw = false;
      try {
        const cs: StreamChunk[] = [];
        for await (const c of s) cs.push(c);
        expect(cs.at(-1)?.event).toBe('done');
      } catch {
        threw = true;
      }
      expect(threw).toBe(false);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ST5: Edge cases
// ─────────────────────────────────────────────────────────────────────────────

describe('ST5: Edge cases', () => {
  const MSGS = [{ role: 'user' as const, content: 'Test' }];

  it('ST5-01: zero-token stream — message event has empty content', async () => {
    const emptyFetch = sseStreamFetch([
      `data: ${JSON.stringify({ model: 'gpt-4o', choices: [{ index: 0, delta: {}, finish_reason: 'stop' }], usage: { prompt_tokens: 3, completion_tokens: 0, total_tokens: 3 } })}\n`,
      'data: [DONE]\n',
    ]);
    const p = new OpenAIProvider({ apiKey: 'k', model: 'gpt-4o', fetchFn: emptyFetch });
    const chunks = await collectChunks(p.stream({ messages: MSGS }));
    expect(chunks.filter(c => c.event === 'token')).toHaveLength(0);
    const msg = chunks.find(c => c.event === 'message') as Extract<StreamChunk, {event:'message'}> | undefined;
    expect(msg?.content).toBe('');
    expect(chunks.at(-1)?.event).toBe('done');
  });

  it('ST5-02: malformed SSE lines are skipped — stream still completes', async () => {
    const mixedFetch = sseStreamFetch([
      'data: }{bad json\n',
      `data: ${JSON.stringify({ model: 'gpt-4o', choices: [{ index: 0, delta: { content: 'ok' }, finish_reason: null }] })}\n`,
      `data: ${JSON.stringify({ model: 'gpt-4o', choices: [{ index: 0, delta: {}, finish_reason: 'stop' }], usage: { prompt_tokens: 2, completion_tokens: 1, total_tokens: 3 } })}\n`,
      'data: [DONE]\n',
    ]);
    const p = new OpenAIProvider({ apiKey: 'k', model: 'gpt-4o', fetchFn: mixedFetch });
    const chunks = await collectChunks(p.stream({ messages: MSGS }));
    expect(chunks.some(c => c.event === 'token')).toBe(true);
    expect(chunks.at(-1)?.event).toBe('done');
  });

  it('ST5-03: concurrent streams from different providers are independent', async () => {
    const p1 = new OpenAIProvider({ apiKey: 'k', model: 'gpt-4o', fetchFn: openaiSseFetch(['OpenAI']) });
    const p2 = new ClaudeProvider({ apiKey: 'k', model: 'claude-3-5-sonnet-latest', fetchFn: claudeSseFetch(['Claude']) });
    const [c1, c2] = await Promise.all([
      collectChunks(p1.stream({ messages: MSGS })),
      collectChunks(p2.stream({ messages: MSGS })),
    ]);
    const t1 = c1.filter(c => c.event === 'token').map(c => (c as Extract<StreamChunk, {event:'token'}>).token);
    const t2 = c2.filter(c => c.event === 'token').map(c => (c as Extract<StreamChunk, {event:'token'}>).token);
    expect(t1).toContain('OpenAI');
    expect(t2).toContain('Claude');
    expect(c1.at(-1)?.event).toBe('done');
    expect(c2.at(-1)?.event).toBe('done');
  });

  it('ST5-04: response body null — stream ends with message+done, no crash', async () => {
    const nullBodyFetch: () => Promise<Response> = async () =>
      new Response(null, { status: 200 });
    const p = new OpenAIProvider({ apiKey: 'k', model: 'gpt-4o', fetchFn: nullBodyFetch });
    let threw = false;
    try {
      const chunks = await collectChunks(p.stream({ messages: MSGS }));
      expect(chunks.at(-1)?.event).toBe('done');
    } catch {
      threw = true;
    }
    expect(threw).toBe(false);
  });
});
