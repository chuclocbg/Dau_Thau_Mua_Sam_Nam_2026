import type { IContractHistoryRepository } from './contractRepositories';
import type { ContractHistoryEntry, ContractAction, ContractStatus } from './contractTypes';

export async function recordContractEvent(
  contractId:  string,
  action:      ContractAction,
  performedBy: string,
  repo:        IContractHistoryRepository,
  opts?: {
    fromStatus?: ContractStatus;
    toStatus?:   ContractStatus;
    notes?:      string;
  },
): Promise<ContractHistoryEntry> {
  return repo.create({
    contractId,
    action,
    performedBy,
    performedAt: new Date().toISOString(),
    fromStatus:  opts?.fromStatus,
    toStatus:    opts?.toStatus,
    notes:       opts?.notes,
  } as Omit<ContractHistoryEntry, 'id' | 'createdAt' | 'updatedAt'>);
}

export async function getContractTimeline(
  contractId: string,
  repo:       IContractHistoryRepository,
): Promise<readonly ContractHistoryEntry[]> {
  return repo.findByContractId(contractId);
}

export async function getLastContractAction(
  contractId: string,
  repo:       IContractHistoryRepository,
): Promise<ContractHistoryEntry | null> {
  const events = await repo.findByContractId(contractId);
  return events.length > 0 ? events[events.length - 1]! : null;
}

export async function calculateContractAge(
  contractId: string,
  repo:       IContractHistoryRepository,
): Promise<number | null> {
  const events = await repo.findByContractId(contractId);
  const created = events.find(e => e.action === 'CREATED');
  if (!created) return null;
  return Date.now() - new Date(created.performedAt).getTime();
}
