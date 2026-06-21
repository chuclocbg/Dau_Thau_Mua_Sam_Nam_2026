/**
 * Legal v5.3 — HumanReviewQueue Tests
 *
 * HR-01..HR-13: 13 groups × 3 tests = 39 tests
 *
 * Note: placed in src/__tests__/ (not src/tests/) — vitest include pattern is
 * src/__tests__/**\/*.test.{ts,tsx}.
 *
 * Data facts (from versioned JSON snapshots via full agent stack):
 *   forward  2025-07-01 → 2026-01-01: HIGH, humanReview=false, no template diff
 *   backward 2026-01-01 → 2025-07-01: HIGH, humanReview=true,  no template diff
 *   same     2025-07-01 → 2025-07-01: LOW,  humanReview=false, no changes
 *
 * With real data, affectedTemplates is always empty (only thresholds change).
 * HR-02, HR-04, HR-06, HR-07, HR-09, HR-10 use buildQueueFromPlan() with
 * synthetic TemplateUpdatePlan objects to exercise queue-population paths.
 *
 * Groups:
 *   HR-01 LOW impact             — same: queue empty, skippedTasks 3
 *   HR-02 MEDIUM impact          — synthetic: queue item with priority MEDIUM
 *   HR-03 HIGH impact            — forward: queue empty, impactLevel HIGH
 *   HR-04 CRITICAL impact        — synthetic: queue item with priority CRITICAL
 *   HR-05 requiresHumanReview=false — queue forced to [], autoApproved populated
 *   HR-06 Queue generation       — REVIEW_MANUALLY → queue; REGENERATE → autoApproved
 *   HR-07 Auto-approved tasks    — REGENERATE tasks land in autoApprovedTasks
 *   HR-08 Skipped tasks          — SKIP tasks forwarded from plan unchanged
 *   HR-09 Priority mapping       — impactLevel ↔ queue priority 1-to-1
 *   HR-10 Deduplication          — same templateType appears at most once in queue
 *   HR-11 Deterministic order    — repeated calls produce identical output
 *   HR-12 Single TemplateAutoUpdater call — spy verifies planTemplateUpdates once
 *   HR-13 Backward compatibility — pre-history fallback dates work
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HumanReviewQueue, buildQueueFromPlan } from '../agents/HumanReviewQueue';
import { TemplateAutoUpdater } from '../agents/TemplateAutoUpdater';
import type { TemplateType, TemplateAction, TemplateTask } from '../agents/TemplateAutoUpdater';
import type { ImpactLevel } from '../ai/updatePackageEngine';

// ─── Real-data helpers ────────────────────────────────────────────────────────

let hrq: HumanReviewQueue;

beforeEach(() => { hrq = new HumanReviewQueue(); });

const same25   = () => hrq.buildQueue('2025-07-01', '2025-07-01');
const forward  = () => hrq.buildQueue('2025-07-01', '2026-01-01');
const backward = () => hrq.buildQueue('2026-01-01', '2025-07-01');

// ─── Synthetic-data helpers ───────────────────────────────────────────────────

function makeTask(templateType: TemplateType, action: TemplateAction, reason = 'test reason'): TemplateTask {
  return { templateType, action, reason };
}

function synPlan(
  updateTasks:         TemplateTask[],
  skippedTasks:        TemplateTask[],
  impactLevel:         ImpactLevel,
  requiresHumanReview  = false,
) {
  return { requiresHumanReview, impactLevel, updateTasks, skippedTasks };
}

// ─── HR-01: LOW impact ────────────────────────────────────────────────────────

describe('HR-01: LOW impact — same date: queue empty, 3 skipped', () => {
  it('HR-01-01 requiresHumanReview is false', () => {
    expect(same25().requiresHumanReview).toBe(false);
  });

  it('HR-01-02 impactLevel is LOW', () => {
    expect(same25().impactLevel).toBe('LOW');
  });

  it('HR-01-03 queue is empty', () => {
    expect(same25().queue).toHaveLength(0);
  });
});

// ─── HR-02: MEDIUM impact (synthetic) ────────────────────────────────────────

describe('HR-02: MEDIUM impact — synthetic: queue item with priority MEDIUM', () => {
  const medPlan = synPlan(
    [makeTask('contractTypes', 'REGENERATE'), makeTask('contractTypes', 'REVIEW_MANUALLY', 'review reason')],
    [makeTask('procurementBands', 'SKIP'), makeTask('fundSources', 'SKIP')],
    'MEDIUM',
    true,
  );

  it('HR-02-01 impactLevel is MEDIUM', () => {
    expect(buildQueueFromPlan(medPlan).impactLevel).toBe('MEDIUM');
  });

  it('HR-02-02 queue item has priority MEDIUM', () => {
    const q = buildQueueFromPlan(medPlan).queue;
    expect(q[0]?.priority).toBe('MEDIUM');
  });

  it('HR-02-03 queue is non-empty', () => {
    expect(buildQueueFromPlan(medPlan).queue.length).toBeGreaterThan(0);
  });
});

// ─── HR-03: HIGH impact ───────────────────────────────────────────────────────

describe('HR-03: HIGH impact — forward diff: impactLevel HIGH, queue empty', () => {
  it('HR-03-01 impactLevel is HIGH', () => {
    expect(forward().impactLevel).toBe('HIGH');
  });

  it('HR-03-02 queue is empty (no template changes in forward diff)', () => {
    expect(forward().queue).toHaveLength(0);
  });

  it('HR-03-03 skippedTasks has 3 entries (all template types)', () => {
    expect(forward().skippedTasks).toHaveLength(3);
  });
});

// ─── HR-04: CRITICAL impact (synthetic) ──────────────────────────────────────

describe('HR-04: CRITICAL impact — synthetic: queue priority CRITICAL', () => {
  const critPlan = synPlan(
    [makeTask('procurementBands', 'REGENERATE'), makeTask('procurementBands', 'REVIEW_MANUALLY', 'critical review')],
    [makeTask('contractTypes', 'SKIP'), makeTask('fundSources', 'SKIP')],
    'CRITICAL',
    true,
  );

  it('HR-04-01 impactLevel is CRITICAL', () => {
    expect(buildQueueFromPlan(critPlan).impactLevel).toBe('CRITICAL');
  });

  it('HR-04-02 queue item has priority CRITICAL', () => {
    expect(buildQueueFromPlan(critPlan).queue[0]?.priority).toBe('CRITICAL');
  });

  it('HR-04-03 autoApprovedTasks contains the REGENERATE task alongside the queue entry', () => {
    const r = buildQueueFromPlan(critPlan);
    expect(r.queue.length).toBeGreaterThan(0);
    expect(r.autoApprovedTasks.some(t => t.action === 'REGENERATE')).toBe(true);
  });
});

// ─── HR-05: requiresHumanReview=false ────────────────────────────────────────

describe('HR-05: requiresHumanReview=false — queue forced to [], REGENERATE auto-approved', () => {
  it('HR-05-01 forward (HIGH, humanReview=false) → queue is empty', () => {
    expect(forward().queue).toHaveLength(0);
  });

  it('HR-05-02 same25 (LOW, humanReview=false) → queue is empty', () => {
    expect(same25().queue).toHaveLength(0);
  });

  it('HR-05-03 synthetic humanReview=false with REGENERATE → queue=[], autoApproved populated', () => {
    const plan = synPlan([makeTask('contractTypes', 'REGENERATE')], [], 'HIGH', false);
    const r = buildQueueFromPlan(plan);
    expect(r.queue).toHaveLength(0);
    expect(r.autoApprovedTasks).toHaveLength(1);
  });
});

// ─── HR-06: Queue generation ──────────────────────────────────────────────────

describe('HR-06: Only REVIEW_MANUALLY tasks enter the queue', () => {
  const mixedPlan = synPlan(
    [
      makeTask('procurementBands', 'REGENERATE', 'regen'),
      makeTask('procurementBands', 'REVIEW_MANUALLY', 'review this'),
    ],
    [makeTask('contractTypes', 'SKIP')],
    'HIGH',
    true,
  );

  it('HR-06-01 REGENERATE task does not enter queue', () => {
    const q = buildQueueFromPlan(mixedPlan).queue;
    expect(q.every(item => item.templateType !== 'procurementBands' || item.priority)).toBe(true);
    // Queue items only come from REVIEW_MANUALLY — verify length is 1 not 2
    expect(q).toHaveLength(1);
  });

  it('HR-06-02 REVIEW_MANUALLY task → queue item with correct templateType', () => {
    const q = buildQueueFromPlan(mixedPlan).queue;
    expect(q[0]?.templateType).toBe('procurementBands');
  });

  it('HR-06-03 queue item reason matches task.reason verbatim', () => {
    const q = buildQueueFromPlan(mixedPlan).queue;
    expect(q[0]?.reason).toBe('review this');
  });
});

// ─── HR-07: Auto-approved tasks ───────────────────────────────────────────────

describe('HR-07: REGENERATE tasks go to autoApprovedTasks', () => {
  const regenPlan = synPlan(
    [makeTask('contractTypes', 'REGENERATE', 'regen reason'), makeTask('fundSources', 'REGENERATE', 'regen 2')],
    [makeTask('procurementBands', 'SKIP')],
    'MEDIUM',
    false,
  );

  it('HR-07-01 REGENERATE tasks land in autoApprovedTasks', () => {
    expect(buildQueueFromPlan(regenPlan).autoApprovedTasks).toHaveLength(2);
  });

  it('HR-07-02 all autoApprovedTasks have action REGENERATE', () => {
    expect(buildQueueFromPlan(regenPlan).autoApprovedTasks.every(t => t.action === 'REGENERATE')).toBe(true);
  });

  it('HR-07-03 REVIEW_MANUALLY tasks do NOT appear in autoApprovedTasks', () => {
    const plan = synPlan(
      [makeTask('contractTypes', 'REVIEW_MANUALLY')],
      [],
      'HIGH',
      true,
    );
    expect(buildQueueFromPlan(plan).autoApprovedTasks).toHaveLength(0);
  });
});

// ─── HR-08: Skipped tasks ─────────────────────────────────────────────────────

describe('HR-08: SKIP tasks forwarded unchanged from plan', () => {
  it('HR-08-01 forward → skippedTasks has 3 entries', () => {
    expect(forward().skippedTasks).toHaveLength(3);
  });

  it('HR-08-02 all skippedTasks have action SKIP', () => {
    expect(forward().skippedTasks.every(t => t.action === 'SKIP')).toBe(true);
  });

  it('HR-08-03 synthetic skippedTasks forwarded verbatim from plan', () => {
    const plan = synPlan(
      [],
      [makeTask('procurementBands', 'SKIP', 'my skip reason')],
      'LOW',
      false,
    );
    const r = buildQueueFromPlan(plan);
    expect(r.skippedTasks[0]?.reason).toBe('my skip reason');
  });
});

// ─── HR-09: Priority mapping ──────────────────────────────────────────────────

describe('HR-09: Queue priority maps 1-to-1 from impactLevel', () => {
  const reviewTask = makeTask('procurementBands', 'REVIEW_MANUALLY', 'needs review');

  it('HR-09-01 impactLevel HIGH → queue priority HIGH', () => {
    const r = buildQueueFromPlan(synPlan([reviewTask], [], 'HIGH', true));
    expect(r.queue[0]?.priority).toBe('HIGH');
  });

  it('HR-09-02 impactLevel MEDIUM → queue priority MEDIUM', () => {
    const r = buildQueueFromPlan(synPlan([reviewTask], [], 'MEDIUM', true));
    expect(r.queue[0]?.priority).toBe('MEDIUM');
  });

  it('HR-09-03 impactLevel CRITICAL → queue priority CRITICAL', () => {
    const r = buildQueueFromPlan(synPlan([reviewTask], [], 'CRITICAL', true));
    expect(r.queue[0]?.priority).toBe('CRITICAL');
  });
});

// ─── HR-10: Deduplication ────────────────────────────────────────────────────

describe('HR-10: Same templateType appears at most once in queue (first occurrence kept)', () => {
  const dupPlan = synPlan(
    [
      makeTask('contractTypes', 'REVIEW_MANUALLY', 'first'),
      makeTask('contractTypes', 'REVIEW_MANUALLY', 'duplicate'),
    ],
    [],
    'HIGH',
    true,
  );

  it('HR-10-01 duplicate REVIEW_MANUALLY for same type → one queue entry', () => {
    expect(buildQueueFromPlan(dupPlan).queue).toHaveLength(1);
  });

  it('HR-10-02 first occurrence reason is preserved (not the duplicate)', () => {
    expect(buildQueueFromPlan(dupPlan).queue[0]?.reason).toBe('first');
  });

  it('HR-10-03 forward → queue has no duplicates (trivially: queue is empty)', () => {
    const q = forward().queue;
    const typeSet = new Set(q.map(item => item.templateType));
    expect(typeSet.size).toBe(q.length);
  });
});

// ─── HR-11: Deterministic order ──────────────────────────────────────────────

describe('HR-11: Repeated calls produce identical output', () => {
  it('HR-11-01 forward twice → same impactLevel', () => {
    expect(forward().impactLevel).toBe(forward().impactLevel);
  });

  it('HR-11-02 same25 twice → same skippedTasks length', () => {
    expect(same25().skippedTasks.length).toBe(same25().skippedTasks.length);
  });

  it('HR-11-03 synthetic twice → same queue length', () => {
    const plan = synPlan([makeTask('procurementBands', 'REVIEW_MANUALLY')], [], 'HIGH', true);
    expect(buildQueueFromPlan(plan).queue.length).toBe(buildQueueFromPlan(plan).queue.length);
  });
});

// ─── HR-12: Single TemplateAutoUpdater call ───────────────────────────────────

describe('HR-12: HumanReviewQueue calls planTemplateUpdates exactly once', () => {
  it('HR-12-01 planTemplateUpdates called exactly once per buildQueue', () => {
    const realPlan = new TemplateAutoUpdater().planTemplateUpdates('2025-07-01', '2025-07-01');
    const spy = vi.fn().mockReturnValue(realPlan);
    const q = new HumanReviewQueue({ planTemplateUpdates: spy } as unknown as TemplateAutoUpdater);
    q.buildQueue('2025-07-01', '2025-07-01');
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('HR-12-02 impactLevel matches injected TemplateAutoUpdater result', () => {
    const realPlan = new TemplateAutoUpdater().planTemplateUpdates('2025-07-01', '2026-01-01');
    const spy = vi.fn().mockReturnValue(realPlan);
    const q = new HumanReviewQueue({ planTemplateUpdates: spy } as unknown as TemplateAutoUpdater);
    expect(q.buildQueue('2025-07-01', '2026-01-01').impactLevel).toBe(realPlan.impactLevel);
  });

  it('HR-12-03 requiresHumanReview matches injected result', () => {
    const realPlan = new TemplateAutoUpdater().planTemplateUpdates('2026-01-01', '2025-07-01');
    const spy = vi.fn().mockReturnValue(realPlan);
    const q = new HumanReviewQueue({ planTemplateUpdates: spy } as unknown as TemplateAutoUpdater);
    expect(q.buildQueue('2026-01-01', '2025-07-01').requiresHumanReview).toBe(realPlan.requiresHumanReview);
  });
});

// ─── HR-13: Backward compatibility ───────────────────────────────────────────

describe('HR-13: Backward compatibility / fallback dates', () => {
  it('HR-13-01 pre-history date does not throw', () => {
    expect(() => hrq.buildQueue('2020-01-01', '2025-07-01')).not.toThrow();
  });

  it('HR-13-02 pre-history vs 2026-01-01 → impactLevel is not LOW', () => {
    expect(hrq.buildQueue('2020-01-01', '2026-01-01').impactLevel).not.toBe('LOW');
  });

  it('HR-13-03 result has all required fields', () => {
    const r = forward();
    expect(r).toHaveProperty('requiresHumanReview');
    expect(r).toHaveProperty('impactLevel');
    expect(r).toHaveProperty('queue');
    expect(r).toHaveProperty('autoApprovedTasks');
    expect(r).toHaveProperty('skippedTasks');
  });
});
