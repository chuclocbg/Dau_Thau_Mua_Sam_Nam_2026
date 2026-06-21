/**
 * Legal v4.2 — Regulation Version Resolver Tests
 *
 * RV-01..RV-07: 7 groups × 3 tests = 21 tests
 *
 * Note: file placed in src/__tests__/ (not src/tests/) — vitest include
 * pattern is src/__tests__/**\/*.test.{ts,tsx}.
 *
 * Groups:
 *   RV-01 Exact version match       — targetDate == a known version key
 *   RV-02 Nearest previous version  — targetDate between two versions → older
 *   RV-03 Future date               — targetDate after all versions → newest
 *   RV-04 Before all versions       — targetDate predates earliest → undefined / []
 *   RV-05 All categories resolve    — resolveVersion works for every Category
 *   RV-06 Deterministic output      — identical calls return identical results
 *   RV-07 Backward compatibility    — 2025-07-01 data matches regulationLoader output
 */

import { describe, it, expect } from 'vitest';
import {
  resolveVersion,
  resolveThresholds,
  resolveProcurementBands,
  resolveContractTypes,
  resolveFundSources,
  resolveRiskThresholds,
} from '../ai/regulationVersionResolver';
import {
  loadThresholds,
  loadProcurementBands,
  loadContractTypes,
  loadFundSources,
  loadRiskThresholds,
} from '../ai/regulationLoader';

// ─── RV-01: Exact version match ───────────────────────────────────────────────

describe('RV-01: Exact version match', () => {
  it('RV-01-01 resolveVersion returns 2025-07-01 when targetDate is exactly 2025-07-01', () => {
    expect(resolveVersion('thresholds', '2025-07-01')).toBe('2025-07-01');
  });

  it('RV-01-02 resolveVersion returns 2026-01-01 when targetDate is exactly 2026-01-01', () => {
    expect(resolveVersion('thresholds', '2026-01-01')).toBe('2026-01-01');
  });

  it('RV-01-03 resolveThresholds on exact 2026-01-01 returns 6 entries (includes E_PROCUREMENT)', () => {
    const data = resolveThresholds('2026-01-01');
    expect(data.length).toBe(6);
    expect(data.some(t => t.code === 'E_PROCUREMENT_MANDATORY_THRESHOLD')).toBe(true);
  });
});

// ─── RV-02: Nearest previous version ─────────────────────────────────────────

describe('RV-02: Nearest previous version', () => {
  it('RV-02-01 targetDate 2025-08-01 selects 2025-07-01 (only version before it)', () => {
    expect(resolveVersion('thresholds', '2025-08-01')).toBe('2025-07-01');
  });

  it('RV-02-02 targetDate 2025-12-31 (last day before 2026) selects 2025-07-01', () => {
    expect(resolveVersion('thresholds', '2025-12-31')).toBe('2025-07-01');
  });

  it('RV-02-03 resolveThresholds for 2025-08-01 returns 5 entries (2025-07-01 snapshot)', () => {
    const data = resolveThresholds('2025-08-01');
    expect(data.length).toBe(5);
    expect(data.some(t => t.code === 'E_PROCUREMENT_MANDATORY_THRESHOLD')).toBe(false);
  });
});

// ─── RV-03: Future date ───────────────────────────────────────────────────────

describe('RV-03: Future date selects newest version', () => {
  it('RV-03-01 targetDate 2026-03-01 selects 2026-01-01', () => {
    expect(resolveVersion('thresholds', '2026-03-01')).toBe('2026-01-01');
  });

  it('RV-03-02 targetDate 2099-01-01 also selects 2026-01-01 (newest available)', () => {
    expect(resolveVersion('thresholds', '2099-01-01')).toBe('2026-01-01');
  });

  it('RV-03-03 resolveThresholds for 2099-01-01 returns 6 entries', () => {
    expect(resolveThresholds('2099-01-01').length).toBe(6);
  });
});

// ─── RV-04: Before all versions ───────────────────────────────────────────────

