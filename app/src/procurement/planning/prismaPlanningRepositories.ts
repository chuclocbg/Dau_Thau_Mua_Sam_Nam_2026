/**
 * Prisma repository implementations — Phase M1 Production Prisma Layer.
 * STATUS: IMPLEMENTED, PENDING PRODUCTION VERIFICATION — never executed against a real
 * database in this environment (Docker unavailable).
 */

import type {
  ProcurementRequest, ProcurementPlan, ProcurementDemand,
  FundingAllocation, PackageProposal, AnnualProcurementPlan,
  RequestStatus, PlanStatus, DemandStatus, ProposalStatus,
  PlanningSearchQuery, PlanningSearchResult,
} from './planningTypes';
import type {
  IProcurementRequestRepository, IProcurementPlanRepository, IProcurementDemandRepository,
  IFundingAllocationRepository, IPackageProposalRepository, IAnnualProcurementPlanRepository,
  PlanningRepositories,
} from './planningRepository';
import { getPrismaClient } from '../../persistence/prismaClient.ts';
import { mapPrismaRow } from '../../persistence/decimalMapping.ts';

// ─── ProcurementRequest ───────────────────────────────────────────────────────

export class PrismaProcurementRequestRepository implements IProcurementRequestRepository {
  async create(entity: Omit<ProcurementRequest, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProcurementRequest> {
    const row = await getPrismaClient().procurementRequest.create({ data: entity as never });
    return mapPrismaRow(row) as unknown as ProcurementRequest;
  }
  async update(id: string, updates: Partial<Omit<ProcurementRequest, 'id' | 'createdAt'>>): Promise<ProcurementRequest> {
    const row = await getPrismaClient().procurementRequest.update({ where: { id }, data: updates as never });
    return mapPrismaRow(row) as unknown as ProcurementRequest;
  }
  async delete(id: string): Promise<void> { await getPrismaClient().procurementRequest.delete({ where: { id } }); }
  async findById(id: string): Promise<ProcurementRequest | null> {
    const row = await getPrismaClient().procurementRequest.findUnique({ where: { id } });
    return row ? (mapPrismaRow(row) as unknown as ProcurementRequest) : null;
  }
  async findAll(): Promise<readonly ProcurementRequest[]> {
    const rows = await getPrismaClient().procurementRequest.findMany();
    return rows.map(r => mapPrismaRow(r) as unknown as ProcurementRequest);
  }
  async count(): Promise<number> { return getPrismaClient().procurementRequest.count(); }

  async findByCode(code: string): Promise<ProcurementRequest | null> {
    const row = await getPrismaClient().procurementRequest.findUnique({ where: { requestCode: code } });
    return row ? (mapPrismaRow(row) as unknown as ProcurementRequest) : null;
  }
  async findByStatus(status: RequestStatus): Promise<readonly ProcurementRequest[]> {
    const rows = await getPrismaClient().procurementRequest.findMany({ where: { status } });
    return rows.map(r => mapPrismaRow(r) as unknown as ProcurementRequest);
  }
  async findByDepartment(dept: string): Promise<readonly ProcurementRequest[]> {
    const rows = await getPrismaClient().procurementRequest.findMany({ where: { department: dept } });
    return rows.map(r => mapPrismaRow(r) as unknown as ProcurementRequest);
  }
  async findByPlanId(planId: string): Promise<readonly ProcurementRequest[]> {
    const rows = await getPrismaClient().procurementRequest.findMany({ where: { planId } });
    return rows.map(r => mapPrismaRow(r) as unknown as ProcurementRequest);
  }

  async search(query: PlanningSearchQuery): Promise<PlanningSearchResult<ProcurementRequest>> {
    const prisma = getPrismaClient();
    const where: Record<string, unknown> = {}
    if (query.status) where.status = query.status
    if (query.department) where.department = query.department
    if (query.fiscalYear) where.expectedTimeline = { startsWith: query.fiscalYear }
    if (query.minCost !== undefined || query.maxCost !== undefined) {
      where.estimatedCost = {
        ...(query.minCost !== undefined ? { gte: query.minCost } : {}),
        ...(query.maxCost !== undefined ? { lte: query.maxCost } : {}),
      }
    }
    if (query.term) {
      where.OR = [
        { requestCode: { contains: query.term, mode: 'insensitive' } },
        { needDescription: { contains: query.term, mode: 'insensitive' } },
        { reason: { contains: query.term, mode: 'insensitive' } },
      ]
    }
    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 20
    const skip = (page - 1) * pageSize
    const [rows, total] = await Promise.all([
      prisma.procurementRequest.findMany({ where: where as never, skip, take: pageSize }),
      prisma.procurementRequest.count({ where: where as never }),
    ])
    return { items: rows.map(r => mapPrismaRow(r) as unknown as ProcurementRequest), total, page, pageSize };
  }
}

// ─── ProcurementPlan ──────────────────────────────────────────────────────────

export class PrismaProcurementPlanRepository implements IProcurementPlanRepository {
  async create(entity: Omit<ProcurementPlan, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProcurementPlan> {
    const row = await getPrismaClient().procurementPlan.create({ data: entity as never });
    return mapPrismaRow(row) as unknown as ProcurementPlan;
  }
  async update(id: string, updates: Partial<Omit<ProcurementPlan, 'id' | 'createdAt'>>): Promise<ProcurementPlan> {
    const row = await getPrismaClient().procurementPlan.update({ where: { id }, data: updates as never });
    return mapPrismaRow(row) as unknown as ProcurementPlan;
  }
  async delete(id: string): Promise<void> { await getPrismaClient().procurementPlan.delete({ where: { id } }); }
  async findById(id: string): Promise<ProcurementPlan | null> {
    const row = await getPrismaClient().procurementPlan.findUnique({ where: { id } });
    return row ? (mapPrismaRow(row) as unknown as ProcurementPlan) : null;
  }
  async findAll(): Promise<readonly ProcurementPlan[]> {
    const rows = await getPrismaClient().procurementPlan.findMany();
    return rows.map(r => mapPrismaRow(r) as unknown as ProcurementPlan);
  }
  async count(): Promise<number> { return getPrismaClient().procurementPlan.count(); }

  async findByNumber(number: string): Promise<ProcurementPlan | null> {
    const row = await getPrismaClient().procurementPlan.findUnique({ where: { planNumber: number } });
    return row ? (mapPrismaRow(row) as unknown as ProcurementPlan) : null;
  }
  async findByFiscalYear(year: string): Promise<readonly ProcurementPlan[]> {
    const rows = await getPrismaClient().procurementPlan.findMany({ where: { fiscalYear: year } });
    return rows.map(r => mapPrismaRow(r) as unknown as ProcurementPlan);
  }
  async findByOrganization(org: string): Promise<readonly ProcurementPlan[]> {
    const rows = await getPrismaClient().procurementPlan.findMany({ where: { organization: org } });
    return rows.map(r => mapPrismaRow(r) as unknown as ProcurementPlan);
  }
  async findByStatus(status: PlanStatus): Promise<readonly ProcurementPlan[]> {
    const rows = await getPrismaClient().procurementPlan.findMany({ where: { status } });
    return rows.map(r => mapPrismaRow(r) as unknown as ProcurementPlan);
  }
}

// ─── ProcurementDemand ────────────────────────────────────────────────────────

export class PrismaProcurementDemandRepository implements IProcurementDemandRepository {
  async create(entity: Omit<ProcurementDemand, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProcurementDemand> {
    const row = await getPrismaClient().procurementDemand.create({ data: entity as never });
    return mapPrismaRow(row) as unknown as ProcurementDemand;
  }
  async update(id: string, updates: Partial<Omit<ProcurementDemand, 'id' | 'createdAt'>>): Promise<ProcurementDemand> {
    const row = await getPrismaClient().procurementDemand.update({ where: { id }, data: updates as never });
    return mapPrismaRow(row) as unknown as ProcurementDemand;
  }
  async delete(id: string): Promise<void> { await getPrismaClient().procurementDemand.delete({ where: { id } }); }
  async findById(id: string): Promise<ProcurementDemand | null> {
    const row = await getPrismaClient().procurementDemand.findUnique({ where: { id } });
    return row ? (mapPrismaRow(row) as unknown as ProcurementDemand) : null;
  }
  async findAll(): Promise<readonly ProcurementDemand[]> {
    const rows = await getPrismaClient().procurementDemand.findMany();
    return rows.map(r => mapPrismaRow(r) as unknown as ProcurementDemand);
  }
  async count(): Promise<number> { return getPrismaClient().procurementDemand.count(); }

  async findByDepartment(dept: string): Promise<readonly ProcurementDemand[]> {
    const rows = await getPrismaClient().procurementDemand.findMany({ where: { department: dept } });
    return rows.map(r => mapPrismaRow(r) as unknown as ProcurementDemand);
  }
  async findByFiscalYear(year: string): Promise<readonly ProcurementDemand[]> {
    const rows = await getPrismaClient().procurementDemand.findMany({ where: { fiscalYear: year } });
    return rows.map(r => mapPrismaRow(r) as unknown as ProcurementDemand);
  }
  async findByStatus(status: DemandStatus): Promise<readonly ProcurementDemand[]> {
    const rows = await getPrismaClient().procurementDemand.findMany({ where: { status } });
    return rows.map(r => mapPrismaRow(r) as unknown as ProcurementDemand);
  }
}

// ─── FundingAllocation ────────────────────────────────────────────────────────

export class PrismaFundingAllocationRepository implements IFundingAllocationRepository {
  async create(entity: Omit<FundingAllocation, 'id' | 'createdAt' | 'updatedAt'>): Promise<FundingAllocation> {
    const row = await getPrismaClient().fundingAllocation.create({ data: entity as never });
    return mapPrismaRow(row) as unknown as FundingAllocation;
  }
  async update(id: string, updates: Partial<Omit<FundingAllocation, 'id' | 'createdAt'>>): Promise<FundingAllocation> {
    const row = await getPrismaClient().fundingAllocation.update({ where: { id }, data: updates as never });
    return mapPrismaRow(row) as unknown as FundingAllocation;
  }
  async delete(id: string): Promise<void> { await getPrismaClient().fundingAllocation.delete({ where: { id } }); }
  async findById(id: string): Promise<FundingAllocation | null> {
    const row = await getPrismaClient().fundingAllocation.findUnique({ where: { id } });
    return row ? (mapPrismaRow(row) as unknown as FundingAllocation) : null;
  }
  async findAll(): Promise<readonly FundingAllocation[]> {
    const rows = await getPrismaClient().fundingAllocation.findMany();
    return rows.map(r => mapPrismaRow(r) as unknown as FundingAllocation);
  }
  async count(): Promise<number> { return getPrismaClient().fundingAllocation.count(); }

