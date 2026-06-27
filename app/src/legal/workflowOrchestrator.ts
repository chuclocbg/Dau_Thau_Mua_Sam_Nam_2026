/**
 * Phase 12 — Governance Workflow Orchestrator
 *
 * Finite-state-machine execution layer of the AI Governance Platform.
 * Consumes GovernanceRuleEngine for guard evaluation; never contains
 * business logic of its own. All limits, roles, and rules live in
 * GovernanceConfig objects and are evaluated by the Rule Engine.
 *
 * ─── Public APIs ──────────────────────────────────────────────────────────────
 *
 *   orchestrator.createWorkflow(definition)                     → void
 *   orchestrator.startWorkflow(defId, instanceId, actor, ctx?)  → WorkflowInstance
 *   orchestrator.transition(instanceId, trigger, actor, ctx?)   → TransitionResult
 *   orchestrator.rollback(instanceId, actor)                    → TransitionResult
 *   orchestrator.suspend(instanceId, actor, reason?)            → TransitionResult
 *   orchestrator.resume(instanceId, actor)                      → TransitionResult
 *   orchestrator.cancel(instanceId, actor, reason)              → TransitionResult
 *   orchestrator.getHistory(instanceId)                         → readonly HistoryEntry[]
 *   orchestrator.getCurrentState(instanceId)                    → WorkflowStateDefinition | undefined
 *   orchestrator.getPendingApprovals(instanceId)                → readonly ApprovalStep[]
 *   buildWorkflowOrchestrator(ruleEngine, eventBus)             → WorkflowOrchestrator
 *
 * ─── Execution model ─────────────────────────────────────────────────────────
 *
 *   WorkflowDefinition defines the FSM blueprint (states + transitions).
 *   WorkflowInstance is a running execution of a definition.
 *   Guards are evaluated by GovernanceRuleEngine — only APPROVED passes.
 *   All state updates are immutable; each transition produces a new instance.
 *   History is append-only; transitions are fully auditable.
 *
 * ─── Guard evaluation ─────────────────────────────────────────────────────────
 *
 *   AUTHORITY_CHECK  → ruleEngine.evaluateAuthority()
 *   THRESHOLD_CHECK  → ruleEngine.evaluateThreshold()
 *   RULE_CHECK       → ruleEngine.evaluateRule()
 *   WORKFLOW_CHECK   → ruleEngine.evaluateWorkflow()
 *   COMPLIANCE_CHECK → ruleEngine.evaluateCompliance()
 *
 *   Context fields consumed from instance.context + transition context:
 *     asOfDate, amount, actorRole, workflowId, fundingCode, configType
 *
 * ─── Verdict → status mapping ─────────────────────────────────────────────────
 *
 *   State type FINAL     → instance status COMPLETED
 *   State type CANCELLED → instance status CANCELLED
 *   State type ERROR     → instance status ERROR
 *   All other state types → instance status ACTIVE
 *
 * ─── Extension hooks (Phase 13+) ─────────────────────────────────────────────
 *
 *   EscalationHook       — fires when an approval step times out
 *   TimeoutHook          — fires when an instance state exceeds a duration limit
 *   ParallelApprovalHook — fires on each approval in a parallel chain
 *
 * ─── Events published ────────────────────────────────────────────────────────
 *
 *   ConfigurationUpdated    — on startWorkflow, successful transition
 *   ConfigurationInvalidated— on cancel
 *
 * Pure. No I/O. No singleton. No any. No React. No browser globals.
 * All guard evaluation delegates to GovernanceRuleEngine — never duplicated here.
 */

import type { ConfigType } from './governanceConfig';
import type { GovernanceRuleEngine, RuleContext, RuleResult } from './governanceRuleEngine';
import type { GovernanceEventBus } from './governanceEvents';
import { createGovernanceEvent } from './governanceEvents';

// ─── Core types ───────────────────────────────────────────────────────────────

export type StateType =
  | 'INITIAL'
  | 'APPROVAL'
  | 'ACTION'
  | 'FINAL'
  | 'CANCELLED'
  | 'ERROR';

