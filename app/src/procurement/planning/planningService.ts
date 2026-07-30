import type {
  ProcurementRequest, ProcurementPlan, FundingAllocation,
  CreateRequestParams, SplitRequestPart,
  PlanningValidationResult, FundingSummary,
} from './planningTypes';
import { PlanningError } from './planningTypes';
import type { PlanningRepositories } from './planningRepository';
import { createHistory, addHistoryEntry } from './planningRequestHistory';
import {
  assertUniqueRequestCode, validateRequiredRequestFields, validateEstimatedCost,
  validateRequestsApproved, validatePlanHasRequests, calculateFundingSummary,
} from './planningValidation';
import type { PackageRepositories } from '../package/packageRepository';
import type { ProcurementPackage } from '../package/packageTypes';
import { createPackage } from '../package/packageService';

export function generatePlanNumber(
  org: string = 'DTMS',
  year: number = new Date().getFullYear(),
  seq: number = 1,
): string {
  return `${org}/KH-DTMS/${year}/${String(seq).padStart(3, '0')}`;
}

export async function createRequest(
  params: CreateRequestParams,
  repos: PlanningRepositories,
): Promise<ProcurementRequest> {
  await assertUniqueRequestCode(params.requestCode, repos.requests);
  const fieldResult = validateRequiredRequestFields(params);
  if (!fieldResult.valid) {
    throw new PlanningError('INVALID_REQUEST', 'params', fieldResult.errors.join('; '));
  }
  const costResult = validateEstimatedCost(params.estimatedCost);
  if (!costResult.valid) {
    throw new PlanningError('INVALID_COST', 'estimatedCost', costResult.errors.join('; '));
  }
  return repos.requests.create({
    requestCode:     params.requestCode,
    department:      params.department,
    requester:       params.requester,
    reason:          params.reason,
    needDescription: params.needDescription,
    needs:           params.needs ?? [],
    estimatedCost:   params.estimatedCost,
    fundingSource:   params.fundingSource,
    isUrgent:        params.isUrgent ?? false,
    expectedTimeline: params.expectedTimeline,
    priority:        params.priority ?? 'MEDIUM',
    legalBasis:      params.legalBasis ?? '',
    status:          'PENDING',
  });
}

export async function approveRequest(
  id: string,
  repos: PlanningRepositories,
  approvedBy: string,
  notes?: string,
): Promise<ProcurementRequest> {
  const req = await repos.requests.findById(id);
  if (!req) throw new PlanningError('NOT_FOUND', 'id', `Request not found: ${id}`);
  if (req.status !== 'PENDING') {
    throw new PlanningError('INVALID_STATUS', 'status', `Cannot approve request with status: ${req.status}`);
  }
  const history = addHistoryEntry(req.history ?? createHistory(id), {
    action: 'APPROVE', performedBy: approvedBy, notes,
  });
  return repos.requests.update(id, { status: 'APPROVED', history });
}

export async function mergeRequests(
  ids: string[],
  newCode: string,
  repos: PlanningRepositories,
  performedBy: string,
): Promise<ProcurementRequest> {
  if (ids.length < 2) {
    throw new PlanningError('INVALID_MERGE', 'ids', 'At least 2 requests required to merge');
  }
  await assertUniqueRequestCode(newCode, repos.requests);
  const requests: ProcurementRequest[] = [];
  for (const id of ids) {
    const req = await repos.requests.findById(id);
    if (!req) throw new PlanningError('NOT_FOUND', 'id', `Request not found: ${id}`);
    requests.push(req);
  }
  const first = requests[0]!;
  const totalCost = requests.reduce((sum, r) => sum + r.estimatedCost, 0);
  const mergedNeeds = requests.flatMap(r => [...r.needs]);
  const priority = requests.some(r => r.priority === 'CRITICAL') ? 'CRITICAL'
    : requests.some(r => r.priority === 'HIGH') ? 'HIGH'
    : first.priority;

  const merged = await repos.requests.create({
    requestCode:      newCode,
    department:       first.department,
    requester:        performedBy,
    reason:           `Merged from: ${requests.map(r => r.requestCode).join(', ')}`,
    needDescription:  requests.map(r => r.needDescription).join('; '),
    needs:            mergedNeeds,
    estimatedCost:    totalCost,
    fundingSource:    first.fundingSource,
    isUrgent:         requests.some(r => r.isUrgent),
    expectedTimeline: first.expectedTimeline,
    priority,
    legalBasis:       first.legalBasis,
    status:           'PENDING',
  });
  for (const id of ids) {
    await repos.requests.update(id, { status: 'MERGED' });
  }
  return merged;
}