  async findByPlanId(planId: string): Promise<readonly FundingAllocation[]> {
    const rows = await getPrismaClient().fundingAllocation.findMany({ where: { planId } });
    return rows.map(r => mapPrismaRow(r) as unknown as FundingAllocation);
  }
  async sumByPlanId(planId: string): Promise<number> {
    const result = await getPrismaClient().fundingAllocation.aggregate({
      where: { planId }, _sum: { allocatedAmount: true },
    });
    return result._sum.allocatedAmount ? result._sum.allocatedAmount.toNumber() : 0;
  }
}

// ─── PackageProposal ──────────────────────────────────────────────────────────

export class PrismaPackageProposalRepository implements IPackageProposalRepository {
  async create(entity: Omit<PackageProposal, 'id' | 'createdAt' | 'updatedAt'>): Promise<PackageProposal> {
    const row = await getPrismaClient().packageProposal.create({ data: entity as never });
    return mapPrismaRow(row) as unknown as PackageProposal;
  }
  async update(id: string, updates: Partial<Omit<PackageProposal, 'id' | 'createdAt'>>): Promise<PackageProposal> {
    const row = await getPrismaClient().packageProposal.update({ where: { id }, data: updates as never });
    return mapPrismaRow(row) as unknown as PackageProposal;
  }
  async delete(id: string): Promise<void> { await getPrismaClient().packageProposal.delete({ where: { id } }); }
  async findById(id: string): Promise<PackageProposal | null> {
    const row = await getPrismaClient().packageProposal.findUnique({ where: { id } });
    return row ? (mapPrismaRow(row) as unknown as PackageProposal) : null;
  }
  async findAll(): Promise<readonly PackageProposal[]> {
    const rows = await getPrismaClient().packageProposal.findMany();
    return rows.map(r => mapPrismaRow(r) as unknown as PackageProposal);
  }
  async count(): Promise<number> { return getPrismaClient().packageProposal.count(); }

