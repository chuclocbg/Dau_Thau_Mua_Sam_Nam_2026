/**
 * P6-10U: ToolCallingAgent test suite — 56 tests across 12 groups (TC1–TC12).
 *
 * Groups:
 *   TC1  (5)  basic tool detection
 *   TC2  (5)  OpenAI format
 *   TC3  (5)  Claude format
 *   TC4  (5)  Gemini format
 *   TC5  (5)  generic JSON
 *   TC6  (5)  tool execution
 *   TC7  (5)  multi-tool chain
 *   TC8  (5)  iteration loop
 *   TC9  (4)  maxIterations
 *   TC10 (4)  provider failures
 *   TC11 (4)  edge cases
 *   TC12 (4)  never-throw
 */

import { describe, it, expect, vi } from 'vitest';

import {
  ToolCallingAgent,
  type ToolCall,
  type ToolCallResult,
} from '../providers/ToolCallingAgent';

import { ToolRegistry }        from '../providers/ToolRegistry';
import { ConversationMemory }  from '../providers/ConversationMemory';
import type { ProviderManager } from '../providers/ProviderManager';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a mock ProviderManager that returns `responses` in sequence. */
function makeMockManager(
  responses: Array<string | { ok: false; error: { code: string; message: string } }>,
): ProviderManager {
  let idx = 0;
  const chat = vi.fn().mockImplementation(async () => {
    const resp = responses[Math.min(idx++, responses.length - 1)];
    if (typeof resp === 'string') {
      return {
        ok:    true,
        value: {
          content:      resp,
          providerId:   'mock',
          providerType: 'openai',
          model:        'gpt-4',
          usage:        { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
          finishReason: 'stop',
        },
      };
    }
    return resp;
  });
  return { chat } as unknown as ProviderManager;
}

/** Build a ToolRegistry with a "greet" tool that returns a greeting. */
function makeRegistry(): ToolRegistry {
  const reg = new ToolRegistry();
  reg.registerTool({
    name:        'greet',
    description: 'greet a person',
    parameters:  { name: { type: 'string', description: 'who to greet' } },
    required:    [],
    handler:     (args) => `Hello, ${args.name ?? 'World'}!`,
  });
  return reg;
}

/** Build a ToolRegistry with a noop tool (for iteration-limit tests). */
function makeNoopRegistry(): ToolRegistry {
  const reg = new ToolRegistry();
  reg.registerTool({
    name:        'noop',
    description: 'does nothing',
    parameters:  {},
    required:    [],
    handler:     () => undefined,
  });
  return reg;
}

/** OpenAI-format tool-call content. */
const OAI = (name: string, args: Record<string, unknown> = {}) =>
  `<tool_call>${JSON.stringify({ name, arguments: args })}</tool_call>`;

/** Claude-format tool-call content. */
const CLA = (name: string, args: Record<string, unknown> = {}) =>
  `<tool_use><name>${name}</name><input>${JSON.stringify(args)}</input></tool_use>`;

/** Gemini-format tool-call content. */
const GEM = (name: string, args: Record<string, unknown> = {}) =>
  JSON.stringify({ functionCall: { name, args } });

/** Generic JSON tool-call content. */
const GEN = (name: string, args: Record<string, unknown> = {}) =>
  JSON.stringify({ tool: name, arguments: args });

// ─── TC1: basic tool detection (5) ───────────────────────────────────────────

describe('TC1 basic tool detection', () => {
  const agent = new ToolCallingAgent({ providerManager: makeMockManager([]) });

  it('TC1-01: detectToolCalls returns empty array when content has no tool calls', () => {
    expect(agent.detectToolCalls('Hello, world!')).toEqual([]);
  });

  it('TC1-02: detectToolCalls returns one call when exactly one is present', () => {
    const calls = agent.detectToolCalls(OAI('greet', { name: 'Alice' }));
    expect(calls).toHaveLength(1);
  });

  it('TC1-03: detectToolCalls preserves the tool name', () => {
    const calls = agent.detectToolCalls(OAI('my_tool', { x: 1 }));
    expect(calls[0].name).toBe('my_tool');
  });

  it('TC1-04: detectToolCalls preserves the arguments object', () => {
    const calls = agent.detectToolCalls(OAI('calc', { a: 1, b: 2 }));
    expect(calls[0].arguments).toEqual({ a: 1, b: 2 });
  });

  it('TC1-05: detectToolCalls returns multiple calls from mixed content', () => {
    const content = OAI('tool-a') + ' some text ' + OAI('tool-b');
    const calls   = agent.detectToolCalls(content);
    expect(calls.map(c => c.name).sort()).toEqual(['tool-a', 'tool-b']);
  });
});

// ─── TC2: OpenAI format (5) ───────────────────────────────────────────────────

describe('TC2 OpenAI format', () => {
  const agent = new ToolCallingAgent({ providerManager: makeMockManager([]) });

  it('TC2-01: detects a single <tool_call> block', () => {
    const calls = agent.detectToolCalls('<tool_call>{"name":"greet","arguments":{}}</tool_call>');
    expect(calls).toHaveLength(1);
  });

  it('TC2-02: extracts the tool name from OpenAI format', () => {
    const calls = agent.detectToolCalls(OAI('weather', { city: 'Hanoi' }));
    expect(calls[0].name).toBe('weather');
  });

  it('TC2-03: extracts arguments from OpenAI format', () => {
    const calls = agent.detectToolCalls(OAI('add', { a: 10, b: 20 }));
    expect(calls[0].arguments).toEqual({ a: 10, b: 20 });
  });

  it('TC2-04: detects multiple <tool_call> blocks in one string', () => {
    const content = OAI('foo') + '\n' + OAI('bar');
    const calls   = agent.detectToolCalls(content);
    expect(calls).toHaveLength(2);
  });

  it('TC2-05: ignores malformed <tool_call> content (non-JSON inner text)', () => {
    const content = '<tool_call>NOT_JSON</tool_call>';
    const calls   = agent.detectToolCalls(content);
    expect(calls).toHaveLength(0);
  });
});

// ─── TC3: Claude format (5) ───────────────────────────────────────────────────

describe('TC3 Claude format', () => {
  const agent = new ToolCallingAgent({ providerManager: makeMockManager([]) });

  it('TC3-01: detects a single <tool_use> block', () => {
    const calls = agent.detectToolCalls(CLA('search', { query: 'test' }));
    expect(calls).toHaveLength(1);
  });

  it('TC3-02: extracts tool name from <name> tag', () => {
    const calls = agent.detectToolCalls(CLA('my_fn', {}));
    expect(calls[0].name).toBe('my_fn');
  });

  it('TC3-03: extracts arguments from <input> tag', () => {
    const calls = agent.detectToolCalls(CLA('calc', { x: 7 }));
    expect(calls[0].arguments).toEqual({ x: 7 });
  });

  it('TC3-04: handles Claude block with empty <input>', () => {
    const content = '<tool_use><name>ping</name><input></input></tool_use>';
    const calls   = agent.detectToolCalls(content);
    expect(calls).toHaveLength(1);
    expect(calls[0].arguments).toEqual({});
  });

  it('TC3-05: detects multiple <tool_use> blocks', () => {
    const content = CLA('fn-a') + ' text ' + CLA('fn-b');
    const calls   = agent.detectToolCalls(content);
    expect(calls.map(c => c.name).sort()).toEqual(['fn-a', 'fn-b']);
  });
});

// ─── TC4: Gemini format (5) ───────────────────────────────────────────────────

describe('TC4 Gemini format', () => {
  const agent = new ToolCallingAgent({ providerManager: makeMockManager([]) });

  it('TC4-01: detects a JSON object with "functionCall" key', () => {
    const calls = agent.detectToolCalls(GEM('geoCode', { address: 'Hanoi' }));
    expect(calls).toHaveLength(1);
  });

  it('TC4-02: extracts tool name from functionCall.name', () => {
    const calls = agent.detectToolCalls(GEM('translate', {}));
    expect(calls[0].name).toBe('translate');
  });

  it('TC4-03: extracts arguments from functionCall.args', () => {
    const calls = agent.detectToolCalls(GEM('pow', { base: 2, exp: 8 }));
    expect(calls[0].arguments).toEqual({ base: 2, exp: 8 });
  });

  it('TC4-04: detects two functionCall objects in one content string', () => {
    const content = GEM('alpha') + ' ' + GEM('beta');
    const calls   = agent.detectToolCalls(content);
    expect(calls.map(c => c.name).sort()).toEqual(['alpha', 'beta']);
  });

  it('TC4-05: ignores plain JSON objects that lack a "functionCall" key', () => {
    const calls = agent.detectToolCalls('{"name":"foo","arguments":{}}');
    expect(calls).toHaveLength(0);
  });
});

// ─── TC5: generic JSON (5) ────────────────────────────────────────────────────

describe('TC5 generic JSON', () => {
  const agent = new ToolCallingAgent({ providerManager: makeMockManager([]) });

  it('TC5-01: detects {"tool":"…","arguments":{}} pattern', () => {
    const calls = agent.detectToolCalls(GEN('lookup', { id: '42' }));
    expect(calls).toHaveLength(1);
  });

  it('TC5-02: extracts tool name from "tool" field', () => {
    const calls = agent.detectToolCalls(GEN('my_tool'));
    expect(calls[0].name).toBe('my_tool');
  });

  it('TC5-03: extracts arguments from "arguments" field', () => {
    const calls = agent.detectToolCalls(GEN('sum', { values: [1, 2, 3] }));
    expect(calls[0].arguments).toEqual({ values: [1, 2, 3] });
  });

  it('TC5-04: detects multiple generic JSON blocks in one string', () => {
    const content = GEN('first') + ' ' + GEN('second');
    const calls   = agent.detectToolCalls(content);
    expect(calls.map(c => c.name).sort()).toEqual(['first', 'second']);
  });

  it('TC5-05: ignores JSON objects without a "tool" key', () => {
    const calls = agent.detectToolCalls('{"name":"bar","params":{}}');
    expect(calls).toHaveLength(0);
  });
});

// ─── TC6: tool execution (5) ──────────────────────────────────────────────────

describe('TC6 tool execution', () => {
  const reg   = makeRegistry();
  const agent = new ToolCallingAgent({
    providerManager: makeMockManager([]),
    toolRegistry:    reg,
  });

  it('TC6-01: executeToolCalls invokes the registry tool for each call', async () => {
    const calls: ToolCall[] = [{ name: 'greet', arguments: { name: 'Alice' } }];
    const results           = await agent.executeToolCalls(calls);
    expect(results).toHaveLength(1);
  });

  it('TC6-02: returns ToolCallResult with result on success', async () => {
    const calls   = [{ name: 'greet', arguments: { name: 'Bob' } }];
    const results = await agent.executeToolCalls(calls);
    expect(results[0].result).toBe('Hello, Bob!');
    expect(results[0].error).toBeUndefined();
  });

  it('TC6-03: returns ToolCallResult with error when tool handler throws', async () => {
    const failReg = new ToolRegistry();
    failReg.registerTool({
      name: 'fail', description: 'throws', parameters: {}, required: [],
      handler: () => { throw new Error('intentional'); },
    });
    const a       = new ToolCallingAgent({ providerManager: makeMockManager([]), toolRegistry: failReg });
    const results = await a.executeToolCalls([{ name: 'fail', arguments: {} }]);
    expect(results[0].error).toBeDefined();
    expect(results[0].result).toBeUndefined();
  });

  it('TC6-04: includes non-negative durationMs in every result', async () => {
    const results = await agent.executeToolCalls([{ name: 'greet', arguments: {} }]);
    expect(results[0].durationMs).toBeGreaterThanOrEqual(0);
  });

  it('TC6-05: run() returns NO_TOOL when LLM references an unregistered tool', async () => {
    const emptyReg = new ToolRegistry(); // no tools
    const manager  = makeMockManager([OAI('ghost')]); // LLM calls "ghost"
    const a        = new ToolCallingAgent({ providerManager: manager, toolRegistry: emptyReg });
    const result   = await a.run('test');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error?.code).toBe('NO_TOOL');
  });
});

