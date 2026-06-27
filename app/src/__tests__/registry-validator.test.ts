/**
 * Phase 11.2.3 — Registry Validator tests
 *
 * Groups (13 × 3 = 39):
 *   LRV-01  (3)  valid registry → ok:true, no errors, no warnings
 *   LRV-02  (3)  MISSING_SOURCE error
 *   LRV-03  (3)  DUPLICATE_SYMBOL error
 *   LRV-04  (3)  INVALID_PERIOD error
 *   LRV-05  (3)  BROKEN_SUPERSEDED_BY error
 *   LRV-06  (3)  BROKEN_REPLACES error
 *   LRV-07  (3)  CYCLIC_SUPERSESSION error
 *   LRV-08  (3)  LOW_CONFIDENCE warning
 *   LRV-09  (3)  NO_TAGS warning
 *   LRV-10  (3)  NO_SUMMARY warning
 *   LRV-11  (3)  MISSING_EXPIRY_ON_SUPERSEDED warning
 *   LRV-12  (3)  stats computation by status
 *   LRV-13  (3)  ok:false when any error is present
 */

import { describe, it, expect } from 'vitest';
import { validateRegistry } from '../legal/registryValidator';
import { createRegistry } from '../legal/legalRegistry';
import type { LegalDocument } from '../legal/legalRegistry';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const LAW: LegalDocument = {
  id:            'luat-dau-thau-22-2023',
  symbol:        '22/2023/QH15',
  title:         'Luật Đấu thầu số 22/2023/QH15',
  type:          'LAW',
  issuer:        'Quốc hội',
  effectiveDate: '2024-01-01',
  status:        'ACTIVE',
  source:        'Công báo số 01/2024',
  priority:      1,
  tags:          ['đấu thầu', 'mua sắm'],
  summary:       'Luật quy định về hoạt động đấu thầu',
  confidence:    1.0,
};

const DECREE_NEW: LegalDocument = {
  id:            'nd-214-2025',
  symbol:        '214/2025/NĐ-CP',
  title:         'Nghị định 214/2025/NĐ-CP',
  type:          'DECREE',
  issuer:        'Chính phủ',
  effectiveDate: '2025-07-01',
  status:        'ACTIVE',
  replaces:      ['nd-24-2024'],
  source:        'Công báo số 500/2025',
  priority:      1,
  tags:          ['đấu thầu'],
  summary:       'Nghị định hướng dẫn chi tiết Luật Đấu thầu',
  confidence:    0.95,
};

const DECREE_OLD: LegalDocument = {
  id:            'nd-24-2024',
  symbol:        '24/2024/NĐ-CP',
  title:         'Nghị định 24/2024/NĐ-CP',
  type:          'DECREE',
  issuer:        'Chính phủ',
  effectiveDate: '2024-03-15',
  expiredDate:   '2025-06-30',
  status:        'SUPERSEDED',
  supersededBy:  'nd-214-2025',
  source:        'Công báo số 100/2024',
  priority:      1,
  tags:          ['đấu thầu'],
  summary:       'Nghị định đã bị thay thế',
  confidence:    0.9,
};

const VALID_REGISTRY = createRegistry([LAW, DECREE_NEW, DECREE_OLD]);

// ── LRV-01 valid registry ─────────────────────────────────────────────────────

describe('LRV-01 valid registry', () => {
  it('LRV-01-01 returns ok:true for a fully valid registry', () => {
    expect(validateRegistry(VALID_REGISTRY).ok).toBe(true);
  });

  it('LRV-01-02 no errors for a fully valid registry', () => {
    expect(validateRegistry(VALID_REGISTRY).errors).toHaveLength(0);
  });

  it('LRV-01-03 no warnings for a high-quality registry', () => {
    expect(validateRegistry(VALID_REGISTRY).warnings).toHaveLength(0);
  });
});

// ── LRV-02 MISSING_SOURCE error ───────────────────────────────────────────────

