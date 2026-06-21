import { describe, it, expect, vi } from 'vitest';
import {
  NotificationCenter,
  notifyFromSchedule,
} from '../agents/NotificationCenter';
import { SchedulerAgent }     from '../agents/SchedulerAgent';
import type { ExecutionStep } from '../agents/WorkflowAgent';
import type { ImpactLevel }   from '../ai/updatePackageEngine';

// ── helpers ────────────────────────────────────────────────────────────────────

type TemplateType   = 'procurementBands' | 'contractTypes' | 'fundSources';
type WorkflowAction = 'ROLLBACK' | 'APPLY' | 'SKIP';

function step(
  order:        number,
  action:       WorkflowAction,
  templateType: TemplateType = 'procurementBands',
  extra:        Partial<ExecutionStep> = {},
): ExecutionStep {
  return { order, action, templateType, reason: `r-${order}`, ...extra };
}

function synSchedule(opts: {
  executionPlan?:       readonly ExecutionStep[];
  waitingTasks?:        readonly ExecutionStep[];
  immediateTasks?:      readonly ExecutionStep[];
  requiresHumanReview?: boolean;
  impactLevel?:         ImpactLevel;
}) {
  return {
    requiresHumanReview: opts.requiresHumanReview ?? false,
    impactLevel:         (opts.impactLevel ?? 'LOW') as ImpactLevel,
    waitingTasks:        opts.waitingTasks   ?? [],
    immediateTasks:      opts.immediateTasks ?? [],
    executionPlan:       opts.executionPlan  ?? [],
  };
}

function stubScheduler(opts: Parameters<typeof synSchedule>[0]) {
  return vi.fn().mockReturnValue({
    ...synSchedule(opts),
    completedTasks: [],
  });
}

const SAME = { last: '2025-07-01', cur: '2025-07-01' };
const FWD  = { last: '2025-07-01', cur: '2026-01-01' };
const BWD  = { last: '2026-01-01', cur: '2025-07-01' };

// ── NC-01 no waiting tasks ─────────────────────────────────────────────────────
describe('NC-01 no waiting tasks', () => {
  it('NC-01-01: forward real data — approvalNotifications=[]', () => {
    const r = new NotificationCenter().notify(FWD.last, FWD.cur);
    expect(r.approvalNotifications).toHaveLength(0);
  });

  it('NC-01-02: same25 real data — approvalNotifications=[]', () => {
    const r = new NotificationCenter().notify(SAME.last, SAME.cur);
    expect(r.approvalNotifications).toHaveLength(0);
  });

  it('NC-01-03: SKIP-only synthetic — approvalNotifications=[]', () => {
    const plan = [step(1, 'SKIP'), step(2, 'SKIP', 'contractTypes')];
    const r = notifyFromSchedule(synSchedule({ executionPlan: plan }));
    expect(r.approvalNotifications).toHaveLength(0);
  });
});

// ── NC-02 waiting tasks ────────────────────────────────────────────────────────
describe('NC-02 waiting tasks', () => {
  it('NC-02-01: ROLLBACK in waitingTasks → approval notification generated', () => {
    const waiting = [step(1, 'ROLLBACK', 'procurementBands', { priority: 'HIGH' })];
    const r = notifyFromSchedule(synSchedule({ waitingTasks: waiting, impactLevel: 'HIGH' }));
    expect(r.approvalNotifications).toHaveLength(1);
  });

  it('NC-02-02: APPLY + humanReview=true in waitingTasks → approval notification', () => {
    const waiting = [step(1, 'APPLY')];
    const r = notifyFromSchedule(synSchedule({ waitingTasks: waiting, requiresHumanReview: true, impactLevel: 'MEDIUM' }));
    expect(r.approvalNotifications).toHaveLength(1);
  });

  it('NC-02-03: backward real — requiresHumanReview=true but waitingTasks=[] → no approval notification', () => {
    const r = new NotificationCenter().notify(BWD.last, BWD.cur);
    expect(r.requiresHumanReview).toBe(true);
    expect(r.approvalNotifications).toHaveLength(0);
  });
});

