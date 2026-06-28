/**
 * Phase 13 — WorkflowService
 *
 * Application service that exposes the Workflow Orchestrator through the
 * standard GovernanceResult envelope. Translates GovernanceContext into the
 * string-valued map the orchestrator expects. Contains zero business rules.
 *
 * Public APIs:
 *   startWorkflow(definitionId, instanceId, ctx)  → GovernanceResult<WorkflowInstance>
 *   advanceWorkflow(instanceId, trigger, ctx)      → GovernanceResult<WorkflowInstance>
 *   getWorkflowHistory(instanceId, ctx)            → GovernanceResult<readonly HistoryEntry[]>
 *   buildWorkflowService(orchestrator)             → WorkflowService
 */

import type { WorkflowOrchestrator, WorkflowInstance, HistoryEntry } from '../legal/workflowOrchestrator';
import type { GovernanceContext, GovernanceResult } from './governanceContext';
import { createResult, createAuditEntry, toWorkflowContext } from './governanceContext';

// ─── Service ──────────────────────────────────────────────────────────────────

export class WorkflowService {
  constructor(private readonly orchestrator: WorkflowOrchestrator) {}

  /**
   * Creates and starts a new workflow instance.
   * Throws from the orchestrator (unknown definition, duplicate id) are
   * captured and returned as FAILED results.
   */
  startWorkflow(
    definitionId: string,
    instanceId:   string,
    ctx:          GovernanceContext,
  ): GovernanceResult<WorkflowInstance> {
    const audit = [createAuditEntry('startWorkflow', ctx.actor, `${definitionId}/${instanceId}`)];
    let instance: WorkflowInstance;
    try {
      instance = this.orchestrator.startWorkflow(
        definitionId, instanceId, ctx.actor, toWorkflowContext(ctx),
      );
    } catch (e) {
      return createResult('FAILED', {
        errors:     [(e as Error).message],
        auditTrail: audit,
        metadata:   { definitionId, instanceId },
      });
    }
    return createResult('SUCCESS', {
      data:          instance,
      messages:      [`Workflow "${definitionId}" started as "${instanceId}".`],
      auditTrail:    audit,
      workflowState: instance.currentState,
      metadata:      { definitionId, instanceId },
    });
  }

  /**
   * Fires a trigger on a running workflow instance.
   * Guard failures and unknown triggers are returned as FAILED results.
   */
  advanceWorkflow(
    instanceId: string,
    trigger:    string,
    ctx:        GovernanceContext,
  ): GovernanceResult<WorkflowInstance> {
    const audit    = [createAuditEntry('advanceWorkflow', ctx.actor, `${instanceId}→${trigger}`)];
    const txResult = this.orchestrator.transition(
      instanceId, trigger, ctx.actor, toWorkflowContext(ctx),
    );

    if (!txResult.ok) {
      return createResult('FAILED', {
        errors:     [txResult.reason],
        auditTrail: audit,
        metadata:   { instanceId, trigger },
      });
    }

    const inst = txResult.instance!;
    const status = inst.status === 'COMPLETED' ? 'SUCCESS'
      : inst.status === 'CANCELLED' ? 'FAILED'
      : 'SUCCESS';

    return createResult(status, {
      data:          inst,
      messages:      [txResult.reason],
      auditTrail:    audit,
      workflowState: inst.currentState,
      metadata:      { instanceId, trigger, instanceStatus: inst.status },
    });
  }

  /** Returns the full audit trail for a workflow instance. */
  getWorkflowHistory(
    instanceId: string,
    ctx:        GovernanceContext,
  ): GovernanceResult<readonly HistoryEntry[]> {
    const history = this.orchestrator.getHistory(instanceId);
    return createResult('SUCCESS', {
      data:      history,
      messages:  [`${history.length} history entry(s) for "${instanceId}".`],
      metadata:  { instanceId, requestId: ctx.requestId },
    });
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function buildWorkflowService(orchestrator: WorkflowOrchestrator): WorkflowService {
  return new WorkflowService(orchestrator);
}