describe('LRV-02 MISSING_SOURCE error', () => {
  it('LRV-02-01 returns ok:false when source is empty', () => {
    const doc: LegalDocument = { ...LAW, id: 'bad', symbol: 'BAD', source: '' };
    expect(validateRegistry(createRegistry([doc])).ok).toBe(false);
  });

  it('LRV-02-02 error code is MISSING_SOURCE', () => {
    const doc: LegalDocument = { ...LAW, id: 'bad', symbol: 'BAD', source: '   ' };
    const report = validateRegistry(createRegistry([doc]));
    expect(report.errors.some(e => e.code === 'MISSING_SOURCE')).toBe(true);
  });

  it('LRV-02-03 MISSING_SOURCE error identifies the document', () => {
    const doc: LegalDocument = { ...LAW, id: 'bad-doc', symbol: 'BAD', source: '' };
    const report = validateRegistry(createRegistry([doc]));
    const err = report.errors.find(e => e.code === 'MISSING_SOURCE')!;
    expect(err.documentId).toBe('bad-doc');
  });
});

// ── LRV-03 DUPLICATE_SYMBOL error ────────────────────────────────────────────

describe('LRV-03 DUPLICATE_SYMBOL error', () => {
  it('LRV-03-01 returns ok:false when two documents share the same symbol', () => {
    const a: LegalDocument = { ...LAW, id: 'doc-a', symbol: 'SHARED/SYM' };
    const b: LegalDocument = { ...DECREE_NEW, id: 'doc-b', symbol: 'SHARED/SYM', replaces: undefined };
    expect(validateRegistry(createRegistry([a, b])).ok).toBe(false);
  });

  it('LRV-03-02 error code is DUPLICATE_SYMBOL', () => {
    const a: LegalDocument = { ...LAW, id: 'doc-a', symbol: 'SHARED/SYM' };
    const b: LegalDocument = { ...DECREE_NEW, id: 'doc-b', symbol: 'SHARED/SYM', replaces: undefined };
    const report = validateRegistry(createRegistry([a, b]));
    expect(report.errors.some(e => e.code === 'DUPLICATE_SYMBOL')).toBe(true);
  });

  it('LRV-03-03 DUPLICATE_SYMBOL error message contains the shared symbol', () => {
    const a: LegalDocument = { ...LAW, id: 'doc-a', symbol: 'SHARED/SYM' };
    const b: LegalDocument = { ...DECREE_NEW, id: 'doc-b', symbol: 'SHARED/SYM', replaces: undefined };
    const report = validateRegistry(createRegistry([a, b]));
    const err = report.errors.find(e => e.code === 'DUPLICATE_SYMBOL')!;
    expect(err.message).toContain('SHARED/SYM');
  });
});

// ── LRV-04 INVALID_PERIOD error ───────────────────────────────────────────────

describe('LRV-04 INVALID_PERIOD error', () => {
  it('LRV-04-01 returns ok:false when expiredDate < effectiveDate', () => {
    const doc: LegalDocument = {
      ...LAW, id: 'bad', symbol: 'BAD',
      effectiveDate: '2024-06-01',
      expiredDate:   '2024-01-01',
    };
    expect(validateRegistry(createRegistry([doc])).ok).toBe(false);
  });

  it('LRV-04-02 error code is INVALID_PERIOD', () => {
    const doc: LegalDocument = {
      ...LAW, id: 'bad', symbol: 'BAD',
      effectiveDate: '2025-01-01',
      expiredDate:   '2024-12-31',
    };
    const report = validateRegistry(createRegistry([doc]));
    expect(report.errors.some(e => e.code === 'INVALID_PERIOD')).toBe(true);
  });

  it('LRV-04-03 equal effectiveDate and expiredDate does not trigger INVALID_PERIOD', () => {
    const doc: LegalDocument = { ...LAW, id: 'ok', symbol: 'OK', expiredDate: '2024-01-01' };
    const report = validateRegistry(createRegistry([doc]));
    expect(report.errors.some(e => e.code === 'INVALID_PERIOD')).toBe(false);
  });
});

