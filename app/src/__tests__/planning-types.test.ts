/**
 * Planning types, enums, guards, and error class
 *
 * Groups (13 × 3 = 39):
 *   PL-01  REQUEST_STATUSES — 5 values
 *   PL-02  REQUEST_PRIORITIES — 4 values
 *   PL-03  PLAN_STATUSES — 6 values
 *   PL-04  PROPOSAL_STATUSES — 4 values
 *   PL-05  ANNUAL_PLAN_STATUSES — 5 values
 *   PL-06  DEMAND_STATUSES — 3 values
 *   PL-07  ProcurementRequest shape
 *   PL-08  ProcurementPlan shape
 *   PL-09  ProcurementNeed embedded shape
 *   PL-10  FundingAllocation shape
 *   PL-11  PackageProposal shape
 *   PL-12  PlanningError code/field/name
 *   PL-13  type guards
 */

import { describe, it, expect } from 'vitest';
import {
  REQUEST_STATUSES, REQUEST_PRIORITIES, PLAN_STATUSES,
  PROPOSAL_STATUSES, ANNUAL_PLAN_STATUSES, DEMAND_STATUSES,
  PlanningError,
  isRequestStatus, isPlanStatus, isRequestPriority, isProposalStatus,
} from '../procurement/planning/planningTypes';
import type {
  ProcurementRequest, ProcurementPlan, ProcurementNeed,
  FundingAllocation, PackageProposal, ProcurementDemand, AnnualProcurementPlan,
} from '../procurement/planning/planningTypes';

// ─── PL-01: REQUEST_STATUSES ──────────────────────────────────────────────────

describe('PL-01 REQUEST_STATUSES has 5 values', () => {
  it('length is 5', () => { expect(REQUEST_STATUSES.length).toBe(5); });
  it('contains PENDING', () => { expect(REQUEST_STATUSES).toContain('PENDING'); });
  it('contains MERGED and CANCELLED', () => {
    expect(REQUEST_STATUSES).toContain('MERGED');
    expect(REQUEST_STATUSES).toContain('CANCELLED');
  });
});

// ─── PL-02: REQUEST_PRIORITIES ───────────────────────────────────────────────

describe('PL-02 REQUEST_PRIORITIES has 4 values', () => {
  it('length is 4', () => { expect(REQUEST_PRIORITIES.length).toBe(4); });
  it('contains LOW and CRITICAL', () => {
    expect(REQUEST_PRIORITIES).toContain('LOW');
    expect(REQUEST_PRIORITIES).toContain('CRITICAL');
  });
  it('contains MEDIUM and HIGH', () => {
    expect(REQUEST_PRIORITIES).toContain('MEDIUM');
    expect(REQUEST_PRIORITIES).toContain('HIGH');
  });
});

// ─── PL-03: PLAN_STATUSES ────────────────────────────────────────────────────

describe('PL-03 PLAN_STATUSES has 6 values', () => {
  it('length is 6', () => { expect(PLAN_STATUSES.length).toBe(6); });
  it('contains DRAFT and APPROVED', () => {
    expect(PLAN_STATUSES).toContain('DRAFT');
    expect(PLAN_STATUSES).toContain('APPROVED');
  });
  it('contains CLOSED and CANCELLED', () => {
    expect(PLAN_STATUSES).toContain('CLOSED');
    expect(PLAN_STATUSES).toContain('CANCELLED');
  });
});

// ─── PL-04: PROPOSAL_STATUSES ────────────────────────────────────────────────

describe('PL-04 PROPOSAL_STATUSES has 4 values', () => {
  it('length is 4', () => { expect(PROPOSAL_STATUSES.length).toBe(4); });
  it('contains DRAFT and CONVERTED', () => {
    expect(PROPOSAL_STATUSES).toContain('DRAFT');
    expect(PROPOSAL_STATUSES).toContain('CONVERTED');
  });
  it('contains APPROVED and REJECTED', () => {
    expect(PROPOSAL_STATUSES).toContain('APPROVED');
    expect(PROPOSAL_STATUSES).toContain('REJECTED');
  });
});

