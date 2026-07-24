import { describe, it, expect, beforeEach } from 'vitest';
import {
  buildApprovalFromPackage, buildApprovalFromPlan,
  advanceWorkflowOnApproval, buildApprovalSummary,
  validateApprovalAgainstMasterData, resolveAuthorityFromMasterData,
} from '../approval/approvalIntegration';
import { createMemoryApprovalRepositories } from '../approval/approvalFactory';
import { createApprovalRequest, submitForApproval, assignAuthority } from '../approval/approvalService';
import { recordDecision } from '../approval/approvalDecision';
import { addComment } from '../approval/approvalComment';
import { addAttachment } from '../approval/approvalAttachment';
import { createWorkflow, startWorkflow } from '../procurement/workflow/workflowEngine';
import type { ApprovalRepositories } from '../approval/approvalRepositories';
import type { ProcurementPackage } from '../procurement/package/packageTypes';
import type { ProcurementPlan } from '../procurement/planning/planningTypes';
import type { ApprovalAuthority } from '../masterdata/masterdataTypes';
import type { IMasterDataRepository } from '../masterdata/masterdataRepository';

// ─── Authority repo factory ───────────────────────────────────────────────────
function makeAuthRepo(authorities: ApprovalAuthority[]): IMasterDataRepository<ApprovalAuthority> {
  return {
    create:     async () => { throw new Error('n/a'); },
    update:     async () => { throw new Error('n/a'); },
    delete:     async () => {},
    findById:   async (id: string)   => authorities.find(a => a.id === id)   ?? null,
    findByCode: async (code: string) => authorities.find(a => a.code === code) ?? null,
    findAll:    async ()     => authorities,
    findActive: async ()     => authorities.filter(a => a.isActive && !a.isArchived),
    count:      async ()     => authorities.length,
    search:     async ()     => ({ items: authorities, total: authorities.length, page: 1, pageSize: 100 }),
  } as unknown as IMasterDataRepository<ApprovalAuthority>;
}

const auth = (code: string, level: number, maxValue: number, active = true): ApprovalAuthority =>
  ({ id: code, code, name: code, level, maxValue, isActive: active, isArchived: false, createdAt: '', updatedAt: '' } as ApprovalAuthority);

// APR-I-01
describe('buildApprovalFromPackage', () => {
  it('generates PACKAGE_APPROVAL type', () => {
    const params = buildApprovalFromPackage(samplePackage(), 'EMP-1', 2026, 1);
    expect(params.approvalType).toBe('PACKAGE_APPROVAL');
  });
  it('subjectType is PACKAGE', () => {
    const params = buildApprovalFromPackage(samplePackage(), 'EMP-1', 2026, 1);
    expect(params.subjectType).toBe('PACKAGE');
  });
  it('subjectId matches package id', () => {
    const params = buildApprovalFromPackage(samplePackage(), 'EMP-1', 2026, 1);
    expect(params.subjectId).toBe('PKG-001');
  });
});

// APR-I-02
describe('buildApprovalFromPackage — fields', () => {
  it('department comes from package', () => {
    const params = buildApprovalFromPackage(samplePackage(), 'EMP-1', 2026, 1);
    expect(params.department).toBe('DEPT-A');
  });
  it('estimatedValue comes from package', () => {
    const params = buildApprovalFromPackage(samplePackage(), 'EMP-1', 2026, 1);
    expect(params.estimatedValue).toBe(5_000_000_000);
  });
  it('requestCode follows APR/GK/ pattern', () => {
    const params = buildApprovalFromPackage(samplePackage(), 'EMP-1', 2026, 1);
    expect(params.requestCode.startsWith('APR/GK/')).toBe(true);
  });
});

