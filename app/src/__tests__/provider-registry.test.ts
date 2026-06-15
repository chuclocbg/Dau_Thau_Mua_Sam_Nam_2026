/**
 * P6-10D: Unit tests for ProviderRegistry and ILLMProvider abstraction.
 *
 * Groups:
 *   RG — register() / unregister()          (13 tests)
 *   QU — get() / has() / list()             ( 9 tests)
 *   DF — getDefault() / setDefault()        (10 tests)
 *   IT — integration with concrete providers (12 tests)
 *   NE — never-throw safety                 ( 5 tests)
 *
 * Total: 49 tests
 *
 * Rules:
 *   - RG/QU/DF/NE use lightweight mock ILLMProvider objects.
 *   - IT uses real OpenAIProvider / ClaudeProvider / GeminiProvider instances
 *     with no-op fetchFn to avoid any network calls.
 *   - No side effects between tests; each test creates its own registry.
 */

import { describe, it, expect } from 'vitest';
import {
  ProviderRegistry,
  type ILLMProvider,
  type ProviderEntry,
  type ProviderId,
  type ProviderType,
} from '../providers/ProviderRegistry';
import { OpenAIProvider } from '../providers/OpenAIProvider';
import { ClaudeProvider } from '../providers/ClaudeProvider';
import { GeminiProvider } from '../providers/GeminiProvider';

// ─── Test helpers ─────────────────────────────────────────────────────────────

/** Minimal ILLMProvider mock — no network, satisfies the interface structurally. */
function mockProvider(modelId = 'test-model'): ILLMProvider {
  return {
    validateConfig: () => ({ ok: true }),
    getModelInfo:   () => ({
      modelId,
      maxContextTokens: 4_096,
      supportsVision:   false,
      description:      `Mock model: ${modelId}`,
    }),
  };
}

/** Build a ProviderEntry with sensible defaults. */
function makeEntry(
  id:       ProviderId,
  type:     ProviderType = 'openai',
  name:     string       = `${id}-provider`,
  provider: ILLMProvider = mockProvider(),
): ProviderEntry {
  return { id, type, name, provider };
}

/** Fresh registry for each test. */
function reg(): ProviderRegistry {
  return new ProviderRegistry();
}

// Concrete provider factories — no real HTTP calls.
const noopFetch = async (): Promise<Response> =>
  new Response('{}', { status: 200 });

function openaiInstance(): OpenAIProvider {
  return new OpenAIProvider({ apiKey: 'sk-test', model: 'gpt-4o', fetchFn: noopFetch });
}
function claudeInstance(): ClaudeProvider {
  return new ClaudeProvider({ apiKey: 'sk-ant-test', model: 'claude-3-5-sonnet-latest', fetchFn: noopFetch });
}
function geminiInstance(): GeminiProvider {
  return new GeminiProvider({ apiKey: 'goog-test', model: 'gemini-2.5-flash', fetchFn: noopFetch });
}

// ─── RG: register / unregister ───────────────────────────────────────────────

