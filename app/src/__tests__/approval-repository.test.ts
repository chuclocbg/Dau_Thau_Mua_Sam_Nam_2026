import { describe, it, expect, beforeEach } from 'vitest';
import { createMemoryApprovalRepositories } from '../approval/approvalFactory';
import type { ApprovalRepositories } from '../approval/approvalRepositories';
import type { ApprovalRequest, ApprovalDecisionRecord } from '../approval/approvalTypes';

// APR-R-01
describe('MemoryApprovalRequestRepository — create + findById', () => {
  let repos: ApprovalRepositories;
  beforeEach(() => { repos = createMemoryApprovalRepositories(); });

  it('creates a request with generated id', async () => {
    const r = await repos.requests.create(sampleRequest());
    expect(r.id).toBeTruthy();
  });
  it('findById returns the created request', async () => {
    const r = await repos.requests.create(sampleRequest());
    expect(await repos.requests.findById(r.id)).toEqual(r);
  });
  it('findById returns null for unknown id', async () => {
    expect(await repos.requests.findById('no-such-id')).toBeNull();
  });
});

// APR-R-02
describe('MemoryApprovalRequestRepository — findByCode', () => {
  let repos: ApprovalRepositories;
  beforeEach(() => { repos = createMemoryApprovalRepositories(); });

  it('returns request by requestCode', async () => {
    await repos.requests.create(sampleRequest({ requestCode: 'APR/KH/2026/0001' }));
    const found = await repos.requests.findByCode('APR/KH/2026/0001');
    expect(found?.requestCode).toBe('APR/KH/2026/0001');
  });
  it('returns null for unknown code', async () => {
    expect(await repos.requests.findByCode('NOPE')).toBeNull();
  });
  it('distinguishes different codes', async () => {
    await repos.requests.create(sampleRequest({ requestCode: 'APR/A' }));
    await repos.requests.create(sampleRequest({ requestCode: 'APR/B' }));
    expect((await repos.requests.findByCode('APR/A'))?.requestCode).toBe('APR/A');
  });
});

// APR-R-03
describe('MemoryApprovalRequestRepository — findByStatus', () => {
  let repos: ApprovalRepositories;
  beforeEach(() => { repos = createMemoryApprovalRepositories(); });

  it('returns requests with matching status', async () => {
    await repos.requests.create(sampleRequest({ requestCode: 'A1', status: 'DRAFT' }));
    await repos.requests.create(sampleRequest({ requestCode: 'A2', status: 'SUBMITTED' }));
    expect(await repos.requests.findByStatus('DRAFT')).toHaveLength(1);
  });
  it('returns empty array if no match', async () => {
    await repos.requests.create(sampleRequest());
    expect(await repos.requests.findByStatus('APPROVED')).toHaveLength(0);
  });
  it('returns all matching requests', async () => {
    await repos.requests.create(sampleRequest({ requestCode: 'B1', status: 'SUBMITTED' }));
    await repos.requests.create(sampleRequest({ requestCode: 'B2', status: 'SUBMITTED' }));
    expect(await repos.requests.findByStatus('SUBMITTED')).toHaveLength(2);
  });
});

// APR-R-04
describe('MemoryApprovalRequestRepository — findByDepartment + findByApprovalType', () => {
  let repos: ApprovalRepositories;
  beforeEach(() => { repos = createMemoryApprovalRepositories(); });

  it('filters by department', async () => {
    await repos.requests.create(sampleRequest({ requestCode: 'C1', department: 'DEPT-A' }));
    await repos.requests.create(sampleRequest({ requestCode: 'C2', department: 'DEPT-B' }));
    expect(await repos.requests.findByDepartment('DEPT-A')).toHaveLength(1);
  });
  it('filters by approvalType', async () => {
    await repos.requests.create(sampleRequest({ requestCode: 'D1', approvalType: 'PLAN_APPROVAL' }));
    await repos.requests.create(sampleRequest({ requestCode: 'D2', approvalType: 'PACKAGE_APPROVAL' }));
    expect(await repos.requests.findByApprovalType('PLAN_APPROVAL')).toHaveLength(1);
  });
  it('findBySubjectId returns correct requests', async () => {
    await repos.requests.create(sampleRequest({ requestCode: 'E1', subjectId: 'SUB-1' }));
    await repos.requests.create(sampleRequest({ requestCode: 'E2', subjectId: 'SUB-2' }));
    expect(await repos.requests.findBySubjectId('SUB-1')).toHaveLength(1);
  });
});

