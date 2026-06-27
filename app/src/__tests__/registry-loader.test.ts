/**
 * Phase 11.2.2 — Registry Loader tests
 *
 * Groups (13 × 3 = 39):
 *   LRL-01  (3)  valid single document → ok:true
 *   LRL-02  (3)  valid multiple documents → ok:true, correct count
 *   LRL-03  (3)  empty array → ok:true, empty registry
 *   LRL-04  (3)  non-array input → ok:false, NOT_AN_ARRAY
 *   LRL-05  (3)  duplicate id → ok:false, DUPLICATE_ID
 *   LRL-06  (3)  duplicate symbol → ok:false, DUPLICATE_SYMBOL
 *   LRL-07  (3)  invalid date format → ok:false, INVALID_DATE_FORMAT
 *   LRL-08  (3)  invalid effective period → ok:false, INVALID_EFFECTIVE_PERIOD
 *   LRL-09  (3)  missing required fields → ok:false, MISSING_REQUIRED_FIELD
 *   LRL-10  (3)  cyclic supersession chain → ok:false, CYCLIC_SUPERSESSION
 *   LRL-11  (3)  broken supersededBy reference → ok:false, BROKEN_REFERENCE
 *   LRL-12  (3)  broken replaces reference → ok:false, BROKEN_REFERENCE
 *   LRL-13  (3)  invalid confidence → ok:false, INVALID_CONFIDENCE
 */

import { describe, it, expect } from 'vitest';
import { loadRegistry } from '../legal/registryLoader';

// ─── Minimal valid document fixture ───────────────────────────────────────────

const BASE = {
  id:            'luat-dau-thau-22-2023',
  symbol:        '22/2023/QH15',
  title:         'Luật Đấu thầu số 22/2023/QH15',
  type:          'LAW',
  issuer:        'Quốc hội',
  effectiveDate: '2024-01-01',
  status:        'ACTIVE',
  source:        'Công báo số 01/2024',
  priority:      1,
  tags:          ['đấu thầu'],
  summary:       'Luật đấu thầu',
  confidence:    1.0,
};

const DECREE = {
  id:            'nd-214-2025',
  symbol:        '214/2025/NĐ-CP',
  title:         'Nghị định 214/2025/NĐ-CP',
  type:          'DECREE',
  issuer:        'Chính phủ',
  effectiveDate: '2025-07-01',
  status:        'ACTIVE',
  source:        'Công báo số 500/2025',
  priority:      1,
  tags:          ['đấu thầu', 'nghị định'],
  summary:       'Nghị định hướng dẫn',
  confidence:    0.9,
};

const OLD_DECREE = {
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
  summary:       'Nghị định đã thay thế',
  confidence:    0.9,
};

// ── LRL-01 valid single document ──────────────────────────────────────────────

describe('LRL-01 valid single document', () => {
  it('LRL-01-01 returns ok:true for a minimal valid document', () => {
    const result = loadRegistry([BASE]);
    expect(result.ok).toBe(true);
  });

  it('LRL-01-02 returned registry contains the document by id', () => {
    const result = loadRegistry([BASE]);
    if (!result.ok) throw new Error('Expected ok:true');
    expect(result.registry.index['luat-dau-thau-22-2023']).toBeDefined();
    expect(result.registry.index['luat-dau-thau-22-2023']!.title).toBe(BASE.title);
  });

  it('LRL-01-03 returned registry has metadata.documentCount of 1', () => {
    const result = loadRegistry([BASE]);
    if (!result.ok) throw new Error('Expected ok:true');
    expect(result.registry.metadata.documentCount).toBe(1);
  });
});

// ── LRL-02 valid multiple documents ───────────────────────────────────────────