// APR-I-03
describe('buildApprovalFromPlan', () => {
  it('generates PLAN_APPROVAL type', () => {
    const params = buildApprovalFromPlan(samplePlan(), 'EMP-1', 2026, 1);
    expect(params.approvalType).toBe('PLAN_APPROVAL');
  });
  it('subjectType is PLAN', () => {
    const params = buildApprovalFromPlan(samplePlan(), 'EMP-1', 2026, 1);
    expect(params.subjectType).toBe('PLAN');
  });
  it('estimatedValue comes from plan estimatedTotal', () => {
    const params = buildApprovalFromPlan(samplePlan(), 'EMP-1', 2026, 1);
    expect(params.estimatedValue).toBe(10_000_000_000);
  });
});

// APR-I-04
describe('buildApprovalFromPlan — fields', () => {
  it('department comes from responsibleDepartment', () => {
    const params = buildApprovalFromPlan(samplePlan(), 'EMP-1', 2026, 1);
    expect(params.department).toBe('KH-TC');
  });
  it('subjectId matches plan id', () => {
    const params = buildApprovalFromPlan(samplePlan(), 'EMP-1', 2026, 1);
    expect(params.subjectId).toBe('PLAN-001');
  });
  it('requestCode follows APR/KH/ pattern', () => {
    const params = buildApprovalFromPlan(samplePlan(), 'EMP-1', 2026, 1);
    expect(params.requestCode.startsWith('APR/KH/')).toBe(true);
  });
});

// APR-I-05
describe('validateApprovalAgainstMasterData', () => {
  it('returns true when authority covers the value', async () => {
    const repo = makeAuthRepo([auth('RECT', 3, 10_000_000_000)]);
    expect(await validateApprovalAgainstMasterData({ estimatedValue: 5_000_000_000, approvalAuthority: 'RECT' }, repo)).toBe(true);
  });
  it('returns false when authority limit exceeded', async () => {
    const repo = makeAuthRepo([auth('RECT', 3, 1_000_000)]);
    expect(await validateApprovalAgainstMasterData({ estimatedValue: 5_000_000_000, approvalAuthority: 'RECT' }, repo)).toBe(false);
  });
  it('returns false for unknown authority', async () => {
    const repo = makeAuthRepo([]);
    expect(await validateApprovalAgainstMasterData({ estimatedValue: 1_000, approvalAuthority: 'NOBODY' }, repo)).toBe(false);
  });
});

// APR-I-06
describe('resolveAuthorityFromMasterData', () => {
  it('returns the most junior qualifying authority', async () => {
    const repo = makeAuthRepo([auth('PM', 1, 999_999_999_999), auth('RECT', 3, 10_000_000_000)]);
    const a = await resolveAuthorityFromMasterData(5_000_000_000, repo);
    expect(a?.code).toBe('RECT');
  });
  it('returns null when no authority qualifies', async () => {
    const repo = makeAuthRepo([auth('RECT', 3, 1_000)]);
    expect(await resolveAuthorityFromMasterData(10_000_000_000, repo)).toBeNull();
  });
  it('returns the only active authority', async () => {
    const repo = makeAuthRepo([auth('RECTOR', 2, 50_000_000_000)]);
    expect((await resolveAuthorityFromMasterData(1_000_000, repo))?.code).toBe('RECTOR');
  });
});

// APR-I-07
describe('advanceWorkflowOnApproval', () => {
  it('returns ok=true for valid transition', () => {
    const wf = createWorkflow({ packageId: 'P1', packageType: 'GOODS', estimatedValue: 1_000, procurementMethod: 'DIRECT', approvalAuthority: 'RECT', performedBy: 'EMP' });
    const started = startWorkflow(wf, 'EMP');
    const result = advanceWorkflowOnApproval(started.data!, 'FUND_CONFIRMED', 'EMP');
    expect(result.ok).toBe(true);
  });
  it('returns ok=false for invalid transition', () => {
    const wf = createWorkflow({ packageId: 'P1', packageType: 'GOODS', estimatedValue: 1_000, procurementMethod: 'DIRECT', approvalAuthority: 'RECT', performedBy: 'EMP' });
    const result = advanceWorkflowOnApproval(wf, 'COMPLETED', 'EMP');
    expect(result.ok).toBe(false);
  });
  it('advances to the specified state on success', () => {
    const wf = createWorkflow({ packageId: 'P1', packageType: 'GOODS', estimatedValue: 1_000, procurementMethod: 'DIRECT', approvalAuthority: 'RECT', performedBy: 'EMP' });
    const started = startWorkflow(wf, 'EMP');
    const result = advanceWorkflowOnApproval(started.data!, 'FUND_CONFIRMED', 'EMP');
    expect(result.data?.context.currentState).toBe('FUND_CONFIRMED');
  });
});

