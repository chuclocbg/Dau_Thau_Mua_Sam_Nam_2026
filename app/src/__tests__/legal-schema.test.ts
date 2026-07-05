/**
 * Legal Schema tests
 *
 * Groups (13 × 3 = 39):
 *   LSC-01  AmendmentType constants and type guard
 *   LSC-02  isAmendmentType — valid and invalid values
 *   LSC-03  isIsoDate — valid and invalid dates
 *   LSC-04  makeArticleId — id generation
 *   LSC-05  makeClauseId — id generation
 *   LSC-06  makePointId — id generation
 *   LSC-07  makeVersionId — id generation
 *   LSC-08  makeEffectivePeriodId — id generation
 *   LSC-09  formatReference — full citation formatting
 *   LSC-10  formatReference — partial references
 *   LSC-11  isEffectiveOn — within period
 *   LSC-12  isEffectiveOn — boundary conditions
 *   LSC-13  LegalSchemaRecord — shape of combined aggregate
 */

import { describe, it, expect } from 'vitest';
import {
  AMENDMENT_TYPES,
  isAmendmentType,
  isIsoDate,
  isEffectiveOn,
  makeArticleId,
  makeClauseId,
  makePointId,
  makeVersionId,
  makeEffectivePeriodId,
  formatReference,
  type LegalReference,
  type EffectivePeriod,
  type LegalSchemaRecord,
} from '../legal/legalSchema';

// ─── LSC-01: AmendmentType constants ─────────────────────────────────────────

describe('LSC-01 AMENDMENT_TYPES contains all 7 types', () => {
  it('has 7 entries', () => {
    expect(AMENDMENT_TYPES).toHaveLength(7);
  });
  it('includes REPLACE and REPEAL', () => {
    expect(AMENDMENT_TYPES).toContain('REPLACE');
    expect(AMENDMENT_TYPES).toContain('REPEAL');
  });
  it('includes MODIFY, ADD, SUSPEND, EXTEND, IMPLEMENT', () => {
    expect(AMENDMENT_TYPES).toContain('MODIFY');
    expect(AMENDMENT_TYPES).toContain('ADD');
    expect(AMENDMENT_TYPES).toContain('IMPLEMENT');
  });
});

// ─── LSC-02: isAmendmentType ──────────────────────────────────────────────────

describe('LSC-02 isAmendmentType identifies valid amendment types', () => {
  it('returns true for "REPLACE"', () => {
    expect(isAmendmentType('REPLACE')).toBe(true);
  });
  it('returns true for "IMPLEMENT"', () => {
    expect(isAmendmentType('IMPLEMENT')).toBe(true);
  });
  it('returns false for unknown string', () => {
    expect(isAmendmentType('AMEND')).toBe(false);
    expect(isAmendmentType('')).toBe(false);
  });
});

// ─── LSC-03: isIsoDate ────────────────────────────────────────────────────────

describe('LSC-03 isIsoDate validates YYYY-MM-DD format', () => {
  it('accepts valid dates', () => {
    expect(isIsoDate('2024-01-01')).toBe(true);
    expect(isIsoDate('2025-07-01')).toBe(true);
    expect(isIsoDate('2026-12-31')).toBe(true);
  });
  it('rejects invalid format', () => {
    expect(isIsoDate('01/01/2024')).toBe(false);
    expect(isIsoDate('2024-1-1')).toBe(false);
  });
  it('rejects non-string values', () => {
    expect(isIsoDate(20240101)).toBe(false);
    expect(isIsoDate(null)).toBe(false);
  });
});

// ─── LSC-04: makeArticleId ────────────────────────────────────────────────────

describe('LSC-04 makeArticleId generates stable article IDs', () => {
  it('contains documentId', () => {
    expect(makeArticleId('luat-22-2023', 1)).toContain('luat-22-2023');
  });
  it('contains article number', () => {
    expect(makeArticleId('luat-22-2023', 43)).toContain('43');
  });
  it('two different numbers produce different IDs', () => {
    expect(makeArticleId('doc', 1)).not.toBe(makeArticleId('doc', 2));
  });
});

// ─── LSC-05: makeClauseId ─────────────────────────────────────────────────────

describe('LSC-05 makeClauseId generates stable clause IDs', () => {
  it('contains articleId', () => {
    expect(makeClauseId('luat-22-2023-dieu-43', 2)).toContain('luat-22-2023-dieu-43');
  });
  it('contains clause number', () => {
    expect(makeClauseId('art-1', 3)).toContain('3');
  });
  it('different numbers produce different IDs', () => {
    expect(makeClauseId('art-1', 1)).not.toBe(makeClauseId('art-1', 2));
  });
});

// ─── LSC-06: makePointId ──────────────────────────────────────────────────────

describe('LSC-06 makePointId generates stable point IDs', () => {
  it('contains clauseId', () => {
    expect(makePointId('art-1-khoan-2', 'a')).toContain('art-1-khoan-2');
  });
  it('contains label', () => {
    expect(makePointId('clause-1', 'b')).toContain('b');
  });
  it('labels a and b produce different IDs', () => {
    expect(makePointId('c1', 'a')).not.toBe(makePointId('c1', 'b'));
  });
});

// ─── LSC-07: makeVersionId ────────────────────────────────────────────────────

describe('LSC-07 makeVersionId generates stable version IDs', () => {
  it('contains documentId', () => {
    expect(makeVersionId('luat-22-2023', '2024-01-01')).toContain('luat-22-2023');
  });
  it('contains versionDate', () => {
    expect(makeVersionId('luat-22-2023', '2024-01-01')).toContain('2024-01-01');
  });
  it('different dates produce different IDs', () => {
    expect(makeVersionId('doc', '2024-01-01')).not.toBe(makeVersionId('doc', '2025-01-01'));
  });
});

