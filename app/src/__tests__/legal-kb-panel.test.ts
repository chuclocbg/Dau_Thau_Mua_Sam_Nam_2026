/**
 * 8-D: LegalKBPanel — 56 tests
 *
 * Groups:
 *   LK-01  (4)  never-throw — edge inputs that must not throw
 *   LK-02  (5)  panel structure — required data attributes
 *   LK-03  (5)  loading state — loading=true
 *   LK-04  (5)  empty results state
 *   LK-05  (5)  single result rendering
 *   LK-06  (4)  multiple results
 *   LK-07  (4)  highlights display
 *   LK-08  (4)  appliesTo contexts
 *   LK-09  (4)  score display
 *   LK-10  (5)  query display
 *   LK-11  (5)  result-count attribute and field
 *   LK-12  (6)  searchLegalKB integration — live KB results
 */

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';

import LegalKBPanel from '../components/LegalKBPanel';
import type { LegalKBPanelProps } from '../components/LegalKBPanel';
import { searchLegalKB, LEGAL_KB } from '../ai/legalKnowledgeBase';
import type { SearchResult, LegalEntry } from '../ai/legalKnowledgeBase';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeEntry(id: string, overrides: Partial<LegalEntry> = {}): LegalEntry {
  return {
    id,
    title: `Tiêu đề ${id}`,
    source: `Nguồn căn cứ ${id}`,
    keywords: ['từ khóa mẫu'],
    content: `Nội dung mô tả quy định ${id}`,
    appliesTo: ['legal-review', 'khlcnt'],
    ...overrides,
  };
}

function makeResult(id: string, overrides: Partial<LegalEntry> = {}): SearchResult {
  return {
    entry: makeEntry(id, overrides),
    score: 12.5,
    highlights: [`Điểm nổi bật của ${id}`],
  };
}

const QUERY = 'gói mua sắm thiết bị văn phòng';

function render(props: LegalKBPanelProps): string {
  return renderToString(React.createElement(LegalKBPanel, props));
}

// ─── LK-01 · never-throw ──────────────────────────────────────────────────────

describe('LK-01 · never-throw — edge inputs', () => {
  it('LK-01-01: renders without throwing with results', () => {
    expect(() => render({ query: QUERY, results: [makeResult('kb-001')] })).not.toThrow();
  });

  it('LK-01-02: renders without throwing when results is empty array', () => {
    expect(() => render({ query: QUERY, results: [] })).not.toThrow();
  });

  it('LK-01-03: renders without throwing when loading=true', () => {
    expect(() => render({ query: QUERY, results: [], loading: true })).not.toThrow();
  });

  it('LK-01-04: renders without throwing when result has no highlights', () => {
    const r = makeResult('kb-x', {});
    r.highlights = [];
    expect(() => render({ query: QUERY, results: [r] })).not.toThrow();
  });
});

// ─── LK-02 · panel structure ──────────────────────────────────────────────────

describe('LK-02 · panel structure — required data attributes', () => {
  const html = render({ query: QUERY, results: [makeResult('kb-001')] });

  it('LK-02-01: data-panel="legal-kb" present in ready state', () => {
    expect(html).toContain('data-panel="legal-kb"');
  });

  it('LK-02-02: data-state="ready" in default render with results', () => {
    expect(html).toContain('data-state="ready"');
  });

  it('LK-02-03: data-field="title" h2 present', () => {
    expect(html).toMatch(/<h2[^>]*data-field="title"[^>]*>/);
  });

  it('LK-02-04: data-field="result-list" present', () => {
    expect(html).toContain('data-field="result-list"');
  });

  it('LK-02-05: data-result-count attribute present on root element', () => {
    expect(html).toContain('data-result-count=');
  });
});

// ─── LK-03 · loading state ────────────────────────────────────────────────────

describe('LK-03 · loading state — loading=true', () => {
  const html = render({ query: QUERY, results: [], loading: true });

  it('LK-03-01: data-state="loading" present', () => {
    expect(html).toContain('data-state="loading"');
  });

  it('LK-03-02: Vietnamese loading message visible', () => {
    expect(html).toContain('Đang tìm kiếm căn cứ pháp lý');
  });

  it('LK-03-03: no data-state="ready" when loading', () => {
    expect(html).not.toContain('data-state="ready"');
  });

  it('LK-03-04: no data-field="result-list" when loading', () => {
    expect(html).not.toContain('data-field="result-list"');
  });

  it('LK-03-05: data-panel="legal-kb" still present when loading', () => {
    expect(html).toContain('data-panel="legal-kb"');
  });
});

// ─── LK-04 · empty results state ─────────────────────────────────────────────

