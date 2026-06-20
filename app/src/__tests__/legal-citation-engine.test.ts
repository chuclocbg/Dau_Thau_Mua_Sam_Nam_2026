/**
 * Legal v1.4 — Citation engine tests
 *
 * Groups:
 *   CE-01  (5)  extractDocumentName — prefix stripping, underscore normalisation
 *   CE-02  (5)  extractArticleRef   — Điều / Khoản / Điểm patterns
 *   CE-03  (4)  formatCitation      — combine article ref + document name
 *   CE-04  (4)  extractCitations    — unit tests over controlled SearchIndexResult[]
 *   CE-05  (3)  integration         — real searchLegalIndex output
 */

import { describe, it, expect } from 'vitest';
import {
  extractDocumentName,
  extractArticleRef,
  formatCitation,
  extractCitations,
  type CitationResult,
} from '../ai/legalCitationEngine';
import { searchLegalIndex, type SearchIndexResult } from '../ai/searchLegalIndex';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeResult(overrides: Partial<SearchIndexResult> = {}): SearchIndexResult {
  return {
    score: 5,
    title: 'Nghị định 214_2025_NĐ-CP hướng dẫn Luật Đấu thầu',
    category: 'Decrees',
    sourceFile: 'Decrees/nd-214.docx',
    effectiveDate: '15/06/2025',
    content: 'Khoản 1 Điều 5 quy định về hình thức lựa chọn nhà thầu.',
    ...overrides,
  };
}

// ─── CE-01 · extractDocumentName ─────────────────────────────────────────────

describe('CE-01 · extractDocumentName', () => {
  it('CE-01-01: strips numeric "N. " prefix and normalises underscores', () => {
    const result = extractDocumentName('1. Luật đấu thầu số 22_2023_QH15');
    expect(result).toBe('Luật đấu thầu số 22/2023/QH15');
  });

  it('CE-01-02: normalises Nghị định code with underscore separators', () => {
    const result = extractDocumentName('4. Nghị định 214_2025_NĐ-CP hướng dẫn Luật Đấu thầu');
    expect(result).toBe('Nghị định 214/2025/NĐ-CP');
  });

  it('CE-01-03: normalises Thông tư code with underscore separators', () => {
    const result = extractDocumentName('9. Thông tư 79_2025_TT-BTC đăng tải đấu thầu');
    expect(result).toBe('Thông tư 79/2025/TT-BTC');
  });

  it('CE-01-04: title with slash separators already is returned unchanged', () => {
    const result = extractDocumentName('Nghị định 60/2021/NĐ-CP');
    expect(result).toBe('Nghị định 60/2021/NĐ-CP');
  });

  it('CE-01-05: title with no document code returns cleaned title', () => {
    const result = extractDocumentName('Nội quy của Trường');
    expect(result).toBe('Nội quy của Trường');
  });
});

// ─── CE-02 · extractArticleRef ────────────────────────────────────────────────

describe('CE-02 · extractArticleRef', () => {
  it('CE-02-01: returns null when no Điều/Khoản/Điểm found', () => {
    expect(extractArticleRef('Quy định chung về mua sắm công.')).toBeNull();
  });

  it('CE-02-02: matches bare Điều reference', () => {
    const ref = extractArticleRef('Theo Điều 12 Nghị định này, nhà thầu phải nộp hồ sơ.');
    expect(ref).toBe('Điều 12');
  });

  it('CE-02-03: matches Khoản + Điều reference', () => {
    const ref = extractArticleRef('Khoản 2 Điều 18 quy định thời hạn nộp hồ sơ dự thầu.');
    expect(ref).toBe('Khoản 2 Điều 18');
  });

  it('CE-02-04: matches Điểm + Khoản + Điều reference (most specific)', () => {
    const ref = extractArticleRef('Điểm a Khoản 3 Điều 7 về hình thức lựa chọn nhà thầu.');
    expect(ref).toBe('Điểm a Khoản 3 Điều 7');
  });

  it('CE-02-05: prefers most specific pattern when content has multiple levels', () => {
    // Content has Điểm + Khoản + Điều — must NOT fall through to Điều only
    const content = 'Điểm b Khoản 1 Điều 4 về chỉ định thầu và Điều 6 về đấu thầu rộng rãi.';
    const ref = extractArticleRef(content);
    expect(ref).toBe('Điểm b Khoản 1 Điều 4');
  });
});

