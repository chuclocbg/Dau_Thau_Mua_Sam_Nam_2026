import type { AcceptanceItem, RecordItemParams } from './acceptanceTypes';
import { AcceptanceError } from './acceptanceTypes';
import { validateItemParams } from './acceptanceValidation';
import { recordAcceptanceEvent } from './acceptanceHistory';
import type { AcceptanceRepositories } from './acceptanceRepositories';

export async function recordItem(
  sessionId:  string,
  requestId:  string,
  params:     RecordItemParams,
  recordedBy: string,
  repos:      AcceptanceRepositories,
): Promise<AcceptanceItem> {
  const result = validateItemParams(params);
  if (!result.valid) throw new AcceptanceError('INVALID_ITEM', 'item', result.errors.join('; '));

  const session = await repos.sessions.findById(sessionId);
  if (!session) throw new AcceptanceError('NOT_FOUND', 'sessionId', `Session not found: ${sessionId}`);
  if (session.status !== 'IN_PROGRESS') {
    throw new AcceptanceError('INVALID_STATUS', 'status', `Session must be IN_PROGRESS to record items`);
  }

  const status = params.rejectedQuantity > 0 && params.acceptedQuantity === 0
    ? 'REJECTED'
    : params.rejectedQuantity === 0
      ? 'ACCEPTED'
      : 'PENDING'; // partial accepted/rejected = PENDING until session close

  const item = await repos.items.create({
    sessionId,
    requestId,
    itemCode:           params.itemCode,
    description:        params.description,
    unit:               params.unit,
    contractedQuantity: params.contractedQuantity,
    acceptedQuantity:   params.acceptedQuantity,
    rejectedQuantity:   params.rejectedQuantity,
    status,
    rejectReason:       params.rejectReason,
    verifiedBy:         params.verifiedBy,
  } as Omit<AcceptanceItem, 'id' | 'createdAt' | 'updatedAt'>);

  await recordAcceptanceEvent(requestId, 'ITEM_RECORDED', recordedBy, repos.history, {
    notes: `Item ${params.itemCode}: accepted=${params.acceptedQuantity}, rejected=${params.rejectedQuantity}`,
  });
  return item;
}

export async function getItems(
  requestId: string,
  repos:     AcceptanceRepositories,
): Promise<readonly AcceptanceItem[]> {
  return repos.items.findByRequestId(requestId);
}

export async function getItemsBySession(
  sessionId: string,
  repos:     AcceptanceRepositories,
): Promise<readonly AcceptanceItem[]> {
  return repos.items.findBySessionId(sessionId);
}

export async function calculateAcceptanceRate(
  requestId: string,
  repos:     AcceptanceRepositories,
): Promise<number> {
  const items = await repos.items.findByRequestId(requestId);
  if (items.length === 0) return 0;
  const totalContracted = items.reduce((s, i) => s + i.contractedQuantity, 0);
  if (totalContracted === 0) return 0;
  const totalAccepted = items.reduce((s, i) => s + i.acceptedQuantity, 0);
  return Math.min(100, Math.round((totalAccepted / totalContracted) * 100));
}
