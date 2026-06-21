/**
 * Legal v6.0 — WorkflowAgent Tests
 *
 * WF-01..WF-13: 13 groups × 3 tests = 39 tests
 *
 * Note: placed in src/__tests__/ (not src/tests/) — vitest include pattern is
 * src/__tests__/**\/*.test.{ts,tsx}.
 *
 * Data facts (from versioned JSON snapshots via full agent stack):
 *   forward  2025-07-01 → 2026-01-01: HIGH, shouldRollback=false, executionPlan=3 SKIP
 *   backward 2026-01-01 → 2025-07-01: HIGH, shouldRollback=true,  executionPlan=3 SKIP
 *   same     2025-07-01 → 2025-07-01: LOW,  shouldRollback=false, executionPlan=3 SKIP
 *
 * With real data, rollbackTasks and safeTasks are always empty (no template
 * diffs in the two-version snapshot set), so executionPlan always consists
 * of 3 SKIP steps.  WF-02, WF-03, WF-06, WF-07, WF-08 use buildWorkflowFromPlan()
 * with synthetic plans to exercise ROLLBACK and APPLY execution paths.
 *
 * Key real-data invariant:
 *   backward → shouldRollback=true but executionPlan has zero ROLLBACK steps
 *   (rollbackTasks=[] because queue was empty — no template types changed)
 *
 * Groups:
 *   WF-01 No rollback        — shouldRollback false: no ROLLBACK steps in plan
 *   WF-02 Rollback path      — synthetic: rollbackTasks → ROLLBACK steps
 *   WF-03 Apply path         — synthetic: safeTasks → APPLY steps
 *   WF-04 Skip path          — forward: skippedTasks → 3 SKIP steps
 *   WF-05 Ordering           — step orders are sequential from 1, no gaps
 *   WF-06 ROLLBACK first     — synthetic: ROLLBACK steps precede APPLY and SKIP
 *   WF-07 APPLY second       — synthetic: APPLY steps after ROLLBACK, before SKIP
 *   WF-08 SKIP last          — synthetic/real: SKIP steps are always last
 *   WF-09 requiresHumanReview — propagated from RollbackPlan
 *   WF-10 impactLevel         — propagated from RollbackPlan
 *   WF-11 Deterministic output — repeated calls produce identical results
 *   WF-12 Single RollbackManager call — spy verifies buildRollbackPlan called once
 *   WF-13 Backward compatibility — pre-history fallback dates work
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkflowAgent, buildWorkflowFromPlan } from '../agents/WorkflowAgent';
import { RollbackManager } from '../agents/RollbackManager';
import type { RollbackTask } from '../agents/RollbackManager';
import type { Priority } from '../agents/HumanReviewQueue';
import type { TemplateTask, TemplateType, TemplateAction } from '../agents/TemplateAutoUpdater';
import type { ImpactLevel } from '../ai/updatePackageEngine';

// ─── Real-data helpers ────────────────────────────────────────────────────────

let agent: WorkflowAgent;

beforeEach(() => { agent = new WorkflowAgent(); });

const same25   = () => agent.runWorkflow('2025-07-01', '2025-07-01');
const forward  = () => agent.runWorkflow('2025-07-01', '2026-01-01');
const backward = () => agent.runWorkflow('2026-01-01', '2025-07-01');

// ─── Synthetic-data helpers ───────────────────────────────────────────────────

function rbTask(templateType: TemplateType, priority: Priority, reason = 'rb reason'): RollbackTask {
  return { templateType, priority, reason };
}

function safeTask(templateType: TemplateType, reason = 'safe reason'): TemplateTask {
  return { templateType, action: 'REGENERATE' as TemplateAction, reason };
}

function skipTask(templateType: TemplateType, reason = 'skip reason'): TemplateTask {
  return { templateType, action: 'SKIP' as TemplateAction, reason };
}

function synPlan(
  rollbackTasks:       RollbackTask[],
  safeTasks:           TemplateTask[],
  skippedTasks:        TemplateTask[],
  impactLevel:         ImpactLevel,
  shouldRollback:      boolean,
  requiresHumanReview: boolean,
) {
  return { rollbackTasks, safeTasks, skippedTasks, impactLevel, shouldRollback, requiresHumanReview };
}

// ─── WF-01: No rollback ───────────────────────────────────────────────────────

describe('WF-01: shouldRollback=false — no ROLLBACK steps in executionPlan', () => {
  it('WF-01-01 same25 → shouldRollback false', () => {
    expect(same25().shouldRollback).toBe(false);
  });

  it('WF-01-02 forward → executionPlan has no ROLLBACK steps', () => {
    expect(forward().executionPlan.every(s => s.action !== 'ROLLBACK')).toBe(true);
  });

  it('WF-01-03 same25 → rollbackTasks empty in result', () => {
    expect(same25().rollbackTasks).toHaveLength(0);
  });
});

// ─── WF-02: Rollback path (synthetic) ────────────────────────────────────────

describe('WF-02: shouldRollback=true → rollbackTasks become ROLLBACK steps', () => {
  const syn = synPlan(
    [rbTask('procurementBands', 'HIGH', 'pb rollback')],
    [],
    [skipTask('contractTypes'), skipTask('fundSources')],
    'HIGH', true, true,
  );

  it('WF-02-01 synthetic → executionPlan has ROLLBACK step', () => {
    expect(buildWorkflowFromPlan(syn).executionPlan.some(s => s.action === 'ROLLBACK')).toBe(true);
  });

  it('WF-02-02 backward → shouldRollback true (real data)', () => {
    expect(backward().shouldRollback).toBe(true);
  });

  it('WF-02-03 synthetic → rollbackTasks forwarded in result', () => {
    expect(buildWorkflowFromPlan(syn).rollbackTasks).toHaveLength(1);
  });
});

// ─── WF-03: Apply path (synthetic) ───────────────────────────────────────────

describe('WF-03: safeTasks → APPLY steps in executionPlan', () => {
  const syn = synPlan(
    [],
    [safeTask('contractTypes', 'ct safe'), safeTask('fundSources', 'fs safe')],
    [skipTask('procurementBands')],
    'MEDIUM', false, false,
  );

  it('WF-03-01 synthetic → executionPlan has APPLY steps', () => {
    expect(buildWorkflowFromPlan(syn).executionPlan.some(s => s.action === 'APPLY')).toBe(true);
  });

  it('WF-03-02 synthetic → 2 APPLY steps (one per safeTask)', () => {
    const applies = buildWorkflowFromPlan(syn).executionPlan.filter(s => s.action === 'APPLY');
    expect(applies).toHaveLength(2);
  });

  it('WF-03-03 synthetic → safeTasks forwarded in result', () => {
    expect(buildWorkflowFromPlan(syn).safeTasks).toHaveLength(2);
  });
});

// ─── WF-04: Skip path ─────────────────────────────────────────────────────────

describe('WF-04: skippedTasks → SKIP steps in executionPlan', () => {
  it('WF-04-01 forward → executionPlan has SKIP steps', () => {
    expect(forward().executionPlan.some(s => s.action === 'SKIP')).toBe(true);
  });

  it('WF-04-02 forward → all 3 executionPlan steps are SKIP', () => {
    expect(forward().executionPlan.every(s => s.action === 'SKIP')).toBe(true);
  });

  it('WF-04-03 forward → SKIP steps have templateType set', () => {
    expect(forward().executionPlan.every(s => s.templateType !== undefined)).toBe(true);
  });
});

// ─── WF-05: Ordering ─────────────────────────────────────────────────────────

describe('WF-05: Step orders are sequential from 1 with no gaps', () => {
  const syn = synPlan(
    [rbTask('procurementBands', 'HIGH')],
    [safeTask('contractTypes')],
    [skipTask('fundSources')],
    'HIGH', true, true,
  );

  it('WF-05-01 total step count equals sum of all task arrays', () => {
    const r = buildWorkflowFromPlan(syn);
    const expected = r.rollbackTasks.length + r.safeTasks.length + r.skippedTasks.length;
    expect(r.executionPlan).toHaveLength(expected);
  });

  it('WF-05-02 step orders start at 1', () => {
    expect(buildWorkflowFromPlan(syn).executionPlan[0]?.order).toBe(1);
  });

  it('WF-05-03 order values are sequential (no gaps)', () => {
    const orders = buildWorkflowFromPlan(syn).executionPlan.map(s => s.order);
    const expected = orders.map((_, i) => i + 1);
    expect(orders).toEqual(expected);
  });
});

// ─── WF-06: ROLLBACK first ────────────────────────────────────────────────────

describe('WF-06: ROLLBACK steps precede all APPLY and SKIP steps', () => {
  const syn = synPlan(
    [rbTask('procurementBands', 'HIGH')],
    [safeTask('contractTypes')],
    [skipTask('fundSources')],
    'HIGH', true, true,
  );

  it('WF-06-01 first step is ROLLBACK when shouldRollback=true and rollbackTasks non-empty', () => {
    expect(buildWorkflowFromPlan(syn).executionPlan[0]?.action).toBe('ROLLBACK');
  });

  it('WF-06-02 no APPLY or SKIP step has a lower order than any ROLLBACK step', () => {
    const plan = buildWorkflowFromPlan(syn).executionPlan;
    const maxRollbackOrder = Math.max(...plan.filter(s => s.action === 'ROLLBACK').map(s => s.order));
    const minOtherOrder   = Math.min(...plan.filter(s => s.action !== 'ROLLBACK').map(s => s.order));
    expect(maxRollbackOrder).toBeLessThan(minOtherOrder);
  });

  it('WF-06-03 shouldRollback=false → no ROLLBACK steps even when rollbackTasks present in input', () => {
    // shouldRollback=false → rollbackTasks contribute nothing
    const noRollback = synPlan(
      [rbTask('procurementBands', 'HIGH')],
      [],
      [skipTask('fundSources')],
      'HIGH', false, false,
    );
    expect(buildWorkflowFromPlan(noRollback).executionPlan.every(s => s.action !== 'ROLLBACK')).toBe(true);
  });
});

// ─── WF-07: APPLY second ─────────────────────────────────────────────────────

describe('WF-07: APPLY steps come after ROLLBACK, before SKIP', () => {
  const syn = synPlan(
    [rbTask('procurementBands', 'HIGH')],
    [safeTask('contractTypes')],
    [skipTask('fundSources')],
    'HIGH', true, true,
  );

  it('WF-07-01 APPLY step order is between ROLLBACK and SKIP', () => {
    const plan = buildWorkflowFromPlan(syn).executionPlan;
    const rollbackOrder = plan.find(s => s.action === 'ROLLBACK')!.order;
    const applyOrder    = plan.find(s => s.action === 'APPLY')!.order;
    const skipOrder     = plan.find(s => s.action === 'SKIP')!.order;
    expect(rollbackOrder).toBeLessThan(applyOrder);
    expect(applyOrder).toBeLessThan(skipOrder);
  });

  it('WF-07-02 APPLY steps come after all ROLLBACK steps', () => {
    const plan = buildWorkflowFromPlan(syn).executionPlan;
    const maxRollback = Math.max(...plan.filter(s => s.action === 'ROLLBACK').map(s => s.order));
    const minApply    = Math.min(...plan.filter(s => s.action === 'APPLY').map(s => s.order));
    expect(maxRollback).toBeLessThan(minApply);
  });

  it('WF-07-03 synthetic with only APPLY+SKIP → APPLY before SKIP', () => {
    const noRollback = synPlan([], [safeTask('contractTypes')], [skipTask('fundSources')], 'MEDIUM', false, false);
    const plan = buildWorkflowFromPlan(noRollback).executionPlan;
    const applyOrder = plan.find(s => s.action === 'APPLY')!.order;
    const skipOrder  = plan.find(s => s.action === 'SKIP')!.order;
    expect(applyOrder).toBeLessThan(skipOrder);
  });
});

// ─── WF-08: SKIP last ─────────────────────────────────────────────────────────

describe('WF-08: SKIP steps are always last in executionPlan', () => {
  it('WF-08-01 forward → all steps are SKIP (nothing else to do)', () => {
    const plan = forward().executionPlan;
    expect(plan.length).toBeGreaterThan(0);
    expect(plan.every(s => s.action === 'SKIP')).toBe(true);
  });

  it('WF-08-02 synthetic APPLY+SKIP → SKIP after APPLY', () => {
    const syn = synPlan([], [safeTask('procurementBands')], [skipTask('contractTypes')], 'MEDIUM', false, false);
    const plan = buildWorkflowFromPlan(syn).executionPlan;
    const lastApply = Math.max(...plan.filter(s => s.action === 'APPLY').map(s => s.order));
    const firstSkip = Math.min(...plan.filter(s => s.action === 'SKIP').map(s => s.order));
    expect(lastApply).toBeLessThan(firstSkip);
  });

  it('WF-08-03 synthetic ROLLBACK+APPLY+SKIP → SKIP steps have the highest orders', () => {
    const syn = synPlan(
      [rbTask('procurementBands', 'HIGH')],
      [safeTask('contractTypes')],
      [skipTask('fundSources')],
      'HIGH', true, true,
    );
    const plan = buildWorkflowFromPlan(syn).executionPlan;
    const skipOrders    = plan.filter(s => s.action === 'SKIP').map(s => s.order);
    const nonSkipOrders = plan.filter(s => s.action !== 'SKIP').map(s => s.order);
    expect(Math.min(...skipOrders)).toBeGreaterThan(Math.max(...nonSkipOrders));
  });
});

// ─── WF-09: requiresHumanReview propagation ──────────────────────────────────

describe('WF-09: requiresHumanReview propagated from RollbackPlan', () => {
  it('WF-09-01 backward → requiresHumanReview true', () => {
    expect(backward().requiresHumanReview).toBe(true);
  });

  it('WF-09-02 forward → requiresHumanReview false', () => {
    expect(forward().requiresHumanReview).toBe(false);
  });

  it('WF-09-03 synthetic true → result.requiresHumanReview true', () => {
    const syn = synPlan([], [], [], 'HIGH', true, true);
    expect(buildWorkflowFromPlan(syn).requiresHumanReview).toBe(true);
  });
});

// ─── WF-10: impactLevel propagation ──────────────────────────────────────────

describe('WF-10: impactLevel propagated from RollbackPlan', () => {
  it('WF-10-01 same25 → impactLevel LOW', () => {
    expect(same25().impactLevel).toBe('LOW');
  });

  it('WF-10-02 forward → impactLevel HIGH', () => {
    expect(forward().impactLevel).toBe('HIGH');
  });

  it('WF-10-03 backward → impactLevel HIGH', () => {
    expect(backward().impactLevel).toBe('HIGH');
  });
});

// ─── WF-11: Deterministic output ─────────────────────────────────────────────

describe('WF-11: Repeated calls produce identical output', () => {
  it('WF-11-01 forward twice → same executionPlan length', () => {
    expect(forward().executionPlan.length).toBe(forward().executionPlan.length);
  });

  it('WF-11-02 backward twice → same shouldRollback', () => {
    expect(backward().shouldRollback).toBe(backward().shouldRollback);
  });

  it('WF-11-03 synthetic twice → same step actions in same order', () => {
    const syn = synPlan(
      [rbTask('procurementBands', 'HIGH')],
      [safeTask('contractTypes')],
      [skipTask('fundSources')],
      'HIGH', true, true,
    );
    const a = buildWorkflowFromPlan(syn).executionPlan.map(s => s.action);
    const b = buildWorkflowFromPlan(syn).executionPlan.map(s => s.action);
    expect(a).toEqual(b);
  });
});

// ─── WF-12: Single RollbackManager call ──────────────────────────────────────

describe('WF-12: WorkflowAgent calls buildRollbackPlan exactly once per runWorkflow', () => {
  it('WF-12-01 buildRollbackPlan called exactly once', () => {
    const realPlan = new RollbackManager().buildRollbackPlan('2025-07-01', '2025-07-01');
    const spy = vi.fn().mockReturnValue(realPlan);
    const wa = new WorkflowAgent({ buildRollbackPlan: spy } as unknown as RollbackManager);
    wa.runWorkflow('2025-07-01', '2025-07-01');
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('WF-12-02 impactLevel matches injected RollbackManager result', () => {
    const realPlan = new RollbackManager().buildRollbackPlan('2025-07-01', '2026-01-01');
    const spy = vi.fn().mockReturnValue(realPlan);
    const wa = new WorkflowAgent({ buildRollbackPlan: spy } as unknown as RollbackManager);
    expect(wa.runWorkflow('2025-07-01', '2026-01-01').impactLevel).toBe(realPlan.impactLevel);
  });

  it('WF-12-03 shouldRollback matches injected result', () => {
    const realPlan = new RollbackManager().buildRollbackPlan('2026-01-01', '2025-07-01');
    const spy = vi.fn().mockReturnValue(realPlan);
    const wa = new WorkflowAgent({ buildRollbackPlan: spy } as unknown as RollbackManager);
    expect(wa.runWorkflow('2026-01-01', '2025-07-01').shouldRollback).toBe(realPlan.shouldRollback);
  });
});

// ─── WF-13: Backward compatibility ───────────────────────────────────────────

describe('WF-13: Backward compatibility / fallback dates', () => {
  it('WF-13-01 pre-history date does not throw', () => {
    expect(() => agent.runWorkflow('2020-01-01', '2025-07-01')).not.toThrow();
  });

  it('WF-13-02 pre-history vs 2026-01-01 → impactLevel is not LOW', () => {
    expect(agent.runWorkflow('2020-01-01', '2026-01-01').impactLevel).not.toBe('LOW');
  });

  it('WF-13-03 executionPlan is a non-null array', () => {
    const r = forward();
    expect(Array.isArray(r.executionPlan)).toBe(true);
  });
});