// ─── TC7: multi-tool chain (5) ────────────────────────────────────────────────

describe('TC7 multi-tool chain', () => {
  it('TC7-01: run() collects multiple tool calls from one LLM response', async () => {
    const twoCallsContent = OAI('greet', { name: 'Alice' }) + ' ' + OAI('greet', { name: 'Bob' });
    const manager = makeMockManager([twoCallsContent, 'Done.']);
    const agent   = new ToolCallingAgent({ providerManager: manager, toolRegistry: makeRegistry() });
    const result  = await agent.run('hi');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.toolCalls).toHaveLength(2);
  });

  it('TC7-02: all detected tool calls are executed', async () => {
    const twoCallsContent = OAI('greet', { name: 'X' }) + ' ' + OAI('greet', { name: 'Y' });
    const manager = makeMockManager([twoCallsContent, 'Done.']);
    const agent   = new ToolCallingAgent({ providerManager: manager, toolRegistry: makeRegistry() });
    const result  = await agent.run('hi');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.toolResults).toHaveLength(2);
  });

  it('TC7-03: tool results are accumulated in toolResults', async () => {
    const content = OAI('greet', { name: 'Alice' }) + OAI('greet', { name: 'Bob' });
    const manager = makeMockManager([content, 'Done.']);
    const agent   = new ToolCallingAgent({ providerManager: manager, toolRegistry: makeRegistry() });
    const result  = await agent.run('hi');
    if (result.ok) {
      expect(result.toolResults!.every(r => r.result !== undefined)).toBe(true);
    }
  });

  it('TC7-04: provider is called again after tool injection', async () => {
    const manager = makeMockManager([OAI('greet'), 'Final.']);
    const agent   = new ToolCallingAgent({ providerManager: manager, toolRegistry: makeRegistry() });
    await agent.run('go');
    expect(manager.chat as ReturnType<typeof vi.fn>).toHaveBeenCalledTimes(2);
  });

  it('TC7-05: returns the final LLM response once no more tool calls are present', async () => {
    const manager = makeMockManager([OAI('greet', { name: 'Eve' }), 'Hello, Eve!']);
    const agent   = new ToolCallingAgent({ providerManager: manager, toolRegistry: makeRegistry() });
    const result  = await agent.run('greet');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.content).toBe('Hello, Eve!');
  });
});

