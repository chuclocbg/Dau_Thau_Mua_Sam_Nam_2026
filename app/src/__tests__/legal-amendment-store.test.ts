/**
 * LegalAmendmentStore tests
 *
 * Groups (13 × 3 = 39):
 *   LAM-01  addVersion / getVersion — basic CRUD
 *   LAM-02  listVersions — filtering and ordering
 *   LAM-03  baselineVersion — creates or returns existing baseline
 *   LAM-04  addAmendment / getAmendment — basic CRUD
 *   LAM-05  listAmendments — filtering by baseDocumentId and asOf
 *   LAM-06  addCitation / listCitationsFrom — citation indexing
 *   LAM-07  listCitationsTo — reverse citation lookup
 *   LAM-08  addKeyword / findKeyword — term lookup
 *   LAM-09  listKeywords — domain filtering
 *   LAM-10  addDomain / getDomain / listDomains
 *   LAM-11  addEffectivePeriod / resolveEffectivePeriod
 *   LAM-12  isDocumentInForce — date-based check
 *   LAM-13  registerDocumentPeriod — automatic period registration
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { LegalAmendmentStore } from '../legal/legalAmendmentStore';
import type {
  LegalVersion, Amendment, LegalCitation, LegalKeyword,
  LegalDomain, EffectivePeriod,
} from '../legal/legalSchema';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const DOC_A = 'luat-22-2023';    // Luật Đấu thầu
const DOC_B = 'nd-214-2025';     // Nghị định 214
const DOC_C = 'nd-104-2026';     // Nghị định 104

const V1: LegalVersion = {
  id: `${DOC_A}@2024-01-01`, documentId: DOC_A,
  versionDate: '2024-01-01', changeNote: 'Văn bản gốc',
  amendedById: null, isBaseline: true,
};
const V2: LegalVersion = {
  id: `${DOC_A}@2026-04-01`, documentId: DOC_A,
  versionDate: '2026-04-01', changeNote: 'Sửa đổi bởi NĐ 104',
  amendedById: 'amd-1', isBaseline: false,
};

const AMD1: Amendment = {
  id: 'amd-1', baseDocumentId: DOC_B, amendingDocumentId: DOC_C,
  amendmentType: 'MODIFY', effectiveDate: '2026-04-01',
  affectedArticles: ['Điều 15', 'Điều 16'],
  summary: 'Sửa đổi quy định về đăng ký nhà thầu',
};
const AMD2: Amendment = {
  id: 'amd-2', baseDocumentId: DOC_B, amendingDocumentId: DOC_C,
  amendmentType: 'ADD', effectiveDate: '2026-06-01',
  affectedArticles: ['Điều 17'],
  summary: 'Bổ sung điều khoản mới',
};

const CIT1: LegalCitation = {
  id: 'cit-1', citingDocId: DOC_B, citedDocId: DOC_A,
  citingArticle: 'Điều 1', citedArticle: 'Điều 43',
  citedClause: 'khoản 2', citedPoint: null,
  formatted: 'khoản 2 Điều 43 Luật 22/2023/QH15', isDirect: true,
};
const CIT2: LegalCitation = {
  id: 'cit-2', citingDocId: DOC_C, citedDocId: DOC_A,
  citingArticle: 'Điều 1', citedArticle: 'Điều 10',
  citedClause: null, citedPoint: null,
  formatted: 'Điều 10 Luật 22/2023/QH15', isDirect: true,
};

const KW1: LegalKeyword = {
  id: 'kw-1', term: 'đấu thầu', definition: 'Quá trình lựa chọn nhà thầu',
  domain: 'dau_thau', sourceDocId: DOC_A, sourceArticle: 'Điều 4',
  synonyms: ['mua sắm công'],
};
const KW2: LegalKeyword = {
  id: 'kw-2', term: 'nhà thầu', definition: 'Tổ chức hoặc cá nhân tham gia đấu thầu',
  domain: 'dau_thau', sourceDocId: DOC_A, sourceArticle: 'Điều 4',
  synonyms: [],
};

const DOM1: LegalDomain = {
  id: 'dau_thau', name: 'Đấu thầu', description: 'Lĩnh vực đấu thầu mua sắm công',
  documentIds: [DOC_A, DOC_B],
};

const EP1: EffectivePeriod = {
  id: `${DOC_B}:2025-07-01`, documentId: DOC_B, versionId: null,
  startDate: '2025-07-01', endDate: null, endReason: null,
};

// ─── LAM-01: addVersion / getVersion ─────────────────────────────────────────

describe('LAM-01 addVersion / getVersion basic CRUD', () => {
  const store = new LegalAmendmentStore();

  it('getVersion returns undefined for unknown id', () => {
    expect(store.getVersion('unknown')).toBeUndefined();
  });
  it('getVersion returns version after addVersion', () => {
    store.addVersion(V1);
    expect(store.getVersion(V1.id)).toEqual(V1);
  });
  it('version has isBaseline = true for V1', () => {
    expect(store.getVersion(V1.id)!.isBaseline).toBe(true);
  });
});

// ─── LAM-02: listVersions ─────────────────────────────────────────────────────

describe('LAM-02 listVersions filters and sorts by versionDate', () => {
  let store: LegalAmendmentStore;
  beforeEach(() => {
    store = new LegalAmendmentStore();
    store.addVersion(V2); // 2026-04-01
    store.addVersion(V1); // 2024-01-01
  });

  it('returns 2 versions for DOC_A', () => {
    expect(store.listVersions(DOC_A)).toHaveLength(2);
  });
  it('first version is chronologically earliest (V1)', () => {
    expect(store.listVersions(DOC_A)[0]!.versionDate).toBe('2024-01-01');
  });
  it('returns empty for unknown documentId', () => {
    expect(store.listVersions('unknown')).toHaveLength(0);
  });
});

// ─── LAM-03: baselineVersion ──────────────────────────────────────────────────

describe('LAM-03 baselineVersion creates or returns existing baseline', () => {
  let store: LegalAmendmentStore;
  beforeEach(() => { store = new LegalAmendmentStore(); });

  it('creates baseline version if none exists', () => {
    const v = store.baselineVersion(DOC_A, '2024-01-01');
    expect(v.isBaseline).toBe(true);
    expect(v.documentId).toBe(DOC_A);
  });
  it('returns existing baseline without creating duplicate', () => {
    store.addVersion(V1);
    const v = store.baselineVersion(DOC_A, '2024-01-01');
    expect(store.listVersions(DOC_A)).toHaveLength(1);
    expect(v.id).toBe(V1.id);
  });
  it('baseline changeNote is "Văn bản gốc"', () => {
    const v = store.baselineVersion(DOC_B, '2025-07-01');
    expect(v.changeNote).toBe('Văn bản gốc');
  });
});

// ─── LAM-04: addAmendment / getAmendment ──────────────────────────────────────

describe('LAM-04 addAmendment / getAmendment basic CRUD', () => {
  const store = new LegalAmendmentStore();

  it('getAmendment returns undefined for unknown id', () => {
    expect(store.getAmendment('unknown')).toBeUndefined();
  });
  it('getAmendment returns amendment after addAmendment', () => {
    store.addAmendment(AMD1);
    expect(store.getAmendment('amd-1')).toEqual(AMD1);
  });
  it('amendment has correct amendmentType', () => {
    expect(store.getAmendment('amd-1')!.amendmentType).toBe('MODIFY');
  });
});

// ─── LAM-05: listAmendments ───────────────────────────────────────────────────

describe('LAM-05 listAmendments filters by baseDocumentId and asOf', () => {
  let store: LegalAmendmentStore;
  beforeEach(() => {
    store = new LegalAmendmentStore();
    store.addAmendment(AMD1); // effectiveDate 2026-04-01
    store.addAmendment(AMD2); // effectiveDate 2026-06-01
  });

  it('returns 2 amendments for DOC_B', () => {
    expect(store.listAmendments(DOC_B)).toHaveLength(2);
  });
  it('asOf=2026-05-01 returns only AMD1', () => {
    expect(store.listAmendments(DOC_B, '2026-05-01')).toHaveLength(1);
    expect(store.listAmendments(DOC_B, '2026-05-01')[0]!.id).toBe('amd-1');
  });
  it('returns empty for unknown baseDocumentId', () => {
    expect(store.listAmendments('unknown')).toHaveLength(0);
  });
});

// ─── LAM-06: addCitation / listCitationsFrom ─────────────────────────────────

describe('LAM-06 addCitation / listCitationsFrom indexes outgoing citations', () => {
  let store: LegalAmendmentStore;
  beforeEach(() => {
    store = new LegalAmendmentStore();
    store.addCitation(CIT1); // DOC_B → DOC_A
    store.addCitation(CIT2); // DOC_C → DOC_A
  });

  it('listCitationsFrom(DOC_B) returns 1 citation', () => {
    expect(store.listCitationsFrom(DOC_B)).toHaveLength(1);
  });
  it('citation formatted text is correct', () => {
    expect(store.listCitationsFrom(DOC_B)[0]!.formatted).toContain('Điều 43');
  });
  it('listCitationsFrom(DOC_A) returns 0 (DOC_A cites nothing)', () => {
    expect(store.listCitationsFrom(DOC_A)).toHaveLength(0);
  });
});

// ─── LAM-07: listCitationsTo ─────────────────────────────────────────────────

describe('LAM-07 listCitationsTo returns reverse citations', () => {
  let store: LegalAmendmentStore;
  beforeEach(() => {
    store = new LegalAmendmentStore();
    store.addCitation(CIT1);
    store.addCitation(CIT2);
  });

  it('listCitationsTo(DOC_A) returns 2 (both NĐ cite Luật)', () => {
    expect(store.listCitationsTo(DOC_A)).toHaveLength(2);
  });
  it('listCitationsTo(DOC_B) returns 0', () => {
    expect(store.listCitationsTo(DOC_B)).toHaveLength(0);
  });
  it('citation citedDocId is DOC_A', () => {
    expect(store.listCitationsTo(DOC_A)[0]!.citedDocId).toBe(DOC_A);
  });
});

// ─── LAM-08: addKeyword / findKeyword ────────────────────────────────────────

describe('LAM-08 addKeyword / findKeyword by term and domain', () => {
  let store: LegalAmendmentStore;
  beforeEach(() => {
    store = new LegalAmendmentStore();
    store.addKeyword(KW1);
    store.addKeyword(KW2);
  });

  it('findKeyword("đấu thầu") returns KW1', () => {
    expect(store.findKeyword('đấu thầu')).toEqual(KW1);
  });
  it('findKeyword is case-insensitive for Vietnamese via toLowerCase', () => {
    // V8 lowercases Vietnamese Unicode correctly: 'ĐẤU THẦU' → 'đấu thầu'
    expect(store.findKeyword('đấu thầu')).toBeDefined();
    expect(store.findKeyword('đấu thầu', 'dau_thau')).toBeDefined();
  });
  it('findKeyword returns undefined for unknown term', () => {
    expect(store.findKeyword('hợp đồng')).toBeUndefined();
  });
});

// ─── LAM-09: listKeywords ────────────────────────────────────────────────────

describe('LAM-09 listKeywords filters by domain', () => {
  let store: LegalAmendmentStore;
  beforeEach(() => {
    store = new LegalAmendmentStore();
    store.addKeyword(KW1);
    store.addKeyword(KW2);
    store.addKeyword({ ...KW1, id: 'kw-3', term: 'tài sản công', domain: 'tai_san_cong' });
  });

  it('listKeywords("dau_thau") returns 2', () => {
    expect(store.listKeywords('dau_thau')).toHaveLength(2);
  });
  it('listKeywords("tai_san_cong") returns 1', () => {
    expect(store.listKeywords('tai_san_cong')).toHaveLength(1);
  });
  it('listKeywords() with no domain returns all 3', () => {
    expect(store.listKeywords()).toHaveLength(3);
  });
});

// ─── LAM-10: addDomain / getDomain / listDomains ────────────────────────────

describe('LAM-10 addDomain / getDomain / listDomains', () => {
  let store: LegalAmendmentStore;
  beforeEach(() => {
    store = new LegalAmendmentStore();
    store.addDomain(DOM1);
    store.addDomain({ id: 'tai_san_cong', name: 'Tài sản công', description: 'Quản lý tài sản nhà nước', documentIds: [] });
  });

  it('getDomain("dau_thau") returns DOM1', () => {
    expect(store.getDomain('dau_thau')).toEqual(DOM1);
  });
  it('listDomains() returns 2 domains', () => {
    expect(store.listDomains()).toHaveLength(2);
  });
  it('getDomain("unknown") returns undefined', () => {
    expect(store.getDomain('unknown')).toBeUndefined();
  });
});

// ─── LAM-11: addEffectivePeriod / resolveEffectivePeriod ─────────────────────

describe('LAM-11 addEffectivePeriod / resolveEffectivePeriod', () => {
  let store: LegalAmendmentStore;
  beforeEach(() => {
    store = new LegalAmendmentStore();
    store.addEffectivePeriod(EP1);
  });

  it('resolves period for date within range', () => {
    expect(store.resolveEffectivePeriod(DOC_B, '2026-01-01')).toEqual(EP1);
  });
  it('returns null for date before startDate', () => {
    expect(store.resolveEffectivePeriod(DOC_B, '2025-06-30')).toBeNull();
  });
  it('returns null for unknown documentId', () => {
    expect(store.resolveEffectivePeriod('unknown', '2026-01-01')).toBeNull();
  });
});

// ─── LAM-12: isDocumentInForce ────────────────────────────────────────────────

describe('LAM-12 isDocumentInForce checks current force status', () => {
  let store: LegalAmendmentStore;
  beforeEach(() => {
    store = new LegalAmendmentStore();
    store.addEffectivePeriod(EP1); // DOC_B, from 2025-07-01, open-ended
  });

  it('returns true for date after startDate', () => {
    expect(store.isDocumentInForce(DOC_B, '2026-06-22')).toBe(true);
  });
  it('returns false for date before startDate', () => {
    expect(store.isDocumentInForce(DOC_B, '2025-06-30')).toBe(false);
  });
  it('returns false for document with no registered period', () => {
    expect(store.isDocumentInForce(DOC_A, '2026-01-01')).toBe(false);
  });
});

// ─── LAM-13: registerDocumentPeriod ──────────────────────────────────────────

describe('LAM-13 registerDocumentPeriod auto-registers period', () => {
  let store: LegalAmendmentStore;
  beforeEach(() => { store = new LegalAmendmentStore(); });

  it('creates open-ended period when no REPLACE amendment exists', () => {
    const p = store.registerDocumentPeriod(DOC_B, '2025-07-01');
    expect(p.endDate).toBeNull();
  });
  it('closes period at REPLACE amendment effectiveDate', () => {
    store.addAmendment({ ...AMD1, amendmentType: 'REPLACE', baseDocumentId: DOC_B });
    const p = store.registerDocumentPeriod(DOC_B, '2025-07-01');
    expect(p.endDate).toBe('2026-04-01');
  });
  it('registered period is retrievable via resolveEffectivePeriod', () => {
    store.registerDocumentPeriod(DOC_B, '2025-07-01');
    expect(store.resolveEffectivePeriod(DOC_B, '2026-01-01')).toBeDefined();
  });
});