export type GuardType =
  | 'AUTHORITY_CHECK'
  | 'THRESHOLD_CHECK'
  | 'RULE_CHECK'
  | 'WORKFLOW_CHECK'
  | 'COMPLIANCE_CHECK';

export type InstanceStatus =
  | 'ACTIVE'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'ERROR'
  | 'SUSPENDED';

export type TransitionOutcome =
  | 'SUCCESS'
  | 'GUARD_FAILED'
  | 'CANCELLED'
  | 'ROLLED_BACK'
  | 'RESUMED'
  | 'SUSPENDED';

// ─── Domain model ─────────────────────────────────────────────────────────────

/** Approval requirement attached to an APPROVAL state. */
export interface ApprovalStep {
  readonly id:             string;
  readonly role:           string;
  readonly requiredCount:  number;
  readonly timeoutHours?:  number;
}

/** A node in the workflow FSM. */
export interface WorkflowStateDefinition {
  readonly id:            string;
  readonly name:          string;
  readonly type:          StateType;
  readonly approvalStep?: ApprovalStep;
}

/**
 * A guard that must pass before a transition fires.
 * Evaluated by GovernanceRuleEngine — only APPROVED verdict allows the transition.
 */
export interface GuardDefinition {
  readonly type:            GuardType;
  readonly configType?:     ConfigType;   // for RULE_CHECK
  readonly minConfidence?:  number;
}

/** A directed edge in the workflow FSM. */
export interface TransitionDefinition {
  readonly id:       string;
  readonly from:     string;
  readonly to:       string;
  readonly trigger:  string;
  readonly guards?:  readonly GuardDefinition[];
}

/** The FSM blueprint. Register with createWorkflow() before starting instances. */
export interface WorkflowDefinition {
  readonly id:           string;
  readonly name:         string;
  readonly initialState: string;
  readonly states:       readonly WorkflowStateDefinition[];
  readonly transitions:  readonly TransitionDefinition[];
}

/** A human actor performing a workflow action. */
export interface Actor {
  readonly id:    string;
  readonly role:  string;
  readonly name?: string;
}

/** A single entry in the workflow audit trail. */
export interface HistoryEntry {
  readonly id:          string;
  readonly instanceId:  string;
  readonly timestamp:   string;
  readonly fromState:   string | null;
  readonly toState:     string;
  readonly trigger:     string | null;
  readonly actor:       Actor | null;
  readonly outcome:     TransitionOutcome;
  readonly reason:      string;
  readonly guardResult?: RuleResult;
}

/** A running execution of a WorkflowDefinition. Immutable — each operation yields a new instance. */
export interface WorkflowInstance {
  readonly id:            string;
  readonly definitionId:  string;
  readonly currentState:  string;
  readonly status:        InstanceStatus;
  /** Runtime data used for guard evaluation. Set at startWorkflow; not mutated by transitions. */
  readonly context:       Readonly<Record<string, string>>;
  readonly history:       readonly HistoryEntry[];
  readonly startedAt:     string;
  readonly updatedAt:     string;
  readonly completedAt?:  string;
}

/** Return value from all mutating orchestrator methods. */
export interface TransitionResult {
  readonly ok:           boolean;
  readonly instance?:    WorkflowInstance;
  readonly reason:       string;
  readonly guardResult?: RuleResult;
}

// ─── Extension hooks (Phase 13+) ─────────────────────────────────────────────

/** Future — fires when an approval step exceeds its timeoutHours. */
export interface EscalationHook {
  onApprovalTimeout(instance: WorkflowInstance, step: ApprovalStep): void;
}

/** Future — fires when an instance state exceeds a duration threshold. */
export interface TimeoutHook {
  onStateTimeout(instance: WorkflowInstance, state: WorkflowStateDefinition): void;
}