// ─── TC8: iteration loop (5) ──────────────────────────────────────────────────

describe('TC8 iteration loop', () => {
  it('TC8-01: run() sends the userMessage as the first chat message', async () => {
    const manager = makeMockManager(['No tools here.']);
    const agent   = new ToolCallingAgent({ providerManager: manager });
    await agent.run('What time is it?');
    const firstCall = (manager.chat as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(firstCall.messages[0].content).toBe('What time is it?');
  });

  it('TC8-02: run() loops when each iteration produces a tool call', async () => {
    // Two tool-call iterations then a final response
    const manager = makeMockManager([OAI('greet'), OAI('greet'), 'Done.']);
    const agent   = new ToolCallingAgent({ providerManager: manager, toolRegistry: makeRegistry() });
    const result  = await agent.run('go');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.iterations).toBe(3);
  });

  it('TC8-03: iterations count matches the number of LLM calls', async () => {
    const manager = makeMockManager(['Plain response.']);
    const agent   = new ToolCallingAgent({ providerManager: manager });
    const result  = await agent.run('hello');
    if (result.ok) expect(result.iterations).toBe(1);
  });

  it('TC8-04: usage is accumulated across all iterations', async () => {
    // 2 iterations (1 tool call + 1 final); each has totalTokens:15
    const manager = makeMockManager([OAI('greet'), 'Done.']);
    const agent   = new ToolCallingAgent({ providerManager: manager, toolRegistry: makeRegistry() });
    const result  = await agent.run('go');
    if (result.ok) expect(result.usage?.totalTokens).toBe(30);
  });

  it('TC8-05: memory is updated with userMessage + final content on success', async () => {
    const memory  = new ConversationMemory();
    const manager = makeMockManager(['Final reply.']);
    const agent   = new ToolCallingAgent({ providerManager: manager, memory });
    await agent.run('user input');
    const msgs = memory.getMessages();
    expect(msgs).toHaveLength(2);
    expect(msgs[0]).toEqual({ role: 'user',      content: 'user input' });
    expect(msgs[1]).toEqual({ role: 'assistant', content: 'Final reply.' });
  });
});