// APR-R-05
describe('MemoryApprovalRequestRepository — search', () => {
  let repos: ApprovalRepositories;
  beforeEach(() => { repos = createMemoryApprovalRepositories(); });

  it('returns all records when no filter applied', async () => {
    await repos.requests.create(sampleRequest({ requestCode: 'F1' }));
    await repos.requests.create(sampleRequest({ requestCode: 'F2' }));
    const result = await repos.requests.search({});
    expect(result.total).toBe(2);
  });
  it('filters by status in search', async () => {
    await repos.requests.create(sampleRequest({ requestCode: 'G1', status: 'APPROVED' }));
    await repos.requests.create(sampleRequest({ requestCode: 'G2', status: 'DRAFT' }));
    const result = await repos.requests.search({ status: 'APPROVED' });
    expect(result.total).toBe(1);
  });
  it('paginates results', async () => {
    for (let i = 0; i < 5; i++) await repos.requests.create(sampleRequest({ requestCode: `H${i}` }));
    const result = await repos.requests.search({ page: 1, pageSize: 2 });
    expect(result.items).toHaveLength(2);
    expect(result.pageSize).toBe(2);
  });
});

// APR-R-06
describe('MemoryApprovalDecisionRepository', () => {
  let repos: ApprovalRepositories;
  beforeEach(() => { repos = createMemoryApprovalRepositories(); });

  it('creates and retrieves a decision', async () => {
    const d = await repos.decisions.create(sampleDecision());
    expect(await repos.decisions.findById(d.id)).toEqual(d);
  });
  it('findByRequestId returns the decision for that request', async () => {
    await repos.decisions.create(sampleDecision({ requestId: 'R-1' }));
    const found = await repos.decisions.findByRequestId('R-1');
    expect(found?.requestId).toBe('R-1');
  });
  it('findByRequestId returns null when none exists', async () => {
    expect(await repos.decisions.findByRequestId('no-request')).toBeNull();
  });
});

// APR-R-07
describe('MemoryApprovalHistoryRepository', () => {
  let repos: ApprovalRepositories;
  beforeEach(() => { repos = createMemoryApprovalRepositories(); });

  it('stores history entries', async () => {
    const e = await repos.history.create({ requestId: 'R-1', action: 'CREATED', performedBy: 'U1', performedAt: new Date().toISOString() } as any);
    expect(e.id).toBeTruthy();
  });
  it('findByRequestId returns in time order', async () => {
    await repos.history.create({ requestId: 'R-A', action: 'CREATED',   performedBy: 'U1', performedAt: '2026-01-01T00:00:00Z' } as any);
    await repos.history.create({ requestId: 'R-A', action: 'SUBMITTED', performedBy: 'U1', performedAt: '2026-01-02T00:00:00Z' } as any);
    const entries = await repos.history.findByRequestId('R-A');
    expect(entries[0]?.action).toBe('CREATED');
    expect(entries[1]?.action).toBe('SUBMITTED');
  });
  it('findByPerformedBy filters correctly', async () => {
    await repos.history.create({ requestId: 'R-X', action: 'CREATED', performedBy: 'USR-1', performedAt: new Date().toISOString() } as any);
    await repos.history.create({ requestId: 'R-Y', action: 'CREATED', performedBy: 'USR-2', performedAt: new Date().toISOString() } as any);
    expect(await repos.history.findByPerformedBy('USR-1')).toHaveLength(1);
  });
});

// APR-R-08
describe('MemoryApprovalCommentRepository', () => {
  let repos: ApprovalRepositories;
  beforeEach(() => { repos = createMemoryApprovalRepositories(); });

  it('creates a comment', async () => {
    const c = await repos.comments.create({ requestId: 'R-1', content: 'ok', authorCode: 'U1', isInternal: false } as any);
    expect(c.content).toBe('ok');
  });
  it('findByRequestId returns in creation order', async () => {
    await repos.comments.create({ requestId: 'R-1', content: 'first',  authorCode: 'U1', isInternal: false } as any);
    await repos.comments.create({ requestId: 'R-1', content: 'second', authorCode: 'U1', isInternal: false } as any);
    const comments = await repos.comments.findByRequestId('R-1');
    expect(comments).toHaveLength(2);
  });
  it('countByRequestId is accurate', async () => {
    await repos.comments.create({ requestId: 'R-2', content: 'x', authorCode: 'U1', isInternal: false } as any);
    expect(await repos.comments.countByRequestId('R-2')).toBe(1);
  });
});

// APR-R-09
describe('MemoryApprovalAttachmentRepository', () => {
  let repos: ApprovalRepositories;
  beforeEach(() => { repos = createMemoryApprovalRepositories(); });

  it('creates an attachment', async () => {
    const a = await repos.attachments.create({ requestId: 'R-1', fileName: 'f.pdf', fileType: 'pdf', fileSize: 100, uploadedBy: 'U1', documentType: 'SUPPORTING_DOCUMENT' } as any);
    expect(a.fileName).toBe('f.pdf');
  });
  it('findByRequestId returns matching attachments', async () => {
    await repos.attachments.create({ requestId: 'R-1', fileName: 'a.pdf', fileType: 'pdf', fileSize: 10, uploadedBy: 'U1', documentType: 'LEGAL_REFERENCE' } as any);
    expect(await repos.attachments.findByRequestId('R-1')).toHaveLength(1);
  });
  it('countByRequestId returns 0 for empty', async () => {
    expect(await repos.attachments.countByRequestId('NONE')).toBe(0);
  });
});

