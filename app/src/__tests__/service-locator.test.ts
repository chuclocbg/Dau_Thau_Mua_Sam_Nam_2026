/**
 * P6-12J: ServiceLocator — string-keyed service registry tests.
 *
 * 56 tests grouped SL1-SL12.
 *
 * Groups:
 *   SL1  (5) Constructor / initial state
 *   SL2  (5) register() — valid registrations
 *   SL3  (5) register() — invalid names (INVALID_NAME)
 *   SL4  (5) register() — duplicate names (DUPLICATE_SERVICE)
 *   SL5  (5) unregister()
 *   SL6  (5) resolve()
 *   SL7  (4) has()
 *   SL8  (4) size()
 *   SL9  (4) clear()
 *   SL10 (4) list() + defensive copies
 *   SL11 (4) Defensive copies (register / resolve)
 *   SL12 (6) Never throw / edge cases
 */

import { describe, it, expect } from 'vitest';
import {
  ServiceLocator,
  type ServiceEntry,
  type ServiceResult,
  type ServiceError,
  type ServiceErrorCode,
} from '../providers/ServiceLocator';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractValue<T>(r: ServiceResult<T>): T {
  if (!r.ok) throw new Error(`Expected ok result; got error: ${r.error.code}`);
  return r.value;
}

// ─── SL1: Constructor / initial state ────────────────────────────────────────

describe('SL1: Constructor / initial state', () => {
  it('SL1-01: new ServiceLocator() constructs without throwing', () => {
    expect(() => new ServiceLocator()).not.toThrow();
  });

  it('SL1-02: size() returns 0 initially', () => {
    expect(new ServiceLocator().size()).toBe(0);
  });

  it('SL1-03: list() returns [] initially', () => {
    expect(new ServiceLocator().list()).toEqual([]);
  });

  it('SL1-04: clear() on empty registry is a safe no-op', () => {
    const sl = new ServiceLocator();
    expect(() => sl.clear()).not.toThrow();
    expect(sl.size()).toBe(0);
  });

  it('SL1-05: has() returns false initially for any name', () => {
    expect(new ServiceLocator().has('nonexistent')).toBe(false);
  });
});

// ─── SL2: register() — valid registrations ───────────────────────────────────

describe('SL2: register() — valid registrations', () => {
  it('SL2-01: register(name, object) returns { ok: true, value: ServiceEntry }', () => {
    const sl = new ServiceLocator();
    const r = sl.register('db', { host: 'localhost' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.name).toBe('db');
      expect(typeof r.value.service).toBe('object');
    }
  });

  it('SL2-02: register(name, function) returns { ok: true }', () => {
    const sl = new ServiceLocator();
    const r = sl.register('factory', () => 42);
    expect(r.ok).toBe(true);
  });

  it('SL2-03: register(name, null) is valid — null is a legal service value', () => {
    const sl = new ServiceLocator();
    const r = sl.register('nullsvc', null);
    expect(r.ok).toBe(true);
  });

  it('SL2-04: register() increases size()', () => {
    const sl = new ServiceLocator();
    sl.register('a', 1);
    sl.register('b', 2);
    expect(sl.size()).toBe(2);
  });

  it('SL2-05: has(name) returns true after register()', () => {
    const sl = new ServiceLocator();
    sl.register('svc', {});
    expect(sl.has('svc')).toBe(true);
  });
});

// ─── SL3: register() — invalid names ─────────────────────────────────────────

describe('SL3: register() — invalid names (INVALID_NAME)', () => {
  it('SL3-01: register(null, svc) returns INVALID_NAME', () => {
    const sl = new ServiceLocator();
    const r = sl.register(null as unknown as string, {});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_NAME');
  });

  it('SL3-02: register(undefined, svc) returns INVALID_NAME', () => {
    const sl = new ServiceLocator();
    const r = sl.register(undefined as unknown as string, {});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_NAME');
  });

  it('SL3-03: register(42, svc) returns INVALID_NAME', () => {
    const sl = new ServiceLocator();
    const r = sl.register(42 as unknown as string, {});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_NAME');
  });

  it('SL3-04: register("", svc) — empty name — returns INVALID_NAME', () => {
    const sl = new ServiceLocator();
    const r = sl.register('', {});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_NAME');
  });

  it('SL3-05: invalid register() does not change size()', () => {
    const sl = new ServiceLocator();
    sl.register(null as unknown as string, {});
    sl.register(''  as unknown as string, {});
    expect(sl.size()).toBe(0);
  });
});

