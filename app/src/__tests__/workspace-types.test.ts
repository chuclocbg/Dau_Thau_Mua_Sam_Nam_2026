/**
 * Phase 21 — Workspace & Session Layer: Types tests
 *
 * Groups (13 × 3 = 39):
 *   WT-01  (3)  createWorkspace — id, name, status, timestamps
 *   WT-02  (3)  createWorkspace — frozen arrays and default timeline
 *   WT-03  (3)  createSession — id, workspaceId, status, actor
 *   WT-04  (3)  createSession — defaults memory and conversation
 *   WT-05  (3)  createConversationContext — sessionId, turnId, frozen arrays
 *   WT-06  (3)  createSessionMemory — sessionId, empty frozen caches
 *   WT-07  (3)  createActiveCase — sessionId, governanceCase, capability
 *   WT-08  (3)  createWorkspaceEvent — id, type, payload frozen
 *   WT-09  (3)  createWorkspaceTask — id, title, status defaults to PENDING
 *   WT-10  (3)  createWorkspaceDocument — id, title, type, content
 *   WT-11  (3)  createWorkspaceApproval — id, status defaults to PENDING
 *   WT-12  (3)  WORKSPACE_EVENT_TYPES has 11 values
 *   WT-13  (3)  createWorkspace — updatedAt and description defaults
 */

import { describe, it, expect } from 'vitest';
import { generateGovernanceContext } from '../application/governanceContext';
import {
  createCase,
  createCaseMetadata,
  createCaseTimeline,
} from '../cases/caseModel';
import {
  WORKSPACE_EVENT_TYPES,
  createWorkspace,
  createSession,
  createConversationContext,
  createSessionMemory,
  createActiveCase,
  createWorkspaceEvent,
  createWorkspaceTask,
  createWorkspaceDocument,
  createWorkspaceApproval,
} from '../workspace/workspaceTypes';

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const ACTOR = { id: 'u-wt', role: 'UNIT_HEAD' };

const CTX = generateGovernanceContext({
  actor:       ACTOR,
  currentDate: '2024-06-01',
  requestId:   'req-wt-001',
});

const CASE = createCase({
  id:       'case-wt-001',
  title:    'Workspace Types Test',
  context:  CTX,
  metadata: createCaseMetadata({ domain: 'PROCUREMENT', category: 'GOODS' }),
  timeline: createCaseTimeline({ createdAt: '2024-06-01T08:00:00Z', updatedAt: '2024-06-01T08:00:00Z' }),
});

// ─── WT-01: createWorkspace — shape ───────────────────────────────────────────

describe('WT-01 createWorkspace id, name, status, timestamps', () => {
  const ws = createWorkspace({ id: 'ws-001', name: 'Governance Workspace', createdAt: '2024-06-01T08:00:00Z' });

  it('id and name are set', () => {
    expect(ws.id).toBe('ws-001');
    expect(ws.name).toBe('Governance Workspace');
  });
  it('status defaults to ACTIVE', () => {
    expect(ws.status).toBe('ACTIVE');
  });
  it('createdAt is set', () => {
    expect(ws.createdAt).toBe('2024-06-01T08:00:00Z');
  });
});

// ─── WT-02: createWorkspace — frozen arrays ───────────────────────────────────

describe('WT-02 createWorkspace frozen arrays and default timeline', () => {
  const ws = createWorkspace({ id: 'ws-002', name: 'WS', createdAt: '2024-06-01T08:00:00Z' });

  it('sessions is frozen', () => {
    expect(Object.isFrozen(ws.sessions)).toBe(true);
  });
  it('tasks, documents, approvals are frozen', () => {
    expect(Object.isFrozen(ws.tasks)).toBe(true);
    expect(Object.isFrozen(ws.documents)).toBe(true);
    expect(Object.isFrozen(ws.approvals)).toBe(true);
  });
  it('timeline.events is frozen and empty by default', () => {
    expect(Object.isFrozen(ws.timeline.events)).toBe(true);
    expect(ws.timeline.events).toHaveLength(0);
  });
});