export async function splitRequest(
  id: string,
  parts: [SplitRequestPart, SplitRequestPart, ...SplitRequestPart[]],
  repos: PlanningRepositories,
  performedBy: string,
): Promise<readonly ProcurementRequest[]> {
  const original = await repos.requests.findById(id);
  if (!original) throw new PlanningError('NOT_FOUND', 'id', `Request not found: ${id}`);
  if (original.status === 'MERGED' || original.status === 'CANCELLED') {
    throw new PlanningError('INVALID_STATUS', 'status', `Cannot split request with status: ${original.status}`);
  }
  for (const part of parts) {
    await assertUniqueRequestCode(part.requestCode, repos.requests);
  }
  const created: ProcurementRequest[] = [];
  for (const part of parts) {
    const req = await repos.requests.create({
      requestCode:      part.requestCode,
      department:       original.department,
      requester:        original.requester,
      reason:           `Split from ${original.requestCode}: ${original.reason}`,
      needDescription:  part.needDescription,
      needs:            part.needs ?? [],
      estimatedCost:    part.estimatedCost,
      fundingSource:    original.fundingSource,
      isUrgent:         original.isUrgent,
      expectedTimeline: original.expectedTimeline,
      priority:         original.priority,
      legalBasis:       original.legalBasis,
      status:           'PENDING',
      history:          addHistoryEntry(createHistory(part.requestCode), {
        action: 'SPLIT', performedBy, notes: `Split from ${original.requestCode}`,
      }),
    });
    created.push(req);
  }
  const cancelHistory = addHistoryEntry(original.history ?? createHistory(id), {
    action: 'CANCEL', performedBy, notes: `Cancelled due to split into: ${parts.map(p => p.requestCode).join(', ')}`,
  });
  await repos.requests.update(id, { status: 'CANCELLED', history: cancelHistory });
  return created;
}

export async function generateProcurementPlan(
  fiscalYear: string,
  organization: string,
  requestIds: string[],
  repos: PlanningRepositories,
  responsibleDepartment?: string,
): Promise<ProcurementPlan> {
  if (requestIds.length === 0) {
    throw new PlanningError('EMPTY_REQUESTS', 'requestIds', 'At least one request is required');
  }
  const approvedResult = await validateRequestsApproved(requestIds, repos.requests);
  if (!approvedResult.valid) {
    throw new PlanningError('UNAPPROVED_REQUESTS', 'requestIds', approvedResult.errors.join('; '));
  }
  let estimatedTotal = 0;
  let firstDept = responsibleDepartment ?? '';
  for (const rid of requestIds) {
    const req = await repos.requests.findById(rid);
    if (req) {
      estimatedTotal += req.estimatedCost;
      if (!firstDept) firstDept = req.department;
    }
  }
  const existing = await repos.plans.findByFiscalYear(fiscalYear);
  const seq = existing.length + 1;
  const plan = await repos.plans.create({
    planNumber:            generatePlanNumber(organization, Number(fiscalYear), seq),
    fiscalYear,
    organization,
    responsibleDepartment: firstDept,
    estimatedTotal,
    status:                'DRAFT',
    approvalHistory:       [],
    requestIds,
    generatedPackageIds:   [],
  });
  for (const rid of requestIds) {
    await repos.requests.update(rid, { planId: plan.id });
  }
  return plan;
}

export async function createPackageFromPlan(
  planId: string,
  proposalId: string,
  packageRepos: PackageRepositories,
  planRepos: PlanningRepositories,
  performedBy: string,
): Promise<ProcurementPackage> {
  const proposal = await planRepos.proposals.findById(proposalId);
  if (!proposal) throw new PlanningError('NOT_FOUND', 'proposalId', `Proposal not found: ${proposalId}`);
  if (proposal.status !== 'APPROVED') {
    throw new PlanningError('INVALID_STATUS', 'status', `Proposal status is ${proposal.status}, expected APPROVED`);
  }
  const plan = await planRepos.plans.findById(planId);
  if (!plan) throw new PlanningError('NOT_FOUND', 'planId', `Plan not found: ${planId}`);

  const pkg = await createPackage({
    packageCode:       proposal.proposalCode,
    packageName:       proposal.justification,
    packageType:       proposal.proposedPackageType,
    procurementMethod: proposal.proposedMethod,
    estimatedValue:    proposal.estimatedValue,
    fundSource:        proposal.fundSource,
    budgetYear:        plan.fiscalYear,
    department:        plan.responsibleDepartment,
    owner:             performedBy,
  }, packageRepos);

  await planRepos.proposals.update(proposalId, { status: 'CONVERTED', convertedPackageId: pkg.id });
  await planRepos.plans.update(planId, { generatedPackageIds: [...plan.generatedPackageIds, pkg.id] });
  return pkg;
}

export async function validatePlan(
  planId: string,
  repos: PlanningRepositories,
): Promise<PlanningValidationResult> {
  const plan = await repos.plans.findById(planId);
  if (!plan) return { valid: false, errors: [`Plan not found: ${planId}`], warnings: [] };
  const hasRequests = validatePlanHasRequests(plan);
  if (!hasRequests.valid) return hasRequests;
  const approvedResult = await validateRequestsApproved([...plan.requestIds], repos.requests);
  const allocations = await repos.allocations.findByPlanId(planId);
  const warnings: string[] = [];
  if (allocations.length === 0) warnings.push('No funding allocations have been made');
  return { valid: approvedResult.valid, errors: approvedResult.errors, warnings };
}

export function calculateFunding(allocations: readonly FundingAllocation[]): FundingSummary[] {
  return calculateFundingSummary(allocations);
}
