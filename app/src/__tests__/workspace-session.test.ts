/**
 * Phase 21 — Workspace & Session Layer: Session Manager tests
 *
 * Groups (13 × 3 = 39):
 *   WS-01  (3)  buildWorkspaceSessionManager — factory shape
 *   WS-02  (3)  createSession — adds session to workspace; status is ACTIVE
 *   WS-03  (3)  createSession — multiple sessions coexist
 *   WS-04  (3)  closeSession — session status becomes CLOSED; closedAt is set
 *   WS-05  (3)  activateCase — sets activeCase on session
 *   WS-06  (3)  cacheDecision — stored in session memory
 *   WS-07  (3)  getCachedDecision — retrieves cached decision; undefined if absent
 *   WS-08  (3)  addTask — appears in workspace tasks
 *   WS-09  (3)  addDocument — appears in workspace documents
 *   WS-10  (3)  requestApproval — appears in workspace approvals as PENDING
 *   WS-11  (3)  resolveApproval — status updated to APPROVED or REJECTED
 *   WS-12  (3)  addEvent — appears in workspace timeline
 *   WS-13  (3)  getWorkspace — reflects all mutations as frozen snapshot
 */

import { describe, it, expect } from 'vitest';
import { generateGovernanceContext } from '../application/governanceContext';
import {
  createCase,
  createCaseMetadata,
  createCaseTimeline,
} from '../cases/caseModel';
import {
  createWorkspaceTask,
  createWorkspaceDocument,
  createWorkspaceApproval,
  createWorkspaceEvent,
} from '../workspace/workspaceTypes';
import {
  WorkspaceSessionManager,
  buildWorkspaceSessionManager,
} from '../workspace/workspaceSession';

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const ACTOR      = { id: 'u-ws', role: 'UNIT_HEAD' };
const DIRECTOR   = { id: 'u-dir', role: 'DIRECTOR' };

const CTX = generateGovernanceContext({
  actor:       ACTOR,
  currentDate: '2024-06-01',
  requestId:   'req-ws-001',
  packageValue: 100_000_000,
});

const CASE = createCase({
  id:       'case-ws-001',
  title:    'Session Test Case',
  context:  CTX,
  metadata: createCaseMetadata({ domain: 'PROCUREMENT', category: 'GOODS' }),
  timeline: createCaseTimeline({ createdAt: '2024-06-01T08:00:00Z', updatedAt: '2024-06-01T08:00:00Z' }),
});

function makeManager(): WorkspaceSessionManager {
  return buildWorkspaceSessionManager('Test Workspace', 'ws-test-001');
}

// ─── WS-01: buildWorkspaceSessionManager ─────────────────────────────────────

describe('WS-01 buildWorkspaceSessionManager factory shape', () => {
  it('returns a WorkspaceSessionManager instance', () => {
    expect(makeManager()).toBeInstanceOf(WorkspaceSessionManager);
  });
  it('getWorkspace returns a workspace with the correct name', () => {
    expect(makeManager().getWorkspace().name).toBe('Test Workspace');
  });
  it('initial workspace has no sessions, tasks, or documents', () => {
    const ws = makeManager().getWorkspace();
    expect(ws.sessions).toHaveLength(0);
    expect(ws.tasks).toHaveLength(0);
    expect(ws.documents).toHaveLength(0);
  });
});

// ─── WS-02: createSession — adds to workspace ────────────────────────────────

describe('WS-02 createSession adds session to workspace; status is ACTIVE', () => {
  it('workspace has one session after createSession', () => {
    const mgr = makeManager();
    mgr.createSession(ACTOR, 'sess-001');
    expect(mgr.getWorkspace().sessions).toHaveLength(1);
  });
  it('session status is ACTIVE', () => {
    const mgr = makeManager();
    const s   = mgr.createSession(ACTOR, 'sess-001');
    expect(s.status).toBe('ACTIVE');
  });
  it('session actor matches provided actor', () => {
    const mgr = makeManager();
    const s   = mgr.createSession(ACTOR, 'sess-001');
    expect(s.actor.id).toBe('u-ws');
  });
});

// ─── WS-03: createSession — multiple sessions ────────────────────────────────

