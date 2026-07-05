import type { ApprovalRepositories } from './approvalRepositories';
import type {
  ApprovalRequest, CreateApprovalRequestParams,
} from './approvalTypes';
import { ApprovalError } from './approvalTypes';
import {
  assertUniqueApprovalCode, validateRequiredRequestFields,
  validateEstimatedValue, validateStatusTransition,
} from './approvalValidation';
import { recordHistoryEvent } from './approvalHistory';

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createApprovalRequest(
  params: CreateApprovalRequestParams,
  repos:  ApprovalRepositories,
): Promise<ApprovalRequest> {
  const fieldResult = validateRequiredRequestFields(params);
  if (!fieldResult.valid) throw new ApprovalError('VALIDATION_FAILED', 'params', fieldResult.errors.join('; '));

  const valueResult = validateEstimatedValue(params.estimatedValue);
  if (!valueResult.valid) throw new ApprovalError('INVALID_VALUE', 'estimatedValue', valueResult.errors.join('; '));

  await assertUniqueApprovalCode(params.requestCode, repos.requests);

  const request = await repos.requests.create({
    requestCode:    params.requestCode,
    approvalType:   params.approvalType,
    subjectId:      params.subjectId,
    subjectType:    params.subjectType,
    requestedBy:    params.requestedBy,
    requestedAt:    new Date().toISOString(),
    department:     params.department,
    estimatedValue: params.estimatedValue,
    dueDate:        params.dueDate,
    status:         'DRAFT',
    notes:          params.notes,
  } as Omit<ApprovalRequest, 'id' | 'createdAt' | 'updatedAt'>);

  await recordHistoryEvent(request.id, 'CREATED', params.requestedBy, repos.history, { toStatus: 'DRAFT' });
  return request;
}

// ─── Submit ───────────────────────────────────────────────────────────────────

export async function submitForApproval(
  requestId:   string,
  submittedBy: string,
  repos:       ApprovalRepositories,
): Promise<ApprovalRequest> {
  const request = await repos.requests.findById(requestId);
  if (!request) throw new ApprovalError('NOT_FOUND', 'requestId', `Approval request not found: ${requestId}`);

  validateStatusTransition(request.status, ['DRAFT', 'RETURNED'], 'status');

  const updated = await repos.requests.update(requestId, { status: 'SUBMITTED' });
  await recordHistoryEvent(requestId, 'SUBMITTED', submittedBy, repos.history, {
    fromStatus: request.status,
    toStatus:   'SUBMITTED',
  });
  return updated;
}

// ─── Assign authority ─────────────────────────────────────────────────────────

export async function assignAuthority(
  requestId:     string,
  authorityCode: string,
  authorityName: string,
  assignedBy:    string,
  repos:         ApprovalRepositories,
): Promise<ApprovalRequest> {
  const request = await repos.requests.findById(requestId);
  if (!request) throw new ApprovalError('NOT_FOUND', 'requestId', `Approval request not found: ${requestId}`);

  validateStatusTransition(request.status, ['SUBMITTED', 'UNDER_REVIEW'], 'status');

  const updated = await repos.requests.update(requestId, {
    assignedAuthorityCode: authorityCode,
    assignedAuthorityName: authorityName,
    status: 'UNDER_REVIEW',
  });
  await recordHistoryEvent(requestId, 'ASSIGNED', assignedBy, repos.history, {
    fromStatus: request.status,
    toStatus:   'UNDER_REVIEW',
    notes:      `Assigned to ${authorityCode}`,
  });
  return updated;
}

// ─── Withdraw ─────────────────────────────────────────────────────────────────

export async function withdrawApprovalRequest(
  requestId:   string,
  withdrawnBy: string,
  reason:      string,
  repos:       ApprovalRepositories,
): Promise<ApprovalRequest> {
  const request = await repos.requests.findById(requestId);
  if (!request) throw new ApprovalError('NOT_FOUND', 'requestId', `Approval request not found: ${requestId}`);

  validateStatusTransition(request.status, ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW'], 'status');

  const updated = await repos.requests.update(requestId, { status: 'WITHDRAWN' });
  await recordHistoryEvent(requestId, 'WITHDRAWN', withdrawnBy, repos.history, {
    fromStatus: request.status,
    toStatus:   'WITHDRAWN',
    notes:      reason,
  });
  return updated;
}