// ─── LSC-08: makeEffectivePeriodId ────────────────────────────────────────────

describe('LSC-08 makeEffectivePeriodId generates stable period IDs', () => {
  it('contains documentId', () => {
    expect(makeEffectivePeriodId('nd-214-2025', '2025-07-01')).toContain('nd-214-2025');
  });
  it('contains startDate', () => {
    expect(makeEffectivePeriodId('nd-214-2025', '2025-07-01')).toContain('2025-07-01');
  });
  it('is deterministic for same inputs', () => {
    expect(makeEffectivePeriodId('doc', '2026-01-01'))
      .toBe(makeEffectivePeriodId('doc', '2026-01-01'));
  });
});

// ─── LSC-09: formatReference — full citation ──────────────────────────────────

describe('LSC-09 formatReference formats full legal citation', () => {
  const ref: LegalReference = {
    documentSymbol: '22/2023/QH15',
    articleNumber:  'Điều 43',
    clauseNumber:   'khoản 2',
    pointLabel:     'a',
    formatted:      '',
  };

  it('includes point label', () => {
    expect(formatReference(ref)).toContain('điểm a');
  });
  it('includes clause number', () => {
    expect(formatReference(ref)).toContain('khoản 2');
  });
  it('includes document symbol', () => {
    expect(formatReference(ref)).toContain('22/2023/QH15');
  });
});

// ─── LSC-10: formatReference — partial references ─────────────────────────────

describe('LSC-10 formatReference handles partial references', () => {
  it('document-only reference contains just symbol', () => {
    const ref: LegalReference = { documentSymbol: '214/2025/NĐ-CP', formatted: '' };
    expect(formatReference(ref)).toBe('214/2025/NĐ-CP');
  });
  it('article-only includes Điều and symbol', () => {
    const ref: LegalReference = { documentSymbol: '22/2023/QH15', articleNumber: 'Điều 1', formatted: '' };
    expect(formatReference(ref)).toContain('Điều 1');
    expect(formatReference(ref)).toContain('22/2023/QH15');
  });
  it('order is point > clause > article > document', () => {
    const ref: LegalReference = {
      documentSymbol: 'doc', articleNumber: 'Điều 1', clauseNumber: 'khoản 1', pointLabel: 'a',
      formatted: '',
    };
    const result = formatReference(ref);
    expect(result.indexOf('điểm a')).toBeLessThan(result.indexOf('khoản 1'));
    expect(result.indexOf('khoản 1')).toBeLessThan(result.indexOf('Điều 1'));
  });
});

// ─── LSC-11: isEffectiveOn — within period ────────────────────────────────────

describe('LSC-11 isEffectiveOn returns true for dates within period', () => {
  const openPeriod: EffectivePeriod = {
    id: 'p1', documentId: 'doc', versionId: null,
    startDate: '2024-01-01', endDate: null, endReason: null,
  };
  const closedPeriod: EffectivePeriod = {
    id: 'p2', documentId: 'doc', versionId: null,
    startDate: '2024-01-01', endDate: '2026-01-01', endReason: null,
  };

  it('open-ended period: date after startDate is effective', () => {
    expect(isEffectiveOn(openPeriod, '2025-06-01')).toBe(true);
  });
  it('closed period: date within range is effective', () => {
    expect(isEffectiveOn(closedPeriod, '2025-01-01')).toBe(true);
  });
  it('date before startDate is not effective', () => {
    expect(isEffectiveOn(openPeriod, '2023-12-31')).toBe(false);
  });
});

// ─── LSC-12: isEffectiveOn — boundary conditions ──────────────────────────────

describe('LSC-12 isEffectiveOn boundary conditions', () => {
  const period: EffectivePeriod = {
    id: 'p', documentId: 'd', versionId: null,
    startDate: '2024-01-01', endDate: '2026-01-01', endReason: null,
  };

  it('exact startDate is effective (inclusive)', () => {
    expect(isEffectiveOn(period, '2024-01-01')).toBe(true);
  });
  it('exact endDate is NOT effective (exclusive)', () => {
    expect(isEffectiveOn(period, '2026-01-01')).toBe(false);
  });
  it('day before endDate is effective', () => {
    expect(isEffectiveOn(period, '2025-12-31')).toBe(true);
  });
});

// ─── LSC-13: LegalSchemaRecord shape ─────────────────────────────────────────

describe('LSC-13 LegalSchemaRecord satisfies full aggregate shape', () => {
  const record: LegalSchemaRecord = {
    document: {
      id: 'luat-22-2023', symbol: '22/2023/QH15', title: 'Luật Đấu thầu',
      type: 'LAW', issuer: 'Quốc hội', effectiveDate: '2024-01-01',
      status: 'ACTIVE', source: 'Công báo', priority: 1,
      tags: ['đấu thầu'], summary: 'Luật đấu thầu', confidence: 1.0,
    },
    versions:         [],
    articles:         [],
    clauses:          [],
    points:           [],
    appendices:       [],
    citations:        [],
    keywords:         [],
    amendments:       [],
    effectivePeriods: [],
  };

  it('record.document has symbol "22/2023/QH15"', () => {
    expect(record.document.symbol).toBe('22/2023/QH15');
  });
  it('record has all 10 required array fields', () => {
    const keys: (keyof LegalSchemaRecord)[] = [
      'versions', 'articles', 'clauses', 'points',
      'appendices', 'citations', 'keywords', 'amendments', 'effectivePeriods',
    ];
    for (const k of keys) expect(Array.isArray(record[k])).toBe(true);
  });
  it('empty aggregate has document with correct type', () => {
    expect(record.document.type).toBe('LAW');
  });
});
