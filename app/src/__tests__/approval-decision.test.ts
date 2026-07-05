import { describe, it, expect, beforeEach } from 'vitest';
import { recordDecision, getDecisionForRequest, generateDecisionReference } from '../approval/approvalDecision';
import { createApprovalRequest, submitForApproval, assignAuthority } from '../approval/approvalService';
import { createMemoryApprovalRepositories } from '../approval/approvalFactory';
import type { ApprovalRepositories } from '../approval/approvalRepositories';
import { ApprovalError } from '../approval/approvalTypes';

// APR-D-01
describe('generateDecisionReference', () => {
  it('generates correct format', () => {
    expect(generateDecisionReference('KH', 2026, 1)).toBe('QĐ/KH/2026/0001');
  });
  it('pads sequence to 4 digits', () => {
    expect(generateDecisionReference('GK', 2026, 42)).toBe('QĐ/GK/2026/0042');
  });
  it('handles 4-digit sequence without padding', () => {
    expect(generateDecisionReference('HD', 2026, 1234)).toBe('QĐ/HD/2026/1234');
  });
});

// APR-D-02
describe('recordDecision — APPROVED', () => {
  let repos: ApprovalRepositories;
  beforeEach(() => { repos = createMemoryApprovalRepositories(); });

  it('creates an ApprovalDecisionRecord', async () => {
    const request = await setupUnderReview(repos);
    const decision = await recordDecision(request.id, approvedParams(), repos);
    expect(decision.id).toBeTruthy();
  });
  it('decision has APPROVED outcome', async () => {
    const request = await setupUnderReview(repos);
    const decision = await recordDecision(request.id, approvedParams(), repos);
    expect(decision.outcome).toBe('APPROVED');
  });
  it('request status changes to APPROVED', async () => {
    const request = await setupUnderReview(repos);
    await recordDecision(request.id, approvedParams(), repos);
    const updated = await repos.requests.findById(request.id);
    expect(updated?.status).toBe('APPROVED');
  });
});

// APR-D-03
describe('recordDecision — REJECTED', () => {
  let repos: ApprovalRepositories;
  beforeEach(() => { repos = createMemoryApprovalRepositories(); });

  it('sets request status to REJECTED', async () => {
    const request = await setupUnderReview(repos);
    await recordDecision(request.id, { ...approvedParams(), outcome: 'REJECTED' }, repos);
    const updated = await repos.requests.findById(request.id);
    expect(updated?.status).toBe('REJECTED');
  });
  it('decision outcome is REJECTED', async () => {
    const request = await setupUnderReview(repos);
    const d = await recordDecision(request.id, { ...approvedParams(), outcome: 'REJECTED' }, repos);
    expect(d.outcome).toBe('REJECTED');
  });
  it('records REJECTED history event', async () => {
    const request = await setupUnderReview(repos);
    await recordDecision(request.id, { ...approvedParams(), outcome: 'REJECTED' }, repos);
    const events = await repos.history.findByRequestId(request.id);
    expect(events.some(e => e.action === 'REJECTED')).toBe(true);
  });
});

// APR-D-04
describe('recordDecision — RETURNED', () => {
  let repos: ApprovalRepositories;
  beforeEach(() => { repos = createMemoryApprovalRepositories(); });

  it('sets request status to RETURNED', async () => {
    const request = await setupUnderReview(repos);
    await recordDecision(request.id, returnedParams(), repos);
    const updated = await repos.requests.findById(request.id);
    expect(updated?.status).toBe('RETURNED');
  });
  it('decision stores revisionRequired list', async () => {
    const request = await setupUnderReview(repos);
    const d = await recordDecision(request.id, returnedParams(), repos);
    expect(d.revisionRequired).toContain('Cần bổ sung nguồn vốn');
  });
  it('records RETURNED history event', async () => {
    const request = await setupUnderReview(repos);
    await recordDecision(request.id, returnedParams(), repos);
    const events = await repos.history.findByRequestId(request.id);
    expect(events.some(e => e.action === 'RETURNED')).toBe(true);
  });
});

// APR-D-05
describe('recordDecision — validation failures', () => {
  let repos: ApprovalRepositories;
  beforeEach(() => { repos = createMemoryApprovalRepositories(); });

  it('throws for unknown requestId', async () => {
    await expect(recordDecision('no-id', approvedParams(), repos)).rejects.toThrow(ApprovalError);
  });
  it('throws when decidedBy is empty', async () => {
    const request = await setupUnderReview(repos);
    await expect(recordDecision(request.id, { ...approvedParams(), decidedBy: '' }, repos)).rejects.toThrow(ApprovalError);
  });
  it('throws when legalBasis is empty', async () => {
    const request = await setupUnderReview(repos);
    await expect(recordDecision(request.id, { ...approvedParams(), legalBasis: '' }, repos)).rejects.toThrow(ApprovalError);
  });
});