describe('WS-03 createSession multiple sessions coexist', () => {
  it('two sessions in workspace after two createSession calls', () => {
    const mgr = makeManager();
    mgr.createSession(ACTOR, 'sess-001');
    mgr.createSession(DIRECTOR, 'sess-002');
    expect(mgr.getWorkspace().sessions).toHaveLength(2);
  });
  it('each session has a distinct id', () => {
    const mgr = makeManager();
    mgr.createSession(ACTOR, 'sess-a');
    mgr.createSession(ACTOR, 'sess-b');
    const ids = mgr.getWorkspace().sessions.map(s => s.id);
    expect(new Set(ids).size).toBe(2);
  });
  it('getSession returns correct session by id', () => {
    const mgr = makeManager();
    mgr.createSession(ACTOR,    'sess-a');
    mgr.createSession(DIRECTOR, 'sess-b');
    expect(mgr.getSession('sess-b')?.actor.role).toBe('DIRECTOR');
  });
});

// ─── WS-04: closeSession ─────────────────────────────────────────────────────

describe('WS-04 closeSession status becomes CLOSED; closedAt is set', () => {
  it('session status is CLOSED after closeSession', () => {
    const mgr = makeManager();
    mgr.createSession(ACTOR, 'sess-001');
    mgr.closeSession('sess-001');
    expect(mgr.getSession('sess-001')?.status).toBe('CLOSED');
  });
  it('closedAt is set after closeSession', () => {
    const mgr = makeManager();
    mgr.createSession(ACTOR, 'sess-001');
    mgr.closeSession('sess-001');
    expect(mgr.getSession('sess-001')?.closedAt).toBeDefined();
  });
  it('closeSession on unknown id is a no-op (no throw)', () => {
    const mgr = makeManager();
    expect(() => mgr.closeSession('non-existent')).not.toThrow();
  });
});

// ─── WS-05: activateCase ─────────────────────────────────────────────────────

describe('WS-05 activateCase sets activeCase on session', () => {
  it('returns an ActiveCase with the correct capability', () => {
    const mgr = makeManager();
    mgr.createSession(ACTOR, 'sess-001');
    const active = mgr.activateCase('sess-001', CASE, 'PROCUREMENT');
    expect(active.capability).toBe('PROCUREMENT');
  });
  it('session activeCase is set after activateCase', () => {
    const mgr = makeManager();
    mgr.createSession(ACTOR, 'sess-001');
    mgr.activateCase('sess-001', CASE, 'PROCUREMENT');
    expect(mgr.getSession('sess-001')?.activeCase?.capability).toBe('PROCUREMENT');
  });
  it('getActiveCase returns the active case', () => {
    const mgr = makeManager();
    mgr.createSession(ACTOR, 'sess-001');
    mgr.activateCase('sess-001', CASE, 'ASSETS');
    expect(mgr.getActiveCase('sess-001')?.governanceCase.id).toBe('case-ws-001');
  });
});

// ─── WS-06: cacheDecision ────────────────────────────────────────────────────

describe('WS-06 cacheDecision stored in session memory', () => {
  // Build a minimal GovernanceDecision stub
  const DECISION_STUB = {
    context:              CTX,
    summary:              { verdict: 'PROCEED' as const, reason: 'ok', applicableLawCount: 0, complianceWarningCount: 0, riskLevel: 'NONE' as const, requiredActionCount: 0 },
    applicableLaws:       Object.freeze([]),
    applicableThresholds: Object.freeze([]),
    applicableWorkflows:  Object.freeze([]),
    authorityChain:       Object.freeze([]),
    requiredDocuments:    Object.freeze([]),
    complianceWarnings:   Object.freeze([]),
    riskAssessment:       { level: 'NONE' as const, score: 0, factors: Object.freeze([]), mitigations: Object.freeze([]) },
    confidence:           1.0,
    reasoningTrace:       Object.freeze([]),
    decidedAt:            '2024-06-01T08:00:00.000Z',
  };

  it('cacheDecision stores decision in session', () => {
    const mgr = makeManager();
    mgr.createSession(ACTOR, 'sess-001');
    mgr.cacheDecision('sess-001', 'case-ws-001', DECISION_STUB);
    const cached = mgr.getCachedDecision('sess-001', 'case-ws-001');
    expect(cached?.summary.verdict).toBe('PROCEED');
  });
  it('session memory.cachedDecisions contains the caseId key', () => {
    const mgr = makeManager();
    mgr.createSession(ACTOR, 'sess-001');
    mgr.cacheDecision('sess-001', 'case-ws-001', DECISION_STUB);
    const mem = mgr.getSession('sess-001')!.memory;
    expect(Object.keys(mem.cachedDecisions)).toContain('case-ws-001');
  });
  it('cacheDecision on unknown sessionId throws', () => {
    const mgr = makeManager();
    expect(() => mgr.cacheDecision('non-existent', 'c', DECISION_STUB)).toThrow();
  });
});

