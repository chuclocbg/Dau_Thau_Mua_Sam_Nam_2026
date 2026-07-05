/**
 * Workflow history — immutable audit trail of state changes.
 */

import type { WorkflowStateId } from './workflowContext';

export type HistoryAction = 'CREATE' | 'ADVANCE' | 'ROLLBACK' | 'CANCEL';

export interface WorkflowHistoryEntry {
  readonly id:          string;
  readonly fromState:   WorkflowStateId | null;
  readonly toState:     WorkflowStateId;
  readonly action:      HistoryAction;
  readonly performedBy: string;
  readonly performedAt: string;
  readonly notes?:      string;
}

export interface WorkflowHistory {
  readonly workflowId: string;
  readonly entries:    readonly WorkflowHistoryEntry[];
}

export function createHistory(workflowId: string): WorkflowHistory {
  return { workflowId, entries: [] };
}

export function addHistoryEntry(
  history: WorkflowHistory,
  entry:   Omit<WorkflowHistoryEntry, 'id' | 'performedAt'>,
): WorkflowHistory {
  const newEntry: WorkflowHistoryEntry = {
    ...entry,
    id:          crypto.randomUUID(),
    performedAt: new Date().toISOString(),
  };
  return { ...history, entries: [...history.entries, newEntry] };
}

export function getLastEntry(history: WorkflowHistory): WorkflowHistoryEntry | null {
  return history.entries.at(-1) ?? null;
}

export function getEntriesByAction(
  history: WorkflowHistory,
  action:  HistoryAction,
): readonly WorkflowHistoryEntry[] {
  return history.entries.filter(e => e.action === action);
}