// ─── SL4: register() — duplicate names ───────────────────────────────────────

describe('SL4: register() — duplicate names (DUPLICATE_SERVICE)', () => {
  it('SL4-01: register() with duplicate name returns DUPLICATE_SERVICE', () => {
    const sl = new ServiceLocator();
    sl.register('svc', 'first');
    const r = sl.register('svc', 'second');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('DUPLICATE_SERVICE');
  });

  it('SL4-02: DUPLICATE_SERVICE error message contains the service name', () => {
    const sl = new ServiceLocator();
    sl.register('my-service', 1);
    const r = sl.register('my-service', 2);
    if (!r.ok) expect(r.error.message).toContain('my-service');
  });

  it('SL4-03: failed duplicate register() does not change size()', () => {
    const sl = new ServiceLocator();
    sl.register('svc', 1);
    sl.register('svc', 2); // rejected
    expect(sl.size()).toBe(1);
  });

  it('SL4-04: has(name) still returns true after duplicate attempt', () => {
    const sl = new ServiceLocator();
    sl.register('svc', 1);
    sl.register('svc', 2); // rejected
    expect(sl.has('svc')).toBe(true);
  });

  it('SL4-05: original service is unchanged after duplicate attempt', () => {
    const sl = new ServiceLocator();
    sl.register('svc', 'original');
    sl.register('svc', 'override'); // rejected
    const r = sl.resolve('svc');
    if (r.ok) expect(r.value).toBe('original');
  });
});

// ─── SL5: unregister() ───────────────────────────────────────────────────────

describe('SL5: unregister()', () => {
  it('SL5-01: unregister(name) returns { ok: true }', () => {
    const sl = new ServiceLocator();
    sl.register('svc', {});
    const r = sl.unregister('svc');
    expect(r.ok).toBe(true);
  });

  it('SL5-02: unregister() decreases size()', () => {
    const sl = new ServiceLocator();
    sl.register('a', 1);
    sl.register('b', 2);
    sl.unregister('a');
    expect(sl.size()).toBe(1);
  });

  it('SL5-03: has(name) returns false after unregister()', () => {
    const sl = new ServiceLocator();
    sl.register('svc', {});
    sl.unregister('svc');
    expect(sl.has('svc')).toBe(false);
  });

  it('SL5-04: resolve(name) returns SERVICE_NOT_FOUND after unregister()', () => {
    const sl = new ServiceLocator();
    sl.register('svc', {});
    sl.unregister('svc');
    const r = sl.resolve('svc');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('SERVICE_NOT_FOUND');
  });

  it('SL5-05: unregister(unknown) returns SERVICE_NOT_FOUND', () => {
    const sl = new ServiceLocator();
    const r = sl.unregister('does-not-exist');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('SERVICE_NOT_FOUND');
  });
});

// ─── SL6: resolve() ──────────────────────────────────────────────────────────

