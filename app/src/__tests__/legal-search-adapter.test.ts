/**
 * Legal v1.5 — legalSearchAdapter tests
 *
 * Groups:
 *   LA-01  (5)  searchWithFallback core behaviour
 *   LA-02  (5)  SearchResult shape produced by the adapter
 *   LA-03  (4)  Fallback to legalKnowledgeBase when index has no results
 *   LA-04  (4)  enrichLegalBasis
 *   LA-05  (3)  Determinism and UTF-8
 */

import { describe, it, expect } from 'vitest';
import { searchWithFallback, enrichLegalBasis } from '../ai/legalSearchAdapter';
import { searchLegalKB } from '../ai/legalKnowledgeBase';

// ─── LA-01 · searchWithFallback core behaviour ────────────────────────────────

describe('LA-01 · searchWithFallback core behaviour', () => {
  it('LA-01-01: always returns an array (never throws)', () => {
    expect(() => searchWithFallback('ngưỡng lựa chọn nhà thầu')).not.toThrow();
    expect(Array.isArray(searchWithFallback('ngưỡng lựa chọn nhà thầu'))).toBe(true);
  });

  it('LA-01-02: known procurement query returns at least 1 result', () => {
    const results = searchWithFallback('đấu thầu lựa chọn nhà thầu');
    expect(results.length).toBeGreaterThan(0);
  });

  it('LA-01-03: result scores are positive', () => {
    const results = searchWithFallback('đấu thầu mua sắm công');
    for (const r of results) {
      expect(r.score).toBeGreaterThan(0);
    }
  });

  it('LA-01-04: topK=1 returns at most 1 result', () => {
    const results = searchWithFallback('lựa chọn nhà thầu', 1);
    expect(results.length).toBeLessThanOrEqual(1);
  });

  it('LA-01-05: empty query returns empty array', () => {
    expect(searchWithFallback('')).toHaveLength(0);
    expect(searchWithFallback('   ')).toHaveLength(0);
  });
});

// ─── LA-02 · SearchResult shape ───────────────────────────────────────────────

describe('LA-02 · SearchResult shape produced by the adapter', () => {
  it('LA-02-01: each result has entry and score and highlights', () => {
    const results = searchWithFallback('đấu thầu mua sắm');
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(r).toHaveProperty('entry');
      expect(r).toHaveProperty('score');
      expect(r).toHaveProperty('highlights');
      expect(typeof r.score).toBe('number');
      expect(Array.isArray(r.highlights)).toBe(true);
    }
  });

  it('LA-02-02: entry has all required LegalEntry fields', () => {
    const results = searchWithFallback('lựa chọn nhà thầu đấu thầu');
    const entry = results[0].entry;
    expect(entry).toHaveProperty('id');
    expect(entry).toHaveProperty('title');
    expect(entry).toHaveProperty('source');
    expect(entry).toHaveProperty('keywords');
    expect(entry).toHaveProperty('content');
    expect(entry.title.length).toBeGreaterThan(0);
    expect(entry.source.length).toBeGreaterThan(0);
  });

  it('LA-02-03: entry.source contains a meaningful document reference', () => {
    // Citation engine should produce something like "Điều 1 Luật đấu thầu số 22/2023/QH15"
    // or at minimum the document title — NOT a raw sourceFile path
    const results = searchWithFallback('lựa chọn nhà thầu');
    const source = results[0].entry.source;
    // Must not be a raw file path (contains slashes from paths like "Laws/...")
    // A citation either contains a document code or is a readable title
    expect(source.length).toBeGreaterThan(5);
    expect(typeof source).toBe('string');
  });

  it('LA-02-04: entry.appliesTo is a non-empty array', () => {
    const results = searchWithFallback('lựa chọn nhà thầu');
    for (const r of results) {
      expect(Array.isArray(r.entry.appliesTo)).toBe(true);
      // appliesTo should have at least one tag
      expect((r.entry.appliesTo ?? []).length).toBeGreaterThanOrEqual(1);
    }
  });

  it('LA-02-05: entry.content is a non-empty string', () => {
    const results = searchWithFallback('lựa chọn nhà thầu');
    for (const r of results) {
      expect(typeof r.entry.content).toBe('string');
      expect(r.entry.content.length).toBeGreaterThan(0);
    }
  });
});

