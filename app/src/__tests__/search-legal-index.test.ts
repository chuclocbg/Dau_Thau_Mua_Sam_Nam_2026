/**
 * Legal v1.3 — Search layer tests
 *
 * Groups:
 *   SI-01  (5)  Core behaviour
 *   SI-02  (5)  Scoring weights
 *   SI-03  (4)  Option filters (category, effectiveDate, topK, minScore)
 *   SI-04  (4)  Accent / case normalization
 *   SI-05  (3)  Result shape + integration
 */

import { describe, it, expect } from 'vitest';
import {
  searchIndex,
  searchLegalIndex,
  tokenize,
  type SearchIndexResult,
} from '../ai/searchLegalIndex';

// ─── Controlled fixtures ───────────────────────────────────────────────────────

// IndexEntry shape mirrors legalIndex.json entries
interface IndexEntry {
  id: string; title: string; category: string; sourceFile: string;
  effectiveDate: string; keywords: string[]; content: string; appliesTo: string[];
}

const ENTRY_LAWS: IndexEntry = {
  id: 'doc-laws-luat-22-docx',
  title: 'Luật đấu thầu 22/2023/QH15',
  category: 'Laws',
  sourceFile: 'Laws/luat-22.docx',
  effectiveDate: '01/01/2024',
  keywords: ['dau', 'thau', 'luat', 'chon'],
  content: 'Quy định về đấu thầu, lựa chọn nhà thầu mua sắm công theo ngân sách nhà nước.',
  appliesTo: ['legal-review', 'khlcnt'],
};

const ENTRY_DECREES: IndexEntry = {
  id: 'doc-decrees-nd-214-docx',
  title: 'Nghị định 214/2025/NĐ-CP hướng dẫn Luật Đấu thầu',
  category: 'Decrees',
  sourceFile: 'Decrees/nd-214.docx',
  effectiveDate: '15/06/2025',
  keywords: ['nghi', 'dinh', 'luat', 'huong'],
  content: 'Hướng dẫn thi hành Luật Đấu thầu về lựa chọn nhà thầu thực hiện gói thầu.',
  appliesTo: ['procurement', 'khlcnt'],
};

const ENTRY_CIRCULARS: IndexEntry = {
  id: 'doc-circulars-tt-79-docx',
  title: 'Thông tư 79/2025/TT-BTC đăng tải đấu thầu',
  category: 'Circulars',
  sourceFile: 'Circulars/tt-79.docx',
  effectiveDate: '01/10/2025',
  keywords: ['thong', 'dang', 'mang', 'bao'],
  content: 'Hướng dẫn đăng tải thông tin đấu thầu trên hệ thống mạng đấu thầu quốc gia.',
  appliesTo: ['publication', 'khlcnt'],
};

const SAMPLE_ENTRIES: IndexEntry[] = [ENTRY_LAWS, ENTRY_DECREES, ENTRY_CIRCULARS];

// ─── SI-01 · Core behaviour ───────────────────────────────────────────────────

describe('SI-01 · Core behaviour', () => {
  it('SI-01-01: empty query returns empty array', () => {
    expect(searchIndex(SAMPLE_ENTRIES, '')).toHaveLength(0);
    expect(searchIndex(SAMPLE_ENTRIES, '   ')).toHaveLength(0);
  });

  it('SI-01-02: completely unrelated query returns empty array', () => {
    const r = searchIndex(SAMPLE_ENTRIES, 'pokemon nintendo pikachu');
    expect(r).toHaveLength(0);
  });

  it('SI-01-03: known term returns at least one result', () => {
    const r = searchIndex(SAMPLE_ENTRIES, 'lựa chọn nhà thầu');
    expect(r.length).toBeGreaterThan(0);
  });

  it('SI-01-04: multiple results are sorted by score descending', () => {
    const r = searchIndex(SAMPLE_ENTRIES, 'đấu thầu lựa chọn');
    for (let i = 1; i < r.length; i++) {
      expect(r[i].score).toBeLessThanOrEqual(r[i - 1].score);
    }
  });

  it('SI-01-05: topK limits result count', () => {
    const r = searchIndex(SAMPLE_ENTRIES, 'đấu thầu', { topK: 1 });
    expect(r.length).toBeLessThanOrEqual(1);
  });
});

// ─── SI-02 · Scoring weights ──────────────────────────────────────────────────

