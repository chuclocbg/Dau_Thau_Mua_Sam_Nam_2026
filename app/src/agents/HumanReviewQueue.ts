/**
 * Legal v5.3 — HumanReviewQueue
 *
 * buildQueue(lastAppliedDate, currentDate) → ReviewQueueResult
 *
 * Consumes a TemplateUpdatePlan and distributes tasks into three buckets:
 *
 *   queue            — REVIEW_MANUALLY tasks requiring human sign-off
 *   autoApprovedTasks — REGENERATE tasks that can proceed without review
 *   skippedTasks     — SKIP tasks forwarded unchanged from the plan
 *
 * Queue-entry rules:
 *   Only action === 'REVIEW_MANUALLY' tasks enter the queue.
 *   Priority is derived 1-to-1 from impactLevel (CRITICAL/HIGH/MEDIUM/LOW).
 *   reason is copied verbatim from the source task.
 *   If requiresHumanReview = false: queue is forced to []; REGENERATE tasks
 *   still go to autoApprovedTasks (no change to that path).
 *
 * Deduplication: same templateType appears at most once in the queue;
 * first occurrence is kept, later duplicates are dropped (insertion order).
 *
 * buildQueueFromPlan() is exported so tests can inject synthetic plans for
 * scenarios (template changes, MEDIUM/CRITICAL levels) that cannot be
 * produced from the current two-version snapshot set.
 *
 * Calls TemplateAutoUpdater.planTemplateUpdates() exactly once.
 * Never calls ChangeImpactAgent, LegalUpdateAgent, or any v4.x engine.
 * Does NOT modify any existing engine, agent, or pipeline layer.
 * Backward compatibility remains 100% unchanged.
 *
 * Pure. Deterministic. No singleton. No cache. No side effects.
 * No LLM. No browser globals. No hooks. No IndexedDB. No UI.
 */

import { TemplateAutoUpdater } from './TemplateAutoUpdater';
import type { TemplateTask, TemplateType } from './TemplateAutoUpdater';
import type { ImpactLevel } from '../ai/updatePackageEngine';

// ─── Public types ─────────────────────────────────────────────────────────────

export type Priority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface QueueItem {
  templateType: TemplateType;
  priority:     Priority;
  reason:       string;
}

export interface ReviewQueueResult {
  requiresHumanReview: boolean;
  impactLevel:         ImpactLevel;
  queue:               readonly QueueItem[];
  autoApprovedTasks:   readonly TemplateTask[];
  skippedTasks:        readonly TemplateTask[];
}

// ─── Internal narrow type ─────────────────────────────────────────────────────

// Only the fields buildQueueFromPlan actually reads.
interface MinPlan {
  requiresHumanReview: boolean;
  impactLevel:         ImpactLevel;
  updateTasks:         readonly TemplateTask[];
  skippedTasks:        readonly TemplateTask[];
}

// ─── Exported mapping helper ──────────────────────────────────────────────────

export function buildQueueFromPlan(plan: MinPlan): ReviewQueueResult {
  const queue:             QueueItem[]   = [];
  const autoApprovedTasks: TemplateTask[] = [];

  for (const task of plan.updateTasks) {
    if (task.action === 'REVIEW_MANUALLY') {
      const alreadyQueued = queue.some(q => q.templateType === task.templateType);
      if (!alreadyQueued) {
        queue.push({
          templateType: task.templateType,
          priority:     plan.impactLevel,
          reason:       task.reason,
        });
      }
    } else if (task.action === 'REGENERATE') {
      autoApprovedTasks.push(task);
    }
  }

  return {
    requiresHumanReview: plan.requiresHumanReview,
    impactLevel:         plan.impactLevel,
    queue:               plan.requiresHumanReview ? queue : [],
    autoApprovedTasks,
    skippedTasks:        plan.skippedTasks,
  };
}

// ─── Agent ────────────────────────────────────────────────────────────────────

export class HumanReviewQueue {
  constructor(private readonly templateUpdater: TemplateAutoUpdater = new TemplateAutoUpdater()) {}

  buildQueue(lastAppliedDate: string, currentDate: string): ReviewQueueResult {
    return buildQueueFromPlan(this.templateUpdater.planTemplateUpdates(lastAppliedDate, currentDate));
  }
}
