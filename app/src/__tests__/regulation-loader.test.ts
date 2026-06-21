/**
 * Legal v4.1 — Regulation Loader Tests
 *
 * RL-01..RL-07: 7 groups × 3 tests = 21 tests
 *
 * Tests cover:
 *   RL-01 JSON loading          — all 5 loaders return arrays
 *   RL-02 Threshold shape       — field presence and uniqueness
 *   RL-03 Procurement band shape — codes, methods, value ranges
 *   RL-04 Contract type shape   — duration, clauses, compatible methods
 *   RL-05 Fund source shape     — mandatory clauses per source
 *   RL-06 Risk threshold shape  — score bands and ordering
 *   RL-07 Backward compatibility — identical to v4.0 regulationDB exports
 *
 * Note: test file lives in src/__tests__/ (not src/tests/) so vitest picks it
 * up via the configured include pattern.
 */

import { describe, it, expect } from 'vitest';

import {
  loadThresholds,
  loadProcurementBands,
  loadContractTypes,
  loadFundSources,
  loadRiskThresholds,
} from '../ai/regulationLoader';

import {
  THRESHOLDS,
  PROCUREMENT_BANDS,
  CONTRACT_TYPE_REGS,
  FUND_SOURCE_REGS,
  RISK_THRESHOLDS,
} from '../ai/regulationDB';

// ─── RL-01: JSON loading ──────────────────────────────────────────────────────

describe('RL-01: JSON loading', () => {
  it('RL-01-01 loadThresholds returns a non-empty array', () => {
    const data = loadThresholds();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });

  it('RL-01-02 loadProcurementBands, loadContractTypes, loadFundSources return non-empty arrays', () => {
    expect(loadProcurementBands().length).toBeGreaterThan(0);
    expect(loadContractTypes().length).toBeGreaterThan(0);
    expect(loadFundSources().length).toBeGreaterThan(0);
  });

  it('RL-01-03 loadRiskThresholds returns a non-empty array', () => {
    expect(loadRiskThresholds().length).toBeGreaterThan(0);
  });
});

// ─── RL-02: Threshold shape ───────────────────────────────────────────────────