/** Future — fires on each individual approval in a parallel approval chain. */
export interface ParallelApprovalHook {
  onApprovalReceived(instance: WorkflowInstance, step: ApprovalStep, actor: Actor): void;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function nowISO(): string {
  // ponytail: non-deterministic; tests that care about timestamps use vi.setSystemTime
  return new Date().toISOString();
}

function terminalStatus(type: StateType): InstanceStatus | null {
  if (type === 'FINAL')     return 'COMPLETED';
  if (type === 'CANCELLED') return 'CANCELLED';
  if (type === 'ERROR')     return 'ERROR';
  return null;
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────

export class WorkflowOrchestrator {
  private readonly definitions = new Map<string, WorkflowDefinition>();
  private readonly instances   = new Map<string, WorkflowInstance>();

  constructor(
    private readonly ruleEngine: GovernanceRuleEngine,
    private readonly eventBus:   GovernanceEventBus,
  ) {}

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  /** Register a workflow definition. Throws if the id is already registered. */
  createWorkflow(definition: WorkflowDefinition): void {
    if (this.definitions.has(definition.id)) {
      throw new Error(`Workflow definition "${definition.id}" already registered.`);
    }
    this.definitions.set(definition.id, definition);
  }

  /**
   * Creates and starts a new workflow instance in the definition's initial state.
   * context should include asOfDate, amount, actorRole, and any other fields
   * that guards will need at evaluation time.
   */
  startWorkflow(
    definitionId: string,
    instanceId:   string,
    actor:        Actor,
    context:      Record<string, string> = {},
  ): WorkflowInstance {
    const def = this.definitions.get(definitionId);
    if (!def) throw new Error(`Workflow definition "${definitionId}" not found.`);
    if (this.instances.has(instanceId)) throw new Error(`Workflow instance "${instanceId}" already exists.`);

    const ts    = nowISO();
    const entry = this._entry(instanceId, 0, actor, null, def.initialState, null, 'SUCCESS',
      `Workflow started by "${actor.id}".`);
    const instance: WorkflowInstance = {
      id:           instanceId,
      definitionId,
      currentState: def.initialState,
      status:       'ACTIVE',
      context:      Object.freeze({ ...context }),
      history:      Object.freeze([entry]) as readonly HistoryEntry[],
      startedAt:    ts,
      updatedAt:    ts,
    };
    this.instances.set(instanceId, instance);
    this.eventBus.publish(createGovernanceEvent('ConfigurationUpdated', {
      configId: instanceId, version: def.initialState,
    }));
    return instance;
  }

  /**
   * Fires a trigger on the instance. Guards are evaluated first using instance.context
   * merged with the optional extra context (merge is transient; not persisted to instance).
   * Returns ok:false without changing state if any guard fails.
   */
  transition(
    instanceId: string,
    trigger:    string,
    actor:      Actor,
    context:    Record<string, string> = {},
  ): TransitionResult {
    const instance = this.instances.get(instanceId);
    if (!instance) return { ok: false, reason: `Instance "${instanceId}" not found.` };
    if (instance.status !== 'ACTIVE') {
      return { ok: false, instance, reason: `Instance "${instanceId}" is ${instance.status}.` };
    }

    const def = this.definitions.get(instance.definitionId)!;
    const tx  = def.transitions.find(t => t.from === instance.currentState && t.trigger === trigger);
    if (!tx) {
      return {
        ok: false, instance,
        reason: `No transition with trigger "${trigger}" from state "${instance.currentState}".`,
      };
    }

    // Guards: evaluate sequentially; first failure blocks
    const evalCtx: Record<string, string> = { ...instance.context, ...context };
    for (const guard of (tx.guards ?? [])) {
      const guardResult = this._evalGuard(guard, evalCtx);
      if (guardResult.verdict !== 'APPROVED') {
        const entry = this._entry(
          instanceId, instance.history.length, actor,
          instance.currentState, instance.currentState, trigger, 'GUARD_FAILED',
          `Guard ${guard.type} returned ${guardResult.verdict}: ${guardResult.reason}`,
          guardResult,
        );
        const updated = this._save(instance, instance.currentState, entry, instance.status);
        return { ok: false, instance: updated, reason: entry.reason, guardResult };
      }
    }

    // Execute transition
    const nextDef   = def.states.find(s => s.id === tx.to)!;
    const newStatus = terminalStatus(nextDef.type) ?? 'ACTIVE';
    const entry     = this._entry(
      instanceId, instance.history.length, actor,
      tx.from, tx.to, trigger, 'SUCCESS',
      `Transitioned "${tx.from}" → "${tx.to}" via "${trigger}".`,
    );
    const updated = this._save(instance, tx.to, entry, newStatus);
    this.eventBus.publish(createGovernanceEvent('ConfigurationUpdated', {
      configId: instanceId, version: tx.to,
    }));
    return { ok: true, instance: updated, reason: entry.reason };
  }

  /**
   * Reverts the instance to the state it was in before the most recent
   * successful transition. Fails if the instance is at its initial state
   * or is not ACTIVE.
   */
  rollback(instanceId: string, actor: Actor): TransitionResult {
    const instance = this.instances.get(instanceId);
    if (!instance) return { ok: false, reason: `Instance "${instanceId}" not found.` };
    if (instance.status !== 'ACTIVE') {
      return { ok: false, instance, reason: `Cannot roll back: instance is ${instance.status}.` };
    }

    // Find the SUCCESS entry that brought us to currentState
    const arrival = [...instance.history].reverse().find(h =>
      h.outcome === 'SUCCESS' && h.toState === instance.currentState && h.fromState !== null
    );
    if (!arrival?.fromState) {
      return { ok: false, instance, reason: `No previous state to roll back to for "${instanceId}".` };
    }

    const prevState = arrival.fromState;
    const entry     = this._entry(
      instanceId, instance.history.length, actor,
      instance.currentState, prevState, null, 'ROLLED_BACK',
      `Rolled back from "${instance.currentState}" to "${prevState}" by "${actor.id}".`,
    );
    const updated = this._save(instance, prevState, entry, 'ACTIVE');
    return { ok: true, instance: updated, reason: entry.reason };
  }

  /**
   * Pauses an ACTIVE instance. The instance keeps its current state but
   * status changes to SUSPENDED. Use resume() to reactivate.
   */
  suspend(instanceId: string, actor: Actor, reason = 'Suspended.'): TransitionResult {
    const instance = this.instances.get(instanceId);
    if (!instance) return { ok: false, reason: `Instance "${instanceId}" not found.` };
    if (instance.status !== 'ACTIVE') {
      return { ok: false, instance, reason: `Cannot suspend: instance is ${instance.status}.` };
    }
    const entry = this._entry(
      instanceId, instance.history.length, actor,
      instance.currentState, instance.currentState, null, 'SUSPENDED',
      `Suspended by "${actor.id}": ${reason}`,
    );
    const updated = this._save(instance, instance.currentState, entry, 'SUSPENDED');
    return { ok: true, instance: updated, reason: entry.reason };
  }

  /**
   * Resumes a SUSPENDED instance. Status returns to ACTIVE; state is unchanged.
   */
  resume(instanceId: string, actor: Actor): TransitionResult {
    const instance = this.instances.get(instanceId);
    if (!instance) return { ok: false, reason: `Instance "${instanceId}" not found.` };
    if (instance.status !== 'SUSPENDED') {
      return { ok: false, instance, reason: `Cannot resume: instance is ${instance.status}.` };
    }
    const entry = this._entry(
      instanceId, instance.history.length, actor,
      instance.currentState, instance.currentState, null, 'RESUMED',
      `Resumed by "${actor.id}".`,
    );
    const updated = this._save(instance, instance.currentState, entry, 'ACTIVE');
    return { ok: true, instance: updated, reason: entry.reason };
  }

  /**
   * Permanently cancels an instance. Cannot be undone. Publishes
   * ConfigurationInvalidated. Fails if instance is already COMPLETED or CANCELLED.
   */
  cancel(instanceId: string, actor: Actor, reason: string): TransitionResult {
    const instance = this.instances.get(instanceId);
    if (!instance) return { ok: false, reason: `Instance "${instanceId}" not found.` };
    if (instance.status === 'COMPLETED' || instance.status === 'CANCELLED') {
      return {
        ok: false, instance,
        reason: `Cannot cancel: instance is already ${instance.status}.`,
      };
    }
    const entry = this._entry(
      instanceId, instance.history.length, actor,
      instance.currentState, instance.currentState, null, 'CANCELLED',
      `Cancelled by "${actor.id}": ${reason}`,
    );
    const updated = this._save(instance, instance.currentState, entry, 'CANCELLED');
    this.eventBus.publish(createGovernanceEvent('ConfigurationInvalidated', {
      configId: instanceId, reason,
    }));
    return { ok: true, instance: updated, reason: entry.reason };
  }

  // ── Read-only queries ──────────────────────────────────────────────────────

  /** Returns the full append-only transition history of an instance. */
  getHistory(instanceId: string): readonly HistoryEntry[] {
    return this.instances.get(instanceId)?.history ?? Object.freeze([]);
  }

  /** Returns the WorkflowStateDefinition the instance is currently in. */
  getCurrentState(instanceId: string): WorkflowStateDefinition | undefined {
    const instance = this.instances.get(instanceId);
    if (!instance) return undefined;
    return this.definitions.get(instance.definitionId)?.states.find(s => s.id === instance.currentState);
  }

  /**
   * Returns the ApprovalStep(s) required in the current state.
   * Empty when the current state is not an APPROVAL state or instance is unknown.
   */
  getPendingApprovals(instanceId: string): readonly ApprovalStep[] {
    const state = this.getCurrentState(instanceId);
    return state?.approvalStep
      ? Object.freeze([state.approvalStep])
      : Object.freeze([]);
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private _evalGuard(guard: GuardDefinition, ctx: Record<string, string>): RuleResult {
    const ruleCtx: RuleContext = {
      // ponytail: fallback to now only when asOfDate absent — tests always supply it
      asOfDate:      ctx['asOfDate'] ?? new Date().toISOString().slice(0, 10),
      amount:        ctx['amount']      ? parseFloat(ctx['amount'])      : undefined,
      actorRole:     ctx['actorRole'],
      workflowId:    ctx['workflowId'],
      fundingCode:   ctx['fundingCode'],
      configType:    guard.configType,
      minConfidence: guard.minConfidence,
    };
    switch (guard.type) {
      case 'AUTHORITY_CHECK':  return this.ruleEngine.evaluateAuthority(ruleCtx);
      case 'THRESHOLD_CHECK':  return this.ruleEngine.evaluateThreshold(ruleCtx);
      case 'RULE_CHECK':       return this.ruleEngine.evaluateRule(ruleCtx);
      case 'WORKFLOW_CHECK':   return this.ruleEngine.evaluateWorkflow(ruleCtx);
      case 'COMPLIANCE_CHECK': return this.ruleEngine.evaluateCompliance(ruleCtx);
    }
  }

  private _entry(
    instanceId:   string,
    histLen:      number,
    actor:        Actor | null,
    fromState:    string | null,
    toState:      string,
    trigger:      string | null,
    outcome:      TransitionOutcome,
    reason:       string,
    guardResult?: RuleResult,
  ): HistoryEntry {
    return {
      id: `${instanceId}-h-${histLen + 1}`,
      instanceId, timestamp: nowISO(),
      fromState, toState, trigger, actor,
      outcome, reason, guardResult,
    };
  }

  private _save(
    instance:  WorkflowInstance,
    newState:  string,
    entry:     HistoryEntry,
    status:    InstanceStatus,
  ): WorkflowInstance {
    const terminal = status === 'COMPLETED' || status === 'CANCELLED' || status === 'ERROR';
    const ts       = nowISO();
    const updated: WorkflowInstance = {
      ...instance,
      currentState: newState,
      status,
      history:      Object.freeze([...instance.history, entry]) as readonly HistoryEntry[],
      updatedAt:    ts,
      completedAt:  terminal ? ts : instance.completedAt,
    };
    this.instances.set(instance.id, updated);
    return updated;
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function buildWorkflowOrchestrator(
  ruleEngine: GovernanceRuleEngine,
  eventBus:   GovernanceEventBus,
): WorkflowOrchestrator {
  return new WorkflowOrchestrator(ruleEngine, eventBus);
}
