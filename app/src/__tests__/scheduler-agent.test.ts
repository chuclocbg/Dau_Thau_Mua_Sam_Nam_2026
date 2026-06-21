import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  SchedulerAgent,
  scheduleFromWorkflow,
} from '../agents/SchedulerAgent';
import { WorkflowAgent }      from '../agents/WorkflowAgent';
import type { ExecutionStep } from '../agents/WorkflowAgent';
import type { ImpactLevel }   from '../ai/updatePackageEngine';

// ── helpers ────────────────────────────────────────────────────────────────────

type TemplateType = 'procurementBands' | 'contractTypes' | 'fundSources';
type WorkflowAction = 'ROLLBACK' | 'APPLY' | 'SKIP';

function step(
  order:        number,
  action:       WorkflowAction,
  templateType: TemplateType = 'procurementBands',
  extra:        Partial<ExecutionStep> = {},
): ExecutionStep {
  return { order, action, templateType, reason: `r-${order}`, ...extra };
}

function synResult(
  executionPlan:       readonly ExecutionStep[],
  requiresHumanReview: boolean,
  impactLevel:         ImpactLevel = 'LOW',
) {
  return { executionPlan, requiresHumanReview, impactLevel };
}

function stubWorkflow(
  executionPlan:       readonly ExecutionStep[],
  requiresHumanReview: boolean,
  impactLevel:         ImpactLevel = 'LOW',
) {
  return vi.fn().mockReturnValue({
    shouldRollback: false,
    requiresHumanReview,
    impactLevel,
    rollbackTasks: [],
    safeTasks:     [],
    skippedTasks:  [],
    executionPlan,
  });
}

// Real date pairs
const SAME = { last: '2025-07-01', cur: '2025-07-01' };
const FWD  = { last: '2025-07-01', cur: '2026-01-01' };
const BWD  = { last: '2026-01-01', cur: '2025-07-01' };

// ── SC-01 no human review ──────────────────────────────────────────────────────
describe('SC-01 no human review', () => {
  it('SC-01-01: forward real data — all SKIP → completedTasks=3, waiting=[], immediate=[]', () => {
    const r = new SchedulerAgent().schedule(FWD.last, FWD.cur);
    expect(r.waitingTasks).toHaveLength(0);
    expect(r.immediateTasks).toHaveLength(0);
    expect(r.completedTasks).toHaveLength(3);
  });

  it('SC-01-02: APPLY+SKIP, requiresHumanReview=false → both in completedTasks', () => {
    const plan = [step(1, 'APPLY'), step(2, 'SKIP', 'contractTypes')];
    const r = scheduleFromWorkflow(synResult(plan, false));
    expect(r.completedTasks).toHaveLength(2);
    expect(r.waitingTasks).toHaveLength(0);
  });

  it('SC-01-03: SKIP-only, requiresHumanReview=false → all 3 in completedTasks', () => {
    const plan = [step(1, 'SKIP'), step(2, 'SKIP', 'contractTypes'), step(3, 'SKIP', 'fundSources')];
    const r = scheduleFromWorkflow(synResult(plan, false));
    expect(r.completedTasks).toHaveLength(3);
    expect(r.waitingTasks).toHaveLength(0);
    expect(r.immediateTasks).toHaveLength(0);
  });
});

// ── SC-02 human review ─────────────────────────────────────────────────────────
describe('SC-02 human review', () => {
  it('SC-02-01: backward real data — requiresHumanReview=true, SKIP-only → all in completedTasks', () => {
    const r = new SchedulerAgent().schedule(BWD.last, BWD.cur);
    expect(r.requiresHumanReview).toBe(true);
    expect(r.completedTasks).toHaveLength(3);
    expect(r.waitingTasks).toHaveLength(0);
  });

  it('SC-02-02: APPLY with requiresHumanReview=true → waitingTasks', () => {
    const r = scheduleFromWorkflow(synResult([step(1, 'APPLY')], true));
    expect(r.waitingTasks).toHaveLength(1);
    expect(r.completedTasks).toHaveLength(0);
  });

  it('SC-02-03: APPLY+SKIP, requiresHumanReview=true → APPLY waiting, SKIP completed', () => {
    const plan = [step(1, 'APPLY'), step(2, 'SKIP', 'contractTypes')];
    const r = scheduleFromWorkflow(synResult(plan, true));
    expect(r.waitingTasks).toHaveLength(1);
    expect(r.waitingTasks[0].action).toBe('APPLY');
    expect(r.completedTasks).toHaveLength(1);
    expect(r.completedTasks[0].action).toBe('SKIP');
  });
});

