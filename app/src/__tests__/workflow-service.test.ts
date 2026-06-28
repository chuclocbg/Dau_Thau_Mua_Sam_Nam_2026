/**
 * Phase 13 — WorkflowService tests
 *
 * Groups (13 × 3 = 39):
 *   WS-01  (3)  startWorkflow — happy path
 *   WS-02  (3)  startWorkflow — unknown definition returns FAILED
 *   WS-03  (3)  startWorkflow — result.workflowState matches initial state
 *   WS-04  (3)  startWorkflow — result.data is WorkflowInstance
 *   WS-05  (3)  advanceWorkflow — advances state
 *   WS-06  (3)  advanceWorkflow — guard failure returns FAILED
 *   WS-07  (3)  advanceWorkflow — unknown trigger returns FAILED
 *   WS-08  (3)  advanceWorkflow — result.workflowState matches new state
 *   WS-09  (3)  getWorkflowHistory — returns history entries
 *   WS-10  (3)  getWorkflowHistory — unknown id returns empty SUCCESS
 *   WS-11  (3)  getWorkflowHistory — entries count grows with transitions
 *   WS-12  (3)  result shape — auditTrail and metadata
 *   WS-13  (3)  buildWorkflowService factory
 */

import { describe, it, expect } from 'vitest';
import { createConfig }             from '../legal/governanceConfig';
import { createInMemoryRepository } from '../legal/configRepository';
import { buildConfigResolver }      from '../legal/configResolver';
import { buildGovernanceRuleEngine } from '../legal/governanceRuleEngine';
import { createGovernanceEventBus } from '../legal/governanceEvents';
import { buildWorkflowOrchestrator } from '../legal/workflowOrchestrator';
import type { WorkflowDefinition }  from '../legal/workflowOrchestrator';
import type { GovernanceConfig }    from '../legal/governanceConfig';
import { buildWorkflowService, WorkflowService } from '../application/workflowService';
import { generateGovernanceContext } from '../application/governanceContext';
import type { GovernanceContext }   from '../application/governanceContext';

// ─── Test date ────────────────────────────────────────────────────────────────

const DATE  = '2024-06-01';
const ACTOR = { id: 'u-001', role: 'UNIT_HEAD', name: 'Test User' };

// ─── Config fixtures ──────────────────────────────────────────────────────────

const AUTH_UNIT = createConfig({
  id: 'auth-unit', type: 'AUTHORITY_MATRIX', version: '1.0.0',
  effectiveDate: '2024-01-01', source: 'qc-auth',
  status: 'ACTIVE', priority: 1, confidence: 1.0, tags: ['auth'],
  metadata: { role: 'UNIT_HEAD', maxAmount: '50000000' },
});

// ─── Workflow definitions ─────────────────────────────────────────────────────

const SIMPLE_DEF: WorkflowDefinition = {
  id: 'simple-wf',
  name: 'Simple Workflow',
  initialState: 'DRAFT',
  states: [
    { id: 'DRAFT', name: 'Draft', type: 'INITIAL' },
    { id: 'DONE',  name: 'Done',  type: 'FINAL' },
  ],
  transitions: [
    { id: 't-done', from: 'DRAFT', to: 'DONE', trigger: 'complete' },
  ],
};

const GUARDED_DEF: WorkflowDefinition = {
  id: 'guarded-wf',
  name: 'Guarded Workflow',
  initialState: 'DRAFT',
  states: [
    { id: 'DRAFT',    name: 'Draft',    type: 'INITIAL' },
    { id: 'APPROVED', name: 'Approved', type: 'FINAL' },
  ],
  transitions: [
    { id: 't-approve', from: 'DRAFT', to: 'APPROVED', trigger: 'approve',
      guards: [{ type: 'AUTHORITY_CHECK' }] },
  ],
};

const MULTI_DEF: WorkflowDefinition = {
  id: 'multi-wf',
  name: 'Multi-Step Workflow',
  initialState: 'DRAFT',
  states: [
    { id: 'DRAFT',    name: 'Draft',    type: 'INITIAL' },
    { id: 'REVIEW',   name: 'Review',   type: 'ACTION' },
    { id: 'APPROVED', name: 'Approved', type: 'FINAL' },
  ],
  transitions: [
    { id: 't-sub', from: 'DRAFT',  to: 'REVIEW',   trigger: 'submit' },
    { id: 't-app', from: 'REVIEW', to: 'APPROVED', trigger: 'approve' },
  ],
};

// ─── Setup helpers ────────────────────────────────────────────────────────────

function makeService(configs: GovernanceConfig[] = []) {
  const repo        = createInMemoryRepository(configs);
  const resolver    = buildConfigResolver(repo);
  const ruleEngine  = buildGovernanceRuleEngine(resolver);
  const eventBus    = createGovernanceEventBus();
  const orchestrator = buildWorkflowOrchestrator(ruleEngine, eventBus);
  const service     = buildWorkflowService(orchestrator);
  return { service, orchestrator };
}

