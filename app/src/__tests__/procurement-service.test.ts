/**
 * Phase 13 — ProcurementService tests
 *
 * Groups (13 × 3 = 39):
 *   PS-01  (3)  startProcurement — happy path (no configs = no hard gate)
 *   PS-02  (3)  startProcurement — authority check blocks (REJECTED)
 *   PS-03  (3)  startProcurement — threshold exceeded elevates to REQUIRES_REVIEW
 *   PS-04  (3)  startProcurement — unknown definition returns FAILED
 *   PS-05  (3)  startProcurement — result.data is WorkflowInstance
 *   PS-06  (3)  reviewProcurement — advances workflow state
 *   PS-07  (3)  reviewProcurement — unknown trigger returns FAILED
 *   PS-08  (3)  reviewProcurement — result.workflowState matches new state
 *   PS-09  (3)  getProcurementStatus — returns current state
 *   PS-10  (3)  getProcurementStatus — returns pending approvals for APPROVAL state
 *   PS-11  (3)  getProcurementStatus — unknown instance returns FAILED
 *   PS-12  (3)  result shape — auditTrail and metadata populated
 *   PS-13  (3)  buildProcurementService factory
 */

import { describe, it, expect } from 'vitest';
import { createConfig }            from '../legal/governanceConfig';
import { createInMemoryRepository } from '../legal/configRepository';
import { buildConfigResolver }     from '../legal/configResolver';
import { buildGovernanceRuleEngine } from '../legal/governanceRuleEngine';
import { createGovernanceEventBus } from '../legal/governanceEvents';
import { buildWorkflowOrchestrator } from '../legal/workflowOrchestrator';
import type { WorkflowDefinition }  from '../legal/workflowOrchestrator';
import type { GovernanceConfig }    from '../legal/governanceConfig';
import {
  buildProcurementService, ProcurementService,
} from '../application/procurementService';
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

const THRESH_100M = createConfig({
  id: 'thresh-100m', type: 'PROCUREMENT_THRESHOLD', version: '1.0.0',
  effectiveDate: '2024-01-01', source: 'nd-214-2025',
  status: 'ACTIVE', priority: 1, confidence: 1.0, tags: ['threshold'],
  metadata: { maxAmount: '100000000' },
});

// ─── Workflow definition fixtures ─────────────────────────────────────────────

const SIMPLE_DEF: WorkflowDefinition = {
  id: 'procurement-v1',
  name: 'Procurement Workflow',
  initialState: 'DRAFT',
  states: [
    { id: 'DRAFT',    name: 'Draft',    type: 'INITIAL' },
    { id: 'APPROVED', name: 'Approved', type: 'FINAL' },
  ],
  transitions: [
    { id: 't-approve', from: 'DRAFT', to: 'APPROVED', trigger: 'approve' },
  ],
};

const APPROVAL_DEF: WorkflowDefinition = {
  id: 'procurement-approval',
  name: 'Approval Workflow',
  initialState: 'DRAFT',
  states: [
    { id: 'DRAFT',  name: 'Draft',  type: 'INITIAL' },
    { id: 'REVIEW', name: 'Review', type: 'APPROVAL',
      approvalStep: { id: 'as-001', role: 'UNIT_HEAD', requiredCount: 1 } },
    { id: 'DONE',   name: 'Done',   type: 'FINAL' },
  ],
  transitions: [
    { id: 't-submit', from: 'DRAFT',  to: 'REVIEW', trigger: 'submit' },
    { id: 't-approve', from: 'REVIEW', to: 'DONE',  trigger: 'approve' },
  ],
};

// ─── Setup helpers ────────────────────────────────────────────────────────────

function makeService(configs: GovernanceConfig[] = []) {
  const repo        = createInMemoryRepository(configs);
  const resolver    = buildConfigResolver(repo);
  const ruleEngine  = buildGovernanceRuleEngine(resolver);
  const eventBus    = createGovernanceEventBus();
  const orchestrator = buildWorkflowOrchestrator(ruleEngine, eventBus);
  const service     = buildProcurementService(ruleEngine, orchestrator);
  return { service, orchestrator };
}

function makeCtx(overrides: Partial<Parameters<typeof generateGovernanceContext>[0]> = {}): GovernanceContext {
  return generateGovernanceContext({
    currentDate: DATE, actor: ACTOR, requestId: 'req-001', ...overrides,
  });
}

// ─── PS-01: startProcurement — happy path ─────────────────────────────────────

