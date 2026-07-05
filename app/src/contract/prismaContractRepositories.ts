/**
 * Prisma repository implementations — Phase M1 Production Prisma Layer.
 * STATUS: IMPLEMENTED, PENDING PRODUCTION VERIFICATION — never executed against a real
 * database in this environment (Docker unavailable).
 */

import type {
  IContractRepository, IContractAmendmentRepository, IContractMilestoneRepository,
  IContractGuaranteeRepository, IContractHistoryRepository, IContractAttachmentRepository,
  ContractRepositories,
} from './contractRepositories';
import type {
  Contract, ContractAmendment, ContractMilestone, ContractGuarantee,
  ContractHistoryEntry, ContractAttachment,
  ContractStatus, ContractType, GuaranteeType,
  ContractSearchQuery, ContractSearchResult,
} from './contractTypes';
import { getPrismaClient } from '../persistence/prismaClient.ts';
import { mapPrismaRow } from '../persistence/decimalMapping.ts';

export class PrismaContractRepository implements IContractRepository {
  async create(entity: Omit<Contract, 'id' | 'createdAt' | 'updatedAt'>): Promise<Contract> {
    const row = await getPrismaClient().contract.create({ data: entity as never });
    return mapPrismaRow(row) as unknown as Contract;
  }
  async update(id: string, updates: Partial<Omit<Contract, 'id' | 'createdAt'>>): Promise<Contract> {
    const row = await getPrismaClient().contract.update({ where: { id }, data: updates as never });
    return mapPrismaRow(row) as unknown as Contract;
  }
  async delete(id: string): Promise<void> { await getPrismaClient().contract.delete({ where: { id } }); }
  async findById(id: string): Promise<Contract | null> {
    const row = await getPrismaClient().contract.findUnique({ where: { id } });
    return row ? (mapPrismaRow(row) as unknown as Contract) : null;
  }
  async findAll(): Promise<readonly Contract[]> {
    const rows = await getPrismaClient().contract.findMany();
    return rows.map(r => mapPrismaRow(r) as unknown as Contract);
  }
  async count(): Promise<number> { return getPrismaClient().contract.count(); }

  async findByNumber(contractNumber: string): Promise<Contract | null> {
    const row = await getPrismaClient().contract.findUnique({ where: { contractNumber } });
    return row ? (mapPrismaRow(row) as unknown as Contract) : null;
  }
  async findByPackageId(packageId: string): Promise<readonly Contract[]> {
    const rows = await getPrismaClient().contract.findMany({ where: { packageId } });
    return rows.map(r => mapPrismaRow(r) as unknown as Contract);
  }
  async findByStatus(status: ContractStatus): Promise<readonly Contract[]> {
    const rows = await getPrismaClient().contract.findMany({ where: { status } });
    return rows.map(r => mapPrismaRow(r) as unknown as Contract);
  }
  async findByWinnerCode(winnerCode: string): Promise<readonly Contract[]> {
    const rows = await getPrismaClient().contract.findMany({ where: { winnerCode } });
    return rows.map(r => mapPrismaRow(r) as unknown as Contract);
  }

  async search(query: ContractSearchQuery): Promise<ContractSearchResult<Contract>> {
    const prisma = getPrismaClient();
    const where: Record<string, unknown> = {}
    if (query.status) where.status = query.status
    if (query.contractType) where.contractType = query.contractType
    if (query.packageId) where.packageId = query.packageId
    if (query.winnerCode) where.winnerCode = query.winnerCode
    if (query.term) {
      where.OR = [
        { contractNumber: { contains: query.term, mode: 'insensitive' } },
        { winnerName: { contains: query.term, mode: 'insensitive' } },
      ]
    }
    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 20
    const skip = (page - 1) * pageSize
    const [rows, total] = await Promise.all([
      prisma.contract.findMany({ where: where as never, skip, take: pageSize }),
      prisma.contract.count({ where: where as never }),
    ])
    return { items: rows.map(r => mapPrismaRow(r) as unknown as Contract), total, page, pageSize };
  }
}

export class PrismaContractAmendmentRepository implements IContractAmendmentRepository {
  async create(entity: Omit<ContractAmendment, 'id' | 'createdAt' | 'updatedAt'>): Promise<ContractAmendment> {
    const row = await getPrismaClient().contractAmendment.create({ data: entity as never });
    return mapPrismaRow(row) as unknown as ContractAmendment;
  }
  async update(id: string, updates: Partial<Omit<ContractAmendment, 'id' | 'createdAt'>>): Promise<ContractAmendment> {
    const row = await getPrismaClient().contractAmendment.update({ where: { id }, data: updates as never });
    return mapPrismaRow(row) as unknown as ContractAmendment;
  }
  async delete(id: string): Promise<void> { await getPrismaClient().contractAmendment.delete({ where: { id } }); }
  async findById(id: string): Promise<ContractAmendment | null> {
    const row = await getPrismaClient().contractAmendment.findUnique({ where: { id } });
    return row ? (mapPrismaRow(row) as unknown as ContractAmendment) : null;
  }
  async findAll(): Promise<readonly ContractAmendment[]> {
    const rows = await getPrismaClient().contractAmendment.findMany();
    return rows.map(r => mapPrismaRow(r) as unknown as ContractAmendment);
  }
  async count(): Promise<number> { return getPrismaClient().contractAmendment.count(); }

