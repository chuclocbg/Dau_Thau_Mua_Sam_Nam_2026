/**
 * Phase 11.2.4 — Registry Query Engine tests
 *
 * Groups (13 × 3 = 39):
 *   LRQ-01  (3)  findById — found, not found, empty registry
 *   LRQ-02  (3)  findBySymbol — found, not found, case sensitivity
 *   LRQ-03  (3)  findEffectiveOn — within range, before range, after range
 *   LRQ-04  (3)  findEffectiveOn — with expiredDate boundary
 *   LRQ-05  (3)  findActive — status filter
 *   LRQ-06  (3)  findSuperseded — status filter
 *   LRQ-07  (3)  findChildren — documents that list the given id in replaces
 *   LRQ-08  (3)  findParents — documents the given id replaces
 *   LRQ-09  (3)  searchByKeyword — matches in title
 *   LRQ-10  (3)  searchByKeyword — matches in tags
 *   LRQ-11  (3)  searchByKeyword — case-insensitive, matches in summary
 *   LRQ-12  (3)  empty registry returns empty results for all methods
 *   LRQ-13  (3)  buildQueryEngine factory function
 */

import { describe, it, expect } from 'vitest';
import { RegistryQueryEngine, buildQueryEngine } from '../legal/registryQueryEngine';
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
  tags:          ['đấu thầu', 'mua sắm', 'quốc hội'],
  summary:       'Luật quy định về hoạt động đấu thầu tại Việt Nam',
  confidence:    1.0,
};

const DECREE_NEW: LegalDocument = {
  id:            'nd-214-2025',
  symbol:        '214/2025/NĐ-CP',
  title:         'Nghị định 214/2025/NĐ-CP hướng dẫn Luật Đấu thầu',
  type:          'DECREE',
  issuer:        'Chính phủ',
  effectiveDate: '2025-07-01',
  status:        'ACTIVE',
  replaces:      ['nd-24-2024'],
  source:        'Công báo số 500/2025',
  priority:      1,
  tags:          ['đấu thầu', 'nghị định', 'chính phủ'],
  summary:       'Nghị định hướng dẫn chi tiết Luật Đấu thầu mới nhất',
  confidence:    0.95,
};

const DECREE_OLD: LegalDocument = {
  id:            'nd-24-2024',
  symbol:        '24/2024/NĐ-CP',
  title:         'Nghị định 24/2024/NĐ-CP (hết hiệu lực)',
  type:          'DECREE',
  issuer:        'Chính phủ',
  effectiveDate: '2024-03-15',
  expiredDate:   '2025-06-30',
  status:        'SUPERSEDED',
  supersededBy:  'nd-214-2025',
  source:        'Công báo số 100/2024',
  priority:      1,
  tags:          ['đấu thầu', 'nghị định'],
  summary:       'Nghị định cũ đã bị thay thế bởi 214/2025',
  confidence:    0.9,
};

const CIRCULAR: LegalDocument = {
  id:            'tt-79-2025',
  symbol:        '79/2025/TT-BTC',
  title:         'Thông tư 79/2025/TT-BTC hướng dẫn tài chính',
  type:          'CIRCULAR',
  issuer:        'Bộ Tài chính',
  effectiveDate: '2025-07-01',
  status:        'ACTIVE',
  source:        'Công báo số 600/2025',
  priority:      2,
  tags:          ['thông tư', 'tài chính'],
  summary:       'Thông tư hướng dẫn về tài chính trong đấu thầu',
  confidence:    0.85,
};

const REGISTRY = createRegistry([LAW, DECREE_NEW, DECREE_OLD, CIRCULAR]);
const ENGINE   = new RegistryQueryEngine(REGISTRY);

// ── LRQ-01 findById ───────────────────────────────────────────────────────────

describe('LRQ-01 findById', () => {
  it('LRQ-01-01 returns the correct document for a known id', () => {
    expect(ENGINE.findById('luat-dau-thau-22-2023')).toBe(LAW);
  });

  it('LRQ-01-02 returns undefined for an unknown id', () => {
    expect(ENGINE.findById('does-not-exist')).toBeUndefined();
  });

  it('LRQ-01-03 id lookup is exact (no substring match)', () => {
    expect(ENGINE.findById('luat-dau-thau')).toBeUndefined();
  });
});

// ── LRQ-02 findBySymbol ───────────────────────────────────────────────────────

describe('LRQ-02 findBySymbol', () => {
  it('LRQ-02-01 returns the correct document for a known symbol', () => {
    expect(ENGINE.findBySymbol('22/2023/QH15')).toBe(LAW);
    expect(ENGINE.findBySymbol('214/2025/NĐ-CP')).toBe(DECREE_NEW);
  });

  it('LRQ-02-02 returns undefined for an unknown symbol', () => {
    expect(ENGINE.findBySymbol('99/9999/XX')).toBeUndefined();
  });

  it('LRQ-02-03 symbol lookup is case-sensitive', () => {
    expect(ENGINE.findBySymbol('22/2023/qh15')).toBeUndefined();
  });
});

