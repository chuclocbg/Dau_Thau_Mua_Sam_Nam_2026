/**
 * Legal v6.2 — NotificationCenter
 *
 * notify(lastAppliedDate, currentDate) → NotifyResult
 *
 * Consumes a ScheduleResult and produces three notification channels:
 *
 *   approvalNotifications — one entry when waitingTasks.length > 0;
 *                           severity = impactLevel (operator must act)
 *   updateNotifications   — one entry per immediateTasks APPLY step;
 *                           severity = INFO (system confirms completion)
 *   auditNotifications    — one entry per executionPlan step in order;
 *                           severity per action: ROLLBACK→HIGH, APPLY→INFO, SKIP→LOW
 *
 * Approval notification is driven by waitingTasks count, not by
 * requiresHumanReview flag alone — if requiresHumanReview=true but
 * waitingTasks=[] (e.g. backward diff with no template changes), no
 * approval notification is generated.
 *
 * auditNotifications follow executionPlan order exactly; no sorting,
 * no grouping, no deduplication.
 *
 * notifyFromSchedule() is exported so tests can inject synthetic
 * ScheduleResult objects for scenarios that real data cannot produce
 * (ROLLBACK steps, APPLY steps, CRITICAL impact level).
 *
 * Calls SchedulerAgent.schedule() exactly once.
 * Never calls WorkflowAgent, RollbackManager, HumanReviewQueue,
 * TemplateAutoUpdater, ChangeImpactAgent, LegalUpdateAgent, or any
 * v4.x engine directly.
 * Does NOT modify any existing engine, agent, or pipeline layer.
 * Backward compatibility remains 100% unchanged.
 *
 * Pure. Deterministic. No singleton. No cache. No side effects.
 * No LLM. No browser globals. No hooks. No IndexedDB. No UI.
 */

import { SchedulerAgent }     from './SchedulerAgent';
import type { ExecutionStep } from './WorkflowAgent';
import type { ImpactLevel }   from '../ai/updatePackageEngine';

// ─── Public types ─────────────────────────────────────────────────────────────

export type NotificationSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export interface Notification {
  severity: NotificationSeverity;
  title:    string;
  message:  string;
}

export interface NotifyResult {
  requiresHumanReview:   boolean;
  impactLevel:           ImpactLevel;
  approvalNotifications: readonly Notification[];
  updateNotifications:   readonly Notification[];
  auditNotifications:    readonly Notification[];
}

// ─── Internal narrow type ─────────────────────────────────────────────────────

// Only the fields notifyFromSchedule actually reads.
interface MinSchedule {
  requiresHumanReview: boolean;
  impactLevel:         ImpactLevel;
  waitingTasks:        readonly ExecutionStep[];
  immediateTasks:      readonly ExecutionStep[];
  executionPlan:       readonly ExecutionStep[];
}

// ─── Audit severity lookup ────────────────────────────────────────────────────

const AUDIT_SEVERITY: Record<string, NotificationSeverity> = {
  ROLLBACK: 'HIGH',
  APPLY:    'INFO',
  SKIP:     'LOW',
};

// ─── Exported mapping helper ──────────────────────────────────────────────────

export function notifyFromSchedule(schedule: MinSchedule): NotifyResult {
  // Approval — only when tasks are actually waiting, regardless of humanReview flag
  const approvalNotifications: Notification[] = [];
  if (schedule.waitingTasks.length > 0) {
    approvalNotifications.push({
      severity: schedule.impactLevel,
      title:    'Approval Required',
      message:  `${schedule.waitingTasks.length} task(s) waiting for review`,
    });
  }

  // Update — one per immediate APPLY task
  const updateNotifications: Notification[] = schedule.immediateTasks.map(task => ({
    severity: 'INFO' as const,
    title:    'Template Updated',
    message:  task.templateType ?? '',
  }));

  // Audit — one per executionPlan step, order preserved
  const auditNotifications: Notification[] = schedule.executionPlan.map(step => ({
    severity: AUDIT_SEVERITY[step.action],
    title:    step.action,
    message:  `${step.action} ${step.templateType ?? ''}`,
  }));

  return {
    requiresHumanReview:   schedule.requiresHumanReview,
    impactLevel:           schedule.impactLevel,
    approvalNotifications,
    updateNotifications,
    auditNotifications,
  };
}

// ─── Agent ────────────────────────────────────────────────────────────────────

export class NotificationCenter {
  constructor(private readonly scheduler: SchedulerAgent = new SchedulerAgent()) {}

  notify(lastAppliedDate: string, currentDate: string): NotifyResult {
    return notifyFromSchedule(this.scheduler.schedule(lastAppliedDate, currentDate));
  }
}
