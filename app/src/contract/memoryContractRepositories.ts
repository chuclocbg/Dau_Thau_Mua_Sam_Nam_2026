import type { IBaseRepository } from '../shared/repository/IBaseRepository';
import type {
  IContractRepository, IContractAmendmentRepository,
  IContractMilestoneRepository, IContractGuaranteeRepository,
  IContractHistoryRepository, IContractAttachmentRepository,
  ContractRepositories,
} from './contractRepositories';
import type {
  Contract, ContractAmendment, ContractMilestone, ContractGuarantee,
  ContractHistoryEntry, ContractAttachment,
  ContractStatus, ContractType, GuaranteeType,
  ContractSearchQuery, ContractSearchResult,
} from './contractTypes';

// ─── Generic base ─────────────────────────────────────────────────────────────

class MemoryContractBase<T extends { id: string; createdAt: string; updatedAt: string }>
  implements IBaseRepository<T> {
  protected readonly store = new Map<string, T>();

  async create(entity: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T> {
    const now = new Date().toISOString();
    const record = { ...entity, id: crypto.randomUUID(), createdAt: now, updatedAt: now } as T;
    this.store.set(record.id, record);
    return record;
  }

  async update(id: string, updates: Partial<Omit<T, 'id' | 'createdAt'>>): Promise<T> {
    const existing = this.store.get(id);
    if (!existing) throw new Error(`Record not found: ${id}`);
    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() } as T;
    this.store.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> { this.store.delete(id); }
  async findById(id: string): Promise<T | null> { return this.store.get(id) ?? null; }
  async findAll(): Promise<readonly T[]> { return [...this.store.values()]; }
  async count(): Promise<number> { return this.store.size; }
}

// ─── Contract ─────────────────────────────────────────────────────────────────

export class MemoryContractRepository
  extends MemoryContractBase<Contract>
  implements IContractRepository {

  async findByNumber(n: string): Promise<Contract | null> {
    return [...this.store.values()].find(c => c.contractNumber === n) ?? null;
  }
  async findByPackageId(id: string): Promise<readonly Contract[]> {
    return [...this.store.values()].filter(c => c.packageId === id);
  }
  async findByStatus(s: ContractStatus): Promise<readonly Contract[]> {
    return [...this.store.values()].filter(c => c.status === s);
  }
  async findByWinnerCode(code: string): Promise<readonly Contract[]> {
    return [...this.store.values()].filter(c => c.winnerCode === code);
  }
  async search(q: ContractSearchQuery): Promise<ContractSearchResult<Contract>> {
    let items = [...this.store.values()];
    if (q.term) {
      const t = q.term.toLowerCase();
      items = items.filter(c => c.contractNumber.toLowerCase().includes(t) || c.winnerName.toLowerCase().includes(t));
    }
    if (q.status)       items = items.filter(c => c.status === q.status);
    if (q.contractType) items = items.filter(c => c.contractType === q.contractType);
    if (q.packageId)    items = items.filter(c => c.packageId === q.packageId);
    if (q.winnerCode)   items = items.filter(c => c.winnerCode === q.winnerCode);
    const total    = items.length;
    const page     = q.page ?? 1;
    const pageSize = q.pageSize ?? 20;
    return { items: items.slice((page - 1) * pageSize, page * pageSize), total, page, pageSize };
  }
}

// ─── Amendment ────────────────────────────────────────────────────────────────

export class MemoryContractAmendmentRepository
  extends MemoryContractBase<ContractAmendment>
  implements IContractAmendmentRepository {

  async findByContractId(id: string): Promise<readonly ContractAmendment[]> {
    return [...this.store.values()]
      .filter(a => a.contractId === id)
      .sort((a, b) => a.amendmentNumber - b.amendmentNumber);
  }
  async findLatestByContractId(id: string): Promise<ContractAmendment | null> {
    const all = await this.findByContractId(id);
    return all.length > 0 ? all[all.length - 1]! : null;
  }
}

// ─── Milestone ────────────────────────────────────────────────────────────────

export class MemoryContractMilestoneRepository
  extends MemoryContractBase<ContractMilestone>
  implements IContractMilestoneRepository {

  async findByContractId(id: string): Promise<readonly ContractMilestone[]> {
    return [...this.store.values()]
      .filter(m => m.contractId === id)
      .sort((a, b) => a.plannedDate.localeCompare(b.plannedDate));
  }
  async findPendingByContractId(id: string): Promise<readonly ContractMilestone[]> {
    return [...this.store.values()].filter(m => m.contractId === id && m.status === 'PENDING');
  }
}

// ─── Guarantee ────────────────────────────────────────────────────────────────

export class MemoryContractGuaranteeRepository
  extends MemoryContractBase<ContractGuarantee>
  implements IContractGuaranteeRepository {

  async findByContractId(id: string): Promise<readonly ContractGuarantee[]> {
    return [...this.store.values()].filter(g => g.contractId === id);
  }
  async findActiveByContractId(id: string): Promise<readonly ContractGuarantee[]> {
    return [...this.store.values()].filter(g => g.contractId === id && g.status === 'ACTIVE');
  }
  async findByType(contractId: string, type: GuaranteeType): Promise<ContractGuarantee | null> {
    return [...this.store.values()].find(g => g.contractId === contractId && g.guaranteeType === type && g.status === 'ACTIVE') ?? null;
  }
}

// ─── History ──────────────────────────────────────────────────────────────────

export class MemoryContractHistoryRepository
  extends MemoryContractBase<ContractHistoryEntry>
  implements IContractHistoryRepository {

  async findByContractId(id: string): Promise<readonly ContractHistoryEntry[]> {
    return [...this.store.values()]
      .filter(e => e.contractId === id)
      .sort((a, b) => a.performedAt.localeCompare(b.performedAt));
  }
  async findByPerformedBy(code: string): Promise<readonly ContractHistoryEntry[]> {
    return [...this.store.values()].filter(e => e.performedBy === code);
  }
}

// ─── Attachment ───────────────────────────────────────────────────────────────

export class MemoryContractAttachmentRepository
  extends MemoryContractBase<ContractAttachment>
  implements IContractAttachmentRepository {

  async findByContractId(id: string): Promise<readonly ContractAttachment[]> {
    return [...this.store.values()].filter(a => a.contractId === id);
  }
  async countByContractId(id: string): Promise<number> {
    return [...this.store.values()].filter(a => a.contractId === id).length;
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createMemoryContractRepositories(): ContractRepositories {
  return {
    contracts:   new MemoryContractRepository(),
    amendments:  new MemoryContractAmendmentRepository(),
    milestones:  new MemoryContractMilestoneRepository(),
    guarantees:  new MemoryContractGuaranteeRepository(),
    history:     new MemoryContractHistoryRepository(),
    attachments: new MemoryContractAttachmentRepository(),
  };
}
