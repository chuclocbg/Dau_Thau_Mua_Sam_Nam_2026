/**
 * P6-12I: PluginManager — named plugin registry tests.
 *
 * 56 tests grouped PM1-PM12.
 *
 * Groups:
 *   PM1  (5) Constructor / initial state
 *   PM2  (5) register() — valid plugins
 *   PM3  (5) register() — invalid plugins (INVALID_PLUGIN)
 *   PM4  (5) register() — duplicate names (DUPLICATE_PLUGIN)
 *   PM5  (5) unregister()
 *   PM6  (5) get()
 *   PM7  (4) has()
 *   PM8  (4) size()
 *   PM9  (4) clear()
 *   PM10 (4) list() + defensive copies
 *   PM11 (4) Defensive copies (register / get)
 *   PM12 (6) Never throw / edge cases
 */

import { describe, it, expect } from 'vitest';
import {
  PluginManager,
  type PluginInfo,
  type PluginResult,
  type PluginError,
  type PluginErrorCode,
} from '../providers/PluginManager';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makePlugin(name: string, extras: Partial<PluginInfo> = {}): PluginInfo {
  return { name, ...extras };
}

function extractValue<T>(r: PluginResult<T>): T {
  if (!r.ok) throw new Error(`Expected ok result; got error: ${r.error.code}`);
  return r.value;
}

// ─── PM1: Constructor / initial state ────────────────────────────────────────

describe('PM1: Constructor / initial state', () => {
  it('PM1-01: new PluginManager() constructs without throwing', () => {
    expect(() => new PluginManager()).not.toThrow();
  });

  it('PM1-02: size() returns 0 initially', () => {
    expect(new PluginManager().size()).toBe(0);
  });

  it('PM1-03: list() returns [] initially', () => {
    expect(new PluginManager().list()).toEqual([]);
  });

  it('PM1-04: clear() on empty registry is a safe no-op', () => {
    const pm = new PluginManager();
    expect(() => pm.clear()).not.toThrow();
    expect(pm.size()).toBe(0);
  });

  it('PM1-05: has() returns false initially for any name', () => {
    const pm = new PluginManager();
    expect(pm.has('nonexistent')).toBe(false);
  });
});

// ─── PM2: register() — valid plugins ─────────────────────────────────────────

describe('PM2: register() — valid plugins', () => {
  it('PM2-01: register({ name }) returns { ok: true, value: PluginInfo }', () => {
    const pm = new PluginManager();
    const r = pm.register({ name: 'alpha' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.name).toBe('alpha');
  });

  it('PM2-02: register() increases size()', () => {
    const pm = new PluginManager();
    pm.register({ name: 'a' });
    pm.register({ name: 'b' });
    expect(pm.size()).toBe(2);
  });

  it('PM2-03: registered plugin is retrievable via get()', () => {
    const pm = new PluginManager();
    pm.register({ name: 'beta', version: '2.0' });
    const r = pm.get('beta');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.version).toBe('2.0');
  });

  it('PM2-04: registered plugin appears in list()', () => {
    const pm = new PluginManager();
    pm.register({ name: 'gamma' });
    const names = pm.list().map((p) => p.name);
    expect(names).toContain('gamma');
  });

  it('PM2-05: has(name) returns true after register()', () => {
    const pm = new PluginManager();
    pm.register({ name: 'delta' });
    expect(pm.has('delta')).toBe(true);
  });
});

// ─── PM3: register() — invalid plugins ───────────────────────────────────────