// ── SC-03 rollback waiting ─────────────────────────────────────────────────────
describe('SC-03 rollback waiting', () => {
  it('SC-03-01: ROLLBACK always → waitingTasks', () => {
    const r = scheduleFromWorkflow(synResult([step(1, 'ROLLBACK', 'procurementBands', { priority: 'HIGH' })], true));
    expect(r.waitingTasks).toHaveLength(1);
    expect(r.waitingTasks[0].action).toBe('ROLLBACK');
    expect(r.completedTasks).toHaveLength(0);
  });

  it('SC-03-02: ROLLBACK+SKIP → ROLLBACK in waiting, SKIP in completed', () => {
    const plan = [
      step(1, 'ROLLBACK', 'procurementBands', { priority: 'HIGH' }),
      step(2, 'SKIP', 'contractTypes'),
    ];
    const r = scheduleFromWorkflow(synResult(plan, true));
    expect(r.waitingTasks).toHaveLength(1);
    expect(r.waitingTasks[0].action).toBe('ROLLBACK');
    expect(r.completedTasks).toHaveLength(1);
    expect(r.completedTasks[0].action).toBe('SKIP');
  });

  it('SC-03-03: ROLLBACK+APPLY(noHumanReview) → ROLLBACK waiting, APPLY completed', () => {
    const plan = [
      step(1, 'ROLLBACK', 'procurementBands', { priority: 'HIGH' }),
      step(2, 'APPLY', 'contractTypes'),
    ];
    const r = scheduleFromWorkflow(synResult(plan, false));
    expect(r.waitingTasks).toHaveLength(1);
    expect(r.waitingTasks[0].action).toBe('ROLLBACK');
    expect(r.completedTasks).toHaveLength(1);
    expect(r.completedTasks[0].action).toBe('APPLY');
  });
});

// ── SC-04 apply immediate ──────────────────────────────────────────────────────
describe('SC-04 apply immediate', () => {
  it('SC-04-01: APPLY, requiresHumanReview=false → in immediateTasks', () => {
    const r = scheduleFromWorkflow(synResult([step(1, 'APPLY')], false));
    expect(r.immediateTasks).toHaveLength(1);
    expect(r.immediateTasks[0].action).toBe('APPLY');
  });

  it('SC-04-02: multiple APPLYs, noHumanReview → all in immediateTasks', () => {
    const plan = [step(1, 'APPLY'), step(2, 'APPLY', 'contractTypes')];
    const r = scheduleFromWorkflow(synResult(plan, false));
    expect(r.immediateTasks).toHaveLength(2);
  });

  it('SC-04-03: APPLY+SKIP → APPLY in immediate+completed, SKIP in completed only', () => {
    const plan = [step(1, 'APPLY'), step(2, 'SKIP', 'contractTypes')];
    const r = scheduleFromWorkflow(synResult(plan, false));
    expect(r.immediateTasks).toHaveLength(1);
    expect(r.immediateTasks[0].action).toBe('APPLY');
    expect(r.completedTasks).toHaveLength(2);
  });
});

// ── SC-05 apply waiting ────────────────────────────────────────────────────────
describe('SC-05 apply waiting', () => {
  it('SC-05-01: APPLY, requiresHumanReview=true → waitingTasks not completedTasks', () => {
    const r = scheduleFromWorkflow(synResult([step(1, 'APPLY')], true));
    expect(r.waitingTasks).toHaveLength(1);
    expect(r.completedTasks).toHaveLength(0);
    expect(r.immediateTasks).toHaveLength(0);
  });

  it('SC-05-02: multiple APPLYs, humanReview=true → all in waitingTasks', () => {
    const plan = [step(1, 'APPLY'), step(2, 'APPLY', 'contractTypes')];
    const r = scheduleFromWorkflow(synResult(plan, true));
    expect(r.waitingTasks).toHaveLength(2);
    expect(r.completedTasks).toHaveLength(0);
  });

  it('SC-05-03: APPLY(waiting)+SKIP(completed) counts correct', () => {
    const plan = [step(1, 'APPLY'), step(2, 'SKIP', 'contractTypes'), step(3, 'SKIP', 'fundSources')];
    const r = scheduleFromWorkflow(synResult(plan, true));
    expect(r.waitingTasks).toHaveLength(1);
    expect(r.completedTasks).toHaveLength(2);
  });
});