// ── LRV-05 BROKEN_SUPERSEDED_BY error ────────────────────────────────────────

describe('LRV-05 BROKEN_SUPERSEDED_BY error', () => {
  it('LRV-05-01 returns ok:false when supersededBy references unknown id', () => {
    const doc: LegalDocument = { ...LAW, id: 'bad', symbol: 'BAD', supersededBy: 'ghost' };
    expect(validateRegistry(createRegistry([doc])).ok).toBe(false);
  });

  it('LRV-05-02 error code is BROKEN_SUPERSEDED_BY', () => {
    const doc: LegalDocument = { ...LAW, id: 'bad', symbol: 'BAD', supersededBy: 'ghost' };
    const report = validateRegistry(createRegistry([doc]));
    expect(report.errors.some(e => e.code === 'BROKEN_SUPERSEDED_BY')).toBe(true);
  });

  it('LRV-05-03 error identifies the referencing document', () => {
    const doc: LegalDocument = { ...LAW, id: 'bad-doc', symbol: 'BAD', supersededBy: 'ghost' };
    const report = validateRegistry(createRegistry([doc]));
    const err = report.errors.find(e => e.code === 'BROKEN_SUPERSEDED_BY')!;
    expect(err.documentId).toBe('bad-doc');
  });
});

// ── LRV-06 BROKEN_REPLACES error ─────────────────────────────────────────────

describe('LRV-06 BROKEN_REPLACES error', () => {
  it('LRV-06-01 returns ok:false when replaces contains unknown id', () => {
    const doc: LegalDocument = { ...DECREE_NEW, replaces: ['ghost-id'] };
    expect(validateRegistry(createRegistry([doc])).ok).toBe(false);
  });

  it('LRV-06-02 error code is BROKEN_REPLACES', () => {
    const doc: LegalDocument = { ...DECREE_NEW, replaces: ['ghost-id'] };
    const report = validateRegistry(createRegistry([doc]));
    expect(report.errors.some(e => e.code === 'BROKEN_REPLACES')).toBe(true);
  });

  it('LRV-06-03 BROKEN_REPLACES message contains the unknown id', () => {
    const doc: LegalDocument = { ...DECREE_NEW, replaces: ['ghost-id'] };
    const report = validateRegistry(createRegistry([doc]));
    const err = report.errors.find(e => e.code === 'BROKEN_REPLACES')!;
    expect(err.message).toContain('ghost-id');
  });
});

// ── LRV-07 CYCLIC_SUPERSESSION error ─────────────────────────────────────────

describe('LRV-07 CYCLIC_SUPERSESSION error', () => {
  it('LRV-07-01 returns ok:false for a two-document supersession cycle', () => {
    const a: LegalDocument = { ...LAW,       id: 'doc-a', symbol: 'A/2024', supersededBy: 'doc-b' };
    const b: LegalDocument = { ...DECREE_NEW, id: 'doc-b', symbol: 'B/2024', supersededBy: 'doc-a', replaces: undefined };
    expect(validateRegistry(createRegistry([a, b])).ok).toBe(false);
  });

  it('LRV-07-02 error code is CYCLIC_SUPERSESSION', () => {
    const a: LegalDocument = { ...LAW,       id: 'doc-a', symbol: 'A/2024', supersededBy: 'doc-b' };
    const b: LegalDocument = { ...DECREE_NEW, id: 'doc-b', symbol: 'B/2024', supersededBy: 'doc-a', replaces: undefined };
    const report = validateRegistry(createRegistry([a, b]));
    expect(report.errors.some(e => e.code === 'CYCLIC_SUPERSESSION')).toBe(true);
  });

  it('LRV-07-03 a linear chain does not trigger CYCLIC_SUPERSESSION', () => {
    const report = validateRegistry(VALID_REGISTRY);
    expect(report.errors.some(e => e.code === 'CYCLIC_SUPERSESSION')).toBe(false);
  });
});

