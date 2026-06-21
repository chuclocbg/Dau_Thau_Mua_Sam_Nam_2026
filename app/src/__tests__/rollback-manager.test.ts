/**
 * Legal v5.4 — RollbackManager Tests
 *
 * RB-01..RB-13: 13 groups × 3 tests = 39 tests
 *
 * Note: placed in src/__tests__/ (not src/tests/) — vitest include pattern is
 * src/__tests__/**\/*.test.{ts,tsx}.
 *
 * Data facts (from versioned JSON snapshots via full agent stack):
 *   forward  2025-07-01 → 2026-01-01: HIGH, humanReview=false, queue=[]
 *   backward 2026-01-01 → 2025-07-01: HIGH, humanReview=true,  queue=[]
 *   same     2025-07-01 → 2025-07-01: LOW,  humanReview=false, queue=[]
 *
 * With real data, queue is always empty (no template diffs) and
 * rollbackTasks is therefore always empty regardless of shouldRollback.
 * RB-03, RB-04, RB-06, RB-07, RB-08, RB-09 use buildRollbackFromQueue()
 * with synthetic ReviewQueueResult objects to exercise rollback-task paths.
 *
 * Key real-data invariant:
 *   backward → shouldRollback=true AND rollbackTasks=[] (queue is empty
 *   because no template types changed, even though humanReview is required)
 *
 * Groups:
 *   RB-01 No human review       — same/forward: shouldRollback false
 *   RB-02 Requires human review — backward: shouldRollback true, rollbackTasks []
 *   RB-03 Rollback generation   — synthetic: queue items → rollbackTasks
 *   RB-04 Safe tasks            — autoApprovedTasks forwarded as safeTasks
 *   RB-05 Skipped tasks         — skippedTasks forwarded unchanged
 *   RB-06 Priority forwarding   — queue item priority → rollbackTask priority
 *   RB-07 Reason forwarding     — queue item reason → rollbackTask reason verbatim
 *   RB-08 Template forwarding   — queue item templateType → rollbackTask templateType
 *   RB-09 Deduplication         — same templateType appears once in rollbackTasks
 *   RB-10 Deterministic order   — repeated calls produce identical output
 *   RB-11 shouldRollback flag   — equals requiresHumanReview exactly
 *   RB-12 Single HumanReviewQueue call — spy verifies buildQueue called once
 *   RB-13 Backward compatibility — pre-history fallback dates work
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RollbackManager, buildRollbackFromQueue } from '../agents/RollbackManager';
import { HumanReviewQueue } from '../agents/HumanReviewQueue';
import type { QueueItem, Priority } from '../agents/HumanReviewQueue';
import type { TemplateTask, TemplateType, TemplateAction } from '../agents/TemplateAutoUpdater';
import type { ImpactLevel } from '../ai/updatePackageEngine';

// ─── Real-data helpers ────────────────────────────────────────────────────────

let rm: RollbackManager;

beforeEach(() => { rm = new RollbackManager(); });

const same25   = () => rm.buildRollbackPlan('2025-07-01', '2025-07-01');
const forward  = () => rm.buildRollbackPlan('2025-07-01', '2026-01-01');
const backward = () => rm.buildRollbackPlan('2026-01-01', '2025-07-01');

// ─── Synthetic-data helpers ───────────────────────────────────────────────────

function qItem(templateType: TemplateType, priority: Priority, reason = 'queue reason'): QueueItem {
  return { templateType, priority, reason };
}

function tTask(templateType: TemplateType, action: TemplateAction, reason = 'task reason'): TemplateTask {
  return { templateType, action, reason };
}

function synQueue(
  queue:               QueueItem[],
  autoApprovedTasks:   TemplateTask[],
  skippedTasks:        TemplateTask[],
  impactLevel:         ImpactLevel,
  requiresHumanReview  = false,
) {
  return { queue, autoApprovedTasks, skippedTasks, impactLevel, requiresHumanReview };
}

// ─── RB-01: No human review ───────────────────────────────────────────────────

describe('RB-01: requiresHumanReview=false → shouldRollback false, rollbackTasks empty', () => {
  it('RB-01-01 same25 → shouldRollback false', () => {
    expect(same25().shouldRollback).toBe(false);
  });

  it('RB-01-02 forward → shouldRollback false', () => {
    expect(forward().shouldRollback).toBe(false);
  });

  it('RB-01-03 same25 → rollbackTasks empty', () => {
    expect(same25().rollbackTasks).toHaveLength(0);
  });
});

// ─── RB-02: Requires human review ────────────────────────────────────────────

describe('RB-02: requiresHumanReview=true → shouldRollback true (backward diff)', () => {
  it('RB-02-01 backward → requiresHumanReview true', () => {
    expect(backward().requiresHumanReview).toBe(true);
  });

  it('RB-02-02 backward → shouldRollback true', () => {
    expect(backward().shouldRollback).toBe(true);
  });

  it('RB-02-03 backward → rollbackTasks empty (queue empty despite humanReview — no template diffs)', () => {
    const r = backward();
    expect(r.shouldRollback).toBe(true);
    expect(r.rollbackTasks).toHaveLength(0);
  });
});

// ─── RB-03: Rollback generation (synthetic) ───────────────────────────────────

describe('RB-03: Queue items → rollbackTasks when requiresHumanReview=true', () => {
  const syn = synQueue(
    [qItem('procurementBands', 'HIGH', 'procurementBands needs review')],
    [tTask('procurementBands', 'REGENERATE')],
    [tTask('contractTypes', 'SKIP'), tTask('fundSources', 'SKIP')],
    'HIGH',
    true,
  );

  it('RB-03-01 synthetic with queue item → rollbackTasks non-empty', () => {
    expect(buildRollbackFromQueue(syn).rollbackTasks.length).toBeGreaterThan(0);
  });

  it('RB-03-02 rollbackTask has correct templateType', () => {
    expect(buildRollbackFromQueue(syn).rollbackTasks[0]?.templateType).toBe('procurementBands');
  });

  it('RB-03-03 synthetic with 2 queue items → 2 rollbackTasks', () => {
    const twoItems = synQueue(
      [qItem('procurementBands', 'HIGH'), qItem('contractTypes', 'HIGH')],
      [],
      [tTask('fundSources', 'SKIP')],
      'HIGH',
      true,
    );
    expect(buildRollbackFromQueue(twoItems).rollbackTasks).toHaveLength(2);
  });
});

// ─── RB-04: Safe tasks ────────────────────────────────────────────────────────

describe('RB-04: autoApprovedTasks forwarded as safeTasks', () => {
  it('RB-04-01 synthetic → safeTasks contains the REGENERATE task', () => {
    const syn = synQueue(
      [],
      [tTask('contractTypes', 'REGENERATE', 'auto regen')],
      [tTask('procurementBands', 'SKIP'), tTask('fundSources', 'SKIP')],
      'MEDIUM',
      false,
    );
    const r = buildRollbackFromQueue(syn);
    expect(r.safeTasks).toHaveLength(1);
    expect(r.safeTasks[0]?.templateType).toBe('contractTypes');
  });

  it('RB-04-02 safeTasks action is REGENERATE', () => {
    const syn = synQueue(
      [],
      [tTask('fundSources', 'REGENERATE')],
      [],
      'MEDIUM',
      false,
    );
    expect(buildRollbackFromQueue(syn).safeTasks[0]?.action).toBe('REGENERATE');
  });

  it('RB-04-03 same25 → safeTasks empty (no autoApproved tasks)', () => {
    expect(same25().safeTasks).toHaveLength(0);
  });
});

// ─── RB-05: Skipped tasks ─────────────────────────────────────────────────────

describe('RB-05: skippedTasks forwarded unchanged from queue result', () => {
  it('RB-05-01 forward → skippedTasks has 3 entries', () => {
    expect(forward().skippedTasks).toHaveLength(3);
  });

  it('RB-05-02 all skippedTasks have action SKIP', () => {
    expect(forward().skippedTasks.every(t => t.action === 'SKIP')).toBe(true);
  });

  it('RB-05-03 synthetic → skippedTasks reason forwarded verbatim', () => {
    const syn = synQueue(
      [],
      [],
      [tTask('procurementBands', 'SKIP', 'my skip reason')],
      'LOW',
      false,
    );
    expect(buildRollbackFromQueue(syn).skippedTasks[0]?.reason).toBe('my skip reason');
  });
});

// ─── RB-06: Priority forwarding ──────────────────────────────────────────────

describe('RB-06: Queue item priority forwarded directly to rollbackTask', () => {
  it('RB-06-01 priority HIGH forwarded', () => {
    const r = buildRollbackFromQueue(synQueue([qItem('procurementBands', 'HIGH')], [], [], 'HIGH', true));
    expect(r.rollbackTasks[0]?.priority).toBe('HIGH');
  });

  it('RB-06-02 priority CRITICAL forwarded', () => {
    const r = buildRollbackFromQueue(synQueue([qItem('contractTypes', 'CRITICAL')], [], [], 'CRITICAL', true));
    expect(r.rollbackTasks[0]?.priority).toBe('CRITICAL');
  });

  it('RB-06-03 priority MEDIUM forwarded', () => {
    const r = buildRollbackFromQueue(synQueue([qItem('fundSources', 'MEDIUM')], [], [], 'MEDIUM', true));
    expect(r.rollbackTasks[0]?.priority).toBe('MEDIUM');
  });
});

// ─── RB-07: Reason forwarding ─────────────────────────────────────────────────

describe('RB-07: Queue item reason forwarded verbatim to rollbackTask', () => {
  it('RB-07-01 reason string preserved exactly', () => {
    const r = buildRollbackFromQueue(
      synQueue([qItem('procurementBands', 'HIGH', 'exact reason string')], [], [], 'HIGH', true),
    );
    expect(r.rollbackTasks[0]?.reason).toBe('exact reason string');
  });

  it('RB-07-02 reason with special characters preserved', () => {
    const r = buildRollbackFromQueue(
      synQueue([qItem('contractTypes', 'HIGH', 'reason: tên mẫu thay đổi')], [], [], 'HIGH', true),
    );
    expect(r.rollbackTasks[0]?.reason).toBe('reason: tên mẫu thay đổi');
  });

  it('RB-07-03 each rollbackTask reason matches its queue item', () => {
    const items = [
      qItem('procurementBands', 'HIGH', 'reason A'),
      qItem('contractTypes', 'HIGH', 'reason B'),
    ];
    const r = buildRollbackFromQueue(synQueue(items, [], [], 'HIGH', true));
    expect(r.rollbackTasks[0]?.reason).toBe('reason A');
    expect(r.rollbackTasks[1]?.reason).toBe('reason B');
  });
});

// ─── RB-08: Template type forwarding ─────────────────────────────────────────

describe('RB-08: Queue item templateType forwarded to rollbackTask', () => {
  it('RB-08-01 procurementBands queue item → procurementBands rollbackTask', () => {
    const r = buildRollbackFromQueue(synQueue([qItem('procurementBands', 'HIGH')], [], [], 'HIGH', true));
    expect(r.rollbackTasks[0]?.templateType).toBe('procurementBands');
  });

  it('RB-08-02 contractTypes queue item → contractTypes rollbackTask', () => {
    const r = buildRollbackFromQueue(synQueue([qItem('contractTypes', 'MEDIUM')], [], [], 'MEDIUM', true));
    expect(r.rollbackTasks[0]?.templateType).toBe('contractTypes');
  });

  it('RB-08-03 fundSources queue item → fundSources rollbackTask', () => {
    const r = buildRollbackFromQueue(synQueue([qItem('fundSources', 'CRITICAL')], [], [], 'CRITICAL', true));
    expect(r.rollbackTasks[0]?.templateType).toBe('fundSources');
  });
});

// ─── RB-09: Deduplication ────────────────────────────────────────────────────

describe('RB-09: Same templateType appears at most once in rollbackTasks', () => {
  const dupSyn = synQueue(
    [
      qItem('procurementBands', 'HIGH', 'first'),
      qItem('procurementBands', 'HIGH', 'duplicate'),
    ],
    [],
    [],
    'HIGH',
    true,
  );

  it('RB-09-01 duplicate templateType in queue → one rollbackTask', () => {
    expect(buildRollbackFromQueue(dupSyn).rollbackTasks).toHaveLength(1);
  });

  it('RB-09-02 first occurrence reason is preserved', () => {
    expect(buildRollbackFromQueue(dupSyn).rollbackTasks[0]?.reason).toBe('first');
  });

  it('RB-09-03 backward → rollbackTasks has no duplicates (trivially: it is empty)', () => {
    const tasks = backward().rollbackTasks;
    const typeSet = new Set(tasks.map(t => t.templateType));
    expect(typeSet.size).toBe(tasks.length);
  });
});

// ─── RB-10: Deterministic order ──────────────────────────────────────────────

describe('RB-10: Repeated calls produce identical output', () => {
  it('RB-10-01 backward twice → same shouldRollback', () => {
    expect(backward().shouldRollback).toBe(backward().shouldRollback);
  });

  it('RB-10-02 same25 twice → same skippedTasks length', () => {
    expect(same25().skippedTasks.length).toBe(same25().skippedTasks.length);
  });

  it('RB-10-03 synthetic twice → same rollbackTasks order', () => {
    const syn = synQueue(
      [qItem('procurementBands', 'HIGH', 'r1'), qItem('contractTypes', 'HIGH', 'r2')],
      [],
      [],
      'HIGH',
      true,
    );
    const a = buildRollbackFromQueue(syn);
    const b = buildRollbackFromQueue(syn);
    expect(a.rollbackTasks.map(t => t.templateType)).toEqual(b.rollbackTasks.map(t => t.templateType));
  });
});

// ─── RB-11: shouldRollback flag ──────────────────────────────────────────────

describe('RB-11: shouldRollback equals requiresHumanReview exactly', () => {
  it('RB-11-01 requiresHumanReview=false → shouldRollback false', () => {
    const r = buildRollbackFromQueue(synQueue([], [], [], 'MEDIUM', false));
    expect(r.shouldRollback).toBe(false);
  });

  it('RB-11-02 requiresHumanReview=true → shouldRollback true', () => {
    const r = buildRollbackFromQueue(synQueue([], [], [], 'HIGH', true));
    expect(r.shouldRollback).toBe(true);
  });

  it('RB-11-03 shouldRollback === requiresHumanReview for all real scenarios', () => {
    expect(same25().shouldRollback).toBe(same25().requiresHumanReview);
    expect(forward().shouldRollback).toBe(forward().requiresHumanReview);
    expect(backward().shouldRollback).toBe(backward().requiresHumanReview);
  });
});

// ─── RB-12: Single HumanReviewQueue call ─────────────────────────────────────

describe('RB-12: RollbackManager calls buildQueue exactly once per buildRollbackPlan', () => {
  it('RB-12-01 buildQueue called exactly once', () => {
    const realResult = new HumanReviewQueue().buildQueue('2025-07-01', '2025-07-01');
    const spy = vi.fn().mockReturnValue(realResult);
    const mgr = new RollbackManager({ buildQueue: spy } as unknown as HumanReviewQueue);
    mgr.buildRollbackPlan('2025-07-01', '2025-07-01');
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('RB-12-02 impactLevel matches injected HumanReviewQueue result', () => {
    const realResult = new HumanReviewQueue().buildQueue('2025-07-01', '2026-01-01');
    const spy = vi.fn().mockReturnValue(realResult);
    const mgr = new RollbackManager({ buildQueue: spy } as unknown as HumanReviewQueue);
    expect(mgr.buildRollbackPlan('2025-07-01', '2026-01-01').impactLevel).toBe(realResult.impactLevel);
  });

  it('RB-12-03 requiresHumanReview matches injected result', () => {
    const realResult = new HumanReviewQueue().buildQueue('2026-01-01', '2025-07-01');
    const spy = vi.fn().mockReturnValue(realResult);
    const mgr = new RollbackManager({ buildQueue: spy } as unknown as HumanReviewQueue);
    expect(mgr.buildRollbackPlan('2026-01-01', '2025-07-01').requiresHumanReview).toBe(realResult.requiresHumanReview);
  });
});

// ─── RB-13: Backward compatibility ───────────────────────────────────────────

describe('RB-13: Backward compatibility / fallback dates', () => {
  it('RB-13-01 pre-history date does not throw', () => {
    expect(() => rm.buildRollbackPlan('2020-01-01', '2025-07-01')).not.toThrow();
  });

  it('RB-13-02 pre-history vs 2026-01-01 → impactLevel is not LOW', () => {
    expect(rm.buildRollbackPlan('2020-01-01', '2026-01-01').impactLevel).not.toBe('LOW');
  });

  it('RB-13-03 result has all required fields', () => {
    const r = forward();
    expect(r).toHaveProperty('shouldRollback');
    expect(r).toHaveProperty('rollbackTasks');
    expect(r).toHaveProperty('safeTasks');
    expect(r).toHaveProperty('skippedTasks');
    expect(r).toHaveProperty('requiresHumanReview');
    expect(r).toHaveProperty('impactLevel');
  });
});
