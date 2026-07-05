import type { ContractRepositories } from './contractRepositories';
import type { ContractAmendment, CreateAmendmentParams } from './contractTypes';
import { ContractError } from './contractTypes';
import { validateAmendmentParams, validateContractStatusTransition } from './contractValidation';
import { recordContractEvent } from './contractHistory';

export async function createAmendment(
  contractId: string,
  params:     CreateAmendmentParams,
  createdBy:  string,
  repos:      ContractRepositories,
): Promise<ContractAmendment> {
  const result = validateAmendmentParams(params);
  if (!result.valid) throw new ContractError('INVALID_AMENDMENT', 'amendment', result.errors.join('; '));

  const contract = await repos.contracts.findById(contractId);
  if (!contract) throw new ContractError('NOT_FOUND', 'contractId', `Contract not found: ${contractId}`);

  validateContractStatusTransition(contract.status, ['EFFECTIVE', 'SIGNED'], 'status');

  // Amendment number = count of existing amendments + 1
  const existing = await repos.amendments.findByContractId(contractId);
  const amendmentNumber = existing.length + 1;
  const amendmentCode   = `PLHD/${contract.contractNumber.replace('HĐ/', '')}/${String(amendmentNumber).padStart(2, '0')}`;

  const amendment = await repos.amendments.create({
    contractId,
    amendmentNumber,
    amendmentCode,
    reason:             params.reason,
    changedFields:      params.changedFields,
    valueChange:        params.valueChange,
    timeExtensionDays:  params.timeExtensionDays,
    status:             'DRAFT',
    notes:              params.notes,
  } as Omit<ContractAmendment, 'id' | 'createdAt' | 'updatedAt'>);

  await recordContractEvent(contractId, 'AMENDMENT_CREATED', createdBy, repos.history, {
    notes: `Amendment ${amendmentCode} created: ${params.reason}`,
  });
  return amendment;
}

export async function approveAmendment(
  amendmentId: string,
  approvedBy:  string,
  repos:       ContractRepositories,
): Promise<ContractAmendment> {
  const amendment = await repos.amendments.findById(amendmentId);
  if (!amendment) throw new ContractError('NOT_FOUND', 'amendmentId', `Amendment not found: ${amendmentId}`);
  if (amendment.status !== 'DRAFT') {
    throw new ContractError('INVALID_STATUS', 'status', `Cannot approve amendment with status: ${amendment.status}`);
  }

  const updated = await repos.amendments.update(amendmentId, {
    status:     'APPROVED',
    approvedBy,
    approvedAt: new Date().toISOString(),
  });

  // Apply value change to contract if applicable
  if (amendment.valueChange !== undefined && amendment.valueChange !== 0) {
    const contract = await repos.contracts.findById(amendment.contractId);
    if (contract) {
      await repos.contracts.update(amendment.contractId, {
        contractValue: contract.contractValue + amendment.valueChange,
      });
    }
  }

  await recordContractEvent(amendment.contractId, 'AMENDMENT_APPROVED', approvedBy, repos.history, {
    notes: `Amendment ${amendment.amendmentCode} approved`,
  });
  return updated;
}

export async function rejectAmendment(
  amendmentId: string,
  rejectedBy:  string,
  reason:      string,
  repos:       ContractRepositories,
): Promise<ContractAmendment> {
  const amendment = await repos.amendments.findById(amendmentId);
  if (!amendment) throw new ContractError('NOT_FOUND', 'amendmentId', `Amendment not found: ${amendmentId}`);
  if (amendment.status !== 'DRAFT') {
    throw new ContractError('INVALID_STATUS', 'status', `Cannot reject amendment with status: ${amendment.status}`);
  }

  const updated = await repos.amendments.update(amendmentId, { status: 'REJECTED' });
  await recordContractEvent(amendment.contractId, 'AMENDMENT_REJECTED', rejectedBy, repos.history, {
    notes: `Amendment ${amendment.amendmentCode} rejected: ${reason}`,
  });
  return updated;
}

export async function getAmendments(
  contractId: string,
  repos:      ContractRepositories,
): Promise<readonly ContractAmendment[]> {
  return repos.amendments.findByContractId(contractId);
}

export async function countApprovedAmendments(
  contractId: string,
  repos:      ContractRepositories,
): Promise<number> {
  const all = await repos.amendments.findByContractId(contractId);
  return all.filter(a => a.status === 'APPROVED').length;
}