// ─── PL-05: ANNUAL_PLAN_STATUSES ─────────────────────────────────────────────

describe('PL-05 ANNUAL_PLAN_STATUSES has 5 values', () => {
  it('length is 5', () => { expect(ANNUAL_PLAN_STATUSES.length).toBe(5); });
  it('contains DRAFT and CLOSED', () => {
    expect(ANNUAL_PLAN_STATUSES).toContain('DRAFT');
    expect(ANNUAL_PLAN_STATUSES).toContain('CLOSED');
  });
  it('contains ACTIVE', () => { expect(ANNUAL_PLAN_STATUSES).toContain('ACTIVE'); });
});

// ─── PL-06: DEMAND_STATUSES ──────────────────────────────────────────────────

describe('PL-06 DEMAND_STATUSES has 3 values', () => {
  it('length is 3', () => { expect(DEMAND_STATUSES.length).toBe(3); });
  it('contains OPEN', () => { expect(DEMAND_STATUSES).toContain('OPEN'); });
  it('contains CONSOLIDATED and SUBMITTED', () => {
    expect(DEMAND_STATUSES).toContain('CONSOLIDATED');
    expect(DEMAND_STATUSES).toContain('SUBMITTED');
  });
});

// ─── PL-07: ProcurementRequest shape ─────────────────────────────────────────

describe('PL-07 ProcurementRequest interface shape', () => {
  const req: ProcurementRequest = {
    id: 'r1', requestCode: 'REQ-001', department: 'CNTT', requester: 'NV001',
    reason: 'Mua máy tính', needDescription: 'Laptop Core i7', needs: [],
    estimatedCost: 50_000_000, fundingSource: 'STATE', isUrgent: false,
    expectedTimeline: '2026-06-01', priority: 'MEDIUM', legalBasis: 'QD 123',
    status: 'PENDING', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  };
  it('has requestCode', () => { expect(req.requestCode).toBe('REQ-001'); });
  it('has estimatedCost and fundingSource', () => {
    expect(req.estimatedCost).toBe(50_000_000);
    expect(req.fundingSource).toBe('STATE');
  });
  it('isUrgent defaults to false and status is PENDING', () => {
    expect(req.isUrgent).toBe(false);
    expect(req.status).toBe('PENDING');
  });
});

// ─── PL-08: ProcurementPlan shape ────────────────────────────────────────────

describe('PL-08 ProcurementPlan interface shape', () => {
  const plan: ProcurementPlan = {
    id: 'p1', planNumber: 'DTMS/KH-DTMS/2026/001', fiscalYear: '2026',
    organization: 'DTMS', responsibleDepartment: 'CNTT',
    estimatedTotal: 500_000_000, status: 'DRAFT',
    approvalHistory: [], requestIds: ['r1', 'r2'], generatedPackageIds: [],
    createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  };
  it('has planNumber and fiscalYear', () => {
    expect(plan.planNumber).toContain('2026');
    expect(plan.fiscalYear).toBe('2026');
  });
  it('approvalHistory and generatedPackageIds start empty', () => {
    expect(plan.approvalHistory).toHaveLength(0);
    expect(plan.generatedPackageIds).toHaveLength(0);
  });
  it('requestIds has 2 entries', () => { expect(plan.requestIds).toHaveLength(2); });
});

// ─── PL-09: ProcurementNeed embedded shape ───────────────────────────────────

