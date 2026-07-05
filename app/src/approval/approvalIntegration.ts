/**
 * One-way integration bridge: Approval → frozen modules.
 * No frozen module imports from this file.
 */

import type { ApprovalRepositories } from './approvalRepositories';
import type { ApprovalSummary, CreateApprovalRequestParams } from './approvalTypes';
import type { IMasterDataRepository, MasterDataRepositories } from '../masterdata/masterdataRepository';
import type { ApprovalAuthority } from '../masterdata/masterdataTypes';
import type { ProcurementPackage } from '../procurement/package/packageTypes';
import type { ProcurementPlan } from '../procurement/planning/planningTypes';
import type { WorkflowInstance } from '../procurement/workflow/workflowEngine';
import type { WorkflowStateId } from '../procurement/workflow/workflowContext';
import { validateApprovalAuthorityFromMasterData } from '../masterdata/masterdataIntegration';
import { advance } from '../procurement/workflow/workflowEngine';
import { resolveAuthorityForValue } from './approvalAuthority';

// ─── Validate authority against masterdata ────────────────────────────────────

export async function validateApprovalAgainstMasterData(
  ctx:  { estimatedValue: number; approvalAuthority: string },
  repo: IMasterDataRepository<ApprovalAuthority>,
): Promise<boolean> {
  return validateApprovalAuthorityFromMasterData(ctx, repo);
}

// ─── Resolve authority from masterdata ────────────────────────────────────────

export async function resolveAuthorityFromMasterData(
  estimatedValue: number,
  repo:           IMasterDataRepository<ApprovalAuthority>,
): Promise<ApprovalAuthority | null> {
  return resolveAuthorityForValue(estimatedValue, repo);
}

// ─── Build approval params from a package ─────────────────────────────────────

export function buildApprovalFromPackage(
  pkg:         ProcurementPackage,
  requestedBy: string,
  year:        number,
  sequence:    number,
): CreateApprovalRequestParams {
  return {
    requestCode:    `APR/GK/${year}/${String(sequence).padStart(4, '0')}`,
    approvalType:   'PACKAGE_APPROVAL',
    subjectId:      pkg.id,
    subjectType:    'PACKAGE',
    requestedBy,
    department:     pkg.department,
    estimatedValue: pkg.estimatedValue,
  };
}

// ─── Build approval params from a plan ────────────────────────────────────────

export function buildApprovalFromPlan(
  plan:        ProcurementPlan,
  requestedBy: string,
  year:        number,
  sequence:    number,
): CreateApprovalRequestParams {
  return {
    requestCode:    `APR/KH/${year}/${String(sequence).padStart(4, '0')}`,
    approvalType:   'PLAN_APPROVAL',
    subjectId:      plan.id,
    subjectType:    'PLAN',
    requestedBy,
    department:     plan.responsibleDepartment,
    estimatedValue: plan.estimatedTotal,
  };
}

// ─── Advance workflow on approval outcome ─────────────────────────────────────

export function advanceWorkflowOnApproval(
  instance:    WorkflowInstance,
  targetState: WorkflowStateId,
  performedBy: string,
  notes?:      string,
): ReturnType<typeof advance> {
  return advance(instance, targetState, performedBy, notes);
}

// ─── Build approval summary ────────────────────────────────────────────────────

export async function buildApprovalSummary(
  requestId: string,
  repos:     ApprovalRepositories,
): Promise<ApprovalSummary | null> {
  const request = await repos.requests.findById(requestId);
  if (!request) return null;

  const [decision, commentCount, attachmentCount] = await Promise.all([
    repos.decisions.findByRequestId(requestId),
    repos.comments.countByRequestId(requestId),
    repos.attachments.countByRequestId(requestId),
  ]);

  return {
    requestCode:       request.requestCode,
    approvalType:      request.approvalType,
    status:            request.status,
    subjectId:         request.subjectId,
    subjectType:       request.subjectType,
    assignedAuthority: request.assignedAuthorityCode,
    decisionOutcome:   decision?.outcome,
    commentCount,
    attachmentCount,
  };
}
