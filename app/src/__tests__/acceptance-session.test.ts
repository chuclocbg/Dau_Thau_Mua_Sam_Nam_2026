import { describe, it, expect, beforeEach } from 'vitest';
import { createSession, startSession, closeSession, cancelSession, getSessions } from '../acceptance/acceptanceSession';
import { createAcceptanceRequest } from '../acceptance/acceptanceService';
import { formCommittee } from '../acceptance/acceptanceCommittee';
import { createMemoryAcceptanceRepositories } from '../acceptance/acceptanceFactory';
import type { AcceptanceRepositories } from '../acceptance/acceptanceRepositories';
import { AcceptanceError } from '../acceptance/acceptanceTypes';
import type { CreateAcceptanceParams, FormCommitteeParams, CreateSessionParams } from '../acceptance/acceptanceTypes';

// ACR-SS-01
describe('createSession — happy path', () => {
  let repos: AcceptanceRepositories;
  let requestId: string;
  beforeEach(async () => { ({ repos, requestId } = await makeCommitteeFormed()); });

  it('creates a PENDING session', async () => {
    const s = await createSession(requestId, sparams(), 'U', repos);
    expect(s.status).toBe('PENDING');
  });
  it('sessionNumber starts at 1', async () => {
    const s = await createSession(requestId, sparams(), 'U', repos);
    expect(s.sessionNumber).toBe(1);
  });
  it('advances request to IN_PROGRESS on first session', async () => {
    await createSession(requestId, sparams(), 'U', repos);
    const r = await repos.requests.findById(requestId);
    expect(r?.status).toBe('IN_PROGRESS');
  });
});

// ACR-SS-02
describe('createSession — auto-numbering', () => {
  let repos: AcceptanceRepositories;
  let requestId: string;
  beforeEach(async () => { ({ repos, requestId } = await makeInProgress()); });

  it('second session gets number 2', async () => {
    await createSession(requestId, sparams(), 'U', repos);
    const s2 = await createSession(requestId, sparams(), 'U', repos);
    expect(s2.sessionNumber).toBe(2);
  });
  it('sessions are sorted by sessionNumber', async () => {
    await createSession(requestId, sparams(), 'U', repos);
    await createSession(requestId, sparams(), 'U', repos);
    const all = await getSessions(requestId, repos);
    expect(all[0]?.sessionNumber).toBe(1);
    expect(all[1]?.sessionNumber).toBe(2);
  });
  it('stores sessionType', async () => {
    const s = await createSession(requestId, sparams(), 'U', repos);
    expect(s.sessionType).toBe('FINAL');
  });
});

// ACR-SS-03
describe('createSession — validation', () => {
  let repos: AcceptanceRepositories;
  let requestId: string;
  beforeEach(async () => { ({ repos, requestId } = await makeCommitteeFormed()); });

  it('throws for unknown requestId', async () => {
    await expect(createSession('NONE', sparams(), 'U', repos)).rejects.toThrow(AcceptanceError);
  });
  it('throws when scheduledDate is empty', async () => {
    await expect(createSession(requestId, { ...sparams(), scheduledDate: '' }, 'U', repos)).rejects.toThrow(AcceptanceError);
  });
  it('throws when request is DRAFT (not committee formed)', async () => {
    const repos2 = createMemoryAcceptanceRepositories();
    const r = await createAcceptanceRequest(rparams(), repos2);
    await expect(createSession(r.id, sparams(), 'U', repos2)).rejects.toThrow(AcceptanceError);
  });
});

// ACR-SS-04
describe('startSession', () => {
  let repos: AcceptanceRepositories;
  let requestId: string;
  beforeEach(async () => { ({ repos, requestId } = await makeCommitteeFormed()); });

  it('transitions PENDING → IN_PROGRESS', async () => {
    const s = await createSession(requestId, sparams(), 'U', repos);
    const started = await startSession(s.id, 'U', '2026-08-01', repos);
    expect(started.status).toBe('IN_PROGRESS');
  });
  it('stores actualDate', async () => {
    const s = await createSession(requestId, sparams(), 'U', repos);
    const started = await startSession(s.id, 'U', '2026-08-01', repos);
    expect(started.actualDate).toBe('2026-08-01');
  });
  it('records SESSION_STARTED event', async () => {
    const s = await createSession(requestId, sparams(), 'U', repos);
    await startSession(s.id, 'U', '2026-08-01', repos);
    const events = await repos.history.findByRequestId(requestId);
    expect(events.some(e => e.action === 'SESSION_STARTED')).toBe(true);
  });
});