describe('PS-01 startProcurement happy path', () => {
  const { service, orchestrator } = makeService();
  orchestrator.createWorkflow(SIMPLE_DEF);
  const ctx    = makeCtx();
  const result = service.startProcurement('procurement-v1', 'inst-001', ctx);

  it('status is SUCCESS', () => {
    expect(result.status).toBe('SUCCESS');
  });
  it('workflowState is DRAFT', () => {
    expect(result.workflowState).toBe('DRAFT');
  });
  it('messages include instance id', () => {
    expect(result.messages[0]).toContain('inst-001');
  });
});

// ─── PS-02: startProcurement — authority check blocks ─────────────────────────

describe('PS-02 startProcurement authority REJECTED', () => {
  const { service, orchestrator } = makeService([AUTH_UNIT]);
  orchestrator.createWorkflow(SIMPLE_DEF);
  // Amount 200M > UNIT_HEAD max 50M → REJECTED
  const ctx    = makeCtx({ packageValue: 200_000_000 });
  const result = service.startProcurement('procurement-v1', 'inst-auth', ctx);

  it('status is FAILED', () => {
    expect(result.status).toBe('FAILED');
  });
  it('errors mention authority check', () => {
    expect(result.errors[0]).toContain('Authority check failed');
  });
  it('no workflowState (workflow was not started)', () => {
    expect(result.workflowState).toBeUndefined();
  });
});

// ─── PS-03: startProcurement — threshold exceeded → REQUIRES_REVIEW ───────────

describe('PS-03 startProcurement threshold REQUIRES_REVIEW', () => {
  // Auth: no config → INSUFFICIENT_DATA (not REJECTED, so authority passes)
  // Threshold: 100M max → 200M exceeds it → REQUIRES_REVIEW
  const { service, orchestrator } = makeService([THRESH_100M]);
  orchestrator.createWorkflow(SIMPLE_DEF);
  const ctx    = makeCtx({ packageValue: 200_000_000 });
  const result = service.startProcurement('procurement-v1', 'inst-thresh', ctx);

  it('status is REQUIRES_REVIEW', () => {
    expect(result.status).toBe('REQUIRES_REVIEW');
  });
  it('warnings mention threshold', () => {
    expect(result.warnings[0]).toContain('Threshold exceeded');
  });
  it('workflowState is DRAFT (workflow still started)', () => {
    expect(result.workflowState).toBe('DRAFT');
  });
});

// ─── PS-04: startProcurement — unknown definition ─────────────────────────────

describe('PS-04 startProcurement unknown definition', () => {
  const { service } = makeService();
  const ctx    = makeCtx();
  const result = service.startProcurement('no-such-def', 'inst-x', ctx);

  it('status is FAILED', () => {
    expect(result.status).toBe('FAILED');
  });
  it('errors array is non-empty', () => {
    expect(result.errors.length).toBeGreaterThan(0);
  });
  it('workflowState is absent', () => {
    expect(result.workflowState).toBeUndefined();
  });
});

// ─── PS-05: startProcurement — result.data is WorkflowInstance ───────────────

describe('PS-05 startProcurement result.data', () => {
  const { service, orchestrator } = makeService();
  orchestrator.createWorkflow(SIMPLE_DEF);
  const ctx    = makeCtx();
  const result = service.startProcurement('procurement-v1', 'inst-data', ctx);

  it('result.data is defined', () => {
    expect(result.data).toBeDefined();
  });
  it('result.data.id matches instanceId', () => {
    expect(result.data?.id).toBe('inst-data');
  });
  it('result.data.currentState is DRAFT', () => {
    expect(result.data?.currentState).toBe('DRAFT');
  });
});

// ─── PS-06: reviewProcurement — advances workflow ─────────────────────────────

describe('PS-06 reviewProcurement advances state', () => {
  const { service, orchestrator } = makeService();
  orchestrator.createWorkflow(SIMPLE_DEF);
  const ctx = makeCtx();
  service.startProcurement('procurement-v1', 'inst-rev', ctx);
  const result = service.reviewProcurement('inst-rev', 'approve', ctx);

  it('status is SUCCESS', () => {
    expect(result.status).toBe('SUCCESS');
  });
  it('workflowState is APPROVED', () => {
    expect(result.workflowState).toBe('APPROVED');
  });
  it('result.data.currentState is APPROVED', () => {
    expect(result.data?.currentState).toBe('APPROVED');
  });
});

// ─── PS-07: reviewProcurement — unknown trigger ───────────────────────────────