// ── LRV-08 LOW_CONFIDENCE warning ─────────────────────────────────────────────

describe('LRV-08 LOW_CONFIDENCE warning', () => {
  it('LRV-08-01 emits LOW_CONFIDENCE when confidence < 0.5', () => {
    const doc: LegalDocument = { ...LAW, id: 'low', symbol: 'LOW', confidence: 0.3 };
    const report = validateRegistry(createRegistry([doc]));
    expect(report.warnings.some(w => w.code === 'LOW_CONFIDENCE')).toBe(true);
  });

  it('LRV-08-02 confidence == 0.5 does not trigger LOW_CONFIDENCE', () => {
    const doc: LegalDocument = { ...LAW, id: 'mid', symbol: 'MID', confidence: 0.5 };
    const report = validateRegistry(createRegistry([doc]));
    expect(report.warnings.some(w => w.code === 'LOW_CONFIDENCE')).toBe(false);
  });

  it('LRV-08-03 LOW_CONFIDENCE warning identifies the document', () => {
    const doc: LegalDocument = { ...LAW, id: 'low-doc', symbol: 'LOW', confidence: 0.1 };
    const report = validateRegistry(createRegistry([doc]));
    const w = report.warnings.find(x => x.code === 'LOW_CONFIDENCE')!;
    expect(w.documentId).toBe('low-doc');
  });
});

// ── LRV-09 NO_TAGS warning ────────────────────────────────────────────────────

describe('LRV-09 NO_TAGS warning', () => {
  it('LRV-09-01 emits NO_TAGS when document has empty tags array', () => {
    const doc: LegalDocument = { ...LAW, id: 'no-tags', symbol: 'NT', tags: [] };
    const report = validateRegistry(createRegistry([doc]));
    expect(report.warnings.some(w => w.code === 'NO_TAGS')).toBe(true);
  });

  it('LRV-09-02 does not emit NO_TAGS when document has at least one tag', () => {
    const report = validateRegistry(VALID_REGISTRY);
    expect(report.warnings.some(w => w.code === 'NO_TAGS')).toBe(false);
  });

  it('LRV-09-03 NO_TAGS warning identifies the document', () => {
    const doc: LegalDocument = { ...LAW, id: 'no-tags-doc', symbol: 'NT', tags: [] };
    const report = validateRegistry(createRegistry([doc]));
    const w = report.warnings.find(x => x.code === 'NO_TAGS')!;
    expect(w.documentId).toBe('no-tags-doc');
  });
});

// ── LRV-10 NO_SUMMARY warning ─────────────────────────────────────────────────

describe('LRV-10 NO_SUMMARY warning', () => {
  it('LRV-10-01 emits NO_SUMMARY when summary is empty string', () => {
    const doc: LegalDocument = { ...LAW, id: 'no-sum', symbol: 'NS', summary: '' };
    const report = validateRegistry(createRegistry([doc]));
    expect(report.warnings.some(w => w.code === 'NO_SUMMARY')).toBe(true);
  });

  it('LRV-10-02 emits NO_SUMMARY when summary is whitespace-only', () => {
    const doc: LegalDocument = { ...LAW, id: 'no-sum', symbol: 'NS', summary: '   ' };
    const report = validateRegistry(createRegistry([doc]));
    expect(report.warnings.some(w => w.code === 'NO_SUMMARY')).toBe(true);
  });

  it('LRV-10-03 does not emit NO_SUMMARY when summary is present', () => {
    const report = validateRegistry(VALID_REGISTRY);
    expect(report.warnings.some(w => w.code === 'NO_SUMMARY')).toBe(false);
  });
});

// ── LRV-11 MISSING_EXPIRY_ON_SUPERSEDED warning ───────────────────────────────