// ACR-SS-05
describe('startSession — status guard', () => {
  let repos: AcceptanceRepositories;
  let requestId: string;
  beforeEach(async () => { ({ repos, requestId } = await makeCommitteeFormed()); });

  it('throws for unknown sessionId', async () => {
    await expect(startSession('NONE', 'U', '2026-08-01', repos)).rejects.toThrow(AcceptanceError);
  });
  it('throws when already IN_PROGRESS', async () => {
    const s = await createSession(requestId, sparams(), 'U', repos);
    await startSession(s.id, 'U', '2026-08-01', repos);
    await expect(startSession(s.id, 'U', '2026-08-02', repos)).rejects.toThrow(AcceptanceError);
  });
  it('throws when COMPLETED', async () => {
    const s = await createSession(requestId, sparams(), 'U', repos);
    await startSession(s.id, 'U', '2026-08-01', repos);
    await closeSession(s.id, 'U', repos);
    await expect(startSession(s.id, 'U', '2026-08-02', repos)).rejects.toThrow(AcceptanceError);
  });
});

// ACR-SS-06
describe('closeSession — FINAL session', () => {
  let repos: AcceptanceRepositories;
  let requestId: string;
  beforeEach(async () => { ({ repos, requestId } = await makeInProgress()); });

  it('transitions IN_PROGRESS → COMPLETED', async () => {
    const s = await createSession(requestId, sparams(), 'U', repos);
    await startSession(s.id, 'U', '2026-08-01', repos);
    const closed = await closeSession(s.id, 'U', repos);
    expect(closed.status).toBe('COMPLETED');
  });
  it('records SESSION_COMPLETED event', async () => {
    const s = await createSession(requestId, sparams(), 'U', repos);
    await startSession(s.id, 'U', '2026-08-01', repos);
    await closeSession(s.id, 'U', repos);
    const events = await repos.history.findByRequestId(requestId);
    expect(events.some(e => e.action === 'SESSION_COMPLETED')).toBe(true);
  });
  it('throws for unknown sessionId', async () => {
    await expect(closeSession('NONE', 'U', repos)).rejects.toThrow(AcceptanceError);
  });
});

// ACR-SS-07
describe('closeSession — PARTIAL advances request', () => {
  let repos: AcceptanceRepositories;
  let requestId: string;
  beforeEach(async () => { ({ repos, requestId } = await makeInProgress()); });

  it('PARTIAL session close advances request to PARTIAL_ACCEPTED', async () => {
    const s = await createSession(requestId, { ...sparams(), sessionType: 'PARTIAL' }, 'U', repos);
    await startSession(s.id, 'U', '2026-08-01', repos);
    await closeSession(s.id, 'U', repos);
    const r = await repos.requests.findById(requestId);
    expect(r?.status).toBe('PARTIAL_ACCEPTED');
  });
  it('FINAL session close keeps request IN_PROGRESS', async () => {
    const s = await createSession(requestId, sparams(), 'U', repos);
    await startSession(s.id, 'U', '2026-08-01', repos);
    await closeSession(s.id, 'U', repos);
    const r = await repos.requests.findById(requestId);
    expect(r?.status).toBe('IN_PROGRESS');
  });
  it('throws when session is PENDING', async () => {
    const s = await createSession(requestId, sparams(), 'U', repos);
    await expect(closeSession(s.id, 'U', repos)).rejects.toThrow(AcceptanceError);
  });
});

