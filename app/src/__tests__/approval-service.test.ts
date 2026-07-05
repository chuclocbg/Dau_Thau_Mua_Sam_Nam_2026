import { describe, it, expect, beforeEach } from 'vitest';
import { createApprovalRequest, submitForApproval, assignAuthority, withdrawApprovalRequest } from '../approval/approvalService';
import { createMemoryApprovalRepositories } from '../approval/approvalFactory';
import type { ApprovalRepositories } from '../approval/approvalRepositories';
import { ApprovalError } from '../approval/approvalTypes';

// APR-S-01
describe('createApprovalRequest — happy path', () => {
  let repos: ApprovalRepositories;
  beforeEach(() => { repos = createMemoryApprovalRepositories(); });

  it('returns a request with the given code', async () => {
    const r = await createApprovalRequest(params(), repos);
    expect(r.requestCode).toBe('APR/KH/2026/0001');
  });
  it('status is DRAFT after creation', async () => {
    const r = await createApprovalRequest(params(), repos);
    expect(r.status).toBe('DRAFT');
  });
  it('records CREATED history event', async () => {
    const r = await createApprovalRequest(params(), repos);
    const events = await repos.history.findByRequestId(r.id);
    expect(events.some(e => e.action === 'CREATED')).toBe(true);
  });
});

// APR-S-02
describe('createApprovalRequest — duplicate code', () => {
  let repos: ApprovalRepositories;
  beforeEach(() => { repos = createMemoryApprovalRepositories(); });

  it('throws ApprovalError for duplicate code', async () => {
    await createApprovalRequest(params(), repos);
    await expect(createApprovalRequest(params(), repos)).rejects.toThrow(ApprovalError);
  });
  it('error code is DUPLICATE_CODE', async () => {
    await createApprovalRequest(params(), repos);
    try { await createApprovalRequest(params(), repos); }
    catch (e) { expect((e as ApprovalError).code).toBe('DUPLICATE_CODE'); }
  });
  it('second request with different code succeeds', async () => {
    await createApprovalRequest(params(), repos);
    const r2 = await createApprovalRequest({ ...params(), requestCode: 'APR/KH/2026/0002' }, repos);
    expect(r2.requestCode).toBe('APR/KH/2026/0002');
  });
});

// APR-S-03
describe('createApprovalRequest — validation failures', () => {
  let repos: ApprovalRepositories;
  beforeEach(() => { repos = createMemoryApprovalRepositories(); });

  it('throws when requestCode is empty', async () => {
    await expect(createApprovalRequest({ ...params(), requestCode: '' }, repos)).rejects.toThrow(ApprovalError);
  });
  it('throws when estimatedValue is zero', async () => {
    await expect(createApprovalRequest({ ...params(), estimatedValue: 0 }, repos)).rejects.toThrow(ApprovalError);
  });
  it('throws when requestedBy is missing', async () => {
    await expect(createApprovalRequest({ ...params(), requestedBy: '' }, repos)).rejects.toThrow(ApprovalError);
  });
});

// APR-S-04
describe('submitForApproval', () => {
  let repos: ApprovalRepositories;
  beforeEach(() => { repos = createMemoryApprovalRepositories(); });

  it('transitions status to SUBMITTED', async () => {
    const r = await createApprovalRequest(params(), repos);
    const updated = await submitForApproval(r.id, 'EMP-001', repos);
    expect(updated.status).toBe('SUBMITTED');
  });
  it('records SUBMITTED history event', async () => {
    const r = await createApprovalRequest(params(), repos);
    await submitForApproval(r.id, 'EMP-001', repos);
    const events = await repos.history.findByRequestId(r.id);
    expect(events.some(e => e.action === 'SUBMITTED')).toBe(true);
  });
  it('throws for unknown requestId', async () => {
    await expect(submitForApproval('no-such-id', 'EMP-001', repos)).rejects.toThrow(ApprovalError);
  });
});

// APR-S-05
describe('submitForApproval — invalid status', () => {
  let repos: ApprovalRepositories;
  beforeEach(() => { repos = createMemoryApprovalRepositories(); });

  it('throws when request is already APPROVED', async () => {
    const r = await createApprovalRequest(params(), repos);
    await repos.requests.update(r.id, { status: 'APPROVED' });
    await expect(submitForApproval(r.id, 'EMP-001', repos)).rejects.toThrow(ApprovalError);
  });
  it('throws when request is WITHDRAWN', async () => {
    const r = await createApprovalRequest(params(), repos);
    await repos.requests.update(r.id, { status: 'WITHDRAWN' });
    await expect(submitForApproval(r.id, 'EMP-001', repos)).rejects.toThrow(ApprovalError);
  });
  it('allows submit from RETURNED status', async () => {
    const r = await createApprovalRequest(params(), repos);
    await repos.requests.update(r.id, { status: 'RETURNED' });
    const updated = await submitForApproval(r.id, 'EMP-001', repos);
    expect(updated.status).toBe('SUBMITTED');
  });
});