describe('LRL-02 valid multiple documents', () => {
  it('LRL-02-01 returns ok:true for a valid supersession chain', () => {
    const result = loadRegistry([BASE, DECREE, OLD_DECREE]);
    expect(result.ok).toBe(true);
  });

  it('LRL-02-02 all three documents are indexed', () => {
    const result = loadRegistry([BASE, DECREE, OLD_DECREE]);
    if (!result.ok) throw new Error('Expected ok:true');
    expect(Object.keys(result.registry.index)).toHaveLength(3);
  });

  it('LRL-02-03 symbolIndex contains all three symbols', () => {
    const result = loadRegistry([BASE, DECREE, OLD_DECREE]);
    if (!result.ok) throw new Error('Expected ok:true');
    expect(result.registry.symbolIndex['22/2023/QH15']).toBeDefined();
    expect(result.registry.symbolIndex['214/2025/NĐ-CP']).toBeDefined();
    expect(result.registry.symbolIndex['24/2024/NĐ-CP']).toBeDefined();
  });
});

// ── LRL-03 empty array ─────────────────────────────────────────────────────────

describe('LRL-03 empty array', () => {
  it('LRL-03-01 returns ok:true for empty input', () => {
    expect(loadRegistry([]).ok).toBe(true);
  });

  it('LRL-03-02 registry has zero documentCount', () => {
    const result = loadRegistry([]);
    if (!result.ok) throw new Error('Expected ok:true');
    expect(result.registry.metadata.documentCount).toBe(0);
  });

  it('LRL-03-03 registry.documents is an empty array', () => {
    const result = loadRegistry([]);
    if (!result.ok) throw new Error('Expected ok:true');
    expect(result.registry.documents).toHaveLength(0);
  });
});

// ── LRL-04 non-array input ────────────────────────────────────────────────────

describe('LRL-04 non-array input', () => {
  it('LRL-04-01 returns ok:false for object input', () => {
    expect(loadRegistry({}).ok).toBe(false);
  });

  it('LRL-04-02 error code is NOT_AN_ARRAY for null', () => {
    const result = loadRegistry(null);
    if (result.ok) throw new Error('Expected ok:false');
    expect(result.errors[0]!.code).toBe('NOT_AN_ARRAY');
  });

  it('LRL-04-03 error code is NOT_AN_ARRAY for string input', () => {
    const result = loadRegistry('documents');
    if (result.ok) throw new Error('Expected ok:false');
    expect(result.errors[0]!.code).toBe('NOT_AN_ARRAY');
  });
});

// ── LRL-05 duplicate id ───────────────────────────────────────────────────────

describe('LRL-05 duplicate id', () => {
  it('LRL-05-01 returns ok:false when two documents share the same id', () => {
    const dup = { ...DECREE, id: BASE.id };
    expect(loadRegistry([BASE, dup]).ok).toBe(false);
  });

  it('LRL-05-02 error code is DUPLICATE_ID', () => {
    const dup = { ...DECREE, id: BASE.id };
    const result = loadRegistry([BASE, dup]);
    if (result.ok) throw new Error('Expected ok:false');
    expect(result.errors.some(e => e.code === 'DUPLICATE_ID')).toBe(true);
  });

  it('LRL-05-03 DUPLICATE_ID error names the conflicting documentId', () => {
    const dup = { ...DECREE, id: BASE.id };
    const result = loadRegistry([BASE, dup]);
    if (result.ok) throw new Error('Expected ok:false');
    const err = result.errors.find(e => e.code === 'DUPLICATE_ID')!;
    expect(err.documentId).toBe(BASE.id);
  });
});

// ── LRL-06 duplicate symbol ───────────────────────────────────────────────────

describe('LRL-06 duplicate symbol', () => {
  it('LRL-06-01 returns ok:false when two documents share the same symbol', () => {
    const dup = { ...DECREE, symbol: BASE.symbol };
    expect(loadRegistry([BASE, dup]).ok).toBe(false);
  });

  it('LRL-06-02 error code is DUPLICATE_SYMBOL', () => {
    const dup = { ...DECREE, symbol: BASE.symbol };
    const result = loadRegistry([BASE, dup]);
    if (result.ok) throw new Error('Expected ok:false');
    expect(result.errors.some(e => e.code === 'DUPLICATE_SYMBOL')).toBe(true);
  });

  it('LRL-06-03 error field is "symbol"', () => {
    const dup = { ...DECREE, symbol: BASE.symbol };
    const result = loadRegistry([BASE, dup]);
    if (result.ok) throw new Error('Expected ok:false');
    const err = result.errors.find(e => e.code === 'DUPLICATE_SYMBOL')!;
    expect(err.field).toBe('symbol');
  });
});

