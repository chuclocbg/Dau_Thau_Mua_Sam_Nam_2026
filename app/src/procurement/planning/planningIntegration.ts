/**
 * Integration bridge — Planning ↔ WorkflowEngine / MasterData / RuleEngine / Package.
 * One-way dependency: only this file imports from frozen modules.
 */

import type { ProcurementPlan, ProcurementRequest, PackageProposal, PlanningValidationResult } from './planningTypes';
import type { PlanningRepositories } from './planningRepository';
import type { MasterDataRepositories } from '../../masterdata/masterdataRepository';
import type { ProcurementDecision, ProcurementCase } from '../domain/procurementTypes';
import { ProcurementEngine } from '../application/procurementEngine';
import { buildWorkflowParamsFromMasterData } from '../../masterdata/masterdataIntegration';
import { createWorkflow } from '../workflow/workflowEngine';
import type { WorkflowInstance } from '../workflow/workflowEngine';

// ─── Validate plan against master data ───────────────────────────────────────

export async function validatePlanAgainstMasterData(
  plan: ProcurementPlan,
  requests: readonly ProcurementRequest[],
  masterRepos: Pick<MasterDataRepositories, 'departments' | 'fundSources'>,
): Promise<PlanningValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  const dept = await masterRepos.departments.findByCode(plan.responsibleDepartment);
  if (!dept || !dept.isActive || dept.isArchived) {
    errors.push(`Department not found or inactive: ${plan.responsibleDepartment}`);
  }

  const fundSources = [...new Set(requests.map(r => r.fundingSource))];
  for (const fs of fundSources) {
    const found = await masterRepos.fundSources.findByCode(fs);
    if (!found || !found.isActive || found.isArchived) {
      errors.push(`Fund source not found or inactive: ${fs}`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ─── Evaluate plan requests with Rule Engine ──────────────────────────────────

export interface RequestDecision {
  readonly requestCode: string;
  readonly decision: ProcurementDecision;
}

const DEFAULT_ENGINE = new ProcurementEngine();

export function evaluatePlanWithRuleEngine(
  requests: readonly ProcurementRequest[],
  engine: ProcurementEngine = DEFAULT_ENGINE,
): RequestDecision[] {
  return requests.map(req => {
    const procCase: ProcurementCase = {
      id:              req.id,
      packageType:     'GOODS' as Parameters<typeof engine.evaluate>[0]['packageType'],
      estimatedValue:  req.estimatedCost,
      fundSource:      req.fundingSource as Parameters<typeof engine.evaluate>[0]['fundSource'],
      isUrgent:        req.isUrgent,
      isNationalSec:   false,
      isInternational: false,
      asOfDate:        req.expectedTimeline.slice(0, 10),
    };
    return { requestCode: req.requestCode, decision: engine.evaluate(procCase) };
  });
}

// ─── Build workflow for plan ──────────────────────────────────────────────────

export interface PlanWithWorkflow {
  readonly plan: ProcurementPlan;
  readonly workflow: WorkflowInstance;
}

export async function buildPlanWorkflow(
  plan: ProcurementPlan,
  masterRepos: Pick<MasterDataRepositories, 'packageTypes' | 'procurementMethods' | 'approvalAuthorities'>,
): Promise<PlanWithWorkflow> {
  const workflowParams = await buildWorkflowParamsFromMasterData(
    {
      packageId:             plan.id,
      packageTypeCode:       'GOODS',
      estimatedValue:        plan.estimatedTotal,
      procurementMethodCode: 'OPEN_TENDER',
      approvalAuthorityCode: 'UNIT_HEAD',  // ponytail: default; resolve from plan in future
      performedBy:           plan.responsibleDepartment,
    },
    masterRepos,
  );
  const workflow = createWorkflow(workflowParams);
  return { plan, workflow };
}

// ─── Generate package proposals from requests ─────────────────────────────────

export async function generatePackageProposalFromRequests(
  requests: readonly ProcurementRequest[],
  planId: string,
  repos: PlanningRepositories,
  engine: ProcurementEngine = DEFAULT_ENGINE,
): Promise<readonly PackageProposal[]> {
  // Group requests by fundingSource
  const groups = new Map<string, ProcurementRequest[]>();
  for (const req of requests) {
    const group = groups.get(req.fundingSource) ?? [];
    group.push(req);
    groups.set(req.fundingSource, group);
  }

  const proposals: PackageProposal[] = [];
  let seq = 1;
  for (const [fundSource, groupReqs] of groups) {
    const totalValue = groupReqs.reduce((sum, r) => sum + r.estimatedCost, 0);
    const firstReq = groupReqs[0]!;
    const procCase: ProcurementCase = {
      id:              planId,
      packageType:     'GOODS' as Parameters<typeof engine.evaluate>[0]['packageType'],
      estimatedValue:  totalValue,
      fundSource:      fundSource as Parameters<typeof engine.evaluate>[0]['fundSource'],
      isUrgent:        groupReqs.some(r => r.isUrgent),
      isNationalSec:   false,
      isInternational: false,
      asOfDate:        firstReq.expectedTimeline.slice(0, 10),
    };
    const decision = engine.evaluate(procCase);
    const proposalCode = `PROP-${planId.slice(0, 6).toUpperCase()}-${String(seq).padStart(2, '0')}`;
    const proposal = await repos.proposals.create({
      proposalCode,
      planId,
      requestIds:          groupReqs.map(r => r.id),
      proposedPackageType: 'GOODS',
      proposedMethod:      decision.method.method,
      estimatedValue:      totalValue,
      fundSource,
      justification:       `Consolidated from ${groupReqs.length} request(s): ${groupReqs.map(r => r.requestCode).join(', ')}`,
      status:              'DRAFT',
    });
    proposals.push(proposal);
    seq++;
  }
  return proposals;
}

// ─── Plan summary ─────────────────────────────────────────────────────────────

export interface PlanSummary {
  readonly planNumber:            string;
  readonly fiscalYear:            string;
  readonly estimatedTotal:        number;
  readonly requestCount:          number;
  readonly status:                string;
  readonly generatedPackageCount: number;
}

export function buildPlanSummary(
  plan: ProcurementPlan,
  requests: readonly ProcurementRequest[],
): PlanSummary {
  return {
    planNumber:            plan.planNumber,
    fiscalYear:            plan.fiscalYear,
    estimatedTotal:        plan.estimatedTotal,
    requestCount:          requests.length,
    status:                plan.status,
    generatedPackageCount: plan.generatedPackageIds.length,
  };
}