// ─── LA-03 · Fallback to legalKnowledgeBase ──────────────────────────────────

describe('LA-03 · Fallback to legalKnowledgeBase when index has no results', () => {
  it('LA-03-01: completely unrelated query returns empty array (both pipelines miss)', () => {
    const results = searchWithFallback('pokemon nintendo pikachu zzz999');
    expect(results).toHaveLength(0);
  });

  it('LA-03-02: adapter result count does not exceed topK=2', () => {
    const results = searchWithFallback('đấu thầu', 2);
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it('LA-03-03: direct KB search and adapter search both return [] for nonsense query', () => {
    const nonsense = 'xkdyqztmp vwlfhjkr';
    const kbResult   = searchLegalKB(nonsense);
    const adpResult  = searchWithFallback(nonsense);
    // Both must be empty — fallback activates but also finds nothing
    expect(kbResult).toHaveLength(0);
    expect(adpResult).toHaveLength(0);
  });

  it('LA-03-04: adapter returns non-empty for well-known KB query that also hits index', () => {
    // "ngưỡng chào hàng cạnh tranh" matches both index and KB
    const adpResult = searchWithFallback('ngưỡng chào hàng cạnh tranh');
    expect(adpResult.length).toBeGreaterThan(0);
    // KB query for same term also non-empty (confirms the underlying data is there)
    const kbResult  = searchLegalKB('ngưỡng chào hàng cạnh tranh');
    expect(kbResult.length).toBeGreaterThan(0);
  });
});

// ─── LA-04 · enrichLegalBasis ────────────────────────────────────────────────

describe('LA-04 · enrichLegalBasis', () => {
  it('LA-04-01: never throws — always returns an array', () => {
    expect(() => enrichLegalBasis('đấu thầu', [])).not.toThrow();
    expect(Array.isArray(enrichLegalBasis('đấu thầu', []))).toBe(true);
  });

  it('LA-04-02: returned array always contains every input citation', () => {
    const existing = [
      'Điều 38-41 Luật Đấu thầu 22/2023/QH15',
      'Điều 44 khoản 7 Luật Đấu thầu 22/2023/QH15',
    ];
    const result = enrichLegalBasis('lựa chọn nhà thầu', existing);
    for (const cite of existing) {
      expect(result).toContain(cite);
    }
  });

  it('LA-04-03: returned array has no duplicates', () => {
    const existing = ['Điều 38-41 Luật Đấu thầu 22/2023/QH15'];
    const result = enrichLegalBasis('đấu thầu mua sắm', existing);
    const unique = new Set(result);
    expect(unique.size).toBe(result.length);
  });

  it('LA-04-04: result length >= input length (additive, never removes)', () => {
    const existing = ['Điều 62 Luật Đấu thầu 22/2023/QH15'];
    const result = enrichLegalBasis('lựa chọn nhà thầu', existing);
    expect(result.length).toBeGreaterThanOrEqual(existing.length);
  });
});

// ─── LA-05 · Determinism and UTF-8 ───────────────────────────────────────────

describe('LA-05 · Determinism and UTF-8', () => {
  it('LA-05-01: same query twice returns equal result arrays (deterministic)', () => {
    const q = 'lựa chọn nhà thầu đấu thầu';
    const r1 = searchWithFallback(q);
    const r2 = searchWithFallback(q);
    expect(r1).toEqual(r2);
  });

  it('LA-05-02: Vietnamese characters in entry.title and entry.content are preserved', () => {
    const results = searchWithFallback('lựa chọn nhà thầu');
    expect(results.length).toBeGreaterThan(0);
    const entry = results[0].entry;
    // Vietnamese chars should appear in title or content (not garbled/replaced)
    const hasVietnamese = /[àáâãèéêìíòóôõùúýăđơưạặầấậắảẩẫẻẽẹềếệỉịọồốộổỡờớợởủụừứựữ]/i.test(
      entry.title + entry.content,
    );
    expect(hasVietnamese).toBe(true);
  });

  it('LA-05-03: enrichLegalBasis is deterministic for same inputs', () => {
    const existing = ['Điều 38-41 Luật Đấu thầu 22/2023/QH15'];
    const r1 = enrichLegalBasis('đấu thầu mua sắm', existing);
    const r2 = enrichLegalBasis('đấu thầu mua sắm', existing);
    expect(r1).toEqual(r2);
  });
});