// ── LRL-07 invalid date format ────────────────────────────────────────────────

describe('LRL-07 invalid date format', () => {
  it('LRL-07-01 returns ok:false when effectiveDate is not YYYY-MM-DD', () => {
    const bad = { ...BASE, effectiveDate: '01/01/2024' };
    expect(loadRegistry([bad]).ok).toBe(false);
  });

  it('LRL-07-02 error code is INVALID_DATE_FORMAT', () => {
    const bad = { ...BASE, effectiveDate: '2024-1-1' };
    const result = loadRegistry([bad]);
    if (result.ok) throw new Error('Expected ok:false');
    expect(result.errors.some(e => e.code === 'INVALID_DATE_FORMAT')).toBe(true);
  });

  it('LRL-07-03 INVALID_DATE_FORMAT is also raised for bad expiredDate', () => {
    const bad = { ...BASE, expiredDate: 'not-a-date' };
    const result = loadRegistry([bad]);
    if (result.ok) throw new Error('Expected ok:false');
    const err = result.errors.find(e => e.code === 'INVALID_DATE_FORMAT')!;
    expect(err.field).toBe('expiredDate');
  });
});

// ── LRL-08 invalid effective period ───────────────────────────────────────────

describe('LRL-08 invalid effective period', () => {
  it('LRL-08-01 returns ok:false when expiredDate < effectiveDate', () => {
    const bad = { ...BASE, expiredDate: '2023-12-31' };
    expect(loadRegistry([bad]).ok).toBe(false);
  });

  it('LRL-08-02 error code is INVALID_EFFECTIVE_PERIOD', () => {
    const bad = { ...BASE, expiredDate: '2023-12-31' };
    const result = loadRegistry([bad]);
    if (result.ok) throw new Error('Expected ok:false');
    expect(result.errors.some(e => e.code === 'INVALID_EFFECTIVE_PERIOD')).toBe(true);
  });

  it('LRL-08-03 equal effectiveDate and expiredDate is valid (same-day)', () => {
    const ok = { ...BASE, expiredDate: BASE.effectiveDate };
    expect(loadRegistry([ok]).ok).toBe(true);
  });
});

// ── LRL-09 missing required fields ────────────────────────────────────────────

describe('LRL-09 missing required fields', () => {
  it('LRL-09-01 returns ok:false when id is missing', () => {
    const { id: _id, ...noId } = BASE;
    expect(loadRegistry([noId]).ok).toBe(false);
  });

  it('LRL-09-02 error code is MISSING_REQUIRED_FIELD when title is absent', () => {
    const { title: _t, ...noTitle } = BASE;
    const result = loadRegistry([noTitle]);
    if (result.ok) throw new Error('Expected ok:false');
    expect(result.errors.some(e => e.code === 'MISSING_REQUIRED_FIELD' && e.field === 'title')).toBe(true);
  });

  it('LRL-09-03 MISSING_SOURCE is raised when source is an empty string', () => {
    const bad = { ...BASE, source: '' };
    const result = loadRegistry([bad]);
    if (result.ok) throw new Error('Expected ok:false');
    expect(result.errors.some(e => e.code === 'MISSING_SOURCE')).toBe(true);
  });
});

// ── LRL-10 cyclic supersession chain ──────────────────────────────────────────

