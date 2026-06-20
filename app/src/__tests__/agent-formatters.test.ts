/**
 * P9-02: agentFormatters — shared formatting utilities — 28 tests
 *
 * Covers:
 *   formatTimestamp(ts) — unix-ms to UTC 'HH:MM:SS.mmm'
 *   formatPayload(payload) — compact JSON, truncated at 120 chars
 *
 * Groups:
 *   AF-01  (7)  formatTimestamp — basic UTC conversion
 *   AF-02  (7)  formatPayload — serialisation and special values
 *   AF-03  (7)  formatTimestamp — edge cases
 *   AF-04  (7)  formatPayload — boundary and edge cases
 */

import { describe, it, expect } from 'vitest';
import { formatTimestamp, formatTimestampLocale, formatPayload } from '../utils/agentFormatters';

// ─── AF-01: formatTimestamp — basic UTC conversion ────────────────────────────

describe('AF-01 · formatTimestamp — basic UTC conversion', () => {
  it('AF-01-01: formatTimestamp is a function', () => {
    expect(typeof formatTimestamp).toBe('function');
  });

  it('AF-01-02: formatTimestamp(0) → "00:00:00.000"', () => {
    expect(formatTimestamp(0)).toBe('00:00:00.000');
  });

  it('AF-01-03: formatTimestamp(1000) → "00:00:01.000"', () => {
    expect(formatTimestamp(1_000)).toBe('00:00:01.000');
  });

  it('AF-01-04: formatTimestamp of known UTC datetime → correct HH:MM:SS.mmm', () => {
    const ts = new Date('2026-01-01T08:30:45.123Z').getTime();
    expect(formatTimestamp(ts)).toBe('08:30:45.123');
  });

  it('AF-01-05: formatTimestamp(59999) → "00:00:59.999"', () => {
    expect(formatTimestamp(59_999)).toBe('00:00:59.999');
  });

  it('AF-01-06: return value does not contain "Z" or "T"', () => {
    const result = formatTimestamp(0);
    expect(result).not.toContain('Z');
    expect(result).not.toContain('T');
  });

  it('AF-01-07: returns a string', () => {
    expect(typeof formatTimestamp(1_000_000)).toBe('string');
  });
});

// ─── AF-02: formatPayload — serialisation and special values ──────────────────

describe('AF-02 · formatPayload — serialisation and special values', () => {
  it('AF-02-01: formatPayload is a function', () => {
    expect(typeof formatPayload).toBe('function');
  });

  it('AF-02-02: formatPayload(undefined) → "—"', () => {
    expect(formatPayload(undefined)).toBe('—');
  });

  it('AF-02-03: formatPayload(null) → "null"', () => {
    expect(formatPayload(null)).toBe('null');
  });

  it('AF-02-04: formatPayload("hello") → \'"hello"\'', () => {
    expect(formatPayload('hello')).toBe('"hello"');
  });

  it('AF-02-05: formatPayload with short object → full JSON', () => {
    const result = formatPayload({ ok: true });
    expect(result).toBe('{"ok":true}');
  });

  it('AF-02-06: formatPayload with object > 120 chars → truncated with "…"', () => {
    const longPayload = { key: 'a'.repeat(120) };
    const result = formatPayload(longPayload);
    expect(result.endsWith('…')).toBe(true);
    expect(result.length).toBeLessThan(JSON.stringify(longPayload).length);
  });

  it('AF-02-07: formatPayload on circular reference → "[non-serializable]"', () => {
    const obj: Record<string, unknown> = {};
    obj['self'] = obj;
    expect(formatPayload(obj)).toBe('[non-serializable]');
  });
});

// ─── AF-03: formatTimestamp — edge cases ─────────────────────────────────────

describe('AF-03 · formatTimestamp — edge cases', () => {
  it('AF-03-01: formatTimestamp(1) → "00:00:00.001" (one millisecond)', () => {
    expect(formatTimestamp(1)).toBe('00:00:00.001');
  });

  it('AF-03-02: formatTimestamp(3600000) → "01:00:00.000" (one hour)', () => {
    expect(formatTimestamp(3_600_000)).toBe('01:00:00.000');
  });

  it('AF-03-03: formatTimestamp(86399999) → "23:59:59.999" (midnight minus 1ms)', () => {
    expect(formatTimestamp(86_399_999)).toBe('23:59:59.999');
  });

  it('AF-03-04: result matches HH:MM:SS.mmm pattern', () => {
    const result = formatTimestamp(45_296_789);
    expect(result).toMatch(/^\d{2}:\d{2}:\d{2}\.\d{3}$/);
  });

  it('AF-03-05: result length is always 12 characters', () => {
    expect(formatTimestamp(0).length).toBe(12);
    expect(formatTimestamp(86_399_999).length).toBe(12);
    expect(formatTimestamp(3_600_000).length).toBe(12);
  });

  it('AF-03-06: large real-world timestamp formats correctly', () => {
    const ts = new Date('2026-06-19T14:22:07.456Z').getTime();
    expect(formatTimestamp(ts)).toBe('14:22:07.456');
  });

  it('AF-03-07: two calls with same ts return equal strings', () => {
    const ts = 1_234_567;
    expect(formatTimestamp(ts)).toBe(formatTimestamp(ts));
  });
});

// ─── AF-04: formatPayload — boundary and edge cases ──────────────────────────

describe('AF-04 · formatPayload — boundary and edge cases', () => {
  it('AF-04-01: formatPayload(42) → "42"', () => {
    expect(formatPayload(42)).toBe('42');
  });

  it('AF-04-02: formatPayload(true) → "true"', () => {
    expect(formatPayload(true)).toBe('true');
  });

  it('AF-04-03: formatPayload([]) → "[]"', () => {
    expect(formatPayload([])).toBe('[]');
  });

  it('AF-04-04: formatPayload({}) → "{}"', () => {
    expect(formatPayload({})).toBe('{}');
  });

  it('AF-04-05: string serialising to exactly 120 chars → not truncated', () => {
    // '"' + 118 chars + '"' = 120 chars → JSON.stringify length = 120, not > 120
    const payload = 'x'.repeat(118);
    const result = formatPayload(payload);
    expect(result.length).toBe(120);
    expect(result.endsWith('…')).toBe(false);
  });

  it('AF-04-06: string serialising to 121 chars → truncated to 117 + "…"', () => {
    // '"' + 119 chars + '"' = 121 chars → truncated
    const payload = 'x'.repeat(119);
    const result = formatPayload(payload);
    expect(result.endsWith('…')).toBe(true);
    expect(result.length).toBe(118); // 117 + length('…') === 118 in JS
  });

  it('AF-04-07: empty string "" → \'""\'', () => {
    expect(formatPayload('')).toBe('""');
  });
});

// ─── AF-05: formatTimestampLocale — vi-VN display format ─────────────────────

describe('AF-05 · formatTimestampLocale — vi-VN display format', () => {
  it('AF-05-01: formatTimestampLocale is a function', () => {
    expect(typeof formatTimestampLocale).toBe('function');
  });

  it('AF-05-02: returns a string', () => {
    expect(typeof formatTimestampLocale(1_750_000_000_000)).toBe('string');
  });

  it('AF-05-03: returns a non-empty string', () => {
    expect(formatTimestampLocale(1_750_000_000_000).length).toBeGreaterThan(0);
  });

  it('AF-05-04: two calls with same ts return equal strings', () => {
    const ts = 1_750_000_000_000;
    expect(formatTimestampLocale(ts)).toBe(formatTimestampLocale(ts));
  });
});
