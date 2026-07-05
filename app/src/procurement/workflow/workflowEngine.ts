/**
 * WorkflowEngine — 8 public API functions orchestrating the procurement lifecycle.
 *
 * All functions are pure: they take a WorkflowInstance and return a new one (or an error).
 * State is never mutated in place.
 *
 * Public API:
 *   createWorkflow()        — initialise a new workflow in DRAFT
 *   startWorkflow()         — advance DRAFT → PROCUREMENT_REQUEST
 *   advance()               — move to a specific next state
 *   rollback()              — move one step back
 *   cancel()                — mark workflow as CANCELLED
 *   validate()              — check if the next advance is valid
 *   getPendingTasks()       — list of states still to complete
 *   getRequiredDocuments()  — documents needed in the current state
 *   getHistory()            — full audit trail
 */

import type { WorkflowContext, WorkflowStateId } from './workflowContext';
import { createInitialContext } from './workflowContext';
import type { WorkflowHistory } from './workflowHistory';
import { createHistory, addHistoryEntry } from './workflowHistory';
import type { StateDefinition } from './workflowState';
import { STATES } from './workflowState';
import {
  getNextState,
  getPreviousState,
  getProgress,
  getCompletedSteps,
  getPendingSteps,
} from './workflowTransition';
import type { ValidationResult } from './workflowValidator';
import {
  validateTransition,
  validateRollback,
  validateCancel,
  getBlockingErrors,
  getWarnings,
} from './workflowValidator';
import type { WorkflowLegalRef } from './workflowContext';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WorkflowInstance {
  readonly context: WorkflowContext;
  readonly history: WorkflowHistory;
}

export interface WorkflowResult {
  readonly currentState:        StateDefinition;
  readonly progress:            number;
  readonly completedSteps:      readonly WorkflowStateId[];
  readonly pendingSteps:        readonly WorkflowStateId[];
  readonly blockingErrors:      readonly string[];
  readonly warnings:            readonly string[];
  readonly legalBasis:          readonly WorkflowLegalRef[];
  readonly requiredDocuments:   readonly string[];
  readonly responsibleRole:     string;
  readonly nextAvailableActions: readonly string[];
}

export interface EngineResult<T> {
  readonly ok:      boolean;
  readonly data?:   T;
  readonly errors:  readonly string[];
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function createWorkflow(params: {
  packageId:         string;
  packageType:       string;
  estimatedValue:    number;
  procurementMethod: string;
  approvalAuthority: string;
  performedBy:       string;
}): WorkflowInstance {
  const context = createInitialContext(params);
  const history = addHistoryEntry(createHistory(context.id), {
    fromState:   null,
    toState:     'DRAFT',
    action:      'CREATE',
    performedBy: params.performedBy,
  });
  return { context, history };
}

export function startWorkflow(
  instance:    WorkflowInstance,
  performedBy: string,
): EngineResult<WorkflowInstance> {
  return advance(instance, 'PROCUREMENT_REQUEST', performedBy);
}

export function advance(
  instance:    WorkflowInstance,
  targetState: WorkflowStateId,
  performedBy: string,
  notes?:      string,
): EngineResult<WorkflowInstance> {
  const validation = validateTransition(instance.context, targetState);
  if (!validation.valid) return { ok: false, errors: validation.errors };

  const newStatus = targetState === 'COMPLETED' ? 'COMPLETED' : instance.context.status;
  const newContext: WorkflowContext = {
    ...instance.context,
    currentState: targetState,
    status:       newStatus,
    updatedAt:    new Date().toISOString(),
  };
  const newHistory = addHistoryEntry(instance.history, {
    fromState:   instance.context.currentState,
    toState:     targetState,
    action:      'ADVANCE',
    performedBy,
    notes,
  });
  return { ok: true, data: { context: newContext, history: newHistory }, errors: [] };
}

export function rollback(
  instance:    WorkflowInstance,
  performedBy: string,
  notes?:      string,
): EngineResult<WorkflowInstance> {
  const validation = validateRollback(instance.context);
  if (!validation.valid) return { ok: false, errors: validation.errors };

  const prevState = getPreviousState(instance.context.currentState)!;
  const newContext: WorkflowContext = {
    ...instance.context,
    currentState: prevState,
    updatedAt:    new Date().toISOString(),
  };
  const newHistory = addHistoryEntry(instance.history, {
    fromState:   instance.context.currentState,
    toState:     prevState,
    action:      'ROLLBACK',
    performedBy,
    notes,
  });
  return { ok: true, data: { context: newContext, history: newHistory }, errors: [] };
}

export function cancel(
  instance:    WorkflowInstance,
  performedBy: string,
  notes?:      string,
): EngineResult<WorkflowInstance> {
  const validation = validateCancel(instance.context);
  if (!validation.valid) return { ok: false, errors: validation.errors };

  const newContext: WorkflowContext = {
    ...instance.context,
    status:    'CANCELLED',
    updatedAt: new Date().toISOString(),
  };
  const newHistory = addHistoryEntry(instance.history, {
    fromState:   instance.context.currentState,
    toState:     instance.context.currentState,
    action:      'CANCEL',
    performedBy,
    notes,
  });
  return { ok: true, data: { context: newContext, history: newHistory }, errors: [] };
}

export function validate(instance: WorkflowInstance): ValidationResult {
  const nextState = getNextState(instance.context.currentState);
  if (!nextState) return { valid: true, errors: [], warnings: [] };
  return validateTransition(instance.context, nextState);
}

export function getPendingTasks(instance: WorkflowInstance): readonly WorkflowStateId[] {
  return getPendingSteps(instance.context.currentState);
}

export function getRequiredDocuments(instance: WorkflowInstance): readonly string[] {
  return STATES[instance.context.currentState].requiredDocuments;
}

export function getHistory(instance: WorkflowInstance): WorkflowHistory {
  return instance.history;
}

export function getWorkflowResult(instance: WorkflowInstance): WorkflowResult {
  const stateDef  = STATES[instance.context.currentState];
  const nextState = getNextState(instance.context.currentState);
  const nextActions = nextState && instance.context.status === 'ACTIVE'
    ? [`Chuyển sang: ${STATES[nextState].displayName}`]
    : [];

  return {
    currentState:         stateDef,
    progress:             getProgress(instance.context.currentState),
    completedSteps:       getCompletedSteps(instance.context.currentState),
    pendingSteps:         getPendingSteps(instance.context.currentState),
    blockingErrors:       getBlockingErrors(instance.context),
    warnings:             getWarnings(instance.context),
    legalBasis:           stateDef.legalBasis,
    requiredDocuments:    stateDef.requiredDocuments,
    responsibleRole:      stateDef.responsibleRole,
    nextAvailableActions: nextActions,
  };
}