// ─── TC9: maxIterations (4) ───────────────────────────────────────────────────

describe('TC9 maxIterations', () => {
  it('TC9-01: MAX_ITERATIONS_EXCEEDED after default 10 iterations', async () => {
    const reg     = makeNoopRegistry();
    const manager = makeMockManager([OAI('noop')]); // always tool call
    const agent   = new ToolCallingAgent({ providerManager: manager, toolRegistry: reg });
    const result  = await agent.run('loop');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error?.code).toBe('MAX_ITERATIONS_EXCEEDED');
    expect(manager.chat as ReturnType<typeof vi.fn>).toHaveBeenCalledTimes(10);
  });

  it('TC9-02: MAX_ITERATIONS_EXCEEDED respects a custom maxIterations of 3', async () => {
    const reg     = makeNoopRegistry();
    const manager = makeMockManager([OAI('noop')]);
    const agent   = new ToolCallingAgent({ providerManager: manager, toolRegistry: reg });
    const result  = await agent.run('loop', { maxIterations: 3 });
    expect(result.ok).toBe(false);
    expect(manager.chat as ReturnType<typeof vi.fn>).toHaveBeenCalledTimes(3);
  });

  it('TC9-03: error code is MAX_ITERATIONS_EXCEEDED', async () => {
    const reg     = makeNoopRegistry();
    const manager = makeMockManager([OAI('noop')]);
    const agent   = new ToolCallingAgent({ providerManager: manager, toolRegistry: reg });
    const result  = await agent.run('loop', { maxIterations: 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error?.code).toBe('MAX_ITERATIONS_EXCEEDED');
      expect(result.error?.code).not.toBe('PROVIDER_ERROR');
    }
  });

  it('TC9-04: result is ok:false when limit is exceeded', async () => {
    const reg     = makeNoopRegistry();
    const manager = makeMockManager([OAI('noop')]);
    const agent   = new ToolCallingAgent({ providerManager: manager, toolRegistry: reg });
    const result  = await agent.run('loop', { maxIterations: 2 });
    expect(result.ok).toBe(false);
  });
});

