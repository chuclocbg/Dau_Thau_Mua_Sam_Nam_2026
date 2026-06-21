/**
 * Legal v4.3 — Effective Date Engine Tests
 *
 * ED-01..ED-07: 7 groups × 3 tests = 21 tests
 *
 * Note: file placed in src/__tests__/ (not src/tests/) — vitest include
 * pattern is src/__tests__/**\/*.test.{ts,tsx}.
 *
 * The key behavioral difference from regulationVersionResolver is ED-04:
 * when targetDate predates all registered versions, getRegulationSnapshot()
 * returns the OLDEST snapshot (not empty arrays).
 *
 * Groups:
 *   ED-01 Exact snapshot         — targetDate == a known version date
 *   ED-02 Nearest previous       — targetDate between two versions → older
 *   ED-03 Future date            — targetDate after newest → newest snapshot
 *   ED-04 Before oldest version  — fallback to oldest (not [])
 *   ED-05 Deterministic output   — identical calls return identical results
 *   ED-06 Snapshot shape         — returned object has all required fields
 *   ED-07 Backward compatibility — 2025-07-01 snapshot matches regulationLoader
 */

import { describe, it, expect } from 'vitest';
import { getRegulationSnapshot } from '../ai/effectiveDateEngine';
import {
  loadThresholds,
  loadProcurementBands,
  loadContractTypes,
  loadFundSources,
  loadRiskThresholds,
} from '../ai/regulationLoader';
import { resolveThresholds } from '../ai/regulationVersionResolver';

// ─── ED-01: Exact snapshot ────────────────────────────────────────────────────

describe('ED-01: Exact snapshot match', () => {
  it('ED-01-01 targetDate 2025-07-01 returns 5 thresholds', () => {
    const snap = getRegulationSnapshot('2025-07-01');
    expect(snap.thresholds.length).toBe(5);
  });

  it('ED-01-02 targetDate 2026-01-01 returns 6 thresholds (including E_PROCUREMENT)', () => {
    const snap = getRegulationSnapshot('2026-01-01');
    expect(snap.thresholds.length).toBe(6);
    expect(snap.thresholds.some(t => t.code === 'E_PROCUREMENT_MANDATORY_THRESHOLD')).toBe(true);
  });

  it('ED-01-03 snapshot.targetDate is always the original query date', () => {
    expect(getRegulationSnapshot('2025-07-01').targetDate).toBe('2025-07-01');
    expect(getRegulationSnapshot('2026-01-01').targetDate).toBe('2026-01-01');
  });
});

// ─── ED-02: Nearest previous snapshot ────────────────────────────────────────

describe('ED-02: Nearest previous snapshot', () => {
  it('ED-02-01 targetDate 2025-08-01 returns 5 thresholds (2025-07-01 snapshot)', () => {
    expect(getRegulationSnapshot('2025-08-01').thresholds.length).toBe(5);
  });

  it('ED-02-02 targetDate 2025-12-31 (day before 2026 snapshot) returns 5 thresholds', () => {
    expect(getRegulationSnapshot('2025-12-31').thresholds.length).toBe(5);
  });

  it('ED-02-03 snapshot.targetDate is the query date, not the resolved snapshot date', () => {
    const snap = getRegulationSnapshot('2025-08-01');
    expect(snap.targetDate).toBe('2025-08-01');
    // data comes from 2025-07-01, but targetDate reflects the query
    expect(snap.thresholds.some(t => t.code === 'E_PROCUREMENT_MANDATORY_THRESHOLD')).toBe(false);
  });
});

// ─── ED-03: Future date — newest snapshot ─────────────────────────────────────

describe('ED-03: Future date uses newest available snapshot', () => {
  it('ED-03-01 targetDate 2026-03-01 returns 6 thresholds', () => {
    expect(getRegulationSnapshot('2026-03-01').thresholds.length).toBe(6);
  });

  it('ED-03-02 targetDate 2099-12-31 returns 6 thresholds (newest snapshot, not empty)', () => {
    const snap = getRegulationSnapshot('2099-12-31');
    expect(snap.thresholds.length).toBe(6);
  });

  it('ED-03-03 far-future targetDate snapshot contains E_PROCUREMENT threshold', () => {
    const snap = getRegulationSnapshot('2099-01-01');
    expect(snap.thresholds.some(t => t.code === 'E_PROCUREMENT_MANDATORY_THRESHOLD')).toBe(true);
  });
});

// ─── ED-04: Before oldest version — fallback ─────────────────────────────────
// This is the key distinction from regulationVersionResolver:
//   resolveThresholds('2020-01-01') → []
//   getRegulationSnapshot('2020-01-01').thresholds → oldest snapshot (not [])

