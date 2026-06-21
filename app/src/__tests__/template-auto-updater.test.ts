/**
 * Legal v5.2 — TemplateAutoUpdater Tests
 *
 * TA-01..TA-13: 13 groups × 3 tests = 39 tests
 *
 * Note: placed in src/__tests__/ (not src/tests/) — vitest include pattern is
 * src/__tests__/**\/*.test.{ts,tsx}.
 *
 * Data facts (from versioned JSON snapshots):
 *   forward  2025-07-01 → 2026-01-01: 1 threshold ADDED   → HIGH, humanReview=false
 *   backward 2026-01-01 → 2025-07-01: 1 threshold REMOVED → HIGH, humanReview=true
 *   same     2025-07-01 → 2025-07-01: no changes           → LOW,  humanReview=false
 *
 * With real data, affectedTemplates is always empty (only thresholds change, not
 * template areas).  TA-06, TA-07, TA-02, TA-04 use planFromAnalysis() directly
 * with synthetic MinAnalysis objects to verify template-change code paths.
 *
 * Canonical template order: ['procurementBands', 'contractTypes', 'fundSources']
 *
 * Groups:
 *   TA-01 LOW impact             — same: shouldUpdate false, updateTasks empty
 *   TA-02 MEDIUM impact          — synthetic: REGENERATE tasks produced
 *   TA-03 HIGH impact            — forward: shouldUpdate true, updateTasks empty (no template diff)
 *   TA-04 CRITICAL impact        — synthetic: REGENERATE + REVIEW_MANUALLY tasks
 *   TA-05 shouldUpdate=false     — same: updateTasks=[], 3 SKIP tasks
 *   TA-06 REGENERATE mapping     — synthetic: each template type → REGENERATE task
 *   TA-07 Human review tasks     — synthetic: requiresHumanReview → REVIEW_MANUALLY added
 *   TA-08 Skipped tasks          — forward + synthetic: unaffected types → SKIP
 *   TA-09 Deduplication          — duplicate affectedTemplates → 1 task per (type, action)
 *   TA-10 Deterministic order    — canonical type order in task arrays
 *   TA-11 Single ChangeImpactAgent call — spy verifies analyzeImpact called once
 *   TA-12 No direct engine calls — output consistent with ChangeImpactAgent
 *   TA-13 Backward compatibility — pre-history fallback dates work
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TemplateAutoUpdater, planFromAnalysis } from '../agents/TemplateAutoUpdater';
import { ChangeImpactAgent } from '../agents/ChangeImpactAgent';
import type { ImpactLevel } from '../ai/updatePackageEngine';

// ─── Real-data helpers ────────────────────────────────────────────────────────

let updater: TemplateAutoUpdater;

beforeEach(() => { updater = new TemplateAutoUpdater(); });

const same25   = () => updater.planTemplateUpdates('2025-07-01', '2025-07-01');
const forward  = () => updater.planTemplateUpdates('2025-07-01', '2026-01-01');
const backward = () => updater.planTemplateUpdates('2026-01-01', '2025-07-01');

// ─── Synthetic-data helper ────────────────────────────────────────────────────

function synAnalysis(
  affectedTemplates: string[],
  impactLevel: ImpactLevel,
  requiresHumanReview = false,
) {
  return {
    shouldUpdate:        impactLevel !== 'LOW',
    requiresHumanReview,
    impactLevel,
    affectedTemplates,
  };
}

// ─── TA-01: LOW impact ────────────────────────────────────────────────────────

describe('TA-01: LOW impact — same date: shouldUpdate false, updateTasks empty', () => {
  it('TA-01-01 shouldUpdate is false', () => {
    expect(same25().shouldUpdate).toBe(false);
  });

  it('TA-01-02 impactLevel is LOW', () => {
    expect(same25().impactLevel).toBe('LOW');
  });

  it('TA-01-03 updateTasks is empty', () => {
    expect(same25().updateTasks).toHaveLength(0);
  });
});

// ─── TA-02: MEDIUM impact (synthetic) ────────────────────────────────────────

describe('TA-02: MEDIUM impact — synthetic: REGENERATE tasks produced', () => {
  const med = synAnalysis(['contractTypes'], 'MEDIUM');

  it('TA-02-01 impactLevel is MEDIUM', () => {
    expect(planFromAnalysis(med).impactLevel).toBe('MEDIUM');
  });

  it('TA-02-02 shouldUpdate is true', () => {
    expect(planFromAnalysis(med).shouldUpdate).toBe(true);
  });

  it('TA-02-03 updateTasks contains a REGENERATE task for contractTypes', () => {
    const tasks = planFromAnalysis(med).updateTasks;
    expect(tasks.some(t => t.templateType === 'contractTypes' && t.action === 'REGENERATE')).toBe(true);
  });
});

// ─── TA-03: HIGH impact ───────────────────────────────────────────────────────

describe('TA-03: HIGH impact — forward diff: shouldUpdate true, no template changes', () => {
  it('TA-03-01 impactLevel is HIGH', () => {
    expect(forward().impactLevel).toBe('HIGH');
  });

  it('TA-03-02 shouldUpdate is true', () => {
    expect(forward().shouldUpdate).toBe(true);
  });

  it('TA-03-03 updateTasks is empty (threshold change, not template change)', () => {
    expect(forward().updateTasks).toHaveLength(0);
  });
});

// ─── TA-04: CRITICAL impact (synthetic) ──────────────────────────────────────

describe('TA-04: CRITICAL impact — synthetic: REGENERATE + REVIEW_MANUALLY tasks', () => {
  const crit = synAnalysis(['procurementBands'], 'CRITICAL', true);

  it('TA-04-01 impactLevel is CRITICAL', () => {
    expect(planFromAnalysis(crit).impactLevel).toBe('CRITICAL');
  });

  it('TA-04-02 requiresHumanReview is true', () => {
    expect(planFromAnalysis(crit).requiresHumanReview).toBe(true);
  });

  it('TA-04-03 updateTasks contains both REGENERATE and REVIEW_MANUALLY', () => {
    const tasks = planFromAnalysis(crit).updateTasks;
    expect(tasks.some(t => t.action === 'REGENERATE')).toBe(true);
    expect(tasks.some(t => t.action === 'REVIEW_MANUALLY')).toBe(true);
  });
});

// ─── TA-05: shouldUpdate=false ────────────────────────────────────────────────

describe('TA-05: shouldUpdate=false — updateTasks empty, all 3 types skipped', () => {
  it('TA-05-01 updateTasks is an empty array', () => {
    expect(same25().updateTasks).toEqual([]);
  });

  it('TA-05-02 skippedTasks contains all 3 canonical template types', () => {
    const types = same25().skippedTasks.map(t => t.templateType);
    expect(types).toContain('procurementBands');
    expect(types).toContain('contractTypes');
    expect(types).toContain('fundSources');
  });

  it('TA-05-03 all skipped tasks have action SKIP', () => {
    expect(same25().skippedTasks.every(t => t.action === 'SKIP')).toBe(true);
  });
});

// ─── TA-06: REGENERATE mapping ────────────────────────────────────────────────

describe('TA-06: UPDATE_TEMPLATE → REGENERATE task for each affected template type', () => {
  it('TA-06-01 procurementBands in affectedTemplates → REGENERATE task', () => {
    const plan = planFromAnalysis(synAnalysis(['procurementBands'], 'MEDIUM'));
    expect(plan.updateTasks.some(t => t.templateType === 'procurementBands' && t.action === 'REGENERATE')).toBe(true);
  });

  it('TA-06-02 contractTypes in affectedTemplates → REGENERATE task', () => {
    const plan = planFromAnalysis(synAnalysis(['contractTypes'], 'MEDIUM'));
    expect(plan.updateTasks.some(t => t.templateType === 'contractTypes' && t.action === 'REGENERATE')).toBe(true);
  });

  it('TA-06-03 fundSources in affectedTemplates → REGENERATE task', () => {
    const plan = planFromAnalysis(synAnalysis(['fundSources'], 'MEDIUM'));
    expect(plan.updateTasks.some(t => t.templateType === 'fundSources' && t.action === 'REGENERATE')).toBe(true);
  });
});

// ─── TA-07: Human review tasks ────────────────────────────────────────────────

describe('TA-07: requiresHumanReview=true → REVIEW_MANUALLY task added alongside REGENERATE', () => {
  const reviewSyn = synAnalysis(['procurementBands', 'contractTypes'], 'HIGH', true);

  it('TA-07-01 REVIEW_MANUALLY tasks present in updateTasks', () => {
    expect(planFromAnalysis(reviewSyn).updateTasks.some(t => t.action === 'REVIEW_MANUALLY')).toBe(true);
  });

  it('TA-07-02 REGENERATE tasks still present alongside REVIEW_MANUALLY', () => {
    const tasks = planFromAnalysis(reviewSyn).updateTasks;
    expect(tasks.some(t => t.action === 'REGENERATE')).toBe(true);
    expect(tasks.some(t => t.action === 'REVIEW_MANUALLY')).toBe(true);
  });

  it('TA-07-03 REVIEW_MANUALLY tasks have same templateTypes as REGENERATE tasks', () => {
    const tasks = planFromAnalysis(reviewSyn).updateTasks;
    const regenTypes   = tasks.filter(t => t.action === 'REGENERATE').map(t => t.templateType).sort();
    const reviewTypes  = tasks.filter(t => t.action === 'REVIEW_MANUALLY').map(t => t.templateType).sort();
    expect(regenTypes).toEqual(reviewTypes);
  });
});

// ─── TA-08: Skipped tasks ─────────────────────────────────────────────────────

describe('TA-08: Unaffected template types go to skippedTasks with SKIP', () => {
  it('TA-08-01 forward → all 3 template types in skippedTasks (none affected)', () => {
    expect(forward().skippedTasks).toHaveLength(3);
  });

  it('TA-08-02 synthetic procurementBands affected → contractTypes and fundSources skipped', () => {
    const plan = planFromAnalysis(synAnalysis(['procurementBands'], 'MEDIUM'));
    const skipped = plan.skippedTasks.map(t => t.templateType);
    expect(skipped).toContain('contractTypes');
    expect(skipped).toContain('fundSources');
    expect(skipped).not.toContain('procurementBands');
  });

  it('TA-08-03 all skippedTasks have action SKIP', () => {
    expect(forward().skippedTasks.every(t => t.action === 'SKIP')).toBe(true);
  });
});

// ─── TA-09: Deduplication ─────────────────────────────────────────────────────

describe('TA-09: Duplicate affectedTemplates entries deduplicated in output', () => {
  it('TA-09-01 duplicate type in affectedTemplates → deduplicated in output affectedTemplates', () => {
    const plan = planFromAnalysis(synAnalysis(['procurementBands', 'procurementBands'], 'MEDIUM'));
    const set = new Set(plan.affectedTemplates);
    expect(set.size).toBe(plan.affectedTemplates.length);
  });

  it('TA-09-02 duplicate type in affectedTemplates → only one REGENERATE task for that type', () => {
    const plan = planFromAnalysis(synAnalysis(['procurementBands', 'procurementBands'], 'MEDIUM'));
    const regenTasks = plan.updateTasks.filter(t => t.templateType === 'procurementBands' && t.action === 'REGENERATE');
    expect(regenTasks).toHaveLength(1);
  });

  it('TA-09-03 forward → no duplicate template types in skippedTasks', () => {
    const types = forward().skippedTasks.map(t => t.templateType);
    expect(new Set(types).size).toBe(types.length);
  });
});

// ─── TA-10: Deterministic order ──────────────────────────────────────────────

describe('TA-10: Task arrays follow canonical order (procurementBands, contractTypes, fundSources)', () => {
  it('TA-10-01 same25 twice → identical skippedTasks order', () => {
    expect(same25().skippedTasks.map(t => t.templateType))
      .toEqual(same25().skippedTasks.map(t => t.templateType));
  });

  it('TA-10-02 skippedTasks start with procurementBands when no template types are affected', () => {
    expect(forward().skippedTasks[0]!.templateType).toBe('procurementBands');
  });

  it('TA-10-03 synthetic all-3-affected → REGENERATE tasks in canonical order', () => {
    const plan = planFromAnalysis(synAnalysis(['procurementBands', 'contractTypes', 'fundSources'], 'MEDIUM'));
    const regenTypes = plan.updateTasks.filter(t => t.action === 'REGENERATE').map(t => t.templateType);
    expect(regenTypes).toEqual(['procurementBands', 'contractTypes', 'fundSources']);
  });
});

// ─── TA-11: Single ChangeImpactAgent call ─────────────────────────────────────

describe('TA-11: TemplateAutoUpdater calls analyzeImpact exactly once per planTemplateUpdates', () => {
  it('TA-11-01 analyzeImpact called exactly once', () => {
    const realAnalysis = new ChangeImpactAgent().analyzeImpact('2025-07-01', '2025-07-01');
    const spy = vi.fn().mockReturnValue(realAnalysis);
    const u = new TemplateAutoUpdater({ analyzeImpact: spy } as unknown as ChangeImpactAgent);
    u.planTemplateUpdates('2025-07-01', '2025-07-01');
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('TA-11-02 impactLevel matches the injected agent result', () => {
    const realAnalysis = new ChangeImpactAgent().analyzeImpact('2025-07-01', '2026-01-01');
    const spy = vi.fn().mockReturnValue(realAnalysis);
    const u = new TemplateAutoUpdater({ analyzeImpact: spy } as unknown as ChangeImpactAgent);
    expect(u.planTemplateUpdates('2025-07-01', '2026-01-01').impactLevel).toBe(realAnalysis.impactLevel);
  });

  it('TA-11-03 affectedTemplates matches the injected agent result (deduplicated)', () => {
    const realAnalysis = new ChangeImpactAgent().analyzeImpact('2025-07-01', '2026-01-01');
    const spy = vi.fn().mockReturnValue(realAnalysis);
    const u = new TemplateAutoUpdater({ analyzeImpact: spy } as unknown as ChangeImpactAgent);
    const plan = u.planTemplateUpdates('2025-07-01', '2026-01-01');
    expect(plan.affectedTemplates).toEqual([...new Set(realAnalysis.affectedTemplates)]);
  });
});

// ─── TA-12: No direct engine calls ───────────────────────────────────────────
// Verified by cross-checking TemplateAutoUpdater output against ChangeImpactAgent
// for the same date inputs — they must agree on all shared derived fields.

describe('TA-12: Output consistent with ChangeImpactAgent (no independent engine calls)', () => {
  it('TA-12-01 shouldUpdate matches ChangeImpactAgent result', () => {
    const ca = new ChangeImpactAgent().analyzeImpact('2025-07-01', '2026-01-01');
    expect(forward().shouldUpdate).toBe(ca.shouldUpdate);
  });

  it('TA-12-02 requiresHumanReview matches ChangeImpactAgent result', () => {
    const ca = new ChangeImpactAgent().analyzeImpact('2026-01-01', '2025-07-01');
    expect(backward().requiresHumanReview).toBe(ca.requiresHumanReview);
  });

  it('TA-12-03 impactLevel matches ChangeImpactAgent result', () => {
    const ca = new ChangeImpactAgent().analyzeImpact('2025-07-01', '2025-07-01');
    expect(same25().impactLevel).toBe(ca.impactLevel);
  });
});

// ─── TA-13: Backward compatibility ───────────────────────────────────────────

describe('TA-13: Backward compatibility / fallback dates', () => {
  it('TA-13-01 pre-history date does not throw', () => {
    expect(() => updater.planTemplateUpdates('2020-01-01', '2025-07-01')).not.toThrow();
  });

  it('TA-13-02 pre-history vs 2026-01-01 → shouldUpdate true', () => {
    expect(updater.planTemplateUpdates('2020-01-01', '2026-01-01').shouldUpdate).toBe(true);
  });

  it('TA-13-03 result has all required fields', () => {
    const plan = forward();
    expect(plan).toHaveProperty('shouldUpdate');
    expect(plan).toHaveProperty('requiresHumanReview');
    expect(plan).toHaveProperty('impactLevel');
    expect(plan).toHaveProperty('affectedTemplates');
    expect(plan).toHaveProperty('updateTasks');
    expect(plan).toHaveProperty('skippedTasks');
  });
});
