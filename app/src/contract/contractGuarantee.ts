import type { ContractRepositories } from './contractRepositories';
import type { ContractGuarantee, AddGuaranteeParams } from './contractTypes';
import { ContractError } from './contractTypes';
import { validateGuaranteeParams } from './contractValidation';
import { recordContractEvent } from './contractHistory';

export async function addGuarantee(
  contractId: string,
  params:     AddGuaranteeParams,
  addedBy:    string,
  repos:      ContractRepositories,
): Promise<ContractGuarantee> {
  const result = validateGuaranteeParams(params);
  if (!result.valid) throw new ContractError('INVALID_GUARANTEE', 'guarantee', result.errors.join('; '));

  const contract = await repos.contracts.findById(contractId);
  if (!contract) throw new ContractError('NOT_FOUND', 'contractId', `Contract not found: ${contractId}`);

  const guarantee = await repos.guarantees.create({
    contractId,
    guaranteeType:   params.guaranteeType,
    amount:          params.amount,
    percent:         params.percent,
    issuerCode:      params.issuerCode,
    issuerName:      params.issuerName,
    guaranteeNumber: params.guaranteeNumber,
    issuedDate:      params.issuedDate,
    expiryDate:      params.expiryDate,
    status:          'ACTIVE',
    notes:           params.notes,
  } as Omit<ContractGuarantee, 'id' | 'createdAt' | 'updatedAt'>);

  await recordContractEvent(contractId, 'GUARANTEE_ADDED', addedBy, repos.history, {
    notes: `${params.guaranteeType} guarantee added: ${params.guaranteeNumber}`,
  });
  return guarantee;
}

export async function returnGuarantee(
  guaranteeId: string,
  returnedBy:  string,
  returnedDate: string,
  repos:        ContractRepositories,
): Promise<ContractGuarantee> {
  const guarantee = await repos.guarantees.findById(guaranteeId);
  if (!guarantee) throw new ContractError('NOT_FOUND', 'guaranteeId', `Guarantee not found: ${guaranteeId}`);
  if (guarantee.status !== 'ACTIVE') {
    throw new ContractError('INVALID_STATUS', 'status', `Cannot return guarantee with status: ${guarantee.status}`);
  }

  const updated = await repos.guarantees.update(guaranteeId, { status: 'RETURNED', returnedDate });
  await recordContractEvent(guarantee.contractId, 'GUARANTEE_RETURNED', returnedBy, repos.history, {
    notes: `Guarantee returned: ${guarantee.guaranteeNumber}`,
  });
  return updated;
}

export async function forfeitGuarantee(
  guaranteeId: string,
  forfeitedBy: string,
  reason:      string,
  repos:       ContractRepositories,
): Promise<ContractGuarantee> {
  const guarantee = await repos.guarantees.findById(guaranteeId);
  if (!guarantee) throw new ContractError('NOT_FOUND', 'guaranteeId', `Guarantee not found: ${guaranteeId}`);
  if (guarantee.status !== 'ACTIVE') {
    throw new ContractError('INVALID_STATUS', 'status', `Cannot forfeit guarantee with status: ${guarantee.status}`);
  }

  const updated = await repos.guarantees.update(guaranteeId, { status: 'FORFEITED' });
  await recordContractEvent(guarantee.contractId, 'GUARANTEE_FORFEITED', forfeitedBy, repos.history, {
    notes: `Guarantee forfeited: ${guarantee.guaranteeNumber}. Reason: ${reason}`,
  });
  return updated;
}

export async function getActiveGuarantees(
  contractId: string,
  repos:      ContractRepositories,
): Promise<readonly ContractGuarantee[]> {
  return repos.guarantees.findActiveByContractId(contractId);
}

export async function getAllGuarantees(
  contractId: string,
  repos:      ContractRepositories,
): Promise<readonly ContractGuarantee[]> {
  return repos.guarantees.findByContractId(contractId);
}