// APR-I-08
describe('advanceWorkflowOnApproval — with notes', () => {
  it('passes notes to the workflow engine', () => {
    const wf = createWorkflow({ packageId: 'P1', packageType: 'GOODS', estimatedValue: 1_000, procurementMethod: 'DIRECT', approvalAuthority: 'RECT', performedBy: 'EMP' });
    const started = startWorkflow(wf, 'EMP');
    const result = advanceWorkflowOnApproval(started.data!, 'FUND_CONFIRMED', 'EMP', 'Plan approved by rector');
    expect(result.ok).toBe(true);
  });
  it('errors array is empty on success', () => {
    const wf = createWorkflow({ packageId: 'P1', packageType: 'GOODS', estimatedValue: 1_000, procurementMethod: 'DIRECT', approvalAuthority: 'RECT', performedBy: 'EMP' });
    const started = startWorkflow(wf, 'EMP');
    const result = advanceWorkflowOnApproval(started.data!, 'FUND_CONFIRMED', 'EMP');
    expect(result.errors).toHaveLength(0);
  });
  it('errors array is non-empty on failure', () => {
    const wf = createWorkflow({ packageId: 'P1', packageType: 'GOODS', estimatedValue: 1_000, procurementMethod: 'DIRECT', approvalAuthority: 'RECT', performedBy: 'EMP' });
    const result = advanceWorkflowOnApproval(wf, 'COMPLETED', 'EMP');
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

// APR-I-09
describe('buildApprovalSummary — empty state', () => {
  let repos: ApprovalRepositories;
  beforeEach(() => { repos = createMemoryApprovalRepositories(); });

  it('returns null for unknown requestId', async () => {
    expect(await buildApprovalSummary('NONE', repos)).toBeNull();
  });
  it('returns summary with commentCount=0 when no comments', async () => {
    const r = await createApprovalRequest(params(), repos);
    const summary = await buildApprovalSummary(r.id, repos);
    expect(summary?.commentCount).toBe(0);
  });
  it('returns summary with attachmentCount=0 when no attachments', async () => {
    const r = await createApprovalRequest(params(), repos);
    const summary = await buildApprovalSummary(r.id, repos);
    expect(summary?.attachmentCount).toBe(0);
  });
});

// APR-I-10
describe('buildApprovalSummary — with data', () => {
  let repos: ApprovalRepositories;
  beforeEach(() => { repos = createMemoryApprovalRepositories(); });

  it('reflects current status', async () => {
    const r = await createApprovalRequest(params(), repos);
    const summary = await buildApprovalSummary(r.id, repos);
    expect(summary?.status).toBe('DRAFT');
  });
  it('counts comments correctly', async () => {
    const r = await createApprovalRequest(params(), repos);
    await addComment(r.id, { content: 'c1', authorCode: 'U' }, 'U', repos.comments);
    await addComment(r.id, { content: 'c2', authorCode: 'U' }, 'U', repos.comments);
    const summary = await buildApprovalSummary(r.id, repos);
    expect(summary?.commentCount).toBe(2);
  });
  it('counts attachments correctly', async () => {
    const r = await createApprovalRequest(params(), repos);
    await addAttachment(r.id, { fileName: 'f.pdf', fileType: 'pdf', fileSize: 100, documentType: 'SUPPORTING_DOCUMENT' }, 'U', repos.attachments);
    const summary = await buildApprovalSummary(r.id, repos);
    expect(summary?.attachmentCount).toBe(1);
  });
});

// APR-I-11
describe('buildApprovalSummary — decision outcome', () => {
  let repos: ApprovalRepositories;
  beforeEach(() => { repos = createMemoryApprovalRepositories(); });

  it('decisionOutcome is undefined before decision', async () => {
    const r = await createApprovalRequest(params(), repos);
    const summary = await buildApprovalSummary(r.id, repos);
    expect(summary?.decisionOutcome).toBeUndefined();
  });
  it('decisionOutcome is APPROVED after approved decision', async () => {
    const r = await createApprovalRequest(params(), repos);
    await submitForApproval(r.id, 'EMP', repos);
    const ur = await assignAuthority(r.id, 'AUTH', 'Dir', 'ADMIN', repos);
    await recordDecision(ur.id, { outcome: 'APPROVED', decidedBy: 'MGR', legalBasis: 'L', decisionReference: 'D' }, repos);
    const summary = await buildApprovalSummary(r.id, repos);
    expect(summary?.decisionOutcome).toBe('APPROVED');
  });
  it('requestCode in summary matches original', async () => {
    const r = await createApprovalRequest(params(), repos);
    const summary = await buildApprovalSummary(r.id, repos);
    expect(summary?.requestCode).toBe('APR/KH/2026/0001');
  });
});

// APR-I-12
describe('buildApprovalSummary — type and subject', () => {
  let repos: ApprovalRepositories;
  beforeEach(() => { repos = createMemoryApprovalRepositories(); });

  it('approvalType matches the request', async () => {
    const r = await createApprovalRequest(params(), repos);
    const summary = await buildApprovalSummary(r.id, repos);
    expect(summary?.approvalType).toBe('PLAN_APPROVAL');
  });
  it('subjectId matches the request', async () => {
    const r = await createApprovalRequest(params(), repos);
    const summary = await buildApprovalSummary(r.id, repos);
    expect(summary?.subjectId).toBe('PLAN-1');
  });
  it('subjectType matches the request', async () => {
    const r = await createApprovalRequest(params(), repos);
    const summary = await buildApprovalSummary(r.id, repos);
    expect(summary?.subjectType).toBe('PLAN');
  });
});

// APR-I-13
describe('buildApprovalFromPackage + buildApprovalFromPlan — sequence numbers', () => {
  it('sequence number is zero-padded to 4 digits', () => {
    const params = buildApprovalFromPackage(samplePackage(), 'EMP-1', 2026, 7);
    expect(params.requestCode.endsWith('0007')).toBe(true);
  });
  it('plan sequence number is padded correctly', () => {
    const params = buildApprovalFromPlan(samplePlan(), 'EMP-1', 2026, 42);
    expect(params.requestCode.endsWith('0042')).toBe(true);
  });
  it('year appears in requestCode', () => {
    const params = buildApprovalFromPlan(samplePlan(), 'EMP-1', 2027, 1);
    expect(params.requestCode).toContain('2027');
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function params() {
  return { requestCode: 'APR/KH/2026/0001', approvalType: 'PLAN_APPROVAL' as const, subjectId: 'PLAN-1', subjectType: 'PLAN' as const, requestedBy: 'EMP-001', department: 'DEPT-A', estimatedValue: 2_000_000_000 };
}

function samplePackage(): ProcurementPackage {
  return {
    id: 'PKG-001', packageCode: 'DTMS/2026/001', packageName: 'Test Package',
    description: 'desc', packageType: 'GOODS', procurementMethod: 'OPEN_BIDDING',
    estimatedValue: 5_000_000_000, fundSource: 'STATE', budgetYear: '2026',
    department: 'DEPT-A', owner: 'EMP-1', status: 'DRAFT',
    schedule: {} as any, funding: [], participants: [],
    createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  } as ProcurementPackage;
}

function samplePlan(): ProcurementPlan {
  return {
    id: 'PLAN-001', planNumber: 'KH/2026/001', fiscalYear: '2026',
    organization: 'ORG-1', responsibleDepartment: 'KH-TC',
    estimatedTotal: 10_000_000_000, status: 'DRAFT' as any,
    approvalHistory: [], requestIds: [], generatedPackageIds: [],
    createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  } as ProcurementPlan;
}
