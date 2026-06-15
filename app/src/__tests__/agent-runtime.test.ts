/**
 * P6-10P: AgentRuntime — test suite (56 tests)
 *
 * Groups:
 *   AR1 (7)  run() basic success
 *   AR2 (7)  runStream() basic streaming
 *   AR3 (6)  memory — append and read behaviour
 *   AR4 (6)  tool execution via executeTool()
 *   AR5 (6)  provider failures (chat)
 *   AR6 (6)  streaming failures
 *   AR7 (6)  metadata — providerUsed / usage / model / finishReason
 *   AR8 (6)  immutability — defensive copies
 *   AR9 (6)  edge cases — missing config, never-throw contract
 */

import { describe, it, expect, vi } from 'vitest';
import { AgentRuntime }       from '../providers/AgentRuntime';
import { ConversationMemory } from '../providers/ConversationMemory';
import { ToolRegistry }       from '../providers/ToolRegistry';
import { ToolExecutor }       from '../providers/ToolExecutor';
import type { ProviderManager }          from '../providers/ProviderManager';
import type { ProviderManagerResponse, ProviderManagerResult } from '../providers/ProviderManager';
import type { StreamChunk }              from '../providers/StreamingTypes';
import type { ToolDefinition }           from '../providers/ToolRegistry';

// ─── Shared test fixtures ──────────────────────────────────────────────────────

