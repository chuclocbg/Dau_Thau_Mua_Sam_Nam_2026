/**
 * Legal v4.6 — Migration Engine Tests
 *
 * MG-01..MG-11: 11 groups × 3 tests = 33 tests
 *
 * Note: placed in src/__tests__/ (not src/tests/) — vitest include pattern is
 * src/__tests__/**\/*.test.{ts,tsx}.
 *
 * Data facts (from versioned JSON snapshots):
 *   forward  2025-07-01 → 2026-01-01: 1 threshold ADDED
 *   backward 2026-01-01 → 2025-07-01: 1 threshold REMOVED
 *   same     2025-07-01 → 2025-07-01: no changes
 *
 * MEDIUM/CRITICAL scenarios and non-threshold categories cannot be produced
 * from real snapshot data.  Those groups call generateActions() and
 * computeRequiresHumanReview() directly with synthetic SnapshotDiff objects.
 *
 * Groups:
 *   MG-01 No changes           — same date: empty actions, no human review
 *   MG-02 Threshold changes    — forward: UPDATE_DECISION_LOGIC for thresholds
 *   MG-03 Procurement band     — synthetic: UPDATE_TEMPLATE for procurementBands
 *   MG-04 Contract type        — synthetic: UPDATE_TEMPLATE for contractTypes
 *   MG-05 Fund source          — synthetic: UPDATE_TEMPLATE for fundSources
 *   MG-06 Risk threshold       — synthetic: UPDATE_RISK_RULES for riskThresholds
 *   MG-07 Removed entries      — backward: REVIEW_MANUALLY added alongside primary
 *   MG-08 Critical impact      — synthetic: CRITICAL triggers requiresHumanReview
 *   MG-09 requiresHumanReview  — all triggering conditions verified
 *   MG-10 Deterministic output — repeated calls produce identical results
 *   MG-11 Backward compatibility — pre-history fallback dates handled correctly
 */

import { describe, it, expect } from 'vitest';
import {
  buildMigrationPlan,
  generateActions,
  computeRequiresHumanReview,
} from '../ai/migrationEngine';
import type { SnapshotDiff } from '../ai/regulationDiffEngine';
import type {
  RiskThreshold,
  ProcurementBand,
  ContractTypeReg,
  FundSourceReg,
} from '../ai/regulationLoader';

// ─── Convenience wrappers ─────────────────────────────────────────────────────

const same25   = () => buildMigrationPlan('2025-07-01', '2025-07-01');
const forward  = () => buildMigrationPlan('2025-07-01', '2026-01-01');
const backward = () => buildMigrationPlan('2026-01-01', '2025-07-01');

// ─── Synthetic diff helpers ───────────────────────────────────────────────────

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

const fakeContractType: ContractTypeReg = {
  contractType: 'tron-goi',
  maxDurationDays: 365,
  mandatoryClauses: [],
  compatibleMethods: ['chi-dinh-thau'],
  source: 'test',
};

const fakeFundSource: FundSourceReg = {
  fundSource: 'von-tu-co',
  mandatoryClauses: [],
  source: 'test',
};

// ─── MG-01: No changes ────────────────────────────────────────────────────────

describe('MG-01: No changes — same date produces empty plan', () => {
  it('MG-01-01 actions array is empty', () => {
    expect(same25().actions).toHaveLength(0);
  });

  it('MG-01-02 requiresHumanReview is false', () => {
    expect(same25().requiresHumanReview).toBe(false);
  });

  it('MG-01-03 impactLevel is LOW', () => {
    expect(same25().impactLevel).toBe('LOW');
  });
});

// ─── MG-02: Threshold changes ─────────────────────────────────────────────────

describe('MG-02: Threshold changes (2025 → 2026, 1 threshold added)', () => {
  it('MG-02-01 actions contains UPDATE_DECISION_LOGIC for thresholds', () => {
    const actions = forward().actions;
    expect(actions.some(a => a.area === 'thresholds' && a.action === 'UPDATE_DECISION_LOGIC')).toBe(true);
  });

  it('MG-02-02 exactly 1 action (added entry, not removed → no REVIEW_MANUALLY)', () => {
    expect(forward().actions).toHaveLength(1);
  });

  it('MG-02-03 action area is thresholds', () => {
    expect(forward().actions[0]!.area).toBe('thresholds');
  });
});

