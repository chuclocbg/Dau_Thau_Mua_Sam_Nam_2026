/**
 * Legal v6.0 — WorkflowAgent
 *
 * runWorkflow(lastAppliedDate, currentDate) → WorkflowResult
 *
 * Consumes a RollbackPlan and produces a fully-ordered executionPlan — a
 * flat sequence of steps that tells the scheduler exactly what to do and in
 * what order:
 *
 *   1. ROLLBACK steps  (from rollbackTasks, only when shouldRollback=true)
 *   2. APPLY steps     (from safeTasks, always)
 *   3. SKIP steps      (from skippedTasks, always)
 *
 * Within each group the original array order is preserved.
 * The order field is a 1-based sequential integer across all groups.
 *
 * When shouldRollback=false, rollbackTasks contribute no steps (they are
 * empty by construction from RollbackManager, but the condition is explicit).
 *
 * buildWorkflowFromPlan() is exported so tests can inject synthetic
 * RollbackPlan objects for scenarios (non-empty rollbackTasks, safeTasks)
 * that cannot be produced from the current two-version snapshot set.
 *
 * Calls RollbackManager.buildRollbackPlan() exactly once.
 * Never calls HumanReviewQueue, TemplateAutoUpdater, ChangeImpactAgent,
 * LegalUpdateAgent, or any v4.x engine directly.
 * Does NOT modify any existing engine, agent, or pipeline layer.
 * Backward compatibility remains 100% unchanged.
 *
 * Pure. Deterministic. No singleton. No cache. No side effects.
 * No LLM. No browser globals. No hooks. No IndexedDB. No UI.
 */

import { RollbackManager }              from './RollbackManager';
import type { RollbackTask }            from './RollbackManager';
import type { Priority }                from './HumanReviewQueue';
import type { TemplateTask, TemplateType } from './TemplateAutoUpdater';
import type { ImpactLevel }             from '../ai/updatePackageEngine';

// ─── Public types ─────────────────────────────────────────────────────────────

export type WorkflowAction = 'ROLLBACK' | 'APPLY' | 'SKIP';

export interface ExecutionStep {
  order:         number;
  action:        WorkflowAction;
  templateType?: TemplateType;
  priority?:     Priority;
  reason?:       string;
}

export interface WorkflowResult {
  shouldRollback:      boolean;
  requiresHumanReview: boolean;
  impactLevel:         ImpactLevel;
  rollbackTasks:       readonly RollbackTask[];
  safeTasks:           readonly TemplateTask[];
  skippedTasks:        readonly TemplateTask[];
  executionPlan:       readonly ExecutionStep[];
}

// ─── Internal narrow type ─────────────────────────────────────────────────────

// Only the fields buildWorkflowFromPlan actually reads.
interface MinPlan {
  shouldRollback:      boolean;
  requiresHumanReview: boolean;
  impactLevel:         ImpactLevel;
  rollbackTasks:       readonly RollbackTask[];
  safeTasks:           readonly TemplateTask[];
  skippedTasks:        readonly TemplateTask[];
}

// ─── Exported mapping helper ──────────────────────────────────────────────────

export function buildWorkflowFromPlan(plan: MinPlan): WorkflowResult {
  const steps: ExecutionStep[] = [];
  let order = 1;

  // 1. ROLLBACK steps first (only when shouldRollback=true)
  if (plan.shouldRollback) {
    for (const task of plan.rollbackTasks) {
      steps.push({
        order:        order++,
        action:       'ROLLBACK',
        templateType: task.templateType,
        priority:     task.priority,
        reason:       task.reason,
      });
    }
  }

  // 2. APPLY steps (from safeTasks, always)
  for (const task of plan.safeTasks) {
    steps.push({
      order:        order++,
      action:       'APPLY',
      templateType: task.templateType,
      reason:       task.reason,
    });
  }

  // 3. SKIP steps last (from skippedTasks, always)
  for (const task of plan.skippedTasks) {
    steps.push({
      order:        order++,
      action:       'SKIP',
      templateType: task.templateType,
      reason:       task.reason,
    });
  }

  return {
    shouldRollback:      plan.shouldRollback,
    requiresHumanReview: plan.requiresHumanReview,
    impactLevel:         plan.impactLevel,
    rollbackTasks:       plan.rollbackTasks,
    safeTasks:           plan.safeTasks,
    skippedTasks:        plan.skippedTasks,
    executionPlan:       steps,
  };
}

// ─── Agent ────────────────────────────────────────────────────────────────────

export class WorkflowAgent {
  constructor(private readonly rollbackMgr: RollbackManager = new RollbackManager()) {}

  runWorkflow(lastAppliedDate: string, currentDate: string): WorkflowResult {
    return buildWorkflowFromPlan(this.rollbackMgr.buildRollbackPlan(lastAppliedDate, currentDate));
  }
}
