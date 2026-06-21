/**
 * Legal v4.0 — Regulation Engine Tests
 *
 * RE-01..RE-15: 15 groups × 3 tests = 45 tests
 *
 * Tests cover:
 *   - Threshold retrieval and shape
 *   - Procurement band value mapping (boundary conditions)
 *   - Compatible contract types per method
 *   - Max duration days per contract type
 *   - Mandatory clauses per fund source and contract type
 *   - Document prerequisites
 *   - Source tracking
 *   - Effective date format
 *   - Risk threshold score mapping
 *   - Pure function / idempotency guarantees
 */

import { describe, it, expect } from 'vitest';
import {
  getAllThresholds,
  getThreshold,
  getAllProcurementBands,
  getProcurementBandForValue,
  getCompatibleContractTypes,
  getMaxDurationDays,
  getMandatoryClausesForContractType,
  getMandatoryClausesForFund,
  getDocumentRequirements,
  getDependentStages,
  getAllRiskThresholds,
  getRiskLevelForScore,
} from '../ai/regulationExtractor';

// ─── RE-01: getThreshold() by code ───────────────────────────────────────────

describe('RE-01: getThreshold by code', () => {
  it('RE-01-01 returns DIRECT_APPOINTMENT_LIMIT with value 100_000_000', () => {
    const t = getThreshold('DIRECT_APPOINTMENT_LIMIT');
    expect(t).toBeDefined();
    expect(t!.value).toBe(100_000_000);
    expect(t!.currency).toBe('VND');
  });

  it('RE-01-02 returns PERFORMANCE_SECURITY_THRESHOLD with value 50_000_000', () => {
    const t = getThreshold('PERFORMANCE_SECURITY_THRESHOLD');
    expect(t).toBeDefined();
    expect(t!.value).toBe(50_000_000);
  });

  it('RE-01-03 returns undefined for unknown code', () => {
    expect(getThreshold('DOES_NOT_EXIST')).toBeUndefined();
  });
});

// ─── RE-02: getAllThresholds() shape ──────────────────────────────────────────