describe('PL-09 ProcurementNeed is embedded in ProcurementRequest', () => {
  const need: ProcurementNeed = {
    needCode: 'N-001', description: 'Laptop', category: 'CNTT',
    quantity: 5, unit: 'chiếc', estimatedUnitCost: 20_000_000, estimatedTotal: 100_000_000,
  };
  it('has quantity and unit', () => {
    expect(need.quantity).toBe(5);
    expect(need.unit).toBe('chiếc');
  });
  it('estimatedTotal = quantity × estimatedUnitCost', () => {
    expect(need.estimatedTotal).toBe(need.quantity * need.estimatedUnitCost);
  });
  it('can be embedded in request.needs array', () => {
    const req: Pick<ProcurementRequest, 'needs'> = { needs: [need] };
    expect(req.needs[0]?.needCode).toBe('N-001');
  });
});

// ─── PL-10: FundingAllocation shape ──────────────────────────────────────────

describe('PL-10 FundingAllocation interface shape', () => {
  const alloc: FundingAllocation = {
    id: 'fa1', planId: 'p1', fundSourceCode: 'STATE',
    allocatedAmount: 500_000_000, committedAmount: 100_000_000, remainingAmount: 400_000_000,
    budgetYear: '2026', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  };
  it('has planId and fundSourceCode', () => {
    expect(alloc.planId).toBe('p1');
    expect(alloc.fundSourceCode).toBe('STATE');
  });
  it('remainingAmount = allocated − committed', () => {
    expect(alloc.remainingAmount).toBe(alloc.allocatedAmount - alloc.committedAmount);
  });
  it('has budgetYear', () => { expect(alloc.budgetYear).toBe('2026'); });
});

// ─── PL-11: PackageProposal shape ────────────────────────────────────────────

describe('PL-11 PackageProposal interface shape', () => {
  const proposal: PackageProposal = {
    id: 'pp1', proposalCode: 'PROP-001', planId: 'p1',
    requestIds: ['r1', 'r2'], proposedPackageType: 'GOODS',
    proposedMethod: 'OPEN_TENDER', estimatedValue: 300_000_000,
    fundSource: 'STATE', justification: 'Mua máy tính', status: 'DRAFT',
    createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  };
  it('has proposalCode and planId', () => {
    expect(proposal.proposalCode).toBe('PROP-001');
    expect(proposal.planId).toBe('p1');
  });
  it('requestIds has 2 entries', () => { expect(proposal.requestIds).toHaveLength(2); });
  it('status is DRAFT initially', () => { expect(proposal.status).toBe('DRAFT'); });
});

// ─── PL-12: PlanningError ────────────────────────────────────────────────────

describe('PL-12 PlanningError has code, field, and name', () => {
  const err = new PlanningError('DUPLICATE_CODE', 'requestCode', 'Code exists: REQ-001');
  it('code is DUPLICATE_CODE', () => { expect(err.code).toBe('DUPLICATE_CODE'); });
  it('field is requestCode', () => { expect(err.field).toBe('requestCode'); });
  it('name is PlanningError and message is set', () => {
    expect(err.name).toBe('PlanningError');
    expect(err.message).toContain('REQ-001');
  });
});

// ─── PL-13: type guards ──────────────────────────────────────────────────────

describe('PL-13 type guards validate enum membership', () => {
  it('isRequestStatus returns true for valid values', () => {
    expect(isRequestStatus('PENDING')).toBe(true);
    expect(isRequestStatus('MERGED')).toBe(true);
    expect(isRequestStatus('INVALID')).toBe(false);
  });
  it('isPlanStatus returns true for valid values', () => {
    expect(isPlanStatus('DRAFT')).toBe(true);
    expect(isPlanStatus('ACTIVE')).toBe(true);
    expect(isPlanStatus('NONE')).toBe(false);
  });
  it('isRequestPriority and isProposalStatus work correctly', () => {
    expect(isRequestPriority('CRITICAL')).toBe(true);
    expect(isRequestPriority('EXTREME')).toBe(false);
    expect(isProposalStatus('CONVERTED')).toBe(true);
    expect(isProposalStatus('DONE')).toBe(false);
  });
});