// ─── WS-07: getCachedDecision ────────────────────────────────────────────────

describe('WS-07 getCachedDecision retrieves; undefined if absent', () => {
  it('returns undefined before caching', () => {
    const mgr = makeManager();
    mgr.createSession(ACTOR, 'sess-001');
    expect(mgr.getCachedDecision('sess-001', 'case-ws-001')).toBeUndefined();
  });
  it('returns undefined for unknown sessionId', () => {
    expect(makeManager().getCachedDecision('non-existent', 'any-case')).toBeUndefined();
  });
  it('returns undefined for unknown caseId', () => {
    const mgr = makeManager();
    mgr.createSession(ACTOR, 'sess-001');
    expect(mgr.getCachedDecision('sess-001', 'unknown-case')).toBeUndefined();
  });
});

// ─── WS-08: addTask ──────────────────────────────────────────────────────────

describe('WS-08 addTask appears in workspace tasks', () => {
  const TASK = createWorkspaceTask({
    id: 'task-001', workspaceId: 'ws-test-001', title: 'Submit documents',
    assignedTo: 'u-ws', createdAt: '2024-06-01T08:00:00Z',
  });

  it('workspace has one task after addTask', () => {
    const mgr = makeManager();
    mgr.addTask(TASK);
    expect(mgr.getWorkspace().tasks).toHaveLength(1);
  });
  it('task title is preserved', () => {
    const mgr = makeManager();
    mgr.addTask(TASK);
    expect(mgr.getWorkspace().tasks[0]?.title).toBe('Submit documents');
  });
  it('tasks array is frozen', () => {
    const mgr = makeManager();
    mgr.addTask(TASK);
    expect(Object.isFrozen(mgr.getWorkspace().tasks)).toBe(true);
  });
});

// ─── WS-09: addDocument ──────────────────────────────────────────────────────

describe('WS-09 addDocument appears in workspace documents', () => {
  const DOC = createWorkspaceDocument({
    id: 'doc-001', workspaceId: 'ws-test-001', title: 'Contract Draft',
    type: 'CONTRACT', content: '...', generatedAt: '2024-06-01T09:00:00Z', generatedBy: 'LEGAL',
  });

  it('workspace has one document after addDocument', () => {
    const mgr = makeManager();
    mgr.addDocument(DOC);
    expect(mgr.getWorkspace().documents).toHaveLength(1);
  });
  it('document title is preserved', () => {
    const mgr = makeManager();
    mgr.addDocument(DOC);
    expect(mgr.getWorkspace().documents[0]?.title).toBe('Contract Draft');
  });
  it('documents array is frozen', () => {
    const mgr = makeManager();
    mgr.addDocument(DOC);
    expect(Object.isFrozen(mgr.getWorkspace().documents)).toBe(true);
  });
});

// ─── WS-10: requestApproval ──────────────────────────────────────────────────

describe('WS-10 requestApproval appears in workspace approvals as PENDING', () => {
  const APPROVAL = createWorkspaceApproval({
    id: 'appr-001', workspaceId: 'ws-test-001', caseId: 'case-ws-001',
    requestedBy: 'u-ws', requestedAt: '2024-06-01T10:00:00Z', approver: 'DIRECTOR',
  });

  it('workspace has one approval after requestApproval', () => {
    const mgr = makeManager();
    mgr.requestApproval(APPROVAL);
    expect(mgr.getWorkspace().approvals).toHaveLength(1);
  });
  it('approval status is PENDING', () => {
    const mgr = makeManager();
    mgr.requestApproval(APPROVAL);
    expect(mgr.getWorkspace().approvals[0]?.status).toBe('PENDING');
  });
  it('approver is preserved', () => {
    const mgr = makeManager();
    mgr.requestApproval(APPROVAL);
    expect(mgr.getWorkspace().approvals[0]?.approver).toBe('DIRECTOR');
  });
});

