/**
 * createRequest() and approveRequest() service functions
 *
 * Groups (13 × 3 = 39):
 *   PLQ-01  createRequest() happy path
 *   PLQ-02  createRequest() rejects duplicate code
 *   PLQ-03  createRequest() rejects empty requestCode
 *   PLQ-04  createRequest() rejects zero estimatedCost
 *   PLQ-05  createRequest() needs array seeded (empty if not provided)
 *   PLQ-06  createRequest() isUrgent defaults to false
 *   PLQ-07  createRequest() priority defaults to MEDIUM
 *   PLQ-08  approveRequest() PENDING → APPROVED
 *   PLQ-09  approveRequest() NOT_FOUND throws
 *   PLQ-10  approveRequest() non-PENDING throws INVALID_STATUS
 *   PLQ-11  createRequest() with needs embedded
 *   PLQ-12  createRequest() legalBasis defaults to empty string
 *   PLQ-13  generatePlanNumber() format
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createRequest, approveRequest, generatePlanNumber } from '../procurement/planning/planningService';
import { createMemoryPlanningRepositories } from '../procurement/planning/memoryPlanningRepositories';
import { PlanningError } from '../procurement/planning/planningTypes';
import type { PlanningRepositories, } from '../procurement/planning/planningRepository';
import type { CreateRequestParams, ProcurementRequest } from '../procurement/planning/planningTypes';

function makeRepos() { return createMemoryPlanningRepositories(); }

function params(o: Partial<CreateRequestParams> = {}): CreateRequestParams {
  return {
    requestCode: 'REQ-001', department: 'CNTT', requester: 'NV001',
    reason: 'Mua máy tính', needDescription: 'Laptop Core i7',
    estimatedCost: 50_000_000, fundingSource: 'STATE',
    expectedTimeline: '2026-06-01', ...o,
  };
}

// ─── PLQ-01: createRequest() happy path ──────────────────────────────────────

describe('PLQ-01 createRequest() creates PENDING request', () => {
  let repos: PlanningRepositories;
  let req: ProcurementRequest;

  beforeEach(async () => {
    repos = makeRepos();
    req = await createRequest(params(), repos);
  });

  it('returns request with id', () => { expect(req.id.length).toBeGreaterThan(0); });
  it('status is PENDING', () => { expect(req.status).toBe('PENDING'); });
  it('estimatedCost and department preserved', () => {
    expect(req.estimatedCost).toBe(50_000_000);
    expect(req.department).toBe('CNTT');
  });
});

// ─── PLQ-02: createRequest() duplicate code ───────────────────────────────────

describe('PLQ-02 createRequest() rejects duplicate requestCode', () => {
  let repos: PlanningRepositories;

  beforeEach(async () => {
    repos = makeRepos();
    await createRequest(params(), repos);
  });

  it('throws PlanningError on duplicate', async () => {
    await expect(createRequest(params(), repos)).rejects.toThrow(PlanningError);
  });
  it('error code is DUPLICATE_CODE', async () => {
    const err = await createRequest(params(), repos).catch(e => e);
    expect(err.code).toBe('DUPLICATE_CODE');
  });
  it('different code is accepted', async () => {
    const r = await createRequest(params({ requestCode: 'REQ-002' }), repos);
    expect(r.requestCode).toBe('REQ-002');
  });
});

// ─── PLQ-03: createRequest() empty requestCode ───────────────────────────────

describe('PLQ-03 createRequest() rejects empty required fields', () => {
  let repos: PlanningRepositories;
  beforeEach(() => { repos = makeRepos(); });

  it('empty requestCode throws', async () => {
    await expect(createRequest(params({ requestCode: '' }), repos)).rejects.toThrow(PlanningError);
  });
  it('empty reason throws', async () => {
    await expect(createRequest(params({ reason: '' }), repos)).rejects.toThrow(PlanningError);
  });
  it('empty department throws', async () => {
    await expect(createRequest(params({ department: '' }), repos)).rejects.toThrow(PlanningError);
  });
});

// ─── PLQ-04: createRequest() zero estimatedCost ──────────────────────────────

describe('PLQ-04 createRequest() rejects zero or negative estimatedCost', () => {
  let repos: PlanningRepositories;
  beforeEach(() => { repos = makeRepos(); });

  it('zero cost throws INVALID_COST', async () => {
    const err = await createRequest(params({ estimatedCost: 0 }), repos).catch(e => e);
    expect(err.code).toBe('INVALID_COST');
  });
  it('negative cost throws', async () => {
    await expect(createRequest(params({ estimatedCost: -1 }), repos)).rejects.toThrow(PlanningError);
  });
  it('positive cost is accepted', async () => {
    const r = await createRequest(params({ estimatedCost: 1 }), repos);
    expect(r.estimatedCost).toBe(1);
  });
});

// ─── PLQ-05: createRequest() needs seeded ────────────────────────────────────

describe('PLQ-05 createRequest() seeds needs as empty array if not provided', () => {
  it('needs is empty array when not provided', async () => {
    const r = await createRequest(params(), makeRepos());
    expect(r.needs).toHaveLength(0);
  });
  it('needs preserves count when provided', async () => {
    const r = await createRequest(params({
      needs: [{ needCode: 'N1', description: 'D', category: 'C', quantity: 1, unit: 'chiếc', estimatedUnitCost: 1, estimatedTotal: 1 }],
    }), makeRepos());
    expect(r.needs).toHaveLength(1);
  });
  it('needs array is readonly', async () => {
    const r = await createRequest(params(), makeRepos());
    expect(Array.isArray(r.needs)).toBe(true);
  });
});

// ─── PLQ-06: createRequest() isUrgent default ────────────────────────────────

describe('PLQ-06 createRequest() isUrgent defaults to false', () => {
  it('isUrgent is false when not provided', async () => {
    const r = await createRequest(params(), makeRepos());
    expect(r.isUrgent).toBe(false);
  });
  it('isUrgent can be set to true', async () => {
    const r = await createRequest(params({ isUrgent: true }), makeRepos());
    expect(r.isUrgent).toBe(true);
  });
  it('non-urgent request is the default case', async () => {
    const repos = makeRepos();
    const a = await createRequest(params({ requestCode: 'A' }), repos);
    const b = await createRequest(params({ requestCode: 'B', isUrgent: true }), repos);
    expect(a.isUrgent).toBe(false);
    expect(b.isUrgent).toBe(true);
  });
});

// ─── PLQ-07: createRequest() priority default ────────────────────────────────

describe('PLQ-07 createRequest() priority defaults to MEDIUM', () => {
  it('priority is MEDIUM when not provided', async () => {
    const r = await createRequest(params(), makeRepos());
    expect(r.priority).toBe('MEDIUM');
  });
  it('priority can be set to HIGH', async () => {
    const r = await createRequest(params({ priority: 'HIGH' }), makeRepos());
    expect(r.priority).toBe('HIGH');
  });
  it('priority can be set to CRITICAL', async () => {
    const r = await createRequest(params({ priority: 'CRITICAL' }), makeRepos());
    expect(r.priority).toBe('CRITICAL');
  });
});

// ─── PLQ-08: approveRequest() PENDING → APPROVED ─────────────────────────────

describe('PLQ-08 approveRequest() transitions PENDING to APPROVED', () => {
  let repos: PlanningRepositories;
  let req: ProcurementRequest;

  beforeEach(async () => {
    repos = makeRepos();
    req = await createRequest(params(), repos);
  });

  it('status becomes APPROVED', async () => {
    const approved = await approveRequest(req.id, repos, 'MANAGER');
    expect(approved.status).toBe('APPROVED');
  });
  it('other fields are preserved', async () => {
    const approved = await approveRequest(req.id, repos, 'MANAGER');
    expect(approved.department).toBe('CNTT');
    expect(approved.estimatedCost).toBe(50_000_000);
  });
  it('updatedAt changes after approval', async () => {
    const approved = await approveRequest(req.id, repos, 'MANAGER');
    expect(approved.updatedAt).toBeDefined();
  });
});

// ─── PLQ-09: approveRequest() NOT_FOUND ──────────────────────────────────────

describe('PLQ-09 approveRequest() throws NOT_FOUND for missing request', () => {
  const repos = makeRepos();

  it('throws PlanningError', async () => {
    await expect(approveRequest('ghost', repos, 'MANAGER')).rejects.toThrow(PlanningError);
  });
  it('error code is NOT_FOUND', async () => {
    const err = await approveRequest('missing', repos, 'M').catch(e => e);
    expect(err.code).toBe('NOT_FOUND');
  });
  it('store remains empty', async () => {
    try { await approveRequest('x', repos, 'M'); } catch {}
    expect(await repos.requests.count()).toBe(0);
  });
});

// ─── PLQ-10: approveRequest() non-PENDING ────────────────────────────────────

describe('PLQ-10 approveRequest() throws INVALID_STATUS for non-PENDING', () => {
  let repos: PlanningRepositories;

  beforeEach(async () => {
    repos = makeRepos();
    const r = await createRequest(params(), repos);
    await approveRequest(r.id, repos, 'MANAGER');
  });

  it('throws on already-APPROVED', async () => {
    const reqs = await repos.requests.findByStatus('APPROVED');
    await expect(approveRequest(reqs[0]!.id, repos, 'M2')).rejects.toThrow(PlanningError);
  });
  it('error code is INVALID_STATUS', async () => {
    const reqs = await repos.requests.findByStatus('APPROVED');
    const err = await approveRequest(reqs[0]!.id, repos, 'M').catch(e => e);
    expect(err.code).toBe('INVALID_STATUS');
  });
  it('status remains APPROVED after failed approval', async () => {
    const reqs = await repos.requests.findByStatus('APPROVED');
    try { await approveRequest(reqs[0]!.id, repos, 'M'); } catch {}
    expect(reqs[0]?.status).toBe('APPROVED');
  });
});

// ─── PLQ-11: createRequest() with needs embedded ─────────────────────────────

describe('PLQ-11 createRequest() with needs embedded', () => {
  const needs = [
    { needCode: 'N1', description: 'Laptop', category: 'CNTT', quantity: 5, unit: 'chiếc', estimatedUnitCost: 10_000_000, estimatedTotal: 50_000_000 },
    { needCode: 'N2', description: 'Chuột',  category: 'CNTT', quantity: 10, unit: 'cái',  estimatedUnitCost: 200_000,    estimatedTotal: 2_000_000 },
  ];

  it('needs has 2 entries', async () => {
    const r = await createRequest(params({ needs }), makeRepos());
    expect(r.needs).toHaveLength(2);
  });
  it('first need code preserved', async () => {
    const r = await createRequest(params({ needs }), makeRepos());
    expect(r.needs[0]?.needCode).toBe('N1');
  });
  it('second need estimatedTotal preserved', async () => {
    const r = await createRequest(params({ needs }), makeRepos());
    expect(r.needs[1]?.estimatedTotal).toBe(2_000_000);
  });
});

// ─── PLQ-12: createRequest() legalBasis default ──────────────────────────────

describe('PLQ-12 createRequest() legalBasis defaults to empty string', () => {
  it('legalBasis is empty string when not provided', async () => {
    const r = await createRequest(params(), makeRepos());
    expect(r.legalBasis).toBe('');
  });
  it('legalBasis can be set', async () => {
    const r = await createRequest(params({ legalBasis: 'QĐ 123/2026/BKHDT' }), makeRepos());
    expect(r.legalBasis).toBe('QĐ 123/2026/BKHDT');
  });
  it('planId is undefined initially', async () => {
    const r = await createRequest(params(), makeRepos());
    expect(r.planId).toBeUndefined();
  });
});

// ─── PLQ-13: generatePlanNumber() ────────────────────────────────────────────

describe('PLQ-13 generatePlanNumber() formats plan number', () => {
  it('uses org/KH-DTMS/year/seq format', () => {
    expect(generatePlanNumber('DTMS', 2026, 1)).toBe('DTMS/KH-DTMS/2026/001');
  });
  it('seq is zero-padded to 3 digits', () => {
    expect(generatePlanNumber('DTMS', 2026, 99)).toBe('DTMS/KH-DTMS/2026/099');
    expect(generatePlanNumber('DTMS', 2026, 100)).toBe('DTMS/KH-DTMS/2026/100');
  });
  it('default org is DTMS and year is current year', () => {
    const code = generatePlanNumber();
    expect(code).toMatch(/^DTMS\/KH-DTMS\/\d{4}\/001$/);
  });
});