// ─── MG-03: Procurement band changes ─────────────────────────────────────────

describe('MG-03: Procurement band changes (synthetic diff)', () => {
  it('MG-03-01 added band → UPDATE_TEMPLATE action for procurementBands', () => {
    const diff = { ...blankDiff(), addedProcurementBands: [fakeBand] };
    const actions = generateActions(diff);
    expect(actions.some(a => a.area === 'procurementBands' && a.action === 'UPDATE_TEMPLATE')).toBe(true);
  });

  it('MG-03-02 action.area is procurementBands', () => {
    const diff = { ...blankDiff(), addedProcurementBands: [fakeBand] };
    expect(generateActions(diff)[0]!.area).toBe('procurementBands');
  });

  it('MG-03-03 no REVIEW_MANUALLY when only added (not removed)', () => {
    const diff = { ...blankDiff(), addedProcurementBands: [fakeBand] };
    const actions = generateActions(diff);
    expect(actions.some(a => a.action === 'REVIEW_MANUALLY')).toBe(false);
  });
});

// ─── MG-04: Contract type changes ────────────────────────────────────────────

describe('MG-04: Contract type changes (synthetic diff)', () => {
  it('MG-04-01 added contract type → UPDATE_TEMPLATE for contractTypes', () => {
    const diff = { ...blankDiff(), addedContractTypes: [fakeContractType] };
    const actions = generateActions(diff);
    expect(actions.some(a => a.area === 'contractTypes' && a.action === 'UPDATE_TEMPLATE')).toBe(true);
  });

  it('MG-04-02 action.area is contractTypes', () => {
    const diff = { ...blankDiff(), addedContractTypes: [fakeContractType] };
    expect(generateActions(diff)[0]!.area).toBe('contractTypes');
  });

  it('MG-04-03 no REVIEW_MANUALLY when only added (not removed)', () => {
    const diff = { ...blankDiff(), addedContractTypes: [fakeContractType] };
    expect(generateActions(diff).some(a => a.action === 'REVIEW_MANUALLY')).toBe(false);
  });
});

// ─── MG-05: Fund source changes ───────────────────────────────────────────────

describe('MG-05: Fund source changes (synthetic diff)', () => {
  it('MG-05-01 added fund source → UPDATE_TEMPLATE for fundSources', () => {
    const diff = { ...blankDiff(), addedFundSources: [fakeFundSource] };
    const actions = generateActions(diff);
    expect(actions.some(a => a.area === 'fundSources' && a.action === 'UPDATE_TEMPLATE')).toBe(true);
  });

  it('MG-05-02 action.area is fundSources', () => {
    const diff = { ...blankDiff(), addedFundSources: [fakeFundSource] };
    expect(generateActions(diff)[0]!.area).toBe('fundSources');
  });

  it('MG-05-03 no REVIEW_MANUALLY when only added (not removed)', () => {
    const diff = { ...blankDiff(), addedFundSources: [fakeFundSource] };
    expect(generateActions(diff).some(a => a.action === 'REVIEW_MANUALLY')).toBe(false);
  });
});

// ─── MG-06: Risk threshold changes ───────────────────────────────────────────

describe('MG-06: Risk threshold changes (synthetic diff)', () => {
  it('MG-06-01 changed risk threshold → UPDATE_RISK_RULES for riskThresholds', () => {
    const diff = { ...blankDiff(), changedRiskThresholds: [{ old: fakeRT1, new: fakeRT2 }] };
    const actions = generateActions(diff);
    expect(actions.some(a => a.area === 'riskThresholds' && a.action === 'UPDATE_RISK_RULES')).toBe(true);
  });

  it('MG-06-02 action.area is riskThresholds', () => {
    const diff = { ...blankDiff(), changedRiskThresholds: [{ old: fakeRT1, new: fakeRT2 }] };
    expect(generateActions(diff)[0]!.area).toBe('riskThresholds');
  });

  it('MG-06-03 no REVIEW_MANUALLY for changed entries (only removed entries trigger it)', () => {
    const diff = { ...blankDiff(), changedRiskThresholds: [{ old: fakeRT1, new: fakeRT2 }] };
    expect(generateActions(diff).some(a => a.action === 'REVIEW_MANUALLY')).toBe(false);
  });
});

// ─── MG-07: Removed entries ───────────────────────────────────────────────────