// APR-S-06
describe('assignAuthority', () => {
  let repos: ApprovalRepositories;
  beforeEach(() => { repos = createMemoryApprovalRepositories(); });

  it('sets assignedAuthorityCode', async () => {
    const r = await createApprovalRequest(params(), repos);
    await submitForApproval(r.id, 'EMP-001', repos);
    const updated = await assignAuthority(r.id, 'AUTH-01', 'Director', 'ADMIN', repos);
    expect(updated.assignedAuthorityCode).toBe('AUTH-01');
  });
  it('transitions status to UNDER_REVIEW', async () => {
    const r = await createApprovalRequest(params(), repos);
    await submitForApproval(r.id, 'EMP-001', repos);
    const updated = await assignAuthority(r.id, 'AUTH-01', 'Director', 'ADMIN', repos);
    expect(updated.status).toBe('UNDER_REVIEW');
  });
  it('records ASSIGNED history event', async () => {
    const r = await createApprovalRequest(params(), repos);
    await submitForApproval(r.id, 'EMP-001', repos);
    await assignAuthority(r.id, 'AUTH-01', 'Director', 'ADMIN', repos);
    const events = await repos.history.findByRequestId(r.id);
    expect(events.some(e => e.action === 'ASSIGNED')).toBe(true);
  });
});

// APR-S-07
describe('assignAuthority — validation', () => {
  let repos: ApprovalRepositories;
  beforeEach(() => { repos = createMemoryApprovalRepositories(); });

  it('throws for unknown requestId', async () => {
    await expect(assignAuthority('no-id', 'AUTH-01', 'Dir', 'ADMIN', repos)).rejects.toThrow(ApprovalError);
  });
  it('throws when status is DRAFT', async () => {
    const r = await createApprovalRequest(params(), repos);
    await expect(assignAuthority(r.id, 'AUTH-01', 'Dir', 'ADMIN', repos)).rejects.toThrow(ApprovalError);
  });
  it('allows assign from UNDER_REVIEW status (re-assign)', async () => {
    const r = await createApprovalRequest(params(), repos);
    await submitForApproval(r.id, 'EMP-001', repos);
    await assignAuthority(r.id, 'AUTH-01', 'Dir', 'ADMIN', repos);
    const updated = await assignAuthority(r.id, 'AUTH-02', 'VP', 'ADMIN', repos);
    expect(updated.assignedAuthorityCode).toBe('AUTH-02');
  });
});

// APR-S-08
describe('withdrawApprovalRequest', () => {
  let repos: ApprovalRepositories;
  beforeEach(() => { repos = createMemoryApprovalRepositories(); });

  it('transitions DRAFT to WITHDRAWN', async () => {
    const r = await createApprovalRequest(params(), repos);
    const updated = await withdrawApprovalRequest(r.id, 'EMP-001', 'Changed plans', repos);
    expect(updated.status).toBe('WITHDRAWN');
  });
  it('transitions SUBMITTED to WITHDRAWN', async () => {
    const r = await createApprovalRequest(params(), repos);
    await submitForApproval(r.id, 'EMP-001', repos);
    const updated = await withdrawApprovalRequest(r.id, 'EMP-001', 'reason', repos);
    expect(updated.status).toBe('WITHDRAWN');
  });
  it('records WITHDRAWN history event', async () => {
    const r = await createApprovalRequest(params(), repos);
    await withdrawApprovalRequest(r.id, 'EMP-001', 'reason', repos);
    const events = await repos.history.findByRequestId(r.id);
    expect(events.some(e => e.action === 'WITHDRAWN')).toBe(true);
  });
});

// APR-S-09
describe('withdrawApprovalRequest — invalid status', () => {
  let repos: ApprovalRepositories;
  beforeEach(() => { repos = createMemoryApprovalRepositories(); });

  it('throws for unknown requestId', async () => {
    await expect(withdrawApprovalRequest('no-id', 'EMP-001', 'r', repos)).rejects.toThrow(ApprovalError);
  });
  it('throws when already APPROVED', async () => {
    const r = await createApprovalRequest(params(), repos);
    await repos.requests.update(r.id, { status: 'APPROVED' });
    await expect(withdrawApprovalRequest(r.id, 'EMP-001', 'r', repos)).rejects.toThrow(ApprovalError);
  });
  it('stores reason in history notes', async () => {
    const r = await createApprovalRequest(params(), repos);
    await withdrawApprovalRequest(r.id, 'EMP-001', 'budget cancelled', repos);
    const events = await repos.history.findByRequestId(r.id);
    const withdrawEvent = events.find(e => e.action === 'WITHDRAWN');
    expect(withdrawEvent?.notes).toBe('budget cancelled');
  });
});