// ─── TC10: provider failures (4) ──────────────────────────────────────────────

describe('TC10 provider failures', () => {
  it('TC10-01: run() returns PROVIDER_ERROR when provider chat fails', async () => {
    const errResp = { ok: false as const, error: { code: 'PROVIDER_ERROR', message: 'API down' } };
    const manager = makeMockManager([errResp]);
    const agent   = new ToolCallingAgent({ providerManager: manager });
    const result  = await agent.run('test');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error?.code).toBe('PROVIDER_ERROR');
  });

  it('TC10-02: error code is PROVIDER_ERROR (not INVALID_INPUT)', async () => {
    const errResp = { ok: false as const, error: { code: 'PROVIDER_ERROR', message: 'timeout' } };
    const manager = makeMockManager([errResp]);
    const agent   = new ToolCallingAgent({ providerManager: manager });
    const result  = await agent.run('test');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error?.code).not.toBe('INVALID_INPUT');
  });

  it('TC10-03: run() fails immediately on first provider error', async () => {
    const errResp = { ok: false as const, error: { code: 'PROVIDER_ERROR', message: 'fail' } };
    const manager = makeMockManager([errResp]);
    const agent   = new ToolCallingAgent({ providerManager: manager });
    await agent.run('test');
    expect(manager.chat as ReturnType<typeof vi.fn>).toHaveBeenCalledTimes(1);
  });

  it('TC10-04: PROVIDER_ERROR message is preserved from the provider error', async () => {
    const errResp = { ok: false as const, error: { code: 'PROVIDER_ERROR', message: 'rate limit exceeded' } };
    const manager = makeMockManager([errResp]);
    const agent   = new ToolCallingAgent({ providerManager: manager });
    const result  = await agent.run('test');
    if (!result.ok) expect(result.error?.message).toContain('rate limit exceeded');
  });
});

