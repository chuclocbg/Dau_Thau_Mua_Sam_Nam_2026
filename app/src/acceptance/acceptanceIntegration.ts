/**
 * One-way integration bridge: Acceptance → frozen modules.
 * No frozen module may import from this file.
 */

import type { AcceptanceRepositories } from './acceptanceRepositories';
import type { AcceptanceSummary, CreateAcceptanceParams } from './acceptanceTypes';
import type { Contract } from '../contract/contractTypes';
import type { WorkflowInstance } from '../procurement/workflow/workflowEngine';
import type { WorkflowStateId } from '../procurement/workflow/workflowContext';
import { advance } from '../procurement/workflow/workflowEngine';
import { calculateAcceptanceRate } from './acceptanceItem';

// ─── Build acceptance params from a contract ──────────────────────────────────

export function buildAcceptanceFromContract(
  contract:       Contract,
  requestCode:    string,
  requestedBy:    string,
  department:     string,
  extraLegalBasis: string[] = [],
): CreateAcceptanceParams {
  return {
    requestCode,
    acceptanceType: 'FINAL',      // default; caller may override
    contractId:     contract.id,
    packageId:      contract.packageId,
    workflowId:     contract.workflowId,
    requestedBy,
    department,
    description:    `Nghiệm thu hợp đồng ${contract.contractNumber}`,
    // The 5 seed laws are merged in createAcceptanceRequest; extra ones go here
    legalBasis:     extraLegalBasis,
  };
}

// ─── Advance workflow on acceptance completed ─────────────────────────────────

export function advanceWorkflowOnAcceptanceComplete(
  instance:    WorkflowInstance,
  performedBy: string,
  notes?:      string,
): ReturnType<typeof advance> {
  return advance(instance, 'IMPLEMENTATION' as WorkflowStateId, performedBy, notes);
}

// ─── Build acceptance summary ─────────────────────────────────────────────────

export async function buildAcceptanceSummary(
  requestId: string,
  repos:     AcceptanceRepositories,
): Promise<AcceptanceSummary | null> {
  const request = await repos.requests.findById(requestId);
  if (!request) return null;

  const [sessions, members, attachmentCount, acceptedCount, rejectedCount, acceptanceRate] = await Promise.all([
    repos.sessions.findByRequestId(requestId),
    repos.members.findByRequestId(requestId),
    repos.attachments.countByRequestId(requestId),
    repos.items.countAcceptedByRequestId(requestId),
    repos.items.countRejectedByRequestId(requestId),
    calculateAcceptanceRate(requestId, repos),
  ]);

  const items = await repos.items.findByRequestId(requestId);

  return {
    requestCode:           request.requestCode,
    acceptanceType:        request.acceptanceType,
    status:                request.status,
    contractId:            request.contractId,
    department:            request.department,
    sessionCount:          sessions.length,
    completedSessionCount: sessions.filter(s => s.status === 'COMPLETED').length,
    itemCount:             items.length,
    acceptedItemCount:     acceptedCount,
    rejectedItemCount:     rejectedCount,
    memberCount:           members.length,
    attachmentCount,
    legalBasisCount:       request.legalBasis.length,
    acceptanceRate,
  };
}

// ─── Validate contract is eligible for acceptance ─────────────────────────────

export async function validateContractForAcceptance(
  contractId: string,
  contractRepo: { findById(id: string): Promise<Contract | null> },
): Promise<Contract> {
  const contract = await contractRepo.findById(contractId);
  if (!contract) throw new Error(`Contract not found: ${contractId}`);
  if (contract.status !== 'EFFECTIVE' && contract.status !== 'COMPLETED') {
    throw new Error(`Contract must be EFFECTIVE or COMPLETED for acceptance. Current: ${contract.status}`);
  }
  return contract;
}
