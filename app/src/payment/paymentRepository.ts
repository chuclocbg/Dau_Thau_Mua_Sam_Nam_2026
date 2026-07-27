import type { IBaseRepository } from '../shared/repository/IBaseRepository';
import type {
  PaymentRequest, Payment, PaymentInstallment,
  PaymentHistoryEntry, PaymentDocument, TreasurySubmission,
  PaymentStatus, PaymentType,
} from './paymentTypes';

// ─── Repository interfaces ────────────────────────────────────────────────────

export interface IPaymentRequestRepository extends IBaseRepository<PaymentRequest> {
  findByContractId(contractId: string): Promise<readonly PaymentRequest[]>;
  findByAcceptanceId(acceptanceId: string): Promise<readonly PaymentRequest[]>;
  findByStatus(status: PaymentStatus): Promise<readonly PaymentRequest[]>;
  findByDepartment(department: string): Promise<readonly PaymentRequest[]>;
  findByType(paymentType: PaymentType): Promise<readonly PaymentRequest[]>;
}

export interface IPaymentRepository extends IBaseRepository<Payment> {
  findByRequestId(requestId: string): Promise<readonly Payment[]>;
}

export interface IPaymentInstallmentRepository extends IBaseRepository<PaymentInstallment> {
  findByRequestId(requestId: string): Promise<readonly PaymentInstallment[]>;
}

export interface ITreasurySubmissionRepository extends IBaseRepository<TreasurySubmission> {
  findByRequestId(requestId: string): Promise<readonly TreasurySubmission[]>;
}

export interface IPaymentHistoryRepository extends IBaseRepository<PaymentHistoryEntry> {
  findByRequestId(requestId: string): Promise<readonly PaymentHistoryEntry[]>;
}

export interface IPaymentDocumentRepository extends IBaseRepository<PaymentDocument> {
  findByRequestId(requestId: string): Promise<readonly PaymentDocument[]>;
}

// ─── In-memory implementations ────────────────────────────────────────────────

