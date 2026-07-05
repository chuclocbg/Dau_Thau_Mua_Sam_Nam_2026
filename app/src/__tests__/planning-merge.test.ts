/**
 * mergeRequests() and splitRequest() service functions
 *
 * Groups (13 × 3 = 39):
 *   PLM-01  mergeRequests() combines costs
 *   PLM-02  merged request has PENDING status
 *   PLM-03  originals marked as MERGED
 *   PLM-04  mergeRequests() throws NOT_FOUND for missing id
 *   PLM-05  mergeRequests() throws DUPLICATE_CODE for existing newCode
 *   PLM-06  mergeRequests() throws INVALID_MERGE for single id
 *   PLM-07  mergeRequests() inherits isUrgent=true if any is urgent
 *   PLM-08  mergeRequests() escalates priority (CRITICAL wins)
 *   PLM-09  splitRequest() creates 2 requests
 *   PLM-10  splitRequest() marks original as CANCELLED
 *   PLM-11  splitRequest() inherits department and fundSource from original
 *   PLM-12  splitRequest() throws NOT_FOUND for missing id
 *   PLM-13  splitRequest() throws INVALID_STATUS on MERGED original
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createRequest, approveRequest, mergeRequests, splitRequest } from '../procurement/planning/planningService';
import { createMemoryPlanningRepositories } from '../procurement/planning/memoryPlanningRepositories';
import { PlanningError } from '../procurement/planning/planningTypes';
import type { PlanningRepositories } from '../procurement/planning/planningRepository';
import type { ProcurementRequest, CreateRequestParams } from '../procurement/planning/planningTypes';

function makeRepos() { return createMemoryPlanningRepositories(); }

function p(o: Partial<CreateRequestParams> = {}): CreateRequestParams {
  return {
    requestCode: 'REQ-001', department: 'CNTT', requester: 'NV001',
    reason: 'Mua sắm', needDescription: 'Thiết bị',
    estimatedCost: 100_000_000, fundingSource: 'STATE',
    expectedTimeline: '2026-06-01', ...o,
  };
}

async function seedTwo(repos: PlanningRepositories, costA = 100_000_000, costB = 200_000_000): Promise<[ProcurementRequest, ProcurementRequest]> {
  const a = await createRequest(p({ requestCode: 'REQ-A', estimatedCost: costA }), repos);
  const b = await createRequest(p({ requestCode: 'REQ-B', estimatedCost: costB }), repos);
  return [a, b];
}

// ─── PLM-01: mergeRequests() combines costs ───────────────────────────────────

describe('PLM-01 mergeRequests() sums estimatedCost of all requests', () => {
  it('100M + 200M = 300M', async () => {
    const repos = makeRepos();
    const [a, b] = await seedTwo(repos);
    const merged = await mergeRequests([a.id, b.id], 'REQ-MERGED', repos, 'MANAGER');
    expect(merged.estimatedCost).toBe(300_000_000);
  });
  it('three requests summed', async () => {
    const repos = makeRepos();
    const a = await createRequest(p({ requestCode: 'A', estimatedCost: 100 }), repos);
    const b = await createRequest(p({ requestCode: 'B', estimatedCost: 200 }), repos);
    const c = await createRequest(p({ requestCode: 'C', estimatedCost: 300 }), repos);
    const merged = await mergeRequests([a.id, b.id, c.id], 'MERGED', repos, 'M');
    expect(merged.estimatedCost).toBe(600);
  });
  it('merged requestCode matches newCode', async () => {
    const repos = makeRepos();
    const [a, b] = await seedTwo(repos);
    const merged = await mergeRequests([a.id, b.id], 'NEW-CODE', repos, 'M');
    expect(merged.requestCode).toBe('NEW-CODE');
  });
});

// ─── PLM-02: merged request status ───────────────────────────────────────────

describe('PLM-02 merged request has PENDING status', () => {
  let repos: PlanningRepositories;

  beforeEach(() => { repos = makeRepos(); });

  it('merged request status is PENDING', async () => {
    const [a, b] = await seedTwo(repos);
    const merged = await mergeRequests([a.id, b.id], 'M1', repos, 'U');
    expect(merged.status).toBe('PENDING');
  });
  it('merged request inherits department from first request', async () => {
    const [a, b] = await seedTwo(repos);
    const merged = await mergeRequests([a.id, b.id], 'M2', repos, 'U');
    expect(merged.department).toBe('CNTT');
  });
  it('merged needDescription combines originals', async () => {
    const a = await createRequest(p({ requestCode: 'A', needDescription: 'Laptop' }), repos);
    const b = await createRequest(p({ requestCode: 'B', needDescription: 'Máy in' }), repos);
    const merged = await mergeRequests([a.id, b.id], 'M3', repos, 'U');
    expect(merged.needDescription).toContain('Laptop');
    expect(merged.needDescription).toContain('Máy in');
  });
});

// ─── PLM-03: originals marked as MERGED ──────────────────────────────────────

describe('PLM-03 original requests are marked MERGED', () => {
  let repos: PlanningRepositories;
  let a: ProcurementRequest;
  let b: ProcurementRequest;

  beforeEach(async () => {
    repos = makeRepos();
    [a, b] = await seedTwo(repos);
    await mergeRequests([a.id, b.id], 'MERGED', repos, 'U');
  });

  it('first original is MERGED', async () => {
    expect((await repos.requests.findById(a.id))?.status).toBe('MERGED');
  });
  it('second original is MERGED', async () => {
    expect((await repos.requests.findById(b.id))?.status).toBe('MERGED');
  });
  it('findByStatus MERGED returns 2 originals', async () => {
    expect(await repos.requests.findByStatus('MERGED')).toHaveLength(2);
  });
});

// ─── PLM-04: mergeRequests() NOT_FOUND ───────────────────────────────────────

describe('PLM-04 mergeRequests() throws NOT_FOUND for missing id', () => {
  it('throws PlanningError for ghost id', async () => {
    const repos = makeRepos();
    const r = await createRequest(p(), repos);
    await expect(mergeRequests([r.id, 'ghost'], 'NEW', repos, 'U')).rejects.toThrow(PlanningError);
  });
  it('error code is NOT_FOUND', async () => {
    const repos = makeRepos();
    const r = await createRequest(p(), repos);
    const err = await mergeRequests([r.id, 'ghost'], 'NEW', repos, 'U').catch(e => e);
    expect(err.code).toBe('NOT_FOUND');
  });
  it('no new request created on failure', async () => {
    const repos = makeRepos();
    const r = await createRequest(p(), repos);
    try { await mergeRequests([r.id, 'ghost'], 'NEW', repos, 'U'); } catch {}
    expect(await repos.requests.findByCode('NEW')).toBeNull();
  });
});

// ─── PLM-05: mergeRequests() DUPLICATE_CODE ──────────────────────────────────

describe('PLM-05 mergeRequests() throws DUPLICATE_CODE for existing newCode', () => {
  it('throws PlanningError when newCode exists', async () => {
    const repos = makeRepos();
    const [a, b] = await seedTwo(repos);
    await expect(mergeRequests([a.id, b.id], 'REQ-A', repos, 'U')).rejects.toThrow(PlanningError);
  });
  it('error code is DUPLICATE_CODE', async () => {
    const repos = makeRepos();
    const [a, b] = await seedTwo(repos);
    const err = await mergeRequests([a.id, b.id], 'REQ-A', repos, 'U').catch(e => e);
    expect(err.code).toBe('DUPLICATE_CODE');
  });
  it('unique newCode succeeds', async () => {
    const repos = makeRepos();
    const [a, b] = await seedTwo(repos);
    const merged = await mergeRequests([a.id, b.id], 'BRAND-NEW', repos, 'U');
    expect(merged.requestCode).toBe('BRAND-NEW');
  });
});

// ─── PLM-06: mergeRequests() INVALID_MERGE ───────────────────────────────────

describe('PLM-06 mergeRequests() throws INVALID_MERGE for single id', () => {
  it('throws PlanningError for single id', async () => {
    const repos = makeRepos();
    const r = await createRequest(p(), repos);
    await expect(mergeRequests([r.id], 'NEW', repos, 'U')).rejects.toThrow(PlanningError);
  });
  it('error code is INVALID_MERGE', async () => {
    const repos = makeRepos();
    const r = await createRequest(p(), repos);
    const err = await mergeRequests([r.id], 'NEW', repos, 'U').catch(e => e);
    expect(err.code).toBe('INVALID_MERGE');
  });
  it('two ids are valid', async () => {
    const repos = makeRepos();
    const [a, b] = await seedTwo(repos);
    await expect(mergeRequests([a.id, b.id], 'NEW', repos, 'U')).resolves.toBeDefined();
  });
});

// ─── PLM-07: mergeRequests() isUrgent propagation ────────────────────────────

describe('PLM-07 mergeRequests() isUrgent=true if any original is urgent', () => {
  it('non-urgent + urgent = urgent', async () => {
    const repos = makeRepos();
    const a = await createRequest(p({ requestCode: 'A', isUrgent: false }), repos);
    const b = await createRequest(p({ requestCode: 'B', isUrgent: true }), repos);
    const merged = await mergeRequests([a.id, b.id], 'M', repos, 'U');
    expect(merged.isUrgent).toBe(true);
  });
  it('neither urgent = not urgent', async () => {
    const repos = makeRepos();
    const [a, b] = await seedTwo(repos);
    const merged = await mergeRequests([a.id, b.id], 'M', repos, 'U');
    expect(merged.isUrgent).toBe(false);
  });
  it('both urgent = urgent', async () => {
    const repos = makeRepos();
    const a = await createRequest(p({ requestCode: 'A', isUrgent: true }), repos);
    const b = await createRequest(p({ requestCode: 'B', isUrgent: true }), repos);
    const merged = await mergeRequests([a.id, b.id], 'M', repos, 'U');
    expect(merged.isUrgent).toBe(true);
  });
});

// ─── PLM-08: mergeRequests() priority escalation ─────────────────────────────

describe('PLM-08 mergeRequests() escalates to highest priority', () => {
  it('CRITICAL wins over HIGH', async () => {
    const repos = makeRepos();
    const a = await createRequest(p({ requestCode: 'A', priority: 'HIGH' }), repos);
    const b = await createRequest(p({ requestCode: 'B', priority: 'CRITICAL' }), repos);
    const merged = await mergeRequests([a.id, b.id], 'M', repos, 'U');
    expect(merged.priority).toBe('CRITICAL');
  });
  it('HIGH wins over MEDIUM', async () => {
    const repos = makeRepos();
    const a = await createRequest(p({ requestCode: 'A', priority: 'MEDIUM' }), repos);
    const b = await createRequest(p({ requestCode: 'B', priority: 'HIGH' }), repos);
    const merged = await mergeRequests([a.id, b.id], 'M', repos, 'U');
    expect(merged.priority).toBe('HIGH');
  });
  it('same priority preserved', async () => {
    const repos = makeRepos();
    const a = await createRequest(p({ requestCode: 'A', priority: 'LOW' }), repos);
    const b = await createRequest(p({ requestCode: 'B', priority: 'LOW' }), repos);
    const merged = await mergeRequests([a.id, b.id], 'M', repos, 'U');
    expect(merged.priority).toBe('LOW');
  });
});

// ─── PLM-09: splitRequest() creates 2 requests ───────────────────────────────

describe('PLM-09 splitRequest() creates 2 new requests', () => {
  let repos: PlanningRepositories;
  let original: ProcurementRequest;

  beforeEach(async () => {
    repos = makeRepos();
    original = await createRequest(p({ requestCode: 'ORIG', estimatedCost: 500_000_000 }), repos);
  });

  it('returns array of 2 requests', async () => {
    const parts = await splitRequest(original.id, [
      { requestCode: 'SPLIT-A', needDescription: 'Phần 1', estimatedCost: 200_000_000 },
      { requestCode: 'SPLIT-B', needDescription: 'Phần 2', estimatedCost: 300_000_000 },
    ], repos, 'U');
    expect(parts).toHaveLength(2);
  });
  it('each part has correct code', async () => {
    const parts = await splitRequest(original.id, [
      { requestCode: 'X1', needDescription: 'D1', estimatedCost: 100 },
      { requestCode: 'X2', needDescription: 'D2', estimatedCost: 200 },
    ], repos, 'U');
    expect(parts[0]?.requestCode).toBe('X1');
    expect(parts[1]?.requestCode).toBe('X2');
  });
  it('each part has PENDING status', async () => {
    const parts = await splitRequest(original.id, [
      { requestCode: 'P1', needDescription: 'D', estimatedCost: 100 },
      { requestCode: 'P2', needDescription: 'D', estimatedCost: 200 },
    ], repos, 'U');
    expect(parts.every(r => r.status === 'PENDING')).toBe(true);
  });
});

// ─── PLM-10: splitRequest() marks original CANCELLED ─────────────────────────

describe('PLM-10 splitRequest() marks original as CANCELLED', () => {
  let repos: PlanningRepositories;
  let original: ProcurementRequest;

  beforeEach(async () => {
    repos = makeRepos();
    original = await createRequest(p({ requestCode: 'ORIG' }), repos);
  });

  it('original status becomes CANCELLED', async () => {
    await splitRequest(original.id, [
      { requestCode: 'S1', needDescription: 'D', estimatedCost: 50_000_000 },
      { requestCode: 'S2', needDescription: 'D', estimatedCost: 50_000_000 },
    ], repos, 'U');
    expect((await repos.requests.findById(original.id))?.status).toBe('CANCELLED');
  });
  it('total request count grows by 1 (2 created - 0 deleted, original remains)', async () => {
    const before = await repos.requests.count();
    await splitRequest(original.id, [
      { requestCode: 'S1', needDescription: 'D', estimatedCost: 50_000_000 },
      { requestCode: 'S2', needDescription: 'D', estimatedCost: 50_000_000 },
    ], repos, 'U');
    expect(await repos.requests.count()).toBe(before + 2);
  });
  it('CANCELLED count is 1 after split', async () => {
    await splitRequest(original.id, [
      { requestCode: 'S1', needDescription: 'D', estimatedCost: 50_000_000 },
      { requestCode: 'S2', needDescription: 'D', estimatedCost: 50_000_000 },
    ], repos, 'U');
    expect(await repos.requests.findByStatus('CANCELLED')).toHaveLength(1);
  });
});

// ─── PLM-11: splitRequest() inherits fields ──────────────────────────────────

describe('PLM-11 splitRequest() inherits department and fundSource from original', () => {
  let repos: PlanningRepositories;
  let original: ProcurementRequest;

  beforeEach(async () => {
    repos = makeRepos();
    original = await createRequest(p({ requestCode: 'ORIG', department: 'TC', fundingSource: 'ODA' }), repos);
  });

  it('split parts inherit department', async () => {
    const parts = await splitRequest(original.id, [
      { requestCode: 'S1', needDescription: 'D', estimatedCost: 100 },
      { requestCode: 'S2', needDescription: 'D', estimatedCost: 200 },
    ], repos, 'U');
    expect(parts.every(r => r.department === 'TC')).toBe(true);
  });
  it('split parts inherit fundingSource', async () => {
    const parts = await splitRequest(original.id, [
      { requestCode: 'S1', needDescription: 'D', estimatedCost: 100 },
      { requestCode: 'S2', needDescription: 'D', estimatedCost: 200 },
    ], repos, 'U');
    expect(parts.every(r => r.fundingSource === 'ODA')).toBe(true);
  });
  it('split parts reason references original code', async () => {
    const parts = await splitRequest(original.id, [
      { requestCode: 'S1', needDescription: 'D', estimatedCost: 100 },
      { requestCode: 'S2', needDescription: 'D', estimatedCost: 200 },
    ], repos, 'U');
    expect(parts[0]?.reason).toContain('ORIG');
  });
});

// ─── PLM-12: splitRequest() NOT_FOUND ────────────────────────────────────────

describe('PLM-12 splitRequest() throws NOT_FOUND for missing original', () => {
  it('throws PlanningError', async () => {
    await expect(splitRequest('ghost', [
      { requestCode: 'S1', needDescription: 'D', estimatedCost: 100 },
      { requestCode: 'S2', needDescription: 'D', estimatedCost: 200 },
    ], makeRepos(), 'U')).rejects.toThrow(PlanningError);
  });
  it('error code is NOT_FOUND', async () => {
    const err = await splitRequest('ghost', [
      { requestCode: 'S1', needDescription: 'D', estimatedCost: 100 },
      { requestCode: 'S2', needDescription: 'D', estimatedCost: 200 },
    ], makeRepos(), 'U').catch(e => e);
    expect(err.code).toBe('NOT_FOUND');
  });
  it('no request created on failure', async () => {
    const repos = makeRepos();
    try {
      await splitRequest('ghost', [
        { requestCode: 'S1', needDescription: 'D', estimatedCost: 100 },
        { requestCode: 'S2', needDescription: 'D', estimatedCost: 200 },
      ], repos, 'U');
    } catch {}
    expect(await repos.requests.count()).toBe(0);
  });
});

// ─── PLM-13: splitRequest() INVALID_STATUS on MERGED ────────────────────────

describe('PLM-13 splitRequest() throws INVALID_STATUS on MERGED original', () => {
  let repos: PlanningRepositories;

  beforeEach(() => { repos = makeRepos(); });

  it('throws INVALID_STATUS for MERGED original', async () => {
    const [a, b] = [
      await createRequest(p({ requestCode: 'A' }), repos),
      await createRequest(p({ requestCode: 'B' }), repos),
    ];
    await mergeRequests([a.id, b.id], 'M', repos, 'U');
    const err = await splitRequest(a.id, [
      { requestCode: 'S1', needDescription: 'D', estimatedCost: 100 },
      { requestCode: 'S2', needDescription: 'D', estimatedCost: 200 },
    ], repos, 'U').catch(e => e);
    expect(err.code).toBe('INVALID_STATUS');
  });
  it('throws INVALID_STATUS for CANCELLED original', async () => {
    const orig = await createRequest(p({ requestCode: 'ORIG' }), repos);
    await splitRequest(orig.id, [
      { requestCode: 'S1', needDescription: 'D', estimatedCost: 100 },
      { requestCode: 'S2', needDescription: 'D', estimatedCost: 200 },
    ], repos, 'U');
    const err = await splitRequest(orig.id, [
      { requestCode: 'T1', needDescription: 'D', estimatedCost: 100 },
      { requestCode: 'T2', needDescription: 'D', estimatedCost: 200 },
    ], repos, 'U').catch(e => e);
    expect(err.code).toBe('INVALID_STATUS');
  });
  it('PENDING original can be split', async () => {
    const orig = await createRequest(p({ requestCode: 'ORIG' }), repos);
    const parts = await splitRequest(orig.id, [
      { requestCode: 'P1', needDescription: 'D', estimatedCost: 100 },
      { requestCode: 'P2', needDescription: 'D', estimatedCost: 200 },
    ], repos, 'U');
    expect(parts).toHaveLength(2);
  });
});
