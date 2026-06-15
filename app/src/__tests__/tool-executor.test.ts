/**
 * P6-10O: ToolExecutor — test suite (42 tests)
 *
 * Groups:
 *   TE1 (6)  Normal sync execution
 *   TE2 (5)  Async execution
 *   TE3 (5)  Tool not found
 *   TE4 (6)  Handler throws
 *   TE5 (5)  Timeout
 *   TE6 (5)  Metadata
 *   TE7 (5)  Immutability
 *   TE8 (5)  Edge cases
 */

import { describe, it, expect, vi } from 'vitest';
import { ToolRegistry }  from '../providers/ToolRegistry';
import { ToolExecutor }  from '../providers/ToolExecutor';
import type { ToolDefinition } from '../providers/ToolRegistry';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeTool(overrides: Partial<ToolDefinition> = {}): ToolDefinition {
  return {
    name:        'echo',
    description: 'Returns its input.',
    parameters:  { value: { type: 'string' } },
    required:    [],
    handler:     (args) => args['value'] ?? 'default',
    ...overrides,
  };
}

function makeExecutor(tools: ToolDefinition[] = []): ToolExecutor {
  const registry = new ToolRegistry();
  for (const t of tools) registry.registerTool(t);
  return new ToolExecutor(registry);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── TE1: Normal sync execution ───────────────────────────────────────────────

describe('TE1: Normal sync execution', () => {
  it('TE1-01: ok is true for a successful sync handler', async () => {
    const executor = makeExecutor([makeTool()]);
    const result   = await executor.execute({ name: 'echo', arguments: { value: 'hello' } });
    expect(result.ok).toBe(true);
  });

  it('TE1-02: result field contains the handler return value', async () => {
    const executor = makeExecutor([makeTool()]);
    const result   = await executor.execute({ name: 'echo', arguments: { value: 'hello' } });
    expect(result.result).toBe('hello');
  });

  it('TE1-03: toolName matches the call name', async () => {
    const executor = makeExecutor([makeTool({ name: 'greet' })]);
    const result   = await executor.execute({ name: 'greet', arguments: {} });
    expect(result.toolName).toBe('greet');
  });

  it('TE1-04: durationMs is a non-negative number', async () => {
    const executor = makeExecutor([makeTool()]);
    const result   = await executor.execute({ name: 'echo', arguments: { value: 'hi' } });
    expect(typeof result.durationMs).toBe('number');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('TE1-05: error field is absent on success', async () => {
    const executor = makeExecutor([makeTool()]);
    const result   = await executor.execute({ name: 'echo', arguments: {} });
    expect(result.error).toBeUndefined();
  });

  it('TE1-06: handler receives the exact arguments passed in the call', async () => {
    const spy = vi.fn().mockReturnValue('done');
    const executor = makeExecutor([makeTool({ name: 'spy', handler: spy })]);
    await executor.execute({ name: 'spy', arguments: { x: 42, y: 'abc' } });
    expect(spy).toHaveBeenCalledWith({ x: 42, y: 'abc' });
  });
});

// ─── TE2: Async execution ─────────────────────────────────────────────────────

describe('TE2: Async execution', () => {
  it('TE2-01: async handler returning a value yields ok:true', async () => {
    const tool = makeTool({ name: 'async-echo', handler: async (args) => args['value'] });
    const executor = makeExecutor([tool]);
    const result   = await executor.execute({ name: 'async-echo', arguments: { value: 'world' } });
    expect(result.ok).toBe(true);
  });

  it('TE2-02: async handler result is captured correctly', async () => {
    const tool = makeTool({ name: 'async-add', handler: async (args) => {
      const a = args['a'] as number;
      const b = args['b'] as number;
      return a + b;
    }});
    const executor = makeExecutor([tool]);
    const result   = await executor.execute({ name: 'async-add', arguments: { a: 3, b: 4 } });
    expect(result.result).toBe(7);
  });

  it('TE2-03: async handler that introduces a real delay completes correctly', async () => {
    const tool = makeTool({ name: 'delayed', handler: async () => {
      await sleep(10);
      return 'done';
    }});
    const executor = makeExecutor([tool]);
    const result   = await executor.execute({ name: 'delayed' });
    expect(result.ok).toBe(true);
    expect(result.result).toBe('done');
  });

  it('TE2-04: async handler returning a plain object yields ok:true', async () => {
    const tool = makeTool({ name: 'async-obj', handler: async () => ({ a: 1, b: 2 }) });
    const executor = makeExecutor([tool]);
    const result   = await executor.execute({ name: 'async-obj' });
    expect(result.ok).toBe(true);
    expect(result.result).toEqual({ a: 1, b: 2 });
  });

  it('TE2-05: async handler returning an array yields ok:true with all elements', async () => {
    const tool = makeTool({ name: 'async-arr', handler: async () => [10, 20, 30] });
    const executor = makeExecutor([tool]);
    const result   = await executor.execute({ name: 'async-arr' });
    expect(result.ok).toBe(true);
    expect(result.result).toEqual([10, 20, 30]);
  });
});

// ─── TE3: Tool not found ──────────────────────────────────────────────────────

describe('TE3: Tool not found', () => {
  it('TE3-01: executing an unknown tool yields ok:false', async () => {
    const executor = makeExecutor([]);
    const result   = await executor.execute({ name: 'missing' });
    expect(result.ok).toBe(false);
  });

  it('TE3-02: error code is TOOL_NOT_FOUND', async () => {
    const executor = makeExecutor([]);
    const result   = await executor.execute({ name: 'missing' });
    expect(result.error?.code).toBe('TOOL_NOT_FOUND');
  });

  it('TE3-03: error message contains the tool name', async () => {
    const executor = makeExecutor([]);
    const result   = await executor.execute({ name: 'no-such-tool' });
    expect(result.error?.message).toContain('no-such-tool');
  });

  it('TE3-04: toolName is still set even when the tool is not found', async () => {
    const executor = makeExecutor([]);
    const result   = await executor.execute({ name: 'ghost' });
    expect(result.toolName).toBe('ghost');
  });

  it('TE3-05: result field is absent when tool is not found', async () => {
    const executor = makeExecutor([]);
    const r = await executor.execute({ name: 'missing' });
    expect(r.result).toBeUndefined();
  });
});

// ─── TE4: Handler throws ──────────────────────────────────────────────────────

describe('TE4: Handler throws', () => {
  it('TE4-01: sync throw yields ok:false', async () => {
    const tool = makeTool({ name: 'sync-throw', handler: () => { throw new Error('boom'); } });
    const executor = makeExecutor([tool]);
    const result   = await executor.execute({ name: 'sync-throw' });
    expect(result.ok).toBe(false);
  });

  it('TE4-02: sync throw → TOOL_EXECUTION_FAILED', async () => {
    const tool = makeTool({ name: 'sync-throw', handler: () => { throw new Error('boom'); } });
    const executor = makeExecutor([tool]);
    const result   = await executor.execute({ name: 'sync-throw' });
    expect(result.error?.code).toBe('TOOL_EXECUTION_FAILED');
  });

  it('TE4-03: async rejection yields ok:false', async () => {
    const tool = makeTool({ name: 'async-throw', handler: async () => { throw new Error('async boom'); } });
    const executor = makeExecutor([tool]);
    const result   = await executor.execute({ name: 'async-throw' });
    expect(result.ok).toBe(false);
  });

  it('TE4-04: async rejection → TOOL_EXECUTION_FAILED', async () => {
    const tool = makeTool({ name: 'async-throw', handler: async () => { throw new Error('async boom'); } });
    const executor = makeExecutor([tool]);
    const result   = await executor.execute({ name: 'async-throw' });
    expect(result.error?.code).toBe('TOOL_EXECUTION_FAILED');
  });

  it('TE4-05: error.cause preserves the original thrown value', async () => {
    const originalError = new TypeError('type mismatch');
    const tool = makeTool({ name: 'err-cause', handler: () => { throw originalError; } });
    const executor = makeExecutor([tool]);
    const result   = await executor.execute({ name: 'err-cause' });
    expect(result.error?.cause).toBe(originalError);
  });

  it('TE4-06: non-Error thrown values are also captured as cause', async () => {
    const tool = makeTool({ name: 'str-throw', handler: () => { throw 'string error'; } });
    const executor = makeExecutor([tool]);
    const result   = await executor.execute({ name: 'str-throw' });
    expect(result.error?.code).toBe('TOOL_EXECUTION_FAILED');
    expect(result.error?.cause).toBe('string error');
  });
});

// ─── TE5: Timeout ─────────────────────────────────────────────────────────────

describe('TE5: Timeout', () => {
  it('TE5-01: slow handler + short timeout → ok:false', async () => {
    const tool = makeTool({ name: 'slow', handler: () => sleep(200).then(() => 'late') });
    const executor = makeExecutor([tool]);
    const result   = await executor.execute({ name: 'slow' }, { timeoutMs: 20 });
    expect(result.ok).toBe(false);
  }, 500);

  it('TE5-02: slow handler + short timeout → TIMEOUT', async () => {
    const tool = makeTool({ name: 'slow2', handler: () => sleep(200).then(() => 'late') });
    const executor = makeExecutor([tool]);
    const result   = await executor.execute({ name: 'slow2' }, { timeoutMs: 20 });
    expect(result.error?.code).toBe('TIMEOUT');
  }, 500);

  it('TE5-03: fast handler + long timeout → ok:true (completes before deadline)', async () => {
    const tool = makeTool({ name: 'fast', handler: () => 'quick' });
    const executor = makeExecutor([tool]);
    const result   = await executor.execute({ name: 'fast' }, { timeoutMs: 5000 });
    expect(result.ok).toBe(true);
    expect(result.result).toBe('quick');
  });

  it('TE5-04: durationMs is set when timeout fires', async () => {
    const tool = makeTool({ name: 'slow3', handler: () => sleep(200).then(() => 'late') });
    const executor = makeExecutor([tool]);
    const result   = await executor.execute({ name: 'slow3' }, { timeoutMs: 20 });
    expect(typeof result.durationMs).toBe('number');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  }, 500);

  it('TE5-05: no-timeout path still resolves correctly with an async handler', async () => {
    const tool = makeTool({ name: 'fast-async', handler: async () => 42 });
    const executor = makeExecutor([tool]);
    const result   = await executor.execute({ name: 'fast-async' });
    expect(result.ok).toBe(true);
    expect(result.result).toBe(42);
  });
});

// ─── TE6: Metadata ────────────────────────────────────────────────────────────

describe('TE6: Metadata', () => {
  it('TE6-01: durationMs is a number >= 0 on success', async () => {
    const executor = makeExecutor([makeTool()]);
    const result   = await executor.execute({ name: 'echo' });
    expect(typeof result.durationMs).toBe('number');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('TE6-02: toolName matches the name in the call object', async () => {
    const executor = makeExecutor([makeTool({ name: 'my-tool' })]);
    const result   = await executor.execute({ name: 'my-tool' });
    expect(result.toolName).toBe('my-tool');
  });

  it('TE6-03: ok is true on success', async () => {
    const executor = makeExecutor([makeTool()]);
    const result   = await executor.execute({ name: 'echo' });
    expect(result.ok).toBe(true);
  });

  it('TE6-04: ok is false on handler error', async () => {
    const tool = makeTool({ name: 'fail', handler: () => { throw new Error(); } });
    const executor = makeExecutor([tool]);
    const result   = await executor.execute({ name: 'fail' });
    expect(result.ok).toBe(false);
  });

  it('TE6-05: result is absent on failure; error is absent on success', async () => {
    const failTool = makeTool({ name: 'fail2', handler: () => { throw new Error(); } });
    const executor = makeExecutor([makeTool(), failTool]);
    const successResult = await executor.execute({ name: 'echo' });
    const failResult    = await executor.execute({ name: 'fail2' });
    expect(successResult.error).toBeUndefined();
    expect(failResult.result).toBeUndefined();
  });
});

// ─── TE7: Immutability ────────────────────────────────────────────────────────

describe('TE7: Immutability', () => {
  it('TE7-01: mutating the returned object result does not affect the next call', async () => {
    const stored = { count: 0 };
    const tool = makeTool({ name: 'counter', handler: () => ({ ...stored }) });
    const executor = makeExecutor([tool]);

    const r1 = await executor.execute({ name: 'counter' });
    (r1.result as Record<string, number>)['count'] = 999;

    const r2 = await executor.execute({ name: 'counter' });
    expect((r2.result as Record<string, number>)['count']).toBe(0);
  });

  it('TE7-02: returned array result is a new reference (shallow copy)', async () => {
    const source = [1, 2, 3];
    const tool = makeTool({ name: 'arr', handler: () => source });
    const executor = makeExecutor([tool]);
    const result   = await executor.execute({ name: 'arr' });
    expect(result.result).not.toBe(source);
  });

  it('TE7-03: returned object result is a new reference (shallow copy)', async () => {
    const obj  = { x: 1 };
    const tool = makeTool({ name: 'obj', handler: () => obj });
    const executor = makeExecutor([tool]);
    const result   = await executor.execute({ name: 'obj' });
    expect(result.result).not.toBe(obj);
  });

  it('TE7-04: mutating a returned array result does not corrupt the source reference', async () => {
    const source = [1, 2, 3];
    const tool   = makeTool({ name: 'arr2', handler: () => source });
    const executor = makeExecutor([tool]);
    const result   = await executor.execute({ name: 'arr2' });
    (result.result as number[]).push(99);
    expect(source).toEqual([1, 2, 3]);
  });

  it('TE7-05: two successive executions produce independent result objects', async () => {
    const tool = makeTool({ name: 'pair', handler: () => ({ v: 0 }) });
    const executor = makeExecutor([tool]);
    const r1 = await executor.execute({ name: 'pair' });
    const r2 = await executor.execute({ name: 'pair' });
    expect(r1.result).not.toBe(r2.result);
  });
});

// ─── TE8: Edge cases ──────────────────────────────────────────────────────────

describe('TE8: Edge cases', () => {
  it('TE8-01: missing required argument → INVALID_ARGUMENTS', async () => {
    const tool = makeTool({ name: 'req', required: ['city'] });
    const executor = makeExecutor([tool]);
    const result   = await executor.execute({ name: 'req', arguments: {} });
    expect(result.error?.code).toBe('INVALID_ARGUMENTS');
  });

  it('TE8-02: INVALID_ARGUMENTS message names the missing key', async () => {
    const tool = makeTool({ name: 'req2', required: ['zipcode'] });
    const executor = makeExecutor([tool]);
    const result   = await executor.execute({ name: 'req2', arguments: {} });
    expect(result.error?.message).toContain('zipcode');
  });

  it('TE8-03: omitting arguments field defaults to {} — still validates required keys', async () => {
    const tool = makeTool({ name: 'req3', required: ['token'] });
    const executor = makeExecutor([tool]);
    const result   = await executor.execute({ name: 'req3' }); // no arguments key
    expect(result.error?.code).toBe('INVALID_ARGUMENTS');
  });

  it('TE8-04: handler returning undefined yields ok:true with result undefined', async () => {
    const tool = makeTool({ name: 'void-handler', handler: () => undefined });
    const executor = makeExecutor([tool]);
    const result   = await executor.execute({ name: 'void-handler' });
    expect(result.ok).toBe(true);
    expect(result.result).toBeUndefined();
  });

  it('TE8-05: ToolExecutor.execute() never rejects for any valid input sequence', async () => {
    const throwingTool = makeTool({ name: 'always-throws', handler: () => { throw new Error('nope'); } });
    const executor = makeExecutor([throwingTool]);

    // None of these should reject
    await expect(executor.execute({ name: 'always-throws' })).resolves.toBeDefined();
    await expect(executor.execute({ name: 'no-such-tool' })).resolves.toBeDefined();
    await expect(executor.execute({ name: 'always-throws' }, { timeoutMs: 0 })).resolves.toBeDefined();
  });
});
