/**
 * Memory repository implementations for all planning entities
 *
 * Groups (13 × 3 = 39):
 *   PLR-01  RequestRepo create() — id and timestamps
 *   PLR-02  findByCode — exact match
 *   PLR-03  findByStatus — filters correctly
 *   PLR-04  findByDepartment — filters correctly
 *   PLR-05  findByPlanId — scoped to planId
 *   PLR-06  search by term (case-insensitive)
 *   PLR-07  search by status + cost filters
 *   PLR-08  search pagination
 *   PLR-09  PlanRepo findByFiscalYear
 *   PLR-10  PlanRepo findByOrganization + findByStatus
 *   PLR-11  PlanRepo findByNumber
 *   PLR-12  DemandRepo findByDepartment/findByFiscalYear/findByStatus
 *   PLR-13  FundingAllocationRepo findByPlanId + sumByPlanId
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  MemoryProcurementRequestRepository, MemoryProcurementPlanRepository,
  MemoryProcurementDemandRepository, MemoryFundingAllocationRepository,
} from '../procurement/planning/memoryPlanningRepositories';
import type { ProcurementRequest, ProcurementPlan, FundingAllocation } from '../procurement/planning/planningTypes';

type ReqInput  = Omit<ProcurementRequest, 'id' | 'createdAt' | 'updatedAt'>;
type PlanInput = Omit<ProcurementPlan,    'id' | 'createdAt' | 'updatedAt'>;
type AllocInput = Omit<FundingAllocation, 'id' | 'createdAt' | 'updatedAt'>;

function reqInput(o: Partial<ReqInput> = {}): ReqInput {
  return {
    requestCode: 'REQ-001', department: 'CNTT', requester: 'NV001',
    reason: 'Mua máy tính', needDescription: 'Laptop Core i7', needs: [],
    estimatedCost: 50_000_000, fundingSource: 'STATE', isUrgent: false,
    expectedTimeline: '2026-06-01', priority: 'MEDIUM', legalBasis: '',
    status: 'PENDING', ...o,
  };
}

function planInput(o: Partial<PlanInput> = {}): PlanInput {
  return {
    planNumber: 'DTMS/KH-DTMS/2026/001', fiscalYear: '2026', organization: 'DTMS',
    responsibleDepartment: 'CNTT', estimatedTotal: 500_000_000, status: 'DRAFT',
    approvalHistory: [], requestIds: [], generatedPackageIds: [], ...o,
  };
}

function allocInput(o: Partial<AllocInput> = {}): AllocInput {
  return {
    planId: 'plan-001', fundSourceCode: 'STATE', allocatedAmount: 500_000_000,
    committedAmount: 0, remainingAmount: 500_000_000, budgetYear: '2026', ...o,
  };
}

// ─── PLR-01: RequestRepo create() ────────────────────────────────────────────

describe('PLR-01 RequestRepo create() generates id and timestamps', () => {
  const repo = new MemoryProcurementRequestRepository();

  it('returns request with id', async () => {
    const r = await repo.create(reqInput());
    expect(r.id.length).toBeGreaterThan(0);
  });
  it('createdAt is ISO string', async () => {
    const r = await repo.create(reqInput({ requestCode: 'REQ-002' }));
    expect(r.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
  it('requestCode is preserved', async () => {
    const r = await repo.create(reqInput({ requestCode: 'REQ-SPEC' }));
    expect(r.requestCode).toBe('REQ-SPEC');
  });
});

// ─── PLR-02: findByCode ──────────────────────────────────────────────────────

describe('PLR-02 findByCode returns exact match or null', () => {
  let repo: MemoryProcurementRequestRepository;

  beforeEach(async () => {
    repo = new MemoryProcurementRequestRepository();
    await repo.create(reqInput({ requestCode: 'REQ-001' }));
  });

  it('returns request for existing code', async () => {
    expect((await repo.findByCode('REQ-001'))?.requestCode).toBe('REQ-001');
  });
  it('returns null for unknown code', async () => {
    expect(await repo.findByCode('NONE')).toBeNull();
  });
  it('is case-sensitive', async () => {
    expect(await repo.findByCode('req-001')).toBeNull();
  });
});

// ─── PLR-03: findByStatus ────────────────────────────────────────────────────

describe('PLR-03 findByStatus filters correctly', () => {
  let repo: MemoryProcurementRequestRepository;

  beforeEach(async () => {
    repo = new MemoryProcurementRequestRepository();
    await repo.create(reqInput({ requestCode: 'A', status: 'PENDING' }));
    await repo.create(reqInput({ requestCode: 'B', status: 'APPROVED' }));
    await repo.create(reqInput({ requestCode: 'C', status: 'PENDING' }));
  });

  it('PENDING returns 2 requests', async () => {
    expect(await repo.findByStatus('PENDING')).toHaveLength(2);
  });
  it('APPROVED returns 1 request', async () => {
    expect(await repo.findByStatus('APPROVED')).toHaveLength(1);
  });
  it('CANCELLED returns 0 requests', async () => {
    expect(await repo.findByStatus('CANCELLED')).toHaveLength(0);
  });
});

// ─── PLR-04: findByDepartment ────────────────────────────────────────────────

describe('PLR-04 findByDepartment filters correctly', () => {
  let repo: MemoryProcurementRequestRepository;

  beforeEach(async () => {
    repo = new MemoryProcurementRequestRepository();
    await repo.create(reqInput({ requestCode: 'A', department: 'CNTT' }));
    await repo.create(reqInput({ requestCode: 'B', department: 'CNTT' }));
    await repo.create(reqInput({ requestCode: 'C', department: 'TC' }));
  });

  it('CNTT returns 2 requests', async () => {
    expect(await repo.findByDepartment('CNTT')).toHaveLength(2);
  });
  it('TC returns 1 request', async () => {
    expect(await repo.findByDepartment('TC')).toHaveLength(1);
  });
  it('unknown dept returns empty', async () => {
    expect(await repo.findByDepartment('NONE')).toHaveLength(0);
  });
});

// ─── PLR-05: findByPlanId ────────────────────────────────────────────────────

describe('PLR-05 findByPlanId scoped to planId', () => {
  let repo: MemoryProcurementRequestRepository;

  beforeEach(async () => {
    repo = new MemoryProcurementRequestRepository();
    await repo.create(reqInput({ requestCode: 'A', planId: 'plan-1' }));
    await repo.create(reqInput({ requestCode: 'B', planId: 'plan-1' }));
    await repo.create(reqInput({ requestCode: 'C', planId: 'plan-2' }));
  });

  it('plan-1 returns 2 requests', async () => {
    expect(await repo.findByPlanId('plan-1')).toHaveLength(2);
  });
  it('plan-2 returns 1 request', async () => {
    expect(await repo.findByPlanId('plan-2')).toHaveLength(1);
  });
  it('unknown planId returns empty', async () => {
    expect(await repo.findByPlanId('none')).toHaveLength(0);
  });
});

// ─── PLR-06: search by term ──────────────────────────────────────────────────

describe('PLR-06 search by term is case-insensitive', () => {
  let repo: MemoryProcurementRequestRepository;

  beforeEach(async () => {
    repo = new MemoryProcurementRequestRepository();
    await repo.create(reqInput({ requestCode: 'REQ-LAPTOP', needDescription: 'Máy tính xách tay' }));
    await repo.create(reqInput({ requestCode: 'REQ-PRINTER', needDescription: 'Máy in laser' }));
  });

  it('term "laptop" matches requestCode', async () => {
    const r = await repo.search({ term: 'laptop' });
    expect(r.items).toHaveLength(1);
  });
  it('term "máy" matches both', async () => {
    const r = await repo.search({ term: 'máy' });
    expect(r.items).toHaveLength(2);
  });
  it('term "LASER" case-insensitive matches printer', async () => {
    const r = await repo.search({ term: 'LASER' });
    expect(r.items).toHaveLength(1);
  });
});

// ─── PLR-07: search by status + cost ─────────────────────────────────────────

describe('PLR-07 search by status and cost filters', () => {
  let repo: MemoryProcurementRequestRepository;

  beforeEach(async () => {
    repo = new MemoryProcurementRequestRepository();
    await repo.create(reqInput({ requestCode: 'A', status: 'PENDING', estimatedCost: 100_000_000 }));
    await repo.create(reqInput({ requestCode: 'B', status: 'APPROVED', estimatedCost: 500_000_000 }));
    await repo.create(reqInput({ requestCode: 'C', status: 'PENDING', estimatedCost: 200_000_000 }));
  });

  it('filter by status PENDING returns 2', async () => {
    const r = await repo.search({ status: 'PENDING' });
    expect(r.total).toBe(2);
  });
  it('minCost 150M filters correctly', async () => {
    const r = await repo.search({ minCost: 150_000_000 });
    expect(r.total).toBe(2);
  });
  it('maxCost 250M filters correctly', async () => {
    const r = await repo.search({ maxCost: 250_000_000 });
    expect(r.total).toBe(2);
  });
});

// ─── PLR-08: search pagination ───────────────────────────────────────────────

describe('PLR-08 search pagination', () => {
  let repo: MemoryProcurementRequestRepository;

  beforeEach(async () => {
    repo = new MemoryProcurementRequestRepository();
    for (let i = 1; i <= 5; i++) {
      await repo.create(reqInput({ requestCode: `REQ-${i}` }));
    }
  });

  it('default pageSize is 20 — all 5 returned', async () => {
    const r = await repo.search({});
    expect(r.total).toBe(5);
    expect(r.items).toHaveLength(5);
  });
  it('pageSize 2 returns 2 items', async () => {
    const r = await repo.search({ page: 1, pageSize: 2 });
    expect(r.items).toHaveLength(2);
    expect(r.pageSize).toBe(2);
  });
  it('page 2 of pageSize 2 returns items 3-4', async () => {
    const r = await repo.search({ page: 2, pageSize: 2 });
    expect(r.items).toHaveLength(2);
    expect(r.page).toBe(2);
  });
});

// ─── PLR-09: PlanRepo findByFiscalYear ───────────────────────────────────────

describe('PLR-09 ProcurementPlanRepo findByFiscalYear', () => {
  let repo: MemoryProcurementPlanRepository;

  beforeEach(async () => {
    repo = new MemoryProcurementPlanRepository();
    await repo.create(planInput({ fiscalYear: '2026', planNumber: 'P1' }));
    await repo.create(planInput({ fiscalYear: '2026', planNumber: 'P2' }));
    await repo.create(planInput({ fiscalYear: '2027', planNumber: 'P3' }));
  });

  it('2026 returns 2 plans', async () => {
    expect(await repo.findByFiscalYear('2026')).toHaveLength(2);
  });
  it('2027 returns 1 plan', async () => {
    expect(await repo.findByFiscalYear('2027')).toHaveLength(1);
  });
  it('2025 returns empty', async () => {
    expect(await repo.findByFiscalYear('2025')).toHaveLength(0);
  });
});

// ─── PLR-10: PlanRepo findByOrganization + findByStatus ──────────────────────

describe('PLR-10 PlanRepo findByOrganization and findByStatus', () => {
  let repo: MemoryProcurementPlanRepository;

  beforeEach(async () => {
    repo = new MemoryProcurementPlanRepository();
    await repo.create(planInput({ organization: 'DTMS', status: 'DRAFT', planNumber: 'A' }));
    await repo.create(planInput({ organization: 'DTMS', status: 'APPROVED', planNumber: 'B' }));
    await repo.create(planInput({ organization: 'OTHER', status: 'DRAFT', planNumber: 'C' }));
  });

  it('DTMS returns 2 plans', async () => {
    expect(await repo.findByOrganization('DTMS')).toHaveLength(2);
  });
  it('DRAFT returns 2 plans', async () => {
    expect(await repo.findByStatus('DRAFT')).toHaveLength(2);
  });
  it('APPROVED returns 1 plan', async () => {
    expect(await repo.findByStatus('APPROVED')).toHaveLength(1);
  });
});

// ─── PLR-11: PlanRepo findByNumber ───────────────────────────────────────────

describe('PLR-11 PlanRepo findByNumber returns plan or null', () => {
  let repo: MemoryProcurementPlanRepository;

  beforeEach(async () => {
    repo = new MemoryProcurementPlanRepository();
    await repo.create(planInput({ planNumber: 'DTMS/KH-DTMS/2026/001' }));
  });

  it('returns plan for existing number', async () => {
    const p = await repo.findByNumber('DTMS/KH-DTMS/2026/001');
    expect(p?.planNumber).toBe('DTMS/KH-DTMS/2026/001');
  });
  it('returns null for unknown number', async () => {
    expect(await repo.findByNumber('NONE')).toBeNull();
  });
  it('is case-sensitive', async () => {
    expect(await repo.findByNumber('dtms/kh-dtms/2026/001')).toBeNull();
  });
});

// ─── PLR-12: DemandRepo ──────────────────────────────────────────────────────

describe('PLR-12 DemandRepo findByDepartment/findByFiscalYear/findByStatus', () => {
  let repo: MemoryProcurementDemandRepository;

  beforeEach(async () => {
    repo = new MemoryProcurementDemandRepository();
    await repo.create({ demandCode: 'D1', fiscalYear: '2026', department: 'CNTT', requestIds: [], consolidatedCost: 100, status: 'OPEN' });
    await repo.create({ demandCode: 'D2', fiscalYear: '2026', department: 'TC',   requestIds: [], consolidatedCost: 200, status: 'CONSOLIDATED' });
    await repo.create({ demandCode: 'D3', fiscalYear: '2027', department: 'CNTT', requestIds: [], consolidatedCost: 300, status: 'OPEN' });
  });

  it('findByDepartment CNTT returns 2', async () => {
    expect(await repo.findByDepartment('CNTT')).toHaveLength(2);
  });
  it('findByFiscalYear 2026 returns 2', async () => {
    expect(await repo.findByFiscalYear('2026')).toHaveLength(2);
  });
  it('findByStatus OPEN returns 2', async () => {
    expect(await repo.findByStatus('OPEN')).toHaveLength(2);
  });
});

// ─── PLR-13: FundingAllocationRepo ───────────────────────────────────────────

describe('PLR-13 FundingAllocationRepo findByPlanId + sumByPlanId', () => {
  let repo: MemoryFundingAllocationRepository;

  beforeEach(async () => {
    repo = new MemoryFundingAllocationRepository();
    await repo.create(allocInput({ planId: 'plan-1', allocatedAmount: 200_000_000, remainingAmount: 200_000_000 }));
    await repo.create(allocInput({ planId: 'plan-1', allocatedAmount: 300_000_000, remainingAmount: 300_000_000 }));
    await repo.create(allocInput({ planId: 'plan-2', allocatedAmount: 100_000_000, remainingAmount: 100_000_000 }));
  });

  it('findByPlanId plan-1 returns 2 allocations', async () => {
    expect(await repo.findByPlanId('plan-1')).toHaveLength(2);
  });
  it('sumByPlanId plan-1 = 500M', async () => {
    expect(await repo.sumByPlanId('plan-1')).toBe(500_000_000);
  });
  it('sumByPlanId unknown = 0', async () => {
    expect(await repo.sumByPlanId('NONE')).toBe(0);
  });
});