describe('PS-07 reviewProcurement unknown trigger', () => {
  const { service, orchestrator } = makeService();
  orchestrator.createWorkflow(SIMPLE_DEF);
  const ctx = makeCtx();
  service.startProcurement('procurement-v1', 'inst-trig', ctx);
  const result = service.reviewProcurement('inst-trig', 'no-such-trigger', ctx);

  it('status is FAILED', () => {
    expect(result.status).toBe('FAILED');
  });
  it('errors array is non-empty', () => {
    expect(result.errors.length).toBeGreaterThan(0);
  });
  it('workflowState is absent on failure', () => {
    expect(result.workflowState).toBeUndefined();
  });
});

// ─── PS-08: reviewProcurement — result.workflowState ─────────────────────────

describe('PS-08 reviewProcurement workflowState', () => {
  const { service, orchestrator } = makeService();
  orchestrator.createWorkflow(APPROVAL_DEF);
  const ctx = makeCtx();
  service.startProcurement('procurement-approval', 'inst-wfs', ctx);
  const result = service.reviewProcurement('inst-wfs', 'submit', ctx);

  it('status is SUCCESS', () => {
    expect(result.status).toBe('SUCCESS');
  });
  it('workflowState is REVIEW', () => {
    expect(result.workflowState).toBe('REVIEW');
  });
  it('data.currentState is REVIEW', () => {
    expect(result.data?.currentState).toBe('REVIEW');
  });
});

// ─── PS-09: getProcurementStatus — current state ─────────────────────────────

describe('PS-09 getProcurementStatus current state', () => {
  const { service, orchestrator } = makeService();
  orchestrator.createWorkflow(SIMPLE_DEF);
  const ctx = makeCtx();
  service.startProcurement('procurement-v1', 'inst-stat', ctx);
  const result = service.getProcurementStatus('inst-stat', ctx);

  it('status is SUCCESS', () => {
    expect(result.status).toBe('SUCCESS');
  });
  it('data.state is DRAFT', () => {
    expect(result.data?.state).toBe('DRAFT');
  });
  it('workflowState is DRAFT', () => {
    expect(result.workflowState).toBe('DRAFT');
  });
});

// ─── PS-10: getProcurementStatus — pending approvals ─────────────────────────

describe('PS-10 getProcurementStatus pending approvals', () => {
  const { service, orchestrator } = makeService();
  orchestrator.createWorkflow(APPROVAL_DEF);
  const ctx = makeCtx();
  service.startProcurement('procurement-approval', 'inst-pend', ctx);
  service.reviewProcurement('inst-pend', 'submit', ctx);
  const result = service.getProcurementStatus('inst-pend', ctx);

  it('state is REVIEW', () => {
    expect(result.data?.state).toBe('REVIEW');
  });
  it('pendingApprovals has one step', () => {
    expect(result.data?.pendingApprovals).toHaveLength(1);
  });
  it('pending approval role is UNIT_HEAD', () => {
    expect(result.data?.pendingApprovals[0]?.role).toBe('UNIT_HEAD');
  });
});

// ─── PS-11: getProcurementStatus — unknown instance ──────────────────────────

describe('PS-11 getProcurementStatus unknown instance', () => {
  const { service } = makeService();
  const ctx    = makeCtx();
  const result = service.getProcurementStatus('ghost-instance', ctx);

  it('status is FAILED', () => {
    expect(result.status).toBe('FAILED');
  });
  it('errors mention instance id', () => {
    expect(result.errors[0]).toContain('ghost-instance');
  });
  it('data is undefined', () => {
    expect(result.data).toBeUndefined();
  });
});

// ─── PS-12: result shape — auditTrail and metadata ───────────────────────────

describe('PS-12 result shape auditTrail and metadata', () => {
  const { service, orchestrator } = makeService();
  orchestrator.createWorkflow(SIMPLE_DEF);
  const ctx    = makeCtx();
  const result = service.startProcurement('procurement-v1', 'inst-audit', ctx);

  it('auditTrail has at least one entry', () => {
    expect(result.auditTrail.length).toBeGreaterThan(0);
  });
  it('auditTrail entry action is startProcurement', () => {
    expect(result.auditTrail[0]?.action).toBe('startProcurement');
  });
  it('metadata contains instanceId', () => {
    expect(result.metadata['instanceId']).toBe('inst-audit');
  });
});

// ─── PS-13: buildProcurementService factory ───────────────────────────────────

describe('PS-13 buildProcurementService factory', () => {
  it('returns a ProcurementService instance', () => {
    const { service } = makeService();
    expect(service).toBeInstanceOf(ProcurementService);
  });
  it('service has startProcurement method', () => {
    const { service } = makeService();
    expect(typeof service.startProcurement).toBe('function');
  });
  it('service has reviewProcurement method', () => {
    const { service } = makeService();
    expect(typeof service.reviewProcurement).toBe('function');
  });
});