describe('SI-02 · Scoring', () => {
  it('SI-02-01: keyword match contributes to score', () => {
    // ENTRY_LAWS has keyword "dau" — query "dau" should score ≥ 3 (keyword bonus)
    const r = searchIndex([ENTRY_LAWS], 'dau', { minScore: 0 });
    expect(r[0].score).toBeGreaterThanOrEqual(3);
  });

  it('SI-02-02: entry with keyword match scores higher than content-only match', () => {
    // ENTRY_LAWS has keyword "dau"; ENTRY_CIRCULARS does NOT have "dau" as keyword
    const rLaws = searchIndex([ENTRY_LAWS], 'dau', { minScore: 0 });
    const rCirc = searchIndex([ENTRY_CIRCULARS], 'dau', { minScore: 0 });
    expect(rLaws[0].score).toBeGreaterThan(rCirc[0].score);
  });

  it('SI-02-03: title match contributes +2 bonus per token', () => {
    // "nghi" appears in ENTRY_DECREES title; not in ENTRY_CIRCULARS title
    const rDec = searchIndex([ENTRY_DECREES], 'nghi', { minScore: 0 });
    const rCirc = searchIndex([ENTRY_CIRCULARS], 'nghi', { minScore: 0 });
    expect(rDec[0].score).toBeGreaterThan(rCirc[0].score);
  });

  it('SI-02-04: score is > 0 for matching entries', () => {
    const r = searchIndex(SAMPLE_ENTRIES, 'đấu thầu', { minScore: 0 });
    for (const result of r) {
      expect(result.score).toBeGreaterThan(0);
    }
  });

  it('SI-02-05: minScore filter excludes low-scoring results', () => {
    const low = searchIndex(SAMPLE_ENTRIES, 'đấu thầu', { minScore: 0 });
    const high = searchIndex(SAMPLE_ENTRIES, 'đấu thầu', { minScore: 10 });
    expect(high.length).toBeLessThanOrEqual(low.length);
  });
});

// ─── SI-03 · Option filters ───────────────────────────────────────────────────

describe('SI-03 · Option filters', () => {
  it('SI-03-01: category filter restricts to matching category', () => {
    const r = searchIndex(SAMPLE_ENTRIES, 'đấu thầu', { category: 'Laws' });
    for (const result of r) {
      expect(result.category).toBe('Laws');
    }
  });

  it('SI-03-02: unknown category returns empty results', () => {
    const r = searchIndex(SAMPLE_ENTRIES, 'đấu thầu', { category: 'Unknown' });
    expect(r).toHaveLength(0);
  });

  it('SI-03-03: effectiveDate filter restricts to exact date match', () => {
    const r = searchIndex(SAMPLE_ENTRIES, 'đấu thầu', { effectiveDate: '01/01/2024' });
    for (const result of r) {
      expect(result.effectiveDate).toBe('01/01/2024');
    }
  });

  it('SI-03-04: category filter is case-insensitive', () => {
    const lower = searchIndex(SAMPLE_ENTRIES, 'đấu thầu', { category: 'laws' });
    const upper = searchIndex(SAMPLE_ENTRIES, 'đấu thầu', { category: 'Laws' });
    expect(lower.length).toBe(upper.length);
  });
});

// ─── SI-04 · Accent / case normalization ─────────────────────────────────────

describe('SI-04 · Accent and case normalization', () => {
  it('SI-04-01: tokenize strips Vietnamese diacritics', () => {
    const t = tokenize('đấu thầu lựa chọn');
    // All tokens must be ASCII after normalization
    expect(t).toContain('dau');
    expect(t).toContain('thau');
    expect(t).toContain('chon');
  });

  it('SI-04-02: accent-free query "dau thau" matches accented content', () => {
    // Content has "đấu thầu" with diacritics; query is bare ASCII
    const r = searchIndex([ENTRY_LAWS], 'dau thau', { minScore: 0 });
    expect(r[0].score).toBeGreaterThan(0);
  });

  it('SI-04-03: upper-case query matches lower-case content', () => {
    const lower = searchIndex(SAMPLE_ENTRIES, 'luật', { minScore: 0 });
    const upper = searchIndex(SAMPLE_ENTRIES, 'LUẬT', { minScore: 0 });
    // Both should find the same entries (case normalised)
    expect(lower.map(r => r.title)).toEqual(upper.map(r => r.title));
  });

  it('SI-04-04: same query twice produces identical results (deterministic)', () => {
    const r1 = searchIndex(SAMPLE_ENTRIES, 'lựa chọn nhà thầu');
    const r2 = searchIndex(SAMPLE_ENTRIES, 'lựa chọn nhà thầu');
    expect(r1).toEqual(r2);
  });
});

// ─── SI-05 · Result shape + integration ──────────────────────────────────────

describe('SI-05 · Result shape and integration', () => {
  it('SI-05-01: each result has exactly the six required fields', () => {
    const r = searchIndex([ENTRY_LAWS], 'dau thau');
    const REQUIRED: (keyof SearchIndexResult)[] = [
      'score', 'title', 'category', 'sourceFile', 'effectiveDate', 'content',
    ];
    for (const result of r) {
      for (const field of REQUIRED) {
        expect(result).toHaveProperty(field);
      }
      expect(typeof result.score).toBe('number');
      expect(typeof result.title).toBe('string');
      expect(typeof result.content).toBe('string');
    }
  });

  it('SI-05-02: searchLegalIndex returns results for a known procurement term', () => {
    // "lựa chọn nhà thầu" appears in the actual legalIndex.json content
    const r = searchLegalIndex('lựa chọn nhà thầu');
    expect(r.length).toBeGreaterThan(0);
    for (const result of r) {
      expect(result.score).toBeGreaterThan(0);
      expect(result.title.length).toBeGreaterThan(0);
    }
  });

  it('SI-05-03: searchLegalIndex with empty query returns empty array', () => {
    expect(searchLegalIndex('')).toHaveLength(0);
  });
});
