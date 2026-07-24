/**
 * planningIntegration.ts — bridge to WorkflowEngine / MasterData / RuleEngine
 *
 * Groups (13 × 3 = 39):
 *   PLI-01  validatePlanAgainstMasterData() valid plan
 *   PLI-02  validatePlanAgainstMasterData() unknown department
 *   PLI-03  validatePlanAgainstMasterData() inactive fund source
 *   PLI-04  evaluatePlanWithRuleEngine() returns RequestDecision[]
 *   PLI-05  each decision has requestCode and decision shape
 *   PLI-06  decision has procurementMethod
 *   PLI-07  buildPlanWorkflow() creates workflow with plan
 *   PLI-08  buildPlanWorkflow() workflow has history entries
 *   PLI-09  generatePackageProposalFromRequests() groups by fundSource
 *   PLI-10  proposal has correct planId and requestIds
 *   PLI-11  proposal estimatedValue = sum of request costs in group
 *   PLI-12  buildPlanSummary() returns correct structure
 *   PLI-13  buildPlanSummary() generatedPackageCount reflects plan state
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  validatePlanAgainstMasterData, evaluatePlanWithRuleEngine,
  buildPlanWorkflow, generatePackageProposalFromRequests, buildPlanSummary,
} from '../procurement/planning/planningIntegration';
import { createMemoryPlanningRepositories } from '../procurement/planning/memoryPlanningRepositories';
import { createMemoryMasterDataRepositories, seedDefaultData } from '../masterdata/masterdataFactory';
import type { ProcurementPlan, ProcurementRequest } from '../procurement/planning/planningTypes';

function makePlan(o: Partial<ProcurementPlan> = {}): ProcurementPlan {
  return {
    id: 'plan-001', planNumber: 'DTMS/KH-DTMS/2026/001', fiscalYear: '2026',
    organization: 'DTMS', responsibleDepartment: 'PHONG-TC',
    estimatedTotal: 500_000_000, status: 'DRAFT',
    approvalHistory: [], requestIds: [], generatedPackageIds: [],
    createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', ...o,
  };
}

function makeRequest(o: Partial<ProcurementRequest> = {}): ProcurementRequest {
  return {
    id: 'req-001', requestCode: 'REQ-001', department: 'CNTT', requester: 'NV001',
    reason: 'Mua máy tính', needDescription: 'Laptop', needs: [],
    estimatedCost: 200_000_000, fundingSource: 'STATE', isUrgent: false,
    expectedTimeline: '2026-06-01', priority: 'MEDIUM', legalBasis: '',
    status: 'APPROVED', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', ...o,
  };
}

async function seedMaster() {
  const repos = createMemoryMasterDataRepositories();
  await seedDefaultData(repos);
  // Add dept that matches our test plan's responsibleDepartment
  await repos.departments.create({ code: 'PHONG-TC', name: 'Phòng Tài chính', isActive: true, isArchived: false, level: 1 });
  return repos;
}

// ─── PLI-01: validatePlanAgainstMasterData() valid plan ──────────────────────

describe('PLI-01 validatePlanAgainstMasterData() returns valid for known active data', () => {
  it('valid plan returns valid=true', async () => {
    const masterRepos = await seedMaster();
    const plan = makePlan({ responsibleDepartment: 'PHONG-TC' });
    const requests = [makeRequest({ fundingSource: 'STATE' })];
    const result = await validatePlanAgainstMasterData(plan, requests, masterRepos);
    expect(result.valid).toBe(true);
  });
  it('valid plan has no errors', async () => {
    const masterRepos = await seedMaster();
    const plan = makePlan({ responsibleDepartment: 'PHONG-TC' });
    const result = await validatePlanAgainstMasterData(plan, [makeRequest()], masterRepos);
    expect(result.errors).toHaveLength(0);
  });
  it('valid plan has no warnings', async () => {
    const masterRepos = await seedMaster();
    const plan = makePlan({ responsibleDepartment: 'PHONG-TC' });
    const result = await validatePlanAgainstMasterData(plan, [makeRequest()], masterRepos);
    expect(result.warnings).toHaveLength(0);
  });
});

// ─── PLI-02: validatePlanAgainstMasterData() unknown department ───────────────

describe('PLI-02 validatePlanAgainstMasterData() catches unknown department', () => {
  it('unknown dept returns valid=false', async () => {
    const masterRepos = await seedMaster();
    const plan = makePlan({ responsibleDepartment: 'UNKNOWN-DEPT' });
    const result = await validatePlanAgainstMasterData(plan, [makeRequest()], masterRepos);
    expect(result.valid).toBe(false);
  });
  it('error mentions department code', async () => {
    const masterRepos = await seedMaster();
    const plan = makePlan({ responsibleDepartment: 'BAD-DEPT' });
    const result = await validatePlanAgainstMasterData(plan, [makeRequest()], masterRepos);
    expect(result.errors.some(e => e.includes('BAD-DEPT'))).toBe(true);
  });
  it('archived department returns error', async () => {
    const masterRepos = await seedMaster();
    await masterRepos.departments.create({ code: 'ARCHIVED-DEPT', name: 'Archived', isActive: false, isArchived: true, level: 1 });
    const plan = makePlan({ responsibleDepartment: 'ARCHIVED-DEPT' });
    const result = await validatePlanAgainstMasterData(plan, [makeRequest()], masterRepos);
    expect(result.valid).toBe(false);
  });
});

// ─── PLI-03: validatePlanAgainstMasterData() inactive fund source ─────────────

describe('PLI-03 validatePlanAgainstMasterData() catches inactive fund source', () => {
  it('unknown fund source returns error', async () => {
    const masterRepos = await seedMaster();
    const plan = makePlan({ responsibleDepartment: 'PHONG-TC' });
    const requests = [makeRequest({ fundingSource: 'UNKNOWN-FS' })];
    const result = await validatePlanAgainstMasterData(plan, requests, masterRepos);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('UNKNOWN-FS'))).toBe(true);
  });
  it('inactive fund source returns error', async () => {
    const masterRepos = await seedMaster();
    await masterRepos.fundSources.create({ code: 'INACTIVE-FS', name: 'Inactive', type: 'STATE', isActive: false, isArchived: false });
    const plan = makePlan({ responsibleDepartment: 'PHONG-TC' });
    const requests = [makeRequest({ fundingSource: 'INACTIVE-FS' })];
    const result = await validatePlanAgainstMasterData(plan, requests, masterRepos);
    expect(result.valid).toBe(false);
  });
  it('multiple fund sources — all must be valid', async () => {
    const masterRepos = await seedMaster();
    const plan = makePlan({ responsibleDepartment: 'PHONG-TC' });
    const requests = [
      makeRequest({ id: 'r1', requestCode: 'A', fundingSource: 'STATE' }),
      makeRequest({ id: 'r2', requestCode: 'B', fundingSource: 'BAD-FS' }),
    ];
    const result = await validatePlanAgainstMasterData(plan, requests, masterRepos);
    expect(result.valid).toBe(false);
  });
});

// ─── PLI-04: evaluatePlanWithRuleEngine() ────────────────────────────────────

describe('PLI-04 evaluatePlanWithRuleEngine() returns array of RequestDecision', () => {
  it('returns one decision per request', () => {
    const requests = [makeRequest({ id: 'r1', requestCode: 'A' }), makeRequest({ id: 'r2', requestCode: 'B' })];
    const decisions = evaluatePlanWithRuleEngine(requests);
    expect(decisions).toHaveLength(2);
  });
  it('returns empty for empty requests', () => {
    expect(evaluatePlanWithRuleEngine([])).toHaveLength(0);
  });
  it('decision requestCode matches request', () => {
    const requests = [makeRequest({ requestCode: 'REQ-SPECIAL' })];
    const [d] = evaluatePlanWithRuleEngine(requests);
    expect(d?.requestCode).toBe('REQ-SPECIAL');
  });
});

// ─── PLI-05: decision shape ───────────────────────────────────────────────────

describe('PLI-05 each RequestDecision has requestCode and decision shape', () => {
  it('decision field is defined', () => {
    const [d] = evaluatePlanWithRuleEngine([makeRequest()]);
    expect(d?.decision).toBeDefined();
  });
  it('decision has method', () => {
    const [d] = evaluatePlanWithRuleEngine([makeRequest()]);
    expect(d?.decision.method).toBeDefined();
  });
  it('decision has approval authority', () => {
    const [d] = evaluatePlanWithRuleEngine([makeRequest()]);
    expect(d?.decision.approval).toBeDefined();
  });
});

// ─── PLI-06: decision procurementMethod ──────────────────────────────────────

describe('PLI-06 decision method is a valid procurement method', () => {
  it('large value decision method is a string', () => {
    const [d] = evaluatePlanWithRuleEngine([makeRequest({ estimatedCost: 5_000_000_000 })]);
    expect(d?.decision.method.method).toBeDefined();
    expect(typeof d?.decision.method.method).toBe('string');
  });
  it('small value returns a method', () => {
    const [d] = evaluatePlanWithRuleEngine([makeRequest({ estimatedCost: 50_000_000 })]);
    expect(d?.decision.method.method).toBeDefined();
  });
  it('urgent request returns a decision', () => {
    const [d] = evaluatePlanWithRuleEngine([makeRequest({ isUrgent: true })]);
    expect(d?.decision).toBeDefined();
  });
});

// ─── PLI-07: buildPlanWorkflow() creates workflow ────────────────────────────

describe('PLI-07 buildPlanWorkflow() creates workflow with plan', () => {
  it('returns plan and workflow', async () => {
    const masterRepos = await seedMaster();
    const plan = makePlan();
    const result = await buildPlanWorkflow(plan, masterRepos);
    expect(result.plan).toBe(plan);
    expect(result.workflow).toBeDefined();
  });
  it('workflow has context', async () => {
    const masterRepos = await seedMaster();
    const result = await buildPlanWorkflow(makePlan(), masterRepos);
    expect(result.workflow.context).toBeDefined();
  });
  it('workflow context has packageId = plan.id', async () => {
    const masterRepos = await seedMaster();
    const plan = makePlan({ id: 'test-plan-id' });
    const result = await buildPlanWorkflow(plan, masterRepos);
    expect(result.workflow.context.packageId).toBe('test-plan-id');
  });
});

// ─── PLI-08: buildPlanWorkflow() workflow history ─────────────────────────────

describe('PLI-08 buildPlanWorkflow() workflow has history', () => {
  it('workflow has history object', async () => {
    const masterRepos = await seedMaster();
    const result = await buildPlanWorkflow(makePlan(), masterRepos);
    expect(result.workflow.history).toBeDefined();
  });
  it('workflow history has entries array', async () => {
    const masterRepos = await seedMaster();
    const result = await buildPlanWorkflow(makePlan(), masterRepos);
    expect(Array.isArray(result.workflow.history.entries)).toBe(true);
  });
  it('workflow has at least one history entry', async () => {
    const masterRepos = await seedMaster();
    const result = await buildPlanWorkflow(makePlan(), masterRepos);
    expect(result.workflow.history.entries.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── PLI-09: generatePackageProposalFromRequests() grouping ──────────────────

describe('PLI-09 generatePackageProposalFromRequests() groups by fundSource', () => {
  let repos: ReturnType<typeof createMemoryPlanningRepositories>;

  beforeEach(() => { repos = createMemoryPlanningRepositories(); });

  it('same fund source creates one proposal', async () => {
    const requests = [
      makeRequest({ id: 'r1', requestCode: 'A', fundingSource: 'STATE' }),
      makeRequest({ id: 'r2', requestCode: 'B', fundingSource: 'STATE' }),
    ];
    const proposals = await generatePackageProposalFromRequests(requests, 'plan-001', repos);
    expect(proposals).toHaveLength(1);
  });
  it('different fund sources create separate proposals', async () => {
    const requests = [
      makeRequest({ id: 'r1', requestCode: 'A', fundingSource: 'STATE' }),
      makeRequest({ id: 'r2', requestCode: 'B', fundingSource: 'ODA' }),
    ];
    const proposals = await generatePackageProposalFromRequests(requests, 'plan-001', repos);
    expect(proposals).toHaveLength(2);
  });
  it('empty requests creates no proposals', async () => {
    const proposals = await generatePackageProposalFromRequests([], 'plan-001', repos);
    expect(proposals).toHaveLength(0);
  });
});

// ─── PLI-10: proposal has correct planId and requestIds ──────────────────────

describe('PLI-10 proposals have correct planId and requestIds', () => {
  let repos: ReturnType<typeof createMemoryPlanningRepositories>;

  beforeEach(() => { repos = createMemoryPlanningRepositories(); });

  it('proposal has planId', async () => {
    const requests = [makeRequest()];
    const [p] = await generatePackageProposalFromRequests(requests, 'plan-test', repos);
    expect(p?.planId).toBe('plan-test');
  });
  it('proposal requestIds contains request id', async () => {
    const requests = [makeRequest({ id: 'req-xyz' })];
    const [p] = await generatePackageProposalFromRequests(requests, 'plan-001', repos);
    expect(p?.requestIds).toContain('req-xyz');
  });
  it('proposal status is DRAFT', async () => {
    const [p] = await generatePackageProposalFromRequests([makeRequest()], 'plan-001', repos);
    expect(p?.status).toBe('DRAFT');
  });
});

// ─── PLI-11: proposal estimatedValue = sum of request costs ──────────────────

describe('PLI-11 proposal estimatedValue = sum of grouped request costs', () => {
  let repos: ReturnType<typeof createMemoryPlanningRepositories>;

  beforeEach(() => { repos = createMemoryPlanningRepositories(); });

  it('single request: estimatedValue = request cost', async () => {
    const [p] = await generatePackageProposalFromRequests([makeRequest({ estimatedCost: 300_000_000 })], 'plan-001', repos);
    expect(p?.estimatedValue).toBe(300_000_000);
  });
  it('two same-source requests: sum of costs', async () => {
    const requests = [
      makeRequest({ id: 'r1', requestCode: 'A', estimatedCost: 200_000_000 }),
      makeRequest({ id: 'r2', requestCode: 'B', estimatedCost: 300_000_000 }),
    ];
    const [p] = await generatePackageProposalFromRequests(requests, 'plan-001', repos);
    expect(p?.estimatedValue).toBe(500_000_000);
  });
  it('different-source groups have independent estimatedValues', async () => {
    const requests = [
      makeRequest({ id: 'r1', requestCode: 'A', fundingSource: 'STATE', estimatedCost: 200_000_000 }),
      makeRequest({ id: 'r2', requestCode: 'B', fundingSource: 'ODA',   estimatedCost: 100_000_000 }),
    ];
    const proposals = await generatePackageProposalFromRequests(requests, 'plan-001', repos);
    expect(proposals).toHaveLength(2);
    const total = proposals.reduce((s, p) => s + p.estimatedValue, 0);
    expect(total).toBe(300_000_000);
  });
});

// ─── PLI-12: buildPlanSummary() ──────────────────────────────────────────────

describe('PLI-12 buildPlanSummary() returns correct structure', () => {
  it('has planNumber, fiscalYear, estimatedTotal', () => {
    const plan = makePlan({ estimatedTotal: 500_000_000 });
    const s = buildPlanSummary(plan, []);
    expect(s.planNumber).toBe(plan.planNumber);
    expect(s.fiscalYear).toBe('2026');
    expect(s.estimatedTotal).toBe(500_000_000);
  });
  it('requestCount matches requests array length', () => {
    const plan = makePlan();
    const s = buildPlanSummary(plan, [makeRequest(), makeRequest({ id: 'r2', requestCode: 'B' })]);
    expect(s.requestCount).toBe(2);
  });
  it('status reflects plan status', () => {
    const plan = makePlan({ status: 'APPROVED' });
    expect(buildPlanSummary(plan, []).status).toBe('APPROVED');
  });
});

// ─── PLI-13: buildPlanSummary() generatedPackageCount ────────────────────────

describe('PLI-13 buildPlanSummary() generatedPackageCount reflects plan state', () => {
  it('empty generatedPackageIds = 0', () => {
    expect(buildPlanSummary(makePlan(), []).generatedPackageCount).toBe(0);
  });
  it('generatedPackageCount reflects length', () => {
    const plan = makePlan({ generatedPackageIds: ['p1', 'p2'] });
    expect(buildPlanSummary(plan, []).generatedPackageCount).toBe(2);
  });
  it('zero requestCount for empty requests', () => {
    expect(buildPlanSummary(makePlan(), []).requestCount).toBe(0);
  });
});