describe('RG: register() / unregister()', () => {
  it('RG-01: new registry starts with no entries', () => {
    expect(reg().list()).toHaveLength(0);
  });

  it('RG-02: register new entry returns ok:true with the id', () => {
    const r = reg().register(makeEntry('openai'));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe('openai');
  });

  it('RG-03: register duplicate id returns DUPLICATE_ID error', () => {
    const registry = reg();
    registry.register(makeEntry('openai'));
    const r = registry.register(makeEntry('openai'));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('DUPLICATE_ID');
  });

  it('RG-04: register with overwrite:true replaces existing entry', () => {
    const registry = reg();
    const first  = mockProvider('gpt-4o');
    const second = mockProvider('gpt-4o-mini');
    registry.register(makeEntry('openai', 'openai', 'first',  first));
    const r = registry.register(makeEntry('openai', 'openai', 'second', second), { overwrite: true });
    expect(r.ok).toBe(true);
  });

  it('RG-05: overwritten entry is the new instance, not the old one', () => {
    const registry = reg();
    const second = mockProvider('replaced-model');
    registry.register(makeEntry('openai', 'openai', 'old', mockProvider('old-model')));
    registry.register(makeEntry('openai', 'openai', 'new', second), { overwrite: true });
    const got = registry.get('openai');
    expect(got.ok && got.value.provider).toBe(second);
  });

  it('RG-06: registered entry is retrievable via get()', () => {
    const registry = reg();
    const entry = makeEntry('claude', 'anthropic');
    registry.register(entry);
    const got = registry.get('claude');
    expect(got.ok).toBe(true);
    if (got.ok) expect(got.value.id).toBe('claude');
  });

  it('RG-07: unregister existing id returns ok:true', () => {
    const registry = reg();
    registry.register(makeEntry('gemini'));
    const r = registry.unregister('gemini');
    expect(r.ok).toBe(true);
  });

  it('RG-08: unregister nonexistent id returns NOT_FOUND', () => {
    const r = reg().unregister('gemini');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('NOT_FOUND');
  });

  it('RG-09: after unregister, has() returns false', () => {
    const registry = reg();
    registry.register(makeEntry('openai'));
    registry.unregister('openai');
    expect(registry.has('openai')).toBe(false);
  });

  it('RG-10: after unregister, get() returns NOT_FOUND', () => {
    const registry = reg();
    registry.register(makeEntry('openai'));
    registry.unregister('openai');
    const r = registry.get('openai');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('NOT_FOUND');
  });

  it('RG-11: can re-register a provider after unregistering it', () => {
    const registry = reg();
    registry.register(makeEntry('claude'));
    registry.unregister('claude');
    const r = registry.register(makeEntry('claude'));
    expect(r.ok).toBe(true);
  });

  it('RG-12: multiple distinct providers can be registered together', () => {
    const registry = reg();
    registry.register(makeEntry('openai'));
    registry.register(makeEntry('claude', 'anthropic'));
    registry.register(makeEntry('gemini', 'google'));
    expect(registry.list()).toHaveLength(3);
  });

  it('RG-13: register() returns the exact id passed in', () => {
    const r = reg().register(makeEntry('gemini'));
    expect(r.ok && r.value).toBe('gemini');
  });
});

// ─── QU: get / has / list ─────────────────────────────────────────────────────

describe('QU: get() / has() / list()', () => {
  it('QU-01: get() registered id returns ok:true with the entry', () => {
    const registry = reg();
    registry.register(makeEntry('openai'));
    const r = registry.get('openai');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.id).toBe('openai');
  });

  it('QU-02: get() unregistered id returns NOT_FOUND', () => {
    const r = reg().get('claude');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('NOT_FOUND');
  });

  it('QU-03: has() returns true for a registered id', () => {
    const registry = reg();
    registry.register(makeEntry('gemini'));
    expect(registry.has('gemini')).toBe(true);
  });

  it('QU-04: has() returns false for an unregistered id', () => {
    expect(reg().has('openai')).toBe(false);
  });

  it('QU-05: list() on empty registry returns []', () => {
    expect(reg().list()).toEqual([]);
  });

  it('QU-06: list() returns correct count after multiple registrations', () => {
    const registry = reg();
    registry.register(makeEntry('openai'));
    registry.register(makeEntry('claude', 'anthropic'));
    expect(registry.list()).toHaveLength(2);
  });

  it('QU-07: list() entries have the correct id field', () => {
    const registry = reg();
    registry.register(makeEntry('gemini', 'google'));
    const [entry] = registry.list();
    expect(entry?.id).toBe('gemini');
  });

  it('QU-08: list() entries have the correct type field', () => {
    const registry = reg();
    registry.register(makeEntry('claude', 'anthropic'));
    const [entry] = registry.list();
    expect(entry?.type).toBe('anthropic');
  });

  it('QU-09: list() entries carry the registered provider instance', () => {
    const registry = reg();
    const provider = mockProvider('my-model');
    registry.register(makeEntry('openai', 'openai', 'test', provider));
    const [entry] = registry.list();
    expect(entry?.provider).toBe(provider);
  });
});

// ─── DF: getDefault / setDefault ─────────────────────────────────────────────

