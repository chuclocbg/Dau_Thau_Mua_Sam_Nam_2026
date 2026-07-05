import type { IContractRepository } from './contractRepositories';
import type {
  ContractStatus, CreateContractParams, AddGuaranteeParams,
  AddMilestoneParams, CreateAmendmentParams, AddAttachmentParams,
  ContractValidationResult,
} from './contractTypes';
import { ContractError } from './contractTypes';

// ─── V1: Unique contract number ───────────────────────────────────────────────

export async function assertUniqueContractNumber(
  number: string,
  repo:   IContractRepository,
): Promise<void> {
  const existing = await repo.findByNumber(number);
  if (existing) throw new ContractError('DUPLICATE_NUMBER', 'contractNumber', `Contract number already exists: ${number}`);
}

// ─── V2: Required fields ──────────────────────────────────────────────────────

export function validateRequiredContractFields(
  params: CreateContractParams,
): ContractValidationResult {
  const errors: string[] = [];
  if (!params.contractNumber?.trim()) errors.push('contractNumber is required');
  if (!params.packageId?.trim())      errors.push('packageId is required');
  if (!params.winnerCode?.trim())     errors.push('winnerCode is required');
  if (!params.winnerName?.trim())     errors.push('winnerName is required');
  return { valid: errors.length === 0, errors, warnings: [] };
}

// ─── V3: Contract value ───────────────────────────────────────────────────────

export function validateContractValue(value: number): ContractValidationResult {
  if (value <= 0) return { valid: false, errors: ['contractValue must be greater than 0'], warnings: [] };
  return { valid: true, errors: [], warnings: [] };
}

// ─── V4: Status transition ────────────────────────────────────────────────────

export function validateContractStatusTransition(
  current: ContractStatus,
  allowed: readonly ContractStatus[],
  field:   string,
): void {
  if (!allowed.includes(current)) {
    throw new ContractError(
      'INVALID_STATUS',
      field,
      `Cannot perform action on contract with status: ${current}. Allowed: ${allowed.join(', ')}`,
    );
  }
}

// ─── V5: Guarantee params ─────────────────────────────────────────────────────

export function validateGuaranteeParams(params: AddGuaranteeParams): ContractValidationResult {
  const errors: string[] = [];
  if (params.amount <= 0)               errors.push('guarantee amount must be greater than 0');
  if (!params.issuerCode?.trim())       errors.push('issuerCode is required');
  if (!params.issuerName?.trim())       errors.push('issuerName is required');
  if (!params.guaranteeNumber?.trim())  errors.push('guaranteeNumber is required');
  if (!params.issuedDate?.trim())       errors.push('issuedDate is required');
  if (!params.expiryDate?.trim())       errors.push('expiryDate is required');
  if (params.issuedDate && params.expiryDate && params.expiryDate <= params.issuedDate) {
    errors.push('expiryDate must be after issuedDate');
  }
  return { valid: errors.length === 0, errors, warnings: [] };
}

// ─── V6: Milestone params ─────────────────────────────────────────────────────

export function validateMilestoneParams(params: AddMilestoneParams): ContractValidationResult {
  const errors: string[] = [];
  if (!params.milestoneCode?.trim()) errors.push('milestoneCode is required');
  if (!params.title?.trim())         errors.push('milestone title is required');
  if (!params.plannedDate?.trim())   errors.push('plannedDate is required');
  if (params.plannedValue <= 0)      errors.push('plannedValue must be greater than 0');
  return { valid: errors.length === 0, errors, warnings: [] };
}

// ─── V7: Amendment params ─────────────────────────────────────────────────────

export function validateAmendmentParams(params: CreateAmendmentParams): ContractValidationResult {
  const errors: string[] = [];
  if (!params.reason?.trim())                                                    errors.push('amendment reason is required');
  if (!params.changedFields || params.changedFields.length === 0)               errors.push('changedFields must list at least one changed field');
  if (params.valueChange !== undefined && !Number.isFinite(params.valueChange)) errors.push('valueChange must be a finite number');
  if (params.timeExtensionDays !== undefined && params.timeExtensionDays < 0)   errors.push('timeExtensionDays must be non-negative');
  return { valid: errors.length === 0, errors, warnings: [] };
}

// ─── V8: Attachment params ────────────────────────────────────────────────────

export function validateAttachmentParams(params: AddAttachmentParams): ContractValidationResult {
  const errors: string[] = [];
  if (!params.fileName?.trim()) errors.push('fileName is required');
  if (!params.fileType?.trim()) errors.push('fileType is required');
  if (params.fileSize <= 0)     errors.push('fileSize must be greater than 0');
  const MAX = 100 * 1024 * 1024; // 100 MB for contract docs
  if (params.fileSize > MAX)    errors.push(`fileSize must not exceed ${MAX} bytes (100 MB)`);
  return { valid: errors.length === 0, errors, warnings: [] };
}
