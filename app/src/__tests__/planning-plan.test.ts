/**
 * generateProcurementPlan(), validatePlan(), createPackageFromPlan()
 *
 * Groups (13 × 3 = 39):
 *   PLP-01  generateProcurementPlan() creates DRAFT plan
 *   PLP-02  plan planNumber uses org/year/seq format
 *   PLP-03  plan estimatedTotal = sum of request costs
 *   PLP-04  plan links requestIds
 *   PLP-05  requests get planId set after plan creation
 *   PLP-06  generateProcurementPlan() rejects empty requestIds
 *   PLP-07  generateProcurementPlan() rejects unapproved requests
 *   PLP-08  validatePlan() returns valid for good plan
 *   PLP-09  validatePlan() returns NOT_FOUND for missing plan
 *   PLP-10  validatePlan() warns when no allocations
 *   PLP-11  plan seq increments for same fiscal year
 *   PLP-12  createPackageFromPlan() converts APPROVED proposal to package
 *   PLP-13  createPackageFromPlan() rejects non-APPROVED proposal
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createRequest, approveRequest, generateProcurementPlan,
  validatePlan, createPackageFromPlan,
} from '../procurement/planning/planningService';
import { createMemoryPlanningRepositories } from '../procurement/planning/memoryPlanningRepositories';
import { createMemoryPackageRepositories } from '../procurement/package/memoryPackageRepositories';
import { PlanningError } from '../procurement/planning/planningTypes';
import type { PlanningRepositories } from '../procurement/planning/planningRepository';
import type { ProcurementRequest, ProcurementPlan } from '../procurement/planning/planningTypes';

function makeRepos() { return createMemoryPlanningRepositories(); }

async function seedApprovedRequest(repos: PlanningRepositories, code = 'REQ-001', cost = 100_000_000): Promise<ProcurementRequest> {
  const r = await createRequest({
    requestCode: code, department: 'CNTT', requester: 'NV001',
    reason: 'Mua sắm', needDescription: 'Laptop', estimatedCost: cost,
    fundingSource: 'STATE', expectedTimeline: '2026-06-01',
  }, repos);
  return approveRequest(r.id, repos, 'MANAGER');
}

// ─── PLP-01: generateProcurementPlan() DRAFT plan ────────────────────────────

describe('PLP-01 generateProcurementPlan() creates DRAFT plan', () => {
  let repos: PlanningRepositories;
  let plan: ProcurementPlan;

  beforeEach(async () => {
    repos = makeRepos();
    const r = await seedApprovedRequest(repos);
    plan = await generateProcurementPlan('2026', 'DTMS', [r.id], repos, 'CNTT');
  });

  it('returns plan with id', () => { expect(plan.id.length).toBeGreaterThan(0); });
  it('status is DRAFT', () => { expect(plan.status).toBe('DRAFT'); });
  it('fiscalYear and organization are set', () => {
    expect(plan.fiscalYear).toBe('2026');
    expect(plan.organization).toBe('DTMS');
  });
});

// ─── PLP-02: plan planNumber format ──────────────────────────────────────────

describe('PLP-02 plan planNumber uses org/KH-DTMS/year/seq', () => {
  let repos: PlanningRepositories;

  beforeEach(() => { repos = makeRepos(); });

  it('planNumber contains KH-DTMS and 2026', async () => {
    const r = await seedApprovedRequest(repos);
    const plan = await generateProcurementPlan('2026', 'DTMS', [r.id], repos);
    expect(plan.planNumber).toContain('KH-DTMS');
    expect(plan.planNumber).toContain('2026');
  });
  it('planNumber starts with organization', async () => {
    const r = await seedApprovedRequest(repos);
    const plan = await generateProcurementPlan('2026', 'MYORG', [r.id], repos);
    expect(plan.planNumber.startsWith('MYORG')).toBe(true);
  });
  it('planNumber ends with 001 for first plan', async () => {
    const r = await seedApprovedRequest(repos);
    const plan = await generateProcurementPlan('2026', 'DTMS', [r.id], repos);
    expect(plan.planNumber.endsWith('001')).toBe(true);
  });
});

// ─── PLP-03: plan estimatedTotal ─────────────────────────────────────────────

describe('PLP-03 plan estimatedTotal = sum of request costs', () => {
  it('single request cost', async () => {
    const repos = makeRepos();
    const r = await seedApprovedRequest(repos, 'REQ-001', 300_000_000);
    const plan = await generateProcurementPlan('2026', 'DTMS', [r.id], repos);
    expect(plan.estimatedTotal).toBe(300_000_000);
  });
  it('two requests summed', async () => {
    const repos = makeRepos();
    const r1 = await seedApprovedRequest(repos, 'REQ-001', 200_000_000);
    const r2 = await seedApprovedRequest(repos, 'REQ-002', 300_000_000);
    const plan = await generateProcurementPlan('2026', 'DTMS', [r1.id, r2.id], repos);
    expect(plan.estimatedTotal).toBe(500_000_000);
  });
  it('three requests summed', async () => {
    const repos = makeRepos();
    const ids: string[] = [];
    for (let i = 1; i <= 3; i++) {
      const r = await seedApprovedRequest(repos, `REQ-00${i}`, 100_000_000);
      ids.push(r.id);
    }
    const plan = await generateProcurementPlan('2026', 'DTMS', ids, repos);
    expect(plan.estimatedTotal).toBe(300_000_000);
  });
});

// ─── PLP-04: plan links requestIds ───────────────────────────────────────────

describe('PLP-04 plan links requestIds', () => {
  let repos: PlanningRepositories;

  beforeEach(() => { repos = makeRepos(); });

  it('single request id in plan', async () => {
    const r = await seedApprovedRequest(repos);
    const plan = await generateProcurementPlan('2026', 'DTMS', [r.id], repos);
    expect(plan.requestIds).toContain(r.id);
  });
  it('two request ids in plan', async () => {
    const r1 = await seedApprovedRequest(repos, 'A');
    const r2 = await seedApprovedRequest(repos, 'B');
    const plan = await generateProcurementPlan('2026', 'DTMS', [r1.id, r2.id], repos);
    expect(plan.requestIds).toHaveLength(2);
  });
  it('generatedPackageIds starts empty', async () => {
    const r = await seedApprovedRequest(repos);
    const plan = await generateProcurementPlan('2026', 'DTMS', [r.id], repos);
    expect(plan.generatedPackageIds).toHaveLength(0);
  });
});

// ─── PLP-05: requests get planId set ─────────────────────────────────────────

describe('PLP-05 requests get planId set after plan creation', () => {
  let repos: PlanningRepositories;

  beforeEach(() => { repos = makeRepos(); });

  it('request planId matches plan.id', async () => {
    const r = await seedApprovedRequest(repos);
    const plan = await generateProcurementPlan('2026', 'DTMS', [r.id], repos);
    const updated = await repos.requests.findById(r.id);
    expect(updated?.planId).toBe(plan.id);
  });
  it('both requests in 2-request plan get planId', async () => {
    const r1 = await seedApprovedRequest(repos, 'A');
    const r2 = await seedApprovedRequest(repos, 'B');
    const plan = await generateProcurementPlan('2026', 'DTMS', [r1.id, r2.id], repos);
    const u1 = await repos.requests.findById(r1.id);
    const u2 = await repos.requests.findById(r2.id);
    expect(u1?.planId).toBe(plan.id);
    expect(u2?.planId).toBe(plan.id);
  });
  it('request without plan has no planId', async () => {
    const r = await createRequest({ requestCode: 'X', department: 'D', requester: 'U', reason: 'R', needDescription: 'N', estimatedCost: 1_000, fundingSource: 'S', expectedTimeline: '2026-01-01' }, repos);
    expect(r.planId).toBeUndefined();
  });
});

// ─── PLP-06: generateProcurementPlan() rejects empty requestIds ───────────────

describe('PLP-06 generateProcurementPlan() rejects empty requestIds', () => {
  it('throws PlanningError for empty array', async () => {
    await expect(generateProcurementPlan('2026', 'DTMS', [], makeRepos())).rejects.toThrow(PlanningError);
  });
  it('error code is EMPTY_REQUESTS', async () => {
    const err = await generateProcurementPlan('2026', 'DTMS', [], makeRepos()).catch(e => e);
    expect(err.code).toBe('EMPTY_REQUESTS');
  });
  it('no plan created on failure', async () => {
    const repos = makeRepos();
    try { await generateProcurementPlan('2026', 'DTMS', [], repos); } catch {}
    expect(await repos.plans.count()).toBe(0);
  });
});

// ─── PLP-07: generateProcurementPlan() rejects unapproved ────────────────────

describe('PLP-07 generateProcurementPlan() rejects unapproved requests', () => {
  it('throws UNAPPROVED_REQUESTS for PENDING request', async () => {
    const repos = makeRepos();
    const r = await createRequest({ requestCode: 'REQ-001', department: 'D', requester: 'U', reason: 'R', needDescription: 'N', estimatedCost: 1_000, fundingSource: 'S', expectedTimeline: '2026-01-01' }, repos);
    const err = await generateProcurementPlan('2026', 'DTMS', [r.id], repos).catch(e => e);
    expect(err.code).toBe('UNAPPROVED_REQUESTS');
  });
  it('throws for non-existent request id', async () => {
    await expect(generateProcurementPlan('2026', 'DTMS', ['ghost'], makeRepos())).rejects.toThrow(PlanningError);
  });
  it('all-approved plan succeeds', async () => {
    const repos = makeRepos();
    const r = await seedApprovedRequest(repos);
    await expect(generateProcurementPlan('2026', 'DTMS', [r.id], repos)).resolves.toBeDefined();
  });
});

// ─── PLP-08: validatePlan() valid plan ───────────────────────────────────────

describe('PLP-08 validatePlan() returns valid for good plan', () => {
  let repos: PlanningRepositories;
  let plan: ProcurementPlan;

  beforeEach(async () => {
    repos = makeRepos();
    const r = await seedApprovedRequest(repos);
    plan = await generateProcurementPlan('2026', 'DTMS', [r.id], repos);
  });

  it('valid is true', async () => {
    const result = await validatePlan(plan.id, repos);
    expect(result.valid).toBe(true);
  });
  it('errors are empty', async () => {
    const result = await validatePlan(plan.id, repos);
    expect(result.errors).toHaveLength(0);
  });
  it('warns when no allocations', async () => {
    const result = await validatePlan(plan.id, repos);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

// ─── PLP-09: validatePlan() NOT_FOUND ────────────────────────────────────────

describe('PLP-09 validatePlan() returns invalid for missing plan', () => {
  it('valid is false for missing plan', async () => {
    const result = await validatePlan('ghost', makeRepos());
    expect(result.valid).toBe(false);
  });
  it('error contains planId', async () => {
    const result = await validatePlan('ghost-id', makeRepos());
    expect(result.errors[0]).toContain('ghost-id');
  });
  it('warnings are empty on NOT_FOUND', async () => {
    const result = await validatePlan('x', makeRepos());
    expect(result.warnings).toHaveLength(0);
  });
});

// ─── PLP-10: validatePlan() no allocations warning ───────────────────────────

describe('PLP-10 validatePlan() warns on no funding allocations', () => {
  it('warning message mentions allocation', async () => {
    const repos = makeRepos();
    const r = await seedApprovedRequest(repos);
    const plan = await generateProcurementPlan('2026', 'DTMS', [r.id], repos);
    const result = await validatePlan(plan.id, repos);
    expect(result.warnings[0]).toMatch(/allocation|funding/i);
  });
  it('plan with allocation has no allocation warning', async () => {
    const repos = makeRepos();
    const r = await seedApprovedRequest(repos);
    const plan = await generateProcurementPlan('2026', 'DTMS', [r.id], repos);
    await repos.allocations.create({ planId: plan.id, fundSourceCode: 'STATE', allocatedAmount: 200_000_000, committedAmount: 0, remainingAmount: 200_000_000, budgetYear: '2026' });
    const result = await validatePlan(plan.id, repos);
    expect(result.warnings).toHaveLength(0);
  });
  it('plan is still valid even without allocations', async () => {
    const repos = makeRepos();
    const r = await seedApprovedRequest(repos);
    const plan = await generateProcurementPlan('2026', 'DTMS', [r.id], repos);
    const result = await validatePlan(plan.id, repos);
    expect(result.valid).toBe(true);
  });
});

// ─── PLP-11: plan seq increments ────────────────────────────────────────────

describe('PLP-11 plan seq increments for same fiscal year', () => {
  let repos: PlanningRepositories;

  beforeEach(() => { repos = makeRepos(); });

  it('first plan ends with 001', async () => {
    const r = await seedApprovedRequest(repos, 'A');
    const plan = await generateProcurementPlan('2026', 'DTMS', [r.id], repos);
    expect(plan.planNumber.endsWith('001')).toBe(true);
  });
  it('second plan ends with 002', async () => {
    const r1 = await seedApprovedRequest(repos, 'A');
    const r2 = await seedApprovedRequest(repos, 'B');
    await generateProcurementPlan('2026', 'DTMS', [r1.id], repos);
    const plan2 = await generateProcurementPlan('2026', 'DTMS', [r2.id], repos);
    expect(plan2.planNumber.endsWith('002')).toBe(true);
  });
  it('different year resets to 001', async () => {
    const r1 = await seedApprovedRequest(repos, 'A');
    const r2 = await seedApprovedRequest(repos, 'B', 100_000_000);
    await repos.requests.update(r2.id, { expectedTimeline: '2027-01-01' });
    await generateProcurementPlan('2026', 'DTMS', [r1.id], repos);
    const plan2027 = await generateProcurementPlan('2027', 'DTMS', [r2.id], repos);
    expect(plan2027.planNumber.endsWith('001')).toBe(true);
  });
});

// ─── PLP-12: createPackageFromPlan() happy path ──────────────────────────────

describe('PLP-12 createPackageFromPlan() converts APPROVED proposal to package', () => {
  let repos: PlanningRepositories;
  let plan: ProcurementPlan;

  beforeEach(async () => {
    repos = makeRepos();
    const r = await seedApprovedRequest(repos);
    plan = await generateProcurementPlan('2026', 'DTMS', [r.id], repos, 'CNTT');
  });

  it('creates package from APPROVED proposal', async () => {
    const proposal = await repos.proposals.create({
      proposalCode: 'PROP-001', planId: plan.id, requestIds: [],
      proposedPackageType: 'GOODS', proposedMethod: 'OPEN_TENDER',
      estimatedValue: 100_000_000, fundSource: 'STATE',
      justification: 'Mua laptop', status: 'APPROVED',
    });
    const pkgRepos = createMemoryPackageRepositories();
    const pkg = await createPackageFromPlan(plan.id, proposal.id, pkgRepos, repos, 'NV001');
    expect(pkg.id.length).toBeGreaterThan(0);
    expect(pkg.status).toBe('DRAFT');
  });
  it('proposal status becomes CONVERTED', async () => {
    const proposal = await repos.proposals.create({
      proposalCode: 'PROP-002', planId: plan.id, requestIds: [],
      proposedPackageType: 'GOODS', proposedMethod: 'OPEN_TENDER',
      estimatedValue: 100_000_000, fundSource: 'STATE',
      justification: 'Mua máy in', status: 'APPROVED',
    });
    const pkgRepos = createMemoryPackageRepositories();
    await createPackageFromPlan(plan.id, proposal.id, pkgRepos, repos, 'NV001');
    const updated = await repos.proposals.findById(proposal.id);
    expect(updated?.status).toBe('CONVERTED');
  });
  it('plan generatedPackageIds is updated', async () => {
    const proposal = await repos.proposals.create({
      proposalCode: 'PROP-003', planId: plan.id, requestIds: [],
      proposedPackageType: 'GOODS', proposedMethod: 'OPEN_TENDER',
      estimatedValue: 100_000_000, fundSource: 'STATE',
      justification: 'Mua thiết bị', status: 'APPROVED',
    });
    const pkgRepos = createMemoryPackageRepositories();
    await createPackageFromPlan(plan.id, proposal.id, pkgRepos, repos, 'NV001');
    const updatedPlan = await repos.plans.findById(plan.id);
    expect(updatedPlan?.generatedPackageIds).toHaveLength(1);
  });
});

// ─── PLP-13: createPackageFromPlan() non-APPROVED proposal ───────────────────

describe('PLP-13 createPackageFromPlan() rejects non-APPROVED proposal', () => {
  let repos: PlanningRepositories;
  let plan: ProcurementPlan;

  beforeEach(async () => {
    repos = makeRepos();
    const r = await seedApprovedRequest(repos);
    plan = await generateProcurementPlan('2026', 'DTMS', [r.id], repos, 'CNTT');
  });

  it('throws INVALID_STATUS for DRAFT proposal', async () => {
    const proposal = await repos.proposals.create({
      proposalCode: 'PROP-D', planId: plan.id, requestIds: [],
      proposedPackageType: 'GOODS', proposedMethod: 'OPEN_TENDER',
      estimatedValue: 100_000_000, fundSource: 'STATE',
      justification: 'Draft', status: 'DRAFT',
    });
    const err = await createPackageFromPlan(plan.id, proposal.id, createMemoryPackageRepositories(), repos, 'NV').catch(e => e);
    expect(err.code).toBe('INVALID_STATUS');
  });
  it('throws NOT_FOUND for missing proposal', async () => {
    const err = await createPackageFromPlan(plan.id, 'ghost', createMemoryPackageRepositories(), repos, 'NV').catch(e => e);
    expect(err.code).toBe('NOT_FOUND');
  });
  it('throws NOT_FOUND for missing plan', async () => {
    const proposal = await repos.proposals.create({
      proposalCode: 'PROP-X', planId: plan.id, requestIds: [],
      proposedPackageType: 'GOODS', proposedMethod: 'OPEN_TENDER',
      estimatedValue: 100_000_000, fundSource: 'STATE',
      justification: 'Test', status: 'APPROVED',
    });
    const err = await createPackageFromPlan('bad-plan', proposal.id, createMemoryPackageRepositories(), repos, 'NV').catch(e => e);
    expect(err.code).toBe('NOT_FOUND');
  });
});
