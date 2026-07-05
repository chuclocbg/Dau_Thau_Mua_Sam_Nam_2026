/**
 * One-way integration bridge: Contract → frozen modules.
 * No frozen module imports from this file.
 */

import type { ContractRepositories } from './contractRepositories';
import type { ContractSummary, CreateContractParams } from './contractTypes';
import type { ProcurementPackage } from '../procurement/package/packageTypes';
import type { WorkflowInstance } from '../procurement/workflow/workflowEngine';
import type { WorkflowStateId } from '../procurement/workflow/workflowContext';
import { advance } from '../procurement/workflow/workflowEngine';
import { calculateCompletionPercent } from './contractMilestone';

// ─── Build contract params from a package ─────────────────────────────────────

export function buildContractFromPackage(
  pkg:          ProcurementPackage,
  winnerCode:   string,
  winnerName:   string,
  year:         number,
  sequence:     number,
): CreateContractParams {
  return {
    contractNumber: `HĐ/DTMS/${year}/${String(sequence).padStart(4, '0')}`,
    contractType:   'LUMP_SUM',  // default; override after calling
    packageId:      pkg.id,
    winnerCode,
    winnerName,
    contractValue:  pkg.estimatedValue,
    currency:       'VND',
    workflowId:     pkg.workflowId,
  };
}

// ─── Advance workflow on contract signed ──────────────────────────────────────

export function advanceWorkflowOnContractSigned(
  instance:    WorkflowInstance,
  performedBy: string,
  notes?:      string,
): ReturnType<typeof advance> {
  return advance(instance, 'CONTRACT_SIGNED' as WorkflowStateId, performedBy, notes);
}

// ─── Advance workflow to IMPLEMENTATION ──────────────────────────────────────

export function advanceWorkflowToImplementation(
  instance:    WorkflowInstance,
  performedBy: string,
  notes?:      string,
): ReturnType<typeof advance> {
  return advance(instance, 'IMPLEMENTATION' as WorkflowStateId, performedBy, notes);
}

// ─── Build contract summary ───────────────────────────────────────────────────

export async function buildContractSummary(
  contractId: string,
  repos:      ContractRepositories,
): Promise<ContractSummary | null> {
  const contract = await repos.contracts.findById(contractId);
  if (!contract) return null;

  const [milestones, guarantees, amendments, attachmentCount, completionPercent] = await Promise.all([
    repos.milestones.findByContractId(contractId),
    repos.guarantees.findByContractId(contractId),
    repos.amendments.findByContractId(contractId),
    repos.attachments.countByContractId(contractId),
    calculateCompletionPercent(contractId, repos),
  ]);

  return {
    contractNumber:        contract.contractNumber,
    contractType:          contract.contractType,
    status:                contract.status,
    winnerCode:            contract.winnerCode,
    winnerName:            contract.winnerName,
    contractValue:         contract.contractValue,
    milestoneCount:        milestones.length,
    reachedMilestoneCount: milestones.filter(m => m.status === 'REACHED').length,
    guaranteeCount:        guarantees.length,
    activeGuaranteeCount:  guarantees.filter(g => g.status === 'ACTIVE').length,
    amendmentCount:        amendments.length,
    attachmentCount,
    completionPercent,
  };
}

// ─── Validate package exists for contract ─────────────────────────────────────
// ponytail: thin wrapper — avoids importing ProcurementPackage repo type in contractService

export async function validatePackageForContract(
  packageId:   string,
  packageRepo: { findById(id: string): Promise<ProcurementPackage | null> },
): Promise<ProcurementPackage> {
  const pkg = await packageRepo.findById(packageId);
  if (!pkg) throw new Error(`ProcurementPackage not found: ${packageId}`);
  return pkg;
}