function now(): string { return new Date().toISOString(); }
function uuid(): string { return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`; }

export class MemoryPaymentRequestRepository implements IPaymentRequestRepository {
  private store = new Map<string, PaymentRequest>();

  async create(entity: Omit<PaymentRequest, 'id' | 'createdAt' | 'updatedAt'>): Promise<PaymentRequest> {
    const rec = { ...entity, id: uuid(), createdAt: now(), updatedAt: now() } as PaymentRequest;
    this.store.set(rec.id, rec);
    return rec;
  }
  async update(id: string, updates: Partial<Omit<PaymentRequest, 'id' | 'createdAt'>>): Promise<PaymentRequest> {
    const existing = this.store.get(id);
    if (!existing) throw new Error(`PaymentRequest ${id} not found`);
    const updated = { ...existing, ...updates, updatedAt: now() };
    this.store.set(id, updated);
    return updated;
  }
  async delete(id: string): Promise<void> { this.store.delete(id); }
  async findById(id: string): Promise<PaymentRequest | null> { return this.store.get(id) ?? null; }
  async findAll(): Promise<readonly PaymentRequest[]> { return [...this.store.values()]; }
  async count(): Promise<number> { return this.store.size; }
  async findByContractId(contractId: string): Promise<readonly PaymentRequest[]> {
    return [...this.store.values()].filter(r => r.contractId === contractId);
  }
  async findByAcceptanceId(acceptanceId: string): Promise<readonly PaymentRequest[]> {
    return [...this.store.values()].filter(r => r.acceptanceId === acceptanceId);
  }
  async findByStatus(status: PaymentStatus): Promise<readonly PaymentRequest[]> {
    return [...this.store.values()].filter(r => r.status === status);
  }
  async findByDepartment(department: string): Promise<readonly PaymentRequest[]> {
    return [...this.store.values()].filter(r => r.department === department);
  }
  async findByType(paymentType: PaymentType): Promise<readonly PaymentRequest[]> {
    return [...this.store.values()].filter(r => r.paymentType === paymentType);
  }
}

export class MemoryPaymentRepository implements IPaymentRepository {
  private store = new Map<string, Payment>();

  async create(entity: Omit<Payment, 'id' | 'createdAt' | 'updatedAt'>): Promise<Payment> {
    const rec = { ...entity, id: uuid(), createdAt: now(), updatedAt: now() } as Payment;
    this.store.set(rec.id, rec);
    return rec;
  }
  async update(id: string, updates: Partial<Omit<Payment, 'id' | 'createdAt'>>): Promise<Payment> {
    const existing = this.store.get(id);
    if (!existing) throw new Error(`Payment ${id} not found`);
    const updated = { ...existing, ...updates, updatedAt: now() };
    this.store.set(id, updated);
    return updated;
  }
  async delete(id: string): Promise<void> { this.store.delete(id); }
  async findById(id: string): Promise<Payment | null> { return this.store.get(id) ?? null; }
  async findAll(): Promise<readonly Payment[]> { return [...this.store.values()]; }
  async count(): Promise<number> { return this.store.size; }
  async findByRequestId(requestId: string): Promise<readonly Payment[]> {
    return [...this.store.values()].filter(p => p.requestId === requestId);
  }
}

export class MemoryPaymentInstallmentRepository implements IPaymentInstallmentRepository {
  private store = new Map<string, PaymentInstallment>();

  async create(entity: Omit<PaymentInstallment, 'id' | 'createdAt' | 'updatedAt'>): Promise<PaymentInstallment> {
    const rec = { ...entity, id: uuid(), createdAt: now(), updatedAt: now() } as PaymentInstallment;
    this.store.set(rec.id, rec);
    return rec;
  }
  async update(id: string, updates: Partial<Omit<PaymentInstallment, 'id' | 'createdAt'>>): Promise<PaymentInstallment> {
    const existing = this.store.get(id);
    if (!existing) throw new Error(`PaymentInstallment ${id} not found`);
    const updated = { ...existing, ...updates, updatedAt: now() };
    this.store.set(id, updated);
    return updated;
  }
  async delete(id: string): Promise<void> { this.store.delete(id); }
  async findById(id: string): Promise<PaymentInstallment | null> { return this.store.get(id) ?? null; }
  async findAll(): Promise<readonly PaymentInstallment[]> { return [...this.store.values()]; }
  async count(): Promise<number> { return this.store.size; }
  async findByRequestId(requestId: string): Promise<readonly PaymentInstallment[]> {
    return [...this.store.values()].filter(i => i.requestId === requestId);
  }
}

export class MemoryTreasurySubmissionRepository implements ITreasurySubmissionRepository {
  private store = new Map<string, TreasurySubmission>();

  async create(entity: Omit<TreasurySubmission, 'id' | 'createdAt' | 'updatedAt'>): Promise<TreasurySubmission> {
    const rec = { ...entity, id: uuid(), createdAt: now(), updatedAt: now() } as TreasurySubmission;
    this.store.set(rec.id, rec);
    return rec;
  }
  async update(id: string, updates: Partial<Omit<TreasurySubmission, 'id' | 'createdAt'>>): Promise<TreasurySubmission> {
    const existing = this.store.get(id);
    if (!existing) throw new Error(`TreasurySubmission ${id} not found`);
    const updated = { ...existing, ...updates, updatedAt: now() };
    this.store.set(id, updated);
    return updated;
  }
  async delete(id: string): Promise<void> { this.store.delete(id); }
  async findById(id: string): Promise<TreasurySubmission | null> { return this.store.get(id) ?? null; }
  async findAll(): Promise<readonly TreasurySubmission[]> { return [...this.store.values()]; }
  async count(): Promise<number> { return this.store.size; }
  async findByRequestId(requestId: string): Promise<readonly TreasurySubmission[]> {
    return [...this.store.values()].filter(s => s.requestId === requestId);
  }
}

export class MemoryPaymentHistoryRepository implements IPaymentHistoryRepository {
  private store = new Map<string, PaymentHistoryEntry>();

  async create(entity: Omit<PaymentHistoryEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<PaymentHistoryEntry> {
    const rec = { ...entity, id: uuid(), createdAt: now(), updatedAt: now() } as PaymentHistoryEntry;
    this.store.set(rec.id, rec);
    return rec;
  }
  async update(id: string, updates: Partial<Omit<PaymentHistoryEntry, 'id' | 'createdAt'>>): Promise<PaymentHistoryEntry> {
    const existing = this.store.get(id);
    if (!existing) throw new Error(`PaymentHistoryEntry ${id} not found`);
    const updated = { ...existing, ...updates, updatedAt: now() };
    this.store.set(id, updated);
    return updated;
  }
  async delete(id: string): Promise<void> { this.store.delete(id); }
  async findById(id: string): Promise<PaymentHistoryEntry | null> { return this.store.get(id) ?? null; }
  async findAll(): Promise<readonly PaymentHistoryEntry[]> { return [...this.store.values()]; }
  async count(): Promise<number> { return this.store.size; }
  async findByRequestId(requestId: string): Promise<readonly PaymentHistoryEntry[]> {
    return [...this.store.values()]
      .filter(e => e.requestId === requestId)
      .sort((a, b) => a.performedAt.localeCompare(b.performedAt));
  }
}

export class MemoryPaymentDocumentRepository implements IPaymentDocumentRepository {
  private store = new Map<string, PaymentDocument>();

  async create(entity: Omit<PaymentDocument, 'id' | 'createdAt' | 'updatedAt'>): Promise<PaymentDocument> {
    const rec = { ...entity, id: uuid(), createdAt: now(), updatedAt: now() } as PaymentDocument;
    this.store.set(rec.id, rec);
    return rec;
  }
  async update(id: string, updates: Partial<Omit<PaymentDocument, 'id' | 'createdAt'>>): Promise<PaymentDocument> {
    const existing = this.store.get(id);
    if (!existing) throw new Error(`PaymentDocument ${id} not found`);
    const updated = { ...existing, ...updates, updatedAt: now() };
    this.store.set(id, updated);
    return updated;
  }
  async delete(id: string): Promise<void> { this.store.delete(id); }
  async findById(id: string): Promise<PaymentDocument | null> { return this.store.get(id) ?? null; }
  async findAll(): Promise<readonly PaymentDocument[]> { return [...this.store.values()]; }
  async count(): Promise<number> { return this.store.size; }
  async findByRequestId(requestId: string): Promise<readonly PaymentDocument[]> {
    return [...this.store.values()].filter(d => d.requestId === requestId);
  }
}
