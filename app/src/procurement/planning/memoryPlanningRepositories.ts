import type {
  ProcurementRequest, ProcurementPlan, ProcurementDemand,
  FundingAllocation, PackageProposal, AnnualProcurementPlan,
  RequestStatus, PlanStatus, DemandStatus, ProposalStatus,
  PlanningSearchQuery, PlanningSearchResult,
} from './planningTypes';
import type {
  IBaseRepository, IProcurementRequestRepository, IProcurementPlanRepository,
  IProcurementDemandRepository, IFundingAllocationRepository,
  IPackageProposalRepository, IAnnualProcurementPlanRepository,
  PlanningRepositories,
} from './planningRepository';

export class MemoryPlanningBaseRepository<T extends { id: string; createdAt: string; updatedAt: string }>
  implements IBaseRepository<T>
{
  protected readonly store = new Map<string, T>();

  async create(entity: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T> {
    const now = new Date().toISOString();
    const item = { ...entity, id: crypto.randomUUID(), createdAt: now, updatedAt: now } as unknown as T;
    this.store.set(item.id, item);
    return item;
  }

  async update(id: string, updates: Partial<Omit<T, 'id' | 'createdAt'>>): Promise<T> {
    const existing = this.store.get(id);
    if (!existing) throw new Error(`Planning entity not found: ${id}`);
    const updated = { ...existing, ...updates, id, updatedAt: new Date().toISOString() } as T;
    this.store.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> { this.store.delete(id); }
  async findById(id: string): Promise<T | null> { return this.store.get(id) ?? null; }
  async findAll(): Promise<readonly T[]> { return Array.from(this.store.values()); }
  async count(): Promise<number> { return this.store.size; }
  clear(): void { this.store.clear(); }
}

export class MemoryProcurementRequestRepository
  extends MemoryPlanningBaseRepository<ProcurementRequest>
  implements IProcurementRequestRepository
{
  async findByCode(code: string): Promise<ProcurementRequest | null> {
    return Array.from(this.store.values()).find(r => r.requestCode === code) ?? null;
  }
  async findByStatus(status: RequestStatus): Promise<readonly ProcurementRequest[]> {
    return Array.from(this.store.values()).filter(r => r.status === status);
  }
  async findByDepartment(dept: string): Promise<readonly ProcurementRequest[]> {
    return Array.from(this.store.values()).filter(r => r.department === dept);
  }
  async findByPlanId(planId: string): Promise<readonly ProcurementRequest[]> {
    return Array.from(this.store.values()).filter(r => r.planId === planId);
  }
  async search(query: PlanningSearchQuery): Promise<PlanningSearchResult<ProcurementRequest>> {
    let items = Array.from(this.store.values());
    if (query.term) {
      const t = query.term.toLowerCase();
      items = items.filter(r =>
        r.requestCode.toLowerCase().includes(t) ||
        r.needDescription.toLowerCase().includes(t) ||
        r.reason.toLowerCase().includes(t)
      );
    }
    if (query.status) items = items.filter(r => r.status === query.status);
    if (query.department) items = items.filter(r => r.department === query.department);
    if (query.fiscalYear) items = items.filter(r => r.expectedTimeline.startsWith(query.fiscalYear!));
    if (query.minCost !== undefined) items = items.filter(r => r.estimatedCost >= query.minCost!);
    if (query.maxCost !== undefined) items = items.filter(r => r.estimatedCost <= query.maxCost!);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const total = items.length;
    const paged = items.slice((page - 1) * pageSize, page * pageSize);
    return { items: paged, total, page, pageSize };
  }
}

export class MemoryProcurementPlanRepository
  extends MemoryPlanningBaseRepository<ProcurementPlan>
  implements IProcurementPlanRepository
{
  async findByNumber(number: string): Promise<ProcurementPlan | null> {
    return Array.from(this.store.values()).find(p => p.planNumber === number) ?? null;
  }
  async findByFiscalYear(year: string): Promise<readonly ProcurementPlan[]> {
    return Array.from(this.store.values()).filter(p => p.fiscalYear === year);
  }
  async findByOrganization(org: string): Promise<readonly ProcurementPlan[]> {
    return Array.from(this.store.values()).filter(p => p.organization === org);
  }
  async findByStatus(status: PlanStatus): Promise<readonly ProcurementPlan[]> {
    return Array.from(this.store.values()).filter(p => p.status === status);
  }
}

export class MemoryProcurementDemandRepository
  extends MemoryPlanningBaseRepository<ProcurementDemand>
  implements IProcurementDemandRepository
{
  async findByDepartment(dept: string): Promise<readonly ProcurementDemand[]> {
    return Array.from(this.store.values()).filter(d => d.department === dept);
  }
  async findByFiscalYear(year: string): Promise<readonly ProcurementDemand[]> {
    return Array.from(this.store.values()).filter(d => d.fiscalYear === year);
  }
  async findByStatus(status: DemandStatus): Promise<readonly ProcurementDemand[]> {
    return Array.from(this.store.values()).filter(d => d.status === status);
  }
}

export class MemoryFundingAllocationRepository
  extends MemoryPlanningBaseRepository<FundingAllocation>
  implements IFundingAllocationRepository
{
  async findByPlanId(planId: string): Promise<readonly FundingAllocation[]> {
    return Array.from(this.store.values()).filter(a => a.planId === planId);
  }
  async sumByPlanId(planId: string): Promise<number> {
    return Array.from(this.store.values())
      .filter(a => a.planId === planId)
      .reduce((sum, a) => sum + a.allocatedAmount, 0);
  }
}

export class MemoryPackageProposalRepository
  extends MemoryPlanningBaseRepository<PackageProposal>
  implements IPackageProposalRepository
{
  async findByCode(code: string): Promise<PackageProposal | null> {
    return Array.from(this.store.values()).find(p => p.proposalCode === code) ?? null;
  }
  async findByPlanId(planId: string): Promise<readonly PackageProposal[]> {
    return Array.from(this.store.values()).filter(p => p.planId === planId);
  }
  async findByStatus(status: ProposalStatus): Promise<readonly PackageProposal[]> {
    return Array.from(this.store.values()).filter(p => p.status === status);
  }
}

export class MemoryAnnualProcurementPlanRepository
  extends MemoryPlanningBaseRepository<AnnualProcurementPlan>
  implements IAnnualProcurementPlanRepository
{
  async findByCode(code: string): Promise<AnnualProcurementPlan | null> {
    return Array.from(this.store.values()).find(a => a.annualPlanCode === code) ?? null;
  }
  async findByFiscalYear(year: string): Promise<readonly AnnualProcurementPlan[]> {
    return Array.from(this.store.values()).filter(a => a.fiscalYear === year);
  }
  async findByOrganization(org: string): Promise<readonly AnnualProcurementPlan[]> {
    return Array.from(this.store.values()).filter(a => a.organization === org);
  }
}

export function createMemoryPlanningRepositories(): PlanningRepositories {
  return {
    requests:    new MemoryProcurementRequestRepository(),
    plans:       new MemoryProcurementPlanRepository(),
    demands:     new MemoryProcurementDemandRepository(),
    allocations: new MemoryFundingAllocationRepository(),
    proposals:   new MemoryPackageProposalRepository(),
    annualPlans: new MemoryAnnualProcurementPlanRepository(),
  };
}