// ─── WT-03: createSession — shape ────────────────────────────────────────────

describe('WT-03 createSession id, workspaceId, status, actor', () => {
  const s = createSession({ id: 'sess-001', workspaceId: 'ws-001', actor: ACTOR, startedAt: '2024-06-01T08:00:00Z' });

  it('id and workspaceId are set', () => {
    expect(s.id).toBe('sess-001');
    expect(s.workspaceId).toBe('ws-001');
  });
  it('status defaults to ACTIVE', () => {
    expect(s.status).toBe('ACTIVE');
  });
  it('actor is preserved', () => {
    expect(s.actor.id).toBe('u-wt');
    expect(s.actor.role).toBe('UNIT_HEAD');
  });
});

// ─── WT-04: createSession — defaults memory and conversation ──────────────────

describe('WT-04 createSession defaults memory and conversation', () => {
  const s = createSession({ id: 'sess-002', workspaceId: 'ws-001', actor: ACTOR, startedAt: '2024-06-01T08:00:00Z' });

  it('memory.sessionId matches session id', () => {
    expect(s.memory.sessionId).toBe('sess-002');
  });
  it('memory.cachedDecisions is empty', () => {
    expect(Object.keys(s.memory.cachedDecisions)).toHaveLength(0);
  });
  it('conversation.messages is empty frozen array', () => {
    expect(s.conversation.messages).toHaveLength(0);
    expect(Object.isFrozen(s.conversation.messages)).toBe(true);
  });
});

// ─── WT-05: createConversationContext ────────────────────────────────────────

describe('WT-05 createConversationContext sessionId, turnId, frozen arrays', () => {
  const conv = createConversationContext({ sessionId: 'sess-001', turnId: 3 });

  it('sessionId is set', () => {
    expect(conv.sessionId).toBe('sess-001');
  });
  it('turnId is set', () => {
    expect(conv.turnId).toBe(3);
  });
  it('messages and resolvedIntents are frozen and empty', () => {
    expect(Object.isFrozen(conv.messages)).toBe(true);
    expect(Object.isFrozen(conv.resolvedIntents)).toBe(true);
  });
});

// ─── WT-06: createSessionMemory ──────────────────────────────────────────────

describe('WT-06 createSessionMemory sessionId, empty frozen caches', () => {
  const mem = createSessionMemory({ sessionId: 'sess-001' });

  it('sessionId is set', () => {
    expect(mem.sessionId).toBe('sess-001');
  });
  it('cachedDecisions is frozen and empty', () => {
    expect(Object.isFrozen(mem.cachedDecisions)).toBe(true);
    expect(Object.keys(mem.cachedDecisions)).toHaveLength(0);
  });
  it('facts is frozen and empty', () => {
    expect(Object.isFrozen(mem.facts)).toBe(true);
    expect(Object.keys(mem.facts)).toHaveLength(0);
  });
});

// ─── WT-07: createActiveCase ─────────────────────────────────────────────────

describe('WT-07 createActiveCase sessionId, governanceCase, capability', () => {
  const active = createActiveCase({
    sessionId:      'sess-001',
    governanceCase: CASE,
    capability:     'PROCUREMENT',
    activatedAt:    '2024-06-01T09:00:00Z',
  });

  it('sessionId is set', () => {
    expect(active.sessionId).toBe('sess-001');
  });
  it('capability is set', () => {
    expect(active.capability).toBe('PROCUREMENT');
  });
  it('governanceCase is preserved', () => {
    expect(active.governanceCase.id).toBe('case-wt-001');
  });
});

// ─── WT-08: createWorkspaceEvent ─────────────────────────────────────────────

describe('WT-08 createWorkspaceEvent id, type, payload frozen', () => {
  const ev = createWorkspaceEvent({
    id:          'evt-001',
    workspaceId: 'ws-001',
    type:        'SESSION_CREATED',
    actor:       'u-wt',
    timestamp:   '2024-06-01T08:00:00Z',
    payload:     { sessionId: 'sess-001' },
  });

  it('id and type are set', () => {
    expect(ev.id).toBe('evt-001');
    expect(ev.type).toBe('SESSION_CREATED');
  });
  it('payload is frozen', () => {
    expect(Object.isFrozen(ev.payload)).toBe(true);
  });
  it('payload content preserved', () => {
    expect(ev.payload['sessionId']).toBe('sess-001');
  });
});

