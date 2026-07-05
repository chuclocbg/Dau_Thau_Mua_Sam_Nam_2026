import type { ContractRepositories } from './contractRepositories';
import type { Contract, CreateContractParams } from './contractTypes';
import { ContractError } from './contractTypes';
import {
  assertUniqueContractNumber, validateRequiredContractFields,
  validateContractValue, validateContractStatusTransition,
} from './contractValidation';
import { recordContractEvent } from './contractHistory';

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createContract(
  params: CreateContractParams,
  repos:  ContractRepositories,
): Promise<Contract> {
  const fieldResult = validateRequiredContractFields(params);
  if (!fieldResult.valid) throw new ContractError('VALIDATION_FAILED', 'params', fieldResult.errors.join('; '));

  const valueResult = validateContractValue(params.contractValue);
  if (!valueResult.valid) throw new ContractError('INVALID_VALUE', 'contractValue', valueResult.errors.join('; '));

  await assertUniqueContractNumber(params.contractNumber, repos.contracts);

  const contract = await repos.contracts.create({
    contractNumber:              params.contractNumber,
    contractType:                params.contractType,
    packageId:                   params.packageId,
    approvalId:                  params.approvalId,
    workflowId:                  params.workflowId,
    winnerCode:                  params.winnerCode,
    winnerName:                  params.winnerName,
    contractValue:               params.contractValue,
    currency:                    params.currency ?? 'VND',
    effectiveDate:               params.effectiveDate,
    expiryDate:                  params.expiryDate,
    performanceSecurityAmount:   params.performanceSecurityAmount,
    performanceSecurityPercent:  params.performanceSecurityPercent,
    advancePaymentAmount:        params.advancePaymentAmount,
    advancePaymentPercent:       params.advancePaymentPercent,
    status:                      'DRAFT',
    notes:                       params.notes,
  } as Omit<Contract, 'id' | 'createdAt' | 'updatedAt'>);

  await recordContractEvent(contract.id, 'CREATED', params.winnerCode, repos.history, { toStatus: 'DRAFT' });
  return contract;
}

// ─── Sign ─────────────────────────────────────────────────────────────────────

export async function signContract(
  contractId:  string,
  signedBy:    string,
  signedDate:  string,
  repos:       ContractRepositories,
): Promise<Contract> {
  const contract = await repos.contracts.findById(contractId);
  if (!contract) throw new ContractError('NOT_FOUND', 'contractId', `Contract not found: ${contractId}`);

  validateContractStatusTransition(contract.status, ['DRAFT'], 'status');

  const updated = await repos.contracts.update(contractId, { status: 'SIGNED', signedDate });
  await recordContractEvent(contractId, 'SIGNED', signedBy, repos.history, {
    fromStatus: 'DRAFT',
    toStatus:   'SIGNED',
    notes:      `Signed on ${signedDate}`,
  });
  return updated;
}

// ─── Activate ─────────────────────────────────────────────────────────────────

export async function activateContract(
  contractId:    string,
  activatedBy:   string,
  effectiveDate: string,
  repos:         ContractRepositories,
): Promise<Contract> {
  const contract = await repos.contracts.findById(contractId);
  if (!contract) throw new ContractError('NOT_FOUND', 'contractId', `Contract not found: ${contractId}`);

  validateContractStatusTransition(contract.status, ['SIGNED'], 'status');

  const updated = await repos.contracts.update(contractId, { status: 'EFFECTIVE', effectiveDate });
  await recordContractEvent(contractId, 'ACTIVATED', activatedBy, repos.history, {
    fromStatus: 'SIGNED',
    toStatus:   'EFFECTIVE',
    notes:      `Effective from ${effectiveDate}`,
  });
  return updated;
}

// ─── Suspend ──────────────────────────────────────────────────────────────────

export async function suspendContract(
  contractId:  string,
  suspendedBy: string,
  reason:      string,
  repos:       ContractRepositories,
): Promise<Contract> {
  const contract = await repos.contracts.findById(contractId);
  if (!contract) throw new ContractError('NOT_FOUND', 'contractId', `Contract not found: ${contractId}`);

  validateContractStatusTransition(contract.status, ['EFFECTIVE'], 'status');

  const updated = await repos.contracts.update(contractId, { status: 'SUSPENDED' });
  await recordContractEvent(contractId, 'SUSPENDED', suspendedBy, repos.history, {
    fromStatus: 'EFFECTIVE',
    toStatus:   'SUSPENDED',
    notes:      reason,
  });
  return updated;
}

// ─── Resume ───────────────────────────────────────────────────────────────────

export async function resumeContract(
  contractId: string,
  resumedBy:  string,
  reason:     string,
  repos:      ContractRepositories,
): Promise<Contract> {
  const contract = await repos.contracts.findById(contractId);
  if (!contract) throw new ContractError('NOT_FOUND', 'contractId', `Contract not found: ${contractId}`);

  validateContractStatusTransition(contract.status, ['SUSPENDED'], 'status');

  const updated = await repos.contracts.update(contractId, { status: 'EFFECTIVE' });
  await recordContractEvent(contractId, 'RESUMED', resumedBy, repos.history, {
    fromStatus: 'SUSPENDED',
    toStatus:   'EFFECTIVE',
    notes:      reason,
  });
  return updated;
}

// ─── Complete ─────────────────────────────────────────────────────────────────

export async function completeContract(
  contractId:  string,
  completedBy: string,
  repos:       ContractRepositories,
): Promise<Contract> {
  const contract = await repos.contracts.findById(contractId);
  if (!contract) throw new ContractError('NOT_FOUND', 'contractId', `Contract not found: ${contractId}`);

  validateContractStatusTransition(contract.status, ['EFFECTIVE'], 'status');

  const updated = await repos.contracts.update(contractId, { status: 'COMPLETED' });
  await recordContractEvent(contractId, 'COMPLETED', completedBy, repos.history, {
    fromStatus: 'EFFECTIVE',
    toStatus:   'COMPLETED',
  });
  return updated;
}

// ─── Terminate ────────────────────────────────────────────────────────────────

export async function terminateContract(
  contractId:   string,
  terminatedBy: string,
  reason:       string,
  repos:         ContractRepositories,
): Promise<Contract> {
  const contract = await repos.contracts.findById(contractId);
  if (!contract) throw new ContractError('NOT_FOUND', 'contractId', `Contract not found: ${contractId}`);

  validateContractStatusTransition(
    contract.status,
    ['DRAFT', 'SIGNED', 'EFFECTIVE', 'SUSPENDED'],
    'status',
  );

  const updated = await repos.contracts.update(contractId, { status: 'TERMINATED' });
  await recordContractEvent(contractId, 'TERMINATED', terminatedBy, repos.history, {
    fromStatus: contract.status,
    toStatus:   'TERMINATED',
    notes:      reason,
  });
  return updated;
}