describe('LRL-10 cyclic supersession chain', () => {
  it('LRL-10-01 returns ok:false when A supersedes B and B supersedes A', () => {
    const a = { ...BASE,   id: 'doc-a', symbol: 'A/2024', supersededBy: 'doc-b' };
    const b = { ...DECREE, id: 'doc-b', symbol: 'B/2024', supersededBy: 'doc-a' };
    expect(loadRegistry([a, b]).ok).toBe(false);
  });

  it('LRL-10-02 error code is CYCLIC_SUPERSESSION', () => {
    const a = { ...BASE,   id: 'doc-a', symbol: 'A/2024', supersededBy: 'doc-b' };
    const b = { ...DECREE, id: 'doc-b', symbol: 'B/2024', supersededBy: 'doc-a' };
    const result = loadRegistry([a, b]);
    if (result.ok) throw new Error('Expected ok:false');
    expect(result.errors.some(e => e.code === 'CYCLIC_SUPERSESSION')).toBe(true);
  });

  it('LRL-10-03 a three-node cycle is also detected', () => {
    const a = { ...BASE,   id: 'doc-a', symbol: 'A/2024', supersededBy: 'doc-c' };
    const b = { ...DECREE, id: 'doc-b', symbol: 'B/2024', supersededBy: 'doc-a' };
    const c = { ...DECREE, id: 'doc-c', symbol: 'C/2024', supersededBy: 'doc-b' };
    const result = loadRegistry([a, b, c]);
    if (result.ok) throw new Error('Expected ok:false');
    expect(result.errors.some(e => e.code === 'CYCLIC_SUPERSESSION')).toBe(true);
  });
});

// ── LRL-11 broken supersededBy reference ──────────────────────────────────────

describe('LRL-11 broken supersededBy reference', () => {
  it('LRL-11-01 returns ok:false when supersededBy references unknown id', () => {
    const bad = { ...BASE, supersededBy: 'does-not-exist' };
    expect(loadRegistry([bad]).ok).toBe(false);
  });

  it('LRL-11-02 error code is BROKEN_REFERENCE', () => {
    const bad = { ...BASE, supersededBy: 'does-not-exist' };
    const result = loadRegistry([bad]);
    if (result.ok) throw new Error('Expected ok:false');
    expect(result.errors.some(e => e.code === 'BROKEN_REFERENCE')).toBe(true);
  });

  it('LRL-11-03 error field is "supersededBy"', () => {
    const bad = { ...BASE, supersededBy: 'does-not-exist' };
    const result = loadRegistry([bad]);
    if (result.ok) throw new Error('Expected ok:false');
    const err = result.errors.find(e => e.code === 'BROKEN_REFERENCE')!;
    expect(err.field).toBe('supersededBy');
  });
});

// ── LRL-12 broken replaces reference ──────────────────────────────────────────

describe('LRL-12 broken replaces reference', () => {
  it('LRL-12-01 returns ok:false when replaces contains unknown id', () => {
    const bad = { ...BASE, replaces: ['ghost-doc'] };
    expect(loadRegistry([bad]).ok).toBe(false);
  });

  it('LRL-12-02 error code is BROKEN_REFERENCE', () => {
    const bad = { ...BASE, replaces: ['ghost-doc'] };
    const result = loadRegistry([bad]);
    if (result.ok) throw new Error('Expected ok:false');
    expect(result.errors.some(e => e.code === 'BROKEN_REFERENCE')).toBe(true);
  });

  it('LRL-12-03 error field is "replaces"', () => {
    const bad = { ...BASE, replaces: ['ghost-doc'] };
    const result = loadRegistry([bad]);
    if (result.ok) throw new Error('Expected ok:false');
    const err = result.errors.find(e => e.code === 'BROKEN_REFERENCE')!;
    expect(err.field).toBe('replaces');
  });
});

// ── LRL-13 invalid confidence ─────────────────────────────────────────────────

describe('LRL-13 invalid confidence', () => {
  it('LRL-13-01 returns ok:false when confidence is greater than 1', () => {
    const bad = { ...BASE, confidence: 1.5 };
    expect(loadRegistry([bad]).ok).toBe(false);
  });

  it('LRL-13-02 returns ok:false when confidence is negative', () => {
    const bad = { ...BASE, confidence: -0.1 };
    expect(loadRegistry([bad]).ok).toBe(false);
  });

  it('LRL-13-03 error code is INVALID_CONFIDENCE', () => {
    const bad = { ...BASE, confidence: 2 };
    const result = loadRegistry([bad]);
    if (result.ok) throw new Error('Expected ok:false');
    expect(result.errors.some(e => e.code === 'INVALID_CONFIDENCE')).toBe(true);
  });
});
