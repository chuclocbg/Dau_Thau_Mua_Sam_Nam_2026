/**
 * LegalArticleStore tests
 *
 * Groups (13 × 3 = 39):
 *   LAS-01  addArticle / getArticle — basic CRUD
 *   LAS-02  listArticles — filtering and ordering
 *   LAS-03  addClause / getClause — basic CRUD
 *   LAS-04  listClauses — filtering by articleId
 *   LAS-05  addPoint / getPoint — basic CRUD
 *   LAS-06  listPoints — filtering and label ordering
 *   LAS-07  addAppendix / getAppendix — basic CRUD
 *   LAS-08  listAppendices — filtering by documentId
 *   LAS-09  importFromParsed — article count
 *   LAS-10  importFromParsed — clause and point counts
 *   LAS-11  importFromParsed — appendix count
 *   LAS-12  stats() — reflects all stored entities
 *   LAS-13  clear() — resets all stores
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { LegalArticleStore } from '../legal/legalArticleStore';
import { VietnamLegalStructureParser } from '../agents/VietnamLegalStructureParser';
import type { Article, Clause, Point, Appendix } from '../legal/legalSchema';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const DOC_ID = 'luat-22-2023';

const A1: Article = {
  id: `${DOC_ID}-dieu-1`, documentId: DOC_ID, versionId: null,
  number: 1, title: 'Phạm vi điều chỉnh', content: 'Luật này quy định...',
  chapterRef: 'I', sortOrder: 0,
};
const A2: Article = {
  id: `${DOC_ID}-dieu-2`, documentId: DOC_ID, versionId: null,
  number: 2, title: 'Đối tượng áp dụng', content: 'Tổ chức, cá nhân...',
  chapterRef: 'I', sortOrder: 1,
};
const A3: Article = {
  id: 'other-doc-dieu-1', documentId: 'other-doc', versionId: null,
  number: 1, title: 'Other', content: 'Other content',
  chapterRef: null, sortOrder: 0,
};

const C1: Clause = { id: `${DOC_ID}-dieu-1-khoan-1`, articleId: A1.id, number: 1, content: 'Clause 1', sortOrder: 1 };
const C2: Clause = { id: `${DOC_ID}-dieu-1-khoan-2`, articleId: A1.id, number: 2, content: 'Clause 2', sortOrder: 2 };
const C3: Clause = { id: `${DOC_ID}-dieu-2-khoan-1`, articleId: A2.id, number: 1, content: 'Clause from A2', sortOrder: 1 };

const P1: Point = { id: `${C1.id}-diem-a`, clauseId: C1.id, label: 'a', content: 'Point a', sortOrder: 0 };
const P2: Point = { id: `${C1.id}-diem-b`, clauseId: C1.id, label: 'b', content: 'Point b', sortOrder: 1 };

const APP1: Appendix = { id: `${DOC_ID}-phuluc-I`, documentId: DOC_ID, versionId: null, number: 'I', title: 'Danh mục', content: 'Content 1' };

const PARSED_TEXT = `QUỐC HỘI
Số: 22/2023/QH15
LUẬT ĐẤU THẦU

Điều 1. Phạm vi điều chỉnh
Luật này quy định về hoạt động đấu thầu.

Điều 2. Đối tượng áp dụng
1. Tổ chức, cá nhân tham gia đấu thầu.
2. Không áp dụng cho:
a) Mua sắm nội bộ.
b) Mua sắm nhỏ lẻ.

Điều 3. Giải thích từ ngữ
1. Đấu thầu là quá trình lựa chọn nhà thầu.

Phụ lục I
DANH MỤC GÓI THẦU

Nội dung phụ lục.`;

// ─── LAS-01: addArticle / getArticle ─────────────────────────────────────────

describe('LAS-01 addArticle / getArticle basic CRUD', () => {
  const store = new LegalArticleStore();

  it('getArticle returns undefined for unknown id', () => {
    expect(store.getArticle('unknown')).toBeUndefined();
  });
  it('getArticle returns article after addArticle', () => {
    store.addArticle(A1);
    expect(store.getArticle(A1.id)).toEqual(A1);
  });
  it('addArticle overwrites existing entry with same id', () => {
    const updated: Article = { ...A1, title: 'Updated' };
    store.addArticle(updated);
    expect(store.getArticle(A1.id)!.title).toBe('Updated');
  });
});

// ─── LAS-02: listArticles ─────────────────────────────────────────────────────

describe('LAS-02 listArticles filters by documentId and orders by sortOrder', () => {
  let store: LegalArticleStore;
  beforeEach(() => {
    store = new LegalArticleStore();
    store.addArticle(A2); // sortOrder 1
    store.addArticle(A1); // sortOrder 0
    store.addArticle(A3); // different doc
  });

  it('returns only articles for the given documentId', () => {
    expect(store.listArticles(DOC_ID)).toHaveLength(2);
  });
  it('first article is sortOrder 0 (A1)', () => {
    expect(store.listArticles(DOC_ID)[0]!.number).toBe(1);
  });
  it('returns empty array for unknown documentId', () => {
    expect(store.listArticles('nonexistent')).toHaveLength(0);
  });
});

// ─── LAS-03: addClause / getClause ───────────────────────────────────────────

describe('LAS-03 addClause / getClause basic CRUD', () => {
  const store = new LegalArticleStore();

  it('getClause returns undefined for unknown id', () => {
    expect(store.getClause('unknown')).toBeUndefined();
  });
  it('getClause returns clause after addClause', () => {
    store.addClause(C1);
    expect(store.getClause(C1.id)).toEqual(C1);
  });
  it('clause has correct articleId', () => {
    expect(store.getClause(C1.id)!.articleId).toBe(A1.id);
  });
});

// ─── LAS-04: listClauses ─────────────────────────────────────────────────────

describe('LAS-04 listClauses filters by articleId', () => {
  let store: LegalArticleStore;
  beforeEach(() => {
    store = new LegalArticleStore();
    store.addClause(C1);
    store.addClause(C2);
    store.addClause(C3);
  });

  it('returns 2 clauses for A1', () => {
    expect(store.listClauses(A1.id)).toHaveLength(2);
  });
  it('returns 1 clause for A2', () => {
    expect(store.listClauses(A2.id)).toHaveLength(1);
  });
  it('returns empty for unknown articleId', () => {
    expect(store.listClauses('nonexistent')).toHaveLength(0);
  });
});

// ─── LAS-05: addPoint / getPoint ─────────────────────────────────────────────

describe('LAS-05 addPoint / getPoint basic CRUD', () => {
  const store = new LegalArticleStore();

  it('getPoint returns undefined for unknown id', () => {
    expect(store.getPoint('unknown')).toBeUndefined();
  });
  it('getPoint returns point after addPoint', () => {
    store.addPoint(P1);
    expect(store.getPoint(P1.id)).toEqual(P1);
  });
  it('point has correct clauseId', () => {
    expect(store.getPoint(P1.id)!.clauseId).toBe(C1.id);
  });
});

// ─── LAS-06: listPoints ───────────────────────────────────────────────────────

describe('LAS-06 listPoints filters by clauseId', () => {
  let store: LegalArticleStore;
  beforeEach(() => {
    store = new LegalArticleStore();
    store.addPoint(P1);
    store.addPoint(P2);
  });

  it('returns 2 points for C1', () => {
    expect(store.listPoints(C1.id)).toHaveLength(2);
  });
  it('first point label is "a" (alphabetical)', () => {
    expect(store.listPoints(C1.id)[0]!.label).toBe('a');
  });
  it('returns empty for clause with no points', () => {
    expect(store.listPoints(C3.id)).toHaveLength(0);
  });
});

// ─── LAS-07: addAppendix / getAppendix ───────────────────────────────────────

describe('LAS-07 addAppendix / getAppendix basic CRUD', () => {
  const store = new LegalArticleStore();

  it('getAppendix returns undefined for unknown id', () => {
    expect(store.getAppendix('unknown')).toBeUndefined();
  });
  it('getAppendix returns appendix after addAppendix', () => {
    store.addAppendix(APP1);
    expect(store.getAppendix(APP1.id)).toEqual(APP1);
  });
  it('appendix has correct documentId', () => {
    expect(store.getAppendix(APP1.id)!.documentId).toBe(DOC_ID);
  });
});

// ─── LAS-08: listAppendices ───────────────────────────────────────────────────

describe('LAS-08 listAppendices filters by documentId', () => {
  let store: LegalArticleStore;
  beforeEach(() => {
    store = new LegalArticleStore();
    store.addAppendix(APP1);
    store.addAppendix({ ...APP1, id: `${DOC_ID}-phuluc-II`, number: 'II', title: 'Mẫu hợp đồng' });
    store.addAppendix({ ...APP1, id: 'other-phuluc', documentId: 'other-doc' });
  });

  it('returns 2 appendices for DOC_ID', () => {
    expect(store.listAppendices(DOC_ID)).toHaveLength(2);
  });
  it('returns 1 appendix for other-doc', () => {
    expect(store.listAppendices('other-doc')).toHaveLength(1);
  });
  it('returns empty for unknown documentId', () => {
    expect(store.listAppendices('nonexistent')).toHaveLength(0);
  });
});

// ─── LAS-09: importFromParsed — article count ────────────────────────────────

describe('LAS-09 importFromParsed imports articles from ParsedDocument', () => {
  let store: LegalArticleStore;
  const parser = new VietnamLegalStructureParser();

  beforeEach(() => { store = new LegalArticleStore(); });

  it('imports 3 articles from PARSED_TEXT', () => {
    const parsed = parser.parse(PARSED_TEXT);
    const { articleCount } = store.importFromParsed(DOC_ID, null, parsed);
    expect(articleCount).toBe(3);
  });
  it('listArticles(DOC_ID) returns 3 articles after import', () => {
    store.importFromParsed(DOC_ID, null, parser.parse(PARSED_TEXT));
    expect(store.listArticles(DOC_ID)).toHaveLength(3);
  });
  it('imported article[0] has number 1', () => {
    store.importFromParsed(DOC_ID, null, parser.parse(PARSED_TEXT));
    expect(store.listArticles(DOC_ID)[0]!.number).toBe(1);
  });
});

// ─── LAS-10: importFromParsed — clause and point counts ──────────────────────

describe('LAS-10 importFromParsed imports clauses and points', () => {
  let store: LegalArticleStore;
  const parser = new VietnamLegalStructureParser();

  beforeEach(() => { store = new LegalArticleStore(); });

  it('clauseCount >= 3 (Điều 2: khoản 1,2; Điều 3: khoản 1)', () => {
    const { clauseCount } = store.importFromParsed(DOC_ID, null, parser.parse(PARSED_TEXT));
    expect(clauseCount).toBeGreaterThanOrEqual(3);
  });
  it('pointCount >= 2 (điểm a, b under Điều 2 khoản 2)', () => {
    const { pointCount } = store.importFromParsed(DOC_ID, null, parser.parse(PARSED_TEXT));
    expect(pointCount).toBeGreaterThanOrEqual(2);
  });
  it('stats() reflects imported clauses and points', () => {
    store.importFromParsed(DOC_ID, null, parser.parse(PARSED_TEXT));
    expect(store.stats().clauses).toBeGreaterThanOrEqual(3);
  });
});

// ─── LAS-11: importFromParsed — appendix count ───────────────────────────────

describe('LAS-11 importFromParsed imports appendices', () => {
  let store: LegalArticleStore;
  const parser = new VietnamLegalStructureParser();

  beforeEach(() => { store = new LegalArticleStore(); });

  it('appendixCount = 1 from PARSED_TEXT (one Phụ lục I)', () => {
    const { appendixCount } = store.importFromParsed(DOC_ID, null, parser.parse(PARSED_TEXT));
    expect(appendixCount).toBe(1);
  });
  it('listAppendices(DOC_ID) has 1 entry', () => {
    store.importFromParsed(DOC_ID, null, parser.parse(PARSED_TEXT));
    expect(store.listAppendices(DOC_ID)).toHaveLength(1);
  });
  it('appendix title contains "DANH MỤC"', () => {
    store.importFromParsed(DOC_ID, null, parser.parse(PARSED_TEXT));
    expect(store.listAppendices(DOC_ID)[0]!.title).toContain('DANH MỤC');
  });
});

// ─── LAS-12: stats() ─────────────────────────────────────────────────────────

describe('LAS-12 stats() returns correct entity counts', () => {
  let store: LegalArticleStore;
  beforeEach(() => {
    store = new LegalArticleStore();
    store.addArticle(A1);
    store.addArticle(A2);
    store.addClause(C1);
    store.addPoint(P1);
    store.addAppendix(APP1);
  });

  it('articles = 2', () => {
    expect(store.stats().articles).toBe(2);
  });
  it('clauses = 1', () => {
    expect(store.stats().clauses).toBe(1);
  });
  it('points = 1, appendices = 1', () => {
    expect(store.stats().points).toBe(1);
    expect(store.stats().appendices).toBe(1);
  });
});

// ─── LAS-13: clear() ─────────────────────────────────────────────────────────

describe('LAS-13 clear() resets all stores', () => {
  let store: LegalArticleStore;
  beforeEach(() => {
    store = new LegalArticleStore();
    store.addArticle(A1);
    store.addClause(C1);
    store.addPoint(P1);
    store.addAppendix(APP1);
    store.clear();
  });

  it('articles is empty after clear', () => {
    expect(store.stats().articles).toBe(0);
  });
  it('clauses is empty after clear', () => {
    expect(store.stats().clauses).toBe(0);
  });
  it('listArticles returns empty after clear', () => {
    expect(store.listArticles(DOC_ID)).toHaveLength(0);
  });
});
