import type { PlanningRequestHistory } from './planningRequestHistory';

export const REQUEST_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'MERGED', 'CANCELLED'] as const;
export type RequestStatus = typeof REQUEST_STATUSES[number];

export const REQUEST_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type RequestPriority = typeof REQUEST_PRIORITIES[number];

export const PLAN_STATUSES = ['DRAFT', 'SUBMITTED', 'APPROVED', 'ACTIVE', 'CLOSED', 'CANCELLED'] as const;
export type PlanStatus = typeof PLAN_STATUSES[number];

export const PROPOSAL_STATUSES = ['DRAFT', 'APPROVED', 'REJECTED', 'CONVERTED'] as const;
export type ProposalStatus = typeof PROPOSAL_STATUSES[number];

export const ANNUAL_PLAN_STATUSES = ['DRAFT', 'SUBMITTED', 'APPROVED', 'ACTIVE', 'CLOSED'] as const;
export type AnnualPlanStatus = typeof ANNUAL_PLAN_STATUSES[number];

export const DEMAND_STATUSES = ['OPEN', 'CONSOLIDATED', 'SUBMITTED'] as const;
export type DemandStatus = typeof DEMAND_STATUSES[number];

export interface ProcurementNeed {
  readonly needCode: string;
  readonly description: string;
  readonly category: string;
  readonly quantity: number;
  readonly unit: string;
  readonly estimatedUnitCost: number;
  readonly estimatedTotal: number;
}

export interface ProcurementRequest {
  readonly id: string;
  readonly requestCode: string;
  readonly department: string;
  readonly requester: string;
  readonly reason: string;
  readonly needDescription: string;
  readonly needs: readonly ProcurementNeed[];
  readonly estimatedCost: number;
  readonly fundingSource: string;
  readonly isUrgent: boolean;
  readonly expectedTimeline: string;
  readonly priority: RequestPriority;
  readonly legalBasis: string;
  readonly status: RequestStatus;
  readonly planId?: string;
  readonly history?: PlanningRequestHistory;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PlanApprovalEntry {
  readonly approvedBy: string;
  readonly approvedAt: string;
  readonly action: string;
  readonly notes?: string;
}

export interface ProcurementPlan {
  readonly id: string;
  readonly planNumber: string;
  readonly fiscalYear: string;
  readonly organization: string;
  readonly responsibleDepartment: string;
  readonly estimatedTotal: number;
  readonly approvedTotal?: number;
  readonly status: PlanStatus;
  readonly approvalHistory: readonly PlanApprovalEntry[];
  readonly requestIds: readonly string[];
  readonly generatedPackageIds: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ProcurementDemand {
  readonly id: string;
  readonly demandCode: string;
  readonly fiscalYear: string;
  readonly department: string;
  readonly requestIds: readonly string[];
  readonly consolidatedCost: number;
  readonly status: DemandStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface FundingAllocation {
  readonly id: string;
  readonly planId: string;
  readonly fundSourceCode: string;
  readonly allocatedAmount: number;
  readonly committedAmount: number;
  readonly remainingAmount: number;
  readonly budgetYear: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AnnualProcurementPlan {
  readonly id: string;
  readonly annualPlanCode: string;
  readonly fiscalYear: string;
  readonly organization: string;
  readonly totalBudget: number;
  readonly approvedBudget?: number;
  readonly planIds: readonly string[];
  readonly status: AnnualPlanStatus;
  readonly submittedAt?: string;
  readonly approvedAt?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PackageProposal {
  readonly id: string;
  readonly proposalCode: string;
  readonly planId: string;
  readonly requestIds: readonly string[];
  readonly proposedPackageType: string;
  readonly proposedMethod: string;
  readonly estimatedValue: number;
  readonly fundSource: string;
  readonly justification: string;
  readonly status: ProposalStatus;
  readonly convertedPackageId?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateRequestParams {
  readonly requestCode: string;
  readonly department: string;
  readonly requester: string;
  readonly reason: string;
  readonly needDescription: string;
  readonly needs?: readonly ProcurementNeed[];
  readonly estimatedCost: number;
  readonly fundingSource: string;
  readonly isUrgent?: boolean;
  readonly expectedTimeline: string;
  readonly priority?: RequestPriority;
  readonly legalBasis?: string;
}

export interface SplitRequestPart {
  readonly requestCode: string;
  readonly needDescription: string;
  readonly estimatedCost: number;
  readonly needs?: readonly ProcurementNeed[];
}

export interface PlanningSearchQuery {
  readonly term?: string;
  readonly status?: string;
  readonly department?: string;
  readonly fiscalYear?: string;
  readonly minCost?: number;
  readonly maxCost?: number;
  readonly page?: number;
  readonly pageSize?: number;
}

export interface PlanningSearchResult<T> {
  readonly items: readonly T[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

export interface PlanningValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

export interface FundingSummary {
  readonly fundSourceCode: string;
  readonly allocatedAmount: number;
  readonly committedAmount: number;
  readonly remainingAmount: number;
}

export class PlanningError extends Error {
  constructor(readonly code: string, readonly field: string, message: string) {
    super(message); this.name = 'PlanningError';
  }
}

export function isRequestStatus(v: unknown): v is RequestStatus {
  return REQUEST_STATUSES.includes(v as RequestStatus);
}

export function isPlanStatus(v: unknown): v is PlanStatus {
  return PLAN_STATUSES.includes(v as PlanStatus);
}

export function isRequestPriority(v: unknown): v is RequestPriority {
  return REQUEST_PRIORITIES.includes(v as RequestPriority);
}

export function isProposalStatus(v: unknown): v is ProposalStatus {
  return PROPOSAL_STATUSES.includes(v as ProposalStatus);
}