  async findByCode(code: string): Promise<PackageProposal | null> {
    const row = await getPrismaClient().packageProposal.findUnique({ where: { proposalCode: code } });
    return row ? (mapPrismaRow(row) as unknown as PackageProposal) : null;
  }
  async findByPlanId(planId: string): Promise<readonly PackageProposal[]> {
    const rows = await getPrismaClient().packageProposal.findMany({ where: { planId } });
    return rows.map(r => mapPrismaRow(r) as unknown as PackageProposal);
  }
  async findByStatus(status: ProposalStatus): Promise<readonly PackageProposal[]> {
    const rows = await getPrismaClient().packageProposal.findMany({ where: { status } });
    return rows.map(r => mapPrismaRow(r) as unknown as PackageProposal);
  }
}

// ─── AnnualProcurementPlan ────────────────────────────────────────────────────

export class PrismaAnnualProcurementPlanRepository implements IAnnualProcurementPlanRepository {
  async create(entity: Omit<AnnualProcurementPlan, 'id' | 'createdAt' | 'updatedAt'>): Promise<AnnualProcurementPlan> {
    const row = await getPrismaClient().annualProcurementPlan.create({ data: entity as never });
    return mapPrismaRow(row) as unknown as AnnualProcurementPlan;
  }
  async update(id: string, updates: Partial<Omit<AnnualProcurementPlan, 'id' | 'createdAt'>>): Promise<AnnualProcurementPlan> {
    const row = await getPrismaClient().annualProcurementPlan.update({ where: { id }, data: updates as never });
    return mapPrismaRow(row) as unknown as AnnualProcurementPlan;
  }
  async delete(id: string): Promise<void> { await getPrismaClient().annualProcurementPlan.delete({ where: { id } }); }
  async findById(id: string): Promise<AnnualProcurementPlan | null> {
    const row = await getPrismaClient().annualProcurementPlan.findUnique({ where: { id } });
    return row ? (mapPrismaRow(row) as unknown as AnnualProcurementPlan) : null;
  }
  async findAll(): Promise<readonly AnnualProcurementPlan[]> {
    const rows = await getPrismaClient().annualProcurementPlan.findMany();
    return rows.map(r => mapPrismaRow(r) as unknown as AnnualProcurementPlan);
  }
  async count(): Promise<number> { return getPrismaClient().annualProcurementPlan.count(); }