describe('DF: getDefault() / setDefault()', () => {
  it('DF-01: getDefault() on fresh registry returns NO_DEFAULT', () => {
    const r = reg().getDefault();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('NO_DEFAULT');
  });

  it('DF-02: setDefault() registered id returns ok:true', () => {
    const registry = reg();
    registry.register(makeEntry('openai'));
    const r = registry.setDefault('openai');
    expect(r.ok).toBe(true);
  });

  it('DF-03: setDefault() unregistered id returns NOT_FOUND', () => {
    const r = reg().setDefault('claude');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('NOT_FOUND');
  });

  it('DF-04: getDefault() after setDefault() returns the correct entry', () => {
    const registry = reg();
    registry.register(makeEntry('claude', 'anthropic'));
    registry.setDefault('claude');
    const r = registry.getDefault();
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.id).toBe('claude');
  });

  it('DF-05: setDefault() twice — last call wins', () => {
    const registry = reg();
    registry.register(makeEntry('openai'));
    registry.register(makeEntry('gemini', 'google'));
    registry.setDefault('openai');
    registry.setDefault('gemini');
    const r = registry.getDefault();
    expect(r.ok && r.value.id).toBe('gemini');
  });

  it('DF-06: unregistering the default clears it; getDefault() returns NO_DEFAULT', () => {
    const registry = reg();
    registry.register(makeEntry('openai'));
    registry.setDefault('openai');
    registry.unregister('openai');
    const r = registry.getDefault();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('NO_DEFAULT');
  });

  it('DF-07: setDefault() returns the exact id passed in', () => {
    const registry = reg();
    registry.register(makeEntry('gemini'));
    const r = registry.setDefault('gemini');
    expect(r.ok && r.value).toBe('gemini');
  });

  it('DF-08: can set default to any of the three supported provider ids', () => {
    const registry = reg();
    registry.register(makeEntry('openai'));
    registry.register(makeEntry('claude',  'anthropic'));
    registry.register(makeEntry('gemini',  'google'));
    for (const id of ['openai', 'claude', 'gemini'] as const) {
      const r = registry.setDefault(id);
      expect(r.ok).toBe(true);
      const def = registry.getDefault();
      expect(def.ok && def.value.id).toBe(id);
    }
  });

  it('DF-09: getDefault().value.provider is the exact registered instance', () => {
    const registry = reg();
    const provider = mockProvider('sentinel');
    registry.register(makeEntry('claude', 'anthropic', 'test', provider));
    registry.setDefault('claude');
    const r = registry.getDefault();
    expect(r.ok && r.value.provider).toBe(provider);
  });

  it('DF-10: re-registering after unregister + setDefault makes getDefault work again', () => {
    const registry = reg();
    registry.register(makeEntry('openai'));
    registry.setDefault('openai');
    registry.unregister('openai');              // clears default
    registry.register(makeEntry('openai'));     // re-register
    registry.setDefault('openai');             // set again
    const r = registry.getDefault();
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.id).toBe('openai');
  });
});

// ─── IT: integration with concrete providers ──────────────────────────────────