// APR-R-10
describe('MemoryApprovalRequestRepository — update', () => {
  let repos: ApprovalRepositories;
  beforeEach(() => { repos = createMemoryApprovalRepositories(); });

  it('updates status', async () => {
    const r = await repos.requests.create(sampleRequest());
    const updated = await repos.requests.update(r.id, { status: 'SUBMITTED' });
    expect(updated.status).toBe('SUBMITTED');
  });
  it('preserves unchanged fields', async () => {
    const r = await repos.requests.create(sampleRequest({ requestCode: 'Z1' }));
    await repos.requests.update(r.id, { status: 'APPROVED' });
    const found = await repos.requests.findById(r.id);
    expect(found?.requestCode).toBe('Z1');
  });
  it('throws for unknown id', async () => {
    await expect(repos.requests.update('no-such-id', { status: 'DRAFT' })).rejects.toThrow();
  });
});

// APR-R-11
describe('MemoryApprovalRequestRepository — delete + count', () => {
  let repos: ApprovalRepositories;
  beforeEach(() => { repos = createMemoryApprovalRepositories(); });

  it('count is 0 initially', async () => { expect(await repos.requests.count()).toBe(0); });
  it('count increases after create', async () => {
    await repos.requests.create(sampleRequest());
    expect(await repos.requests.count()).toBe(1);
  });
  it('delete removes the record', async () => {
    const r = await repos.requests.create(sampleRequest());
    await repos.requests.delete(r.id);
    expect(await repos.requests.findById(r.id)).toBeNull();
  });
});

// APR-R-12
describe('createMemoryApprovalRepositories factory', () => {
  it('returns a bag with all 5 repositories', () => {
    const repos = createMemoryApprovalRepositories();
    expect(repos.requests).toBeTruthy();
    expect(repos.decisions).toBeTruthy();
    expect(repos.history).toBeTruthy();
  });
  it('has comments and attachments repos', () => {
    const repos = createMemoryApprovalRepositories();
    expect(repos.comments).toBeTruthy();
    expect(repos.attachments).toBeTruthy();
  });
  it('each call returns independent instances', async () => {
    const a = createMemoryApprovalRepositories();
    const b = createMemoryApprovalRepositories();
    await a.requests.create(sampleRequest());
    expect(await b.requests.count()).toBe(0);
  });
});

// APR-R-13
describe('MemoryApprovalDecisionRepository — findByDecidedBy', () => {
  let repos: ApprovalRepositories;
  beforeEach(() => { repos = createMemoryApprovalRepositories(); });

  it('returns decisions for specific decidedBy', async () => {
    await repos.decisions.create(sampleDecision({ decidedBy: 'MGR-1' }));
    await repos.decisions.create(sampleDecision({ requestId: 'R-2', decidedBy: 'MGR-2' }));
    expect(await repos.decisions.findByDecidedBy('MGR-1')).toHaveLength(1);
  });
  it('returns empty array for unknown', async () => {
    expect(await repos.decisions.findByDecidedBy('NOBODY')).toHaveLength(0);
  });
  it('findAll returns all decisions', async () => {
    await repos.decisions.create(sampleDecision());
    await repos.decisions.create(sampleDecision({ requestId: 'R-3' }));
    expect(await repos.decisions.findAll()).toHaveLength(2);
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sampleRequest(overrides?: Partial<Omit<ApprovalRequest, 'id' | 'createdAt' | 'updatedAt'>>): Omit<ApprovalRequest, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    requestCode:    'APR/KH/2026/0001',
    approvalType:   'PLAN_APPROVAL',
    subjectId:      'PLAN-1',
    subjectType:    'PLAN',
    requestedBy:    'EMP-001',
    requestedAt:    '2026-06-01T00:00:00Z',
    department:     'DEPT-A',
    estimatedValue: 1_000_000_000,
    status:         'DRAFT',
    ...overrides,
  };
}

function sampleDecision(overrides?: Partial<Omit<ApprovalDecisionRecord, 'id' | 'createdAt' | 'updatedAt'>>): Omit<ApprovalDecisionRecord, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    requestId:         'R-1',
    outcome:           'APPROVED',
    decidedBy:         'MGR-1',
    decidedAt:         '2026-06-15T00:00:00Z',
    legalBasis:        'NĐ 214/2025 Điều 76',
    conditions:        [],
    revisionRequired:  [],
    decisionReference: 'QĐ/KH/2026/0001',
    ...overrides,
  };
}
