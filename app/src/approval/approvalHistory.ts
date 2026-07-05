import type { IApprovalHistoryRepository } from './approvalRepositories';
import type { ApprovalHistoryEntry, ApprovalAction, ApprovalStatus } from './approvalTypes';

export async function recordHistoryEvent(
  requestId:   string,
  action:      ApprovalAction,
  performedBy: string,
  repo:        IApprovalHistoryRepository,
  opts?: {
    fromStatus?: ApprovalStatus;
    toStatus?:   ApprovalStatus;
    notes?:      string;
  },
): Promise<ApprovalHistoryEntry> {
  return repo.create({
    requestId,
    action,
    performedBy,
    performedAt: new Date().toISOString(),
    fromStatus:  opts?.fromStatus,
    toStatus:    opts?.toStatus,
    notes:       opts?.notes,
  } as Omit<ApprovalHistoryEntry, 'id' | 'createdAt' | 'updatedAt'>);
}

export async function getApprovalTimeline(
  requestId: string,
  repo:      IApprovalHistoryRepository,
): Promise<readonly ApprovalHistoryEntry[]> {
  return repo.findByRequestId(requestId);
}

export async function calculateProcessingDuration(
  requestId: string,
  repo:      IApprovalHistoryRepository,
): Promise<number | null> {
  const events = await repo.findByRequestId(requestId);
  const created  = events.find(e => e.action === 'CREATED');
  const terminal = events.find(e => e.action === 'APPROVED' || e.action === 'REJECTED' || e.action === 'WITHDRAWN');
  if (!created || !terminal) return null;
  return new Date(terminal.performedAt).getTime() - new Date(created.performedAt).getTime();
}

export async function getLastAction(
  requestId: string,
  repo:      IApprovalHistoryRepository,
): Promise<ApprovalHistoryEntry | null> {
  const events = await repo.findByRequestId(requestId);
  return events.length > 0 ? events[events.length - 1]! : null;
}