// ── SC-06 skip completed ───────────────────────────────────────────────────────
describe('SC-06 skip completed', () => {
  it('SC-06-01: SKIP always → completedTasks', () => {
    const r = scheduleFromWorkflow(synResult([step(1, 'SKIP')], false));
    expect(r.completedTasks).toHaveLength(1);
    expect(r.completedTasks[0].action).toBe('SKIP');
  });

  it('SC-06-02: SKIP never in waitingTasks even when humanReview=true', () => {
    const plan = [step(1, 'SKIP'), step(2, 'SKIP', 'contractTypes')];
    const r = scheduleFromWorkflow(synResult(plan, true, 'HIGH'));
    expect(r.waitingTasks).toHaveLength(0);
    expect(r.completedTasks).toHaveLength(2);
  });

  it('SC-06-03: SKIP never in immediateTasks', () => {
    const r = scheduleFromWorkflow(synResult([step(1, 'SKIP')], false));
    expect(r.immediateTasks).toHaveLength(0);
  });
});

// ── SC-07 executionPlan ordering ───────────────────────────────────────────────
describe('SC-07 executionPlan ordering', () => {
  it('SC-07-01: executionPlan forwarded as same reference', () => {
    const plan = [step(1, 'APPLY'), step(2, 'SKIP', 'contractTypes')];
    const r = scheduleFromWorkflow(synResult(plan, false));
    expect(r.executionPlan).toBe(plan);
  });

  it('SC-07-02: order field values preserved in executionPlan', () => {
    const plan = [
      step(3, 'ROLLBACK', 'procurementBands', { priority: 'HIGH' }),
      step(7, 'SKIP', 'contractTypes'),
    ];
    const r = scheduleFromWorkflow(synResult(plan, true));
    expect(r.executionPlan[0].order).toBe(3);
    expect(r.executionPlan[1].order).toBe(7);
  });

  it('SC-07-03: real forward executionPlan has 3 steps with order 1,2,3', () => {
    const r = new SchedulerAgent().schedule(FWD.last, FWD.cur);
    expect(r.executionPlan).toHaveLength(3);
    expect(r.executionPlan[0].order).toBe(1);
    expect(r.executionPlan[1].order).toBe(2);
    expect(r.executionPlan[2].order).toBe(3);
  });
});

// ── SC-08 immediateTasks ───────────────────────────────────────────────────────
describe('SC-08 immediateTasks', () => {
  it('SC-08-01: immediateTasks equals completedTasks filtered by action==="APPLY"', () => {
    const plan = [step(1, 'APPLY'), step(2, 'SKIP', 'contractTypes')];
    const r = scheduleFromWorkflow(synResult(plan, false));
    expect(r.immediateTasks).toEqual(r.completedTasks.filter(s => s.action === 'APPLY'));
  });

  it('SC-08-02: SKIP tasks not in immediateTasks', () => {
    const r = scheduleFromWorkflow(synResult([step(1, 'SKIP')], false));
    expect(r.immediateTasks).toHaveLength(0);
  });

  it('SC-08-03: ROLLBACK tasks not in immediateTasks', () => {
    const r = scheduleFromWorkflow(synResult([step(1, 'ROLLBACK', 'procurementBands', { priority: 'CRITICAL' })], true));
    expect(r.immediateTasks).toHaveLength(0);
  });
});

// ── SC-09 waitingTasks ─────────────────────────────────────────────────────────
describe('SC-09 waitingTasks', () => {
  it('SC-09-01: ROLLBACK in waitingTasks', () => {
    const r = scheduleFromWorkflow(synResult([step(1, 'ROLLBACK', 'procurementBands', { priority: 'HIGH' })], true));
    expect(r.waitingTasks).toHaveLength(1);
    expect(r.waitingTasks[0].action).toBe('ROLLBACK');
  });

  it('SC-09-02: APPLY with humanReview=true in waitingTasks', () => {
    const r = scheduleFromWorkflow(synResult([step(1, 'APPLY')], true));
    expect(r.waitingTasks).toHaveLength(1);
    expect(r.waitingTasks[0].action).toBe('APPLY');
  });

  it('SC-09-03: SKIP never in waitingTasks', () => {
    const plan = [step(1, 'SKIP'), step(2, 'SKIP', 'contractTypes')];
    const r = scheduleFromWorkflow(synResult(plan, true));
    expect(r.waitingTasks).toHaveLength(0);
  });
});

