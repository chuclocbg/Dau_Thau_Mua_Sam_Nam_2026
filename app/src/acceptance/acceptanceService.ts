import type { AcceptanceRequest, CreateAcceptanceParams } from './acceptanceTypes';
import { AcceptanceError } from './acceptanceTypes';
import {
  validateRequiredAcceptanceFields, validateAcceptanceStatusTransition,
  assertUniqueAcceptanceCode,
} from './acceptanceValidation';
import { recordAcceptanceEvent } from './acceptanceHistory';
import type { AcceptanceRepositories } from './acceptanceRepositories';

// Default legal basis — extensible; callers may append any additional applicable law.
const DEFAULT_LEGAL_BASIS = [
  'Luật 22/2023/QH15',
  'NĐ 214/2025/NĐ-CP',
  'NĐ 104/2026/NĐ-CP',
  'TT 13/2026/TT-BCT',
  'TT 79/2025/TT-BTC',
];

export async function createAcceptanceRequest(
  params: CreateAcceptanceParams,
  repos:  AcceptanceRepositories,
): Promise<AcceptanceRequest> {
  const fieldResult = validateRequiredAcceptanceFields(params);
  if (!fieldResult.valid) throw new AcceptanceError('VALIDATION_FAILED', 'params', fieldResult.errors.join('; '));

  await assertUniqueAcceptanceCode(params.requestCode, repos.requests);

  const request = await repos.requests.create({
    requestCode:    params.requestCode,
    acceptanceType: params.acceptanceType,
    contractId:     params.contractId,
    packageId:      params.packageId,
    workflowId:     params.workflowId,
    requestedBy:    params.requestedBy,
    requestedAt:    new Date().toISOString(),
    department:     params.department,
    description:    params.description,
    // Merge caller-supplied basis with defaults; deduplicate; open-ended
    legalBasis:     [...new Set([...DEFAULT_LEGAL_BASIS, ...(params.legalBasis ?? [])])],
    status:         'DRAFT',
    notes:          params.notes,
  } as Omit<AcceptanceRequest, 'id' | 'createdAt' | 'updatedAt'>);

  await recordAcceptanceEvent(request.id, 'CREATED', params.requestedBy, repos.history, {
    toStatus: 'DRAFT',
  });
  return request;
}

export async function withdrawRequest(
  requestId:   string,
  withdrawnBy: string,
  reason:      string,
  repos:       AcceptanceRepositories,
): Promise<AcceptanceRequest> {
  const request = await repos.requests.findById(requestId);
  if (!request) throw new AcceptanceError('NOT_FOUND', 'requestId', `Request not found: ${requestId}`);

  validateAcceptanceStatusTransition(
    request.status,
    ['DRAFT', 'COMMITTEE_FORMED', 'IN_PROGRESS'],
    'status',
  );

  const updated = await repos.requests.update(requestId, { status: 'WITHDRAWN' });
  await recordAcceptanceEvent(requestId, 'WITHDRAWN', withdrawnBy, repos.history, {
    fromStatus: request.status, toStatus: 'WITHDRAWN',
    notes: reason,
  });
  return updated;
}

export async function completeAcceptance(
  requestId:   string,
  completedBy: string,
  repos:       AcceptanceRepositories,
): Promise<AcceptanceRequest> {
  const request = await repos.requests.findById(requestId);
  if (!request) throw new AcceptanceError('NOT_FOUND', 'requestId', `Request not found: ${requestId}`);

  validateAcceptanceStatusTransition(
    request.status,
    ['IN_PROGRESS', 'PARTIAL_ACCEPTED'],
    'status',
  );

  const updated = await repos.requests.update(requestId, {
    status:      'COMPLETED',
    completedAt: new Date().toISOString(),
  });
  await recordAcceptanceEvent(requestId, 'COMPLETED', completedBy, repos.history, {
    fromStatus: request.status, toStatus: 'COMPLETED',
  });
  return updated;
}

export async function rejectAcceptance(
  requestId:  string,
  rejectedBy: string,
  reason:     string,
  repos:      AcceptanceRepositories,
): Promise<AcceptanceRequest> {
  const request = await repos.requests.findById(requestId);
  if (!request) throw new AcceptanceError('NOT_FOUND', 'requestId', `Request not found: ${requestId}`);

  validateAcceptanceStatusTransition(
    request.status,
    ['IN_PROGRESS', 'PARTIAL_ACCEPTED'],
    'status',
  );

  const updated = await repos.requests.update(requestId, { status: 'REJECTED' });
  await recordAcceptanceEvent(requestId, 'REJECTED', rejectedBy, repos.history, {
    fromStatus: request.status, toStatus: 'REJECTED',
    notes: reason,
  });
  return updated;
}

export async function addLegalBasis(
  requestId:  string,
  lawCodes:   string[],
  updatedBy:  string,
  repos:      AcceptanceRepositories,
): Promise<AcceptanceRequest> {
  const request = await repos.requests.findById(requestId);
  if (!request) throw new AcceptanceError('NOT_FOUND', 'requestId', `Request not found: ${requestId}`);
  if (!lawCodes.length) return request;

  const merged = [...new Set([...request.legalBasis, ...lawCodes])];
  const updated = await repos.requests.update(requestId, { legalBasis: merged });
  await recordAcceptanceEvent(requestId, 'NOTE_ADDED', updatedBy, repos.history, {
    notes: `Legal basis updated: ${lawCodes.join(', ')}`,
  });
  return updated;
}
