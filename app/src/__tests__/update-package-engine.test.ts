/**
 * Legal v4.5 — Update Package Engine Tests
 *
 * UP-01..UP-11: 11 groups × 3 tests = 33 tests
 *
 * Note: placed in src/__tests__/ (not src/tests/) — vitest include pattern is
 * src/__tests__/**\/*.test.{ts,tsx}.
 *
 * Data facts (from versioned JSON snapshots):
 *   2025-07-01 → 5 thresholds, 4 bands, 5 contract types, 4 fund sources, 4 risk bands
 *   2026-01-01 → 6 thresholds (adds E_PROCUREMENT_MANDATORY_THRESHOLD), rest unchanged
 *
 * MEDIUM and CRITICAL impact levels cannot be produced from real snapshot data
 * (no band/contractType/riskThreshold changes between versions).  Those groups
 * call computeImpactLevel() and getAffectedAreas() directly with synthetic diffs.
 *
 * Groups:
 *   UP-01 No changes           — same date → summary "No changes"
 *   UP-02 Added entries        — 2025→2026: 1 threshold added
 *   UP-03 Removed entries      — 2026→2025: 1 threshold removed
 *   UP-04 Changed entries      — no value mutations between versions → all changed arrays empty
 *   UP-05 Impact level LOW     — zero changes → LOW
 *   UP-06 Impact level MEDIUM  — synthetic diff with procurement band change → MEDIUM
 *   UP-07 Impact level HIGH    — threshold added/removed → HIGH
 *   UP-08 Impact level CRITICAL — synthetic diff with changedRiskThresholds → CRITICAL
 *   UP-09 Affected areas       — correct category names surfaced
 *   UP-10 Deterministic output — repeated calls produce identical results
 *   UP-11 Backward compatibility — pre-history fallback still works
 */

import { describe, it, expect } from 'vitest';
import {
  buildUpdatePackage,
  computeImpactLevel,
  getAffectedAreas,
} from '../ai/updatePackageEngine';
import type { SnapshotDiff } from '../ai/regulationDiffEngine';
import type { RiskThreshold, ProcurementBand } from '../ai/regulationLoader';

// ─── Convenience wrappers ────────────────────────────────────────────────────

const same25   = () => buildUpdatePackage('2025-07-01', '2025-07-01');
const forward  = () => buildUpdatePackage('2025-07-01', '2026-01-01');
const backward = () => buildUpdatePackage('2026-01-01', '2025-07-01');

// ─── Synthetic diff helpers ──────────────────────────────────────────────────

function blankDiff(): SnapshotDiff {
  return {
    oldDate: '2025-07-01', newDate: '2025-07-01',
    addedThresholds: [],       removedThresholds: [],       changedThresholds: [],
    addedProcurementBands: [], removedProcurementBands: [], changedProcurementBands: [],
    addedContractTypes: [],    removedContractTypes: [],    changedContractTypes: [],
    addedFundSources: [],      removedFundSources: [],      changedFundSources: [],
    addedRiskThresholds: [],   removedRiskThresholds: [],   changedRiskThresholds: [],
  };
}

const fakeRT1: RiskThreshold = { minScore: 40, riskLevel: 'CRITICAL' };
const fakeRT2: RiskThreshold = { minScore: 35, riskLevel: 'HIGH' };

const fakeBand: ProcurementBand = {
  code: 'DIRECT_50',
  recommendedMethod: 'chi-dinh-thau',
  valueMin: 0,
  valueMax: 50_000_000,
  source: 'test',
};

// ─── UP-01: No changes ────────────────────────────────────────────────────────

describe('UP-01: No changes — same date produces empty diff', () => {
  it('UP-01-01 summary is "No changes"', () => {
    expect(same25().summary).toBe('No changes');
  });

  it('UP-01-02 all *Changes arrays are empty', () => {
    const pkg = same25();
    expect(pkg.thresholdChanges.added.length).toBe(0);
    expect(pkg.thresholdChanges.removed.length).toBe(0);
    expect(pkg.thresholdChanges.changed.length).toBe(0);
  });

  it('UP-01-03 oldDate and newDate are preserved in output', () => {
    const pkg = buildUpdatePackage('2025-07-01', '2025-07-01');
    expect(pkg.oldDate).toBe('2025-07-01');
    expect(pkg.newDate).toBe('2025-07-01');
  });
});

// ─── UP-02: Added entries ─────────────────────────────────────────────────────