// ── NC-03 approval notification ────────────────────────────────────────────────
describe('NC-03 approval notification', () => {
  it('NC-03-01: severity equals impactLevel', () => {
    const waiting = [step(1, 'ROLLBACK', 'procurementBands', { priority: 'HIGH' })];
    const r = notifyFromSchedule(synSchedule({ waitingTasks: waiting, impactLevel: 'HIGH' }));
    expect(r.approvalNotifications[0].severity).toBe('HIGH');
  });

  it('NC-03-02: title is "Approval Required"', () => {
    const waiting = [step(1, 'ROLLBACK', 'procurementBands', { priority: 'CRITICAL' })];
    const r = notifyFromSchedule(synSchedule({ waitingTasks: waiting, impactLevel: 'CRITICAL' }));
    expect(r.approvalNotifications[0].title).toBe('Approval Required');
  });

  it('NC-03-03: message contains task count', () => {
    const waiting = [
      step(1, 'ROLLBACK', 'procurementBands', { priority: 'HIGH' }),
      step(2, 'APPLY', 'contractTypes'),
    ];
    const r = notifyFromSchedule(synSchedule({ waitingTasks: waiting, impactLevel: 'HIGH' }));
    expect(r.approvalNotifications[0].message).toBe('2 task(s) waiting for review');
  });
});

// ── NC-04 update notifications ─────────────────────────────────────────────────
describe('NC-04 update notifications', () => {
  it('NC-04-01: one notification per immediateTasks APPLY', () => {
    const immediate = [step(1, 'APPLY', 'procurementBands')];
    const r = notifyFromSchedule(synSchedule({ immediateTasks: immediate }));
    expect(r.updateNotifications).toHaveLength(1);
  });

  it('NC-04-02: severity = INFO', () => {
    const immediate = [step(1, 'APPLY', 'contractTypes')];
    const r = notifyFromSchedule(synSchedule({ immediateTasks: immediate }));
    expect(r.updateNotifications[0].severity).toBe('INFO');
  });

  it('NC-04-03: title = "Template Updated", message = templateType', () => {
    const immediate = [step(1, 'APPLY', 'fundSources')];
    const r = notifyFromSchedule(synSchedule({ immediateTasks: immediate }));
    expect(r.updateNotifications[0].title).toBe('Template Updated');
    expect(r.updateNotifications[0].message).toBe('fundSources');
  });
});

// ── NC-05 audit notifications ──────────────────────────────────────────────────
describe('NC-05 audit notifications', () => {
  it('NC-05-01: one notification per executionPlan step', () => {
    const plan = [step(1, 'APPLY'), step(2, 'SKIP', 'contractTypes'), step(3, 'SKIP', 'fundSources')];
    const r = notifyFromSchedule(synSchedule({ executionPlan: plan }));
    expect(r.auditNotifications).toHaveLength(3);
  });

  it('NC-05-02: real forward — 3 audit notifications for 3-SKIP plan', () => {
    const r = new NotificationCenter().notify(FWD.last, FWD.cur);
    expect(r.auditNotifications).toHaveLength(3);
  });

  it('NC-05-03: empty executionPlan → empty auditNotifications', () => {
    const r = notifyFromSchedule(synSchedule({ executionPlan: [] }));
    expect(r.auditNotifications).toHaveLength(0);
  });
});

// ── NC-06 rollback severity ────────────────────────────────────────────────────
describe('NC-06 rollback severity', () => {
  it('NC-06-01: ROLLBACK → severity = HIGH in audit', () => {
    const plan = [step(1, 'ROLLBACK', 'procurementBands', { priority: 'CRITICAL' })];
    const r = notifyFromSchedule(synSchedule({ executionPlan: plan }));
    expect(r.auditNotifications[0].severity).toBe('HIGH');
  });

  it('NC-06-02: multiple ROLLBACKs all HIGH', () => {
    const plan = [
      step(1, 'ROLLBACK', 'procurementBands', { priority: 'HIGH' }),
      step(2, 'ROLLBACK', 'contractTypes',    { priority: 'HIGH' }),
    ];
    const r = notifyFromSchedule(synSchedule({ executionPlan: plan }));
    expect(r.auditNotifications.every(n => n.severity === 'HIGH')).toBe(true);
  });

  it('NC-06-03: ROLLBACK in mixed plan has severity HIGH', () => {
    const plan = [
      step(1, 'ROLLBACK', 'procurementBands', { priority: 'HIGH' }),
      step(2, 'APPLY',    'contractTypes'),
      step(3, 'SKIP',     'fundSources'),
    ];
    const r = notifyFromSchedule(synSchedule({ executionPlan: plan }));
    expect(r.auditNotifications[0].severity).toBe('HIGH');
  });
});

