/**
 * Prisma repository implementations — Phase M1 Production Prisma Layer.
 * STATUS: IMPLEMENTED, PENDING PRODUCTION VERIFICATION — never executed against a real
 * database in this environment (Docker unavailable).
 *
 * NEW FILE — `src/payment/` is a FROZEN module (Phase I). This file does not modify
 * `paymentRepository.ts`; it only implements its existing interfaces. Payment has no
 * bundled `PaymentRepositories` aggregate (frozen `paymentService.ts` takes individual
 * repos as function parameters), so there is no factory function here either — each
 * class is constructed and passed in directly, exactly like the existing Memory* classes.
 *
 * `Money { amount: bigint, currency }` (ADR-004) is flattened to two Prisma columns
 * (`amount BigInt`, `currency PaymentCurrency`) and reassembled on every read.
 */

import type {
  PaymentRequest, Payment, PaymentInstallment, TreasurySubmission,
  PaymentHistoryEntry, PaymentDocument, PaymentStatus, PaymentType,
} from './paymentTypes';
import type {
  IPaymentRequestRepository, IPaymentRepository, IPaymentInstallmentRepository,
  ITreasurySubmissionRepository, IPaymentHistoryRepository, IPaymentDocumentRepository,
} from './paymentRepository';
import type { Money } from '../shared/financial/money';
import { getPrismaClient } from '../persistence/prismaClient.ts';
import { mapPrismaRow } from '../persistence/decimalMapping.ts';

function flattenMoney<T extends { amount: Money }>(entity: T): Omit<T, 'amount'> & { amount: bigint; currency: string } {
  const { amount, ...rest } = entity
  return { ...rest, amount: amount.amount, currency: amount.currency }
}

function reassembleMoney<T extends Record<string, unknown>>(row: T): T {
  const mapped = mapPrismaRow(row) as Record<string, unknown>
  const { currency, ...rest } = mapped
  return { ...rest, amount: { amount: row.amount as bigint, currency } } as unknown as T
}

export class PrismaPaymentRequestRepository implements IPaymentRequestRepository {
  async create(entity: Omit<PaymentRequest, 'id' | 'createdAt' | 'updatedAt'>): Promise<PaymentRequest> {
    const row = await getPrismaClient().paymentRequest.create({ data: flattenMoney(entity) as never })
    return reassembleMoney(row) as unknown as PaymentRequest
  }
  async update(id: string, updates: Partial<Omit<PaymentRequest, 'id' | 'createdAt'>>): Promise<PaymentRequest> {
    const data = updates.amount ? flattenMoney(updates as { amount: Money }) : updates
    const row = await getPrismaClient().paymentRequest.update({ where: { id }, data: data as never })
    return reassembleMoney(row) as unknown as PaymentRequest
  }
  async delete(id: string): Promise<void> { await getPrismaClient().paymentRequest.delete({ where: { id } }) }
  async findById(id: string): Promise<PaymentRequest | null> {
    const row = await getPrismaClient().paymentRequest.findUnique({ where: { id } })
    return row ? (reassembleMoney(row) as unknown as PaymentRequest) : null
  }
  async findAll(): Promise<readonly PaymentRequest[]> {
    const rows = await getPrismaClient().paymentRequest.findMany()
    return rows.map(r => reassembleMoney(r) as unknown as PaymentRequest)
  }
  async count(): Promise<number> { return getPrismaClient().paymentRequest.count() }

  async findByContractId(contractId: string): Promise<readonly PaymentRequest[]> {
    const rows = await getPrismaClient().paymentRequest.findMany({ where: { contractId } })
    return rows.map(r => reassembleMoney(r) as unknown as PaymentRequest)
  }
  async findByAcceptanceId(acceptanceId: string): Promise<readonly PaymentRequest[]> {
    const rows = await getPrismaClient().paymentRequest.findMany({ where: { acceptanceId } })
    return rows.map(r => reassembleMoney(r) as unknown as PaymentRequest)
  }
  async findByStatus(status: PaymentStatus): Promise<readonly PaymentRequest[]> {
    const rows = await getPrismaClient().paymentRequest.findMany({ where: { status } })
    return rows.map(r => reassembleMoney(r) as unknown as PaymentRequest)
  }
  async findByDepartment(department: string): Promise<readonly PaymentRequest[]> {
    const rows = await getPrismaClient().paymentRequest.findMany({ where: { department } })
    return rows.map(r => reassembleMoney(r) as unknown as PaymentRequest)
  }
  async findByType(paymentType: PaymentType): Promise<readonly PaymentRequest[]> {
    const rows = await getPrismaClient().paymentRequest.findMany({ where: { paymentType } })
    return rows.map(r => reassembleMoney(r) as unknown as PaymentRequest)
  }
}

