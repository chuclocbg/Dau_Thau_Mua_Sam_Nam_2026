import type {
  CreateAcceptanceParams, FormCommitteeParams, AddMemberParams,
  CreateSessionParams, RecordItemParams, CreateMinuteParams, AddAttachmentParams,
  AcceptanceStatus, AcceptanceValidationResult,
} from './acceptanceTypes';
import { AcceptanceError } from './acceptanceTypes';

const MAX_ATTACHMENT_BYTES = 100 * 1024 * 1024; // 100 MB

function ok(): AcceptanceValidationResult { return { valid: true, errors: [], warnings: [] }; }
function fail(errors: string[]): AcceptanceValidationResult { return { valid: false, errors, warnings: [] }; }

export function validateRequiredAcceptanceFields(p: CreateAcceptanceParams): AcceptanceValidationResult {
  const errors: string[] = [];
  if (!p.requestCode?.trim())  errors.push('requestCode is required');
  if (!p.contractId?.trim())   errors.push('contractId is required');
  if (!p.requestedBy?.trim())  errors.push('requestedBy is required');
  if (!p.department?.trim())   errors.push('department is required');
  if (!p.acceptanceType)       errors.push('acceptanceType is required');
  return errors.length ? fail(errors) : ok();
}

export function validateFormCommitteeParams(p: FormCommitteeParams): AcceptanceValidationResult {
  const errors: string[] = [];
  if (!p.committeeCode?.trim())  errors.push('committeeCode is required');
  if (!p.establishedBy?.trim())  errors.push('establishedBy is required');
  return errors.length ? fail(errors) : ok();
}

export function validateMemberParams(p: AddMemberParams): AcceptanceValidationResult {
  const errors: string[] = [];
  if (!p.memberCode?.trim()) errors.push('memberCode is required');
  if (!p.memberName?.trim()) errors.push('memberName is required');
  if (!p.role)               errors.push('role is required');
  return errors.length ? fail(errors) : ok();
}

export function validateSessionParams(p: CreateSessionParams): AcceptanceValidationResult {
  const errors: string[] = [];
  if (!p.sessionType)              errors.push('sessionType is required');
  if (!p.scheduledDate?.trim())    errors.push('scheduledDate is required');
  return errors.length ? fail(errors) : ok();
}

export function validateItemParams(p: RecordItemParams): AcceptanceValidationResult {
  const errors: string[] = [];
  if (!p.itemCode?.trim())            errors.push('itemCode is required');
  if (!p.description?.trim())         errors.push('description is required');
  if (p.contractedQuantity <= 0)      errors.push('contractedQuantity must be > 0');
  if (p.acceptedQuantity < 0)         errors.push('acceptedQuantity must be >= 0');
  if (p.rejectedQuantity < 0)         errors.push('rejectedQuantity must be >= 0');
  const total = p.acceptedQuantity + p.rejectedQuantity;
  if (total > p.contractedQuantity)   errors.push('acceptedQuantity + rejectedQuantity cannot exceed contractedQuantity');
  return errors.length ? fail(errors) : ok();
}

export function validateMinuteParams(p: CreateMinuteParams): AcceptanceValidationResult {
  const errors: string[] = [];
  if (!p.minuteCode?.trim())  errors.push('minuteCode is required');
  if (!p.conclusion?.trim())  errors.push('conclusion is required');
  return errors.length ? fail(errors) : ok();
}

export function validateAttachmentParams(p: AddAttachmentParams): AcceptanceValidationResult {
  const errors: string[] = [];
  if (!p.fileName?.trim())          errors.push('fileName is required');
  if (!p.fileType?.trim())          errors.push('fileType is required');
  if (!p.fileSize || p.fileSize <= 0) errors.push('fileSize must be > 0');
  if (p.fileSize > MAX_ATTACHMENT_BYTES) errors.push('fileSize exceeds 100MB limit');
  return errors.length ? fail(errors) : ok();
}

export function validateAcceptanceStatusTransition(
  current: AcceptanceStatus,
  allowed: AcceptanceStatus[],
  field:   string,
): void {
  if (!allowed.includes(current)) {
    throw new AcceptanceError(
      'INVALID_STATUS', field,
      `Status '${current}' is not allowed for this operation. Allowed: ${allowed.join(', ')}`,
    );
  }
}

export async function assertUniqueAcceptanceCode(
  requestCode: string,
  repo: { findByCode(code: string): Promise<unknown> },
): Promise<void> {
  const existing = await repo.findByCode(requestCode);
  if (existing) throw new AcceptanceError('DUPLICATE_CODE', 'requestCode', `Request code already exists: ${requestCode}`);
}