// ── NC-07 apply severity ───────────────────────────────────────────────────────
describe('NC-07 apply severity', () => {
  it('NC-07-01: APPLY → severity = INFO in audit', () => {
    const r = notifyFromSchedule(synSchedule({ executionPlan: [step(1, 'APPLY')] }));
    expect(r.auditNotifications[0].severity).toBe('INFO');
  });

  it('NC-07-02: multiple APPLYs all INFO in audit', () => {
    const plan = [step(1, 'APPLY'), step(2, 'APPLY', 'contractTypes')];
    const r = notifyFromSchedule(synSchedule({ executionPlan: plan }));
    expect(r.auditNotifications.every(n => n.severity === 'INFO')).toBe(true);
  });

  it('NC-07-03: APPLY severity = INFO regardless of requiresHumanReview', () => {
    const plan = [step(1, 'APPLY')];
    const r1 = notifyFromSchedule(synSchedule({ executionPlan: plan, requiresHumanReview: false }));
    const r2 = notifyFromSchedule(synSchedule({ executionPlan: plan, requiresHumanReview: true }));
    expect(r1.auditNotifications[0].severity).toBe('INFO');
    expect(r2.auditNotifications[0].severity).toBe('INFO');
  });
});

// ── NC-08 skip severity ────────────────────────────────────────────────────────
describe('NC-08 skip severity', () => {
  it('NC-08-01: SKIP → severity = LOW in audit', () => {
    const r = notifyFromSchedule(synSchedule({ executionPlan: [step(1, 'SKIP')] }));
    expect(r.auditNotifications[0].severity).toBe('LOW');
  });

  it('NC-08-02: 3 real SKIPs from forward data → all LOW', () => {
    const r = new NotificationCenter().notify(FWD.last, FWD.cur);
    expect(r.auditNotifications.every(n => n.severity === 'LOW')).toBe(true);
  });

  it('NC-08-03: multiple synthetic SKIPs all LOW', () => {
    const plan = [step(1, 'SKIP'), step(2, 'SKIP', 'contractTypes'), step(3, 'SKIP', 'fundSources')];
    const r = notifyFromSchedule(synSchedule({ executionPlan: plan }));
    expect(r.auditNotifications.every(n => n.severity === 'LOW')).toBe(true);
  });
});

// ── NC-09 ordering ─────────────────────────────────────────────────────────────
describe('NC-09 ordering', () => {
  it('NC-09-01: auditNotifications follow executionPlan order (ROLLBACK,APPLY,SKIP)', () => {
    const plan = [
      step(1, 'ROLLBACK', 'procurementBands', { priority: 'HIGH' }),
      step(2, 'APPLY',    'contractTypes'),
      step(3, 'SKIP',     'fundSources'),
    ];
    const r = notifyFromSchedule(synSchedule({ executionPlan: plan }));
    expect(r.auditNotifications[0].title).toBe('ROLLBACK');
    expect(r.auditNotifications[1].title).toBe('APPLY');
    expect(r.auditNotifications[2].title).toBe('SKIP');
  });

  it('NC-09-02: real forward — all audit titles are "SKIP"', () => {
    const r = new NotificationCenter().notify(FWD.last, FWD.cur);
    r.auditNotifications.forEach(n => expect(n.title).toBe('SKIP'));
  });

  it('NC-09-03: audit message contains action and templateType', () => {
    const plan = [step(1, 'APPLY', 'fundSources')];
    const r = notifyFromSchedule(synSchedule({ executionPlan: plan }));
    expect(r.auditNotifications[0].message).toBe('APPLY fundSources');
  });
});