describe('SL6: resolve()', () => {
  it('SL6-01: resolve(name) returns { ok: true, value } with the service', () => {
    const sl = new ServiceLocator();
    sl.register('svc', { port: 3000 });
    const r = sl.resolve('svc');
    expect(r.ok).toBe(true);
    if (r.ok) expect((r.value as Record<string, unknown>)['port']).toBe(3000);
  });

  it('SL6-02: resolve(unknown) returns SERVICE_NOT_FOUND', () => {
    const sl = new ServiceLocator();
    const r = sl.resolve('unknown');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('SERVICE_NOT_FOUND');
  });

  it('SL6-03: resolve() returns correct value for a primitive service', () => {
    const sl = new ServiceLocator();
    sl.register('num', 42);
    const r = sl.resolve('num');
    if (r.ok) expect(r.value).toBe(42);
  });

  it('SL6-04: resolve() returns a defensive copy for object services', () => {
    const sl = new ServiceLocator();
    const obj = { x: 1 };
    sl.register('obj', obj);
    const r = sl.resolve('obj');
    if (r.ok) {
      expect(r.value).toEqual(obj);
      expect(r.value).not.toBe(obj);
    }
  });

  it('SL6-05: resolve() returns a function service as-is (same reference)', () => {
    const sl = new ServiceLocator();
    const fn = () => 42;
    sl.register('fn', fn);
    const r = sl.resolve('fn');
    if (r.ok) expect(r.value).toBe(fn);
  });
});

// ─── SL7: has() ──────────────────────────────────────────────────────────────

describe('SL7: has()', () => {
  it('SL7-01: has() returns false for an unknown name', () => {
    expect(new ServiceLocator().has('unknown')).toBe(false);
  });

  it('SL7-02: has() returns true after register()', () => {
    const sl = new ServiceLocator();
    sl.register('svc', {});
    expect(sl.has('svc')).toBe(true);
  });

  it('SL7-03: has() returns false after unregister()', () => {
    const sl = new ServiceLocator();
    sl.register('svc', {});
    sl.unregister('svc');
    expect(sl.has('svc')).toBe(false);
  });

  it('SL7-04: has() never throws for any argument', () => {
    const sl = new ServiceLocator();
    const inputs: unknown[] = [null, undefined, 42, '', {}, [], true];
    for (const v of inputs) {
      expect(() => sl.has(v as string)).not.toThrow();
    }
  });
});

// ─── SL8: size() ─────────────────────────────────────────────────────────────

describe('SL8: size()', () => {
  it('SL8-01: size() returns 0 on a new instance', () => {
    expect(new ServiceLocator().size()).toBe(0);
  });

  it('SL8-02: size() increments after register()', () => {
    const sl = new ServiceLocator();
    sl.register('a', 1);
    sl.register('b', 2);
    expect(sl.size()).toBe(2);
  });

  it('SL8-03: size() decrements after unregister()', () => {
    const sl = new ServiceLocator();
    sl.register('a', 1);
    sl.register('b', 2);
    sl.unregister('a');
    expect(sl.size()).toBe(1);
  });

  it('SL8-04: size() is 0 after clear()', () => {
    const sl = new ServiceLocator();
    sl.register('a', 1);
    sl.clear();
    expect(sl.size()).toBe(0);
  });
});

// ─── SL9: clear() ────────────────────────────────────────────────────────────

describe('SL9: clear()', () => {
  it('SL9-01: clear() empties the registry', () => {
    const sl = new ServiceLocator();
    sl.register('a', 1);
    sl.register('b', 2);
    sl.clear();
    expect(sl.size()).toBe(0);
  });

  it('SL9-02: has(name) returns false for all services after clear()', () => {
    const sl = new ServiceLocator();
    sl.register('a', 1);
    sl.clear();
    expect(sl.has('a')).toBe(false);
  });

  it('SL9-03: list() returns [] after clear()', () => {
    const sl = new ServiceLocator();
    sl.register('a', 1);
    sl.clear();
    expect(sl.list()).toEqual([]);
  });

  it('SL9-04: clear() is idempotent — double-clear is safe', () => {
    const sl = new ServiceLocator();
    sl.register('a', 1);
    sl.clear();
    expect(() => sl.clear()).not.toThrow();
    expect(sl.size()).toBe(0);
  });
});

// ─── SL10: list() + defensive copies ─────────────────────────────────────────