describe('RE-02: getAllThresholds shape', () => {
  it('RE-02-01 returns at least 5 entries', () => {
    expect(getAllThresholds().length).toBeGreaterThanOrEqual(5);
  });

  it('RE-02-02 every entry has code, value, currency, source, effectiveDate, description', () => {
    for (const t of getAllThresholds()) {
      expect(t.code).toBeTruthy();
      expect(typeof t.value).toBe('number');
      expect(t.currency).toBe('VND');
      expect(t.source).toBeTruthy();
      expect(t.effectiveDate).toBeTruthy();
      expect(t.description).toBeTruthy();
    }
  });

  it('RE-02-03 codes are unique', () => {
    const codes = getAllThresholds().map(t => t.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});

// ─── RE-03: getProcurementBandForValue() lower boundary ──────────────────────

describe('RE-03: getProcurementBandForValue lower boundaries', () => {
  it('RE-03-01 value 0 maps to DIRECT_50', () => {
    expect(getProcurementBandForValue(0).code).toBe('DIRECT_50');
  });

  it('RE-03-02 value exactly 50_000_000 maps to DIRECT_50', () => {
    expect(getProcurementBandForValue(50_000_000).code).toBe('DIRECT_50');
  });

  it('RE-03-03 value 50_000_001 maps to DIRECT_SELECTION_SIMPLIFIED', () => {
    expect(getProcurementBandForValue(50_000_001).code).toBe('DIRECT_SELECTION_SIMPLIFIED');
  });
});

// ─── RE-04: getProcurementBandForValue() upper boundaries ────────────────────

describe('RE-04: getProcurementBandForValue upper boundaries', () => {
  it('RE-04-01 value exactly 500_000_000 maps to DIRECT_SELECTION_SIMPLIFIED', () => {
    expect(getProcurementBandForValue(500_000_000).code).toBe('DIRECT_SELECTION_SIMPLIFIED');
  });

  it('RE-04-02 value exactly 5_000_000_000 maps to COMPETITIVE_SHOPPING', () => {
    expect(getProcurementBandForValue(5_000_000_000).code).toBe('COMPETITIVE_SHOPPING');
  });

  it('RE-04-03 value 5_000_000_001 maps to OPEN_BIDDING', () => {
    expect(getProcurementBandForValue(5_000_000_001).code).toBe('OPEN_BIDDING');
  });
});

// ─── RE-05: getCompatibleContractTypes() — broad methods ─────────────────────

describe('RE-05: compatible contract types broad methods', () => {
  it('RE-05-01 dau-thau-rong-rai supports all 5 contract types', () => {
    const types = getCompatibleContractTypes('dau-thau-rong-rai');
    expect(types).toContain('tron-goi');
    expect(types).toContain('theo-don-gia-dinh-truoc');
    expect(types).toContain('theo-don-gia-dieu-chinh');
    expect(types).toContain('theo-thoi-gian');
    expect(types).toContain('ket-hop');
    expect(types.length).toBe(5);
  });

  it('RE-05-02 chao-hang-canh-tranh supports only tron-goi and theo-don-gia-dinh-truoc', () => {
    const types = getCompatibleContractTypes('chao-hang-canh-tranh');
    expect(types).toContain('tron-goi');
    expect(types).toContain('theo-don-gia-dinh-truoc');
    expect(types).not.toContain('theo-don-gia-dieu-chinh');
    expect(types).not.toContain('theo-thoi-gian');
    expect(types).not.toContain('ket-hop');
  });

  it('RE-05-03 chi-dinh-thau supports tron-goi, theo-don-gia-dinh-truoc, theo-thoi-gian', () => {
    const types = getCompatibleContractTypes('chi-dinh-thau');
    expect(types).toContain('tron-goi');
    expect(types).toContain('theo-don-gia-dinh-truoc');
    expect(types).toContain('theo-thoi-gian');
    expect(types).not.toContain('ket-hop');
    expect(types).not.toContain('theo-don-gia-dieu-chinh');
  });
});

// ─── RE-06: getCompatibleContractTypes() — rut-gon restriction ───────────────

describe('RE-06: chi-dinh-thau-rut-gon contract type restriction', () => {
  it('RE-06-01 chi-dinh-thau-rut-gon only supports tron-goi', () => {
    const types = getCompatibleContractTypes('chi-dinh-thau-rut-gon');
    expect(types).toEqual(['tron-goi']);
  });

  it('RE-06-02 tron-goi is compatible with all procurement methods', () => {
    const methods = [
      'dau-thau-rong-rai', 'chao-hang-canh-tranh', 'mua-sam-truc-tiep',
      'chi-dinh-thau', 'chi-dinh-thau-rut-gon',
    ] as const;
    for (const m of methods) {
      expect(getCompatibleContractTypes(m)).toContain('tron-goi');
    }
  });

  it('RE-06-03 theo-don-gia-dieu-chinh is only compatible with dau-thau-rong-rai', () => {
    const types = getCompatibleContractTypes('chi-dinh-thau');
    expect(types).not.toContain('theo-don-gia-dieu-chinh');
    expect(getCompatibleContractTypes('dau-thau-rong-rai')).toContain('theo-don-gia-dieu-chinh');
  });
});

// ─── RE-07: getMaxDurationDays() ─────────────────────────────────────────────

describe('RE-07: max duration days per contract type', () => {
  it('RE-07-01 tron-goi max duration is 365 days', () => {
    expect(getMaxDurationDays('tron-goi')).toBe(365);
  });

  it('RE-07-02 theo-don-gia-dieu-chinh max duration is 1825 days (5 years)', () => {
    expect(getMaxDurationDays('theo-don-gia-dieu-chinh')).toBe(1825);
  });

  it('RE-07-03 ket-hop max duration is 1095 days (3 years)', () => {
    expect(getMaxDurationDays('ket-hop')).toBe(1095);
  });
});

// ─── RE-08: getMandatoryClausesForFund() ODA ─────────────────────────────────

describe('RE-08: mandatory clauses for ODA fund source', () => {
  it('RE-08-01 von-vay-oda includes tuan-thu-nha-tai-tro', () => {
    expect(getMandatoryClausesForFund('von-vay-oda')).toContain('tuan-thu-nha-tai-tro');
  });

  it('RE-08-02 von-su-nghiep has no additional mandatory clauses', () => {
    expect(getMandatoryClausesForFund('von-su-nghiep')).toHaveLength(0);
  });

  it('RE-08-03 von-tu-co has no additional mandatory clauses', () => {
    expect(getMandatoryClausesForFund('von-tu-co')).toHaveLength(0);
  });
});

// ─── RE-09: getMandatoryClausesForFund() state budget ────────────────────────

describe('RE-09: mandatory clauses for state budget fund source', () => {
  it('RE-09-01 ngan-sach-nha-nuoc includes bao-dam-thuc-hien', () => {
    expect(getMandatoryClausesForFund('ngan-sach-nha-nuoc')).toContain('bao-dam-thuc-hien');
  });

  it('RE-09-02 getMandatoryClausesForContractType tron-goi includes universal + bao-hanh', () => {
    const clauses = getMandatoryClausesForContractType('tron-goi');
    expect(clauses).toContain('doi-tuong');
    expect(clauses).toContain('bao-hanh');
  });

  it('RE-09-03 getMandatoryClausesForContractType theo-don-gia-dieu-chinh includes dieu-chinh-gia', () => {
    const clauses = getMandatoryClausesForContractType('theo-don-gia-dieu-chinh');
    expect(clauses).toContain('dieu-chinh-gia');
    expect(clauses).toContain('bao-dam-thuc-hien');
  });
});

// ─── RE-10: getDocumentRequirements() — thanh-ly stage ───────────────────────

describe('RE-10: document requirements for thanh-ly stage', () => {
  it('RE-10-01 thanh-ly requires hop-dong', () => {
    const reqs = getDocumentRequirements('thanh-ly').map(r => r.requiredDocument);
    expect(reqs).toContain('hop-dong');
  });

  it('RE-10-02 thanh-ly requires full post-award chain (4 prerequisites)', () => {
    const reqs = getDocumentRequirements('thanh-ly').map(r => r.requiredDocument);
    expect(reqs).toContain('bien-ban-nghiem-thu');
    expect(reqs).toContain('bien-ban-ban-giao');
    expect(reqs).toContain('thanh-toan');
    expect(reqs.length).toBe(4);
  });

  it('RE-10-03 every requirement entry has a non-empty source', () => {
    for (const r of getDocumentRequirements('thanh-ly')) {
      expect(r.source).toBeTruthy();
    }
  });
});

// ─── RE-11: getDocumentRequirements() — hop-dong stage ───────────────────────

describe('RE-11: document requirements for hop-dong stage', () => {
  it('RE-11-01 hop-dong requires quyet-dinh-phe-duyet', () => {
    const reqs = getDocumentRequirements('hop-dong').map(r => r.requiredDocument);
    expect(reqs).toContain('quyet-dinh-phe-duyet');
  });

  it('RE-11-02 hop-dong requires the full pre-award chain (4 prerequisites)', () => {
    const reqs = getDocumentRequirements('hop-dong').map(r => r.requiredDocument);
    expect(reqs).toContain('to-trinh');
    expect(reqs).toContain('khlcnt');
    expect(reqs).toContain('hsyc');
    expect(reqs.length).toBe(4);
  });

  it('RE-11-03 getDependentStages returns stages that depend on hop-dong', () => {
    const deps = getDependentStages('hop-dong');
    expect(deps).toContain('bien-ban-nghiem-thu');
    expect(deps).toContain('bien-ban-ban-giao');
    expect(deps).toContain('thanh-toan');
    expect(deps).toContain('thanh-ly');
  });
});

// ─── RE-12: Source tracking ───────────────────────────────────────────────────

describe('RE-12: source tracking across all registries', () => {
  it('RE-12-01 all thresholds have non-empty source strings', () => {
    for (const t of getAllThresholds()) {
      expect(t.source.length).toBeGreaterThan(0);
    }
  });

  it('RE-12-02 all procurement bands have non-empty source strings', () => {
    for (const b of getAllProcurementBands()) {
      expect(b.source.length).toBeGreaterThan(0);
    }
  });

  it('RE-12-03 all document requirements have non-empty source strings', () => {
    for (const r of getDocumentRequirements('thanh-ly')) {
      expect(r.source.length).toBeGreaterThan(0);
    }
  });
});

// ─── RE-13: Effective date format ────────────────────────────────────────────

describe('RE-13: effective date ISO 8601 format', () => {
  const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

  it('RE-13-01 all threshold effectiveDate fields match YYYY-MM-DD', () => {
    for (const t of getAllThresholds()) {
      expect(t.effectiveDate).toMatch(ISO_DATE);
    }
  });

  it('RE-13-02 DIRECT_APPOINTMENT_LIMIT effectiveDate is 2025-07-01', () => {
    expect(getThreshold('DIRECT_APPOINTMENT_LIMIT')!.effectiveDate).toBe('2025-07-01');
  });

  it('RE-13-03 all effectiveDates parse to valid Date objects', () => {
    for (const t of getAllThresholds()) {
      const d = new Date(t.effectiveDate);
      expect(isNaN(d.getTime())).toBe(false);
    }
  });
});

// ─── RE-14: Risk threshold score mapping ─────────────────────────────────────

describe('RE-14: getRiskLevelForScore mapping', () => {
  it('RE-14-01 score ≥ 40 returns CRITICAL', () => {
    expect(getRiskLevelForScore(40)).toBe('CRITICAL');
    expect(getRiskLevelForScore(99)).toBe('CRITICAL');
  });

  it('RE-14-02 score 25–39 returns HIGH', () => {
    expect(getRiskLevelForScore(25)).toBe('HIGH');
    expect(getRiskLevelForScore(39)).toBe('HIGH');
  });

  it('RE-14-03 score 15–24 returns MEDIUM and score 0–14 returns LOW', () => {
    expect(getRiskLevelForScore(15)).toBe('MEDIUM');
    expect(getRiskLevelForScore(0)).toBe('LOW');
    expect(getRiskLevelForScore(14)).toBe('LOW');
  });
});

// ─── RE-15: Pure function / idempotency ──────────────────────────────────────

describe('RE-15: pure function idempotency', () => {
  it('RE-15-01 getAllThresholds returns same length on repeated calls', () => {
    const a = getAllThresholds().length;
    const b = getAllThresholds().length;
    expect(a).toBe(b);
  });

  it('RE-15-02 getProcurementBandForValue returns identical result on repeated calls', () => {
    const r1 = getProcurementBandForValue(50_000_000);
    const r2 = getProcurementBandForValue(50_000_000);
    expect(r1.code).toBe(r2.code);
    expect(r1.recommendedMethod).toBe(r2.recommendedMethod);
  });

  it('RE-15-03 getRiskLevelForScore returns identical result on repeated calls', () => {
    expect(getRiskLevelForScore(40)).toBe(getRiskLevelForScore(40));
    expect(getRiskLevelForScore(0)).toBe(getRiskLevelForScore(0));
  });
});
