/**
 * Legal v5.4 — RollbackManager
 *
 * buildRollbackPlan(lastAppliedDate, currentDate) → RollbackPlan
 *
 * Consumes a ReviewQueueResult and decides whether a rollback is required,
 * then distributes tasks into three buckets:
 *
 *   rollbackTasks — one per queue item (when requiresHumanReview = true)
 *   safeTasks     — autoApprovedTasks forwarded unchanged
 *   skippedTasks  — skippedTasks forwarded unchanged
 *
 * Rollback rules:
 *   requiresHumanReview = false → shouldRollback=false, rollbackTasks=[]
 *   requiresHumanReview = true  → shouldRollback=true;
 *                                  each queue item becomes a rollbackTask
 *                                  (templateType, reason, priority forwarded directly)
 *
 * Deduplication: same templateType appears at most once in rollbackTasks;
 * first occurrence is kept, later duplicates are dropped (insertion order).
 *
 * buildRollbackFromQueue() is exported so tests can inject synthetic
 * ReviewQueueResult objects for scenarios that cannot be produced from the
 * current two-version snapshot set (no template diffs in real data).
 *
 * Calls HumanReviewQueue.buildQueue() exactly once.
 * Never calls TemplateAutoUpdater, ChangeImpactAgent, LegalUpdateAgent,
 * or any v4.x engine directly.
 * Does NOT modify any existing engine, agent, or pipeline layer.
 * Backward compatibility remains 100% unchanged.
 *
 * Pure. Deterministic. No singleton. No cache. No side effects.
 * No LLM. No browser globals. No hooks. No IndexedDB. No UI.
 */

import { HumanReviewQueue } from './HumanReviewQueue';
import type { QueueItem, Priority } from './HumanReviewQueue';
import type { TemplateTask, TemplateType } from './TemplateAutoUpdater';
import type { ImpactLevel } from '../ai/updatePackageEngine';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface RollbackTask {
  templateType: TemplateType;
  reason:       string;
  priority:     Priority;
}

export interface RollbackPlan {
  shouldRollback:      boolean;
  rollbackTasks:       readonly RollbackTask[];
  safeTasks:           readonly TemplateTask[];
  skippedTasks:        readonly TemplateTask[];
  requiresHumanReview: boolean;
  impactLevel:         ImpactLevel;
}

// ─── Internal narrow type ─────────────────────────────────────────────────────

// Only the fields buildRollbackFromQueue actually reads.
interface MinQueue {
  requiresHumanReview: boolean;
  impactLevel:         ImpactLevel;
  queue:               readonly QueueItem[];
  autoApprovedTasks:   readonly TemplateTask[];
  skippedTasks:        readonly TemplateTask[];
}

// ─── Exported mapping helper ──────────────────────────────────────────────────

export function buildRollbackFromQueue(queueResult: MinQueue): RollbackPlan {
  const rollbackTasks: RollbackTask[] = [];

  if (queueResult.requiresHumanReview) {
    for (const item of queueResult.queue) {
      const alreadyPresent = rollbackTasks.some(r => r.templateType === item.templateType);
      if (!alreadyPresent) {
        rollbackTasks.push({
          templateType: item.templateType,
          reason:       item.reason,
          priority:     item.priority,
        });
      }
    }
  }

  return {
    shouldRollback:      queueResult.requiresHumanReview,
    rollbackTasks,
    safeTasks:           queueResult.autoApprovedTasks,
    skippedTasks:        queueResult.skippedTasks,
    requiresHumanReview: queueResult.requiresHumanReview,
    impactLevel:         queueResult.impactLevel,
  };
}

// ─── Agent ────────────────────────────────────────────────────────────────────

export class RollbackManager {
  constructor(private readonly hrq: HumanReviewQueue = new HumanReviewQueue()) {}

  buildRollbackPlan(lastAppliedDate: string, currentDate: string): RollbackPlan {
    return buildRollbackFromQueue(this.hrq.buildQueue(lastAppliedDate, currentDate));
  }
}
