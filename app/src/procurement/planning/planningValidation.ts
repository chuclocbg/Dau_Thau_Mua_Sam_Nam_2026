import type {
  ProcurementPlan, FundingAllocation,
  CreateRequestParams, PlanningValidationResult, FundingSummary,
} from './planningTypes';
import { PlanningError } from './planningTypes';
import type { IProcurementRequestRepository } from './planningRepository';

export async function validateUniqueRequestCode(
  code: string,
  repo: IProcurementRequestRepository,
  excludeId?: string,
): Promise<boolean> {
  const existing = await repo.findByCode(code);
  if (!existing) return true;
  return existing.id === excludeId;
}

export async function assertUniqueRequestCode(
  code: string,
  repo: IProcurementRequestRepository,
  excludeId?: string,
): Promise<void> {
  const unique = await validateUniqueRequestCode(code, repo, excludeId);
  if (!unique) throw new PlanningError('DUPLICATE_CODE', 'requestCode', `Request code already exists: ${code}`);
}

export function validateRequiredRequestFields(params: CreateRequestParams): PlanningValidationResult {
  const errors: string[] = [];
  if (!params.requestCode?.trim())      errors.push('requestCode is required');
  if (!params.department?.trim())       errors.push('department is required');
  if (!params.requester?.trim())        errors.push('requester is required');
  if (!params.reason?.trim())           errors.push('reason is required');
  if (!params.needDescription?.trim())  errors.push('needDescription is required');
  if (!params.fundingSource?.trim())    errors.push('fundingSource is required');
  if (!params.expectedTimeline?.trim()) errors.push('expectedTimeline is required');
  return { valid: errors.length === 0, errors, warnings: [] };
}

export function validateEstimatedCost(cost: number): PlanningValidationResult {
  const errors: string[] = [];
  if (!Number.isFinite(cost) || cost <= 0) errors.push('estimatedCost must be greater than 0');
  return { valid: errors.length === 0, errors, warnings: [] };
}

export function validateBudgetYearConsistency(fiscalYear: string, expectedTimeline: string): boolean {
  return expectedTimeline.startsWith(fiscalYear);
}

export function validateFundingAvailability(
  requiredAmount: number,
  allocations: readonly FundingAllocation[],
): PlanningValidationResult {
  const totalRemaining = allocations.reduce((sum, a) => sum + a.remainingAmount, 0);
  const errors: string[] = [];
  const warnings: string[] = [];
  if (totalRemaining < requiredAmount) {
    errors.push(`Insufficient funding: required ${requiredAmount}, available ${totalRemaining}`);
  } else if (totalRemaining < requiredAmount * 1.1) {
    warnings.push('Funding available but less than 10% buffer above required amount');
  }
  return { valid: errors.length === 0, errors, warnings };
}

export async function validateRequestsApproved(
  requestIds: string[],
  repo: IProcurementRequestRepository,
): Promise<PlanningValidationResult> {
  const errors: string[] = [];
  for (const id of requestIds) {
    const req = await repo.findById(id);
    if (!req) {
      errors.push(`Request not found: ${id}`);
    } else if (req.status !== 'APPROVED') {
      errors.push(`Request ${req.requestCode} is not APPROVED (status: ${req.status})`);
    }
  }
  return { valid: errors.length === 0, errors, warnings: [] };
}

export function validatePlanHasRequests(plan: ProcurementPlan): PlanningValidationResult {
  const errors: string[] = [];
  if (!plan.requestIds || plan.requestIds.length === 0) {
    errors.push('Plan must have at least one request');
  }
  return { valid: errors.length === 0, errors, warnings: [] };
}

export function validateFundingBalance(
  planEstimatedTotal: number,
  allocations: readonly FundingAllocation[],
): PlanningValidationResult {
  const totalAllocated = allocations.reduce((sum, a) => sum + a.allocatedAmount, 0);
  const errors: string[] = [];
  const warnings: string[] = [];
  if (totalAllocated < planEstimatedTotal) {
    errors.push(`Funding allocations (${totalAllocated}) are less than plan estimated total (${planEstimatedTotal})`);
  }
  if (totalAllocated === 0) {
    warnings.push('No funding allocations have been made for this plan');
  }
  return { valid: errors.length === 0, errors, warnings };
}

export function validatePlanStatus(plan: ProcurementPlan, allowed: string[]): boolean {
  return allowed.includes(plan.status);
}

export function calculateFundingSummary(allocations: readonly FundingAllocation[]): FundingSummary[] {
  const map = new Map<string, FundingSummary>();
  for (const a of allocations) {
    const ex = map.get(a.fundSourceCode);
    if (ex) {
      map.set(a.fundSourceCode, {
        fundSourceCode:  a.fundSourceCode,
        allocatedAmount: ex.allocatedAmount + a.allocatedAmount,
        committedAmount: ex.committedAmount + a.committedAmount,
        remainingAmount: ex.remainingAmount + a.remainingAmount,
      });
    } else {
      map.set(a.fundSourceCode, {
        fundSourceCode:  a.fundSourceCode,
        allocatedAmount: a.allocatedAmount,
        committedAmount: a.committedAmount,
        remainingAmount: a.remainingAmount,
      });
    }
  }
  return Array.from(map.values());
}