// ── LRQ-03 findEffectiveOn — range ────────────────────────────────────────────

describe('LRQ-03 findEffectiveOn range', () => {
  it('LRQ-03-01 returns all documents effective on 2025-10-01', () => {
    // LAW (eff 2024-01-01, no exp), DECREE_NEW (eff 2025-07-01, no exp), CIRCULAR (eff 2025-07-01, no exp)
    // DECREE_OLD (eff 2024-03-15, exp 2025-06-30) → NOT included
    const results = ENGINE.findEffectiveOn('2025-10-01');
    expect(results.map(d => d.id)).toContain('luat-dau-thau-22-2023');
    expect(results.map(d => d.id)).toContain('nd-214-2025');
    expect(results.map(d => d.id)).toContain('tt-79-2025');
    expect(results.map(d => d.id)).not.toContain('nd-24-2024');
  });

  it('LRQ-03-02 returns empty for a date before all documents', () => {
    expect(ENGINE.findEffectiveOn('2020-01-01')).toHaveLength(0);
  });

  it('LRQ-03-03 includes document whose effectiveDate exactly equals query date', () => {
    const results = ENGINE.findEffectiveOn('2024-01-01');
    expect(results.map(d => d.id)).toContain('luat-dau-thau-22-2023');
  });
});

// ── LRQ-04 findEffectiveOn — expiredDate boundary ─────────────────────────────

describe('LRQ-04 findEffectiveOn expiredDate boundary', () => {
  it('LRQ-04-01 includes document on its expiredDate (boundary inclusive)', () => {
    // DECREE_OLD expiredDate = 2025-06-30
    const results = ENGINE.findEffectiveOn('2025-06-30');
    expect(results.map(d => d.id)).toContain('nd-24-2024');
  });

  it('LRQ-04-02 excludes document after its expiredDate', () => {
    // DECREE_OLD expiredDate = 2025-06-30
    const results = ENGINE.findEffectiveOn('2025-07-01');
    expect(results.map(d => d.id)).not.toContain('nd-24-2024');
  });

  it('LRQ-04-03 documents without expiredDate are always included after effectiveDate', () => {
    const results = ENGINE.findEffectiveOn('2030-01-01');
    expect(results.map(d => d.id)).toContain('luat-dau-thau-22-2023');
    expect(results.map(d => d.id)).toContain('nd-214-2025');
  });
});

// ── LRQ-05 findActive ─────────────────────────────────────────────────────────

describe('LRQ-05 findActive', () => {
  it('LRQ-05-01 returns only documents with status ACTIVE', () => {
    const active = ENGINE.findActive();
    expect(active.every(d => d.status === 'ACTIVE')).toBe(true);
  });

  it('LRQ-05-02 does not include SUPERSEDED documents', () => {
    expect(ENGINE.findActive().map(d => d.id)).not.toContain('nd-24-2024');
  });

  it('LRQ-05-03 returns correct count of active documents', () => {
    expect(ENGINE.findActive()).toHaveLength(3); // LAW, DECREE_NEW, CIRCULAR
  });
});

// ── LRQ-06 findSuperseded ─────────────────────────────────────────────────────

describe('LRQ-06 findSuperseded', () => {
  it('LRQ-06-01 returns only documents with status SUPERSEDED', () => {
    const superseded = ENGINE.findSuperseded();
    expect(superseded.every(d => d.status === 'SUPERSEDED')).toBe(true);
  });

  it('LRQ-06-02 returns DECREE_OLD as the one superseded document', () => {
    const superseded = ENGINE.findSuperseded();
    expect(superseded).toHaveLength(1);
    expect(superseded[0]!.id).toBe('nd-24-2024');
  });

  it('LRQ-06-03 returns empty array when no superseded documents exist', () => {
    const engine = new RegistryQueryEngine(createRegistry([LAW, CIRCULAR]));
    expect(engine.findSuperseded()).toHaveLength(0);
  });
});

// ── LRQ-07 findChildren ───────────────────────────────────────────────────────

describe('LRQ-07 findChildren', () => {
  it('LRQ-07-01 returns DECREE_NEW as child of DECREE_OLD', () => {
    const children = ENGINE.findChildren('nd-24-2024');
    expect(children.map(d => d.id)).toContain('nd-214-2025');
  });

  it('LRQ-07-02 returns empty for a document that no other document replaces', () => {
    // LAW is not in any replaces list
    expect(ENGINE.findChildren('luat-dau-thau-22-2023')).toHaveLength(0);
  });

  it('LRQ-07-03 returns empty for an unknown id', () => {
    expect(ENGINE.findChildren('ghost')).toHaveLength(0);
  });
});

// ── LRQ-08 findParents ────────────────────────────────────────────────────────