export class PrismaPaymentRepository implements IPaymentRepository {
  async create(entity: Omit<Payment, 'id' | 'createdAt' | 'updatedAt'>): Promise<Payment> {
    const row = await getPrismaClient().payment.create({ data: flattenMoney(entity) as never })
    return reassembleMoney(row) as unknown as Payment
  }
  async update(id: string, updates: Partial<Omit<Payment, 'id' | 'createdAt'>>): Promise<Payment> {
    const data = updates.amount ? flattenMoney(updates as { amount: Money }) : updates
    const row = await getPrismaClient().payment.update({ where: { id }, data: data as never })
    return reassembleMoney(row) as unknown as Payment
  }
  async delete(id: string): Promise<void> { await getPrismaClient().payment.delete({ where: { id } }) }
  async findById(id: string): Promise<Payment | null> {
    const row = await getPrismaClient().payment.findUnique({ where: { id } })
    return row ? (reassembleMoney(row) as unknown as Payment) : null
  }
  async findAll(): Promise<readonly Payment[]> {
    const rows = await getPrismaClient().payment.findMany()
    return rows.map(r => reassembleMoney(r) as unknown as Payment)
  }
  async count(): Promise<number> { return getPrismaClient().payment.count() }

  async findByRequestId(requestId: string): Promise<readonly Payment[]> {
    const rows = await getPrismaClient().payment.findMany({ where: { requestId } })
    return rows.map(r => reassembleMoney(r) as unknown as Payment)
  }
}

export class PrismaPaymentInstallmentRepository implements IPaymentInstallmentRepository {
  async create(entity: Omit<PaymentInstallment, 'id' | 'createdAt' | 'updatedAt'>): Promise<PaymentInstallment> {
    const row = await getPrismaClient().paymentInstallment.create({ data: flattenMoney(entity) as never })
    return reassembleMoney(row) as unknown as PaymentInstallment
  }
  async update(id: string, updates: Partial<Omit<PaymentInstallment, 'id' | 'createdAt'>>): Promise<PaymentInstallment> {
    const data = updates.amount ? flattenMoney(updates as { amount: Money }) : updates
    const row = await getPrismaClient().paymentInstallment.update({ where: { id }, data: data as never })
    return reassembleMoney(row) as unknown as PaymentInstallment
  }
  async delete(id: string): Promise<void> { await getPrismaClient().paymentInstallment.delete({ where: { id } }) }
  async findById(id: string): Promise<PaymentInstallment | null> {
    const row = await getPrismaClient().paymentInstallment.findUnique({ where: { id } })
    return row ? (reassembleMoney(row) as unknown as PaymentInstallment) : null
  }
  async findAll(): Promise<readonly PaymentInstallment[]> {
    const rows = await getPrismaClient().paymentInstallment.findMany()
    return rows.map(r => reassembleMoney(r) as unknown as PaymentInstallment)
  }
  async count(): Promise<number> { return getPrismaClient().paymentInstallment.count() }

  async findByRequestId(requestId: string): Promise<readonly PaymentInstallment[]> {
    const rows = await getPrismaClient().paymentInstallment.findMany({ where: { requestId } })
    return rows.map(r => reassembleMoney(r) as unknown as PaymentInstallment)
  }
}

export class PrismaTreasurySubmissionRepository implements ITreasurySubmissionRepository {
  async create(entity: Omit<TreasurySubmission, 'id' | 'createdAt' | 'updatedAt'>): Promise<TreasurySubmission> {
    const row = await getPrismaClient().treasurySubmission.create({ data: entity as never })
    return mapPrismaRow(row) as unknown as TreasurySubmission
  }
  async update(id: string, updates: Partial<Omit<TreasurySubmission, 'id' | 'createdAt'>>): Promise<TreasurySubmission> {
    const row = await getPrismaClient().treasurySubmission.update({ where: { id }, data: updates as never })
    return mapPrismaRow(row) as unknown as TreasurySubmission
  }
  async delete(id: string): Promise<void> { await getPrismaClient().treasurySubmission.delete({ where: { id } }) }
  async findById(id: string): Promise<TreasurySubmission | null> {
    const row = await getPrismaClient().treasurySubmission.findUnique({ where: { id } })
    return row ? (mapPrismaRow(row) as unknown as TreasurySubmission) : null
  }
  async findAll(): Promise<readonly TreasurySubmission[]> {
    const rows = await getPrismaClient().treasurySubmission.findMany()
    return rows.map(r => mapPrismaRow(r) as unknown as TreasurySubmission)
  }
  async count(): Promise<number> { return getPrismaClient().treasurySubmission.count() }

