import type { ContractType, CreateContractParams } from './contractTypes';
export { createMemoryContractRepositories } from './memoryContractRepositories';
export { createPrismaContractRepositories } from './prismaContractRepositories';

export function generateContractNumber(year: number, sequence: number): string {
  return `HĐ/DTMS/${year}/${String(sequence).padStart(4, '0')}`;
}

export function generateAmendmentCode(contractNumber: string, amendmentSequence: number): string {
  const base = contractNumber.replace('HĐ/', '');
  return `PLHD/${base}/${String(amendmentSequence).padStart(2, '0')}`;
}

export function buildCreateContractParams(opts: {
  contractNumber:              string;
  contractType:                ContractType;
  packageId:                   string;
  winnerCode:                  string;
  winnerName:                  string;
  contractValue:               number;
  approvalId?:                 string;
  workflowId?:                 string;
  effectiveDate?:              string;
  expiryDate?:                 string;
  performanceSecurityPercent?: number;
  advancePaymentPercent?:      number;
  notes?:                      string;
}): CreateContractParams {
  const perfSec = opts.performanceSecurityPercent !== undefined
    ? Math.round(opts.contractValue * opts.performanceSecurityPercent / 100)
    : undefined;
  const advance = opts.advancePaymentPercent !== undefined
    ? Math.round(opts.contractValue * opts.advancePaymentPercent / 100)
    : undefined;

  return {
    contractNumber:              opts.contractNumber,
    contractType:                opts.contractType,
    packageId:                   opts.packageId,
    approvalId:                  opts.approvalId,
    workflowId:                  opts.workflowId,
    winnerCode:                  opts.winnerCode,
    winnerName:                  opts.winnerName,
    contractValue:               opts.contractValue,
    currency:                    'VND',
    effectiveDate:               opts.effectiveDate,
    expiryDate:                  opts.expiryDate,
    performanceSecurityAmount:   perfSec,
    performanceSecurityPercent:  opts.performanceSecurityPercent,
    advancePaymentAmount:        advance,
    advancePaymentPercent:       opts.advancePaymentPercent,
    notes:                       opts.notes,
  };
}
