import type { IBaseRepository } from '../shared/repository/IBaseRepository';
import type {
  IAcceptanceRequestRepository, IAcceptanceCommitteeRepository,
  IAcceptanceMemberRepository, IAcceptanceSessionRepository,
  IAcceptanceItemRepository, IAcceptanceMinuteRepository,
  IAcceptanceHistoryRepository, IAcceptanceAttachmentRepository,
  AcceptanceRepositories,
} from './acceptanceRepositories';
import type {
  AcceptanceRequest, AcceptanceCommittee, AcceptanceMember,
  AcceptanceSession, AcceptanceItem, AcceptanceMinute,
  AcceptanceHistoryEntry, AcceptanceAttachment,
  AcceptanceStatus, AcceptanceSearchQuery, AcceptanceSearchResult,
} from './acceptanceTypes';

// ─── Generic base ─────────────────────────────────────────────────────────────

class MemoryAcceptanceBase<T extends { id: string; createdAt: string; updatedAt: string }>
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

// ─── Request ──────────────────────────────────────────────────────────────────

export class MemoryAcceptanceRequestRepository
  extends MemoryAcceptanceBase<AcceptanceRequest>
  implements IAcceptanceRequestRepository {

  async findByCode(code: string): Promise<AcceptanceRequest | null> {
    return [...this.store.values()].find(r => r.requestCode === code) ?? null;
  }
  async findByContractId(id: string): Promise<readonly AcceptanceRequest[]> {
    return [...this.store.values()].filter(r => r.contractId === id);
  }
  async findByStatus(s: AcceptanceStatus): Promise<readonly AcceptanceRequest[]> {
    return [...this.store.values()].filter(r => r.status === s);
  }
  async search(q: AcceptanceSearchQuery): Promise<AcceptanceSearchResult<AcceptanceRequest>> {
    let items = [...this.store.values()];
    if (q.contractId)     items = items.filter(r => r.contractId === q.contractId);
    if (q.status)         items = items.filter(r => r.status === q.status);
    if (q.acceptanceType) items = items.filter(r => r.acceptanceType === q.acceptanceType);
    if (q.department)     items = items.filter(r => r.department === q.department);
    const total    = items.length;
    const page     = q.page ?? 1;
    const pageSize = q.pageSize ?? 20;
    return { items: items.slice((page - 1) * pageSize, page * pageSize), total, page, pageSize };
  }
}

// ─── Committee ────────────────────────────────────────────────────────────────

export class MemoryAcceptanceCommitteeRepository
  extends MemoryAcceptanceBase<AcceptanceCommittee>
  implements IAcceptanceCommitteeRepository {

  async findByRequestId(id: string): Promise<AcceptanceCommittee | null> {
    return [...this.store.values()].find(c => c.requestId === id) ?? null;
  }
}

// ─── Member ───────────────────────────────────────────────────────────────────

export class MemoryAcceptanceMemberRepository
  extends MemoryAcceptanceBase<AcceptanceMember>
  implements IAcceptanceMemberRepository {

  async findByCommitteeId(id: string): Promise<readonly AcceptanceMember[]> {
    return [...this.store.values()].filter(m => m.committeeId === id);
  }
  async findActiveByCommitteeId(id: string): Promise<readonly AcceptanceMember[]> {
    return [...this.store.values()].filter(m => m.committeeId === id && m.isActive);
  }
  async findByRequestId(id: string): Promise<readonly AcceptanceMember[]> {
    return [...this.store.values()].filter(m => m.requestId === id && m.isActive);
  }
}

// ─── Session ──────────────────────────────────────────────────────────────────

export class MemoryAcceptanceSessionRepository
  extends MemoryAcceptanceBase<AcceptanceSession>
  implements IAcceptanceSessionRepository {

  async findByRequestId(id: string): Promise<readonly AcceptanceSession[]> {
    return [...this.store.values()]
      .filter(s => s.requestId === id)
      .sort((a, b) => a.sessionNumber - b.sessionNumber);
  }
  async findLatestByRequestId(id: string): Promise<AcceptanceSession | null> {
    const all = await this.findByRequestId(id);
    return all.length > 0 ? all[all.length - 1]! : null;
  }
  async findCompletedByRequestId(id: string): Promise<readonly AcceptanceSession[]> {
    return [...this.store.values()].filter(s => s.requestId === id && s.status === 'COMPLETED');
  }
}

// ─── Item ─────────────────────────────────────────────────────────────────────

export class MemoryAcceptanceItemRepository
  extends MemoryAcceptanceBase<AcceptanceItem>
  implements IAcceptanceItemRepository {

  async findBySessionId(id: string): Promise<readonly AcceptanceItem[]> {
    return [...this.store.values()].filter(i => i.sessionId === id);
  }
  async findByRequestId(id: string): Promise<readonly AcceptanceItem[]> {
    return [...this.store.values()].filter(i => i.requestId === id);
  }
  async countAcceptedByRequestId(id: string): Promise<number> {
    return [...this.store.values()].filter(i => i.requestId === id && i.status === 'ACCEPTED').length;
  }
  async countRejectedByRequestId(id: string): Promise<number> {
    return [...this.store.values()].filter(i => i.requestId === id && i.status === 'REJECTED').length;
  }
}

// ─── Minute ───────────────────────────────────────────────────────────────────

export class MemoryAcceptanceMinuteRepository
  extends MemoryAcceptanceBase<AcceptanceMinute>
  implements IAcceptanceMinuteRepository {

  async findBySessionId(id: string): Promise<AcceptanceMinute | null> {
    return [...this.store.values()].find(m => m.sessionId === id) ?? null;
  }
  async findByRequestId(id: string): Promise<readonly AcceptanceMinute[]> {
    return [...this.store.values()].filter(m => m.requestId === id);
  }
}

// ─── History ──────────────────────────────────────────────────────────────────

export class MemoryAcceptanceHistoryRepository
  extends MemoryAcceptanceBase<AcceptanceHistoryEntry>
  implements IAcceptanceHistoryRepository {

  async findByRequestId(id: string): Promise<readonly AcceptanceHistoryEntry[]> {
    return [...this.store.values()]
      .filter(e => e.requestId === id)
      .sort((a, b) => a.performedAt.localeCompare(b.performedAt));
  }
}

// ─── Attachment ───────────────────────────────────────────────────────────────

export class MemoryAcceptanceAttachmentRepository
  extends MemoryAcceptanceBase<AcceptanceAttachment>
  implements IAcceptanceAttachmentRepository {

  async findByRequestId(id: string): Promise<readonly AcceptanceAttachment[]> {
    return [...this.store.values()].filter(a => a.requestId === id);
  }
  async countByRequestId(id: string): Promise<number> {
    return [...this.store.values()].filter(a => a.requestId === id).length;
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createMemoryAcceptanceRepositories(): AcceptanceRepositories {
  return {
    requests:    new MemoryAcceptanceRequestRepository(),
    committees:  new MemoryAcceptanceCommitteeRepository(),
    members:     new MemoryAcceptanceMemberRepository(),
    sessions:    new MemoryAcceptanceSessionRepository(),
    items:       new MemoryAcceptanceItemRepository(),
    minutes:     new MemoryAcceptanceMinuteRepository(),
    history:     new MemoryAcceptanceHistoryRepository(),
    attachments: new MemoryAcceptanceAttachmentRepository(),
  };
}