describe('IT: integration with OpenAIProvider / ClaudeProvider / GeminiProvider', () => {
  it('IT-01: OpenAIProvider satisfies ILLMProvider (can be stored with type openai)', () => {
    const registry = reg();
    const entry: ProviderEntry = {
      id:       'openai',
      type:     'openai',
      name:     'OpenAI GPT-4o',
      provider: openaiInstance(),   // no 'as ILLMProvider' cast needed
    };
    const r = registry.register(entry);
    expect(r.ok).toBe(true);
  });

  it('IT-02: ClaudeProvider satisfies ILLMProvider (can be stored with type anthropic)', () => {
    const registry = reg();
    const entry: ProviderEntry = {
      id:       'claude',
      type:     'anthropic',
      name:     'Anthropic Claude',
      provider: claudeInstance(),
    };
    const r = registry.register(entry);
    expect(r.ok).toBe(true);
  });

  it('IT-03: GeminiProvider satisfies ILLMProvider (can be stored with type google)', () => {
    const registry = reg();
    const entry: ProviderEntry = {
      id:       'gemini',
      type:     'google',
      name:     'Google Gemini',
      provider: geminiInstance(),
    };
    const r = registry.register(entry);
    expect(r.ok).toBe(true);
  });

  it('IT-04: get("openai") returns the registered OpenAIProvider instance', () => {
    const registry = reg();
    const instance = openaiInstance();
    registry.register({ id: 'openai', type: 'openai', name: 'OpenAI', provider: instance });
    const r = registry.get('openai');
    expect(r.ok && r.value.provider).toBe(instance);
  });

  it('IT-05: get("claude") returns the registered ClaudeProvider instance', () => {
    const registry = reg();
    const instance = claudeInstance();
    registry.register({ id: 'claude', type: 'anthropic', name: 'Claude', provider: instance });
    const r = registry.get('claude');
    expect(r.ok && r.value.provider).toBe(instance);
  });

  it('IT-06: get("gemini") returns the registered GeminiProvider instance', () => {
    const registry = reg();
    const instance = geminiInstance();
    registry.register({ id: 'gemini', type: 'google', name: 'Gemini', provider: instance });
    const r = registry.get('gemini');
    expect(r.ok && r.value.provider).toBe(instance);
  });

  it('IT-07: register all three concrete providers; list() returns 3 entries', () => {
    const registry = reg();
    registry.register({ id: 'openai', type: 'openai',     name: 'OpenAI', provider: openaiInstance() });
    registry.register({ id: 'claude', type: 'anthropic',  name: 'Claude', provider: claudeInstance() });
    registry.register({ id: 'gemini', type: 'google',     name: 'Gemini', provider: geminiInstance() });
    expect(registry.list()).toHaveLength(3);
  });

  it('IT-08: validateConfig() is callable through the ILLMProvider interface', () => {
    const registry = reg();
    registry.register({ id: 'openai', type: 'openai', name: 'OpenAI', provider: openaiInstance() });
    const r = registry.get('openai');
    if (!r.ok) throw new Error('expected ok');
    const result = r.value.provider.validateConfig();
    expect(typeof result.ok).toBe('boolean');
  });

  it('IT-09: getModelInfo() is callable through the ILLMProvider interface', () => {
    const registry = reg();
    registry.register({ id: 'claude', type: 'anthropic', name: 'Claude', provider: claudeInstance() });
    const r = registry.get('claude');
    if (!r.ok) throw new Error('expected ok');
    const info = r.value.provider.getModelInfo('claude-opus-4-20250514');
    expect(info.modelId).toBe('claude-opus-4-20250514');
  });

  it('IT-10: setDefault("gemini"), getDefault().value.type is "google"', () => {
    const registry = reg();
    registry.register({ id: 'openai', type: 'openai',    name: 'OpenAI', provider: openaiInstance() });
    registry.register({ id: 'gemini', type: 'google',    name: 'Gemini', provider: geminiInstance() });
    registry.setDefault('gemini');
    const r = registry.getDefault();
    expect(r.ok && r.value.type).toBe('google');
  });

  it('IT-11: overwrite openai with a new instance; list() count remains 3', () => {
    const registry = reg();
    registry.register({ id: 'openai', type: 'openai',    name: 'OpenAI', provider: openaiInstance() });
    registry.register({ id: 'claude', type: 'anthropic', name: 'Claude', provider: claudeInstance() });
    registry.register({ id: 'gemini', type: 'google',    name: 'Gemini', provider: geminiInstance() });
    registry.register({ id: 'openai', type: 'openai',    name: 'OpenAI v2', provider: openaiInstance() }, { overwrite: true });
    expect(registry.list()).toHaveLength(3);
  });

  it('IT-12: full workflow — register all, setDefault, unregister, getDefault fails', () => {
    const registry = reg();
    registry.register({ id: 'openai', type: 'openai',    name: 'OpenAI', provider: openaiInstance() });
    registry.register({ id: 'claude', type: 'anthropic', name: 'Claude', provider: claudeInstance() });
    registry.register({ id: 'gemini', type: 'google',    name: 'Gemini', provider: geminiInstance() });
    registry.setDefault('claude');
    expect(registry.getDefault().ok).toBe(true);
    registry.unregister('claude');
    const r = registry.getDefault();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('NO_DEFAULT');
    expect(registry.list()).toHaveLength(2);
  });
});

// ─── NE: never-throw safety ───────────────────────────────────────────────────

describe('NE: never-throw safety', () => {
  it('NE-01: get() with unregistered id never throws', () => {
    expect(() => reg().get('claude')).not.toThrow();
  });

  it('NE-02: setDefault() with unregistered id never throws', () => {
    expect(() => reg().setDefault('gemini')).not.toThrow();
  });

  it('NE-03: unregister() with unregistered id never throws', () => {
    expect(() => reg().unregister('openai')).not.toThrow();
  });

  it('NE-04: getDefault() on empty registry never throws', () => {
    expect(() => reg().getDefault()).not.toThrow();
  });

  it('NE-05: duplicate register without overwrite never throws', () => {
    const registry = reg();
    registry.register(makeEntry('openai'));
    expect(() => registry.register(makeEntry('openai'))).not.toThrow();
  });
});