// ─── TC11: edge cases (4) ─────────────────────────────────────────────────────

describe('TC11 edge cases', () => {
  it('TC11-01: INVALID_INPUT when userMessage is empty string', async () => {
    const agent  = new ToolCallingAgent({ providerManager: makeMockManager([]) });
    const result = await agent.run('');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error?.code).toBe('INVALID_INPUT');
  });

  it('TC11-02: run() with no toolExecutor and no tool calls in response succeeds', async () => {
    const manager = makeMockManager(['Plain text response.']);
    const agent   = new ToolCallingAgent({ providerManager: manager }); // no toolExec
    const result  = await agent.run('hello');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.content).toBe('Plain text response.');
  });

  it('TC11-03: injectToolResults output contains tool name and result', () => {
    const agent   = new ToolCallingAgent({ providerManager: makeMockManager([]) });
    const results: ToolCallResult[] = [{
      call:       { name: 'greet', arguments: { name: 'World' } },
      result:     'Hello, World!',
      durationMs: 5,
    }];
    const injected = agent.injectToolResults(results);
    expect(injected).toContain('greet');
    expect(injected).toContain('Hello, World!');
  });

  it('TC11-04: run() returns final response immediately when no tool calls detected', async () => {
    const manager = makeMockManager(['Final answer.']);
    const agent   = new ToolCallingAgent({ providerManager: manager });
    const result  = await agent.run('What is 2+2?');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.iterations).toBe(1);
      expect(result.content).toBe('Final answer.');
    }
  });
});

// ─── TC12: never-throw (4) ────────────────────────────────────────────────────

describe('TC12 never-throw', () => {
  it('TC12-01: detectToolCalls never throws for any input', () => {
    const agent = new ToolCallingAgent({ providerManager: makeMockManager([]) });
    const cases = [undefined, null, '', 0, {}, '<malformed>', '{{{{', ']]'];
    for (const input of cases) {
      expect(() => agent.detectToolCalls(input as string)).not.toThrow();
    }
  });

  it('TC12-02: executeToolCalls never rejects even with no toolExecutor', async () => {
    const agent  = new ToolCallingAgent({ providerManager: makeMockManager([]) });
    const result = await agent.executeToolCalls([{ name: 'ghost', arguments: {} }]);
    expect(Array.isArray(result)).toBe(true);
    expect(result[0].error).toBeDefined();
  });

  it('TC12-03: run() never rejects when provider.chat rejects unexpectedly', async () => {
    const manager = {
      chat: vi.fn().mockRejectedValue(new Error('unexpected crash')),
    } as unknown as ProviderManager;
    const agent  = new ToolCallingAgent({ providerManager: manager });
    const result = await agent.run('hello');
    expect(result).toBeDefined();
    expect(result.ok).toBe(false);
  });

  it('TC12-04: all public methods handle empty/edge-case inputs without throwing', () => {
    const agent = new ToolCallingAgent({ providerManager: makeMockManager([]) });
    expect(() => agent.detectToolCalls('')).not.toThrow();
    expect(() => agent.injectToolResults([])).not.toThrow();
    expect(async () => agent.executeToolCalls([])).not.toThrow();
  });
});
