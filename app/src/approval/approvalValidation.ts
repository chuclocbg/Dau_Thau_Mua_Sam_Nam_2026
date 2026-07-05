import type { IApprovalRequestRepository } from './approvalRepositories';
import type {
  ApprovalRequest, CreateApprovalRequestParams,
  RecordDecisionParams, ApprovalStatus, ApprovalValidationResult,
  AddAttachmentParams,
} from './approvalTypes';
import { ApprovalError } from './approvalTypes';

// ─── R1: Unique request code ──────────────────────────────────────────────────

export async function assertUniqueApprovalCode(
  code: string,
  repo: IApprovalRequestRepository,
): Promise<void> {
  const existing = await repo.findByCode(code);
  if (existing) throw new ApprovalError('DUPLICATE_CODE', 'requestCode', `Request code already exists: ${code}`);
}

// ─── R2: Required fields ──────────────────────────────────────────────────────

export function validateRequiredRequestFields(
  params: CreateApprovalRequestParams,
): ApprovalValidationResult {
  const errors: string[] = [];
  if (!params.requestCode?.trim())   errors.push('requestCode is required');
  if (!params.subjectId?.trim())     errors.push('subjectId is required');
  if (!params.requestedBy?.trim())   errors.push('requestedBy is required');
  if (!params.department?.trim())    errors.push('department is required');
  return { valid: errors.length === 0, errors, warnings: [] };
}

// ─── R3: Estimated value ──────────────────────────────────────────────────────

export function validateEstimatedValue(value: number): ApprovalValidationResult {
  if (value <= 0) return { valid: false, errors: ['estimatedValue must be greater than 0'], warnings: [] };
  return { valid: true, errors: [], warnings: [] };
}

// ─── R4: Status transition ────────────────────────────────────────────────────

export function validateStatusTransition(
  current:  ApprovalStatus,
  allowed:  readonly ApprovalStatus[],
  field:    string,
): void {
  if (!allowed.includes(current)) {
    throw new ApprovalError(
      'INVALID_STATUS',
      field,
      `Cannot perform action on request with status: ${current}. Allowed: ${allowed.join(', ')}`,
    );
  }
}

// ─── R5: Authority assignment ─────────────────────────────────────────────────

export function validateAuthorityAssigned(request: ApprovalRequest): void {
  if (!request.assignedAuthorityCode) {
    throw new ApprovalError('NO_AUTHORITY', 'assignedAuthorityCode', 'No approval authority assigned to this request');
  }
}

// ─── R6: Decision params ──────────────────────────────────────────────────────

export function validateDecisionParams(params: RecordDecisionParams): ApprovalValidationResult {
  const errors: string[] = [];
  if (!params.decidedBy?.trim())         errors.push('decidedBy is required');
  if (!params.legalBasis?.trim())        errors.push('legalBasis is required');
  if (!params.decisionReference?.trim()) errors.push('decisionReference is required');
  if (params.outcome === 'RETURNED' && (!params.revisionRequired || params.revisionRequired.length === 0)) {
    errors.push('revisionRequired must list what needs revision when returning a request');
  }
  return { valid: errors.length === 0, errors, warnings: [] };
}

// ─── R7: Comment content ──────────────────────────────────────────────────────

export function validateCommentContent(content: string): void {
  if (!content?.trim()) {
    throw new ApprovalError('EMPTY_COMMENT', 'content', 'Comment content cannot be empty');
  }
  if (content.trim().length > 5000) {
    throw new ApprovalError('COMMENT_TOO_LONG', 'content', 'Comment content must not exceed 5000 characters');
  }
}

// ─── R8: Attachment params ────────────────────────────────────────────────────

export function validateAttachmentParams(params: AddAttachmentParams): ApprovalValidationResult {
  const errors: string[] = [];
  if (!params.fileName?.trim())   errors.push('fileName is required');
  if (!params.fileType?.trim())   errors.push('fileType is required');
  if (params.fileSize <= 0)       errors.push('fileSize must be greater than 0');
  const MAX_SIZE = 50 * 1024 * 1024; // 50 MB
  if (params.fileSize > MAX_SIZE) errors.push(`fileSize must not exceed ${MAX_SIZE} bytes (50 MB)`);
  return { valid: errors.length === 0, errors, warnings: [] };
}
