/**
 * Phase 13 — ProcurementService
 *
 * Application service that orchestrates a procurement governance request.
 * Coordinates the Rule Engine (authority + threshold checks) and the
 * Workflow Orchestrator (process execution).  Contains zero business rules.
 *
 * Public APIs:
 *   startProcurement(definitionId, instanceId, ctx)  → GovernanceResult<WorkflowInstance>
 *   reviewProcurement(instanceId, trigger, ctx)       → GovernanceResult<WorkflowInstance>
 *   getProcurementStatus(instanceId, ctx)             → GovernanceResult<ProcurementStatus>
 *   buildProcurementService(ruleEngine, orchestrator) → ProcurementService
 */

import type { GovernanceRuleEngine } from '../legal/governanceRuleEngine';
import type { WorkflowOrchestrator, WorkflowInstance, ApprovalStep } from '../legal/workflowOrchestrator';
import type { GovernanceContext }   from './governanceContext';
import {
  createResult, createAuditEntry, toRuleContext, toWorkflowContext,
} from './governanceContext';
import type { GovernanceResult }    from './governanceContext';

// ─── Domain type ──────────────────────────────────────────────────────────────

export interface ProcurementStatus {
  readonly state:            string;
  readonly pendingApprovals: readonly ApprovalStep[];
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class ProcurementService {
  constructor(
    private readonly ruleEngine:   GovernanceRuleEngine,
    private readonly orchestrator: WorkflowOrchestrator,
  ) {}

  /**
   * Starts a new procurement workflow instance.
   *
   * Authority check is a hard gate — REJECTED → FAILED, workflow not started.
   * Threshold check determines result status — REQUIRES_REVIEW elevates the verdict
   * but does not block the workflow from starting (escalated process applies).
   */
  startProcurement(
    definitionId: string,
    instanceId:   string,
    ctx:          GovernanceContext,
  ): GovernanceResult<WorkflowInstance> {
    const ruleCtx = toRuleContext(ctx);
    const audit   = [createAuditEntry('startProcurement', ctx.actor, instanceId)];

    const authResult = this.ruleEngine.evaluateAuthority(ruleCtx);
    if (authResult.verdict === 'REJECTED') {
      return createResult('FAILED', {
        errors:          [`Authority check failed: ${authResult.reason}`],
        auditTrail:      audit,
        legalReferences: authResult.appliedConfig ? [authResult.appliedConfig.source] : [],
        confidence:      authResult.appliedConfig?.confidence ?? 0,
        metadata:        { instanceId, definitionId },
      });
    }

    let instance: WorkflowInstance;
    try {
      instance = this.orchestrator.startWorkflow(
        definitionId, instanceId, ctx.actor, toWorkflowContext(ctx),
      );
    } catch (e) {
      return createResult('FAILED', {
        errors:     [(e as Error).message],
        auditTrail: audit,
        metadata:   { instanceId, definitionId },
      });
    }

    const threshResult  = this.ruleEngine.evaluateThreshold(ruleCtx);
    const status        = threshResult.verdict === 'REQUIRES_REVIEW' ? 'REQUIRES_REVIEW' : 'SUCCESS';
    const warnings      = threshResult.verdict === 'REQUIRES_REVIEW'
      ? [`Threshold exceeded: ${threshResult.reason}`] : [];

    return createResult(status, {
      data:            instance,
      messages:        [`Procurement started: ${instanceId}`],
      warnings,
      auditTrail:      audit,
      workflowState:   instance.currentState,
      legalReferences: threshResult.appliedConfig ? [threshResult.appliedConfig.source] : [],
      confidence:      threshResult.appliedConfig?.confidence ?? 1.0,
      metadata:        { instanceId, definitionId },
    });
  }

  /**
   * Advances a procurement workflow by firing a trigger.
   * Guard evaluation (if any) is performed inside the Workflow Orchestrator.
   */
  reviewProcurement(
    instanceId: string,
    trigger:    string,
    ctx:        GovernanceContext,
  ): GovernanceResult<WorkflowInstance> {
    const audit     = [createAuditEntry('reviewProcurement', ctx.actor, `${instanceId}→${trigger}`)];
    const txResult  = this.orchestrator.transition(instanceId, trigger, ctx.actor, toWorkflowContext(ctx));

    if (!txResult.ok) {
      return createResult('FAILED', {
        errors:     [txResult.reason],
        auditTrail: audit,
        metadata:   { instanceId, trigger },
      });
    }

    return createResult('SUCCESS', {
      data:          txResult.instance,
      messages:      [txResult.reason],
      auditTrail:    audit,
      workflowState: txResult.instance?.currentState,
      metadata:      { instanceId, trigger },
    });
  }

  /** Returns the current workflow state and any pending approval steps. */
  getProcurementStatus(
    instanceId: string,
    ctx:        GovernanceContext,
  ): GovernanceResult<ProcurementStatus> {
    const stateDef = this.orchestrator.getCurrentState(instanceId);
    if (!stateDef) {
      return createResult('FAILED', {
        errors:   [`Procurement instance "${instanceId}" not found.`],
        metadata: { instanceId },
      });
    }
    const pendingApprovals = this.orchestrator.getPendingApprovals(instanceId);
    return createResult('SUCCESS', {
      data:          { state: stateDef.id, pendingApprovals },
      messages:      [`Current state: ${stateDef.id}`],
      workflowState: stateDef.id,
      metadata:      { instanceId, requestId: ctx.requestId },
    });
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function buildProcurementService(
  ruleEngine:   GovernanceRuleEngine,
  orchestrator: WorkflowOrchestrator,
): ProcurementService {
  return new ProcurementService(ruleEngine, orchestrator);
}