describe('ED-04: Date before oldest version — fallback to oldest snapshot', () => {
  it('ED-04-01 targetDate 2020-01-01 returns non-empty thresholds (NOT empty array)', () => {
    const snap = getRegulationSnapshot('2020-01-01');
    expect(snap.thresholds.length).toBeGreaterThan(0);
    // contrast with resolver which returns []
    expect(resolveThresholds('2020-01-01')).toEqual([]);
  });

  it('ED-04-02 targetDate 2025-06-30 (one day before earliest) falls back to oldest snapshot', () => {
    const snap = getRegulationSnapshot('2025-06-30');
    expect(snap.thresholds.length).toBe(5);
    expect(snap.procurementBands.length).toBe(4);
    expect(snap.fundSources.length).toBe(4);
  });

  it('ED-04-03 fallback snapshot.targetDate still reflects the original query date', () => {
    const snap = getRegulationSnapshot('2020-01-01');
    expect(snap.targetDate).toBe('2020-01-01');
  });
});

// ─── ED-05: Deterministic output ─────────────────────────────────────────────

describe('ED-05: Deterministic / idempotent output', () => {
  it('ED-05-01 repeated calls with same date return equal snapshot lengths', () => {
    const a = getRegulationSnapshot('2025-08-01');
    const b = getRegulationSnapshot('2025-08-01');
    expect(a.thresholds.length).toBe(b.thresholds.length);
    expect(a.procurementBands.length).toBe(b.procurementBands.length);
  });

  it('ED-05-02 fallback date is stable across calls', () => {
    const a = getRegulationSnapshot('2020-01-01').thresholds.length;
    const b = getRegulationSnapshot('2020-01-01').thresholds.length;
    expect(a).toBe(b);
  });

  it('ED-05-03 riskThresholds are stable across repeated calls', () => {
    const r1 = getRegulationSnapshot('2026-03-01').riskThresholds;
    const r2 = getRegulationSnapshot('2026-03-01').riskThresholds;
    expect(r1.length).toBe(r2.length);
    expect(r1[0]).toEqual(r2[0]);
  });
});

// ─── ED-06: Snapshot shape ────────────────────────────────────────────────────

describe('ED-06: Snapshot shape and field completeness', () => {
  it('ED-06-01 snapshot has all six required fields', () => {
    const snap = getRegulationSnapshot('2025-08-01');
    expect(snap).toHaveProperty('targetDate');
    expect(snap).toHaveProperty('thresholds');
    expect(snap).toHaveProperty('procurementBands');
    expect(snap).toHaveProperty('contractTypes');
    expect(snap).toHaveProperty('fundSources');
    expect(snap).toHaveProperty('riskThresholds');
  });

  it('ED-06-02 all array fields are non-empty for a valid date', () => {
    const snap = getRegulationSnapshot('2025-08-01');
    expect(snap.thresholds.length).toBeGreaterThan(0);
    expect(snap.procurementBands.length).toBeGreaterThan(0);
    expect(snap.contractTypes.length).toBeGreaterThan(0);
    expect(snap.fundSources.length).toBeGreaterThan(0);
    expect(snap.riskThresholds.length).toBeGreaterThan(0);
  });

  it('ED-06-03 all array fields are non-empty even for a pre-history date (fallback)', () => {
    const snap = getRegulationSnapshot('2000-01-01');
    expect(snap.thresholds.length).toBeGreaterThan(0);
    expect(snap.procurementBands.length).toBeGreaterThan(0);
    expect(snap.contractTypes.length).toBeGreaterThan(0);
    expect(snap.fundSources.length).toBeGreaterThan(0);
    expect(snap.riskThresholds.length).toBeGreaterThan(0);
  });
});

// ─── ED-07: Backward compatibility ───────────────────────────────────────────
// getRegulationSnapshot('2025-07-01') returns the same data as regulationLoader.ts,
// confirming that the engine does not break existing consumers.

describe('ED-07: Backward compatibility with regulationLoader', () => {
  it('ED-07-01 thresholds for 2025-07-01 match loadThresholds()', () => {
    const snap = getRegulationSnapshot('2025-07-01');
    expect(snap.thresholds.length).toBe(loadThresholds().length);
    expect(snap.thresholds[0]).toEqual(loadThresholds()[0]);
  });

  it('ED-07-02 procurementBands and contractTypes for 2025-07-01 match loaders', () => {
    const snap = getRegulationSnapshot('2025-07-01');
    expect(snap.procurementBands.length).toBe(loadProcurementBands().length);
    expect(snap.contractTypes.length).toBe(loadContractTypes().length);
  });

  it('ED-07-03 fundSources and riskThresholds for 2025-07-01 match loaders', () => {
    const snap = getRegulationSnapshot('2025-07-01');
    expect(snap.fundSources.length).toBe(loadFundSources().length);
    expect(snap.riskThresholds.length).toBe(loadRiskThresholds().length);
    expect(snap.riskThresholds[0]).toEqual(loadRiskThresholds()[0]);
  });
});
