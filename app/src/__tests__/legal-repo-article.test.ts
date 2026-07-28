/**
 * MemoryArticleRepository tests — repository interface contract
 *
 * Groups (13 × 3 = 39):
 *   LRA-01  saveArticle / findArticle — basic CRUD
 *   LRA-02  listArticles — filtering and sortOrder
 *   LRA-03  saveClause / findClause — basic CRUD
 *   LRA-04  listClauses — filtering by articleId
 *   LRA-05  savePoint / findPoint — basic CRUD
 *   LRA-06  listPoints — filtering and label sort
 *   LRA-07  saveAppendix / findAppendix — basic CRUD
 *   LRA-08  listAppendices — filtering by documentId
 *   LRA-09  importFromParsed — article count
 *   LRA-10  importFromParsed — clause and point counts
 *   LRA-11  importFromParsed — appendix count
 *   LRA-12  findArticle / findClause / findPoint return null for missing
 *   LRA-13  PrismaArticleRepository throws PrismaNotReadyError
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryArticleRepository } from '../legal/memoryRepositories';
import { PrismaArticleRepository } from '../legal/prismaRepositories';
import type { IArticleRepository } from '../legal/legalRepositories';
import type { Article, Clause, Point, Appendix } from '../legal/legalSchema';
import { VietnamLegalStructureParser } from '../agents/VietnamLegalStructureParser';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const DOC = 'luat-22-2023';
const OTHER_DOC = 'nd-214-2025';

const A1: Article = {
  id: `${DOC}-dieu-1`, documentId: DOC, versionId: null,
  number: 1, title: 'Phạm vi điều chỉnh', content: 'Luật này quy định...',
  chapterRef: 'I', sortOrder: 0,
};
const A2: Article = {
  id: `${DOC}-dieu-2`, documentId: DOC, versionId: null,
  number: 2, title: 'Đối tượng áp dụng', content: 'Tổ chức, cá nhân...',
  chapterRef: 'I', sortOrder: 1,
};
const A_OTHER: Article = {
  id: `${OTHER_DOC}-dieu-1`, documentId: OTHER_DOC, versionId: null,
  number: 1, title: 'Other', content: 'Other', chapterRef: null, sortOrder: 0,
};

const C1: Clause = { id: `${A1.id}-khoan-1`, articleId: A1.id, number: 1, content: 'Khoản 1', sortOrder: 1 };
const C2: Clause = { id: `${A1.id}-khoan-2`, articleId: A1.id, number: 2, content: 'Khoản 2', sortOrder: 2 };
const C3: Clause = { id: `${A2.id}-khoan-1`, articleId: A2.id, number: 1, content: 'Khoản 1 của A2', sortOrder: 1 };

const P1: Point = { id: `${C1.id}-diem-a`, clauseId: C1.id, label: 'a', content: 'Điểm a', sortOrder: 0 };
const P2: Point = { id: `${C1.id}-diem-b`, clauseId: C1.id, label: 'b', content: 'Điểm b', sortOrder: 1 };

const APP1: Appendix = { id: `${DOC}-phuluc-I`, documentId: DOC, versionId: null, number: 'I', title: 'Danh mục', content: 'Nội dung PL' };
const APP2: Appendix = { id: `${DOC}-phuluc-II`, documentId: DOC, versionId: null, number: 'II', title: 'Mẫu hợp đồng', content: 'Nội dung PL II' };

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

// ─── LRA-01: saveArticle / findArticle ───────────────────────────────────────

describe('LRA-01 saveArticle/findArticle basic CRUD', () => {
  let repo: IArticleRepository;
  beforeEach(() => { repo = new MemoryArticleRepository(); });

  it('findArticle returns null before any saves', async () => {
    expect(await repo.findArticle('unknown')).toBeNull();
  });
  it('findArticle returns article after saveArticle', async () => {
    await repo.saveArticle(A1);
    expect(await repo.findArticle(A1.id)).toEqual(A1);
  });
  it('found article has correct documentId', async () => {
    await repo.saveArticle(A1);
    expect((await repo.findArticle(A1.id))!.documentId).toBe(DOC);
  });
});

// ─── LRA-02: listArticles ────────────────────────────────────────────────────

describe('LRA-02 listArticles filters by documentId and sorts by sortOrder', () => {
  let repo: IArticleRepository;
  beforeEach(async () => {
    repo = new MemoryArticleRepository();
    await repo.saveArticle(A2); // sortOrder 1
    await repo.saveArticle(A1); // sortOrder 0
    await repo.saveArticle(A_OTHER);
  });

  it('returns only articles for DOC (2 articles)', async () => {
    expect(await repo.listArticles(DOC)).toHaveLength(2);
  });
  it('first article is sortOrder 0 (A1)', async () => {
    expect((await repo.listArticles(DOC))[0]!.number).toBe(1);
  });
  it('returns empty array for unknown documentId', async () => {
    expect(await repo.listArticles('nonexistent')).toHaveLength(0);
  });
});

// ─── LRA-03: saveClause / findClause ─────────────────────────────────────────

describe('LRA-03 saveClause/findClause basic CRUD', () => {
  let repo: IArticleRepository;
  beforeEach(() => { repo = new MemoryArticleRepository(); });

  it('findClause returns null before save', async () => {
    expect(await repo.findClause('unknown')).toBeNull();
  });
  it('findClause returns clause after saveClause', async () => {
    await repo.saveClause(C1);
    expect(await repo.findClause(C1.id)).toEqual(C1);
  });
  it('clause has correct articleId', async () => {
    await repo.saveClause(C1);
    expect((await repo.findClause(C1.id))!.articleId).toBe(A1.id);
  });
});

// ─── LRA-04: listClauses ─────────────────────────────────────────────────────

describe('LRA-04 listClauses filters by articleId', () => {
  let repo: IArticleRepository;
  beforeEach(async () => {
    repo = new MemoryArticleRepository();
    await repo.saveClause(C1);
    await repo.saveClause(C2);
    await repo.saveClause(C3);
  });

  it('listClauses(A1.id) returns 2 clauses', async () => {
    expect(await repo.listClauses(A1.id)).toHaveLength(2);
  });
  it('listClauses(A2.id) returns 1 clause', async () => {
    expect(await repo.listClauses(A2.id)).toHaveLength(1);
  });
  it('listClauses for unknown articleId returns empty', async () => {
    expect(await repo.listClauses('nonexistent')).toHaveLength(0);
  });
});

// ─── LRA-05: savePoint / findPoint ───────────────────────────────────────────

describe('LRA-05 savePoint/findPoint basic CRUD', () => {
  let repo: IArticleRepository;
  beforeEach(() => { repo = new MemoryArticleRepository(); });

  it('findPoint returns null before save', async () => {
    expect(await repo.findPoint('unknown')).toBeNull();
  });
  it('findPoint returns point after savePoint', async () => {
    await repo.savePoint(P1);
    expect(await repo.findPoint(P1.id)).toEqual(P1);
  });
  it('point has correct clauseId', async () => {
    await repo.savePoint(P1);
    expect((await repo.findPoint(P1.id))!.clauseId).toBe(C1.id);
  });
});

// ─── LRA-06: listPoints ───────────────────────────────────────────────────────

describe('LRA-06 listPoints filters by clauseId and sorts alphabetically', () => {
  let repo: IArticleRepository;
  beforeEach(async () => {
    repo = new MemoryArticleRepository();
    await repo.savePoint(P2); // label 'b'
    await repo.savePoint(P1); // label 'a'
  });

  it('listPoints(C1.id) returns 2 points', async () => {
    expect(await repo.listPoints(C1.id)).toHaveLength(2);
  });
  it('first point label is "a" (alphabetical sort)', async () => {
    expect((await repo.listPoints(C1.id))[0]!.label).toBe('a');
  });
  it('listPoints for clause with no points returns empty', async () => {
    expect(await repo.listPoints(C3.id)).toHaveLength(0);
  });
});

// ─── LRA-07: saveAppendix / findAppendix ─────────────────────────────────────

describe('LRA-07 saveAppendix/findAppendix basic CRUD', () => {
  let repo: IArticleRepository;
  beforeEach(() => { repo = new MemoryArticleRepository(); });

  it('findAppendix returns null before save', async () => {
    expect(await repo.findAppendix('unknown')).toBeNull();
  });
  it('findAppendix returns appendix after saveAppendix', async () => {
    await repo.saveAppendix(APP1);
    expect(await repo.findAppendix(APP1.id)).toEqual(APP1);
  });
  it('appendix has correct documentId', async () => {
    await repo.saveAppendix(APP1);
    expect((await repo.findAppendix(APP1.id))!.documentId).toBe(DOC);
  });
});

// ─── LRA-08: listAppendices ───────────────────────────────────────────────────

describe('LRA-08 listAppendices filters by documentId', () => {
  let repo: IArticleRepository;
  beforeEach(async () => {
    repo = new MemoryArticleRepository();
    await repo.saveAppendix(APP1);
    await repo.saveAppendix(APP2);
    await repo.saveAppendix({ ...APP1, id: 'other-phuluc', documentId: OTHER_DOC });
  });

  it('listAppendices(DOC) returns 2 appendices', async () => {
    expect(await repo.listAppendices(DOC)).toHaveLength(2);
  });
  it('listAppendices(OTHER_DOC) returns 1 appendix', async () => {
    expect(await repo.listAppendices(OTHER_DOC)).toHaveLength(1);
  });
  it('listAppendices for unknown documentId returns empty', async () => {
    expect(await repo.listAppendices('nonexistent')).toHaveLength(0);
  });
});

// ─── LRA-09: importFromParsed — article count ────────────────────────────────

describe('LRA-09 importFromParsed imports articles', () => {
  let repo: IArticleRepository;
  const parser = new VietnamLegalStructureParser();
  beforeEach(() => { repo = new MemoryArticleRepository(); });

  it('articleCount = 3 from PARSED_TEXT', async () => {
    const { articleCount } = await repo.importFromParsed(DOC, null, parser.parse(PARSED_TEXT));
    expect(articleCount).toBe(3);
  });
  it('listArticles(DOC) has 3 after import', async () => {
    await repo.importFromParsed(DOC, null, parser.parse(PARSED_TEXT));
    expect(await repo.listArticles(DOC)).toHaveLength(3);
  });
  it('first imported article has number 1', async () => {
    await repo.importFromParsed(DOC, null, parser.parse(PARSED_TEXT));
    expect((await repo.listArticles(DOC))[0]!.number).toBe(1);
  });
});

// ─── LRA-10: importFromParsed — clause and point counts ──────────────────────

describe('LRA-10 importFromParsed imports clauses and points', () => {
  let repo: IArticleRepository;
  const parser = new VietnamLegalStructureParser();
  beforeEach(() => { repo = new MemoryArticleRepository(); });

  it('clauseCount >= 3', async () => {
    const { clauseCount } = await repo.importFromParsed(DOC, null, parser.parse(PARSED_TEXT));
    expect(clauseCount).toBeGreaterThanOrEqual(3);
  });
  it('pointCount >= 2 (điểm a, b)', async () => {
    const { pointCount } = await repo.importFromParsed(DOC, null, parser.parse(PARSED_TEXT));
    expect(pointCount).toBeGreaterThanOrEqual(2);
  });
  it('listClauses returns clauses for imported articles', async () => {
    await repo.importFromParsed(DOC, null, parser.parse(PARSED_TEXT));
    const articles = await repo.listArticles(DOC);
    const clauses = await repo.listClauses(articles[1]!.id); // Điều 2 has clauses
    expect(clauses.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── LRA-11: importFromParsed — appendix count ───────────────────────────────

describe('LRA-11 importFromParsed imports appendices', () => {
  let repo: IArticleRepository;
  const parser = new VietnamLegalStructureParser();
  beforeEach(() => { repo = new MemoryArticleRepository(); });

  it('appendixCount = 1 (one Phụ lục I)', async () => {
    const { appendixCount } = await repo.importFromParsed(DOC, null, parser.parse(PARSED_TEXT));
    expect(appendixCount).toBe(1);
  });
  it('listAppendices(DOC) has 1 entry', async () => {
    await repo.importFromParsed(DOC, null, parser.parse(PARSED_TEXT));
    expect(await repo.listAppendices(DOC)).toHaveLength(1);
  });
  it('appendix title contains "DANH MỤC"', async () => {
    await repo.importFromParsed(DOC, null, parser.parse(PARSED_TEXT));
    expect((await repo.listAppendices(DOC))[0]!.title).toContain('DANH MỤC');
  });
});

// ─── LRA-12: null returns for missing entities ────────────────────────────────

describe('LRA-12 find methods return null for missing entities', () => {
  const repo: IArticleRepository = new MemoryArticleRepository();

  it('findArticle returns null not undefined', async () => {
    const r = await repo.findArticle('x');
    expect(r).toBeNull();
    expect(r).not.toBeUndefined();
  });
  it('findClause returns null not undefined', async () => {
    const r = await repo.findClause('x');
    expect(r).toBeNull();
  });
  it('findPoint and findAppendix return null', async () => {
    expect(await repo.findPoint('x')).toBeNull();
    expect(await repo.findAppendix('x')).toBeNull();
  });
});

// ─── LRA-13: PrismaArticleRepository (Phase M1 real impl) ────────────────────
// No DATABASE_URL is configured in this environment (Docker unavailable — see
// docs/infrastructure.md); calls surface getPrismaClient()'s guard error instead
// of the old stub-era PrismaNotReadyError, which this class no longer throws.

describe('LRA-13 PrismaArticleRepository throws without DATABASE_URL', () => {
  const repo: IArticleRepository = new PrismaArticleRepository();

  it('saveArticle throws', async () => {
    await expect(repo.saveArticle(A1)).rejects.toThrow(/DATABASE_URL/);
  });
  it('findArticle throws', async () => {
    await expect(repo.findArticle('x')).rejects.toThrow(/DATABASE_URL/);
  });
  it('listClauses throws', async () => {
    await expect(repo.listClauses('x')).rejects.toThrow(/DATABASE_URL/);
  });
});