// ─── CE-03 · formatCitation ───────────────────────────────────────────────────

describe('CE-03 · formatCitation', () => {
  it('CE-03-01: combines article ref and document name with a space', () => {
    const result = formatCitation('Khoản 2 Điều 12', 'Nghị định 214/2025/NĐ-CP');
    expect(result).toBe('Khoản 2 Điều 12 Nghị định 214/2025/NĐ-CP');
  });

  it('CE-03-02: returns document name only when articleRef is null', () => {
    const result = formatCitation(null, 'Luật đấu thầu số 22/2023/QH15');
    expect(result).toBe('Luật đấu thầu số 22/2023/QH15');
  });

  it('CE-03-03: Điểm level produces a complete nested citation', () => {
    const result = formatCitation('Điểm a Khoản 3 Điều 7', 'Thông tư 79/2025/TT-BTC');
    expect(result).toBe('Điểm a Khoản 3 Điều 7 Thông tư 79/2025/TT-BTC');
  });

  it('CE-03-04: Vietnamese characters are preserved exactly', () => {
    const result = formatCitation('Điều 1', 'Nghị định 60/2021/NĐ-CP');
    expect(result).toContain('Điều');
    expect(result).toContain('Nghị định');
    expect(result).toContain('NĐ-CP');
  });
});

// ─── CE-04 · extractCitations ─────────────────────────────────────────────────

describe('CE-04 · extractCitations', () => {
  it('CE-04-01: empty array input returns empty array', () => {
    expect(extractCitations([])).toHaveLength(0);
  });

  it('CE-04-02: output length equals input length', () => {
    const results = [makeResult(), makeResult({ title: 'Thông tư 79_2025_TT-BTC' })];
    expect(extractCitations(results)).toHaveLength(2);
  });

  it('CE-04-03: each CitationResult has all five required fields', () => {
    const citations: CitationResult[] = extractCitations([makeResult()]);
    const REQUIRED: (keyof CitationResult)[] = [
      'citation', 'title', 'effectiveDate', 'sourceFile', 'content',
    ];
    for (const c of citations) {
      for (const field of REQUIRED) {
        expect(c).toHaveProperty(field);
        expect(typeof c[field]).toBe('string');
        expect(c[field].length).toBeGreaterThan(0);
      }
    }
  });

  it('CE-04-04: citation includes the document name extracted from title', () => {
    const result = makeResult({
      title: 'Nghị định 214_2025_NĐ-CP hướng dẫn Luật Đấu thầu',
      content: 'Khoản 1 Điều 5 quy định về lựa chọn nhà thầu.',
    });
    const [citation] = extractCitations([result]);
    expect(citation.citation).toContain('214/2025/NĐ-CP');
    expect(citation.citation).toContain('Khoản 1 Điều 5');
  });
});

// ─── CE-05 · Integration with searchLegalIndex ───────────────────────────────

describe('CE-05 · Integration', () => {
  it('CE-05-01: searchLegalIndex results feed into extractCitations without error', () => {
    const results = searchLegalIndex('lựa chọn nhà thầu');
    expect(() => extractCitations(results)).not.toThrow();
  });

  it('CE-05-02: each citation has a non-empty citation string', () => {
    const results = searchLegalIndex('đấu thầu');
    const citations = extractCitations(results);
    expect(citations.length).toBeGreaterThan(0);
    for (const c of citations) {
      expect(c.citation.length).toBeGreaterThan(0);
    }
  });

  it('CE-05-03: output is deterministic — same query twice yields equal citations', () => {
    const first = extractCitations(searchLegalIndex('gói thầu'));
    const second = extractCitations(searchLegalIndex('gói thầu'));
    expect(first).toEqual(second);
  });
});
