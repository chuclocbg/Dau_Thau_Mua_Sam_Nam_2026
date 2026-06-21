/**
 * Legal v5.1 — ChangeImpactAgent Tests
 *
 * CI-01..CI-13: 13 groups × 3 tests = 39 tests
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
 * two-version snapshot set.  CI-02 and CI-04 use mapImpact() directly with
 * synthetic pipeline results to verify those code paths.
 *
 * Groups:
 *   CI-01 LOW impact             — same date: all arrays empty, shouldUpdate false
 *   CI-02 MEDIUM impact          — synthetic: impactLevel MEDIUM, shouldUpdate true
 *   CI-03 HIGH impact            — forward: impactLevel HIGH, affectedDecisionLogic set
 *   CI-04 CRITICAL impact        — synthetic: impactLevel CRITICAL, requiresHumanReview
 *   CI-05 Template mapping       — synthetic UPDATE_TEMPLATE → affectedTemplates
 *   CI-06 Decision-logic mapping — forward UPDATE_DECISION_LOGIC → affectedDecisionLogic
 *   CI-07 Risk mapping           — synthetic UPDATE_RISK_RULES → affectedRiskRules
 *   CI-08 Manual review action   — backward: REVIEW_MANUALLY in actionPlan
 *   CI-09 Deduplication          — duplicate area appears once per output array
 *   CI-10 Deterministic order    — repeated calls produce identical output
 *   CI-11 LegalUpdateAgent reuse — checkForUpdates called exactly once per analyzeImpact
 *   CI-12 No direct engine calls — output consistent with LegalUpdateAgent result
 *   CI-13 Backward compatibility — pre-history fallback dates work correctly
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChangeImpactAgent, mapImpact } from '../agents/ChangeImpactAgent';
import { LegalUpdateAgent } from '../agents/LegalUpdateAgent';
import type { AffectedArea, ImpactLevel } from '../ai/updatePackageEngine';
import type { Action } from '../ai/migrationEngine';

// ─── Real-data helpers ────────────────────────────────────────────────────────

let agent: ChangeImpactAgent;

const same25   = () => agent.analyzeImpact('2025-07-01', '2025-07-01');
const forward  = () => agent.analyzeImpact('2025-07-01', '2026-01-01');
const backward = () => agent.analyzeImpact('2026-01-01', '2025-07-01');

// Recreate before each test group so agents don't share state between CI-11 spy tests
beforeEach(() => { agent = new ChangeImpactAgent(); });

// ─── Synthetic-data helpers ───────────────────────────────────────────────────

function synResult(
  actions: readonly Action[],
  affectedAreas: readonly AffectedArea[],
  impactLevel: ImpactLevel,
  requiresHumanReview = false,
) {
  return {
    impactLevel,
    shouldUpdate:        impactLevel !== 'LOW',
    requiresHumanReview,
    migrationPlan: { affectedAreas, actions },
  };
}

const templateAction = (area: AffectedArea): Action =>
  ({ area, action: 'UPDATE_TEMPLATE',       reason: `${area} changed` });
const riskAction     = (area: AffectedArea): Action =>
  ({ area, action: 'UPDATE_RISK_RULES',     reason: `${area} changed` });
const decisionAction = (area: AffectedArea): Action =>
  ({ area, action: 'UPDATE_DECISION_LOGIC', reason: `${area} changed` });
const reviewAction   = (area: AffectedArea): Action =>
  ({ area, action: 'REVIEW_MANUALLY',       reason: `${area} removed entries` });

// ─── CI-01: LOW impact ────────────────────────────────────────────────────────

describe('CI-01: LOW impact — same date: all arrays empty', () => {
  it('CI-01-01 impactLevel is LOW', () => {
    expect(same25().impactLevel).toBe('LOW');
  });

  it('CI-01-02 affectedTemplates is empty', () => {
    expect(same25().affectedTemplates).toHaveLength(0);
  });

  it('CI-01-03 affectedDecisionLogic and affectedRiskRules are empty', () => {
    const r = same25();
    expect(r.affectedDecisionLogic).toHaveLength(0);
    expect(r.affectedRiskRules).toHaveLength(0);
  });
});

// ─── CI-02: MEDIUM impact (synthetic) ────────────────────────────────────────

describe('CI-02: MEDIUM impact — synthetic mapImpact', () => {
  const medSyn = synResult(
    [templateAction('contractTypes')],
    ['contractTypes'],
    'MEDIUM',
  );

  it('CI-02-01 impactLevel is MEDIUM', () => {
    expect(mapImpact(medSyn).impactLevel).toBe('MEDIUM');
  });

  it('CI-02-02 shouldUpdate is true', () => {
    expect(mapImpact(medSyn).shouldUpdate).toBe(true);
  });

  it('CI-02-03 affectedTemplates contains the mapped area', () => {
    expect(mapImpact(medSyn).affectedTemplates).toContain('contractTypes');
  });
});

// ─── CI-03: HIGH impact ───────────────────────────────────────────────────────

describe('CI-03: HIGH impact — forward diff (1 threshold added)', () => {
  it('CI-03-01 impactLevel is HIGH', () => {
    expect(forward().impactLevel).toBe('HIGH');
  });

  it('CI-03-02 shouldUpdate is true', () => {
    expect(forward().shouldUpdate).toBe(true);
  });

  it('CI-03-03 affectedDecisionLogic contains thresholds', () => {
    expect(forward().affectedDecisionLogic).toContain('thresholds');
  });
});

// ─── CI-04: CRITICAL impact (synthetic) ──────────────────────────────────────

describe('CI-04: CRITICAL impact — synthetic mapImpact', () => {
  const critSyn = synResult(
    [riskAction('riskThresholds'), reviewAction('riskThresholds')],
    ['riskThresholds'],
    'CRITICAL',
    true,
  );

  it('CI-04-01 impactLevel is CRITICAL', () => {
    expect(mapImpact(critSyn).impactLevel).toBe('CRITICAL');
  });

  it('CI-04-02 shouldUpdate is true', () => {
    expect(mapImpact(critSyn).shouldUpdate).toBe(true);
  });

  it('CI-04-03 requiresHumanReview is true', () => {
    expect(mapImpact(critSyn).requiresHumanReview).toBe(true);
  });
});

// ─── CI-05: Template mapping (synthetic) ──────────────────────────────────────

describe('CI-05: UPDATE_TEMPLATE → affectedTemplates', () => {
  it('CI-05-01 procurementBands', () => {
    const r = mapImpact(synResult([templateAction('procurementBands')], ['procurementBands'], 'MEDIUM'));
    expect(r.affectedTemplates).toContain('procurementBands');
  });

  it('CI-05-02 contractTypes', () => {
    const r = mapImpact(synResult([templateAction('contractTypes')], ['contractTypes'], 'MEDIUM'));
    expect(r.affectedTemplates).toContain('contractTypes');
  });

  it('CI-05-03 fundSources', () => {
    const r = mapImpact(synResult([templateAction('fundSources')], ['fundSources'], 'MEDIUM'));
    expect(r.affectedTemplates).toContain('fundSources');
  });
});

// ─── CI-06: Decision-logic mapping ───────────────────────────────────────────

describe('CI-06: UPDATE_DECISION_LOGIC → affectedDecisionLogic', () => {
  it('CI-06-01 forward → affectedDecisionLogic contains thresholds', () => {
    expect(forward().affectedDecisionLogic).toContain('thresholds');
  });

  it('CI-06-02 forward → affectedDecisionLogic.length === 1', () => {
    expect(forward().affectedDecisionLogic).toHaveLength(1);
  });

  it('CI-06-03 synthetic UPDATE_DECISION_LOGIC → affectedDecisionLogic contains the area', () => {
    const r = mapImpact(synResult([decisionAction('thresholds')], ['thresholds'], 'HIGH'));
    expect(r.affectedDecisionLogic).toContain('thresholds');
  });
});

// ─── CI-07: Risk mapping (synthetic) ─────────────────────────────────────────

describe('CI-07: UPDATE_RISK_RULES → affectedRiskRules', () => {
  it('CI-07-01 UPDATE_RISK_RULES for riskThresholds → affectedRiskRules contains it', () => {
    const r = mapImpact(synResult([riskAction('riskThresholds')], ['riskThresholds'], 'CRITICAL'));
    expect(r.affectedRiskRules).toContain('riskThresholds');
  });

  it('CI-07-02 affectedRiskRules.length === 1', () => {
    const r = mapImpact(synResult([riskAction('riskThresholds')], ['riskThresholds'], 'CRITICAL'));
    expect(r.affectedRiskRules).toHaveLength(1);
  });

  it('CI-07-03 affectedTemplates is empty when only UPDATE_RISK_RULES', () => {
    const r = mapImpact(synResult([riskAction('riskThresholds')], ['riskThresholds'], 'CRITICAL'));
    expect(r.affectedTemplates).toHaveLength(0);
  });
});

// ─── CI-08: Manual review action (backward diff) ─────────────────────────────

describe('CI-08: REVIEW_MANUALLY → actionPlan only (backward diff)', () => {
  it('CI-08-01 backward → actionPlan is non-empty', () => {
    expect(backward().actionPlan.length).toBeGreaterThan(0);
  });

  it('CI-08-02 backward → actionPlan contains a REVIEW_MANUALLY entry', () => {
    expect(backward().actionPlan.some(p => p.action === 'REVIEW_MANUALLY')).toBe(true);
  });

  it('CI-08-03 backward → the REVIEW_MANUALLY entry has category thresholds', () => {
    const manualItem = backward().actionPlan.find(p => p.action === 'REVIEW_MANUALLY');
    expect(manualItem?.category).toBe('thresholds');
  });
});

// ─── CI-09: Deduplication ────────────────────────────────────────────────────

describe('CI-09: Duplicate area appears only once in output arrays', () => {
  it('CI-09-01 two UPDATE_TEMPLATE for same area → affectedTemplates.length === 1', () => {
    const r = mapImpact(synResult(
      [templateAction('procurementBands'), templateAction('procurementBands')],
      ['procurementBands'],
      'MEDIUM',
    ));
    expect(r.affectedTemplates).toHaveLength(1);
  });

  it('CI-09-02 UPDATE_TEMPLATE for two different areas → affectedTemplates.length === 2', () => {
    const r = mapImpact(synResult(
      [templateAction('procurementBands'), templateAction('contractTypes')],
      ['procurementBands', 'contractTypes'],
      'MEDIUM',
    ));
    expect(r.affectedTemplates).toHaveLength(2);
  });

  it('CI-09-03 forward → affectedDecisionLogic has no duplicates', () => {
    const arr = forward().affectedDecisionLogic;
    expect(new Set(arr).size).toBe(arr.length);
  });
});

// ─── CI-10: Deterministic order ──────────────────────────────────────────────

describe('CI-10: Repeated calls produce identical output (no sorting, stable order)', () => {
  it('CI-10-01 forward twice → same affectedDecisionLogic', () => {
    expect(forward().affectedDecisionLogic).toEqual(forward().affectedDecisionLogic);
  });

  it('CI-10-02 backward twice → same actionPlan length', () => {
    expect(backward().actionPlan.length).toBe(backward().actionPlan.length);
  });

  it('CI-10-03 same date twice → same affectedAreas', () => {
    expect(same25().affectedAreas).toEqual(same25().affectedAreas);
  });
});

// ─── CI-11: LegalUpdateAgent reuse ───────────────────────────────────────────

describe('CI-11: ChangeImpactAgent calls checkForUpdates exactly once', () => {
  it('CI-11-01 checkForUpdates called exactly once per analyzeImpact', () => {
    const realResult = new LegalUpdateAgent().checkForUpdates('2025-07-01', '2025-07-01');
    const spy = vi.fn().mockReturnValue(realResult);
    const cia = new ChangeImpactAgent({ checkForUpdates: spy } as unknown as LegalUpdateAgent);
    cia.analyzeImpact('2025-07-01', '2025-07-01');
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('CI-11-02 affectedAreas equals migrationPlan.affectedAreas from the injected agent', () => {
    const legalResult = new LegalUpdateAgent().checkForUpdates('2025-07-01', '2026-01-01');
    const spy = vi.fn().mockReturnValue(legalResult);
    const cia = new ChangeImpactAgent({ checkForUpdates: spy } as unknown as LegalUpdateAgent);
    const r = cia.analyzeImpact('2025-07-01', '2026-01-01');
    expect(r.affectedAreas).toEqual(legalResult.migrationPlan.affectedAreas);
  });

  it('CI-11-03 impactLevel matches the injected agent result', () => {
    const legalResult = new LegalUpdateAgent().checkForUpdates('2025-07-01', '2026-01-01');
    const spy = vi.fn().mockReturnValue(legalResult);
    const cia = new ChangeImpactAgent({ checkForUpdates: spy } as unknown as LegalUpdateAgent);
    expect(cia.analyzeImpact('2025-07-01', '2026-01-01').impactLevel).toBe(legalResult.impactLevel);
  });
});

// ─── CI-12: No direct engine calls ───────────────────────────────────────────
// Verified by cross-checking ChangeImpactAgent output against LegalUpdateAgent
// for the same date inputs — they must agree on all derived fields.

describe('CI-12: Output consistent with LegalUpdateAgent (no independent engine calls)', () => {
  it('CI-12-01 impactLevel matches LegalUpdateAgent result', () => {
    const legal = new LegalUpdateAgent().checkForUpdates('2025-07-01', '2026-01-01');
    expect(forward().impactLevel).toBe(legal.impactLevel);
  });

  it('CI-12-02 affectedAreas matches migrationPlan.affectedAreas from LegalUpdateAgent', () => {
    const legal = new LegalUpdateAgent().checkForUpdates('2025-07-01', '2026-01-01');
    expect(forward().affectedAreas).toEqual(legal.migrationPlan.affectedAreas);
  });

  it('CI-12-03 requiresHumanReview matches migrationPlan.requiresHumanReview from LegalUpdateAgent', () => {
    const legal = new LegalUpdateAgent().checkForUpdates('2026-01-01', '2025-07-01');
    expect(backward().requiresHumanReview).toBe(legal.migrationPlan.requiresHumanReview);
  });
});

// ─── CI-13: Backward compatibility ───────────────────────────────────────────

describe('CI-13: Backward compatibility / fallback dates', () => {
  it('CI-13-01 pre-history date does not throw', () => {
    expect(() => agent.analyzeImpact('2020-01-01', '2025-07-01')).not.toThrow();
  });

  it('CI-13-02 pre-history vs 2026-01-01 → shouldUpdate true', () => {
    expect(agent.analyzeImpact('2020-01-01', '2026-01-01').shouldUpdate).toBe(true);
  });

  it('CI-13-03 result has all required fields', () => {
    const r = forward();
    expect(r).toHaveProperty('impactLevel');
    expect(r).toHaveProperty('shouldUpdate');
    expect(r).toHaveProperty('requiresHumanReview');
    expect(r).toHaveProperty('affectedAreas');
    expect(r).toHaveProperty('affectedTemplates');
    expect(r).toHaveProperty('affectedDecisionLogic');
    expect(r).toHaveProperty('affectedRiskRules');
    expect(r).toHaveProperty('actionPlan');
  });
});