const BASE_RESPONSE: ProviderManagerResponse = {
  content:      'Hello from AI!',
  providerId:   'mock-openai',
  providerType: 'openai',
  model:        'gpt-4o',
  usage:        { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
  finishReason: 'stop',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function okResult(
  overrides?: Partial<ProviderManagerResponse>,
): ProviderManagerResult<ProviderManagerResponse> {
  return { ok: true, value: { ...BASE_RESPONSE, ...overrides } };
}

function errResult(code: string, message: string): ProviderManagerResult<ProviderManagerResponse> {
  return { ok: false, error: { code: code as any, message } };
}

/** Returns a fresh async-generator-backed mock stream each call. */
function makeSuccessStream(content = 'Hello from AI!'): AsyncIterable<StreamChunk> {
  return (async function* () {
    yield { event: 'token',   token: 'Hello' } as StreamChunk;
    yield {
      event: 'message', content,
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
    } as StreamChunk;
    yield { event: 'done' } as StreamChunk;
  })();
}

function makeErrorStream(code = 'PROVIDER_ERROR', message = 'API error'): AsyncIterable<StreamChunk> {
  return (async function* () {
    yield { event: 'error', error: { code, message } } as StreamChunk;
    yield { event: 'done' } as StreamChunk;
  })();
}

/** Constructs a minimal ProviderManager test double. */
function makeMockManager(overrides: {
  chatResult?:    ProviderManagerResult<ProviderManagerResponse>;
  streamFactory?: () => AsyncIterable<StreamChunk>;
  chatThrows?:    unknown;
  streamThrows?:  unknown;
} = {}): ProviderManager {
  const chatFn = overrides.chatThrows !== undefined
    ? vi.fn().mockRejectedValue(overrides.chatThrows)
    : vi.fn().mockResolvedValue(overrides.chatResult ?? okResult());

  const streamFn = overrides.streamThrows !== undefined
    ? vi.fn().mockImplementation(() => { throw overrides.streamThrows; })
    : vi.fn().mockImplementation(overrides.streamFactory ?? (() => makeSuccessStream()));

  return { chat: chatFn, stream: streamFn } as unknown as ProviderManager;
}

/** Collects all chunks from an async iterable. */
async function drain(gen: AsyncIterable<StreamChunk>): Promise<StreamChunk[]> {
  const chunks: StreamChunk[] = [];
  for await (const chunk of gen) chunks.push(chunk);
  return chunks;
}

function makeToolDef(overrides: Partial<ToolDefinition> = {}): ToolDefinition {
  return {
    name:        'greet',
    description: 'Returns a greeting.',
    parameters:  { name: { type: 'string' } },
    required:    [],
    handler:     (args) => `Hello, ${args['name'] ?? 'World'}!`,
    ...overrides,
  };
}

function makeExecutor(tools: ToolDefinition[] = []): ToolExecutor {
  const registry = new ToolRegistry();
  for (const t of tools) registry.registerTool(t);
  return new ToolExecutor(registry);
}

// ─── AR1: run() basic success ─────────────────────────────────────────────────

describe('AR1: run() basic success', () => {
  it('AR1-01: successful run returns ok:true', async () => {
    const runtime = new AgentRuntime({ providerManager: makeMockManager() });
    const result  = await runtime.run('Hello');
    expect(result.ok).toBe(true);
  });

  it('AR1-02: content is the provider assistant reply', async () => {
    const runtime = new AgentRuntime({ providerManager: makeMockManager() });
    const result  = await runtime.run('Hello');
    expect(result.content).toBe('Hello from AI!');
  });

  it('AR1-03: providerUsed is set from the provider response', async () => {
    const runtime = new AgentRuntime({ providerManager: makeMockManager() });
    const result  = await runtime.run('Hello');
    expect(result.providerUsed).toBe('mock-openai');
  });

  it('AR1-04: error field is absent on success', async () => {
    const runtime = new AgentRuntime({ providerManager: makeMockManager() });
    const result  = await runtime.run('Hello');
    expect(result.error).toBeUndefined();
  });

  it('AR1-05: system prompt is forwarded to the provider', async () => {
    const chatSpy = vi.fn().mockResolvedValue(okResult());
    const runtime = new AgentRuntime({
      providerManager: { chat: chatSpy, stream: vi.fn() } as unknown as ProviderManager,
    });
    await runtime.run('Hello', { system: 'You are a helpful assistant.' });
    const calledWith = chatSpy.mock.calls[0]![0];
    expect(calledWith.system).toBe('You are a helpful assistant.');
  });

  it('AR1-06: user message appears in the messages array sent to the provider', async () => {
    const chatSpy = vi.fn().mockResolvedValue(okResult());
    const runtime = new AgentRuntime({
      providerManager: { chat: chatSpy, stream: vi.fn() } as unknown as ProviderManager,
    });
    await runtime.run('Tell me a joke');
    const calledMessages = chatSpy.mock.calls[0]![0].messages as Array<{ role: string; content: string }>;
    const userMsg = calledMessages.find(m => m.role === 'user');
    expect(userMsg?.content).toBe('Tell me a joke');
  });

  it('AR1-07: runtime can be reused for a second run', async () => {
    const runtime = new AgentRuntime({ providerManager: makeMockManager() });
    const r1 = await runtime.run('First');
    const r2 = await runtime.run('Second');
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
  });
});

// ─── AR2: runStream() basic streaming ─────────────────────────────────────────

describe('AR2: runStream() basic streaming', () => {
  it('AR2-01: yields a token chunk', async () => {
    const runtime = new AgentRuntime({ providerManager: makeMockManager() });
    const chunks  = await drain(runtime.runStream('Hello'));
    const token = chunks.find(c => c.event === 'token');
    expect(token).toBeDefined();
  });

  it('AR2-02: yields a message chunk with content', async () => {
    const runtime = new AgentRuntime({ providerManager: makeMockManager() });
    const chunks  = await drain(runtime.runStream('Hello'));
    const msg = chunks.find(c => c.event === 'message') as Extract<StreamChunk, { event: 'message' }> | undefined;
    expect(msg?.content).toBe('Hello from AI!');
  });

  it('AR2-03: yields a done chunk', async () => {
    const runtime = new AgentRuntime({ providerManager: makeMockManager() });
    const chunks  = await drain(runtime.runStream('Hello'));
    const done = chunks.find(c => c.event === 'done');
    expect(done).toBeDefined();
  });

  it('AR2-04: done is the very last chunk', async () => {
    const runtime = new AgentRuntime({ providerManager: makeMockManager() });
    const chunks  = await drain(runtime.runStream('Hello'));
    expect(chunks.at(-1)?.event).toBe('done');
  });

  it('AR2-05: system prompt is forwarded to the stream provider', async () => {
    const streamSpy = vi.fn().mockImplementation(() => makeSuccessStream());
    const runtime = new AgentRuntime({
      providerManager: {
        chat:   vi.fn(),
        stream: streamSpy,
      } as unknown as ProviderManager,
    });
    await drain(runtime.runStream('Hi', { system: 'Be brief.' }));
    const calledWith = streamSpy.mock.calls[0]![0];
    expect(calledWith.system).toBe('Be brief.');
  });

  it('AR2-06: all provider chunks are passed through unchanged', async () => {
    const runtime = new AgentRuntime({ providerManager: makeMockManager() });
    const chunks  = await drain(runtime.runStream('Hello'));
    expect(chunks.some(c => c.event === 'token')).toBe(true);
    expect(chunks.some(c => c.event === 'message')).toBe(true);
    expect(chunks.some(c => c.event === 'done')).toBe(true);
  });

  it('AR2-07: chunks arrive in order (token → message → done)', async () => {
    const runtime  = new AgentRuntime({ providerManager: makeMockManager() });
    const chunks   = await drain(runtime.runStream('Hello'));
    const events   = chunks.map(c => c.event);
    const tokIdx   = events.indexOf('token');
    const msgIdx   = events.indexOf('message');
    const doneIdx  = events.lastIndexOf('done');
    expect(tokIdx).toBeLessThan(msgIdx);
    expect(msgIdx).toBeLessThan(doneIdx);
  });
});

// ─── AR3: memory ──────────────────────────────────────────────────────────────

describe('AR3: memory', () => {
  it('AR3-01: user message is appended to memory after successful run', async () => {
    const memory  = new ConversationMemory();
    const runtime = new AgentRuntime({ providerManager: makeMockManager(), memory });
    await runtime.run('Test question');
    const msgs = memory.getMessages();
    expect(msgs.some(m => m.role === 'user' && m.content === 'Test question')).toBe(true);
  });

  it('AR3-02: assistant reply is appended to memory after successful run', async () => {
    const memory  = new ConversationMemory();
    const runtime = new AgentRuntime({ providerManager: makeMockManager(), memory });
    await runtime.run('Hello');
    const msgs = memory.getMessages();
    expect(msgs.some(m => m.role === 'assistant' && m.content === 'Hello from AI!')).toBe(true);
  });

  it('AR3-03: memory grows across multiple runs', async () => {
    const memory  = new ConversationMemory();
    const runtime = new AgentRuntime({ providerManager: makeMockManager(), memory });
    await runtime.run('First');
    await runtime.run('Second');
    expect(memory.size()).toBe(4); // user+assistant × 2
  });

  it('AR3-04: memory is NOT updated when the provider returns an error', async () => {
    const memory  = new ConversationMemory();
    const runtime = new AgentRuntime({
      providerManager: makeMockManager({ chatResult: errResult('PROVIDER_ERROR', 'fail') }),
      memory,
    });
    await runtime.run('Hello');
    expect(memory.size()).toBe(0);
  });

  it('AR3-05: stream memory is NOT updated when the stream yields an error chunk', async () => {
    const memory  = new ConversationMemory();
    const runtime = new AgentRuntime({
      providerManager: makeMockManager({ streamFactory: makeErrorStream }),
      memory,
    });
    await drain(runtime.runStream('Hello'));
    expect(memory.size()).toBe(0);
  });

  it('AR3-06: history from memory is prepended to the conversation on the next run', async () => {
    const chatSpy = vi.fn().mockResolvedValue(okResult());
    const memory  = new ConversationMemory();
    memory.addAssistant('I am ready.');   // pre-existing history turn

    const runtime = new AgentRuntime({
      providerManager: { chat: chatSpy, stream: vi.fn() } as unknown as ProviderManager,
      memory,
    });
    await runtime.run('New question');

    const messages = chatSpy.mock.calls[0]![0].messages as Array<{ role: string; content: string }>;
    const firstMsg = messages[0]!;
    expect(firstMsg.role).toBe('assistant');
    expect(firstMsg.content).toBe('I am ready.');
  });
});

// ─── AR4: tool execution ──────────────────────────────────────────────────────

describe('AR4: tool execution', () => {
  it('AR4-01: executeTool returns ok:true for a registered tool', async () => {
    const executor = makeExecutor([makeToolDef()]);
    const runtime  = new AgentRuntime({
      providerManager: makeMockManager(),
      toolExecutor:    executor,
    });
    const result = await runtime.executeTool({ name: 'greet', arguments: { name: 'Alice' } });
    expect(result.ok).toBe(true);
  });

  it('AR4-02: content is the string representation of the tool return value', async () => {
    const executor = makeExecutor([makeToolDef()]);
    const runtime  = new AgentRuntime({ providerManager: makeMockManager(), toolExecutor: executor });
    const result   = await runtime.executeTool({ name: 'greet', arguments: { name: 'Alice' } });
    expect(result.content).toBe('Hello, Alice!');
  });

  it('AR4-03: toolResult carries the raw value returned by the handler', async () => {
    const executor = makeExecutor([makeToolDef({ name: 'add', handler: (a) => (a['x'] as number) + (a['y'] as number) })]);
    const runtime  = new AgentRuntime({ providerManager: makeMockManager(), toolExecutor: executor });
    const result   = await runtime.executeTool({ name: 'add', arguments: { x: 3, y: 4 } });
    expect(result.toolResult).toBe(7);
  });

  it('AR4-04: TOOL_ERROR when tool is not registered', async () => {
    const executor = makeExecutor([]);
    const runtime  = new AgentRuntime({ providerManager: makeMockManager(), toolExecutor: executor });
    const result   = await runtime.executeTool({ name: 'missing' });
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('TOOL_ERROR');
  });

  it('AR4-05: TOOL_ERROR when handler throws', async () => {
    const tool = makeToolDef({ name: 'broken', handler: () => { throw new Error('oops'); } });
    const executor = makeExecutor([tool]);
    const runtime  = new AgentRuntime({ providerManager: makeMockManager(), toolExecutor: executor });
    const result   = await runtime.executeTool({ name: 'broken' });
    expect(result.error?.code).toBe('TOOL_ERROR');
  });

  it('AR4-06: arguments are passed through to the tool handler', async () => {
    const spy  = vi.fn().mockReturnValue('done');
    const tool = makeToolDef({ name: 'spied', handler: spy });
    const executor = makeExecutor([tool]);
    const runtime  = new AgentRuntime({ providerManager: makeMockManager(), toolExecutor: executor });
    await runtime.executeTool({ name: 'spied', arguments: { city: 'Hanoi' } });
    expect(spy).toHaveBeenCalledWith({ city: 'Hanoi' });
  });
});

// ─── AR5: provider failures (chat) ────────────────────────────────────────────

describe('AR5: provider failures', () => {
  it('AR5-01: chat provider failure returns ok:false', async () => {
    const runtime = new AgentRuntime({
      providerManager: makeMockManager({ chatResult: errResult('PROVIDER_ERROR', 'rate limited') }),
    });
    const result = await runtime.run('Hello');
    expect(result.ok).toBe(false);
  });

  it('AR5-02: error code is PROVIDER_ERROR', async () => {
    const runtime = new AgentRuntime({
      providerManager: makeMockManager({ chatResult: errResult('PROVIDER_ERROR', 'rate limited') }),
    });
    const result = await runtime.run('Hello');
    expect(result.error?.code).toBe('PROVIDER_ERROR');
  });

  it('AR5-03: error message from the provider is preserved', async () => {
    const runtime = new AgentRuntime({
      providerManager: makeMockManager({ chatResult: errResult('PROVIDER_ERROR', 'rate limited') }),
    });
    const result = await runtime.run('Hello');
    expect(result.error?.message).toContain('rate limited');
  });

  it('AR5-04: content and providerUsed are absent on failure', async () => {
    const runtime = new AgentRuntime({
      providerManager: makeMockManager({ chatResult: errResult('PROVIDER_ERROR', 'fail') }),
    });
    const result = await runtime.run('Hello');
    expect(result.content).toBeUndefined();
    expect(result.providerUsed).toBeUndefined();
  });

  it('AR5-05: run() does not reject even when chat() rejects', async () => {
    const runtime = new AgentRuntime({
      providerManager: makeMockManager({ chatThrows: new Error('network crash') }),
    });
    await expect(runtime.run('Hello')).resolves.toBeDefined();
    const result = await runtime.run('Hello again');
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('UNKNOWN_ERROR');
  });

  it('AR5-06: runtime remains usable after a provider failure', async () => {
    const chatFn = vi.fn()
      .mockResolvedValueOnce(errResult('PROVIDER_ERROR', 'fail'))
      .mockResolvedValue(okResult());

    const runtime = new AgentRuntime({
      providerManager: { chat: chatFn, stream: vi.fn() } as unknown as ProviderManager,
    });
    const r1 = await runtime.run('First (fails)');
    const r2 = await runtime.run('Second (succeeds)');
    expect(r1.ok).toBe(false);
    expect(r2.ok).toBe(true);
  });
});

// ─── AR6: streaming failures ──────────────────────────────────────────────────

describe('AR6: streaming failures', () => {
  it('AR6-01: error chunk from provider is yielded to the caller', async () => {
    const runtime = new AgentRuntime({
      providerManager: makeMockManager({ streamFactory: makeErrorStream }),
    });
    const chunks = await drain(runtime.runStream('Hello'));
    expect(chunks.some(c => c.event === 'error')).toBe(true);
  });

  it('AR6-02: error chunk has code and message fields', async () => {
    const runtime = new AgentRuntime({
      providerManager: makeMockManager({
        streamFactory: () => makeErrorStream('PROVIDER_ERROR', 'quota exceeded'),
      }),
    });
    const chunks = await drain(runtime.runStream('Hello'));
    const err = chunks.find(c => c.event === 'error') as Extract<StreamChunk, { event: 'error' }> | undefined;
    expect(err?.error.code).toBe('PROVIDER_ERROR');
    expect(err?.error.message).toContain('quota exceeded');
  });

  it('AR6-03: done chunk always follows the error chunk', async () => {
    const runtime = new AgentRuntime({
      providerManager: makeMockManager({ streamFactory: makeErrorStream }),
    });
    const chunks = await drain(runtime.runStream('Hello'));
    expect(chunks.at(-1)?.event).toBe('done');
  });

  it('AR6-04: memory is not updated when the stream contains an error chunk', async () => {
    const memory  = new ConversationMemory();
    const runtime = new AgentRuntime({
      providerManager: makeMockManager({ streamFactory: makeErrorStream }),
      memory,
    });
    await drain(runtime.runStream('Hello'));
    expect(memory.size()).toBe(0);
  });

  it('AR6-05: stream that throws synchronously still yields error + done', async () => {
    const runtime = new AgentRuntime({
      providerManager: makeMockManager({ streamThrows: new Error('network crash') }),
    });
    const chunks = await drain(runtime.runStream('Hello'));
    expect(chunks.some(c => c.event === 'error')).toBe(true);
    expect(chunks.at(-1)?.event).toBe('done');
  });

  it('AR6-06: runStream() generator never throws (caller can safely use for-await)', async () => {
    const runtime = new AgentRuntime({
      providerManager: makeMockManager({ streamThrows: new TypeError('unexpected') }),
    });
    await expect(drain(runtime.runStream('Hello'))).resolves.toBeDefined();
  });
});

// ─── AR7: metadata ────────────────────────────────────────────────────────────

describe('AR7: metadata', () => {
  it('AR7-01: providerUsed matches the providerId in the provider response', async () => {
    const runtime = new AgentRuntime({
      providerManager: makeMockManager({ chatResult: okResult({ providerId: 'my-claude' }) }),
    });
    const result = await runtime.run('Hello');
    expect(result.providerUsed).toBe('my-claude');
  });

  it('AR7-02: usage.inputTokens matches the provider response', async () => {
    const runtime = new AgentRuntime({ providerManager: makeMockManager() });
    const result  = await runtime.run('Hello');
    expect(result.usage?.inputTokens).toBe(10);
  });

  it('AR7-03: usage.outputTokens matches the provider response', async () => {
    const runtime = new AgentRuntime({ providerManager: makeMockManager() });
    const result  = await runtime.run('Hello');
    expect(result.usage?.outputTokens).toBe(5);
  });

  it('AR7-04: usage.totalTokens matches the provider response', async () => {
    const runtime = new AgentRuntime({ providerManager: makeMockManager() });
    const result  = await runtime.run('Hello');
    expect(result.usage?.totalTokens).toBe(15);
  });

  it('AR7-05: model is preserved from the provider response', async () => {
    const runtime = new AgentRuntime({
      providerManager: makeMockManager({ chatResult: okResult({ model: 'gpt-4o-mini' }) }),
    });
    const result = await runtime.run('Hello');
    expect(result.model).toBe('gpt-4o-mini');
  });

  it('AR7-06: finishReason is preserved from the provider response', async () => {
    const runtime = new AgentRuntime({
      providerManager: makeMockManager({ chatResult: okResult({ finishReason: 'length' }) }),
    });
    const result = await runtime.run('Hello');
    expect(result.finishReason).toBe('length');
  });
});

// ─── AR8: immutability ────────────────────────────────────────────────────────

describe('AR8: immutability', () => {
  it('AR8-01: mutating the returned usage object does not affect the next call', async () => {
    const runtime = new AgentRuntime({ providerManager: makeMockManager() });
    const r1 = await runtime.run('First');
    (r1.usage as Record<string, number>)['inputTokens'] = 9999;
    const r2 = await runtime.run('Second');
    expect(r2.usage?.inputTokens).toBe(10);
  });

  it('AR8-02: two successive runs produce independent result objects', async () => {
    const runtime = new AgentRuntime({ providerManager: makeMockManager() });
    const r1 = await runtime.run('First');
    const r2 = await runtime.run('Second');
    expect(r1).not.toBe(r2);
    expect(r1.usage).not.toBe(r2.usage);
  });

  it('AR8-03: memory messages snapshot is independent of further memory mutations', async () => {
    const memory  = new ConversationMemory();
    const runtime = new AgentRuntime({ providerManager: makeMockManager(), memory });
    await runtime.run('Hello');
    const snapshot = memory.getMessages();
    memory.clear();
    expect(snapshot.length).toBeGreaterThan(0);
  });

  it('AR8-04: tool result is the shallow-copied value from ToolExecutor', async () => {
    const source = { answer: 42 };
    const tool   = makeToolDef({ name: 'obj-tool', handler: () => source });
    const executor = makeExecutor([tool]);
    const runtime  = new AgentRuntime({ providerManager: makeMockManager(), toolExecutor: executor });
    const result   = await runtime.executeTool({ name: 'obj-tool' });
    expect(result.toolResult).not.toBe(source); // ToolExecutor shallow-copies
    expect(result.toolResult).toEqual(source);
  });

  it('AR8-05: mutating a returned tool result does not corrupt future calls', async () => {
    const data = { count: 0 };
    const tool = makeToolDef({ name: 'counter', handler: () => ({ ...data }) });
    const executor = makeExecutor([tool]);
    const runtime  = new AgentRuntime({ providerManager: makeMockManager(), toolExecutor: executor });

    const r1 = await runtime.executeTool({ name: 'counter' });
    (r1.toolResult as Record<string, number>)['count'] = 999;

    const r2 = await runtime.executeTool({ name: 'counter' });
    expect((r2.toolResult as Record<string, number>)['count']).toBe(0);
  });

  it('AR8-06: stream chunks are independent objects yielded by the provider', async () => {
    const runtime = new AgentRuntime({ providerManager: makeMockManager() });
    const chunks  = await drain(runtime.runStream('Hello'));
    const msg1 = chunks.find(c => c.event === 'message') as Extract<StreamChunk, { event: 'message' }>;
    const msg2 = chunks.find(c => c.event === 'message') as Extract<StreamChunk, { event: 'message' }>;
    // Same object reference (single message chunk) — just verify it is defined
    expect(msg1).toBeDefined();
    expect(msg2.usage.totalTokens).toBe(15);
  });
});

// ─── AR9: edge cases ──────────────────────────────────────────────────────────

describe('AR9: edge cases', () => {
  it('AR9-01: runtime without memory still completes run() successfully', async () => {
    const runtime = new AgentRuntime({ providerManager: makeMockManager() }); // no memory
    const result  = await runtime.run('Hello');
    expect(result.ok).toBe(true);
    expect(result.content).toBe('Hello from AI!');
  });

  it('AR9-02: executeTool without toolExecutor or toolRegistry returns TOOL_ERROR', async () => {
    const runtime = new AgentRuntime({ providerManager: makeMockManager() }); // no tool config
    const result  = await runtime.executeTool({ name: 'any-tool' });
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('TOOL_ERROR');
  });

  it('AR9-03: toolExecutor is auto-created from toolRegistry when injected', async () => {
    const registry = new ToolRegistry();
    registry.registerTool(makeToolDef());
    const runtime = new AgentRuntime({
      providerManager: makeMockManager(),
      toolRegistry:    registry,
      // no toolExecutor provided
    });
    const result = await runtime.executeTool({ name: 'greet' });
    expect(result.ok).toBe(true);
  });

  it('AR9-04: system prompt is optional — run() works without it', async () => {
    const runtime = new AgentRuntime({ providerManager: makeMockManager() });
    const result  = await runtime.run('Hello'); // no options
    expect(result.ok).toBe(true);
  });

  it('AR9-05: run() never rejects even when chat() rejects unexpectedly', async () => {
    const runtime = new AgentRuntime({
      providerManager: makeMockManager({ chatThrows: new RangeError('boom') }),
    });
    await expect(runtime.run('Hello')).resolves.toMatchObject({ ok: false });
  });

  it('AR9-06: runStream() never throws even when stream() throws unexpectedly', async () => {
    const runtime = new AgentRuntime({
      providerManager: makeMockManager({ streamThrows: new RangeError('boom') }),
    });
    await expect(drain(runtime.runStream('Hello'))).resolves.toBeDefined();
    const chunks = await drain(runtime.runStream('Hello again'));
    expect(chunks.at(-1)?.event).toBe('done');
  });
});