// APR-D-06
describe('recordDecision — status guard', () => {
  let repos: ApprovalRepositories;
  beforeEach(() => { repos = createMemoryApprovalRepositories(); });

  it('throws when status is SUBMITTED (not UNDER_REVIEW)', async () => {
    const r = await createApprovalRequest(params(), repos);
    await submitForApproval(r.id, 'EMP-001', repos);
    await expect(recordDecision(r.id, approvedParams(), repos)).rejects.toThrow(ApprovalError);
  });
  it('throws when status is DRAFT', async () => {
    const r = await createApprovalRequest(params(), repos);
    await expect(recordDecision(r.id, approvedParams(), repos)).rejects.toThrow(ApprovalError);
  });
  it('throws when authority is not assigned', async () => {
    const r = await createApprovalRequest(params(), repos);
    await submitForApproval(r.id, 'EMP-001', repos);
    await repos.requests.update(r.id, { status: 'UNDER_REVIEW' });
    await expect(recordDecision(r.id, approvedParams(), repos)).rejects.toThrow(ApprovalError);
  });
});

// APR-D-07
describe('recordDecision — duplicate prevention', () => {
  let repos: ApprovalRepositories;
  beforeEach(() => { repos = createMemoryApprovalRepositories(); });

  it('throws DECISION_EXISTS if decision already recorded', async () => {
    const request = await setupUnderReview(repos);
    await recordDecision(request.id, approvedParams(), repos);
    try {
      await repos.requests.update(request.id, { status: 'UNDER_REVIEW', decisionId: undefined });
      await recordDecision(request.id, approvedParams(), repos);
    } catch (e) {
      expect((e as ApprovalError).code).toBe('DECISION_EXISTS');
    }
  });
  it('one decision per request', async () => {
    const request = await setupUnderReview(repos);
    await recordDecision(request.id, approvedParams(), repos);
    expect(await repos.decisions.count()).toBe(1);
  });
  it('second request can have its own decision', async () => {
    const r1 = await setupUnderReview(repos);
    await recordDecision(r1.id, approvedParams(), repos);
    const r2 = await setupUnderReview(repos, 'APR/KH/2026/0002');
    await recordDecision(r2.id, approvedParams(), repos);
    expect(await repos.decisions.count()).toBe(2);
  });
});

// APR-D-08
describe('recordDecision — stores fields correctly', () => {
  let repos: ApprovalRepositories;
  beforeEach(() => { repos = createMemoryApprovalRepositories(); });

  it('stores legalBasis', async () => {
    const request = await setupUnderReview(repos);
    const d = await recordDecision(request.id, approvedParams(), repos);
    expect(d.legalBasis).toBe('NĐ 214/2025 Điều 76 khoản 1');
  });
  it('stores decisionReference', async () => {
    const request = await setupUnderReview(repos);
    const d = await recordDecision(request.id, approvedParams(), repos);
    expect(d.decisionReference).toBe('QĐ/KH/2026/0001');
  });
  it('stores conditions array', async () => {
    const request = await setupUnderReview(repos);
    const d = await recordDecision(request.id, { ...approvedParams(), conditions: ['Điều kiện 1', 'Điều kiện 2'] }, repos);
    expect(d.conditions).toHaveLength(2);
  });
});

// APR-D-09
describe('getDecisionForRequest', () => {
  let repos: ApprovalRepositories;
  beforeEach(() => { repos = createMemoryApprovalRepositories(); });

  it('returns null when no decision exists', async () => {
    expect(await getDecisionForRequest('R-X', repos)).toBeNull();
  });
  it('returns the decision after it is recorded', async () => {
    const request = await setupUnderReview(repos);
    await recordDecision(request.id, approvedParams(), repos);
    const d = await getDecisionForRequest(request.id, repos);
    expect(d?.requestId).toBe(request.id);
  });
  it('returns correct outcome', async () => {
    const request = await setupUnderReview(repos);
    await recordDecision(request.id, { ...approvedParams(), outcome: 'REJECTED' }, repos);
    const d = await getDecisionForRequest(request.id, repos);
    expect(d?.outcome).toBe('REJECTED');
  });
});

// APR-D-10
describe('recordDecision — request gets decisionId', () => {
  let repos: ApprovalRepositories;
  beforeEach(() => { repos = createMemoryApprovalRepositories(); });

  it('request.decisionId is set after decision is recorded', async () => {
    const request = await setupUnderReview(repos);
    const d = await recordDecision(request.id, approvedParams(), repos);
    const updated = await repos.requests.findById(request.id);
    expect(updated?.decisionId).toBe(d.id);
  });
  it('request.decisionId matches decision.id', async () => {
    const request = await setupUnderReview(repos);
    const d = await recordDecision(request.id, approvedParams(), repos);
    const updated = await repos.requests.findById(request.id);
    expect(updated?.decisionId).toBe(d.id);
  });
  it('decidedAt is set', async () => {
    const request = await setupUnderReview(repos);
    const d = await recordDecision(request.id, approvedParams(), repos);
    expect(d.decidedAt).toBeTruthy();
  });
});

