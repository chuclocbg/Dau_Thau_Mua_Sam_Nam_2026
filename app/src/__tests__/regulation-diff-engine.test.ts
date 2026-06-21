/**
 * Legal v4.4 — Regulation Diff Engine Tests
 *
 * RD-01..RD-11: 11 groups × 3 tests = 33 tests
 *
 * Note: file placed in src/__tests__/ (not src/tests/) — vitest include
 * pattern is src/__tests__/**\/*.test.{ts,tsx}.
 *
 * Data facts (from versioned JSON snapshots):
 *   2025-07-01 → 5 thresholds, 4 bands, 5 contract types, 4 fund sources, 4 risk bands
 *   2026-01-01 → 6 thresholds (adds E_PROCUREMENT_MANDATORY_THRESHOLD), rest unchanged
 *
 * Groups:
 *   RD-01 Identical snapshots          — same date produces all-zero diff
 *   RD-02 Added entries                — 2025→2026: 1 threshold added
 *   RD-03 Removed entries              — 2026→2025: 1 threshold removed
 *   RD-04 Changed entries              — verify changedX arrays are empty (no value mutations)
 *   RD-05 Threshold changes detail     — inspect the added/removed threshold
 *   RD-06 Procurement band changes     — all zero between versions
 *   RD-07 Contract type changes        — all zero between versions
 *   RD-08 Fund source changes          — all zero between versions
 *   RD-09 Risk threshold changes       — all zero between versions
 *   RD-10 Deterministic output         — same inputs → same outputs
 *   RD-11 Backward compatibility       — dates that trigger fallback still diff correctly
 */

import { describe, it, expect } from 'vitest';
import { compareSnapshots } from '../ai/regulationDiffEngine';

// Convenience helpers
const forward  = () => compareSnapshots('2025-07-01', '2026-01-01');
const backward = () => compareSnapshots('2026-01-01', '2025-07-01');
const same25   = () => compareSnapshots('2025-07-01', '2025-07-01');
const same26   = () => compareSnapshots('2026-01-01', '2026-01-01');

// ─── RD-01: Identical snapshots ───────────────────────────────────────────────

describe('RD-01: Identical snapshots produce an all-zero diff', () => {
  it('RD-01-01 same date → addedThresholds, removedThresholds, changedThresholds all empty', () => {
    const diff = same25();
    expect(diff.addedThresholds).toHaveLength(0);
    expect(diff.removedThresholds).toHaveLength(0);
    expect(diff.changedThresholds).toHaveLength(0);
  });

  it('RD-01-02 same date → all other categories also have zero entries', () => {
    const diff = same25();
    expect(diff.addedProcurementBands).toHaveLength(0);
    expect(diff.addedContractTypes).toHaveLength(0);
    expect(diff.addedFundSources).toHaveLength(0);
    expect(diff.addedRiskThresholds).toHaveLength(0);
  });

  it('RD-01-03 output reflects the queried dates in oldDate / newDate fields', () => {
    const diff = compareSnapshots('2025-07-01', '2025-07-01');
    expect(diff.oldDate).toBe('2025-07-01');
    expect(diff.newDate).toBe('2025-07-01');
  });
});

// ─── RD-02: Added entries ─────────────────────────────────────────────────────

describe('RD-02: Added entries detected (2025 → 2026)', () => {
  it('RD-02-01 addedThresholds has exactly 1 entry', () => {
    expect(forward().addedThresholds).toHaveLength(1);
  });

  it('RD-02-02 added threshold code is E_PROCUREMENT_MANDATORY_THRESHOLD', () => {
    expect(forward().addedThresholds[0]!.code).toBe('E_PROCUREMENT_MANDATORY_THRESHOLD');
  });

  it('RD-02-03 no entries are added in procurementBands, contractTypes, fundSources, riskThresholds', () => {
    const diff = forward();
    expect(diff.addedProcurementBands).toHaveLength(0);
    expect(diff.addedContractTypes).toHaveLength(0);
    expect(diff.addedFundSources).toHaveLength(0);
    expect(diff.addedRiskThresholds).toHaveLength(0);
  });
});

