/**
 * Legal v6.1 — SchedulerAgent
 *
 * schedule(lastAppliedDate, currentDate) → ScheduleResult
 *
 * Consumes a WorkflowResult and distributes its executionPlan steps into
 * three task buckets without reordering:
 *
 *   waitingTasks   — steps blocked on approval (ROLLBACK always; APPLY when
 *                    requiresHumanReview=true)
 *   completedTasks — steps that need no approval (APPLY when
 *                    requiresHumanReview=false; SKIP always)
 *   immediateTasks — subset of completedTasks where action==='APPLY'
 *
 * ROLLBACK always waits because rolling back a template set is destructive
 * and requires explicit operator approval regardless of impact level.
 *
 * APPLY waits only when a human reviewer must sign off (requiresHumanReview
 * applies to the whole batch — it is a single flag, not per-step).
 *
 * SKIP never waits — no template change is triggered, so no approval is
 * needed.
 *
 * immediateTasks is derived from completedTasks and contains only the APPLY
 * steps — the updates the system can apply right now, without waiting for
 * either human review or rollback approval.
 *
 * executionPlan is forwarded unchanged from WorkflowResult (same reference,
 * same order, same 1-based order field).
 *
 * scheduleFromWorkflow() is exported so tests can inject synthetic
 * WorkflowResult objects for scenarios (non-empty ROLLBACK/APPLY steps)
 * that cannot be produced from the current two-version snapshot set.
 *
 * Calls WorkflowAgent.runWorkflow() exactly once.
 * Never calls RollbackManager, HumanReviewQueue, TemplateAutoUpdater,
 * ChangeImpactAgent, LegalUpdateAgent, or any v4.x engine directly.
 * Does NOT modify any existing engine, agent, or pipeline layer.
 * Backward compatibility remains 100% unchanged.
 *
 * Pure. Deterministic. No singleton. No cache. No side effects.
 * No LLM. No browser globals. No hooks. No IndexedDB. No UI.
 */

import { WorkflowAgent }      from './WorkflowAgent';
import type { ExecutionStep } from './WorkflowAgent';
import type { ImpactLevel }   from '../ai/updatePackageEngine';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface ScheduleResult {
  executionPlan:       readonly ExecutionStep[];
  immediateTasks:      readonly ExecutionStep[];
  waitingTasks:        readonly ExecutionStep[];
  completedTasks:      readonly ExecutionStep[];
  requiresHumanReview: boolean;
  impactLevel:         ImpactLevel;
}

// ─── Internal narrow type ─────────────────────────────────────────────────────

// Only the fields scheduleFromWorkflow actually reads.
interface MinResult {
  requiresHumanReview: boolean;
  impactLevel:         ImpactLevel;
  executionPlan:       readonly ExecutionStep[];
}

// ─── Exported mapping helper ──────────────────────────────────────────────────

export function scheduleFromWorkflow(result: MinResult): ScheduleResult {
  const waitingTasks:   ExecutionStep[] = [];
  const completedTasks: ExecutionStep[] = [];

  for (const step of result.executionPlan) {
    if (step.action === 'ROLLBACK') {
      waitingTasks.push(step);
    } else if (step.action === 'APPLY') {
      if (result.requiresHumanReview) {
        waitingTasks.push(step);
      } else {
        completedTasks.push(step);
      }
    } else {
      // SKIP — always completed, no approval needed
      completedTasks.push(step);
    }
  }

  const immediateTasks = completedTasks.filter(s => s.action === 'APPLY');

  return {
    executionPlan:       result.executionPlan,
    immediateTasks,
    waitingTasks,
    completedTasks,
    requiresHumanReview: result.requiresHumanReview,
    impactLevel:         result.impactLevel,
  };
}

// ─── Agent ────────────────────────────────────────────────────────────────────

export class SchedulerAgent {
  constructor(private readonly workflowAgent: WorkflowAgent = new WorkflowAgent()) {}

  schedule(lastAppliedDate: string, currentDate: string): ScheduleResult {
    return scheduleFromWorkflow(this.workflowAgent.runWorkflow(lastAppliedDate, currentDate));
  }
}
