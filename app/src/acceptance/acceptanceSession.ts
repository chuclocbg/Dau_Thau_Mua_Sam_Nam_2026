import type { AcceptanceSession, CreateSessionParams } from './acceptanceTypes';
import { AcceptanceError } from './acceptanceTypes';
import { validateSessionParams } from './acceptanceValidation';
import { recordAcceptanceEvent } from './acceptanceHistory';
import type { AcceptanceRepositories } from './acceptanceRepositories';

export async function createSession(
  requestId: string,
  params:    CreateSessionParams,
  createdBy: string,
  repos:     AcceptanceRepositories,
): Promise<AcceptanceSession> {
  const result = validateSessionParams(params);
  if (!result.valid) throw new AcceptanceError('INVALID_SESSION', 'session', result.errors.join('; '));

  const request = await repos.requests.findById(requestId);
  if (!request) throw new AcceptanceError('NOT_FOUND', 'requestId', `Request not found: ${requestId}`);

  if (request.status !== 'COMMITTEE_FORMED' && request.status !== 'IN_PROGRESS' && request.status !== 'PARTIAL_ACCEPTED') {
    throw new AcceptanceError('INVALID_STATUS', 'status', `Cannot create session with status: ${request.status}`);
  }

  const existing = await repos.sessions.findByRequestId(requestId);
  const sessionNumber = existing.length + 1;

  const session = await repos.sessions.create({
    requestId,
    sessionNumber,
    sessionType:   params.sessionType,
    scheduledDate: params.scheduledDate,
    location:      params.location,
    status:        'PENDING',
    chairmanCode:  params.chairmanCode,
    notes:         params.notes,
  } as Omit<AcceptanceSession, 'id' | 'createdAt' | 'updatedAt'>);

  // Advance request status to IN_PROGRESS on first session
  if (request.status === 'COMMITTEE_FORMED') {
    await repos.requests.update(requestId, { status: 'IN_PROGRESS' });
  }

  return session;
}

export async function startSession(
  sessionId:  string,
  startedBy:  string,
  actualDate: string,
  repos:      AcceptanceRepositories,
): Promise<AcceptanceSession> {
  const session = await repos.sessions.findById(sessionId);
  if (!session) throw new AcceptanceError('NOT_FOUND', 'sessionId', `Session not found: ${sessionId}`);
  if (session.status !== 'PENDING') {
    throw new AcceptanceError('INVALID_STATUS', 'status', `Cannot start session with status: ${session.status}`);
  }

  const updated = await repos.sessions.update(sessionId, { status: 'IN_PROGRESS', actualDate });
  await recordAcceptanceEvent(session.requestId, 'SESSION_STARTED', startedBy, repos.history, {
    notes: `Session ${session.sessionNumber} started`,
  });
  return updated;
}

export async function closeSession(
  sessionId:   string,
  closedBy:    string,
  repos:       AcceptanceRepositories,
): Promise<AcceptanceSession> {
  const session = await repos.sessions.findById(sessionId);
  if (!session) throw new AcceptanceError('NOT_FOUND', 'sessionId', `Session not found: ${sessionId}`);
  if (session.status !== 'IN_PROGRESS') {
    throw new AcceptanceError('INVALID_STATUS', 'status', `Cannot close session with status: ${session.status}`);
  }

  const updated = await repos.sessions.update(sessionId, { status: 'COMPLETED' });
  await recordAcceptanceEvent(session.requestId, 'SESSION_COMPLETED', closedBy, repos.history, {
    notes: `Session ${session.sessionNumber} completed`,
  });

  // Advance request status: if this is a PARTIAL session → PARTIAL_ACCEPTED; if FINAL → stays IN_PROGRESS (completeAcceptance handles COMPLETED)
  const request = await repos.requests.findById(session.requestId);
  if (request && session.sessionType === 'PARTIAL' && request.status === 'IN_PROGRESS') {
    await repos.requests.update(session.requestId, { status: 'PARTIAL_ACCEPTED' });
  }
  return updated;
}

export async function cancelSession(
  sessionId:  string,
  cancelledBy: string,
  reason:     string,
  repos:      AcceptanceRepositories,
): Promise<AcceptanceSession> {
  const session = await repos.sessions.findById(sessionId);
  if (!session) throw new AcceptanceError('NOT_FOUND', 'sessionId', `Session not found: ${sessionId}`);
  if (session.status === 'COMPLETED' || session.status === 'CANCELLED') {
    throw new AcceptanceError('INVALID_STATUS', 'status', `Cannot cancel session with status: ${session.status}`);
  }

  const updated = await repos.sessions.update(sessionId, { status: 'CANCELLED' });
  await recordAcceptanceEvent(session.requestId, 'SESSION_CANCELLED', cancelledBy, repos.history, {
    notes: reason,
  });
  return updated;
}

export async function getSessions(
  requestId: string,
  repos:     AcceptanceRepositories,
): Promise<readonly AcceptanceSession[]> {
  return repos.sessions.findByRequestId(requestId);
}