  async findByContractId(contractId: string): Promise<readonly ContractAmendment[]> {
    const rows = await getPrismaClient().contractAmendment.findMany({ where: { contractId } });
    return rows.map(r => mapPrismaRow(r) as unknown as ContractAmendment);
  }
  async findLatestByContractId(contractId: string): Promise<ContractAmendment | null> {
    const row = await getPrismaClient().contractAmendment.findFirst({
      where: { contractId }, orderBy: { createdAt: 'desc' },
    });
    return row ? (mapPrismaRow(row) as unknown as ContractAmendment) : null;
  }
}

export class PrismaContractMilestoneRepository implements IContractMilestoneRepository {
  async create(entity: Omit<ContractMilestone, 'id' | 'createdAt' | 'updatedAt'>): Promise<ContractMilestone> {
    const row = await getPrismaClient().contractMilestone.create({ data: entity as never });
    return mapPrismaRow(row) as unknown as ContractMilestone;
  }
  async update(id: string, updates: Partial<Omit<ContractMilestone, 'id' | 'createdAt'>>): Promise<ContractMilestone> {
    const row = await getPrismaClient().contractMilestone.update({ where: { id }, data: updates as never });
    return mapPrismaRow(row) as unknown as ContractMilestone;
  }
  async delete(id: string): Promise<void> { await getPrismaClient().contractMilestone.delete({ where: { id } }); }
  async findById(id: string): Promise<ContractMilestone | null> {
    const row = await getPrismaClient().contractMilestone.findUnique({ where: { id } });
    return row ? (mapPrismaRow(row) as unknown as ContractMilestone) : null;
  }
  async findAll(): Promise<readonly ContractMilestone[]> {
    const rows = await getPrismaClient().contractMilestone.findMany();
    return rows.map(r => mapPrismaRow(r) as unknown as ContractMilestone);
  }
  async count(): Promise<number> { return getPrismaClient().contractMilestone.count(); }

  async findByContractId(contractId: string): Promise<readonly ContractMilestone[]> {
    const rows = await getPrismaClient().contractMilestone.findMany({ where: { contractId } });
    return rows.map(r => mapPrismaRow(r) as unknown as ContractMilestone);
  }
  async findPendingByContractId(contractId: string): Promise<readonly ContractMilestone[]> {
    const rows = await getPrismaClient().contractMilestone.findMany({ where: { contractId, status: 'PENDING' } });
    return rows.map(r => mapPrismaRow(r) as unknown as ContractMilestone);
  }
}

export class PrismaContractGuaranteeRepository implements IContractGuaranteeRepository {
  async create(entity: Omit<ContractGuarantee, 'id' | 'createdAt' | 'updatedAt'>): Promise<ContractGuarantee> {
    const row = await getPrismaClient().contractGuarantee.create({ data: entity as never });
    return mapPrismaRow(row) as unknown as ContractGuarantee;
  }
  async update(id: string, updates: Partial<Omit<ContractGuarantee, 'id' | 'createdAt'>>): Promise<ContractGuarantee> {
    const row = await getPrismaClient().contractGuarantee.update({ where: { id }, data: updates as never });
    return mapPrismaRow(row) as unknown as ContractGuarantee;
  }
  async delete(id: string): Promise<void> { await getPrismaClient().contractGuarantee.delete({ where: { id } }); }
  async findById(id: string): Promise<ContractGuarantee | null> {
    const row = await getPrismaClient().contractGuarantee.findUnique({ where: { id } });
    return row ? (mapPrismaRow(row) as unknown as ContractGuarantee) : null;
  }
  async findAll(): Promise<readonly ContractGuarantee[]> {
    const rows = await getPrismaClient().contractGuarantee.findMany();
    return rows.map(r => mapPrismaRow(r) as unknown as ContractGuarantee);
  }
  async count(): Promise<number> { return getPrismaClient().contractGuarantee.count(); }