describe('RV-04: Before all versions — no match', () => {
  it('RV-04-01 targetDate 2025-06-30 (day before earliest) returns undefined', () => {
    expect(resolveVersion('thresholds', '2025-06-30')).toBeUndefined();
  });

  it('RV-04-02 targetDate 2020-01-01 (far before earliest) returns undefined', () => {
    expect(resolveVersion('thresholds', '2020-01-01')).toBeUndefined();
  });

  it('RV-04-03 resolveThresholds for 2020-01-01 returns an empty array', () => {
    expect(resolveThresholds('2020-01-01')).toEqual([]);
  });
});

// ─── RV-05: All categories resolve ───────────────────────────────────────────

describe('RV-05: All five categories resolve correctly', () => {
  it('RV-05-01 procurementBands and contractTypes resolve 2025-07-01 for mid-2025 date', () => {
    expect(resolveVersion('procurementBands', '2025-10-01')).toBe('2025-07-01');
    expect(resolveVersion('contractTypes',    '2025-10-01')).toBe('2025-07-01');
  });

  it('RV-05-02 fundSources and riskThresholds resolve 2026-01-01 for 2026 date', () => {
    expect(resolveVersion('fundSources',    '2026-06-01')).toBe('2026-01-01');
    expect(resolveVersion('riskThresholds', '2026-06-01')).toBe('2026-01-01');
  });

  it('RV-05-03 per-category resolve functions return non-empty arrays for a valid 2025 date', () => {
    const date = '2025-09-01';
    expect(resolveProcurementBands(date).length).toBeGreaterThan(0);
    expect(resolveContractTypes(date).length).toBeGreaterThan(0);
    expect(resolveFundSources(date).length).toBeGreaterThan(0);
    expect(resolveRiskThresholds(date).length).toBeGreaterThan(0);
  });
});

// ─── RV-06: Deterministic output ─────────────────────────────────────────────

describe('RV-06: Deterministic / idempotent output', () => {
  it('RV-06-01 resolveVersion returns same value on repeated calls', () => {
    expect(resolveVersion('thresholds', '2025-08-01')).toBe(resolveVersion('thresholds', '2025-08-01'));
    expect(resolveVersion('thresholds', '2026-03-01')).toBe(resolveVersion('thresholds', '2026-03-01'));
  });

  it('RV-06-02 resolveThresholds returns arrays of equal length on repeated calls', () => {
    const a = resolveThresholds('2025-08-01').length;
    const b = resolveThresholds('2025-08-01').length;
    expect(a).toBe(b);
  });

  it('RV-06-03 resolveRiskThresholds is stable across calls', () => {
    const r1 = resolveRiskThresholds('2026-06-01');
    const r2 = resolveRiskThresholds('2026-06-01');
    expect(r1.length).toBe(r2.length);
    expect(r1[0]).toEqual(r2[0]);
  });
});

// ─── RV-07: Backward compatibility ───────────────────────────────────────────
// The 2025-07-01 versioned snapshots contain the same data as the flat files
// loaded by regulationLoader.ts.  This verifies that switching to versioned
// resolution does not change existing behavior for the base date.

describe('RV-07: Backward compatibility with regulationLoader', () => {
  it('RV-07-01 resolveThresholds(2025-07-01) length equals loadThresholds() length', () => {
    expect(resolveThresholds('2025-07-01').length).toBe(loadThresholds().length);
  });

  it('RV-07-02 resolveProcurementBands(2025-07-01) matches loadProcurementBands()', () => {
    const versionedBands = resolveProcurementBands('2025-07-01');
    const loaderBands    = loadProcurementBands();
    expect(versionedBands.length).toBe(loaderBands.length);
    expect(versionedBands[0]).toEqual(loaderBands[0]);
  });

  it('RV-07-03 resolveContractTypes, resolveFundSources, resolveRiskThresholds match loaders', () => {
    expect(resolveContractTypes('2025-07-01').length).toBe(loadContractTypes().length);
    expect(resolveFundSources('2025-07-01').length).toBe(loadFundSources().length);
    expect(resolveRiskThresholds('2025-07-01').length).toBe(loadRiskThresholds().length);
    expect(resolveRiskThresholds('2025-07-01')[0]).toEqual(loadRiskThresholds()[0]);
  });
});