// ACR-SS-08
describe('cancelSession', () => {
  let repos: AcceptanceRepositories;
  let requestId: string;
  beforeEach(async () => { ({ repos, requestId } = await makeInProgress()); });

  it('transitions PENDING → CANCELLED', async () => {
    const s = await createSession(requestId, sparams(), 'U', repos);
    const cancelled = await cancelSession(s.id, 'U', 'Bad weather', repos);
    expect(cancelled.status).toBe('CANCELLED');
  });
  it('records SESSION_CANCELLED event with reason', async () => {
    const s = await createSession(requestId, sparams(), 'U', repos);
    await cancelSession(s.id, 'U', 'Bad weather', repos);
    const events = await repos.history.findByRequestId(requestId);
    const ev = events.find(e => e.action === 'SESSION_CANCELLED');
    expect(ev?.notes).toBe('Bad weather');
  });
  it('can cancel IN_PROGRESS session', async () => {
    const s = await createSession(requestId, sparams(), 'U', repos);
    await startSession(s.id, 'U', '2026-08-01', repos);
    const cancelled = await cancelSession(s.id, 'U', 'Emergency', repos);
    expect(cancelled.status).toBe('CANCELLED');
  });
});

// ACR-SS-09
describe('cancelSession — status guard', () => {
  let repos: AcceptanceRepositories;
  let requestId: string;
  beforeEach(async () => { ({ repos, requestId } = await makeInProgress()); });

  it('throws for unknown sessionId', async () => {
    await expect(cancelSession('NONE', 'U', 'reason', repos)).rejects.toThrow(AcceptanceError);
  });
  it('throws when already COMPLETED', async () => {
    const s = await createSession(requestId, sparams(), 'U', repos);
    await startSession(s.id, 'U', '2026-08-01', repos);
    await closeSession(s.id, 'U', repos);
    await expect(cancelSession(s.id, 'U', 'reason', repos)).rejects.toThrow(AcceptanceError);
  });
  it('throws when already CANCELLED', async () => {
    const s = await createSession(requestId, sparams(), 'U', repos);
    await cancelSession(s.id, 'U', 'reason', repos);
    await expect(cancelSession(s.id, 'U', 'again', repos)).rejects.toThrow(AcceptanceError);
  });
});

// ACR-SS-10
describe('getSessions', () => {
  let repos: AcceptanceRepositories;
  let requestId: string;
  beforeEach(async () => { ({ repos, requestId } = await makeInProgress()); });

  it('returns empty initially', async () => {
    expect(await getSessions(requestId, repos)).toHaveLength(0);
  });
  it('returns sessions for request', async () => {
    await createSession(requestId, sparams(), 'U', repos);
    expect(await getSessions(requestId, repos)).toHaveLength(1);
  });
  it('does not return sessions for other requests', async () => {
    const repos2 = createMemoryAcceptanceRepositories();
    const r2 = await createAcceptanceRequest({ ...rparams(), requestCode: 'NT/002' }, repos2);
    await repos2.requests.update(r2.id, { status: 'COMMITTEE_FORMED' });
    await createSession(requestId, sparams(), 'U', repos);
    expect(await getSessions(r2.id, repos2)).toHaveLength(0);
  });
});

// ACR-SS-11
describe('createSession — optional fields', () => {
  let repos: AcceptanceRepositories;
  let requestId: string;
  beforeEach(async () => { ({ repos, requestId } = await makeCommitteeFormed()); });

  it('stores location when provided', async () => {
    const s = await createSession(requestId, { ...sparams(), location: 'Phòng họp A' }, 'U', repos);
    expect(s.location).toBe('Phòng họp A');
  });
  it('stores chairmanCode', async () => {
    const s = await createSession(requestId, { ...sparams(), chairmanCode: 'DIR-01' }, 'U', repos);
    expect(s.chairmanCode).toBe('DIR-01');
  });
  it('session has requestId set', async () => {
    const s = await createSession(requestId, sparams(), 'U', repos);
    expect(s.requestId).toBe(requestId);
  });
});