describe('SL10: list() + defensive copies', () => {
  it('SL10-01: list() returns all ServiceEntry items in insertion order', () => {
    const sl = new ServiceLocator();
    sl.register('a', 1);
    sl.register('b', 2);
    sl.register('c', 3);
    const names = sl.list().map((e) => e.name);
    expect(names).toEqual(['a', 'b', 'c']);
  });

  it('SL10-02: mutating the returned array does not affect the registry', () => {
    const sl = new ServiceLocator();
    sl.register('svc', {});
    const arr = sl.list();
    arr.push({ name: 'injected', service: null });
    expect(sl.size()).toBe(1);
  });

  it('SL10-03: each list() call returns an independent array', () => {
    const sl = new ServiceLocator();
    sl.register('svc', {});
    const a = sl.list();
    const b = sl.list();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });

  it('SL10-04: list() after unregister() excludes the removed service', () => {
    const sl = new ServiceLocator();
    sl.register('a', 1);
    sl.register('b', 2);
    sl.unregister('a');
    const names = sl.list().map((e) => e.name);
    expect(names).not.toContain('a');
    expect(names).toContain('b');
  });
});

// ─── SL11: Defensive copies (register / resolve) ─────────────────────────────

describe('SL11: Defensive copies (register / resolve)', () => {
  it('SL11-01: register() returns a clone of the service in the entry', () => {
    const sl = new ServiceLocator();
    const obj = { x: 1 };
    const r = sl.register('svc', obj);
    if (r.ok) expect(r.value.service).not.toBe(obj);
  });

  it('SL11-02: resolve() returns a clone — not the internally stored object', () => {
    const sl = new ServiceLocator();
    const obj = { x: 1 };
    sl.register('svc', obj);
    const r = sl.resolve('svc');
    if (r.ok) expect(r.value).not.toBe(obj);
  });

  it('SL11-03: consecutive resolve() calls return independent object references', () => {
    const sl = new ServiceLocator();
    sl.register('svc', { x: 1 });
    const r1 = sl.resolve('svc');
    const r2 = sl.resolve('svc');
    if (r1.ok && r2.ok) {
      expect(r1.value).toEqual(r2.value);
      expect(r1.value).not.toBe(r2.value);
    }
  });

  it('SL11-04: mutating a list() entry service does not affect resolve()', () => {
    const sl = new ServiceLocator();
    sl.register('svc', { x: 1 });
    const entries = sl.list();
    // Mutate the clone returned by list()
    (entries[0].service as Record<string, unknown>)['x'] = 99;
    // resolve() must still return the original stored value
    const r = sl.resolve('svc');
    if (r.ok) expect((r.value as Record<string, unknown>)['x']).toBe(1);
  });
});

// ─── SL12: Never throw / edge cases ──────────────────────────────────────────

describe('SL12: Never throw / edge cases', () => {
  it('SL12-01: register() never throws for any arguments', () => {
    const sl = new ServiceLocator();
    const names: unknown[] = [null, undefined, 42, '', {}, []];
    for (const n of names) {
      expect(() => sl.register(n as string, 'svc')).not.toThrow();
    }
  });

  it('SL12-02: unregister() never throws for any argument', () => {
    const sl = new ServiceLocator();
    const inputs: unknown[] = [null, undefined, 42, '', 'unknown', {}];
    for (const v of inputs) {
      expect(() => sl.unregister(v as string)).not.toThrow();
    }
  });

  it('SL12-03: resolve() never throws for any argument', () => {
    const sl = new ServiceLocator();
    const inputs: unknown[] = [null, undefined, 42, '', 'unknown', {}];
    for (const v of inputs) {
      expect(() => sl.resolve(v as string)).not.toThrow();
    }
  });

  it('SL12-04: has() never throws for any argument', () => {
    const sl = new ServiceLocator();
    const inputs: unknown[] = [null, undefined, 42, '', 'unknown', {}];
    for (const v of inputs) {
      expect(() => sl.has(v as string)).not.toThrow();
    }
  });

  it('SL12-05: size() never throws', () => {
    expect(() => new ServiceLocator().size()).not.toThrow();
  });

  it('SL12-06: clear() never throws', () => {
    expect(() => new ServiceLocator().clear()).not.toThrow();
  });
});