function makeCtx(overrides: Partial<Parameters<typeof generateGovernanceContext>[0]> = {}): GovernanceContext {
  return generateGovernanceContext({
    currentDate: DATE, actor: ACTOR, requestId: 'req-001', ...overrides,
  });
}

// ─── WS-01: startWorkflow — happy path ───────────────────────────────────────

describe('WS-01 startWorkflow happy path', () => {
  const { service, orchestrator } = makeService();
  orchestrator.createWorkflow(SIMPLE_DEF);
  const ctx    = makeCtx();
  const result = service.startWorkflow('simple-wf', 'inst-001', ctx);

  it('status is SUCCESS', () => {
    expect(result.status).toBe('SUCCESS');
  });
  it('workflowState is DRAFT', () => {
    expect(result.workflowState).toBe('DRAFT');
  });
  it('messages contain instance id', () => {
    expect(result.messages[0]).toContain('inst-001');
  });
});

// ─── WS-02: startWorkflow — unknown definition ────────────────────────────────

describe('WS-02 startWorkflow unknown definition', () => {
  const { service } = makeService();
  const ctx    = makeCtx();
  const result = service.startWorkflow('no-such-def', 'inst-x', ctx);

  it('status is FAILED', () => {
    expect(result.status).toBe('FAILED');
  });
  it('errors array non-empty', () => {
    expect(result.errors.length).toBeGreaterThan(0);
  });
  it('workflowState is absent', () => {
    expect(result.workflowState).toBeUndefined();
  });
});

// ─── WS-03: startWorkflow — workflowState matches initial state ───────────────

describe('WS-03 startWorkflow workflowState initial', () => {
  const { service, orchestrator } = makeService();
  orchestrator.createWorkflow(MULTI_DEF);
  const ctx    = makeCtx();
  const result = service.startWorkflow('multi-wf', 'inst-m', ctx);

  it('workflowState is DRAFT (initialState)', () => {
    expect(result.workflowState).toBe('DRAFT');
  });
  it('status is SUCCESS', () => {
    expect(result.status).toBe('SUCCESS');
  });
  it('data.currentState matches workflowState', () => {
    expect(result.data?.currentState).toBe(result.workflowState);
  });
});

// ─── WS-04: startWorkflow — result.data is WorkflowInstance ──────────────────

describe('WS-04 startWorkflow result.data', () => {
  const { service, orchestrator } = makeService();
  orchestrator.createWorkflow(SIMPLE_DEF);
  const ctx    = makeCtx();
  const result = service.startWorkflow('simple-wf', 'inst-data', ctx);

  it('data is defined', () => {
    expect(result.data).toBeDefined();
  });
  it('data.id matches instanceId', () => {
    expect(result.data?.id).toBe('inst-data');
  });
  it('data.status is ACTIVE', () => {
    expect(result.data?.status).toBe('ACTIVE');
  });
});

// ─── WS-05: advanceWorkflow — advances state ─────────────────────────────────

describe('WS-05 advanceWorkflow advances state', () => {
  const { service, orchestrator } = makeService();
  orchestrator.createWorkflow(SIMPLE_DEF);
  const ctx = makeCtx();
  service.startWorkflow('simple-wf', 'inst-adv', ctx);
  const result = service.advanceWorkflow('inst-adv', 'complete', ctx);

  it('status is SUCCESS', () => {
    expect(result.status).toBe('SUCCESS');
  });
  it('workflowState is DONE', () => {
    expect(result.workflowState).toBe('DONE');
  });
  it('data.currentState is DONE', () => {
    expect(result.data?.currentState).toBe('DONE');
  });
});

// ─── WS-06: advanceWorkflow — guard failure ───────────────────────────────────

describe('WS-06 advanceWorkflow guard failure', () => {
  // AUTH_UNIT allows UNIT_HEAD up to 50M; packageValue=200M → REJECTED
  const { service, orchestrator } = makeService([AUTH_UNIT]);
  orchestrator.createWorkflow(GUARDED_DEF);
  const ctx = makeCtx({ packageValue: 200_000_000 });
  service.startWorkflow('guarded-wf', 'inst-guard', ctx);
  const result = service.advanceWorkflow('inst-guard', 'approve', ctx);

  it('status is FAILED', () => {
    expect(result.status).toBe('FAILED');
  });
  it('errors array is non-empty', () => {
    expect(result.errors.length).toBeGreaterThan(0);
  });
  it('workflowState is absent on guard failure', () => {
    expect(result.workflowState).toBeUndefined();
  });
});

// ─── WS-07: advanceWorkflow — unknown trigger ─────────────────────────────────

