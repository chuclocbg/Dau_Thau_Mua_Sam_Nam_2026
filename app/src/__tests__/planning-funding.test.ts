/**
 * FundingAllocation, AnnualProcurementPlan, ProcurementDemand repos + calculateFunding
 *
 * Groups (13 × 3 = 39):
 *   PLF-01  FundingAllocation create() — id/timestamps
 *   PLF-02  findByPlanId scoped to plan
 *   PLF-03  sumByPlanId sums allocatedAmount
 *   PLF-04  sumByPlanId returns 0 for empty
 *   PLF-05  update() changes committedAmount
 *   PLF-06  calculateFunding() groups by fundSourceCode
 *   PLF-07  calculateFunding() sums amounts across sources
 *   PLF-08  AnnualProcurementPlan create/findByFiscalYear
 *   PLF-09  AnnualProcurementPlan findByOrganization
 *   PLF-10  AnnualProcurementPlan status lifecycle (update)
 *   PLF-11  ProcurementDemand create/findByDepartment
 *   PLF-12  ProcurementDemand findByFiscalYear + findByStatus
 *   PLF-13  createMemoryPlanningRepositories() — 6 repos all start empty
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  MemoryFundingAllocationRepository, MemoryAnnualProcurementPlanRepository,
  MemoryProcurementDemandRepository, createMemoryPlanningRepositories,
} from '../procurement/planning/memoryPlanningRepositories';
import { calculateFunding } from '../procurement/planning/planningService';
import type { FundingAllocation, AnnualProcurementPlan } from '../procurement/planning/planningTypes';

type AllocInput = Omit<FundingAllocation, 'id' | 'createdAt' | 'updatedAt'>;
type AnnualInput = Omit<AnnualProcurementPlan, 'id' | 'createdAt' | 'updatedAt'>;

function allocInput(o: Partial<AllocInput> = {}): AllocInput {
  return {
    planId: 'plan-001', fundSourceCode: 'STATE',
    allocatedAmount: 500_000_000, committedAmount: 0, remainingAmount: 500_000_000,
    budgetYear: '2026', ...o,
  };
}

function annualInput(o: Partial<AnnualInput> = {}): AnnualInput {
  return {
    annualPlanCode: 'APP-2026-001', fiscalYear: '2026', organization: 'DTMS',
    totalBudget: 10_000_000_000, planIds: [], status: 'DRAFT', ...o,
  };
}

// ─── PLF-01: FundingAllocation create() ──────────────────────────────────────

describe('PLF-01 FundingAllocation create() generates id and timestamps', () => {
  const repo = new MemoryFundingAllocationRepository();

  it('returns allocation with id', async () => {
    const a = await repo.create(allocInput());
    expect(a.id.length).toBeGreaterThan(0);
  });
  it('createdAt is ISO string', async () => {
    const a = await repo.create(allocInput({ planId: 'P2' }));
    expect(a.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
  it('allocatedAmount preserved', async () => {
    const a = await repo.create(allocInput({ allocatedAmount: 1_000_000_000 }));
    expect(a.allocatedAmount).toBe(1_000_000_000);
  });
});

// ─── PLF-02: findByPlanId ────────────────────────────────────────────────────

describe('PLF-02 findByPlanId scoped to plan', () => {
  let repo: MemoryFundingAllocationRepository;

  beforeEach(async () => {
    repo = new MemoryFundingAllocationRepository();
    await repo.create(allocInput({ planId: 'P1' }));
    await repo.create(allocInput({ planId: 'P1', fundSourceCode: 'ODA' }));
    await repo.create(allocInput({ planId: 'P2' }));
  });

  it('P1 returns 2 allocations', async () => {
    expect(await repo.findByPlanId('P1')).toHaveLength(2);
  });
  it('P2 returns 1 allocation', async () => {
    expect(await repo.findByPlanId('P2')).toHaveLength(1);
  });
  it('unknown plan returns empty', async () => {
    expect(await repo.findByPlanId('NONE')).toHaveLength(0);
  });
});

// ─── PLF-03: sumByPlanId ─────────────────────────────────────────────────────

describe('PLF-03 sumByPlanId sums allocatedAmount', () => {
  let repo: MemoryFundingAllocationRepository;

  beforeEach(async () => {
    repo = new MemoryFundingAllocationRepository();
    await repo.create(allocInput({ planId: 'P1', allocatedAmount: 200_000_000, remainingAmount: 200_000_000 }));
    await repo.create(allocInput({ planId: 'P1', allocatedAmount: 300_000_000, remainingAmount: 300_000_000, fundSourceCode: 'ODA' }));
    await repo.create(allocInput({ planId: 'P2', allocatedAmount: 100_000_000, remainingAmount: 100_000_000 }));
  });

  it('P1 sum = 500M', async () => {
    expect(await repo.sumByPlanId('P1')).toBe(500_000_000);
  });
  it('P2 sum = 100M', async () => {
    expect(await repo.sumByPlanId('P2')).toBe(100_000_000);
  });
  it('unknown plan sum = 0', async () => {
    expect(await repo.sumByPlanId('NONE')).toBe(0);
  });
});

// ─── PLF-04: sumByPlanId returns 0 ───────────────────────────────────────────

describe('PLF-04 sumByPlanId returns 0 for empty repo', () => {
  it('empty repo returns 0', async () => {
    expect(await new MemoryFundingAllocationRepository().sumByPlanId('ANY')).toBe(0);
  });
  it('after delete all returns 0', async () => {
    const repo = new MemoryFundingAllocationRepository();
    const a = await repo.create(allocInput());
    await repo.delete(a.id);
    expect(await repo.sumByPlanId('plan-001')).toBe(0);
  });
  it('additive as allocations are created', async () => {
    const repo = new MemoryFundingAllocationRepository();
    await repo.create(allocInput({ allocatedAmount: 100, remainingAmount: 100 }));
    expect(await repo.sumByPlanId('plan-001')).toBe(100);
    await repo.create(allocInput({ allocatedAmount: 200, remainingAmount: 200, fundSourceCode: 'ODA' }));
    expect(await repo.sumByPlanId('plan-001')).toBe(300);
  });
});

// ─── PLF-05: update() changes committedAmount ────────────────────────────────

describe('PLF-05 update() changes committedAmount', () => {
  let repo: MemoryFundingAllocationRepository;
  let alloc: FundingAllocation;

  beforeEach(async () => {
    repo = new MemoryFundingAllocationRepository();
    alloc = await repo.create(allocInput());
  });

  it('committedAmount is updated', async () => {
    const u = await repo.update(alloc.id, { committedAmount: 100_000_000 });
    expect(u.committedAmount).toBe(100_000_000);
  });
  it('remainingAmount can be updated independently', async () => {
    const u = await repo.update(alloc.id, { remainingAmount: 400_000_000 });
    expect(u.remainingAmount).toBe(400_000_000);
  });
  it('updatedAt changes', async () => {
    const u = await repo.update(alloc.id, { committedAmount: 50_000_000 });
    expect(u.updatedAt).toBeDefined();
  });
});

// ─── PLF-06: calculateFunding() groups by fundSourceCode ─────────────────────

describe('PLF-06 calculateFunding() groups by fundSourceCode', () => {
  it('two allocations from same source produce one summary', async () => {
    const repo = new MemoryFundingAllocationRepository();
    const a1 = await repo.create(allocInput({ allocatedAmount: 100, remainingAmount: 100 }));
    const a2 = await repo.create(allocInput({ allocatedAmount: 200, remainingAmount: 200 }));
    const summaries = calculateFunding([a1, a2]);
    expect(summaries).toHaveLength(1);
  });
  it('different sources produce separate summaries', async () => {
    const repo = new MemoryFundingAllocationRepository();
    const a1 = await repo.create(allocInput({ fundSourceCode: 'STATE', allocatedAmount: 100, remainingAmount: 100 }));
    const a2 = await repo.create(allocInput({ fundSourceCode: 'ODA', allocatedAmount: 200, remainingAmount: 200 }));
    expect(calculateFunding([a1, a2])).toHaveLength(2);
  });
  it('empty input returns empty array', () => {
    expect(calculateFunding([])).toHaveLength(0);
  });
});

// ─── PLF-07: calculateFunding() sums amounts ─────────────────────────────────

describe('PLF-07 calculateFunding() sums amounts per source', () => {
  it('allocatedAmount summed for same source', async () => {
    const repo = new MemoryFundingAllocationRepository();
    const a1 = await repo.create(allocInput({ allocatedAmount: 300_000_000, remainingAmount: 300_000_000 }));
    const a2 = await repo.create(allocInput({ allocatedAmount: 200_000_000, remainingAmount: 200_000_000 }));
    const s = calculateFunding([a1, a2]);
    expect(s[0]!.allocatedAmount).toBe(500_000_000);
  });
  it('remainingAmount summed correctly', async () => {
    const repo = new MemoryFundingAllocationRepository();
    const a1 = await repo.create(allocInput({ allocatedAmount: 500_000_000, committedAmount: 100_000_000, remainingAmount: 400_000_000 }));
    const a2 = await repo.create(allocInput({ allocatedAmount: 300_000_000, committedAmount: 50_000_000, remainingAmount: 250_000_000 }));
    const s = calculateFunding([a1, a2]);
    expect(s[0]!.remainingAmount).toBe(650_000_000);
  });
  it('committedAmount summed correctly', async () => {
    const repo = new MemoryFundingAllocationRepository();
    const a1 = await repo.create(allocInput({ committedAmount: 100_000_000, remainingAmount: 400_000_000 }));
    const a2 = await repo.create(allocInput({ committedAmount: 200_000_000, remainingAmount: 300_000_000 }));
    const s = calculateFunding([a1, a2]);
    expect(s[0]!.committedAmount).toBe(300_000_000);
  });
});

// ─── PLF-08: AnnualProcurementPlan findByFiscalYear ──────────────────────────

describe('PLF-08 AnnualProcurementPlan create/findByFiscalYear', () => {
  let repo: MemoryAnnualProcurementPlanRepository;

  beforeEach(async () => {
    repo = new MemoryAnnualProcurementPlanRepository();
    await repo.create(annualInput({ fiscalYear: '2026', annualPlanCode: 'APP-2026' }));
    await repo.create(annualInput({ fiscalYear: '2027', annualPlanCode: 'APP-2027' }));
  });

  it('findByFiscalYear 2026 returns 1', async () => {
    expect(await repo.findByFiscalYear('2026')).toHaveLength(1);
  });
  it('findByFiscalYear 2027 returns 1', async () => {
    expect(await repo.findByFiscalYear('2027')).toHaveLength(1);
  });
  it('findByFiscalYear unknown returns empty', async () => {
    expect(await repo.findByFiscalYear('2025')).toHaveLength(0);
  });
});

// ─── PLF-09: AnnualProcurementPlan findByOrganization ────────────────────────

describe('PLF-09 AnnualProcurementPlan findByOrganization', () => {
  let repo: MemoryAnnualProcurementPlanRepository;

  beforeEach(async () => {
    repo = new MemoryAnnualProcurementPlanRepository();
    await repo.create(annualInput({ organization: 'DTMS', annualPlanCode: 'A1' }));
    await repo.create(annualInput({ organization: 'DTMS', annualPlanCode: 'A2' }));
    await repo.create(annualInput({ organization: 'OTHER', annualPlanCode: 'A3' }));
  });

  it('DTMS returns 2', async () => {
    expect(await repo.findByOrganization('DTMS')).toHaveLength(2);
  });
  it('OTHER returns 1', async () => {
    expect(await repo.findByOrganization('OTHER')).toHaveLength(1);
  });
  it('findByCode works', async () => {
    expect((await repo.findByCode('A1'))?.annualPlanCode).toBe('A1');
    expect(await repo.findByCode('NONE')).toBeNull();
  });
});

// ─── PLF-10: AnnualProcurementPlan status lifecycle ──────────────────────────

describe('PLF-10 AnnualProcurementPlan status lifecycle', () => {
  let repo: MemoryAnnualProcurementPlanRepository;
  let plan: AnnualProcurementPlan;

  beforeEach(async () => {
    repo = new MemoryAnnualProcurementPlanRepository();
    plan = await repo.create(annualInput());
  });

  it('initial status is DRAFT', () => { expect(plan.status).toBe('DRAFT'); });
  it('status can be updated to SUBMITTED', async () => {
    const u = await repo.update(plan.id, { status: 'SUBMITTED', submittedAt: new Date().toISOString() });
    expect(u.status).toBe('SUBMITTED');
  });
  it('status can be updated to APPROVED with approvedBudget', async () => {
    const u = await repo.update(plan.id, { status: 'APPROVED', approvedBudget: 9_000_000_000 });
    expect(u.status).toBe('APPROVED');
    expect(u.approvedBudget).toBe(9_000_000_000);
  });
});

// ─── PLF-11: ProcurementDemand create/findByDepartment ───────────────────────

describe('PLF-11 ProcurementDemand create/findByDepartment', () => {
  let repo: MemoryProcurementDemandRepository;

  beforeEach(async () => {
    repo = new MemoryProcurementDemandRepository();
    await repo.create({ demandCode: 'D1', fiscalYear: '2026', department: 'CNTT', requestIds: ['r1'], consolidatedCost: 100_000_000, status: 'OPEN' });
    await repo.create({ demandCode: 'D2', fiscalYear: '2026', department: 'CNTT', requestIds: ['r2'], consolidatedCost: 200_000_000, status: 'CONSOLIDATED' });
    await repo.create({ demandCode: 'D3', fiscalYear: '2026', department: 'TC',   requestIds: ['r3'], consolidatedCost: 300_000_000, status: 'OPEN' });
  });

  it('findByDepartment CNTT returns 2', async () => {
    expect(await repo.findByDepartment('CNTT')).toHaveLength(2);
  });
  it('findByDepartment TC returns 1', async () => {
    expect(await repo.findByDepartment('TC')).toHaveLength(1);
  });
  it('demand consolidatedCost preserved', async () => {
    const demands = await repo.findByDepartment('CNTT');
    expect(demands.some(d => d.consolidatedCost === 200_000_000)).toBe(true);
  });
});

// ─── PLF-12: ProcurementDemand findByFiscalYear + findByStatus ───────────────

describe('PLF-12 ProcurementDemand findByFiscalYear and findByStatus', () => {
  let repo: MemoryProcurementDemandRepository;

  beforeEach(async () => {
    repo = new MemoryProcurementDemandRepository();
    await repo.create({ demandCode: 'D1', fiscalYear: '2026', department: 'CNTT', requestIds: [], consolidatedCost: 100, status: 'OPEN' });
    await repo.create({ demandCode: 'D2', fiscalYear: '2027', department: 'TC',   requestIds: [], consolidatedCost: 200, status: 'SUBMITTED' });
    await repo.create({ demandCode: 'D3', fiscalYear: '2026', department: 'TC',   requestIds: [], consolidatedCost: 300, status: 'CONSOLIDATED' });
  });

  it('findByFiscalYear 2026 returns 2', async () => {
    expect(await repo.findByFiscalYear('2026')).toHaveLength(2);
  });
  it('findByStatus OPEN returns 1', async () => {
    expect(await repo.findByStatus('OPEN')).toHaveLength(1);
  });
  it('findByStatus SUBMITTED returns 1', async () => {
    expect(await repo.findByStatus('SUBMITTED')).toHaveLength(1);
  });
});

// ─── PLF-13: createMemoryPlanningRepositories() ──────────────────────────────

describe('PLF-13 createMemoryPlanningRepositories() creates 6 repos', () => {
  it('all 6 repo keys present', () => {
    const repos = createMemoryPlanningRepositories();
    for (const k of ['requests', 'plans', 'demands', 'allocations', 'proposals', 'annualPlans']) {
      expect(repos).toHaveProperty(k);
    }
  });
  it('all start empty', async () => {
    const repos = createMemoryPlanningRepositories();
    for (const repo of Object.values(repos)) {
      expect(await repo.count()).toBe(0);
    }
  });
  it('two factory calls produce independent sets', async () => {
    const a = createMemoryPlanningRepositories();
    const b = createMemoryPlanningRepositories();
    await a.allocations.create(allocInput());
    expect(await b.allocations.count()).toBe(0);
  });
});