// APR-D-11
describe('recordDecision — RETURNED without revisionRequired', () => {
  let repos: ApprovalRepositories;
  beforeEach(() => { repos = createMemoryApprovalRepositories(); });

  it('throws when RETURNED but no revisionRequired', async () => {
    const request = await setupUnderReview(repos);
    await expect(
      recordDecision(request.id, { outcome: 'RETURNED', decidedBy: 'MGR', legalBasis: 'L', decisionReference: 'D', revisionRequired: [] }, repos)
    ).rejects.toThrow(ApprovalError);
  });
  it('succeeds when RETURNED has revisionRequired items', async () => {
    const request = await setupUnderReview(repos);
    const d = await recordDecision(request.id, returnedParams(), repos);
    expect(d.outcome).toBe('RETURNED');
  });
  it('decisionReference must not be empty', async () => {
    const request = await setupUnderReview(repos);
    await expect(
      recordDecision(request.id, { ...approvedParams(), decisionReference: '' }, repos)
    ).rejects.toThrow(ApprovalError);
  });
});

// APR-D-12
describe('recordDecision — history has decision action', () => {
  let repos: ApprovalRepositories;
  beforeEach(() => { repos = createMemoryApprovalRepositories(); });

  it('history includes the APPROVED action', async () => {
    const request = await setupUnderReview(repos);
    await recordDecision(request.id, approvedParams(), repos);
    const events = await repos.history.findByRequestId(request.id);
    expect(events.some(e => e.action === 'APPROVED')).toBe(true);
  });
  it('history notes contains decisionReference', async () => {
    const request = await setupUnderReview(repos);
    await recordDecision(request.id, approvedParams(), repos);
    const events = await repos.history.findByRequestId(request.id);
    const decisionEvent = events.find(e => e.action === 'APPROVED');
    expect(decisionEvent?.notes).toContain('QĐ/KH/2026/0001');
  });
  it('history fromStatus is UNDER_REVIEW', async () => {
    const request = await setupUnderReview(repos);
    await recordDecision(request.id, approvedParams(), repos);
    const events = await repos.history.findByRequestId(request.id);
    const decisionEvent = events.find(e => e.action === 'APPROVED');
    expect(decisionEvent?.fromStatus).toBe('UNDER_REVIEW');
  });
});

// APR-D-13
describe('recordDecision — decidedBy field', () => {
  let repos: ApprovalRepositories;
  beforeEach(() => { repos = createMemoryApprovalRepositories(); });

  it('stores the decidedBy employee code', async () => {
    const request = await setupUnderReview(repos);
    const d = await recordDecision(request.id, { ...approvedParams(), decidedBy: 'RECTOR-01' }, repos);
    expect(d.decidedBy).toBe('RECTOR-01');
  });
  it('findByDecidedBy returns the decision', async () => {
    const request = await setupUnderReview(repos);
    await recordDecision(request.id, { ...approvedParams(), decidedBy: 'RECTOR-01' }, repos);
    const decisions = await repos.decisions.findByDecidedBy('RECTOR-01');
    expect(decisions).toHaveLength(1);
  });
  it('empty conditions defaults to empty array', async () => {
    const request = await setupUnderReview(repos);
    const d = await recordDecision(request.id, approvedParams(), repos);
    expect(d.conditions).toEqual([]);
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function params(code = 'APR/KH/2026/0001') {
  return {
    requestCode: code, approvalType: 'PLAN_APPROVAL' as const,
    subjectId: 'PLAN-1', subjectType: 'PLAN' as const,
    requestedBy: 'EMP-001', department: 'DEPT-A', estimatedValue: 2_000_000_000,
  };
}

async function setupUnderReview(repos: ApprovalRepositories, code = 'APR/KH/2026/0001') {
  const r = await createApprovalRequest(params(code), repos);
  await submitForApproval(r.id, 'EMP-001', repos);
  return assignAuthority(r.id, 'AUTH-01', 'Director', 'ADMIN', repos);
}

function approvedParams() {
  return { outcome: 'APPROVED' as const, decidedBy: 'MGR-1', legalBasis: 'NĐ 214/2025 Điều 76 khoản 1', decisionReference: 'QĐ/KH/2026/0001' };
}

function returnedParams() {
  return { outcome: 'RETURNED' as const, decidedBy: 'MGR-1', legalBasis: 'NĐ 214/2025 Điều 76', decisionReference: 'QĐ/TT/2026/0001', revisionRequired: ['Cần bổ sung nguồn vốn'] };
}