// ── NC-10 impactLevel propagation ──────────────────────────────────────────────
describe('NC-10 impactLevel propagation', () => {
  it('NC-10-01: LOW forwarded from same25', () => {
    const r = new NotificationCenter().notify(SAME.last, SAME.cur);
    expect(r.impactLevel).toBe('LOW');
  });

  it('NC-10-02: HIGH forwarded from forward real data', () => {
    const r = new NotificationCenter().notify(FWD.last, FWD.cur);
    expect(r.impactLevel).toBe('HIGH');
  });

  it('NC-10-03: CRITICAL forwarded from synthetic input', () => {
    const r = notifyFromSchedule(synSchedule({ impactLevel: 'CRITICAL' }));
    expect(r.impactLevel).toBe('CRITICAL');
  });
});

// ── NC-11 deterministic output ─────────────────────────────────────────────────
describe('NC-11 deterministic output', () => {
  it('NC-11-01: same real input → same auditNotifications length', () => {
    const center = new NotificationCenter();
    const r1 = center.notify(FWD.last, FWD.cur);
    const r2 = center.notify(FWD.last, FWD.cur);
    expect(r1.auditNotifications).toHaveLength(r2.auditNotifications.length);
  });

  it('NC-11-02: same synthetic input → identical notification arrays', () => {
    const plan = [step(1, 'APPLY', 'procurementBands'), step(2, 'SKIP', 'contractTypes')];
    const s = synSchedule({ executionPlan: plan });
    expect(notifyFromSchedule(s).auditNotifications).toEqual(notifyFromSchedule(s).auditNotifications);
  });

  it('NC-11-03: approval count is stable across calls with same data', () => {
    const waiting = [step(1, 'ROLLBACK', 'procurementBands', { priority: 'HIGH' })];
    const s = synSchedule({ waitingTasks: waiting, impactLevel: 'HIGH' });
    expect(notifyFromSchedule(s).approvalNotifications).toHaveLength(1);
    expect(notifyFromSchedule(s).approvalNotifications).toHaveLength(1);
  });
});

// ── NC-12 single SchedulerAgent call ───────────────────────────────────────────
describe('NC-12 single SchedulerAgent call', () => {
  it('NC-12-01: schedule() called exactly once per notify() call', () => {
    const spy = stubScheduler({});
    const center = new NotificationCenter({ schedule: spy } as unknown as SchedulerAgent);
    center.notify(SAME.last, SAME.cur);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('NC-12-02: schedule() called with correct date args', () => {
    const spy = stubScheduler({});
    const center = new NotificationCenter({ schedule: spy } as unknown as SchedulerAgent);
    center.notify(FWD.last, FWD.cur);
    expect(spy).toHaveBeenCalledWith(FWD.last, FWD.cur);
  });

  it('NC-12-03: two notify() calls → schedule() called twice', () => {
    const spy = stubScheduler({});
    const center = new NotificationCenter({ schedule: spy } as unknown as SchedulerAgent);
    center.notify(SAME.last, SAME.cur);
    center.notify(FWD.last, FWD.cur);
    expect(spy).toHaveBeenCalledTimes(2);
  });
});

// ── NC-13 backward compatibility ───────────────────────────────────────────────
describe('NC-13 backward compatibility', () => {
  it('NC-13-01: same25 — LOW, no approvals, no updates, 3 audit notifications', () => {
    const r = new NotificationCenter().notify(SAME.last, SAME.cur);
    expect(r.impactLevel).toBe('LOW');
    expect(r.approvalNotifications).toHaveLength(0);
    expect(r.updateNotifications).toHaveLength(0);
    expect(r.auditNotifications).toHaveLength(3);
  });

  it('NC-13-02: forward — HIGH, no approvals, no updates, all audit LOW', () => {
    const r = new NotificationCenter().notify(FWD.last, FWD.cur);
    expect(r.impactLevel).toBe('HIGH');
    expect(r.approvalNotifications).toHaveLength(0);
    expect(r.auditNotifications).toHaveLength(3);
    expect(r.auditNotifications.every(n => n.severity === 'LOW')).toBe(true);
  });

  it('NC-13-03: backward — humanReview=true, waitingTasks=[], no approval notifications', () => {
    const r = new NotificationCenter().notify(BWD.last, BWD.cur);
    expect(r.requiresHumanReview).toBe(true);
    expect(r.approvalNotifications).toHaveLength(0);
    expect(r.auditNotifications).toHaveLength(3);
  });
});