describe('UP-02: Added entries (2025 → 2026)', () => {
  it('UP-02-01 thresholdChanges.added has exactly 1 entry', () => {
    expect(forward().thresholdChanges.added).toHaveLength(1);
  });

  it('UP-02-02 added threshold code is E_PROCUREMENT_MANDATORY_THRESHOLD', () => {
    expect(forward().thresholdChanges.added[0]!.code).toBe('E_PROCUREMENT_MANDATORY_THRESHOLD');
  });

  it('UP-02-03 summary mentions "Added 1"', () => {
    expect(forward().summary).toContain('Added 1');
  });
});

// ─── UP-03: Removed entries ───────────────────────────────────────────────────

describe('UP-03: Removed entries (2026 → 2025, reverse)', () => {
  it('UP-03-01 thresholdChanges.removed has exactly 1 entry', () => {
    expect(backward().thresholdChanges.removed).toHaveLength(1);
  });

  it('UP-03-02 removed threshold code is E_PROCUREMENT_MANDATORY_THRESHOLD', () => {
    expect(backward().thresholdChanges.removed[0]!.code).toBe('E_PROCUREMENT_MANDATORY_THRESHOLD');
  });

  it('UP-03-03 summary mentions "removed 1"', () => {
    expect(backward().summary).toContain('removed 1');
  });
});

// ─── UP-04: Changed entries ───────────────────────────────────────────────────

describe('UP-04: Changed entries are absent (no value mutations between versions)', () => {
  it('UP-04-01 thresholdChanges.changed is empty for same-date diff', () => {
    expect(same25().thresholdChanges.changed).toHaveLength(0);
  });

  it('UP-04-02 thresholdChanges.changed is empty in forward diff (only addition, no mutation)', () => {
    expect(forward().thresholdChanges.changed).toHaveLength(0);
  });

  it('UP-04-03 all changed arrays are empty in forward diff', () => {
    const pkg = forward();
    expect(pkg.procurementBandChanges.changed).toHaveLength(0);
    expect(pkg.contractTypeChanges.changed).toHaveLength(0);
    expect(pkg.fundSourceChanges.changed).toHaveLength(0);
    expect(pkg.riskThresholdChanges.changed).toHaveLength(0);
  });
});

// ─── UP-05: Impact level LOW ──────────────────────────────────────────────────

describe('UP-05: Impact level LOW', () => {
  it('UP-05-01 same-date diff yields LOW impact', () => {
    expect(same25().impactLevel).toBe('LOW');
  });

  it('UP-05-02 blank synthetic diff yields LOW', () => {
    expect(computeImpactLevel(blankDiff())).toBe('LOW');
  });

  it('UP-05-03 diff with only fund-source changes yields LOW', () => {
    const diff: SnapshotDiff = {
      ...blankDiff(),
      addedFundSources: [{ fundSource: 'von-tu-co', mandatoryClauses: [], source: 'test' }],
    };
    expect(computeImpactLevel(diff)).toBe('LOW');
  });
});

// ─── UP-06: Impact level MEDIUM ──────────────────────────────────────────────
// Real data has no band/contractType changes between versions.
// Tests use computeImpactLevel() directly with synthetic diffs.

describe('UP-06: Impact level MEDIUM', () => {
  it('UP-06-01 diff with added procurement band → MEDIUM', () => {
    const diff: SnapshotDiff = { ...blankDiff(), addedProcurementBands: [fakeBand] };
    expect(computeImpactLevel(diff)).toBe('MEDIUM');
  });

  it('UP-06-02 diff with removed procurement band → MEDIUM', () => {
    const diff: SnapshotDiff = { ...blankDiff(), removedProcurementBands: [fakeBand] };
    expect(computeImpactLevel(diff)).toBe('MEDIUM');
  });

  it('UP-06-03 diff with added contract type → MEDIUM', () => {
    const diff: SnapshotDiff = {
      ...blankDiff(),
      addedContractTypes: [{
        contractType: 'tron-goi',
        maxDurationDays: 365,
        mandatoryClauses: [],
        compatibleMethods: ['chi-dinh-thau'],
        source: 'test',
      }],
    };
    expect(computeImpactLevel(diff)).toBe('MEDIUM');
  });
});

// ─── UP-07: Impact level HIGH ─────────────────────────────────────────────────