describe('LK-04 · empty results state', () => {
  const html = render({ query: QUERY, results: [] });

  it('LK-04-01: data-state="empty" when results is empty array', () => {
    expect(html).toContain('data-state="empty"');
  });

  it('LK-04-02: data-result-count="0" when empty', () => {
    expect(html).toContain('data-result-count="0"');
  });

  it('LK-04-03: Vietnamese empty-state message visible', () => {
    expect(html).toContain('Không tìm thấy căn cứ pháp lý phù hợp');
  });

  it('LK-04-04: data-field="query" present in empty state', () => {
    expect(html).toContain('data-field="query"');
  });

  it('LK-04-05: no data-field="result-list" when empty', () => {
    expect(html).not.toContain('data-field="result-list"');
  });
});

// ─── LK-05 · single result rendering ─────────────────────────────────────────

describe('LK-05 · single result rendering', () => {
  const result = makeResult('kb-003');
  const html = render({ query: QUERY, results: [result] });

  it('LK-05-01: renders exactly one result item (data-result-id appears once)', () => {
    const count = (html.match(/data-result-id=/g) ?? []).length;
    expect(count).toBe(1);
  });

  it('LK-05-02: data-result-id matches entry.id', () => {
    expect(html).toContain('data-result-id="kb-003"');
  });

  it('LK-05-03: data-field="title" shows entry title text', () => {
    expect(html).toContain('Tiêu đề kb-003');
  });

  it('LK-05-04: data-field="source" shows entry source text', () => {
    expect(html).toContain('Nguồn căn cứ kb-003');
  });

  it('LK-05-05: data-field="score" present inside the result item', () => {
    expect(html).toContain('data-field="score"');
  });
});

// ─── LK-06 · multiple results ─────────────────────────────────────────────────

describe('LK-06 · multiple results', () => {
  const results = [makeResult('kb-001'), makeResult('kb-002'), makeResult('kb-005')];
  const html = render({ query: QUERY, results });

  it('LK-06-01: renders exactly 3 result items (data-result-id count = 3)', () => {
    const count = (html.match(/data-result-id=/g) ?? []).length;
    expect(count).toBe(3);
  });

  it('LK-06-02: data-result-count="3" in root element', () => {
    expect(html).toContain('data-result-count="3"');
  });

  it('LK-06-03: data-result-id="kb-001" present', () => {
    expect(html).toContain('data-result-id="kb-001"');
  });

  it('LK-06-04: first result id appears before second in HTML order', () => {
    const pos001 = html.indexOf('data-result-id="kb-001"');
    const pos002 = html.indexOf('data-result-id="kb-002"');
    expect(pos001).toBeLessThan(pos002);
  });
});

// ─── LK-07 · highlights display ──────────────────────────────────────────────

describe('LK-07 · highlights display', () => {
  it('LK-07-01: data-field="highlights" present when highlights non-empty', () => {
    const r = makeResult('kb-h', {});
    r.highlights = ['Điều 57 khoản 1 cấm chia nhỏ gói thầu'];
    const html = render({ query: QUERY, results: [r] });
    expect(html).toContain('data-field="highlights"');
  });

  it('LK-07-02: data-field="highlight" li items present', () => {
    const r = makeResult('kb-h', {});
    r.highlights = ['Điều 57 khoản 1'];
    const html = render({ query: QUERY, results: [r] });
    expect(html).toContain('data-field="highlight"');
  });

  it('LK-07-03: highlight text appears in rendered output', () => {
    const r = makeResult('kb-h', {});
    r.highlights = ['Điều 57 khoản 1 cấm chia nhỏ'];
    const html = render({ query: QUERY, results: [r] });
    expect(html).toContain('Điều 57 khoản 1 cấm chia nhỏ');
  });

  it('LK-07-04: no data-field="highlights" when highlights array is empty', () => {
    const r = makeResult('kb-h', {});
    r.highlights = [];
    const html = render({ query: QUERY, results: [r] });
    expect(html).not.toContain('data-field="highlights"');
  });
});

// ─── LK-08 · appliesTo contexts ──────────────────────────────────────────────

describe('LK-08 · appliesTo contexts', () => {
  it('LK-08-01: data-field="applies-to" present when appliesTo non-empty', () => {
    const r = makeResult('kb-a', { appliesTo: ['legal-review', 'khlcnt'] });
    const html = render({ query: QUERY, results: [r] });
    expect(html).toContain('data-field="applies-to"');
  });

  it('LK-08-02: appliesTo context text appears in rendered output', () => {
    const r = makeResult('kb-a', { appliesTo: ['audit-risk', 'contract'] });
    const html = render({ query: QUERY, results: [r] });
    expect(html).toContain('audit-risk');
  });

  it('LK-08-03: multiple contexts joined with comma separator', () => {
    const r = makeResult('kb-a', { appliesTo: ['legal-review', 'khlcnt'] });
    const html = render({ query: QUERY, results: [r] });
    expect(html).toContain('legal-review, khlcnt');
  });

  it('LK-08-04: no data-field="applies-to" when appliesTo is empty array', () => {
    const r = makeResult('kb-a', { appliesTo: [] });
    const html = render({ query: QUERY, results: [r] });
    expect(html).not.toContain('data-field="applies-to"');
  });
});

// ─── LK-09 · score display ────────────────────────────────────────────────────

