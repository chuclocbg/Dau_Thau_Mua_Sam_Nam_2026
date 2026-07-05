import type {
  ProcurementRequest, ProcurementPlan, ProcurementDemand,
  FundingAllocation, PackageProposal, AnnualProcurementPlan,
  RequestStatus, PlanStatus, DemandStatus, ProposalStatus,
  PlanningSearchQuery, PlanningSearchResult,
} from './planningTypes';
import type { IBaseRepository } from '../../shared/repository/IBaseRepository';
export type { IBaseRepository } from '../../shared/repository/IBaseRepository';

export interface IProcurementRequestRepository extends IBaseRepository<ProcurementRequest> {
  findByCode(code: string): Promise<ProcurementRequest | null>;
  findByStatus(status: RequestStatus): Promise<readonly ProcurementRequest[]>;
  findByDepartment(dept: string): Promise<readonly ProcurementRequest[]>;
  findByPlanId(planId: string): Promise<readonly ProcurementRequest[]>;
  search(query: PlanningSearchQuery): Promise<PlanningSearchResult<ProcurementRequest>>;
}

export interface IProcurementPlanRepository extends IBaseRepository<ProcurementPlan> {
  findByNumber(number: string): Promise<ProcurementPlan | null>;
  findByFiscalYear(year: string): Promise<readonly ProcurementPlan[]>;
  findByOrganization(org: string): Promise<readonly ProcurementPlan[]>;
  findByStatus(status: PlanStatus): Promise<readonly ProcurementPlan[]>;
}

export interface IProcurementDemandRepository extends IBaseRepository<ProcurementDemand> {
  findByDepartment(dept: string): Promise<readonly ProcurementDemand[]>;
  findByFiscalYear(year: string): Promise<readonly ProcurementDemand[]>;
  findByStatus(status: DemandStatus): Promise<readonly ProcurementDemand[]>;
}

export interface IFundingAllocationRepository extends IBaseRepository<FundingAllocation> {
  findByPlanId(planId: string): Promise<readonly FundingAllocation[]>;
  sumByPlanId(planId: string): Promise<number>;
}

export interface IPackageProposalRepository extends IBaseRepository<PackageProposal> {
  findByCode(code: string): Promise<PackageProposal | null>;
  findByPlanId(planId: string): Promise<readonly PackageProposal[]>;
  findByStatus(status: ProposalStatus): Promise<readonly PackageProposal[]>;
}

export interface IAnnualProcurementPlanRepository extends IBaseRepository<AnnualProcurementPlan> {
  findByCode(code: string): Promise<AnnualProcurementPlan | null>;
  findByFiscalYear(year: string): Promise<readonly AnnualProcurementPlan[]>;
  findByOrganization(org: string): Promise<readonly AnnualProcurementPlan[]>;
}

export interface PlanningRepositories {
  readonly requests: IProcurementRequestRepository;
  readonly plans: IProcurementPlanRepository;
  readonly demands: IProcurementDemandRepository;
  readonly allocations: IFundingAllocationRepository;
  readonly proposals: IPackageProposalRepository;
  readonly annualPlans: IAnnualProcurementPlanRepository;
}