  async findByContractId(contractId: string): Promise<readonly ContractGuarantee[]> {
    const rows = await getPrismaClient().contractGuarantee.findMany({ where: { contractId } });
    return rows.map(r => mapPrismaRow(r) as unknown as ContractGuarantee);
  }
  async findActiveByContractId(contractId: string): Promise<readonly ContractGuarantee[]> {
    const rows = await getPrismaClient().contractGuarantee.findMany({ where: { contractId, status: 'ACTIVE' } });
    return rows.map(r => mapPrismaRow(r) as unknown as ContractGuarantee);
  }
  async findByType(contractId: string, type: GuaranteeType): Promise<ContractGuarantee | null> {
    const row = await getPrismaClient().contractGuarantee.findFirst({
      where: { contractId, guaranteeType: type, status: 'ACTIVE' },
    });
    return row ? (mapPrismaRow(row) as unknown as ContractGuarantee) : null;
  }
}

export class PrismaContractHistoryRepository implements IContractHistoryRepository {
  async create(entity: Omit<ContractHistoryEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<ContractHistoryEntry> {
    const row = await getPrismaClient().contractHistoryEntry.create({ data: entity as never });
    return mapPrismaRow(row) as unknown as ContractHistoryEntry;
  }
  async update(id: string, updates: Partial<Omit<ContractHistoryEntry, 'id' | 'createdAt'>>): Promise<ContractHistoryEntry> {
    const row = await getPrismaClient().contractHistoryEntry.update({ where: { id }, data: updates as never });
    return mapPrismaRow(row) as unknown as ContractHistoryEntry;
  }
  async delete(id: string): Promise<void> { await getPrismaClient().contractHistoryEntry.delete({ where: { id } }); }
  async findById(id: string): Promise<ContractHistoryEntry | null> {
    const row = await getPrismaClient().contractHistoryEntry.findUnique({ where: { id } });
    return row ? (mapPrismaRow(row) as unknown as ContractHistoryEntry) : null;
  }
  async findAll(): Promise<readonly ContractHistoryEntry[]> {
    const rows = await getPrismaClient().contractHistoryEntry.findMany();
    return rows.map(r => mapPrismaRow(r) as unknown as ContractHistoryEntry);
  }
  async count(): Promise<number> { return getPrismaClient().contractHistoryEntry.count(); }

  async findByContractId(contractId: string): Promise<readonly ContractHistoryEntry[]> {
    const rows = await getPrismaClient().contractHistoryEntry.findMany({ where: { contractId } });
    return rows.map(r => mapPrismaRow(r) as unknown as ContractHistoryEntry);
  }
  async findByPerformedBy(employeeCode: string): Promise<readonly ContractHistoryEntry[]> {
    const rows = await getPrismaClient().contractHistoryEntry.findMany({ where: { performedBy: employeeCode } });
    return rows.map(r => mapPrismaRow(r) as unknown as ContractHistoryEntry);
  }
}

export class PrismaContractAttachmentRepository implements IContractAttachmentRepository {
  async create(entity: Omit<ContractAttachment, 'id' | 'createdAt' | 'updatedAt'>): Promise<ContractAttachment> {
    const row = await getPrismaClient().contractAttachment.create({ data: entity as never });
    return mapPrismaRow(row) as unknown as ContractAttachment;
  }
  async update(id: string, updates: Partial<Omit<ContractAttachment, 'id' | 'createdAt'>>): Promise<ContractAttachment> {
    const row = await getPrismaClient().contractAttachment.update({ where: { id }, data: updates as never });
    return mapPrismaRow(row) as unknown as ContractAttachment;
  }
  async delete(id: string): Promise<void> { await getPrismaClient().contractAttachment.delete({ where: { id } }); }
  async findById(id: string): Promise<ContractAttachment | null> {
    const row = await getPrismaClient().contractAttachment.findUnique({ where: { id } });
    return row ? (mapPrismaRow(row) as unknown as ContractAttachment) : null;
  }
  async findAll(): Promise<readonly ContractAttachment[]> {
    const rows = await getPrismaClient().contractAttachment.findMany();
    return rows.map(r => mapPrismaRow(r) as unknown as ContractAttachment);
  }
  async count(): Promise<number> { return getPrismaClient().contractAttachment.count(); }

  async findByContractId(contractId: string): Promise<readonly ContractAttachment[]> {
    const rows = await getPrismaClient().contractAttachment.findMany({ where: { contractId } });
    return rows.map(r => mapPrismaRow(r) as unknown as ContractAttachment);
  }
  async countByContractId(contractId: string): Promise<number> {
    return getPrismaClient().contractAttachment.count({ where: { contractId } });
  }
}

export function buildPrismaContractRepositories(): ContractRepositories {
  return {
    contracts: new PrismaContractRepository(),
    amendments: new PrismaContractAmendmentRepository(),
    milestones: new PrismaContractMilestoneRepository(),
    guarantees: new PrismaContractGuaranteeRepository(),
    history: new PrismaContractHistoryRepository(),
    attachments: new PrismaContractAttachmentRepository(),
  };
}