// ─── RD-03: Removed entries ───────────────────────────────────────────────────

describe('RD-03: Removed entries detected (2026 → 2025, reverse)', () => {
  it('RD-03-01 removedThresholds has exactly 1 entry', () => {
    expect(backward().removedThresholds).toHaveLength(1);
  });

  it('RD-03-02 removed threshold is E_PROCUREMENT_MANDATORY_THRESHOLD', () => {
    expect(backward().removedThresholds[0]!.code).toBe('E_PROCUREMENT_MANDATORY_THRESHOLD');
  });

  it('RD-03-03 nothing is added in the reverse diff (removed = added in forward)', () => {
    const diff = backward();
    expect(diff.addedThresholds).toHaveLength(0);
    expect(diff.removedProcurementBands).toHaveLength(0);
    expect(diff.removedContractTypes).toHaveLength(0);
    expect(diff.removedFundSources).toHaveLength(0);
    expect(diff.removedRiskThresholds).toHaveLength(0);
  });
});

// ─── RD-04: Changed entries ───────────────────────────────────────────────────
// Our two versions differ only by addition of one threshold.
// No existing entry has different field values between the versions,
// so all changedX arrays must be empty.

describe('RD-04: Changed entries are absent when values are identical', () => {
  it('RD-04-01 changedThresholds is empty — no threshold values were mutated between versions', () => {
    expect(forward().changedThresholds).toHaveLength(0);
  });

  it('RD-04-02 changedProcurementBands and changedContractTypes are empty', () => {
    const diff = forward();
    expect(diff.changedProcurementBands).toHaveLength(0);
    expect(diff.changedContractTypes).toHaveLength(0);
  });

  it('RD-04-03 changedFundSources and changedRiskThresholds are empty', () => {
    const diff = forward();
    expect(diff.changedFundSources).toHaveLength(0);
    expect(diff.changedRiskThresholds).toHaveLength(0);
  });
});

// ─── RD-05: Threshold change detail ──────────────────────────────────────────

describe('RD-05: Threshold diff content detail', () => {
  it('RD-05-01 added threshold value is 200_000_000', () => {
    expect(forward().addedThresholds[0]!.value).toBe(200_000_000);
  });

  it('RD-05-02 added threshold source references Thông tư 80/2025/TT-BTC', () => {
    expect(forward().addedThresholds[0]!.source).toContain('Thông tư 80/2025/TT-BTC');
  });

  it('RD-05-03 removed threshold in backward diff is identical to added in forward diff', () => {
    const added   = forward().addedThresholds[0]!;
    const removed = backward().removedThresholds[0]!;
    expect(removed.code).toBe(added.code);
    expect(removed.value).toBe(added.value);
  });
});

// ─── RD-06: Procurement band changes ─────────────────────────────────────────

describe('RD-06: Procurement band diff is zero between versions', () => {
  it('RD-06-01 no bands added in 2025 → 2026', () => {
    expect(forward().addedProcurementBands).toHaveLength(0);
  });

  it('RD-06-02 no bands removed in 2025 → 2026', () => {
    expect(forward().removedProcurementBands).toHaveLength(0);
  });

  it('RD-06-03 no bands changed in 2025 → 2026', () => {
    expect(forward().changedProcurementBands).toHaveLength(0);
  });
});

// ─── RD-07: Contract type changes ────────────────────────────────────────────

describe('RD-07: Contract type diff is zero between versions', () => {
  it('RD-07-01 no contract types added in 2025 → 2026', () => {
    expect(forward().addedContractTypes).toHaveLength(0);
  });

  it('RD-07-02 no contract types removed in 2025 → 2026', () => {
    expect(forward().removedContractTypes).toHaveLength(0);
  });

  it('RD-07-03 no contract types changed in 2025 → 2026', () => {
    expect(forward().changedContractTypes).toHaveLength(0);
  });
});