  async findByRequestId(requestId: string): Promise<readonly TreasurySubmission[]> {
    const rows = await getPrismaClient().treasurySubmission.findMany({ where: { requestId } })
    return rows.map(r => mapPrismaRow(r) as unknown as TreasurySubmission)
  }
}

export class PrismaPaymentHistoryRepository implements IPaymentHistoryRepository {
  async create(entity: Omit<PaymentHistoryEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<PaymentHistoryEntry> {
    const row = await getPrismaClient().paymentHistoryEntry.create({ data: entity as never })
    return mapPrismaRow(row) as unknown as PaymentHistoryEntry
  }
  async update(id: string, updates: Partial<Omit<PaymentHistoryEntry, 'id' | 'createdAt'>>): Promise<PaymentHistoryEntry> {
    const row = await getPrismaClient().paymentHistoryEntry.update({ where: { id }, data: updates as never })
    return mapPrismaRow(row) as unknown as PaymentHistoryEntry
  }
  async delete(id: string): Promise<void> { await getPrismaClient().paymentHistoryEntry.delete({ where: { id } }) }
  async findById(id: string): Promise<PaymentHistoryEntry | null> {
    const row = await getPrismaClient().paymentHistoryEntry.findUnique({ where: { id } })
    return row ? (mapPrismaRow(row) as unknown as PaymentHistoryEntry) : null
  }
  async findAll(): Promise<readonly PaymentHistoryEntry[]> {
    const rows = await getPrismaClient().paymentHistoryEntry.findMany()
    return rows.map(r => mapPrismaRow(r) as unknown as PaymentHistoryEntry)
  }
  async count(): Promise<number> { return getPrismaClient().paymentHistoryEntry.count() }

  async findByRequestId(requestId: string): Promise<readonly PaymentHistoryEntry[]> {
    const rows = await getPrismaClient().paymentHistoryEntry.findMany({
      where: { requestId }, orderBy: { performedAt: 'asc' },
    })
    return rows.map(r => mapPrismaRow(r) as unknown as PaymentHistoryEntry)
  }
}

export class PrismaPaymentDocumentRepository implements IPaymentDocumentRepository {
  async create(entity: Omit<PaymentDocument, 'id' | 'createdAt' | 'updatedAt'>): Promise<PaymentDocument> {
    const row = await getPrismaClient().paymentDocument.create({ data: entity as never })
    return mapPrismaRow(row) as unknown as PaymentDocument
  }
  async update(id: string, updates: Partial<Omit<PaymentDocument, 'id' | 'createdAt'>>): Promise<PaymentDocument> {
    const row = await getPrismaClient().paymentDocument.update({ where: { id }, data: updates as never })
    return mapPrismaRow(row) as unknown as PaymentDocument
  }
  async delete(id: string): Promise<void> { await getPrismaClient().paymentDocument.delete({ where: { id } }) }
  async findById(id: string): Promise<PaymentDocument | null> {
    const row = await getPrismaClient().paymentDocument.findUnique({ where: { id } })
    return row ? (mapPrismaRow(row) as unknown as PaymentDocument) : null
  }
  async findAll(): Promise<readonly PaymentDocument[]> {
    const rows = await getPrismaClient().paymentDocument.findMany()
    return rows.map(r => mapPrismaRow(r) as unknown as PaymentDocument)
  }
  async count(): Promise<number> { return getPrismaClient().paymentDocument.count() }

  async findByRequestId(requestId: string): Promise<readonly PaymentDocument[]> {
    const rows = await getPrismaClient().paymentDocument.findMany({ where: { requestId } })
    return rows.map(r => mapPrismaRow(r) as unknown as PaymentDocument)
  }
}

/** Convenience bundle — NOT a frozen-module type; purely a construction helper for callers. */
export function buildPrismaPaymentRepositories() {
  return {
    requestRepo: new PrismaPaymentRequestRepository(),
    paymentRepo: new PrismaPaymentRepository(),
    installmentRepo: new PrismaPaymentInstallmentRepository(),
    treasuryRepo: new PrismaTreasurySubmissionRepository(),
    historyRepo: new PrismaPaymentHistoryRepository(),
    documentRepo: new PrismaPaymentDocumentRepository(),
  }
}
