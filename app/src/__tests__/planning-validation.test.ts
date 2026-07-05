/**
 * Planning validation functions
 *
 * Groups (13 × 3 = 39):
 *   PLV-01  validateUniqueRequestCode — not found/found/excludeId
 *   PLV-02  assertUniqueRequestCode — throws PlanningError(DUPLICATE_CODE)
 *   PLV-03  validateRequiredRequestFields — valid params
 *   PLV-04  validateRequiredRequestFields — missing fields
 *   PLV-05  validateEstimatedCost — >0 valid, ≤0 invalid
 *   PLV-06  validateBudgetYearConsistency — prefix check
 *   PLV-07  validateFundingAvailability — sufficient/insufficient
 *   PLV-08  validateFundingAvailability — warns when <10% buffer
 *   PLV-09  validateRequestsApproved — all approved
 *   PLV-10  validateRequestsApproved — pending request errors
 *   PLV-11  validatePlanHasRequests — with/without
 *   PLV-12  validateFundingBalance — balanced/unbalanced
 *   PLV-13  calculateFundingSummary — groups by fundSourceCode
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  validateUniqueRequestCode, assertUniqueRequestCode,
  validateRequiredRequestFields, validateEstimatedCost,
  validateBudgetYearConsistency, validateFundingAvailability,
  validateRequestsApproved, validatePlanHasRequests,
  validateFundingBalance, calculateFundingSummary,
} from '../procurement/planning/planningValidation';
import { MemoryProcurementRequestRepository } from '../procurement/planning/memoryPlanningRepositories';
import { PlanningError } from '../procurement/planning/planningTypes';
import type { ProcurementPlan, FundingAllocation, CreateRequestParams } from '../procurement/planning/planningTypes';

function makeRepo() { return new MemoryProcurementRequestRepository(); }

function reqParams(o: Partial<CreateRequestParams> = {}): CreateRequestParams {
  return {
    requestCode: 'REQ-001', department: 'CNTT', requester: 'NV001',
    reason: 'Mua máy', needDescription: 'Laptop', estimatedCost: 50_000_000,
    fundingSource: 'STATE', expectedTimeline: '2026-06-01', ...o,
  };
}

function makeAlloc(planId: string, amount: number, remaining: number, fs = 'STATE'): Omit<FundingAllocation, 'id' | 'createdAt' | 'updatedAt'> {
  return { planId, fundSourceCode: fs, allocatedAmount: amount, committedAmount: 0, remainingAmount: remaining, budgetYear: '2026' };
}

function makePlan(requestIds: string[]): ProcurementPlan {
  return {
    id: 'p1', planNumber: 'P001', fiscalYear: '2026', organization: 'DTMS',
    responsibleDepartment: 'CNTT', estimatedTotal: 500_000_000,
    status: 'DRAFT', approvalHistory: [], requestIds, generatedPackageIds: [],
    createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  };
}

// ─── PLV-01: validateUniqueRequestCode ───────────────────────────────────────

describe('PLV-01 validateUniqueRequestCode returns correct boolean', () => {
  it('returns true when code not found', async () => {
    const repo = makeRepo();
    expect(await validateUniqueRequestCode('NEW', repo)).toBe(true);
  });
  it('returns false when code exists', async () => {
    const repo = makeRepo();
    await repo.create({ requestCode: 'REQ-001', department: 'CNTT', requester: 'NV001', reason: 'R', needDescription: 'N', needs: [], estimatedCost: 1, fundingSource: 'STATE', isUrgent: false, expectedTimeline: '2026-01-01', priority: 'MEDIUM', legalBasis: '', status: 'PENDING' });
    expect(await validateUniqueRequestCode('REQ-001', repo)).toBe(false);
  });
  it('returns true when excludeId matches existing', async () => {
    const repo = makeRepo();
    const r = await repo.create({ requestCode: 'REQ-001', department: 'CNTT', requester: 'NV001', reason: 'R', needDescription: 'N', needs: [], estimatedCost: 1, fundingSource: 'STATE', isUrgent: false, expectedTimeline: '2026-01-01', priority: 'MEDIUM', legalBasis: '', status: 'PENDING' });
    expect(await validateUniqueRequestCode('REQ-001', repo, r.id)).toBe(true);
  });
});

// ─── PLV-02: assertUniqueRequestCode ─────────────────────────────────────────

describe('PLV-02 assertUniqueRequestCode throws PlanningError on duplicate', () => {
  it('does not throw for new code', async () => {
    await expect(assertUniqueRequestCode('NEW', makeRepo())).resolves.toBeUndefined();
  });
  it('throws PlanningError for duplicate', async () => {
    const repo = makeRepo();
    await repo.create({ requestCode: 'DUP', department: 'CNTT', requester: 'NV001', reason: 'R', needDescription: 'N', needs: [], estimatedCost: 1, fundingSource: 'STATE', isUrgent: false, expectedTimeline: '2026-01-01', priority: 'MEDIUM', legalBasis: '', status: 'PENDING' });
    await expect(assertUniqueRequestCode('DUP', repo)).rejects.toThrow(PlanningError);
  });
  it('error code is DUPLICATE_CODE', async () => {
    const repo = makeRepo();
    await repo.create({ requestCode: 'DUP', department: 'CNTT', requester: 'NV001', reason: 'R', needDescription: 'N', needs: [], estimatedCost: 1, fundingSource: 'STATE', isUrgent: false, expectedTimeline: '2026-01-01', priority: 'MEDIUM', legalBasis: '', status: 'PENDING' });
    const err = await assertUniqueRequestCode('DUP', repo).catch(e => e);
    expect(err.code).toBe('DUPLICATE_CODE');
  });
});

// ─── PLV-03: validateRequiredRequestFields — valid ───────────────────────────

describe('PLV-03 validateRequiredRequestFields returns valid for complete params', () => {
  it('valid result has valid=true', () => {
    expect(validateRequiredRequestFields(reqParams()).valid).toBe(true);
  });
  it('valid result has empty errors', () => {
    expect(validateRequiredRequestFields(reqParams()).errors).toHaveLength(0);
  });
  it('valid result has empty warnings', () => {
    expect(validateRequiredRequestFields(reqParams()).warnings).toHaveLength(0);
  });
});

// ─── PLV-04: validateRequiredRequestFields — missing ─────────────────────────

describe('PLV-04 validateRequiredRequestFields catches missing fields', () => {
  it('empty requestCode produces error', () => {
    const r = validateRequiredRequestFields(reqParams({ requestCode: '' }));
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => e.includes('requestCode'))).toBe(true);
  });
  it('empty department produces error', () => {
    const r = validateRequiredRequestFields(reqParams({ department: '' }));
    expect(r.valid).toBe(false);
  });
  it('multiple missing fields produce multiple errors', () => {
    const r = validateRequiredRequestFields(reqParams({ reason: '', needDescription: '' }));
    expect(r.errors.length).toBeGreaterThanOrEqual(2);
  });
});

// ─── PLV-05: validateEstimatedCost ───────────────────────────────────────────

describe('PLV-05 validateEstimatedCost validates cost > 0', () => {
  it('positive cost is valid', () => {
    expect(validateEstimatedCost(50_000_000).valid).toBe(true);
  });
  it('zero cost is invalid', () => {
    expect(validateEstimatedCost(0).valid).toBe(false);
  });
  it('negative cost is invalid', () => {
    expect(validateEstimatedCost(-1).valid).toBe(false);
  });
});

// ─── PLV-06: validateBudgetYearConsistency ───────────────────────────────────

describe('PLV-06 validateBudgetYearConsistency checks prefix match', () => {
  it('timeline within fiscal year is consistent', () => {
    expect(validateBudgetYearConsistency('2026', '2026-06-01')).toBe(true);
  });
  it('timeline outside fiscal year is inconsistent', () => {
    expect(validateBudgetYearConsistency('2026', '2027-01-01')).toBe(false);
  });
  it('any date in the correct year is consistent', () => {
    expect(validateBudgetYearConsistency('2026', '2026-12-31')).toBe(true);
  });
});

// ─── PLV-07: validateFundingAvailability — sufficient/insufficient ─────────────

describe('PLV-07 validateFundingAvailability checks availability', () => {
  it('sufficient remaining returns valid', async () => {
    const repo = new (await import('../procurement/planning/memoryPlanningRepositories')).MemoryFundingAllocationRepository();
    const alloc = await repo.create(makeAlloc('p1', 500_000_000, 500_000_000));
    const result = validateFundingAvailability(200_000_000, [alloc]);
    expect(result.valid).toBe(true);
  });
  it('insufficient remaining returns invalid', async () => {
    const repo = new (await import('../procurement/planning/memoryPlanningRepositories')).MemoryFundingAllocationRepository();
    const alloc = await repo.create(makeAlloc('p1', 100_000_000, 50_000_000));
    const result = validateFundingAvailability(200_000_000, [alloc]);
    expect(result.valid).toBe(false);
  });
  it('empty allocations returns invalid', () => {
    const result = validateFundingAvailability(100_000_000, []);
    expect(result.valid).toBe(false);
  });
});

// ─── PLV-08: validateFundingAvailability — 10% buffer warning ────────────────

describe('PLV-08 validateFundingAvailability warns when <10% buffer', () => {
  it('exactly enough triggers warning', async () => {
    const repo = new (await import('../procurement/planning/memoryPlanningRepositories')).MemoryFundingAllocationRepository();
    const alloc = await repo.create(makeAlloc('p1', 100_000_000, 100_000_000));
    const result = validateFundingAvailability(100_000_000, [alloc]);
    expect(result.valid).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
  it('10%+ buffer has no warning', async () => {
    const repo = new (await import('../procurement/planning/memoryPlanningRepositories')).MemoryFundingAllocationRepository();
    const alloc = await repo.create(makeAlloc('p1', 200_000_000, 200_000_000));
    const result = validateFundingAvailability(100_000_000, [alloc]);
    expect(result.warnings).toHaveLength(0);
  });
  it('warning message mentions buffer', async () => {
    const repo = new (await import('../procurement/planning/memoryPlanningRepositories')).MemoryFundingAllocationRepository();
    const alloc = await repo.create(makeAlloc('p1', 105_000_000, 105_000_000));
    const result = validateFundingAvailability(100_000_000, [alloc]);
    expect(result.warnings[0]).toMatch(/10%|buffer/i);
  });
});

// ─── PLV-09: validateRequestsApproved — all approved ─────────────────────────

describe('PLV-09 validateRequestsApproved returns valid when all approved', () => {
  it('all APPROVED returns valid', async () => {
    const repo = makeRepo();
    const r = await repo.create({ requestCode: 'A', department: 'D', requester: 'U', reason: 'R', needDescription: 'N', needs: [], estimatedCost: 1, fundingSource: 'S', isUrgent: false, expectedTimeline: '2026-01-01', priority: 'MEDIUM', legalBasis: '', status: 'APPROVED' });
    const result = await validateRequestsApproved([r.id], repo);
    expect(result.valid).toBe(true);
  });
  it('empty requestIds returns valid', async () => {
    const result = await validateRequestsApproved([], makeRepo());
    expect(result.valid).toBe(true);
  });
  it('errors are empty when all approved', async () => {
    const repo = makeRepo();
    const r = await repo.create({ requestCode: 'A', department: 'D', requester: 'U', reason: 'R', needDescription: 'N', needs: [], estimatedCost: 1, fundingSource: 'S', isUrgent: false, expectedTimeline: '2026-01-01', priority: 'MEDIUM', legalBasis: '', status: 'APPROVED' });
    const result = await validateRequestsApproved([r.id], repo);
    expect(result.errors).toHaveLength(0);
  });
});

// ─── PLV-10: validateRequestsApproved — pending errors ───────────────────────

describe('PLV-10 validateRequestsApproved errors on non-APPROVED', () => {
  it('PENDING request produces error', async () => {
    const repo = makeRepo();
    const r = await repo.create({ requestCode: 'A', department: 'D', requester: 'U', reason: 'R', needDescription: 'N', needs: [], estimatedCost: 1, fundingSource: 'S', isUrgent: false, expectedTimeline: '2026-01-01', priority: 'MEDIUM', legalBasis: '', status: 'PENDING' });
    const result = await validateRequestsApproved([r.id], repo);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('PENDING');
  });
  it('missing id produces error', async () => {
    const result = await validateRequestsApproved(['ghost-id'], makeRepo());
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('ghost-id');
  });
  it('error message contains request code when available', async () => {
    const repo = makeRepo();
    const r = await repo.create({ requestCode: 'REQ-BAD', department: 'D', requester: 'U', reason: 'R', needDescription: 'N', needs: [], estimatedCost: 1, fundingSource: 'S', isUrgent: false, expectedTimeline: '2026-01-01', priority: 'MEDIUM', legalBasis: '', status: 'PENDING' });
    const result = await validateRequestsApproved([r.id], repo);
    expect(result.errors[0]).toContain('REQ-BAD');
  });
});

// ─── PLV-11: validatePlanHasRequests ─────────────────────────────────────────

describe('PLV-11 validatePlanHasRequests checks non-empty requestIds', () => {
  it('plan with requests is valid', () => {
    expect(validatePlanHasRequests(makePlan(['r1'])).valid).toBe(true);
  });
  it('plan with no requests is invalid', () => {
    expect(validatePlanHasRequests(makePlan([])).valid).toBe(false);
  });
  it('error message mentions request', () => {
    expect(validatePlanHasRequests(makePlan([])).errors[0]).toContain('request');
  });
});

// ─── PLV-12: validateFundingBalance ──────────────────────────────────────────

describe('PLV-12 validateFundingBalance checks allocations >= estimatedTotal', () => {
  it('allocations >= total is valid', async () => {
    const repo = new (await import('../procurement/planning/memoryPlanningRepositories')).MemoryFundingAllocationRepository();
    const alloc = await repo.create(makeAlloc('p1', 600_000_000, 600_000_000));
    expect(validateFundingBalance(500_000_000, [alloc]).valid).toBe(true);
  });
  it('allocations < total is invalid', async () => {
    const repo = new (await import('../procurement/planning/memoryPlanningRepositories')).MemoryFundingAllocationRepository();
    const alloc = await repo.create(makeAlloc('p1', 100_000_000, 100_000_000));
    expect(validateFundingBalance(500_000_000, [alloc]).valid).toBe(false);
  });
  it('empty allocations warns', () => {
    const result = validateFundingBalance(500_000_000, []);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

// ─── PLV-13: calculateFundingSummary ─────────────────────────────────────────

describe('PLV-13 calculateFundingSummary groups by fundSourceCode', () => {
  it('two allocations from same source merge into one summary', async () => {
    const repo = new (await import('../procurement/planning/memoryPlanningRepositories')).MemoryFundingAllocationRepository();
    const a1 = await repo.create(makeAlloc('p1', 200_000_000, 200_000_000, 'STATE'));
    const a2 = await repo.create(makeAlloc('p1', 300_000_000, 300_000_000, 'STATE'));
    const summaries = calculateFundingSummary([a1, a2]);
    expect(summaries).toHaveLength(1);
    expect(summaries[0]!.allocatedAmount).toBe(500_000_000);
  });
  it('different sources produce separate summaries', async () => {
    const repo = new (await import('../procurement/planning/memoryPlanningRepositories')).MemoryFundingAllocationRepository();
    const a1 = await repo.create(makeAlloc('p1', 200_000_000, 200_000_000, 'STATE'));
    const a2 = await repo.create(makeAlloc('p1', 100_000_000, 100_000_000, 'ODA'));
    const summaries = calculateFundingSummary([a1, a2]);
    expect(summaries).toHaveLength(2);
  });
  it('empty allocations returns empty array', () => {
    expect(calculateFundingSummary([])).toHaveLength(0);
  });
});
