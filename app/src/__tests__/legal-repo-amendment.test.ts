/**
 * Memory repository tests — Amendment, Citation, Keyword, EffectivePeriod
 *
 * Groups (13 × 3 = 39):
 *   LRM-01  saveAmendment / findAmendment — basic CRUD
 *   LRM-02  listAmendments — asOf date filter
 *   LRM-03  saveVersion / findVersion — basic CRUD
 *   LRM-04  listVersions — chronological ordering
 *   LRM-05  baselineVersion — creates if absent, idempotent
 *   LRM-06  saveCitation / listCitationsFrom / listCitationsTo
 *   LRM-07  saveKeyword / findKeyword — case-insensitive term match
 *   LRM-08  listKeywords — domain filter
 *   LRM-09  saveDomain / findDomain / listDomains
 *   LRM-10  savePeriod / resolveEffectivePeriod — open-ended period
 *   LRM-11  closePeriod — sets endDate on open period
 *   LRM-12  openPeriod / isDocumentInForce — combined workflow
 *   LRM-13  Prisma stubs throw PrismaNotReadyError
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  MemoryAmendmentRepository,
  MemoryCitationRepository,
  MemoryKeywordRepository,
  MemoryEffectivePeriodRepository,
} from '../legal/memoryRepositories';
import { PrismaAmendmentRepository, PrismaCitationRepository } from '../legal/prismaRepositories';
import type {
  IAmendmentRepository,
  ICitationRepository,
  IKeywordRepository,
  IEffectivePeriodRepository,
} from '../legal/legalRepositories';
import type { Amendment, LegalVersion, LegalCitation, LegalKeyword, LegalDomain, EffectivePeriod } from '../legal/legalSchema';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BASE_DOC  = 'luat-22-2023';
const AMEND_DOC = 'nd-104-2026';

const AMD1: Amendment = {
  id: 'amd-1', baseDocumentId: BASE_DOC, amendingDocumentId: AMEND_DOC,
  amendmentType: 'MODIFY', effectiveDate: '2024-07-01',
  affectedArticles: ['dieu-10'], summary: 'Sửa đổi Điều 10',
};
const AMD2: Amendment = {
  id: 'amd-2', baseDocumentId: BASE_DOC, amendingDocumentId: 'other-doc',
  amendmentType: 'ADD', effectiveDate: '2026-01-01',
  affectedArticles: [], summary: 'Bổ sung điều khoản mới',
};

const V1: LegalVersion = {
  id: `${BASE_DOC}@2024-01-01`, documentId: BASE_DOC,
  versionDate: '2024-01-01', changeNote: 'Văn bản gốc',
  amendedById: null, isBaseline: true,
};
const V2: LegalVersion = {
  id: `${BASE_DOC}@2024-07-01`, documentId: BASE_DOC,
  versionDate: '2024-07-01', changeNote: 'Sửa đổi khoản 1 Điều 10',
  amendedById: 'amd-1', isBaseline: false,
};

const CIT1: LegalCitation = {
  id: 'cit-1', citingDocId: AMEND_DOC, citedDocId: BASE_DOC,
  citingArticle: 'dieu-3', citedArticle: 'dieu-10',
  citedClause: 'khoan-1', citedPoint: null,
  formatted: 'khoản 1 Điều 10 Luật 22/2023/QH15', isDirect: true,
};
const CIT2: LegalCitation = {
  id: 'cit-2', citingDocId: 'other-doc', citedDocId: BASE_DOC,
  citingArticle: null, citedArticle: 'dieu-5',
  citedClause: null, citedPoint: null,
  formatted: 'Điều 5 Luật 22/2023/QH15', isDirect: false,
};

const KW1: LegalKeyword = {
  id: 'kw-1', term: 'đấu thầu', definition: 'Quá trình lựa chọn nhà thầu',
  domain: 'procurement', sourceDocId: BASE_DOC, sourceArticle: 'dieu-4', synonyms: ['mua sắm'],
};
const KW2: LegalKeyword = {
  id: 'kw-2', term: 'nhà thầu', definition: 'Tổ chức, cá nhân tham gia đấu thầu',
  domain: 'procurement', sourceDocId: BASE_DOC, sourceArticle: 'dieu-4', synonyms: [],
};
const KW3: LegalKeyword = {
  id: 'kw-3', term: 'hóa đơn', definition: 'Chứng từ kế toán',
  domain: 'finance', sourceDocId: null, sourceArticle: null, synonyms: [],
};

const DOM1: LegalDomain = {
  id: 'procurement', name: 'Đấu thầu', description: 'Mua sắm công',
  documentIds: [BASE_DOC, AMEND_DOC],
};

// ─── LRM-01: saveAmendment / findAmendment ───────────────────────────────────

describe('LRM-01 saveAmendment/findAmendment basic CRUD', () => {
  let repo: IAmendmentRepository;
  beforeEach(() => { repo = new MemoryAmendmentRepository(); });

  it('findAmendment returns null before save', async () => {
    expect(await repo.findAmendment('unknown')).toBeNull();
  });
  it('findAmendment returns amendment after save', async () => {
    await repo.saveAmendment(AMD1);
    expect(await repo.findAmendment(AMD1.id)).toEqual(AMD1);
  });
  it('amendment has correct baseDocumentId', async () => {
    await repo.saveAmendment(AMD1);
    expect((await repo.findAmendment(AMD1.id))!.baseDocumentId).toBe(BASE_DOC);
  });
});

// ─── LRM-02: listAmendments asOf filter ──────────────────────────────────────

describe('LRM-02 listAmendments filters by asOf date', () => {
  let repo: IAmendmentRepository;
  beforeEach(async () => {
    repo = new MemoryAmendmentRepository();
    await repo.saveAmendment(AMD1); // effectiveDate '2024-07-01'
    await repo.saveAmendment(AMD2); // effectiveDate '2026-01-01'
  });

  it('listAmendments without asOf returns both', async () => {
    expect(await repo.listAmendments(BASE_DOC)).toHaveLength(2);
  });
  it('listAmendments asOf "2025-01-01" returns only AMD1', async () => {
    const result = await repo.listAmendments(BASE_DOC, '2025-01-01');
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('amd-1');
  });
  it('listAmendments for other baseDocId returns empty', async () => {
    expect(await repo.listAmendments('other-base')).toHaveLength(0);
  });
});

// ─── LRM-03: saveVersion / findVersion ───────────────────────────────────────

describe('LRM-03 saveVersion/findVersion basic CRUD', () => {
  let repo: IAmendmentRepository;
  beforeEach(() => { repo = new MemoryAmendmentRepository(); });

  it('findVersion returns null before save', async () => {
    expect(await repo.findVersion('unknown')).toBeNull();
  });
  it('findVersion returns version after save', async () => {
    await repo.saveVersion(V1);
    expect(await repo.findVersion(V1.id)).toEqual(V1);
  });
  it('V1 has isBaseline true', async () => {
    await repo.saveVersion(V1);
    expect((await repo.findVersion(V1.id))!.isBaseline).toBe(true);
  });
});

// ─── LRM-04: listVersions ordering ───────────────────────────────────────────

describe('LRM-04 listVersions returns versions in chronological order', () => {
  let repo: IAmendmentRepository;
  beforeEach(async () => {
    repo = new MemoryAmendmentRepository();
    await repo.saveVersion(V2); // '2024-07-01'
    await repo.saveVersion(V1); // '2024-01-01'
  });

  it('listVersions(BASE_DOC) returns 2 versions', async () => {
    expect(await repo.listVersions(BASE_DOC)).toHaveLength(2);
  });
  it('first version is V1 (earliest date)', async () => {
    expect((await repo.listVersions(BASE_DOC))[0]!.versionDate).toBe('2024-01-01');
  });
  it('listVersions for unknown documentId returns empty', async () => {
    expect(await repo.listVersions('nonexistent')).toHaveLength(0);
  });
});

// ─── LRM-05: baselineVersion ─────────────────────────────────────────────────

describe('LRM-05 baselineVersion creates if absent and is idempotent', () => {
  let repo: IAmendmentRepository;
  beforeEach(() => { repo = new MemoryAmendmentRepository(); });

  it('creates a baseline version if none exists', async () => {
    const v = await repo.baselineVersion(BASE_DOC, '2024-01-01');
    expect(v.isBaseline).toBe(true);
    expect(v.documentId).toBe(BASE_DOC);
  });
  it('calling twice returns the same version (idempotent)', async () => {
    const v1 = await repo.baselineVersion(BASE_DOC, '2024-01-01');
    const v2 = await repo.baselineVersion(BASE_DOC, '2024-01-01');
    expect(v1.id).toBe(v2.id);
  });
  it('baseline is persisted (visible via listVersions)', async () => {
    await repo.baselineVersion(BASE_DOC, '2024-01-01');
    const versions = await repo.listVersions(BASE_DOC);
    expect(versions.some(v => v.isBaseline)).toBe(true);
  });
});

// ─── LRM-06: saveCitation / listCitationsFrom / listCitationsTo ──────────────

describe('LRM-06 saveCitation/listCitationsFrom/listCitationsTo', () => {
  let repo: ICitationRepository;
  beforeEach(async () => {
    repo = new MemoryCitationRepository();
    await repo.saveCitation(CIT1); // citingDocId: AMEND_DOC, citedDocId: BASE_DOC
    await repo.saveCitation(CIT2); // citingDocId: 'other-doc', citedDocId: BASE_DOC
  });

  it('listCitationsFrom(AMEND_DOC) returns 1 citation', async () => {
    expect(await repo.listCitationsFrom(AMEND_DOC)).toHaveLength(1);
  });
  it('listCitationsTo(BASE_DOC) returns 2 citations', async () => {
    expect(await repo.listCitationsTo(BASE_DOC)).toHaveLength(2);
  });
  it('listCitationsFrom unknown doc returns empty', async () => {
    expect(await repo.listCitationsFrom('nonexistent')).toHaveLength(0);
  });
});

// ─── LRM-07: saveKeyword / findKeyword case-insensitive ──────────────────────

describe('LRM-07 saveKeyword/findKeyword case-insensitive term match', () => {
  let repo: IKeywordRepository;
  beforeEach(async () => {
    repo = new MemoryKeywordRepository();
    await repo.saveKeyword(KW1); // term: 'đấu thầu'
  });

  it('findKeyword("đấu thầu") finds KW1', async () => {
    expect(await repo.findKeyword('đấu thầu')).toEqual(KW1);
  });
  it('findKeyword("ĐẤU THẦU") finds KW1 (case-insensitive)', async () => {
    expect((await repo.findKeyword('ĐẤU THẦU'))!.id).toBe('kw-1');
  });
  it('findKeyword with wrong domain returns null', async () => {
    expect(await repo.findKeyword('đấu thầu', 'finance')).toBeNull();
  });
});

// ─── LRM-08: listKeywords domain filter ──────────────────────────────────────

describe('LRM-08 listKeywords filters by domain', () => {
  let repo: IKeywordRepository;
  beforeEach(async () => {
    repo = new MemoryKeywordRepository();
    await repo.saveKeyword(KW1); // domain: 'procurement'
    await repo.saveKeyword(KW2); // domain: 'procurement'
    await repo.saveKeyword(KW3); // domain: 'finance'
  });

  it('listKeywords() returns all 3', async () => {
    expect(await repo.listKeywords()).toHaveLength(3);
  });
  it('listKeywords("procurement") returns 2', async () => {
    expect(await repo.listKeywords('procurement')).toHaveLength(2);
  });
  it('listKeywords("finance") returns 1', async () => {
    expect(await repo.listKeywords('finance')).toHaveLength(1);
  });
});

// ─── LRM-09: saveDomain / findDomain / listDomains ───────────────────────────

describe('LRM-09 saveDomain/findDomain/listDomains', () => {
  let repo: IKeywordRepository;
  beforeEach(async () => {
    repo = new MemoryKeywordRepository();
    await repo.saveDomain(DOM1);
  });

  it('findDomain("procurement") returns DOM1', async () => {
    expect(await repo.findDomain('procurement')).toEqual(DOM1);
  });
  it('findDomain unknown returns null', async () => {
    expect(await repo.findDomain('unknown')).toBeNull();
  });
  it('listDomains returns 1 domain', async () => {
    expect(await repo.listDomains()).toHaveLength(1);
  });
});

// ─── LRM-10: savePeriod / resolveEffectivePeriod ─────────────────────────────

describe('LRM-10 savePeriod/resolveEffectivePeriod open-ended period', () => {
  let repo: IEffectivePeriodRepository;
  const openPeriod: EffectivePeriod = {
    id: `${BASE_DOC}:2024-01-01`, documentId: BASE_DOC,
    versionId: null, startDate: '2024-01-01',
    endDate: null, endReason: null,
  };
  beforeEach(async () => {
    repo = new MemoryEffectivePeriodRepository();
    await repo.savePeriod(openPeriod);
  });

  it('resolveEffectivePeriod returns period for date in range', async () => {
    expect(await repo.resolveEffectivePeriod(BASE_DOC, '2025-06-01')).toEqual(openPeriod);
  });
  it('resolveEffectivePeriod returns null for date before startDate', async () => {
    expect(await repo.resolveEffectivePeriod(BASE_DOC, '2023-12-31')).toBeNull();
  });
  it('resolveEffectivePeriod returns null for unknown documentId', async () => {
    expect(await repo.resolveEffectivePeriod('other', '2025-01-01')).toBeNull();
  });
});

// ─── LRM-11: closePeriod ─────────────────────────────────────────────────────

describe('LRM-11 closePeriod sets endDate on the open period', () => {
  let repo: IEffectivePeriodRepository;
  beforeEach(async () => {
    repo = new MemoryEffectivePeriodRepository();
    await repo.openPeriod(BASE_DOC, '2024-01-01', null);
  });

  it('isDocumentInForce returns true before close', async () => {
    expect(await repo.isDocumentInForce(BASE_DOC, '2025-06-01')).toBe(true);
  });
  it('isDocumentInForce on endDate returns false (exclusive)', async () => {
    await repo.closePeriod(BASE_DOC, '2026-01-01', 'SUPERSEDED');
    expect(await repo.isDocumentInForce(BASE_DOC, '2026-01-01')).toBe(false);
  });
  it('isDocumentInForce before endDate still true after close', async () => {
    await repo.closePeriod(BASE_DOC, '2026-01-01', 'SUPERSEDED');
    expect(await repo.isDocumentInForce(BASE_DOC, '2025-12-31')).toBe(true);
  });
});

// ─── LRM-12: openPeriod / isDocumentInForce ───────────────────────────────────

describe('LRM-12 openPeriod creates open-ended period', () => {
  let repo: IEffectivePeriodRepository;
  beforeEach(() => { repo = new MemoryEffectivePeriodRepository(); });

  it('openPeriod returns a period with endDate null', async () => {
    const p = await repo.openPeriod(BASE_DOC, '2024-01-01', null);
    expect(p.endDate).toBeNull();
  });
  it('isDocumentInForce is true for date >= startDate', async () => {
    await repo.openPeriod(BASE_DOC, '2024-01-01', null);
    expect(await repo.isDocumentInForce(BASE_DOC, '2024-01-01')).toBe(true);
  });
  it('isDocumentInForce is false for date < startDate', async () => {
    await repo.openPeriod(BASE_DOC, '2024-01-01', null);
    expect(await repo.isDocumentInForce(BASE_DOC, '2023-12-31')).toBe(false);
  });
});

// ─── LRM-13: Prisma repositories (Phase M1 real impl) without DATABASE_URL ───
// No DATABASE_URL is configured in this environment (Docker unavailable — see
// docs/infrastructure.md); calls surface getPrismaClient()'s guard error instead
// of the old stub-era PrismaNotReadyError, which these classes no longer throw.

describe('LRM-13 PrismaAmendmentRepository and PrismaCitationRepository throw without DATABASE_URL', () => {
  it('PrismaAmendmentRepository.saveAmendment throws', async () => {
    const repo: IAmendmentRepository = new PrismaAmendmentRepository();
    await expect(repo.saveAmendment(AMD1)).rejects.toThrow(/DATABASE_URL/);
  });
  it('PrismaAmendmentRepository.baselineVersion throws', async () => {
    const repo: IAmendmentRepository = new PrismaAmendmentRepository();
    await expect(repo.baselineVersion('doc', '2024-01-01')).rejects.toThrow(/DATABASE_URL/);
  });
  it('PrismaCitationRepository.saveCitation throws', async () => {
    const repo: ICitationRepository = new PrismaCitationRepository();
    await expect(repo.saveCitation(CIT1)).rejects.toThrow(/DATABASE_URL/);
  });
});
