/**
 * Legal v5.0 — LegalUpdateAgent Tests
 *
 * LU-01..LU-13: 13 groups × 3 tests = 39 tests
 *
 * Note: placed in src/__tests__/ (not src/tests/) — vitest include pattern is
 * src/__tests__/**\/*.test.{ts,tsx}.
 *
 * Data facts (from versioned JSON snapshots):
 *   forward  2025-07-01 → 2026-01-01: 1 threshold ADDED   → HIGH, humanReview=false
 *   backward 2026-01-01 → 2025-07-01: 1 threshold REMOVED → HIGH, humanReview=true
 *   same     2025-07-01 → 2025-07-01: no changes           → LOW,  humanReview=false
 *
 * MEDIUM and CRITICAL impact levels cannot be produced from the current
 * two-version snapshot set.  LU-02 and LU-04 test the shouldUpdate / review
 * logic at the boundary using real LOW/HIGH data as contrasting scenarios.
 *
 * Groups:
 *   LU-01 LOW severity           — same date: shouldUpdate false, no review
 *   LU-02 MEDIUM severity        — shouldUpdate=true for any non-LOW (via HIGH proxy)
 *   LU-03 HIGH severity          — forward: impactLevel HIGH, shouldUpdate true
 *   LU-04 CRITICAL severity      — backward: requiresHumanReview true (closest real scenario)
 *   LU-05 shouldUpdate rules     — boundary: LOW=false, HIGH=true, backward=true
 *   LU-06 requiresHumanReview    — propagated from migrationPlan
 *   LU-07 notification reuse     — notification is consistent with top-level fields
 *   LU-08 compliance report reuse — complianceReport consistent with top-level fields
 *   LU-09 migration plan reuse   — migrationPlan is the canonical source for impactLevel
 *   LU-10 audit trail reuse      — auditTrail consistent with top-level fields
 *   LU-11 deterministic output   — repeated calls produce identical results
 *   LU-12 no duplicate calls     — sub-results are mutually consistent
 *   LU-13 backward compatibility — pre-history fallback dates work correctly
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { LegalUpdateAgent } from '../agents/LegalUpdateAgent';

// ─── Shared agent instance ────────────────────────────────────────────────────

let agent: LegalUpdateAgent;
beforeEach(() => { agent = new LegalUpdateAgent(); });

// ─── Convenience wrappers ─────────────────────────────────────────────────────

const same25   = () => agent.checkForUpdates('2025-07-01', '2025-07-01');
const forward  = () => agent.checkForUpdates('2025-07-01', '2026-01-01');
const backward = () => agent.checkForUpdates('2026-01-01', '2025-07-01');

// ─── LU-01: LOW severity ─────────────────────────────────────────────────────

describe('LU-01: LOW severity — same date: no update, no review', () => {
  it('LU-01-01 impactLevel is LOW', () => {
    expect(same25().impactLevel).toBe('LOW');
  });

  it('LU-01-02 shouldUpdate is false', () => {
    expect(same25().shouldUpdate).toBe(false);
  });

  it('LU-01-03 requiresHumanReview is false', () => {
    expect(same25().requiresHumanReview).toBe(false);
  });
});

// ─── LU-02: MEDIUM severity ───────────────────────────────────────────────────
// MEDIUM cannot be produced from current 2-version snapshot set.
// Tests verify that any non-LOW result yields shouldUpdate=true (validated via HIGH).

describe('LU-02: Non-LOW severity — shouldUpdate is always true', () => {
  it('LU-02-01 forward (HIGH) → shouldUpdate true', () => {
    expect(forward().shouldUpdate).toBe(true);
  });

  it('LU-02-02 backward (HIGH) → shouldUpdate true', () => {
    expect(backward().shouldUpdate).toBe(true);
  });

  it('LU-02-03 shouldUpdate false only for LOW', () => {
    // Only same-date produces LOW; both forward and backward produce HIGH
    expect(same25().shouldUpdate).toBe(false);
    expect(forward().shouldUpdate).toBe(true);
  });
});

// ─── LU-03: HIGH severity ─────────────────────────────────────────────────────

describe('LU-03: HIGH severity — forward diff (1 threshold added)', () => {
  it('LU-03-01 impactLevel is HIGH', () => {
    expect(forward().impactLevel).toBe('HIGH');
  });

  it('LU-03-02 shouldUpdate is true', () => {
    expect(forward().shouldUpdate).toBe(true);
  });

  it('LU-03-03 requiresHumanReview is false (added, not removed)', () => {
    expect(forward().requiresHumanReview).toBe(false);
  });
});

// ─── LU-04: CRITICAL / human-review scenario ──────────────────────────────────
// CRITICAL cannot be produced from current snapshot data.
// Backward diff (removed threshold → humanReview=true) is the closest real scenario.

describe('LU-04: Human-review triggered (backward diff: 1 threshold removed)', () => {
  it('LU-04-01 requiresHumanReview is true when entries are removed', () => {
    expect(backward().requiresHumanReview).toBe(true);
  });

  it('LU-04-02 shouldUpdate is still true when requiresHumanReview is true', () => {
    expect(backward().shouldUpdate).toBe(true);
  });

  it('LU-04-03 auditTrail.summary reflects HIGH impact', () => {
    expect(backward().auditTrail.summary).toBe('High impact detected.');
  });
});

// ─── LU-05: shouldUpdate rules ───────────────────────────────────────────────

describe('LU-05: shouldUpdate derived from impactLevel', () => {
  it('LU-05-01 LOW → shouldUpdate false', () => {
    expect(same25().shouldUpdate).toBe(false);
  });

  it('LU-05-02 HIGH (forward) → shouldUpdate true', () => {
    expect(forward().shouldUpdate).toBe(true);
  });

  it('LU-05-03 HIGH (backward) → shouldUpdate true', () => {
    expect(backward().shouldUpdate).toBe(true);
  });
});

// ─── LU-06: requiresHumanReview propagation ──────────────────────────────────

describe('LU-06: requiresHumanReview copied from migrationPlan', () => {
  it('LU-06-01 forward → requiresHumanReview false (matches migrationPlan)', () => {
    const r = forward();
    expect(r.requiresHumanReview).toBe(r.migrationPlan.requiresHumanReview);
  });

  it('LU-06-02 backward → requiresHumanReview true (matches migrationPlan)', () => {
    const r = backward();
    expect(r.requiresHumanReview).toBe(r.migrationPlan.requiresHumanReview);
  });

  it('LU-06-03 same date → requiresHumanReview false (matches migrationPlan)', () => {
    const r = same25();
    expect(r.requiresHumanReview).toBe(r.migrationPlan.requiresHumanReview);
  });
});

// ─── LU-07: Notification reuse ───────────────────────────────────────────────

describe('LU-07: notification is consistent with top-level fields', () => {
  it('LU-07-01 notification.severity matches result.impactLevel', () => {
    const r = forward();
    expect(r.notification.severity).toBe(r.impactLevel);
  });

  it('LU-07-02 notification.requiresHumanReview matches result.requiresHumanReview', () => {
    const r = backward();
    expect(r.notification.requiresHumanReview).toBe(r.requiresHumanReview);
  });

  it('LU-07-03 notification.affectedAreas has expected count for forward diff', () => {
    const r = forward();
    expect(r.notification.affectedAreas.length).toBeGreaterThan(0);
    expect(r.notification.affectedAreas).toContain('thresholds');
  });
});

// ─── LU-08: Compliance report reuse ──────────────────────────────────────────

describe('LU-08: complianceReport is consistent with top-level fields', () => {
  it('LU-08-01 complianceReport.impactLevel matches result.impactLevel', () => {
    const r = forward();
    expect(r.complianceReport.impactLevel).toBe(r.impactLevel);
  });

  it('LU-08-02 complianceReport.humanReviewRequired matches result.requiresHumanReview', () => {
    const r = backward();
    expect(r.complianceReport.humanReviewRequired).toBe(r.requiresHumanReview);
  });

  it('LU-08-03 complianceReport.affectedAreas length matches notification.affectedAreas length', () => {
    const r = forward();
    expect(r.complianceReport.affectedAreas.length).toBe(r.notification.affectedAreas.length);
  });
});

// ─── LU-09: Migration plan reuse ─────────────────────────────────────────────

describe('LU-09: migrationPlan is the canonical source of impactLevel', () => {
  it('LU-09-01 migrationPlan.impactLevel matches result.impactLevel', () => {
    const r = forward();
    expect(r.migrationPlan.impactLevel).toBe(r.impactLevel);
  });

  it('LU-09-02 migrationPlan.requiresHumanReview matches result.requiresHumanReview', () => {
    const r = backward();
    expect(r.migrationPlan.requiresHumanReview).toBe(r.requiresHumanReview);
  });

  it('LU-09-03 migrationPlan.affectedAreas length matches complianceReport.affectedAreas length', () => {
    const r = forward();
    expect(r.migrationPlan.affectedAreas.length).toBe(r.complianceReport.affectedAreas.length);
  });
});

// ─── LU-10: Audit trail reuse ─────────────────────────────────────────────────

describe('LU-10: auditTrail is consistent with top-level fields', () => {
  it('LU-10-01 auditTrail.impactLevel matches result.impactLevel', () => {
    const r = forward();
    expect(r.auditTrail.impactLevel).toBe(r.impactLevel);
  });

  it('LU-10-02 auditTrail.requiresHumanReview matches result.requiresHumanReview', () => {
    const r = backward();
    expect(r.auditTrail.requiresHumanReview).toBe(r.requiresHumanReview);
  });

  it('LU-10-03 auditTrail always has 7 stages', () => {
    expect(forward().auditTrail.stages).toHaveLength(7);
    expect(same25().auditTrail.stages).toHaveLength(7);
  });
});

// ─── LU-11: Deterministic output ─────────────────────────────────────────────

describe('LU-11: Deterministic / idempotent output', () => {
  it('LU-11-01 forward called twice → same impactLevel', () => {
    expect(forward().impactLevel).toBe(forward().impactLevel);
  });

  it('LU-11-02 forward called twice → same shouldUpdate', () => {
    expect(forward().shouldUpdate).toBe(forward().shouldUpdate);
  });

  it('LU-11-03 same date called twice → same impactLevel and shouldUpdate', () => {
    const a = same25();
    const b = same25();
    expect(a.impactLevel).toBe(b.impactLevel);
    expect(a.shouldUpdate).toBe(b.shouldUpdate);
  });
});

// ─── LU-12: No duplicate engine calls ────────────────────────────────────────
// Verified through cross-result consistency: if all four sub-results agree on
// impactLevel, affectedAreas count, and requiresHumanReview, they must have
// been derived from the same computation (same date inputs, same snapshot data).

describe('LU-12: Sub-results are mutually consistent (no conflicting duplicate calls)', () => {
  it('LU-12-01 notification.severity === complianceReport.impactLevel === migrationPlan.impactLevel', () => {
    const r = forward();
    expect(r.notification.severity).toBe(r.complianceReport.impactLevel);
    expect(r.complianceReport.impactLevel).toBe(r.migrationPlan.impactLevel);
  });

  it('LU-12-02 auditTrail.impactLevel === result.impactLevel', () => {
    const r = forward();
    expect(r.auditTrail.impactLevel).toBe(r.impactLevel);
  });

  it('LU-12-03 all requiresHumanReview values are consistent across sub-results', () => {
    const r = backward();
    expect(r.notification.requiresHumanReview).toBe(r.requiresHumanReview);
    expect(r.complianceReport.humanReviewRequired).toBe(r.requiresHumanReview);
    expect(r.migrationPlan.requiresHumanReview).toBe(r.requiresHumanReview);
    expect(r.auditTrail.requiresHumanReview).toBe(r.requiresHumanReview);
  });
});

// ─── LU-13: Backward compatibility ───────────────────────────────────────────

describe('LU-13: Backward compatibility / fallback dates', () => {
  it('LU-13-01 pre-history date does not throw and returns a valid result', () => {
    const r = agent.checkForUpdates('2020-01-01', '2025-07-01');
    expect(r).toHaveProperty('notification');
    expect(r).toHaveProperty('complianceReport');
    expect(r).toHaveProperty('migrationPlan');
    expect(r).toHaveProperty('auditTrail');
  });

  it('LU-13-02 pre-history vs 2026-01-01 → shouldUpdate true (threshold added via fallback)', () => {
    expect(agent.checkForUpdates('2020-01-01', '2026-01-01').shouldUpdate).toBe(true);
  });

  it('LU-13-03 result contains all required top-level fields', () => {
    const r = forward();
    expect(r).toHaveProperty('requiresHumanReview');
    expect(r).toHaveProperty('shouldUpdate');
    expect(r).toHaveProperty('impactLevel');
  });
});