describe('WS-07 advanceWorkflow unknown trigger', () => {
  const { service, orchestrator } = makeService();
  orchestrator.createWorkflow(SIMPLE_DEF);
  const ctx = makeCtx();
  service.startWorkflow('simple-wf', 'inst-unk', ctx);
  const result = service.advanceWorkflow('inst-unk', 'no-such', ctx);

  it('status is FAILED', () => {
    expect(result.status).toBe('FAILED');
  });
  it('errors array non-empty', () => {
    expect(result.errors.length).toBeGreaterThan(0);
  });
  it('state unchanged (still DRAFT)', () => {
    const hist = service.getWorkflowHistory('inst-unk', ctx);
    const last = hist.data?.at(-1);
    expect(last?.toState).toBe('DRAFT');
  });
});

// ─── WS-08: advanceWorkflow — workflowState matches ──────────────────────────

describe('WS-08 advanceWorkflow workflowState matches', () => {
  const { service, orchestrator } = makeService();
  orchestrator.createWorkflow(MULTI_DEF);
  const ctx = makeCtx();
  service.startWorkflow('multi-wf', 'inst-ms', ctx);
  const r1 = service.advanceWorkflow('inst-ms', 'submit', ctx);

  it('workflowState is REVIEW after submit', () => {
    expect(r1.workflowState).toBe('REVIEW');
  });
  it('data.currentState matches workflowState', () => {
    expect(r1.data?.currentState).toBe(r1.workflowState);
  });
  it('second advance sets workflowState to APPROVED', () => {
    const r2 = service.advanceWorkflow('inst-ms', 'approve', ctx);
    expect(r2.workflowState).toBe('APPROVED');
  });
});

// ─── WS-09: getWorkflowHistory — returns entries ──────────────────────────────

describe('WS-09 getWorkflowHistory entries', () => {
  const { service, orchestrator } = makeService();
  orchestrator.createWorkflow(SIMPLE_DEF);
  const ctx = makeCtx();
  service.startWorkflow('simple-wf', 'inst-hist', ctx);
  const result = service.getWorkflowHistory('inst-hist', ctx);

  it('status is SUCCESS', () => {
    expect(result.status).toBe('SUCCESS');
  });
  it('data has at least one entry', () => {
    expect((result.data?.length ?? 0)).toBeGreaterThan(0);
  });
  it('first entry toState is DRAFT', () => {
    expect(result.data?.[0]?.toState).toBe('DRAFT');
  });
});

// ─── WS-10: getWorkflowHistory — unknown id ───────────────────────────────────

describe('WS-10 getWorkflowHistory unknown id', () => {
  const { service } = makeService();
  const ctx    = makeCtx();
  const result = service.getWorkflowHistory('ghost-id', ctx);

  it('status is SUCCESS', () => {
    expect(result.status).toBe('SUCCESS');
  });
  it('data is empty array', () => {
    expect(result.data).toHaveLength(0);
  });
  it('messages mention entry count', () => {
    expect(result.messages[0]).toContain('0');
  });
});

// ─── WS-11: getWorkflowHistory — count grows ──────────────────────────────────

describe('WS-11 getWorkflowHistory count grows', () => {
  const { service, orchestrator } = makeService();
  orchestrator.createWorkflow(MULTI_DEF);
  const ctx = makeCtx();
  service.startWorkflow('multi-wf', 'inst-cnt', ctx);
  const h1 = service.getWorkflowHistory('inst-cnt', ctx).data?.length ?? 0;
  service.advanceWorkflow('inst-cnt', 'submit', ctx);
  const h2 = service.getWorkflowHistory('inst-cnt', ctx).data?.length ?? 0;
  service.advanceWorkflow('inst-cnt', 'approve', ctx);
  const h3 = service.getWorkflowHistory('inst-cnt', ctx).data?.length ?? 0;

  it('after start: 1 entry', () => {
    expect(h1).toBe(1);
  });
  it('after submit: 2 entries', () => {
    expect(h2).toBe(2);
  });
  it('after approve: 3 entries', () => {
    expect(h3).toBe(3);
  });
});

// ─── WS-12: result shape — auditTrail and metadata ───────────────────────────

describe('WS-12 result shape auditTrail metadata', () => {
  const { service, orchestrator } = makeService();
  orchestrator.createWorkflow(SIMPLE_DEF);
  const ctx    = makeCtx();
  const result = service.startWorkflow('simple-wf', 'inst-shape', ctx);

  it('auditTrail has one entry', () => {
    expect(result.auditTrail).toHaveLength(1);
  });
  it('auditTrail action is startWorkflow', () => {
    expect(result.auditTrail[0]?.action).toBe('startWorkflow');
  });
  it('metadata contains instanceId', () => {
    expect(result.metadata['instanceId']).toBe('inst-shape');
  });
});

// ─── WS-13: buildWorkflowService factory ─────────────────────────────────────

describe('WS-13 buildWorkflowService factory', () => {
  it('returns a WorkflowService instance', () => {
    const { service } = makeService();
    expect(service).toBeInstanceOf(WorkflowService);
  });
  it('has startWorkflow method', () => {
    const { service } = makeService();
    expect(typeof service.startWorkflow).toBe('function');
  });
  it('has getWorkflowHistory method', () => {
    const { service } = makeService();
    expect(typeof service.getWorkflowHistory).toBe('function');
  });
});