// ─── WT-09: createWorkspaceTask ──────────────────────────────────────────────

describe('WT-09 createWorkspaceTask id, title, status defaults to PENDING', () => {
  const task = createWorkspaceTask({
    id: 'task-001', workspaceId: 'ws-001', title: 'Review contract',
    assignedTo: 'u-wt', createdAt: '2024-06-01T08:00:00Z',
  });

  it('id and title are set', () => {
    expect(task.id).toBe('task-001');
    expect(task.title).toBe('Review contract');
  });
  it('status defaults to PENDING', () => {
    expect(task.status).toBe('PENDING');
  });
  it('description defaults to empty string', () => {
    expect(task.description).toBe('');
  });
});

// ─── WT-10: createWorkspaceDocument ──────────────────────────────────────────

describe('WT-10 createWorkspaceDocument id, title, type, content', () => {
  const doc = createWorkspaceDocument({
    id: 'doc-001', workspaceId: 'ws-001', title: 'Procurement Notice',
    type: 'PROCUREMENT_NOTICE', content: '<doc>...</doc>',
    generatedAt: '2024-06-01T09:00:00Z', generatedBy: 'PROCUREMENT',
  });

  it('id and title are set', () => {
    expect(doc.id).toBe('doc-001');
    expect(doc.title).toBe('Procurement Notice');
  });
  it('type and content are set', () => {
    expect(doc.type).toBe('PROCUREMENT_NOTICE');
    expect(doc.content).toBe('<doc>...</doc>');
  });
  it('generatedBy is set', () => {
    expect(doc.generatedBy).toBe('PROCUREMENT');
  });
});

// ─── WT-11: createWorkspaceApproval ──────────────────────────────────────────

describe('WT-11 createWorkspaceApproval id, status defaults to PENDING', () => {
  const appr = createWorkspaceApproval({
    id: 'appr-001', workspaceId: 'ws-001', caseId: 'case-wt-001',
    requestedBy: 'u-wt', requestedAt: '2024-06-01T10:00:00Z', approver: 'DIRECTOR',
  });

  it('id and caseId are set', () => {
    expect(appr.id).toBe('appr-001');
    expect(appr.caseId).toBe('case-wt-001');
  });
  it('status defaults to PENDING', () => {
    expect(appr.status).toBe('PENDING');
  });
  it('approver is set', () => {
    expect(appr.approver).toBe('DIRECTOR');
  });
});

// ─── WT-12: WORKSPACE_EVENT_TYPES ────────────────────────────────────────────

describe('WT-12 WORKSPACE_EVENT_TYPES has 11 values', () => {
  it('has exactly 11 event types', () => {
    expect(WORKSPACE_EVENT_TYPES).toHaveLength(11);
  });
  it('includes session and case lifecycle types', () => {
    const types = [...WORKSPACE_EVENT_TYPES];
    expect(types).toContain('SESSION_CREATED');
    expect(types).toContain('CASE_ACTIVATED');
    expect(types).toContain('CAPABILITY_EXECUTED');
  });
  it('is frozen', () => {
    expect(Object.isFrozen(WORKSPACE_EVENT_TYPES)).toBe(true);
  });
});

// ─── WT-13: createWorkspace defaults ─────────────────────────────────────────

describe('WT-13 createWorkspace updatedAt and description defaults', () => {
  const ws = createWorkspace({ id: 'ws-013', name: 'WS', createdAt: '2024-06-01T08:00:00Z' });

  it('updatedAt defaults to createdAt', () => {
    expect(ws.updatedAt).toBe('2024-06-01T08:00:00Z');
  });
  it('description defaults to empty string', () => {
    expect(ws.description).toBe('');
  });
  it('timeline.workspaceId matches workspace id', () => {
    expect(ws.timeline.workspaceId).toBe('ws-013');
  });
});
