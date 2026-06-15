/**
 * P6-10N: Tests for ToolRegistry.
 *
 * Groups:
 *   TR1 — CRUD: register / unregister / get / list / has            (10)
 *   TR2 — Duplicate registration and DUPLICATE_TOOL error            ( 8)
 *   TR3 — Lookup and listing behaviour                               (10)
 *   TR4 — Immutability: returned copies cannot corrupt registry      ( 8)
 *   TR5 — Edge cases and never-throw guarantees                      ( 6)
 *
 * Total: 42 tests
 */

import { describe, it, expect, vi } from 'vitest';
import { ToolRegistry } from '../providers/ToolRegistry';
import type { ToolDefinition, ToolParameter } from '../providers/ToolRegistry';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeTool(
  name: string,
  overrides?: Partial<Omit<ToolDefinition, 'name'>>,
): ToolDefinition {
  return {
    name,
    description: `Công cụ ${name}`,
    parameters: {
      input: { type: 'string', description: 'Đầu vào' },
    },
    required: ['input'],
    handler: async (args) => `Kết quả: ${String(args['input'] ?? '')}`,
    ...overrides,
  };
}

function makeMultiParamTool(name: string): ToolDefinition {
  return {
    name,
    description: 'Công cụ nhiều tham số',
    parameters: {
      query:    { type: 'string',  description: 'Từ khóa tìm kiếm' },
      limit:    { type: 'number',  description: 'Số kết quả tối đa' },
      active:   { type: 'boolean', description: 'Chỉ tìm mục đang hoạt động' },
      category: { type: 'string',  description: 'Danh mục', enum: ['goods', 'service', 'mixed'] },
    },
    required: ['query'],
    handler: (args) => ({ results: [], query: args['query'] }),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// TR1: CRUD
// ─────────────────────────────────────────────────────────────────────────────

describe('TR1: CRUD', () => {
  it('TR1-01: registerTool returns ok:true with the tool name on success', () => {
    const r = new ToolRegistry();
    const result = r.registerTool(makeTool('search'));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe('search');
  });

  it('TR1-02: hasTool returns true after registerTool', () => {
    const r = new ToolRegistry();
    r.registerTool(makeTool('search'));
    expect(r.hasTool('search')).toBe(true);
  });

  it('TR1-03: hasTool returns false before any registration', () => {
    expect(new ToolRegistry().hasTool('anything')).toBe(false);
  });

  it('TR1-04: getTool returns ok:true and the definition after registration', () => {
    const r = new ToolRegistry();
    r.registerTool(makeTool('calc'));
    const result = r.getTool('calc');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.name).toBe('calc');
      expect(result.value.description).toBe('Công cụ calc');
    }
  });

  it('TR1-05: listTools returns all registered tools in insertion order', () => {
    const r = new ToolRegistry();
    r.registerTool(makeTool('alpha'));
    r.registerTool(makeTool('beta'));
    r.registerTool(makeTool('gamma'));
    const names = r.listTools().map(t => t.name);
    expect(names).toEqual(['alpha', 'beta', 'gamma']);
  });

  it('TR1-06: unregisterTool returns ok:true on success', () => {
    const r = new ToolRegistry();
    r.registerTool(makeTool('x'));
    expect(r.unregisterTool('x').ok).toBe(true);
  });

  it('TR1-07: hasTool returns false after unregisterTool', () => {
    const r = new ToolRegistry();
    r.registerTool(makeTool('x'));
    r.unregisterTool('x');
    expect(r.hasTool('x')).toBe(false);
  });

  it('TR1-08: listTools returns empty array after all tools are unregistered', () => {
    const r = new ToolRegistry();
    r.registerTool(makeTool('a'));
    r.registerTool(makeTool('b'));
    r.unregisterTool('a');
    r.unregisterTool('b');
    expect(r.listTools()).toHaveLength(0);
  });

  it('TR1-09: listTools returns empty array on a fresh registry', () => {
    expect(new ToolRegistry().listTools()).toEqual([]);
  });

  it('TR1-10: registering a tool after unregister re-adds it successfully', () => {
    const r = new ToolRegistry();
    r.registerTool(makeTool('ping'));
    r.unregisterTool('ping');
    const result = r.registerTool(makeTool('ping'));
    expect(result.ok).toBe(true);
    expect(r.hasTool('ping')).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TR2: Duplicate registration
// ─────────────────────────────────────────────────────────────────────────────

describe('TR2: Duplicate registration', () => {
  it('TR2-01: registering a duplicate name returns ok:false', () => {
    const r = new ToolRegistry();
    r.registerTool(makeTool('search'));
    const result = r.registerTool(makeTool('search'));
    expect(result.ok).toBe(false);
  });

  it('TR2-02: duplicate produces DUPLICATE_TOOL error code', () => {
    const r = new ToolRegistry();
    r.registerTool(makeTool('search'));
    const result = r.registerTool(makeTool('search'));
    if (!result.ok) expect(result.error.code).toBe('DUPLICATE_TOOL');
  });

  it('TR2-03: duplicate error message mentions the tool name', () => {
    const r = new ToolRegistry();
    r.registerTool(makeTool('search'));
    const result = r.registerTool(makeTool('search'));
    if (!result.ok) expect(result.error.message).toContain('search');
  });

  it('TR2-04: registry is unchanged after a failed duplicate registration', () => {
    const r = new ToolRegistry();
    const original = makeTool('search', { description: 'Original description' });
    r.registerTool(original);
    r.registerTool(makeTool('search', { description: 'Replacement description' }));
    const got = r.getTool('search');
    if (!got.ok) throw new Error('Expected ok');
    expect(got.value.description).toBe('Original description');
  });

  it('TR2-05: tool count does not increase after a failed duplicate registration', () => {
    const r = new ToolRegistry();
    r.registerTool(makeTool('a'));
    r.registerTool(makeTool('a'));
    expect(r.listTools()).toHaveLength(1);
  });

  it('TR2-06: unregister then re-register with same name succeeds', () => {
    const r = new ToolRegistry();
    r.registerTool(makeTool('tool', { description: 'First' }));
    r.unregisterTool('tool');
    const result = r.registerTool(makeTool('tool', { description: 'Second' }));
    expect(result.ok).toBe(true);
    const got = r.getTool('tool');
    if (!got.ok) throw new Error('Expected ok');
    expect(got.value.description).toBe('Second');
  });

  it('TR2-07: duplicate of one tool does not affect other registered tools', () => {
    const r = new ToolRegistry();
    r.registerTool(makeTool('alpha'));
    r.registerTool(makeTool('beta'));
    r.registerTool(makeTool('alpha'));  // duplicate — should fail silently
    expect(r.hasTool('beta')).toBe(true);
    expect(r.listTools()).toHaveLength(2);
  });

  it('TR2-08: error object from duplicate has both code and message fields', () => {
    const r = new ToolRegistry();
    r.registerTool(makeTool('t'));
    const result = r.registerTool(makeTool('t'));
    if (!result.ok) {
      expect(typeof result.error.code).toBe('string');
      expect(typeof result.error.message).toBe('string');
      expect(result.error.message.length).toBeGreaterThan(0);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TR3: Lookup and listing
// ─────────────────────────────────────────────────────────────────────────────

describe('TR3: Lookup and listing', () => {
  it('TR3-01: getTool on an unregistered name returns ok:false', () => {
    expect(new ToolRegistry().getTool('nope').ok).toBe(false);
  });

  it('TR3-02: getTool on unregistered returns TOOL_NOT_FOUND error code', () => {
    const result = new ToolRegistry().getTool('nope');
    if (!result.ok) expect(result.error.code).toBe('TOOL_NOT_FOUND');
  });

  it('TR3-03: getTool error message contains the missing tool name', () => {
    const result = new ToolRegistry().getTool('mystery-tool');
    if (!result.ok) expect(result.error.message).toContain('mystery-tool');
  });

  it('TR3-04: unregisterTool on unknown name returns TOOL_NOT_FOUND', () => {
    const result = new ToolRegistry().unregisterTool('ghost');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('TOOL_NOT_FOUND');
  });

  it('TR3-05: getTool returns the handler function from the original definition', () => {
    const handler = async (args: Record<string, unknown>) => args['x'];
    const r = new ToolRegistry();
    r.registerTool(makeTool('fn', { handler }));
    const got = r.getTool('fn');
    if (!got.ok) throw new Error('Expected ok');
    expect(got.value.handler).toBe(handler);
  });

  it('TR3-06: getTool returns all parameters with correct types', () => {
    const r = new ToolRegistry();
    r.registerTool(makeMultiParamTool('multi'));
    const got = r.getTool('multi');
    if (!got.ok) throw new Error('Expected ok');
    const params = got.value.parameters;
    expect(params['query']!.type).toBe('string');
    expect(params['limit']!.type).toBe('number');
    expect(params['active']!.type).toBe('boolean');
    expect(params['category']!.enum).toEqual(['goods', 'service', 'mixed']);
  });

  it('TR3-07: getTool preserves the required array', () => {
    const r = new ToolRegistry();
    r.registerTool(makeMultiParamTool('multi'));
    const got = r.getTool('multi');
    if (!got.ok) throw new Error('Expected ok');
    expect(got.value.required).toEqual(['query']);
  });

  it('TR3-08: listTools count increases with each registration', () => {
    const r = new ToolRegistry();
    expect(r.listTools()).toHaveLength(0);
    r.registerTool(makeTool('a'));
    expect(r.listTools()).toHaveLength(1);
    r.registerTool(makeTool('b'));
    expect(r.listTools()).toHaveLength(2);
  });

  it('TR3-09: listTools count decreases after unregisterTool', () => {
    const r = new ToolRegistry();
    r.registerTool(makeTool('a'));
    r.registerTool(makeTool('b'));
    r.unregisterTool('a');
    expect(r.listTools()).toHaveLength(1);
    expect(r.listTools()[0]!.name).toBe('b');
  });

  it('TR3-10: hasTool returns false for every name before first registration', () => {
    const r = new ToolRegistry();
    expect(r.hasTool('')).toBe(false);
    expect(r.hasTool('anything')).toBe(false);
    expect(r.hasTool('undefined')).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TR4: Immutability
// ─────────────────────────────────────────────────────────────────────────────

describe('TR4: Immutability', () => {
  it('TR4-01: mutating a getTool result does not change the stored description', () => {
    const r = new ToolRegistry();
    r.registerTool(makeTool('t'));
    const snap = r.getTool('t');
    if (!snap.ok) throw new Error('Expected ok');
    snap.value.description = 'MUTATED';
    const fresh = r.getTool('t');
    if (!fresh.ok) throw new Error('Expected ok');
    expect(fresh.value.description).toBe('Công cụ t');
  });

  it('TR4-02: mutating a getTool result parameters does not affect registry', () => {
    const r = new ToolRegistry();
    r.registerTool(makeTool('t'));
    const snap = r.getTool('t');
    if (!snap.ok) throw new Error('Expected ok');
    snap.value.parameters['injected'] = { type: 'string' };
    const fresh = r.getTool('t');
    if (!fresh.ok) throw new Error('Expected ok');
    expect(fresh.value.parameters['injected']).toBeUndefined();
  });

  it('TR4-03: mutating a getTool result required array does not affect registry', () => {
    const r = new ToolRegistry();
    r.registerTool(makeTool('t'));
    const snap = r.getTool('t');
    if (!snap.ok) throw new Error('Expected ok');
    snap.value.required.push('injected');
    const fresh = r.getTool('t');
    if (!fresh.ok) throw new Error('Expected ok');
    expect(fresh.value.required).toEqual(['input']);
  });

  it('TR4-04: mutating a listTools result does not affect the registry list', () => {
    const r = new ToolRegistry();
    r.registerTool(makeTool('a'));
    r.registerTool(makeTool('b'));
    const list = r.listTools();
    list[0]!.description = 'MUTATED';
    list.push(makeTool('injected'));
    expect(r.listTools()).toHaveLength(2);
    expect(r.listTools()[0]!.description).toBe('Công cụ a');
  });

  it('TR4-05: mutating the original tool object after registerTool does not affect registry', () => {
    const r = new ToolRegistry();
    const tool = makeTool('orig');
    r.registerTool(tool);
    tool.description = 'EXTERNAL MUTATION';
    tool.required.push('extra');
    (tool.parameters as Record<string, ToolParameter>)['secret'] = { type: 'number' };
    const got = r.getTool('orig');
    if (!got.ok) throw new Error('Expected ok');
    expect(got.value.description).toBe('Công cụ orig');
    expect(got.value.required).toEqual(['input']);
    expect(got.value.parameters['secret']).toBeUndefined();
  });

  it('TR4-06: mutating parameter description in getTool result does not affect registry', () => {
    const r = new ToolRegistry();
    r.registerTool(makeMultiParamTool('m'));
    const snap = r.getTool('m');
    if (!snap.ok) throw new Error('Expected ok');
    snap.value.parameters['query']!.description = 'HACKED';
    const fresh = r.getTool('m');
    if (!fresh.ok) throw new Error('Expected ok');
    expect(fresh.value.parameters['query']!.description).toBe('Từ khóa tìm kiếm');
  });

  it('TR4-07: mutating enum array in getTool result does not affect registry', () => {
    const r = new ToolRegistry();
    r.registerTool(makeMultiParamTool('m'));
    const snap = r.getTool('m');
    if (!snap.ok) throw new Error('Expected ok');
    snap.value.parameters['category']!.enum!.push('INJECTED');
    const fresh = r.getTool('m');
    if (!fresh.ok) throw new Error('Expected ok');
    expect(fresh.value.parameters['category']!.enum).toEqual(['goods', 'service', 'mixed']);
  });

  it('TR4-08: two getTool calls return independent objects', () => {
    const r = new ToolRegistry();
    r.registerTool(makeTool('t'));
    const a = r.getTool('t');
    const b = r.getTool('t');
    if (!a.ok || !b.ok) throw new Error('Expected ok');
    expect(a.value).not.toBe(b.value);
    expect(a.value.parameters).not.toBe(b.value.parameters);
    expect(a.value.required).not.toBe(b.value.required);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TR5: Edge cases and never-throw
// ─────────────────────────────────────────────────────────────────────────────

describe('TR5: Edge cases and never-throw', () => {
  it('TR5-01: ToolRegistry never throws for any sequence of valid operations', () => {
    expect(() => {
      const r = new ToolRegistry();
      r.listTools();
      r.hasTool('none');
      r.getTool('none');
      r.unregisterTool('none');
      r.registerTool(makeTool('x'));
      r.getTool('x');
      r.hasTool('x');
      r.listTools();
      r.unregisterTool('x');
      r.hasTool('x');
      r.getTool('x');
      r.listTools();
    }).not.toThrow();
  });

  it('TR5-02: tool with empty required array is valid', () => {
    const r = new ToolRegistry();
    const result = r.registerTool(makeTool('noReq', { required: [] }));
    expect(result.ok).toBe(true);
    const got = r.getTool('noReq');
    if (!got.ok) throw new Error('Expected ok');
    expect(got.value.required).toEqual([]);
  });

  it('TR5-03: tool with empty parameters map is valid', () => {
    const r = new ToolRegistry();
    const result = r.registerTool(makeTool('noParams', { parameters: {}, required: [] }));
    expect(result.ok).toBe(true);
    const got = r.getTool('noParams');
    if (!got.ok) throw new Error('Expected ok');
    expect(Object.keys(got.value.parameters)).toHaveLength(0);
  });

  it('TR5-04: handler function reference is preserved through getTool', async () => {
    const spy = vi.fn().mockReturnValue('ok');
    const r = new ToolRegistry();
    r.registerTool(makeTool('spy', { handler: spy }));
    const got = r.getTool('spy');
    if (!got.ok) throw new Error('Expected ok');
    await got.value.handler({ input: 'test' });
    expect(spy).toHaveBeenCalledWith({ input: 'test' });
  });

  it('TR5-05: independent ToolRegistry instances do not share state', () => {
    const r1 = new ToolRegistry();
    const r2 = new ToolRegistry();
    r1.registerTool(makeTool('shared'));
    expect(r2.hasTool('shared')).toBe(false);
    expect(r2.listTools()).toHaveLength(0);
  });

  it('TR5-06: ToolRegistryResult error objects have non-empty message strings', () => {
    const r = new ToolRegistry();
    const notFound = r.getTool('ghost');
    const notFoundUnreg = r.unregisterTool('ghost');
    r.registerTool(makeTool('dup'));
    const duplicate = r.registerTool(makeTool('dup'));
    for (const result of [notFound, notFoundUnreg, duplicate]) {
      if (!result.ok) {
        expect(result.error.message.length).toBeGreaterThan(0);
        expect(typeof result.error.code).toBe('string');
      }
    }
  });
});