// APR-S-10
describe('createApprovalRequest — stores estimatedValue', () => {
  let repos: ApprovalRepositories;
  beforeEach(() => { repos = createMemoryApprovalRepositories(); });

  it('preserves estimatedValue', async () => {
    const r = await createApprovalRequest({ ...params(), estimatedValue: 5_000_000_000 }, repos);
    expect(r.estimatedValue).toBe(5_000_000_000);
  });
  it('stores optional dueDate', async () => {
    const r = await createApprovalRequest({ ...params(), dueDate: '2026-12-31' }, repos);
    expect(r.dueDate).toBe('2026-12-31');
  });
  it('stores optional notes', async () => {
    const r = await createApprovalRequest({ ...params(), notes: 'Urgent' }, repos);
    expect(r.notes).toBe('Urgent');
  });
});

// APR-S-11
describe('createApprovalRequest — subjectType', () => {
  let repos: ApprovalRepositories;
  beforeEach(() => { repos = createMemoryApprovalRepositories(); });

  it('stores PLAN subjectType', async () => {
    const r = await createApprovalRequest(params(), repos);
    expect(r.subjectType).toBe('PLAN');
  });
  it('stores PACKAGE subjectType', async () => {
    const r = await createApprovalRequest({ ...params(), requestCode: 'APR/GK/2026/0001', subjectType: 'PACKAGE' }, repos);
    expect(r.subjectType).toBe('PACKAGE');
  });
  it('stores correct department', async () => {
    const r = await createApprovalRequest({ ...params(), department: 'KH-TC' }, repos);
    expect(r.department).toBe('KH-TC');
  });
});

// APR-S-12
describe('assignAuthority — stores name', () => {
  let repos: ApprovalRepositories;
  beforeEach(() => { repos = createMemoryApprovalRepositories(); });

  it('stores authority name alongside code', async () => {
    const r = await createApprovalRequest(params(), repos);
    await submitForApproval(r.id, 'EMP-001', repos);
    const updated = await assignAuthority(r.id, 'RECT-01', 'Hiệu trưởng', 'ADMIN', repos);
    expect(updated.assignedAuthorityName).toBe('Hiệu trưởng');
  });
  it('status after assign is UNDER_REVIEW', async () => {
    const r = await createApprovalRequest(params(), repos);
    await submitForApproval(r.id, 'EMP-001', repos);
    const updated = await assignAuthority(r.id, 'AUTH-01', 'Dir', 'ADMIN', repos);
    expect(updated.status).toBe('UNDER_REVIEW');
  });
  it('history has 3 events: CREATED + SUBMITTED + ASSIGNED', async () => {
    const r = await createApprovalRequest(params(), repos);
    await submitForApproval(r.id, 'EMP-001', repos);
    await assignAuthority(r.id, 'AUTH-01', 'Dir', 'ADMIN', repos);
    const events = await repos.history.findByRequestId(r.id);
    expect(events).toHaveLength(3);
  });
});

// APR-S-13
describe('full lifecycle: DRAFT → SUBMITTED → UNDER_REVIEW → WITHDRAWN', () => {
  let repos: ApprovalRepositories;
  beforeEach(() => { repos = createMemoryApprovalRepositories(); });

  it('follows the full lifecycle without errors', async () => {
    const r   = await createApprovalRequest(params(), repos);
    const s   = await submitForApproval(r.id, 'EMP-001', repos);
    const a   = await assignAuthority(s.id, 'AUTH-01', 'Dir', 'ADMIN', repos);
    const w   = await withdrawApprovalRequest(a.id, 'EMP-001', 'reason', repos);
    expect(w.status).toBe('WITHDRAWN');
  });
  it('history has 4 events for full lifecycle', async () => {
    const r = await createApprovalRequest(params(), repos);
    await submitForApproval(r.id, 'EMP-001', repos);
    await assignAuthority(r.id, 'AUTH-01', 'Dir', 'ADMIN', repos);
    await withdrawApprovalRequest(r.id, 'EMP-001', 'reason', repos);
    const events = await repos.history.findByRequestId(r.id);
    expect(events).toHaveLength(4);
  });
  it('count in requests repo is 1', async () => {
    await createApprovalRequest(params(), repos);
    expect(await repos.requests.count()).toBe(1);
  });
});

function params() {
  return {
    requestCode: 'APR/KH/2026/0001', approvalType: 'PLAN_APPROVAL' as const,
    subjectId: 'PLAN-1', subjectType: 'PLAN' as const,
    requestedBy: 'EMP-001', department: 'DEPT-A', estimatedValue: 2_000_000_000,
  };
}