describe('LRV-11 MISSING_EXPIRY_ON_SUPERSEDED warning', () => {
  it('LRV-11-01 emits warning when SUPERSEDED doc has no expiredDate', () => {
    const doc: LegalDocument = {
      ...LAW, id: 'sup', symbol: 'SUP',
      status: 'SUPERSEDED',
      supersededBy: 'luat-dau-thau-22-2023',
    };
    const parent = { ...LAW };
    const report = validateRegistry(createRegistry([parent, doc]));
    expect(report.warnings.some(w => w.code === 'MISSING_EXPIRY_ON_SUPERSEDED')).toBe(true);
  });

  it('LRV-11-02 does not emit warning when SUPERSEDED doc has expiredDate', () => {
    const report = validateRegistry(VALID_REGISTRY);
    expect(report.warnings.some(w => w.code === 'MISSING_EXPIRY_ON_SUPERSEDED')).toBe(false);
  });

  it('LRV-11-03 warning identifies the document', () => {
    const doc: LegalDocument = {
      ...LAW, id: 'sup-no-exp', symbol: 'SNE',
      status: 'SUPERSEDED',
      supersededBy: 'luat-dau-thau-22-2023',
    };
    const parent = { ...LAW };
    const report = validateRegistry(createRegistry([parent, doc]));
    const w = report.warnings.find(x => x.code === 'MISSING_EXPIRY_ON_SUPERSEDED')!;
    expect(w.documentId).toBe('sup-no-exp');
  });
});

// ── LRV-12 stats computation by status ────────────────────────────────────────

describe('LRV-12 stats computation by status', () => {
  it('LRV-12-01 stats.total equals number of documents', () => {
    expect(validateRegistry(VALID_REGISTRY).stats.total).toBe(3);
  });

  it('LRV-12-02 stats.active counts ACTIVE documents correctly', () => {
    expect(validateRegistry(VALID_REGISTRY).stats.active).toBe(2);
    expect(validateRegistry(VALID_REGISTRY).stats.superseded).toBe(1);
  });

  it('LRV-12-03 stats counts draft and repealed documents', () => {
    const draft: LegalDocument  = { ...LAW, id: 'dr', symbol: 'DR', status: 'DRAFT' };
    const rep: LegalDocument    = { ...LAW, id: 'rp', symbol: 'RP', status: 'REPEALED' };
    const expired: LegalDocument = { ...LAW, id: 'ex', symbol: 'EX', status: 'EXPIRED' };
    const reg = createRegistry([LAW, draft, rep, expired]);
    const stats = validateRegistry(reg).stats;
    expect(stats.active).toBe(1);
    expect(stats.draft).toBe(1);
    expect(stats.repealed).toBe(1);
    expect(stats.expired).toBe(1);
    expect(stats.total).toBe(4);
  });
});

// ── LRV-13 ok:false when any error is present ─────────────────────────────────

describe('LRV-13 ok:false when any error is present', () => {
  it('LRV-13-01 ok:false when at least one error is present', () => {
    const bad: LegalDocument = { ...LAW, id: 'bad', symbol: 'BAD', source: '' };
    const report = validateRegistry(createRegistry([bad]));
    expect(report.ok).toBe(false);
  });

  it('LRV-13-02 warnings alone do not set ok:false', () => {
    const doc: LegalDocument = { ...LAW, id: 'low', symbol: 'LOW', confidence: 0.1 };
    const report = validateRegistry(createRegistry([doc]));
    expect(report.warnings.length).toBeGreaterThan(0);
    expect(report.ok).toBe(true);
  });

  it('LRV-13-03 empty registry returns ok:true with no errors or warnings', () => {
    const report = validateRegistry(createRegistry([]));
    expect(report.ok).toBe(true);
    expect(report.errors).toHaveLength(0);
    expect(report.warnings).toHaveLength(0);
  });
});
