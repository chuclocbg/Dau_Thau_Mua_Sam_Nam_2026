/**
 * Workflow transition helpers — query the linear state order.
 * All transitions are linear (each state has exactly one allowed successor).
 * Rollback goes one step back. Cancel is available from any non-COMPLETED state.
 */

import { WORKFLOW_STATE_IDS } from './workflowContext';
import type { WorkflowStateId } from './workflowContext';

export function getNextState(state: WorkflowStateId): WorkflowStateId | null {
  const i = WORKFLOW_STATE_IDS.indexOf(state);
  return i >= 0 && i < WORKFLOW_STATE_IDS.length - 1 ? WORKFLOW_STATE_IDS[i + 1]! : null;
}

export function getPreviousState(state: WorkflowStateId): WorkflowStateId | null {
  const i = WORKFLOW_STATE_IDS.indexOf(state);
  return i > 0 ? WORKFLOW_STATE_IDS[i - 1]! : null;
}

export function isAllowedTransition(from: WorkflowStateId, to: WorkflowStateId): boolean {
  return getNextState(from) === to;
}

export function canRollback(state: WorkflowStateId): boolean {
  return getPreviousState(state) !== null && state !== 'COMPLETED';
}

export function canCancel(state: WorkflowStateId): boolean {
  return state !== 'COMPLETED';
}

export function getProgress(state: WorkflowStateId): number {
  const i = WORKFLOW_STATE_IDS.indexOf(state);
  return Math.round((i / (WORKFLOW_STATE_IDS.length - 1)) * 100);
}

export function getCompletedSteps(state: WorkflowStateId): readonly WorkflowStateId[] {
  const i = WORKFLOW_STATE_IDS.indexOf(state);
  return i > 0 ? (WORKFLOW_STATE_IDS.slice(0, i) as unknown as WorkflowStateId[]) : [];
}

export function getPendingSteps(state: WorkflowStateId): readonly WorkflowStateId[] {
  const i = WORKFLOW_STATE_IDS.indexOf(state);
  return i < WORKFLOW_STATE_IDS.length - 1
    ? (WORKFLOW_STATE_IDS.slice(i + 1) as unknown as WorkflowStateId[])
    : [];
}