describe('PM3: register() — invalid plugins (INVALID_PLUGIN)', () => {
  it('PM3-01: register(null) returns INVALID_PLUGIN', () => {
    const pm = new PluginManager();
    const r = pm.register(null as unknown as PluginInfo);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_PLUGIN');
  });

  it('PM3-02: register(undefined) returns INVALID_PLUGIN', () => {
    const pm = new PluginManager();
    const r = pm.register(undefined as unknown as PluginInfo);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_PLUGIN');
  });

  it('PM3-03: register(42) returns INVALID_PLUGIN', () => {
    const pm = new PluginManager();
    const r = pm.register(42 as unknown as PluginInfo);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_PLUGIN');
  });

  it('PM3-04: register({}) — missing name — returns INVALID_PLUGIN', () => {
    const pm = new PluginManager();
    const r = pm.register({} as unknown as PluginInfo);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_PLUGIN');
  });

  it('PM3-05: register({ name: "" }) — empty name — returns INVALID_PLUGIN', () => {
    const pm = new PluginManager();
    const r = pm.register({ name: '' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_PLUGIN');
  });
});

// ─── PM4: register() — duplicate names ───────────────────────────────────────

describe('PM4: register() — duplicate names (DUPLICATE_PLUGIN)', () => {
  it('PM4-01: register() with duplicate name returns DUPLICATE_PLUGIN', () => {
    const pm = new PluginManager();
    pm.register({ name: 'dup' });
    const r = pm.register({ name: 'dup' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('DUPLICATE_PLUGIN');
  });

  it('PM4-02: DUPLICATE_PLUGIN error message contains the plugin name', () => {
    const pm = new PluginManager();
    pm.register({ name: 'my-plugin' });
    const r = pm.register({ name: 'my-plugin' });
    if (!r.ok) expect(r.error.message).toContain('my-plugin');
  });

  it('PM4-03: failed duplicate register() does not change size()', () => {
    const pm = new PluginManager();
    pm.register({ name: 'p' });
    pm.register({ name: 'p' }); // duplicate
    expect(pm.size()).toBe(1);
  });

  it('PM4-04: has(name) still returns true after duplicate attempt', () => {
    const pm = new PluginManager();
    pm.register({ name: 'p' });
    pm.register({ name: 'p', version: '2.0' }); // duplicate
    expect(pm.has('p')).toBe(true);
  });

  it('PM4-05: original plugin data is unchanged after duplicate attempt', () => {
    const pm = new PluginManager();
    pm.register({ name: 'p', version: '1.0' });
    pm.register({ name: 'p', version: '2.0' }); // rejected
    const r = pm.get('p');
    if (r.ok) expect(r.value.version).toBe('1.0');
  });
});

// ─── PM5: unregister() ───────────────────────────────────────────────────────

describe('PM5: unregister()', () => {
  it('PM5-01: unregister(name) returns { ok: true }', () => {
    const pm = new PluginManager();
    pm.register({ name: 'p' });
    const r = pm.unregister('p');
    expect(r.ok).toBe(true);
  });

  it('PM5-02: unregister() decreases size()', () => {
    const pm = new PluginManager();
    pm.register({ name: 'a' });
    pm.register({ name: 'b' });
    pm.unregister('a');
    expect(pm.size()).toBe(1);
  });

  it('PM5-03: has(name) returns false after unregister()', () => {
    const pm = new PluginManager();
    pm.register({ name: 'p' });
    pm.unregister('p');
    expect(pm.has('p')).toBe(false);
  });

  it('PM5-04: get(name) returns PLUGIN_NOT_FOUND after unregister()', () => {
    const pm = new PluginManager();
    pm.register({ name: 'p' });
    pm.unregister('p');
    const r = pm.get('p');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('PLUGIN_NOT_FOUND');
  });

  it('PM5-05: unregister(unknown) returns PLUGIN_NOT_FOUND', () => {
    const pm = new PluginManager();
    const r = pm.unregister('does-not-exist');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('PLUGIN_NOT_FOUND');
  });
});

// ─── PM6: get() ──────────────────────────────────────────────────────────────

describe('PM6: get()', () => {
  it('PM6-01: get(name) returns { ok: true, value: PluginInfo }', () => {
    const pm = new PluginManager();
    pm.register({ name: 'p', version: '1.0' });
    const r = pm.get('p');
    expect(r.ok).toBe(true);
    if (r.ok) expect(typeof r.value).toBe('object');
  });

  it('PM6-02: get(unknown) returns PLUGIN_NOT_FOUND', () => {
    const pm = new PluginManager();
    const r = pm.get('unknown');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('PLUGIN_NOT_FOUND');
  });

  it('PM6-03: returned PluginInfo has the correct name and fields', () => {
    const pm = new PluginManager();
    pm.register({ name: 'p', version: '3.1', description: 'test' });
    const r = pm.get('p');
    if (r.ok) {
      expect(r.value.name).toBe('p');
      expect(r.value.version).toBe('3.1');
      expect(r.value.description).toBe('test');
    }
  });

  it('PM6-04: get() returns a defensive copy — not the stored object', () => {
    const pm = new PluginManager();
    const original = { name: 'p', version: '1.0' };
    pm.register(original);
    const r = pm.get('p');
    if (r.ok) expect(r.value).not.toBe(original);
  });

  it('PM6-05: consecutive get() calls return independent objects', () => {
    const pm = new PluginManager();
    pm.register({ name: 'p' });
    const r1 = pm.get('p');
    const r2 = pm.get('p');
    if (r1.ok && r2.ok) expect(r1.value).not.toBe(r2.value);
  });
});

// ─── PM7: has() ──────────────────────────────────────────────────────────────

describe('PM7: has()', () => {
  it('PM7-01: has() returns false for an unknown name', () => {
    expect(new PluginManager().has('unknown')).toBe(false);
  });

  it('PM7-02: has() returns true after register()', () => {
    const pm = new PluginManager();
    pm.register({ name: 'p' });
    expect(pm.has('p')).toBe(true);
  });

  it('PM7-03: has() returns false after unregister()', () => {
    const pm = new PluginManager();
    pm.register({ name: 'p' });
    pm.unregister('p');
    expect(pm.has('p')).toBe(false);
  });

  it('PM7-04: has() never throws for any argument', () => {
    const pm = new PluginManager();
    const inputs: unknown[] = [null, undefined, 42, '', {}, [], true];
    for (const v of inputs) {
      expect(() => pm.has(v as string)).not.toThrow();
    }
  });
});

// ─── PM8: size() ─────────────────────────────────────────────────────────────

describe('PM8: size()', () => {
  it('PM8-01: size() returns 0 on a new instance', () => {
    expect(new PluginManager().size()).toBe(0);
  });

  it('PM8-02: size() increments after register()', () => {
    const pm = new PluginManager();
    pm.register({ name: 'a' });
    pm.register({ name: 'b' });
    expect(pm.size()).toBe(2);
  });

  it('PM8-03: size() decrements after unregister()', () => {
    const pm = new PluginManager();
    pm.register({ name: 'a' });
    pm.register({ name: 'b' });
    pm.unregister('a');
    expect(pm.size()).toBe(1);
  });

  it('PM8-04: size() is 0 after clear()', () => {
    const pm = new PluginManager();
    pm.register({ name: 'a' });
    pm.clear();
    expect(pm.size()).toBe(0);
  });
});

// ─── PM9: clear() ────────────────────────────────────────────────────────────

describe('PM9: clear()', () => {
  it('PM9-01: clear() empties the registry', () => {
    const pm = new PluginManager();
    pm.register({ name: 'a' });
    pm.register({ name: 'b' });
    pm.clear();
    expect(pm.size()).toBe(0);
  });

  it('PM9-02: has(name) returns false for all plugins after clear()', () => {
    const pm = new PluginManager();
    pm.register({ name: 'a' });
    pm.clear();
    expect(pm.has('a')).toBe(false);
  });

  it('PM9-03: list() returns [] after clear()', () => {
    const pm = new PluginManager();
    pm.register({ name: 'a' });
    pm.clear();
    expect(pm.list()).toEqual([]);
  });

  it('PM9-04: clear() is idempotent — double-clear is safe', () => {
    const pm = new PluginManager();
    pm.register({ name: 'a' });
    pm.clear();
    expect(() => pm.clear()).not.toThrow();
    expect(pm.size()).toBe(0);
  });
});

// ─── PM10: list() + defensive copies ─────────────────────────────────────────

describe('PM10: list() + defensive copies', () => {
  it('PM10-01: list() returns all registered plugins in insertion order', () => {
    const pm = new PluginManager();
    pm.register({ name: 'a' });
    pm.register({ name: 'b' });
    pm.register({ name: 'c' });
    const names = pm.list().map((p) => p.name);
    expect(names).toEqual(['a', 'b', 'c']);
  });

  it('PM10-02: mutating the returned array does not affect registry', () => {
    const pm = new PluginManager();
    pm.register({ name: 'p' });
    const arr = pm.list();
    arr.push({ name: 'injected' });
    expect(pm.size()).toBe(1);
  });

  it('PM10-03: each list() call returns an independent array', () => {
    const pm = new PluginManager();
    pm.register({ name: 'p' });
    const a = pm.list();
    const b = pm.list();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });

  it('PM10-04: list() after unregister() excludes the removed plugin', () => {
    const pm = new PluginManager();
    pm.register({ name: 'a' });
    pm.register({ name: 'b' });
    pm.unregister('a');
    const names = pm.list().map((p) => p.name);
    expect(names).not.toContain('a');
    expect(names).toContain('b');
  });
});

// ─── PM11: Defensive copies (register / get) ──────────────────────────────────

describe('PM11: Defensive copies (register / get)', () => {
  it('PM11-01: register() returns a clone — not the original input object', () => {
    const pm = new PluginManager();
    const original = { name: 'p', version: '1.0' };
    const r = pm.register(original);
    if (r.ok) expect(r.value).not.toBe(original);
  });

  it('PM11-02: get() returns a clone — not the internally stored object', () => {
    const pm = new PluginManager();
    const original = { name: 'p' };
    pm.register(original);
    const r = pm.get('p');
    if (r.ok) expect(r.value).not.toBe(original);
  });

  it('PM11-03: consecutive get() calls return independent object references', () => {
    const pm = new PluginManager();
    pm.register({ name: 'p' });
    const r1 = pm.get('p');
    const r2 = pm.get('p');
    if (r1.ok && r2.ok) {
      expect(r1.value).toEqual(r2.value);
      expect(r1.value).not.toBe(r2.value);
    }
  });

  it('PM11-04: mutating a list() item does not affect subsequent get()', () => {
    const pm = new PluginManager();
    pm.register({ name: 'p', version: '1.0' });
    const items = pm.list();
    // Mutate the clone returned by list()
    (items[0] as Record<string, unknown>)['version'] = '9.9';
    // get() must still return the original stored version
    const r = pm.get('p');
    if (r.ok) expect(r.value.version).toBe('1.0');
  });
});

// ─── PM12: Never throw / edge cases ──────────────────────────────────────────

describe('PM12: Never throw / edge cases', () => {
  it('PM12-01: register() never throws for any argument', () => {
    const pm = new PluginManager();
    const inputs: unknown[] = [null, undefined, 42, '', 'str', [], {}, { name: '' }];
    for (const v of inputs) {
      expect(() => pm.register(v as PluginInfo)).not.toThrow();
    }
  });

  it('PM12-02: unregister() never throws for any argument', () => {
    const pm = new PluginManager();
    const inputs: unknown[] = [null, undefined, 42, '', 'unknown', {}];
    for (const v of inputs) {
      expect(() => pm.unregister(v as string)).not.toThrow();
    }
  });

  it('PM12-03: get() never throws for any argument', () => {
    const pm = new PluginManager();
    const inputs: unknown[] = [null, undefined, 42, '', 'unknown', {}];
    for (const v of inputs) {
      expect(() => pm.get(v as string)).not.toThrow();
    }
  });

  it('PM12-04: has() never throws for any argument', () => {
    const pm = new PluginManager();
    const inputs: unknown[] = [null, undefined, 42, '', 'unknown', {}];
    for (const v of inputs) {
      expect(() => pm.has(v as string)).not.toThrow();
    }
  });

  it('PM12-05: size() never throws', () => {
    expect(() => new PluginManager().size()).not.toThrow();
  });

  it('PM12-06: clear() never throws', () => {
    expect(() => new PluginManager().clear()).not.toThrow();
  });
});