describe('MG-07: Removed entries (2026 → 2025, 1 threshold removed)', () => {
  it('MG-07-01 REVIEW_MANUALLY action is present', () => {
    const actions = backward().actions;
    expect(actions.some(a => a.action === 'REVIEW_MANUALLY')).toBe(true);
  });

  it('MG-07-02 two actions for thresholds: UPDATE_DECISION_LOGIC + REVIEW_MANUALLY', () => {
    const actions = backward().actions;
    const forThresholds = actions.filter(a => a.area === 'thresholds');
    expect(forThresholds).toHaveLength(2);
    expect(forThresholds.some(a => a.action === 'UPDATE_DECISION_LOGIC')).toBe(true);
    expect(forThresholds.some(a => a.action === 'REVIEW_MANUALLY')).toBe(true);
  });

  it('MG-07-03 requiresHumanReview is true when removed entries exist', () => {
    expect(backward().requiresHumanReview).toBe(true);
  });
});

// ─── MG-08: Critical impact ───────────────────────────────────────────────────

describe('MG-08: Critical impact level triggers human review', () => {
  it('MG-08-01 computeRequiresHumanReview with CRITICAL and empty actions → true', () => {
    expect(computeRequiresHumanReview('CRITICAL', [])).toBe(true);
  });

  it('MG-08-02 synthetic diff with changedRiskThresholds → UPDATE_RISK_RULES action', () => {
    const diff = { ...blankDiff(), changedRiskThresholds: [{ old: fakeRT1, new: fakeRT2 }] };
    const actions = generateActions(diff);
    expect(actions.some(a => a.action === 'UPDATE_RISK_RULES')).toBe(true);
  });

  it('MG-08-03 CRITICAL + REVIEW_MANUALLY together → requiresHumanReview true', () => {
    const fakeAction = { area: 'thresholds' as const, action: 'REVIEW_MANUALLY' as const, reason: 'test' };
    expect(computeRequiresHumanReview('CRITICAL', [fakeAction])).toBe(true);
  });
});

// ─── MG-09: requiresHumanReview ──────────────────────────────────────────────

describe('MG-09: requiresHumanReview conditions', () => {
  it('MG-09-01 false when no changes and impactLevel is LOW', () => {
    expect(same25().requiresHumanReview).toBe(false);
  });

  it('MG-09-02 true when threshold removed (backward diff)', () => {
    expect(backward().requiresHumanReview).toBe(true);
  });

  it('MG-09-03 computeRequiresHumanReview LOW with no REVIEW_MANUALLY actions → false', () => {
    const actions = [{ area: 'thresholds' as const, action: 'UPDATE_DECISION_LOGIC' as const, reason: 'test' }];
    expect(computeRequiresHumanReview('LOW', actions)).toBe(false);
  });
});

// ─── MG-10: Deterministic output ─────────────────────────────────────────────

describe('MG-10: Deterministic / idempotent output', () => {
  it('MG-10-01 forward called twice → same actions.length', () => {
    expect(forward().actions.length).toBe(forward().actions.length);
  });

  it('MG-10-02 forward called twice → same requiresHumanReview', () => {
    expect(forward().requiresHumanReview).toBe(forward().requiresHumanReview);
  });

  it('MG-10-03 same-date called twice → same impactLevel', () => {
    expect(same25().impactLevel).toBe(same25().impactLevel);
  });
});

// ─── MG-11: Backward compatibility ───────────────────────────────────────────

describe('MG-11: Backward compatibility / fallback dates', () => {
  it('MG-11-01 pre-history date does not throw and returns a valid plan', () => {
    const plan = buildMigrationPlan('2020-01-01', '2025-07-01');
    expect(plan).toHaveProperty('actions');
    expect(plan).toHaveProperty('requiresHumanReview');
  });

  it('MG-11-02 pre-history vs 2026-01-01 → impactLevel HIGH, requiresHumanReview false (added, not removed)', () => {
    const plan = buildMigrationPlan('2020-01-01', '2026-01-01');
    expect(plan.impactLevel).toBe('HIGH');
    expect(plan.requiresHumanReview).toBe(false);
  });

  it('MG-11-03 oldDate and newDate in plan match original inputs', () => {
    const plan = buildMigrationPlan('2020-01-01', '2099-12-31');
    expect(plan.oldDate).toBe('2020-01-01');
    expect(plan.newDate).toBe('2099-12-31');
  });
});
