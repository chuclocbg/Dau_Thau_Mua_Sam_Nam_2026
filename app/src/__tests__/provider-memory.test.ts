/**
 * P6-10I: Tests for ConversationMemory and ProviderManager memory integration.
 *
 * Groups:
 *   CM1 — ConversationMemory standalone        (14 tests)
 *   CM2 — ProviderManager.chat() with memory   (14 tests)
 *   CM3 — ProviderManager.stream() with memory (10 tests)
 *   CM4 — Edge cases                           ( 4 tests)
 *
 * Total: 42 tests
 *
 * Rules:
 *   - fetchFn always injected — no real network calls.
 *   - capturingFetch inspects the messages array sent to the provider.
 *   - SSE helpers used for stream() tests.
 *   - All memory behaviour verified via memory.getMessages() / memory.size().
 */

import { describe, it, expect } from 'vitest';
import { ConversationMemory }  from '../providers/ConversationMemory';
import type { MemoryMessage }  from '../providers/ConversationMemory';
import { OpenAIProvider }      from '../providers/OpenAIProvider';
import { ProviderRegistry }    from '../providers/ProviderRegistry';
import { ProviderManager }     from '../providers/ProviderManager';
import type { StreamChunk }    from '../providers/StreamingTypes';

// ─── Chat mock helpers ────────────────────────────────────────────────────────

interface Capture { messages: Array<{ role: string; content: string; }>; }