describe('LRQ-08 findParents', () => {
  it('LRQ-08-01 returns DECREE_OLD as parent of DECREE_NEW', () => {
    const parents = ENGINE.findParents('nd-214-2025');
    expect(parents.map(d => d.id)).toContain('nd-24-2024');
  });

  it('LRQ-08-02 returns empty for a document with no replaces list', () => {
    expect(ENGINE.findParents('luat-dau-thau-22-2023')).toHaveLength(0);
  });

  it('LRQ-08-03 returns empty for an unknown id', () => {
    expect(ENGINE.findParents('ghost')).toHaveLength(0);
  });
});

// ── LRQ-09 searchByKeyword — title ────────────────────────────────────────────

describe('LRQ-09 searchByKeyword title', () => {
  it('LRQ-09-01 matches document by substring in title', () => {
    const results = ENGINE.searchByKeyword('hướng dẫn');
    expect(results.length).toBeGreaterThan(0);
    expect(results.every(d => d.title.toLowerCase().includes('hướng dẫn')
      || d.summary.toLowerCase().includes('hướng dẫn')
      || d.tags.some(t => t.toLowerCase().includes('hướng dẫn'))
    )).toBe(true);
  });

  it('LRQ-09-02 returns empty array for a keyword that matches nothing', () => {
    expect(ENGINE.searchByKeyword('xây dựng')).toHaveLength(0);
  });

  it('LRQ-09-03 returns empty array for empty keyword', () => {
    expect(ENGINE.searchByKeyword('')).toHaveLength(0);
    expect(ENGINE.searchByKeyword('   ')).toHaveLength(0);
  });
});

// ── LRQ-10 searchByKeyword — tags ─────────────────────────────────────────────

describe('LRQ-10 searchByKeyword tags', () => {
  it('LRQ-10-01 matches document by tag value', () => {
    const results = ENGINE.searchByKeyword('mua sắm');
    expect(results.map(d => d.id)).toContain('luat-dau-thau-22-2023');
  });

  it('LRQ-10-02 matches multiple documents sharing a common tag', () => {
    const results = ENGINE.searchByKeyword('nghị định');
    expect(results.map(d => d.id)).toContain('nd-214-2025');
    expect(results.map(d => d.id)).toContain('nd-24-2024');
  });

  it('LRQ-10-03 tag search does not return false positives', () => {
    const results = ENGINE.searchByKeyword('tài chính');
    expect(results.map(d => d.id)).not.toContain('luat-dau-thau-22-2023');
  });
});

// ── LRQ-11 searchByKeyword — case-insensitive, summary ────────────────────────

describe('LRQ-11 searchByKeyword case-insensitive and summary', () => {
  it('LRQ-11-01 case-insensitive match in title', () => {
    // Title contains 'Luật' — search with uppercase 'LUẬT' should still match
    const resultsLower = ENGINE.searchByKeyword('luật');
    expect(resultsLower.length).toBeGreaterThan(0);
  });

  it('LRQ-11-02 matches document by substring in summary', () => {
    // CIRCULAR summary contains 'đấu thầu'
    const results = ENGINE.searchByKeyword('đấu thầu');
    expect(results.map(d => d.id)).toContain('tt-79-2025');
  });

  it('LRQ-11-03 symbol is also searched', () => {
    const results = ENGINE.searchByKeyword('QH15');
    expect(results.map(d => d.id)).toContain('luat-dau-thau-22-2023');
  });
});

// ── LRQ-12 empty registry ─────────────────────────────────────────────────────

describe('LRQ-12 empty registry', () => {
  const emptyEngine = new RegistryQueryEngine(createRegistry([]));

  it('LRQ-12-01 findById returns undefined on empty registry', () => {
    expect(emptyEngine.findById('any')).toBeUndefined();
  });

  it('LRQ-12-02 findEffectiveOn returns empty array on empty registry', () => {
    expect(emptyEngine.findEffectiveOn('2025-01-01')).toHaveLength(0);
  });

  it('LRQ-12-03 searchByKeyword returns empty array on empty registry', () => {
    expect(emptyEngine.searchByKeyword('law')).toHaveLength(0);
  });
});

// ── LRQ-13 buildQueryEngine factory ──────────────────────────────────────────

describe('LRQ-13 buildQueryEngine factory', () => {
  it('LRQ-13-01 returns a RegistryQueryEngine instance', () => {
    expect(buildQueryEngine(REGISTRY)).toBeInstanceOf(RegistryQueryEngine);
  });

  it('LRQ-13-02 factory-created engine produces same results as direct construction', () => {
    const factoryEngine = buildQueryEngine(REGISTRY);
    expect(factoryEngine.findById('luat-dau-thau-22-2023')).toBe(LAW);
    expect(factoryEngine.findActive()).toHaveLength(3);
  });

  it('LRQ-13-03 factory accepts MinLegalRegistry (not just full LegalRegistry)', () => {
    const minRegistry = {
      documents:   REGISTRY.documents,
      index:       REGISTRY.index,
      symbolIndex: REGISTRY.symbolIndex,
    };
    const engine = buildQueryEngine(minRegistry);
    expect(engine.findById('luat-dau-thau-22-2023')).toBe(LAW);
  });
});
