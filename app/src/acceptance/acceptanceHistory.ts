import type { AcceptanceHistoryEntry, AcceptanceAction, AcceptanceStatus } from './acceptanceTypes';
import type { IAcceptanceHistoryRepository } from './acceptanceRepositories';

export async function recordAcceptanceEvent(
  requestId:  string,
  action:     AcceptanceAction,
  performedBy: string,
  repo:       IAcceptanceHistoryRepository,
  opts?: {
    fromStatus?: AcceptanceStatus;
    toStatus?:   AcceptanceStatus;
    notes?:      string;
  },
): Promise<AcceptanceHistoryEntry> {
  return repo.create({
    requestId,
    action,
    performedBy,
    performedAt: new Date().toISOString(),
    fromStatus:  opts?.fromStatus,
    toStatus:    opts?.toStatus,
    notes:       opts?.notes,
  } as Omit<AcceptanceHistoryEntry, 'id' | 'createdAt' | 'updatedAt'>);
}

export async function getAcceptanceTimeline(
  requestId: string,
  repo:      IAcceptanceHistoryRepository,
): Promise<readonly AcceptanceHistoryEntry[]> {
  return repo.findByRequestId(requestId);
}

export function calculateAcceptanceAge(createdAt: string): number {
  return Date.now() - new Date(createdAt).getTime();
}

export async function getLastAcceptanceAction(
  requestId: string,
  repo:      IAcceptanceHistoryRepository,
): Promise<AcceptanceHistoryEntry | null> {
  const events = await repo.findByRequestId(requestId);
  return events.length > 0 ? events[events.length - 1]! : null;
}
