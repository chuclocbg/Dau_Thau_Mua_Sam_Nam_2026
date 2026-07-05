import type { ApprovalRepositories } from './approvalRepositories';
import type { ApprovalDecisionRecord, RecordDecisionParams } from './approvalTypes';
import { ApprovalError } from './approvalTypes';
import { validateDecisionParams, validateStatusTransition, validateAuthorityAssigned } from './approvalValidation';
import { recordHistoryEvent } from './approvalHistory';

export function generateDecisionReference(type: string, year: number, sequence: number): string {
  return `QĐ/${type}/${year}/${String(sequence).padStart(4, '0')}`;
}

export async function recordDecision(
  requestId:   string,
  params:      RecordDecisionParams,
  repos:       ApprovalRepositories,
): Promise<ApprovalDecisionRecord> {
  const result = validateDecisionParams(params);
  if (!result.valid) throw new ApprovalError('INVALID_DECISION', 'decision', result.errors.join('; '));

  const request = await repos.requests.findById(requestId);
  if (!request) throw new ApprovalError('NOT_FOUND', 'requestId', `Approval request not found: ${requestId}`);

  validateStatusTransition(request.status, ['UNDER_REVIEW'], 'status');
  validateAuthorityAssigned(request);

  const existing = await repos.decisions.findByRequestId(requestId);
  if (existing) throw new ApprovalError('DECISION_EXISTS', 'requestId', `A decision already exists for request: ${requestId}`);

  const decision = await repos.decisions.create({
    requestId,
    outcome:           params.outcome,
    decidedBy:         params.decidedBy,
    decidedAt:         new Date().toISOString(),
    legalBasis:        params.legalBasis,
    conditions:        params.conditions ?? [],
    revisionRequired:  params.revisionRequired ?? [],
    decisionReference: params.decisionReference,
  } as Omit<ApprovalDecisionRecord, 'id' | 'createdAt' | 'updatedAt'>);

  const newStatus = params.outcome === 'APPROVED' ? 'APPROVED'
                  : params.outcome === 'REJECTED' ? 'REJECTED'
                  : 'RETURNED';

  await repos.requests.update(requestId, { status: newStatus, decisionId: decision.id });

  await recordHistoryEvent(requestId, params.outcome, params.decidedBy, repos.history, {
    fromStatus: 'UNDER_REVIEW',
    toStatus:   newStatus,
    notes:      `Decision ref: ${params.decisionReference}`,
  });

  return decision;
}

export async function getDecisionForRequest(
  requestId: string,
  repos:     ApprovalRepositories,
): Promise<ApprovalDecisionRecord | null> {
  return repos.decisions.findByRequestId(requestId);
}
