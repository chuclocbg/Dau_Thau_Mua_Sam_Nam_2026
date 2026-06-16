/**
 * P6-11A: Logger — test suite (56 tests, LG1–LG12).
 *
 * Plain TypeScript — no JSX.  The Logger class has no browser-API
 * dependencies, so no renderToString is needed here.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  Logger,
  type LogEntry,
  type LogLevel,
} from '../providers/Logger';

// ─── LG1: Constructor and count getter (5 tests) ──────────────────────────────

describe('LG1: constructor and count', () => {
  it('LG1-01: new Logger() does not throw', () => {
    expect(() => new Logger()).not.toThrow();
  });

  it('LG1-02: count starts at 0', () => {
    const lg = new Logger();
    expect(lg.count).toBe(0);
  });

  it('LG1-03: count increments after one log', () => {
    const lg = new Logger();
    lg.info('hello');
    expect(lg.count).toBe(1);
  });

  it('LG1-04: count reflects multiple logs', () => {
    const lg = new Logger();
    lg.debug('a');
    lg.warn('b');
    lg.error('c');
    expect(lg.count).toBe(3);
  });

  it('LG1-05: default minLevel accepts debug entries', () => {
    const lg = new Logger();
    const result = lg.debug('low priority');
    expect(result.ok).toBe(true);
    expect(lg.count).toBe(1);
  });
});

// ─── LG2: debug() convenience method (5 tests) ────────────────────────────────

describe('LG2: debug()', () => {
  let lg: Logger;
  beforeEach(() => { lg = new Logger(); });

  it('LG2-01: returns ok:true', () => {
    const r = lg.debug('test debug');
    expect(r.ok).toBe(true);
  });

  it('LG2-02: returned entry has level "debug"', () => {
    const r = lg.debug('test debug');
    expect(r.ok && r.value.level).toBe('debug');
  });

  it('LG2-03: returned entry has the supplied message', () => {
    const r = lg.debug('debugging now');
    expect(r.ok && r.value.message).toBe('debugging now');
  });

  it('LG2-04: returned entry has a positive numeric id', () => {
    const r = lg.debug('id check');
    expect(r.ok && r.value.id).toBeGreaterThan(0);
  });

  it('LG2-05: id is 1 for the very first entry', () => {
    const r = lg.debug('first');
    expect(r.ok && r.value.id).toBe(1);
  });
});

// ─── LG3: info() convenience method (5 tests) ─────────────────────────────────

describe('LG3: info()', () => {
  let lg: Logger;
  beforeEach(() => { lg = new Logger(); });

  it('LG3-01: returns ok:true', () => {
    const r = lg.info('info msg');
    expect(r.ok).toBe(true);
  });

  it('LG3-02: returned entry has level "info"', () => {
    const r = lg.info('info msg');
    expect(r.ok && r.value.level).toBe('info');
  });

  it('LG3-03: returned entry carries the correct message', () => {
    const r = lg.info('service started');
    expect(r.ok && r.value.message).toBe('service started');
  });

  it('LG3-04: entry appears in listLogs()', () => {
    lg.info('appear here');
    const logs = lg.listLogs();
    expect(logs.some(e => e.message === 'appear here')).toBe(true);
  });

  it('LG3-05: count increments after info()', () => {
    lg.info('one');
    lg.info('two');
    expect(lg.count).toBe(2);
  });
});

// ─── LG4: warn() convenience method (4 tests) ─────────────────────────────────

describe('LG4: warn()', () => {
  let lg: Logger;
  beforeEach(() => { lg = new Logger(); });

  it('LG4-01: returns ok:true', () => {
    const r = lg.warn('disk low');
    expect(r.ok).toBe(true);
  });

  it('LG4-02: returned entry has level "warn"', () => {
    const r = lg.warn('disk low');
    expect(r.ok && r.value.level).toBe('warn');
  });

  it('LG4-03: returned entry carries the correct message', () => {
    const r = lg.warn('rate limit approaching');
    expect(r.ok && r.value.message).toBe('rate limit approaching');
  });

  it('LG4-04: entry appears in listLogs()', () => {
    lg.warn('watch out');
    const logs = lg.listLogs();
    expect(logs.some(e => e.level === 'warn')).toBe(true);
  });
});

// ─── LG5: error() convenience method (4 tests) ────────────────────────────────

describe('LG5: error()', () => {
  let lg: Logger;
  beforeEach(() => { lg = new Logger(); });

  it('LG5-01: returns ok:true', () => {
    const r = lg.error('boom');
    expect(r.ok).toBe(true);
  });

  it('LG5-02: returned entry has level "error"', () => {
    const r = lg.error('boom');
    expect(r.ok && r.value.level).toBe('error');
  });

  it('LG5-03: returned entry carries the correct message', () => {
    const r = lg.error('fatal failure');
    expect(r.ok && r.value.message).toBe('fatal failure');
  });

  it('LG5-04: entry appears in listLogs()', () => {
    lg.error('crash');
    const logs = lg.listLogs();
    expect(logs.some(e => e.level === 'error')).toBe(true);
  });
});

// ─── LG6: log() with explicit level (5 tests) ─────────────────────────────────

describe('LG6: log() with explicit level', () => {
  let lg: Logger;
  beforeEach(() => { lg = new Logger(); });

  it('LG6-01: log("debug", ...) succeeds', () => {
    const r = lg.log('debug', 'explicit debug');
    expect(r.ok).toBe(true);
  });

  it('LG6-02: log("info", ...) succeeds', () => {
    const r = lg.log('info', 'explicit info');
    expect(r.ok).toBe(true);
  });

  it('LG6-03: log("warn", ...) succeeds', () => {
    const r = lg.log('warn', 'explicit warn');
    expect(r.ok).toBe(true);
  });

  it('LG6-04: log("error", ...) succeeds', () => {
    const r = lg.log('error', 'explicit error');
    expect(r.ok).toBe(true);
  });

  it('LG6-05: all four levels appear in listLogs() after one each', () => {
    lg.log('debug', 'D');
    lg.log('info',  'I');
    lg.log('warn',  'W');
    lg.log('error', 'E');
    const levels = lg.listLogs().map(e => e.level);
    expect(levels).toContain('debug');
    expect(levels).toContain('info');
    expect(levels).toContain('warn');
    expect(levels).toContain('error');
  });
});

// ─── LG7: timestamp storage (4 tests) ────────────────────────────────────────

describe('LG7: timestamp storage', () => {
  let lg: Logger;
  beforeEach(() => { lg = new Logger(); });

  it('LG7-01: timestamp is a positive number', () => {
    const r = lg.info('time check');
    expect(r.ok && r.value.timestamp).toBeGreaterThan(0);
  });

  it('LG7-02: timestamp is approximately now', () => {
    const before = Date.now();
    const r = lg.info('time now');
    const after = Date.now();
    if (r.ok) {
      expect(r.value.timestamp).toBeGreaterThanOrEqual(before);
      expect(r.value.timestamp).toBeLessThanOrEqual(after);
    }
  });

  it('LG7-03: later entries have equal-or-greater timestamps', () => {
    const r1 = lg.debug('first');
    const r2 = lg.debug('second');
    if (r1.ok && r2.ok) {
      expect(r2.value.timestamp).toBeGreaterThanOrEqual(r1.value.timestamp);
    }
  });

  it('LG7-04: timestamp in listLogs() matches the stored value', () => {
    const r = lg.warn('ts match');
    if (r.ok) {
      const stored = lg.listLogs()[0];
      expect(stored.timestamp).toBe(r.value.timestamp);
    }
  });
});

// ─── LG8: metadata storage (4 tests) ─────────────────────────────────────────

describe('LG8: metadata storage', () => {
  let lg: Logger;
  beforeEach(() => { lg = new Logger(); });

  it('LG8-01: metadata is present on the returned entry', () => {
    const r = lg.info('with meta', { userId: 'u1' });
    expect(r.ok && r.value.metadata?.['userId']).toBe('u1');
  });

  it('LG8-02: metadata is present in listLogs()', () => {
    lg.info('meta log', { orderId: 42 });
    const logs = lg.listLogs();
    expect(logs[0].metadata?.['orderId']).toBe(42);
  });

  it('LG8-03: mutating the returned copy does not corrupt the store', () => {
    lg.info('guard', { x: 1 });
    const r = lg.listLogs()[0];
    if (r.metadata) r.metadata['x'] = 999;
    const r2 = lg.listLogs()[0];
    expect(r2.metadata?.['x']).toBe(1);
  });

  it('LG8-04: entries without metadata have no metadata property', () => {
    const r = lg.debug('no meta');
    expect(r.ok && r.value.metadata).toBeUndefined();
  });
});

// ─── LG9: listLogs() ordering and defensive copies (5 tests) ─────────────────

describe('LG9: listLogs() ordering and defensive copies', () => {
  let lg: Logger;
  beforeEach(() => { lg = new Logger(); });

  it('LG9-01: returns empty array when store is empty', () => {
    expect(lg.listLogs()).toEqual([]);
  });

  it('LG9-02: preserves insertion order', () => {
    lg.debug('first');
    lg.info('second');
    lg.warn('third');
    const msgs = lg.listLogs().map(e => e.message);
    expect(msgs).toEqual(['first', 'second', 'third']);
  });

  it('LG9-03: pushing onto the returned array does not grow the store', () => {
    lg.info('one');
    const logs = lg.listLogs();
    logs.push({ id: 99, level: 'error', message: 'injected', timestamp: 1 });
    expect(lg.count).toBe(1);
  });

  it('LG9-04: each call returns a fresh array instance', () => {
    lg.info('a');
    const a = lg.listLogs();
    const b = lg.listLogs();
    expect(a).not.toBe(b);
  });

  it('LG9-05: ids in the returned list are monotonically increasing', () => {
    lg.debug('d');
    lg.info('i');
    lg.error('e');
    const ids = lg.listLogs().map(e => e.id);
    expect(ids[1]).toBeGreaterThan(ids[0]);
    expect(ids[2]).toBeGreaterThan(ids[1]);
  });
});

// ─── LG10: listByLevel() filtering (4 tests) ──────────────────────────────────

describe('LG10: listByLevel() filtering', () => {
  let lg: Logger;
  beforeEach(() => {
    lg = new Logger();
    lg.debug('d1');
    lg.info('i1');
    lg.info('i2');
    lg.warn('w1');
    lg.error('e1');
  });

  it('LG10-01: returns only entries for the requested level', () => {
    const infos = lg.listByLevel('info');
    expect(infos.every(e => e.level === 'info')).toBe(true);
  });

  it('LG10-02: returns correct count for a level', () => {
    expect(lg.listByLevel('info').length).toBe(2);
  });

  it('LG10-03: unknown level returns []', () => {
    expect(lg.listByLevel('verbose' as LogLevel)).toEqual([]);
  });

  it('LG10-04: returns [] when store is empty', () => {
    const empty = new Logger();
    expect(empty.listByLevel('warn')).toEqual([]);
  });
});

// ─── LG11: maxEntries rolling cap (4 tests) ───────────────────────────────────

describe('LG11: maxEntries rolling cap', () => {
  it('LG11-01: store never exceeds maxEntries', () => {
    const lg = new Logger({ maxEntries: 3 });
    for (let i = 0; i < 10; i++) lg.info(`msg-${i}`);
    expect(lg.count).toBe(3);
  });

  it('LG11-02: oldest entries are dropped when cap is hit', () => {
    const lg = new Logger({ maxEntries: 2 });
    lg.info('alpha');
    lg.info('beta');
    lg.info('gamma');      // alpha should be evicted
    const msgs = lg.listLogs().map(e => e.message);
    expect(msgs).not.toContain('alpha');
  });

  it('LG11-03: newest entries are retained', () => {
    const lg = new Logger({ maxEntries: 2 });
    lg.info('alpha');
    lg.info('beta');
    lg.info('gamma');
    const msgs = lg.listLogs().map(e => e.message);
    expect(msgs).toContain('gamma');
  });

  it('LG11-04: entries below cap are not affected', () => {
    const lg = new Logger({ maxEntries: 5 });
    lg.info('a');
    lg.info('b');
    expect(lg.count).toBe(2);
    const msgs = lg.listLogs().map(e => e.message);
    expect(msgs).toEqual(['a', 'b']);
  });
});

// ─── LG12: malformed input and never-throw safety (7 tests) ──────────────────

describe('LG12: malformed input and never-throw', () => {
  let lg: Logger;
  beforeEach(() => { lg = new Logger(); });

  it('LG12-01: unrecognised level string returns INVALID_LEVEL error', () => {
    const r = lg.log('verbose' as LogLevel, 'hello');
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.code).toBe('INVALID_LEVEL');
  });

  it('LG12-02: numeric level returns INVALID_LEVEL error', () => {
    const r = lg.log(42 as unknown as LogLevel, 'hello');
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.code).toBe('INVALID_LEVEL');
  });

  it('LG12-03: null level returns INVALID_LEVEL error', () => {
    const r = lg.log(null as unknown as LogLevel, 'hello');
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.code).toBe('INVALID_LEVEL');
  });

  it('LG12-04: empty string message returns INVALID_INPUT error', () => {
    const r = lg.info('');
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.code).toBe('INVALID_INPUT');
  });

  it('LG12-05: whitespace-only message returns INVALID_INPUT error', () => {
    const r = lg.warn('   ');
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.code).toBe('INVALID_INPUT');
  });

  it('LG12-06: numeric message returns INVALID_INPUT error', () => {
    const r = lg.error(42 as unknown as string);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.code).toBe('INVALID_INPUT');
  });

  it('LG12-07: array metadata is silently discarded and entry still stores ok', () => {
    const r = lg.info('array meta', ['a', 'b'] as unknown as Record<string, unknown>);
    expect(r.ok).toBe(true);
    expect(r.ok && r.value.metadata).toBeUndefined();
  });
});