// ── SC-10 completedTasks ───────────────────────────────────────────────────────
describe('SC-10 completedTasks', () => {
  it('SC-10-01: APPLY, noHumanReview → in completedTasks', () => {
    const r = scheduleFromWorkflow(synResult([step(1, 'APPLY')], false));
    expect(r.completedTasks).toHaveLength(1);
    expect(r.completedTasks[0].action).toBe('APPLY');
  });

  it('SC-10-02: SKIP → in completedTasks', () => {
    const r = scheduleFromWorkflow(synResult([step(1, 'SKIP')], false));
    expect(r.completedTasks).toHaveLength(1);
    expect(r.completedTasks[0].action).toBe('SKIP');
  });

  it('SC-10-03: ROLLBACK never in completedTasks', () => {
    const r = scheduleFromWorkflow(synResult([step(1, 'ROLLBACK', 'procurementBands', { priority: 'HIGH' })], true));
    expect(r.completedTasks).toHaveLength(0);
  });
});

// ── SC-11 impactLevel propagation ─────────────────────────────────────────────
describe('SC-11 impactLevel propagation', () => {
  it('SC-11-01: LOW forwarded from same25 real data', () => {
    const r = new SchedulerAgent().schedule(SAME.last, SAME.cur);
    expect(r.impactLevel).toBe('LOW');
  });

  it('SC-11-02: HIGH forwarded from forward real data', () => {
    const r = new SchedulerAgent().schedule(FWD.last, FWD.cur);
    expect(r.impactLevel).toBe('HIGH');
  });

  it('SC-11-03: CRITICAL forwarded from synthetic input', () => {
    const r = scheduleFromWorkflow(synResult([step(1, 'SKIP')], false, 'CRITICAL'));
    expect(r.impactLevel).toBe('CRITICAL');
  });
});

// ── SC-12 single WorkflowAgent call ───────────────────────────────────────────
describe('SC-12 single WorkflowAgent call', () => {
  it('SC-12-01: runWorkflow called exactly once per schedule() call', () => {
    const spy = stubWorkflow([step(1, 'SKIP')], false);
    const agent = new SchedulerAgent({ runWorkflow: spy } as unknown as WorkflowAgent);
    agent.schedule(SAME.last, SAME.cur);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('SC-12-02: runWorkflow called with correct date args', () => {
    const spy = stubWorkflow([], false);
    const agent = new SchedulerAgent({ runWorkflow: spy } as unknown as WorkflowAgent);
    agent.schedule(FWD.last, FWD.cur);
    expect(spy).toHaveBeenCalledWith(FWD.last, FWD.cur);
  });

  it('SC-12-03: two schedule() calls → runWorkflow called twice total', () => {
    const spy = stubWorkflow([], false);
    const agent = new SchedulerAgent({ runWorkflow: spy } as unknown as WorkflowAgent);
    agent.schedule(SAME.last, SAME.cur);
    agent.schedule(FWD.last, FWD.cur);
    expect(spy).toHaveBeenCalledTimes(2);
  });
});

// ── SC-13 backward compatibility ──────────────────────────────────────────────
describe('SC-13 backward compatibility', () => {
  it('SC-13-01: same25 — LOW, no update, 3-SKIP plan all completed', () => {
    const r = new SchedulerAgent().schedule(SAME.last, SAME.cur);
    expect(r.impactLevel).toBe('LOW');
    expect(r.requiresHumanReview).toBe(false);
    expect(r.executionPlan).toHaveLength(3);
    expect(r.completedTasks).toHaveLength(3);
    expect(r.waitingTasks).toHaveLength(0);
  });

  it('SC-13-02: forward — HIGH, no human review, waiting=[], immediate=[]', () => {
    const r = new SchedulerAgent().schedule(FWD.last, FWD.cur);
    expect(r.impactLevel).toBe('HIGH');
    expect(r.requiresHumanReview).toBe(false);
    expect(r.waitingTasks).toHaveLength(0);
    expect(r.immediateTasks).toHaveLength(0);
  });

  it('SC-13-03: backward — humanReview=true, SKIP-only plan, all SKIP still complete', () => {
    const r = new SchedulerAgent().schedule(BWD.last, BWD.cur);
    expect(r.requiresHumanReview).toBe(true);
    expect(r.waitingTasks).toHaveLength(0);
    expect(r.completedTasks).toHaveLength(3);
    expect(r.immediateTasks).toHaveLength(0);
  });
});
