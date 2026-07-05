import type { AcceptanceMinute, CreateMinuteParams } from './acceptanceTypes';
import { AcceptanceError } from './acceptanceTypes';
import { validateMinuteParams } from './acceptanceValidation';
import { recordAcceptanceEvent } from './acceptanceHistory';
import type { AcceptanceRepositories } from './acceptanceRepositories';

export async function createMinute(
  requestId:  string,
  sessionId:  string,
  params:     CreateMinuteParams,
  createdBy:  string,
  repos:      AcceptanceRepositories,
): Promise<AcceptanceMinute> {
  const result = validateMinuteParams(params);
  if (!result.valid) throw new AcceptanceError('INVALID_MINUTE', 'minute', result.errors.join('; '));

  const session = await repos.sessions.findById(sessionId);
  if (!session) throw new AcceptanceError('NOT_FOUND', 'sessionId', `Session not found: ${sessionId}`);

  // One minute per session
  const existing = await repos.minutes.findBySessionId(sessionId);
  if (existing) throw new AcceptanceError('MINUTE_EXISTS', 'sessionId', `Minute already exists for session: ${sessionId}`);

  const minute = await repos.minutes.create({
    requestId,
    sessionId,
    minuteCode: params.minuteCode,
    content:    params.content,
    conclusion: params.conclusion,
    status:     'DRAFT',
  } as Omit<AcceptanceMinute, 'id' | 'createdAt' | 'updatedAt'>);

  await recordAcceptanceEvent(requestId, 'MINUTE_CREATED', createdBy, repos.history, {
    notes: `Minute ${params.minuteCode} created`,
  });
  return minute;
}

export async function signMinute(
  minuteId: string,
  signedBy: string,
  repos:    AcceptanceRepositories,
): Promise<AcceptanceMinute> {
  const minute = await repos.minutes.findById(minuteId);
  if (!minute) throw new AcceptanceError('NOT_FOUND', 'minuteId', `Minute not found: ${minuteId}`);
  if (minute.status !== 'DRAFT') {
    throw new AcceptanceError('INVALID_STATUS', 'status', `Cannot sign minute with status: ${minute.status}`);
  }

  const updated = await repos.minutes.update(minuteId, {
    status:   'SIGNED',
    signedBy,
    signedAt: new Date().toISOString(),
  });
  await recordAcceptanceEvent(minute.requestId, 'MINUTE_SIGNED', signedBy, repos.history, {
    notes: `Minute ${minute.minuteCode} signed`,
  });
  return updated;
}

export async function getMinutes(
  requestId: string,
  repos:     AcceptanceRepositories,
): Promise<readonly AcceptanceMinute[]> {
  return repos.minutes.findByRequestId(requestId);
}