  async findByCode(code: string): Promise<AnnualProcurementPlan | null> {
    const row = await getPrismaClient().annualProcurementPlan.findUnique({ where: { annualPlanCode: code } });
    return row ? (mapPrismaRow(row) as unknown as AnnualProcurementPlan) : null;
  }
  async findByFiscalYear(year: string): Promise<readonly AnnualProcurementPlan[]> {
    const rows = await getPrismaClient().annualProcurementPlan.findMany({ where: { fiscalYear: year } });
    return rows.map(r => mapPrismaRow(r) as unknown as AnnualProcurementPlan);
  }
  async findByOrganization(org: string): Promise<readonly AnnualProcurementPlan[]> {
    const rows = await getPrismaClient().annualProcurementPlan.findMany({ where: { organization: org } });
    return rows.map(r => mapPrismaRow(r) as unknown as AnnualProcurementPlan);
  }
}

// ─── Factory ───────────────────────────────────────────────────────────────────

export function buildPrismaPlanningRepositories(): PlanningRepositories {
  return {
    requests: new PrismaProcurementRequestRepository(),
    plans: new PrismaProcurementPlanRepository(),
    demands: new PrismaProcurementDemandRepository(),
    allocations: new PrismaFundingAllocationRepository(),
    proposals: new PrismaPackageProposalRepository(),
    annualPlans: new PrismaAnnualProcurementPlanRepository(),
  };
}