// ─── RD-08: Fund source changes ───────────────────────────────────────────────

describe('RD-08: Fund source diff is zero between versions', () => {
  it('RD-08-01 no fund sources added in 2025 → 2026', () => {
    expect(forward().addedFundSources).toHaveLength(0);
  });

  it('RD-08-02 no fund sources removed in 2025 → 2026', () => {
    expect(forward().removedFundSources).toHaveLength(0);
  });

  it('RD-08-03 no fund sources changed in 2025 → 2026', () => {
    expect(forward().changedFundSources).toHaveLength(0);
  });
});

// ─── RD-09: Risk threshold changes ───────────────────────────────────────────

describe('RD-09: Risk threshold diff is zero between versions', () => {
  it('RD-09-01 no risk thresholds added in 2025 → 2026', () => {
    expect(forward().addedRiskThresholds).toHaveLength(0);
  });

  it('RD-09-02 no risk thresholds removed in 2025 → 2026', () => {
    expect(forward().removedRiskThresholds).toHaveLength(0);
  });

  it('RD-09-03 no risk thresholds changed in 2025 → 2026', () => {
    expect(forward().changedRiskThresholds).toHaveLength(0);
  });
});

// ─── RD-10: Deterministic output ─────────────────────────────────────────────

describe('RD-10: Deterministic / idempotent output', () => {
  it('RD-10-01 two identical calls produce the same addedThresholds length', () => {
    expect(forward().addedThresholds.length).toBe(forward().addedThresholds.length);
  });

  it('RD-10-02 forward.added.length + backward.removed.length consistent', () => {
    // Threshold added in one direction = threshold removed in the other
    expect(forward().addedThresholds.length).toBe(backward().removedThresholds.length);
    expect(backward().addedThresholds.length).toBe(forward().removedThresholds.length);
  });

  it('RD-10-03 same-date diff is stable across repeated calls', () => {
    const a = same26().addedThresholds.length;
    const b = same26().addedThresholds.length;
    expect(a).toBe(b);
    expect(a).toBe(0);
  });
});

// ─── RD-11: Backward compatibility ───────────────────────────────────────────
// Dates that trigger the oldest-version fallback in effectiveDateEngine should
// still diff correctly: comparing a pre-history date with the oldest version
// should produce a zero diff (same data on both sides via fallback).

describe('RD-11: Backward compatibility / fallback dates', () => {
  it('RD-11-01 pre-history date vs oldest snapshot produces a zero diff', () => {
    // '2020-01-01' → fallback to 2025-07-01 via effectiveDateEngine
    // '2025-07-01' → exact 2025-07-01 snapshot
    // both sides resolve to the same data → diff should be zero
    const diff = compareSnapshots('2020-01-01', '2025-07-01');
    expect(diff.addedThresholds).toHaveLength(0);
    expect(diff.removedThresholds).toHaveLength(0);
  });

  it('RD-11-02 oldDate and newDate fields are the original query dates (not resolved dates)', () => {
    const diff = compareSnapshots('2020-01-01', '2099-12-31');
    expect(diff.oldDate).toBe('2020-01-01');
    expect(diff.newDate).toBe('2099-12-31');
  });

  it('RD-11-03 pre-history vs 2026-01-01 diff shows the threshold added in 2026', () => {
    // pre-history → fallback to 2025-07-01 (5 thresholds)
    // 2026-01-01  → 6 thresholds
    const diff = compareSnapshots('2020-01-01', '2026-01-01');
    expect(diff.addedThresholds).toHaveLength(1);
    expect(diff.addedThresholds[0]!.code).toBe('E_PROCUREMENT_MANDATORY_THRESHOLD');
  });
});