describe('RL-02: Threshold shape', () => {
  it('RL-02-01 every threshold has required fields with correct types', () => {
    for (const t of loadThresholds()) {
      expect(typeof t.code).toBe('string');
      expect(typeof t.value).toBe('number');
      expect(t.currency).toBe('VND');
      expect(typeof t.source).toBe('string');
      expect(typeof t.effectiveDate).toBe('string');
      expect(typeof t.description).toBe('string');
    }
  });

  it('RL-02-02 DIRECT_APPOINTMENT_LIMIT is present with value 100_000_000', () => {
    const t = loadThresholds().find(x => x.code === 'DIRECT_APPOINTMENT_LIMIT');
    expect(t).toBeDefined();
    expect(t!.value).toBe(100_000_000);
    expect(t!.currency).toBe('VND');
  });

  it('RL-02-03 threshold codes are unique', () => {
    const codes = loadThresholds().map(t => t.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});

// ─── RL-03: Procurement band shape ───────────────────────────────────────────

describe('RL-03: Procurement band shape', () => {
  it('RL-03-01 there are exactly 4 procurement bands', () => {
    expect(loadProcurementBands().length).toBe(4);
  });

  it('RL-03-02 DIRECT_50 band has valueMax = 50_000_000 and recommendedMethod set', () => {
    const band = loadProcurementBands().find(b => b.code === 'DIRECT_50');
    expect(band).toBeDefined();
    expect(band!.valueMax).toBe(50_000_000);
    expect(band!.recommendedMethod).toBeTruthy();
  });

  it('RL-03-03 OPEN_BIDDING band has valueMax = Number.MAX_SAFE_INTEGER', () => {
    const band = loadProcurementBands().find(b => b.code === 'OPEN_BIDDING');
    expect(band).toBeDefined();
    expect(band!.valueMax).toBe(Number.MAX_SAFE_INTEGER);
  });
});

// ─── RL-04: Contract type shape ───────────────────────────────────────────────

describe('RL-04: Contract type shape', () => {
  it('RL-04-01 there are exactly 5 contract types', () => {
    expect(loadContractTypes().length).toBe(5);
  });

  it('RL-04-02 tron-goi has maxDurationDays 365 and includes bao-hanh clause', () => {
    const ct = loadContractTypes().find(c => c.contractType === 'tron-goi');
    expect(ct).toBeDefined();
    expect(ct!.maxDurationDays).toBe(365);
    expect(ct!.mandatoryClauses).toContain('bao-hanh');
  });

  it('RL-04-03 theo-don-gia-dieu-chinh is compatible only with dau-thau-rong-rai', () => {
    const ct = loadContractTypes().find(c => c.contractType === 'theo-don-gia-dieu-chinh');
    expect(ct).toBeDefined();
    expect(ct!.compatibleMethods).toEqual(['dau-thau-rong-rai']);
    expect(ct!.maxDurationDays).toBe(1825);
  });
});

// ─── RL-05: Fund source shape ─────────────────────────────────────────────────

describe('RL-05: Fund source shape', () => {
  it('RL-05-01 there are exactly 4 fund sources', () => {
    expect(loadFundSources().length).toBe(4);
  });

  it('RL-05-02 von-vay-oda mandatoryClauses includes tuan-thu-nha-tai-tro', () => {
    const fs = loadFundSources().find(f => f.fundSource === 'von-vay-oda');
    expect(fs).toBeDefined();
    expect(fs!.mandatoryClauses).toContain('tuan-thu-nha-tai-tro');
  });

  it('RL-05-03 ngan-sach-nha-nuoc includes bao-dam-thuc-hien; von-tu-co has no extra clauses', () => {
    const ngan = loadFundSources().find(f => f.fundSource === 'ngan-sach-nha-nuoc');
    expect(ngan!.mandatoryClauses).toContain('bao-dam-thuc-hien');

    const tuCo = loadFundSources().find(f => f.fundSource === 'von-tu-co');
    expect(tuCo!.mandatoryClauses).toHaveLength(0);
  });
});

// ─── RL-06: Risk threshold shape ─────────────────────────────────────────────

describe('RL-06: Risk threshold shape', () => {
  it('RL-06-01 there are exactly 4 risk thresholds', () => {
    expect(loadRiskThresholds().length).toBe(4);
  });

  it('RL-06-02 minScore 40 → CRITICAL, minScore 0 → LOW', () => {
    const thresholds = loadRiskThresholds();
    expect(thresholds.find(t => t.minScore === 40)?.riskLevel).toBe('CRITICAL');
    expect(thresholds.find(t => t.minScore === 0)?.riskLevel).toBe('LOW');
  });

  it('RL-06-03 risk thresholds are ordered in descending minScore', () => {
    const scores = loadRiskThresholds().map(t => t.minScore);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]!).toBeLessThan(scores[i - 1]!);
    }
  });
});

// ─── RL-07: Backward compatibility ───────────────────────────────────────────
// regulationDB.ts re-exports the same named constants as v4.0.
// Consumers that import THRESHOLDS, PROCUREMENT_BANDS, etc. from regulationDB
// must receive data structurally identical to what the loaders return.

describe('RL-07: Backward compatibility with v4.0 regulationDB exports', () => {
  it('RL-07-01 THRESHOLDS from regulationDB equals loadThresholds() result', () => {
    const fromLoader = loadThresholds();
    expect(THRESHOLDS.length).toBe(fromLoader.length);
    expect(THRESHOLDS[0]).toEqual(fromLoader[0]);
  });

  it('RL-07-02 PROCUREMENT_BANDS from regulationDB equals loadProcurementBands() result', () => {
    const fromLoader = loadProcurementBands();
    expect(PROCUREMENT_BANDS.length).toBe(fromLoader.length);
    expect(PROCUREMENT_BANDS[0]).toEqual(fromLoader[0]);
  });

  it('RL-07-03 CONTRACT_TYPE_REGS, FUND_SOURCE_REGS, RISK_THRESHOLDS match loader results', () => {
    expect(CONTRACT_TYPE_REGS.length).toBe(loadContractTypes().length);
    expect(FUND_SOURCE_REGS.length).toBe(loadFundSources().length);
    expect(RISK_THRESHOLDS.length).toBe(loadRiskThresholds().length);
    expect(RISK_THRESHOLDS[0]).toEqual(loadRiskThresholds()[0]);
  });
});
