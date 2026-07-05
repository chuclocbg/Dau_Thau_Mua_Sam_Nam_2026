import type { IBaseRepository } from '../shared/repository/IBaseRepository';
import type {
  IApprovalRequestRepository, IApprovalDecisionRepository,
  IApprovalHistoryRepository, IApprovalCommentRepository,
  IApprovalAttachmentRepository, ApprovalRepositories,
} from './approvalRepositories';
import type {
  ApprovalRequest, ApprovalDecisionRecord, ApprovalHistoryEntry,
  ApprovalComment, ApprovalAttachment,
  ApprovalStatus, ApprovalType, ApprovalSearchQuery, ApprovalSearchResult,
} from './approvalTypes';

// ─── Generic base ─────────────────────────────────────────────────────────────

class MemoryApprovalBaseRepository<T extends { id: string; createdAt: string; updatedAt: string }>
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

// ─── ApprovalRequest ─────────────────────────────────────────────────────────

export class MemoryApprovalRequestRepository
  extends MemoryApprovalBaseRepository<ApprovalRequest>
  implements IApprovalRequestRepository {

  async findByCode(code: string): Promise<ApprovalRequest | null> {
    return [...this.store.values()].find(r => r.requestCode === code) ?? null;
  }

  async findByStatus(status: ApprovalStatus): Promise<readonly ApprovalRequest[]> {
    return [...this.store.values()].filter(r => r.status === status);
  }

  async findBySubjectId(subjectId: string): Promise<readonly ApprovalRequest[]> {
    return [...this.store.values()].filter(r => r.subjectId === subjectId);
  }

  async findByDepartment(dept: string): Promise<readonly ApprovalRequest[]> {
    return [...this.store.values()].filter(r => r.department === dept);
  }

  async findByApprovalType(type: ApprovalType): Promise<readonly ApprovalRequest[]> {
    return [...this.store.values()].filter(r => r.approvalType === type);
  }

  async search(q: ApprovalSearchQuery): Promise<ApprovalSearchResult<ApprovalRequest>> {
    let items = [...this.store.values()];
    if (q.term) {
      const t = q.term.toLowerCase();
      items = items.filter(r =>
        r.requestCode.toLowerCase().includes(t) ||
        r.notes?.toLowerCase().includes(t));
    }
    if (q.status)      items = items.filter(r => r.status === q.status);
    if (q.approvalType) items = items.filter(r => r.approvalType === q.approvalType);
    if (q.department)  items = items.filter(r => r.department === q.department);
    if (q.subjectId)   items = items.filter(r => r.subjectId === q.subjectId);
    const total    = items.length;
    const page     = q.page ?? 1;
    const pageSize = q.pageSize ?? 20;
    return { items: items.slice((page - 1) * pageSize, page * pageSize), total, page, pageSize };
  }
}

// ─── ApprovalDecisionRecord ───────────────────────────────────────────────────

export class MemoryApprovalDecisionRepository
  extends MemoryApprovalBaseRepository<ApprovalDecisionRecord>
  implements IApprovalDecisionRepository {

  async findByRequestId(requestId: string): Promise<ApprovalDecisionRecord | null> {
    return [...this.store.values()].find(d => d.requestId === requestId) ?? null;
  }

  async findByDecidedBy(code: string): Promise<readonly ApprovalDecisionRecord[]> {
    return [...this.store.values()].filter(d => d.decidedBy === code);
  }
}

// ─── ApprovalHistoryEntry ─────────────────────────────────────────────────────

export class MemoryApprovalHistoryRepository
  extends MemoryApprovalBaseRepository<ApprovalHistoryEntry>
  implements IApprovalHistoryRepository {

  async findByRequestId(requestId: string): Promise<readonly ApprovalHistoryEntry[]> {
    return [...this.store.values()]
      .filter(e => e.requestId === requestId)
      .sort((a, b) => a.performedAt.localeCompare(b.performedAt));
  }

  async findByPerformedBy(code: string): Promise<readonly ApprovalHistoryEntry[]> {
    return [...this.store.values()].filter(e => e.performedBy === code);
  }
}

// ─── ApprovalComment ──────────────────────────────────────────────────────────

export class MemoryApprovalCommentRepository
  extends MemoryApprovalBaseRepository<ApprovalComment>
  implements IApprovalCommentRepository {

  async findByRequestId(requestId: string): Promise<readonly ApprovalComment[]> {
    return [...this.store.values()]
      .filter(c => c.requestId === requestId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async countByRequestId(requestId: string): Promise<number> {
    return [...this.store.values()].filter(c => c.requestId === requestId).length;
  }
}

// ─── ApprovalAttachment ───────────────────────────────────────────────────────

export class MemoryApprovalAttachmentRepository
  extends MemoryApprovalBaseRepository<ApprovalAttachment>
  implements IApprovalAttachmentRepository {

  async findByRequestId(requestId: string): Promise<readonly ApprovalAttachment[]> {
    return [...this.store.values()].filter(a => a.requestId === requestId);
  }

  async countByRequestId(requestId: string): Promise<number> {
    return [...this.store.values()].filter(a => a.requestId === requestId).length;
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createMemoryApprovalRepositories(): ApprovalRepositories {
  return {
    requests:    new MemoryApprovalRequestRepository(),
    decisions:   new MemoryApprovalDecisionRepository(),
    history:     new MemoryApprovalHistoryRepository(),
    comments:    new MemoryApprovalCommentRepository(),
    attachments: new MemoryApprovalAttachmentRepository(),
  };
}