describe('UP-07: Impact level HIGH', () => {
  it('UP-07-01 forward diff (1 threshold added) → HIGH', () => {
    expect(forward().impactLevel).toBe('HIGH');
  });

  it('UP-07-02 backward diff (1 threshold removed) → HIGH', () => {
    expect(backward().impactLevel).toBe('HIGH');
  });

  it('UP-07-03 synthetic diff with added risk threshold (not changed) → HIGH', () => {
    const diff: SnapshotDiff = { ...blankDiff(), addedRiskThresholds: [fakeRT1] };
    expect(computeImpactLevel(diff)).toBe('HIGH');
  });
});

// ─── UP-08: Impact level CRITICAL ────────────────────────────────────────────
// Real data has no changedRiskThresholds.  Tests use computeImpactLevel() with
// synthetic diffs.

describe('UP-08: Impact level CRITICAL', () => {
  it('UP-08-01 diff with one changedRiskThreshold → CRITICAL', () => {
    const diff: SnapshotDiff = {
      ...blankDiff(),
      changedRiskThresholds: [{ old: fakeRT1, new: fakeRT2 }],
    };
    expect(computeImpactLevel(diff)).toBe('CRITICAL');
  });

  it('UP-08-02 CRITICAL even if only one risk threshold field changed', () => {
    const diff: SnapshotDiff = {
      ...blankDiff(),
      changedRiskThresholds: [{ old: fakeRT1, new: { ...fakeRT1, riskLevel: 'HIGH' } }],
    };
    expect(computeImpactLevel(diff)).toBe('CRITICAL');
  });

  it('UP-08-03 CRITICAL takes priority over threshold changes', () => {
    const diff: SnapshotDiff = {
      ...blankDiff(),
      addedThresholds: [{ code: 'TEST', value: 1, currency: 'VND', source: 'test', effectiveDate: '2026-01-01', description: 'test' }],
      changedRiskThresholds: [{ old: fakeRT1, new: fakeRT2 }],
    };
    expect(computeImpactLevel(diff)).toBe('CRITICAL');
  });
});

// ─── UP-09: Affected areas ────────────────────────────────────────────────────

describe('UP-09: Affected areas', () => {
  it('UP-09-01 same-date diff → affectedAreas is empty', () => {
    expect(same25().affectedAreas).toHaveLength(0);
  });

  it('UP-09-02 forward diff → affectedAreas contains "thresholds"', () => {
    expect(forward().affectedAreas).toContain('thresholds');
  });

  it('UP-09-03 forward diff → affectedAreas does NOT contain other categories', () => {
    const areas = forward().affectedAreas;
    expect(areas).not.toContain('procurementBands');
    expect(areas).not.toContain('contractTypes');
    expect(areas).not.toContain('fundSources');
    expect(areas).not.toContain('riskThresholds');
  });
});

// ─── UP-10: Deterministic output ─────────────────────────────────────────────

describe('UP-10: Deterministic / idempotent output', () => {
  it('UP-10-01 repeated calls return the same summary', () => {
    expect(forward().summary).toBe(forward().summary);
  });

  it('UP-10-02 repeated calls return the same impactLevel', () => {
    expect(forward().impactLevel).toBe(forward().impactLevel);
  });

  it('UP-10-03 repeated calls return the same affectedAreas', () => {
    expect(forward().affectedAreas.length).toBe(forward().affectedAreas.length);
    expect(forward().affectedAreas[0]).toBe(forward().affectedAreas[0]);
  });
});

// ─── UP-11: Backward compatibility ───────────────────────────────────────────

describe('UP-11: Backward compatibility / fallback dates', () => {
  it('UP-11-01 pre-history date does not throw and returns a valid package', () => {
    const pkg = buildUpdatePackage('2020-01-01', '2025-07-01');
    expect(pkg).toHaveProperty('summary');
    expect(pkg).toHaveProperty('impactLevel');
    expect(pkg).toHaveProperty('affectedAreas');
  });

  it('UP-11-02 oldDate and newDate in the package reflect the original query inputs', () => {
    const pkg = buildUpdatePackage('2020-01-01', '2099-12-31');
    expect(pkg.oldDate).toBe('2020-01-01');
    expect(pkg.newDate).toBe('2099-12-31');
  });

  it('UP-11-03 pre-history vs 2026-01-01 → impactLevel HIGH (1 threshold added via fallback)', () => {
    const pkg = buildUpdatePackage('2020-01-01', '2026-01-01');
    expect(pkg.impactLevel).toBe('HIGH');
    expect(pkg.thresholdChanges.added).toHaveLength(1);
  });
});
