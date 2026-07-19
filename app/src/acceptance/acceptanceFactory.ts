import type { CreateAcceptanceParams, AcceptanceType } from './acceptanceTypes';
export { createMemoryAcceptanceRepositories } from './memoryAcceptanceRepositories';
export { buildPrismaAcceptanceRepositories } from './prismaAcceptanceRepositories';

export function generateAcceptanceCode(type: AcceptanceType, year: number, sequence: number): string {
  const tag = type === 'PARTIAL' ? 'NT' : type === 'FINAL' ? 'NTH' : 'NTB';
  return `NT/${tag}/${year}/${String(sequence).padStart(4, '0')}`;
}

export function generateMinuteCode(acceptanceCode: string, sessionNumber: number): string {
  return `BB/${acceptanceCode.replace('NT/', '')}/${String(sessionNumber).padStart(2, '0')}`;
}

export function buildCreateAcceptanceParams(opts: {
  requestCode:    string;
  acceptanceType: AcceptanceType;
  contractId:     string;
  requestedBy:    string;
  department:     string;
  packageId?:     string;
  workflowId?:    string;
  description?:   string;
  extraLegalBasis?: string[]; // any additional laws beyond the 5 default seeds
  notes?:         string;
}): CreateAcceptanceParams {
  return {
    requestCode:    opts.requestCode,
    acceptanceType: opts.acceptanceType,
    contractId:     opts.contractId,
    packageId:      opts.packageId,
    workflowId:     opts.workflowId,
    requestedBy:    opts.requestedBy,
    department:     opts.department,
    description:    opts.description,
    legalBasis:     opts.extraLegalBasis ?? [],
    notes:          opts.notes,
  };
}