// ─── WS-11: resolveApproval ──────────────────────────────────────────────────

describe('WS-11 resolveApproval status updated to APPROVED or REJECTED', () => {
  const APPROVAL = createWorkspaceApproval({
    id: 'appr-002', workspaceId: 'ws-test-001', caseId: 'case-ws-001',
    requestedBy: 'u-ws', requestedAt: '2024-06-01T10:00:00Z', approver: 'DIRECTOR',
  });

  it('status is APPROVED after resolveApproval(APPROVED)', () => {
    const mgr = makeManager();
    mgr.requestApproval(APPROVAL);
    mgr.resolveApproval('appr-002', 'APPROVED', 'u-dir');
    expect(mgr.getWorkspace().approvals[0]?.status).toBe('APPROVED');
  });
  it('decidedAt is set after resolving', () => {
    const mgr = makeManager();
    mgr.requestApproval(APPROVAL);
    mgr.resolveApproval('appr-002', 'APPROVED', 'u-dir');
    expect(mgr.getWorkspace().approvals[0]?.decidedAt).toBeDefined();
  });
  it('resolveApproval on unknown id throws', () => {
    const mgr = makeManager();
    expect(() => mgr.resolveApproval('non-existent', 'APPROVED', 'u-dir')).toThrow();
  });
});

// ─── WS-12: addEvent ─────────────────────────────────────────────────────────

describe('WS-12 addEvent appears in workspace timeline', () => {
  const EVENT = createWorkspaceEvent({
    id: 'evt-001', workspaceId: 'ws-test-001', type: 'SESSION_CREATED',
    actor: 'u-ws', timestamp: '2024-06-01T08:00:00Z', payload: { sessionId: 'sess-001' },
  });

  it('timeline has one event after addEvent', () => {
    const mgr = makeManager();
    mgr.addEvent(EVENT);
    expect(mgr.getWorkspace().timeline.events).toHaveLength(1);
  });
  it('event type is SESSION_CREATED', () => {
    const mgr = makeManager();
    mgr.addEvent(EVENT);
    expect(mgr.getWorkspace().timeline.events[0]?.type).toBe('SESSION_CREATED');
  });
  it('timeline events array is frozen', () => {
    const mgr = makeManager();
    mgr.addEvent(EVENT);
    expect(Object.isFrozen(mgr.getWorkspace().timeline.events)).toBe(true);
  });
});

// ─── WS-13: getWorkspace — reflects all mutations ────────────────────────────

describe('WS-13 getWorkspace reflects all mutations as frozen snapshot', () => {
  it('full round-trip: session + task + approval visible in getWorkspace', () => {
    const mgr = makeManager();
    mgr.createSession(ACTOR, 'sess-001');
    mgr.addTask(createWorkspaceTask({
      id: 't-1', workspaceId: 'ws-test-001', title: 'T1', assignedTo: 'u-ws', createdAt: '2024-06-01T08:00:00Z',
    }));
    mgr.requestApproval(createWorkspaceApproval({
      id: 'a-1', workspaceId: 'ws-test-001', caseId: 'c-1',
      requestedBy: 'u-ws', requestedAt: '2024-06-01T08:00:00Z', approver: 'DIRECTOR',
    }));
    const ws = mgr.getWorkspace();
    expect(ws.sessions).toHaveLength(1);
    expect(ws.tasks).toHaveLength(1);
    expect(ws.approvals).toHaveLength(1);
  });
  it('each call to getWorkspace returns a fresh frozen snapshot', () => {
    const mgr = makeManager();
    const ws1 = mgr.getWorkspace();
    mgr.createSession(ACTOR, 'sess-001');
    const ws2 = mgr.getWorkspace();
    expect(ws1.sessions).toHaveLength(0);
    expect(ws2.sessions).toHaveLength(1);
  });
  it('workspace sessions array is frozen', () => {
    const mgr = makeManager();
    mgr.createSession(ACTOR, 'sess-001');
    expect(Object.isFrozen(mgr.getWorkspace().sessions)).toBe(true);
  });
});