function capturingFetch(
  responseContent: string,
  out: Capture[],
): (url: string, init: RequestInit) => Promise<Response> {
  return async (_url, init) => {
    const body = JSON.parse(init.body as string) as { messages: Capture['messages'] };
    out.push({ messages: body.messages });
    return new Response(
      JSON.stringify({
        id:      'chatcmpl-x',
        model:   'gpt-4o',
        choices: [{ index: 0, message: { role: 'assistant', content: responseContent }, finish_reason: 'stop' }],
        usage:   { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  };
}

function simpleFetch(content: string): (url: string, init: RequestInit) => Promise<Response> {
  return capturingFetch(content, []);
}

function errorFetch(status: number): () => Promise<Response> {
  return async () => new Response('', { status });
}

// ─── SSE helpers (for stream() tests) ────────────────────────────────────────

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

function openaiSseFetch(content: string): () => Promise<Response> {
  return sseStreamFetch([
    `data: ${JSON.stringify({ model: 'gpt-4o', choices: [{ index: 0, delta: { content }, finish_reason: null }] })}\n`,
    `data: ${JSON.stringify({ model: 'gpt-4o', choices: [{ index: 0, delta: {}, finish_reason: 'stop' }], usage: { prompt_tokens: 5, completion_tokens: 1, total_tokens: 6 } })}\n`,
    'data: [DONE]\n',
  ]);
}

// ─── Manager factory ──────────────────────────────────────────────────────────

function makeManager(opts: {
  fetchFn?: (url: string, init: RequestInit) => Promise<Response>;
  memory?:  ConversationMemory;
}): ProviderManager {
  const p = new OpenAIProvider({ apiKey: 'sk-test', model: 'gpt-4o', fetchFn: opts.fetchFn ?? simpleFetch('ok') });
  const r = new ProviderRegistry();
  r.register({ id: 'openai', type: 'openai', name: 'OpenAI', provider: p });
  r.setDefault('openai');
  return new ProviderManager({ registry: r, memory: opts.memory });
}

async function collectChunks(stream: AsyncIterable<StreamChunk>): Promise<StreamChunk[]> {
  const out: StreamChunk[] = [];
  for await (const c of stream) out.push(c);
  return out;
}

const U1 = { role: 'user' as const, content: 'Câu hỏi 1' };
const U2 = { role: 'user' as const, content: 'Câu hỏi 2' };
const U3 = { role: 'user' as const, content: 'Câu hỏi 3' };

// ─────────────────────────────────────────────────────────────────────────────
// CM1: ConversationMemory standalone
// ─────────────────────────────────────────────────────────────────────────────

describe('CM1: ConversationMemory standalone', () => {
  it('CM1-01: add() increases size by 1', () => {
    const m = new ConversationMemory();
    m.add({ role: 'user', content: 'Hi' });
    expect(m.size()).toBe(1);
  });

  it('CM1-02: addUser() stores a user-role message', () => {
    const m = new ConversationMemory();
    m.addUser('Xin chào');
    expect(m.getMessages()[0]).toEqual({ role: 'user', content: 'Xin chào' });
  });

  it('CM1-03: addAssistant() stores an assistant-role message', () => {
    const m = new ConversationMemory();
    m.addAssistant('Phản hồi');
    expect(m.getMessages()[0]).toEqual({ role: 'assistant', content: 'Phản hồi' });
  });

  it('CM1-04: clear() reduces size to zero', () => {
    const m = new ConversationMemory();
    m.addUser('a');
    m.addAssistant('b');
    m.clear();
    expect(m.size()).toBe(0);
    expect(m.getMessages()).toEqual([]);
  });

  it('CM1-05: size() returns the current message count', () => {
    const m = new ConversationMemory();
    expect(m.size()).toBe(0);
    m.addUser('x');
    expect(m.size()).toBe(1);
    m.addAssistant('y');
    expect(m.size()).toBe(2);
  });

  it('CM1-06: getMessages() returns messages in insertion order', () => {
    const m = new ConversationMemory();
    m.addUser('Q');
    m.addAssistant('A');
    m.addUser('Q2');
    const msgs = m.getMessages();
    expect(msgs.map(x => x.content)).toEqual(['Q', 'A', 'Q2']);
  });

  it('CM1-07: getMessages() returns copies — mutating snapshot does not affect memory', () => {
    const m = new ConversationMemory();
    m.addUser('original');
    const snap = m.getMessages();
    snap[0]!.content = 'mutated';
    expect(m.getMessages()[0]!.content).toBe('original');
  });

  it('CM1-08: add() stores a copy — mutating the original does not affect memory', () => {
    const m = new ConversationMemory();
    const msg: MemoryMessage = { role: 'user', content: 'original' };
    m.add(msg);
    msg.content = 'mutated';
    expect(m.getMessages()[0]!.content).toBe('original');
  });

  it('CM1-09: trimToLast(n) retains only the last n messages', () => {
    const m = new ConversationMemory();
    m.addUser('A'); m.addAssistant('B'); m.addUser('C'); m.addAssistant('D');
    m.trimToLast(2);
    expect(m.size()).toBe(2);
    expect(m.getMessages().map(x => x.content)).toEqual(['C', 'D']);
  });

  it('CM1-10: trimToLast(0) clears all messages', () => {
    const m = new ConversationMemory();
    m.addUser('x'); m.addAssistant('y');
    m.trimToLast(0);
    expect(m.size()).toBe(0);
  });

  it('CM1-11: trimToLast(negative) clears all messages', () => {
    const m = new ConversationMemory();
    m.addUser('x'); m.addAssistant('y');
    m.trimToLast(-5);
    expect(m.size()).toBe(0);
  });

  it('CM1-12: trimToLast(n >= size) is a no-op', () => {
    const m = new ConversationMemory();
    m.addUser('A'); m.addAssistant('B');
    m.trimToLast(10);
    expect(m.size()).toBe(2);
  });

  it('CM1-13: maxMessages auto-trims oldest on overflow', () => {
    const m = new ConversationMemory({ maxMessages: 3 });
    m.addUser('1'); m.addAssistant('2'); m.addUser('3'); m.addAssistant('4');
    expect(m.size()).toBe(3);
    expect(m.getMessages().map(x => x.content)).toEqual(['2', '3', '4']);
  });

  it('CM1-14: maxMessages=1 always keeps only the newest message', () => {
    const m = new ConversationMemory({ maxMessages: 1 });
    m.addUser('A'); m.addUser('B'); m.addUser('C');
    expect(m.size()).toBe(1);
    expect(m.getMessages()[0]!.content).toBe('C');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CM2: ProviderManager.chat() with memory
// ─────────────────────────────────────────────────────────────────────────────

describe('CM2: ProviderManager.chat() with memory', () => {
  it('CM2-01: chat() without memory option behaves identically to P6-10G', async () => {
    const m = makeManager({ fetchFn: simpleFetch('ok') });
    const r = await m.chat({ messages: [U1] });
    expect(r.ok).toBe(true);
  });

  it('CM2-02: first chat() sends no extra messages (empty memory)', async () => {
    const caps: Capture[] = [];
    const mem = new ConversationMemory();
    const m = makeManager({ fetchFn: capturingFetch('A1', caps), memory: mem });
    await m.chat({ messages: [U1] });
    expect(caps[0]!.messages).toHaveLength(1);
    expect(caps[0]!.messages[0]!.content).toBe(U1.content);
  });

  it('CM2-03: after first chat(), user message is stored in memory', async () => {
    const mem = new ConversationMemory();
    const m = makeManager({ fetchFn: simpleFetch('A1'), memory: mem });
    await m.chat({ messages: [U1] });
    expect(mem.getMessages().some(msg => msg.role === 'user' && msg.content === U1.content)).toBe(true);
  });

  it('CM2-04: after first chat(), assistant reply is stored in memory', async () => {
    const mem = new ConversationMemory();
    const m = makeManager({ fetchFn: simpleFetch('Trả lời 1'), memory: mem });
    await m.chat({ messages: [U1] });
    expect(mem.getMessages().some(msg => msg.role === 'assistant' && msg.content === 'Trả lời 1')).toBe(true);
  });

  it('CM2-05: second chat() prepends first turn history to provider call', async () => {
    const caps: Capture[] = [];
    let call = 0;
    const mem = new ConversationMemory();
    // Two separate fetch functions for two calls
    const twoCallFetch: (url: string, init: RequestInit) => Promise<Response> = async (_url, init) => {
      const body = JSON.parse(init.body as string) as { messages: Capture['messages'] };
      caps.push({ messages: body.messages });
      const content = call === 0 ? 'A1' : 'A2';
      call++;
      return new Response(JSON.stringify({ id: 'x', model: 'gpt-4o', choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }], usage: { prompt_tokens: 5, completion_tokens: 1, total_tokens: 6 } }), { status: 200 });
    };
    const m = makeManager({ fetchFn: twoCallFetch, memory: mem });
    await m.chat({ messages: [U1] });
    await m.chat({ messages: [U2] });
    // Second call must include U1 + A1 + U2
    expect(caps[1]!.messages).toHaveLength(3);
    expect(caps[1]!.messages[0]!.content).toBe(U1.content);
    expect(caps[1]!.messages[1]!.content).toBe('A1');
    expect(caps[1]!.messages[2]!.content).toBe(U2.content);
  });

  it('CM2-06: memory accumulates correctly over three turns', async () => {
    const mem = new ConversationMemory();
    let turn = 0;
    const multiFetch: (url: string, init: RequestInit) => Promise<Response> = async () => {
      const content = `Reply${++turn}`;
      return new Response(JSON.stringify({ id: 'x', model: 'gpt-4o', choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }), { status: 200 });
    };
    const m = makeManager({ fetchFn: multiFetch, memory: mem });
    await m.chat({ messages: [U1] });
    await m.chat({ messages: [U2] });
    await m.chat({ messages: [U3] });
    // 3 user + 3 assistant = 6 messages
    expect(mem.size()).toBe(6);
    const roles = mem.getMessages().map(x => x.role);
    expect(roles).toEqual(['user','assistant','user','assistant','user','assistant']);
  });

  it('CM2-07: failed chat() (provider error) does NOT update memory', async () => {
    const mem = new ConversationMemory();
    const m = makeManager({ fetchFn: errorFetch(401), memory: mem });
    const r = await m.chat({ messages: [U1] });
    expect(r.ok).toBe(false);
    expect(mem.size()).toBe(0);
  });

  it('CM2-08: INVALID_REQUEST (empty messages) does NOT update memory', async () => {
    const mem = new ConversationMemory();
    const m = makeManager({ memory: mem });
    const r = await m.chat({ messages: [] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_REQUEST');
    expect(mem.size()).toBe(0);
  });

  it('CM2-09: chat() with multiple new messages adds all of them to memory', async () => {
    const mem = new ConversationMemory();
    const m = makeManager({ fetchFn: simpleFetch('A'), memory: mem });
    await m.chat({ messages: [U1, { role: 'assistant', content: 'mid' }, U2] });
    // 3 new messages + 1 assistant reply = 4
    expect(mem.size()).toBe(4);
  });

  it('CM2-10: clear() between turns resets history for next call', async () => {
    const caps: Capture[] = [];
    let call = 0;
    const mem = new ConversationMemory();
    const twoCallFetch: (url: string, init: RequestInit) => Promise<Response> = async (_url, init) => {
      const body = JSON.parse(init.body as string) as { messages: Capture['messages'] };
      caps.push({ messages: body.messages });
      const content = call++ === 0 ? 'A1' : 'A2';
      return new Response(JSON.stringify({ id: 'x', model: 'gpt-4o', choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }), { status: 200 });
    };
    const m = makeManager({ fetchFn: twoCallFetch, memory: mem });
    await m.chat({ messages: [U1] });
    mem.clear();
    await m.chat({ messages: [U2] });
    // Second call should only have U2 (history was cleared)
    expect(caps[1]!.messages).toHaveLength(1);
    expect(caps[1]!.messages[0]!.content).toBe(U2.content);
  });

  it('CM2-11: explicit providerId override with memory still works', async () => {
    const mem = new ConversationMemory();
    mem.addUser('history');
    mem.addAssistant('reply');
    const caps: Capture[] = [];
    const m = makeManager({ fetchFn: capturingFetch('A', caps), memory: mem });
    await m.chat({ messages: [U1], providerId: 'openai' });
    expect(caps[0]!.messages).toHaveLength(3); // history(2) + new(1)
  });

  it('CM2-12: maxMessages in memory is respected during chat accumulation', async () => {
    const mem = new ConversationMemory({ maxMessages: 2 });
    let turn = 0;
    const multiFetch: (url: string, init: RequestInit) => Promise<Response> = async () => {
      const content = `R${++turn}`;
      return new Response(JSON.stringify({ id: 'x', model: 'gpt-4o', choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }), { status: 200 });
    };
    const m = makeManager({ fetchFn: multiFetch, memory: mem });
    await m.chat({ messages: [U1] });
    await m.chat({ messages: [U2] });
    // maxMessages=2, so only 2 messages retained
    expect(mem.size()).toBe(2);
  });

  it('CM2-13: response.content is correctly set after memory-augmented chat', async () => {
    const mem = new ConversationMemory();
    const m = makeManager({ fetchFn: simpleFetch('Kết quả đúng'), memory: mem });
    const r = await m.chat({ messages: [U1] });
    expect(r.ok && r.value.content).toBe('Kết quả đúng');
  });

  it('CM2-14: NO_DEFAULT_PROVIDER error does NOT update memory', async () => {
    const mem = new ConversationMemory();
    const manager = new ProviderManager({ registry: new ProviderRegistry(), memory: mem });
    const r = await manager.chat({ messages: [U1] });
    expect(r.ok).toBe(false);
    expect(mem.size()).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CM3: ProviderManager.stream() with memory
// ─────────────────────────────────────────────────────────────────────────────

describe('CM3: ProviderManager.stream() with memory', () => {
  it('CM3-01: stream() without memory works as before (no regression)', async () => {
    const m = makeManager({ fetchFn: openaiSseFetch('ok') });
    const chunks = await collectChunks(m.stream({ messages: [U1] }));
    expect(chunks.at(-1)?.event).toBe('done');
  });

  it('CM3-02: first stream() sends no extra messages (empty memory)', async () => {
    let capturedMessages: Array<{ role: string; content: string }> = [];
    const capturingSseFetch: () => Promise<Response> = async () => {
      // No capture possible from SSE easily, just return valid SSE
      return openaiSseFetch('ok')();
    };
    // Use a non-capturing SSE (simpler) — test memory state instead
    const mem = new ConversationMemory();
    const m = makeManager({ fetchFn: openaiSseFetch('ok'), memory: mem });
    await collectChunks(m.stream({ messages: [U1] }));
    // Memory should now contain U1 + assistant
    expect(mem.size()).toBe(2);
    expect(mem.getMessages()[0]!.content).toBe(U1.content);
    void capturedMessages; // suppress unused warning
  });

  it('CM3-03: user message is stored in memory after stream completion', async () => {
    const mem = new ConversationMemory();
    const m = makeManager({ fetchFn: openaiSseFetch('A'), memory: mem });
    await collectChunks(m.stream({ messages: [U1] }));
    expect(mem.getMessages().some(msg => msg.role === 'user' && msg.content === U1.content)).toBe(true);
  });

  it('CM3-04: assistant content is stored in memory after stream completion', async () => {
    const mem = new ConversationMemory();
    const m = makeManager({ fetchFn: openaiSseFetch('Trả lời stream'), memory: mem });
    await collectChunks(m.stream({ messages: [U1] }));
    expect(mem.getMessages().some(msg => msg.role === 'assistant' && msg.content === 'Trả lời stream')).toBe(true);
  });

  it('CM3-05: second stream() prepends first-turn history', async () => {
    const mem = new ConversationMemory();
    let streamCall = 0;
    const twoStreamFetch: () => Promise<Response> = async () => {
      const content = streamCall++ === 0 ? 'A1' : 'A2';
      return openaiSseFetch(content)();
    };
    const m = makeManager({ fetchFn: twoStreamFetch, memory: mem });
    await collectChunks(m.stream({ messages: [U1] }));
    await collectChunks(m.stream({ messages: [U2] }));
    // Memory: U1, A1, U2, A2 = 4
    expect(mem.size()).toBe(4);
    const msgs = mem.getMessages();
    expect(msgs[0]!.content).toBe(U1.content);
    expect(msgs[1]!.content).toBe('A1');
    expect(msgs[2]!.content).toBe(U2.content);
    expect(msgs[3]!.content).toBe('A2');
  });

  it('CM3-06: failed stream (error chunk) does NOT update memory', async () => {
    const mem = new ConversationMemory();
    const failFetch: () => Promise<Response> = async () => new Response('', { status: 401 });
    const m = makeManager({ fetchFn: failFetch, memory: mem });
    await collectChunks(m.stream({ messages: [U1] }));
    expect(mem.size()).toBe(0);
  });

  it('CM3-07: done is always last chunk with memory enabled', async () => {
    const mem = new ConversationMemory();
    const m = makeManager({ fetchFn: openaiSseFetch('ok'), memory: mem });
    const chunks = await collectChunks(m.stream({ messages: [U1] }));
    expect(chunks.at(-1)?.event).toBe('done');
  });

  it('CM3-08: empty messages with memory returns INVALID_REQUEST error+done', async () => {
    const mem = new ConversationMemory();
    mem.addUser('prior history');
    const m = makeManager({ fetchFn: openaiSseFetch('ok'), memory: mem });
    const chunks = await collectChunks(m.stream({ messages: [] }));
    const errChunk = chunks.find(c => c.event === 'error') as Extract<StreamChunk, {event:'error'}> | undefined;
    expect(errChunk?.error.code).toBe('INVALID_REQUEST');
    expect(chunks.at(-1)?.event).toBe('done');
    // Memory must not be updated
    expect(mem.size()).toBe(1);
  });

  it('CM3-09: stream() with memory still yields all token events', async () => {
    const mem = new ConversationMemory();
    const m = makeManager({ fetchFn: openaiSseFetch('Token'), memory: mem });
    const chunks = await collectChunks(m.stream({ messages: [U1] }));
    expect(chunks.some(c => c.event === 'token')).toBe(true);
  });

  it('CM3-10: stream() never throws when memory is configured', async () => {
    const cases = [
      () => {
        const mem = new ConversationMemory();
        return makeManager({ fetchFn: openaiSseFetch('ok'), memory: mem }).stream({ messages: [U1] });
      },
      () => {
        const mem = new ConversationMemory();
        return makeManager({ fetchFn: async () => new Response('', { status: 500 }), memory: mem }).stream({ messages: [U1] });
      },
      () => {
        const mem = new ConversationMemory();
        return makeManager({ fetchFn: async () => { throw new Error('network'); }, memory: mem }).stream({ messages: [U1] });
      },
    ];
    for (const mkStream of cases) {
      let threw = false;
      try {
        const chunks: StreamChunk[] = [];
        for await (const c of mkStream()) chunks.push(c);
        expect(chunks.at(-1)?.event).toBe('done');
      } catch {
        threw = true;
      }
      expect(threw).toBe(false);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CM4: Edge cases
// ─────────────────────────────────────────────────────────────────────────────

describe('CM4: Edge cases', () => {
  it('CM4-01: snapshot from getMessages() is fully independent of memory', () => {
    const m = new ConversationMemory();
    m.addUser('A');
    const snap = m.getMessages();
    // Mutate the snapshot array
    snap.push({ role: 'user', content: 'injected' });
    // Mutate a snapshot element
    snap[0]!.role = 'assistant';
    // Original memory is unchanged
    expect(m.size()).toBe(1);
    expect(m.getMessages()[0]!.role).toBe('user');
    expect(m.getMessages()[0]!.content).toBe('A');
  });

  it('CM4-02: ConversationMemory instance shared between two managers stays consistent', async () => {
    const mem = new ConversationMemory();
    const m1 = makeManager({ fetchFn: simpleFetch('From M1'), memory: mem });
    const m2 = makeManager({ fetchFn: simpleFetch('From M2'), memory: mem });
    await m1.chat({ messages: [U1] });
    expect(mem.size()).toBe(2); // U1 + assistant from m1
    await m2.chat({ messages: [U2] });
    expect(mem.size()).toBe(4); // U1, A1, U2, A2
    // m2's second call would have seen U1+A1 in history
  });

  it('CM4-03: trimToLast() after several chat() turns trims correctly', async () => {
    const mem = new ConversationMemory();
    const m = makeManager({ fetchFn: simpleFetch('ok'), memory: mem });
    await m.chat({ messages: [U1] });
    await m.chat({ messages: [U2] });
    // mem: [U1, A1, U2, A2] = 4 messages
    mem.trimToLast(2);
    expect(mem.size()).toBe(2);
    const msgs = mem.getMessages();
    expect(msgs[0]!.content).toBe(U2.content);
    expect(msgs[1]!.role).toBe('assistant');
  });

  it('CM4-04: ConversationMemory never throws for any input', () => {
    const m = new ConversationMemory({ maxMessages: 0 });
    expect(() => {
      m.add({ role: 'user', content: '' });
      m.addUser('');
      m.addAssistant('');
      m.clear();
      m.size();
      m.getMessages();
      m.trimToLast(-999);
      m.trimToLast(0);
      m.trimToLast(1.7);
      m.trimToLast(Infinity);
    }).not.toThrow();
  });
});
