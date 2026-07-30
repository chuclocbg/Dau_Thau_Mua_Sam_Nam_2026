/**
 * Procurement request history — immutable audit trail of approve/split actions.
 */

export type PlanningRequestHistoryAction = 'APPROVE' | 'SPLIT' | 'CANCEL';

export interface PlanningRequestHistoryEntry {
  readonly id:          string;
  readonly action:      PlanningRequestHistoryAction;
  readonly performedBy: string;
  readonly performedAt: string;
  readonly notes?:      string;
}

export interface PlanningRequestHistory {
  readonly requestId: string;
  readonly entries:   readonly PlanningRequestHistoryEntry[];
}

export function createHistory(requestId: string): PlanningRequestHistory {
  return { requestId, entries: [] };
}

export function addHistoryEntry(
  history: PlanningRequestHistory,
  entry:   Omit<PlanningRequestHistoryEntry, 'id' | 'performedAt'>,
): PlanningRequestHistory {
  const newEntry: PlanningRequestHistoryEntry = {
    ...entry,
    id:          crypto.randomUUID(),
    performedAt: new Date().toISOString(),
  };
  return { ...history, entries: [...history.entries, newEntry] };
}