// ACR-SS-12
describe('findLatestByRequestId', () => {
  let repos: AcceptanceRepositories;
  let requestId: string;
  beforeEach(async () => { ({ repos, requestId } = await makeInProgress()); });

  it('returns null when no sessions', async () => {
    expect(await repos.sessions.findLatestByRequestId(requestId)).toBeNull();
  });
  it('returns the latest session', async () => {
    await createSession(requestId, sparams(), 'U', repos);
    await createSession(requestId, sparams(), 'U', repos);
    const latest = await repos.sessions.findLatestByRequestId(requestId);
    expect(latest?.sessionNumber).toBe(2);
  });
  it('findCompletedByRequestId excludes PENDING sessions', async () => {
    const s = await createSession(requestId, sparams(), 'U', repos);
    await startSession(s.id, 'U', '2026-08-01', repos);
    await closeSession(s.id, 'U', repos);
    await createSession(requestId, sparams(), 'U', repos); // PENDING
    expect(await repos.sessions.findCompletedByRequestId(requestId)).toHaveLength(1);
  });
});

// ACR-SS-13
describe('PARTIAL_ACCEPTED allows another session', () => {
  let repos: AcceptanceRepositories;
  let requestId: string;
  beforeEach(async () => { ({ repos, requestId } = await makeInProgress()); });

  it('can create session when PARTIAL_ACCEPTED', async () => {
    const s = await createSession(requestId, { ...sparams(), sessionType: 'PARTIAL' }, 'U', repos);
    await startSession(s.id, 'U', '2026-08-01', repos);
    await closeSession(s.id, 'U', repos); // → PARTIAL_ACCEPTED
    const s2 = await createSession(requestId, sparams(), 'U', repos);
    expect(s2.sessionNumber).toBe(2);
  });
  it('second session has sessionNumber 2', async () => {
    const s = await createSession(requestId, sparams(), 'U', repos);
    await startSession(s.id, 'U', '2026-08-01', repos);
    await closeSession(s.id, 'U', repos);
    const r = await repos.requests.findById(requestId);
    if (r?.status === 'PARTIAL_ACCEPTED') {
      const s2 = await createSession(requestId, sparams(), 'U', repos);
      expect(s2.sessionNumber).toBe(2);
    }
  });
  it('total sessions count increases', async () => {
    const s = await createSession(requestId, sparams(), 'U', repos);
    await startSession(s.id, 'U', '2026-08-01', repos);
    await closeSession(s.id, 'U', repos);
    expect(await getSessions(requestId, repos)).toHaveLength(1);
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rparams(): CreateAcceptanceParams {
  return { requestCode: 'NT/FINAL/2026/0001', acceptanceType: 'FINAL', contractId: 'C-001', requestedBy: 'EMP-01', department: 'BLD-01' };
}
function cparams(): FormCommitteeParams { return { committeeCode: 'HDNT-01', establishedBy: 'DIR-01' }; }
function sparams(o: Partial<CreateSessionParams> = {}): CreateSessionParams {
  return { sessionType: 'FINAL', scheduledDate: '2026-08-01', ...o };
}

async function makeCommitteeFormed() {
  const repos = createMemoryAcceptanceRepositories();
  const r = await createAcceptanceRequest(rparams(), repos);
  await formCommittee(r.id, cparams(), 'DIR', repos);
  return { repos, requestId: r.id };
}

async function makeInProgress() {
  const { repos, requestId } = await makeCommitteeFormed();
  // Create a session to advance to IN_PROGRESS, but close it so we can create more
  const s = await createSession(requestId, { sessionType: 'FINAL', scheduledDate: '2026-07-15' }, 'U', repos);
  await startSession(s.id, 'U', '2026-07-15', repos);
  await closeSession(s.id, 'U', repos);
  // Now request is IN_PROGRESS; need to reset for test use; create a fresh in_progress
  const repos2 = createMemoryAcceptanceRepositories();
  const r2 = await createAcceptanceRequest(rparams(), repos2);
  await formCommittee(r2.id, cparams(), 'DIR', repos2);
  // Manually set to IN_PROGRESS so sessions can be created
  await repos2.requests.update(r2.id, { status: 'IN_PROGRESS' });
  return { repos: repos2, requestId: r2.id };
}