describe('LK-09 · score display', () => {
  const result = makeResult('kb-s');
  result.score = 18.75;
  const html = render({ query: QUERY, results: [result] });

  it('LK-09-01: data-score attribute present on result item', () => {
    expect(html).toContain('data-score=');
  });

  it('LK-09-02: data-field="score" element present', () => {
    expect(html).toContain('data-field="score"');
  });

  it('LK-09-03: score formatted to 2 decimal places in data-score', () => {
    expect(html).toContain('data-score="18.75"');
  });

  it('LK-09-04: score value visible in data-field="score" text', () => {
    expect(html).toContain('>18.75<');
  });
});

// ─── LK-10 · query display ────────────────────────────────────────────────────

describe('LK-10 · query display', () => {
  const q = 'mua sắm hóa chất thí nghiệm';

  it('LK-10-01: data-field="query" present in ready state', () => {
    const html = render({ query: q, results: [makeResult('kb-001')] });
    expect(html).toContain('data-field="query"');
  });

  it('LK-10-02: query string content appears in ready HTML', () => {
    const html = render({ query: q, results: [makeResult('kb-001')] });
    expect(html).toContain(q);
  });

  it('LK-10-03: data-field="query" present in empty state', () => {
    const html = render({ query: q, results: [] });
    expect(html).toContain('data-field="query"');
  });

  it('LK-10-04: query string content appears in empty HTML', () => {
    const html = render({ query: q, results: [] });
    expect(html).toContain(q);
  });

  it('LK-10-05: no data-field="query" rendered when loading=true', () => {
    const html = render({ query: q, results: [], loading: true });
    expect(html).not.toContain('data-field="query"');
  });
});

// ─── LK-11 · result-count attribute and field ─────────────────────────────────

describe('LK-11 · result-count attribute and field', () => {
  it('LK-11-01: data-result-count="0" in empty state', () => {
    const html = render({ query: QUERY, results: [] });
    expect(html).toContain('data-result-count="0"');
  });

  it('LK-11-02: data-result-count="1" for single result', () => {
    const html = render({ query: QUERY, results: [makeResult('kb-001')] });
    expect(html).toContain('data-result-count="1"');
  });

  it('LK-11-03: data-result-count matches results.length for 2 items', () => {
    const html = render({ query: QUERY, results: [makeResult('kb-001'), makeResult('kb-002')] });
    expect(html).toContain('data-result-count="2"');
  });

  it('LK-11-04: data-field="result-count" element present in ready state', () => {
    const html = render({ query: QUERY, results: [makeResult('kb-001')] });
    expect(html).toContain('data-field="result-count"');
  });

  it('LK-11-05: data-field="result-count" text numerically matches results.length', () => {
    const results = [makeResult('kb-001'), makeResult('kb-002'), makeResult('kb-003')];
    const html = render({ query: QUERY, results });
    // The text content of data-field="result-count" should be "3"
    expect(html).toMatch(/data-field="result-count"[^>]*>\s*3\s*</);
  });
});

// ─── LK-12 · searchLegalKB integration ───────────────────────────────────────

describe('LK-12 · searchLegalKB integration — live KB results', () => {
  it('LK-12-01: searchLegalKB returns results for procurement method query', () => {
    const results = searchLegalKB('ngưỡng chào hàng cạnh tranh');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].entry.id).toBe('kb-001');
  });

  it('LK-12-02: panel renders live KB entry title', () => {
    const results = searchLegalKB('ngưỡng chào hàng cạnh tranh', 1);
    const html = render({ query: 'ngưỡng chào hàng cạnh tranh', results });
    expect(html).toContain('Ngưỡng và phương thức lựa chọn nhà thầu');
  });

  it('LK-12-03: panel renders live KB entry source', () => {
    const results = searchLegalKB('ngưỡng chào hàng cạnh tranh', 1);
    const html = render({ query: 'ngưỡng chào hàng cạnh tranh', results });
    expect(html).toContain('NĐ 214/2025');
  });

  it('LK-12-04: 8-C entry kb-016 (package splitting) appears in live KB results', () => {
    const results = searchLegalKB('chia nhỏ gói thầu tách gói né ngưỡng', 3);
    const ids = results.map(r => r.entry.id);
    expect(ids).toContain('kb-016');
  });

  it('LK-12-05: data-result-count matches actual live KB result count', () => {
    const results = searchLegalKB('hợp đồng mua sắm', 3);
    const html = render({ query: 'hợp đồng mua sắm', results });
    expect(html).toContain(`data-result-count="${results.length}"`);
  });

  it('LK-12-06: panel handles 8-C kb-019 (asset standards) results correctly', () => {
    const kb019 = LEGAL_KB.find(e => e.id === 'kb-019');
    expect(kb019).toBeDefined();
    const results: SearchResult[] = [{
      entry: kb019!,
      score: 10.0,
      highlights: ['NĐ 186/2025/NĐ-CP'],
    }];
    const html = render({ query: 'tiêu chuẩn định mức tài sản', results });
    expect(html).toContain('data-result-id="kb-019"');
  });
});
