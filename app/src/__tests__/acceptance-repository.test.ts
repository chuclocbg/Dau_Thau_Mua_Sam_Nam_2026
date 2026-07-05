import { describe, it, expect, beforeEach } from 'vitest';
import { createMemoryAcceptanceRepositories } from '../acceptance/acceptanceFactory';
import type { AcceptanceRepositories } from '../acceptance/acceptanceRepositories';
import type { AcceptanceRequest, AcceptanceMember, AcceptanceSession } from '../acceptance/acceptanceTypes';

// ACR-R-01
describe('MemoryAcceptanceRequestRepository — create + findById', () => {
  let repos: AcceptanceRepositories;
  beforeEach(() => { repos = createMemoryAcceptanceRepositories(); });

  it('creates a request with generated id', async () => {
    const r = await repos.requests.create(sampleRequest());
    expect(r.id).toBeTruthy();
  });
  it('findById returns created request', async () => {
    const r = await repos.requests.create(sampleRequest());
    expect(await repos.requests.findById(r.id)).toEqual(r);
  });
  it('findById returns null for unknown id', async () => {
    expect(await repos.requests.findById('NONE')).toBeNull();
  });
});

// ACR-R-02
describe('MemoryAcceptanceRequestRepository — findByCode', () => {
  let repos: AcceptanceRepositories;
  beforeEach(() => { repos = createMemoryAcceptanceRepositories(); });

  it('finds by requestCode', async () => {
    await repos.requests.create(sampleRequest({ requestCode: 'NT/001' }));
    expect((await repos.requests.findByCode('NT/001'))?.requestCode).toBe('NT/001');
  });
  it('returns null for unknown code', async () => {
    expect(await repos.requests.findByCode('NOPE')).toBeNull();
  });
  it('distinguishes different codes', async () => {
    await repos.requests.create(sampleRequest({ requestCode: 'A' }));
    await repos.requests.create(sampleRequest({ requestCode: 'B' }));
    expect((await repos.requests.findByCode('A'))?.requestCode).toBe('A');
  });
});

// ACR-R-03
describe('MemoryAcceptanceRequestRepository — findByContractId + findByStatus', () => {
  let repos: AcceptanceRepositories;
  beforeEach(() => { repos = createMemoryAcceptanceRepositories(); });

  it('filters by contractId', async () => {
    await repos.requests.create(sampleRequest({ requestCode: 'R1', contractId: 'C-1' }));
    await repos.requests.create(sampleRequest({ requestCode: 'R2', contractId: 'C-2' }));
    expect(await repos.requests.findByContractId('C-1')).toHaveLength(1);
  });
  it('filters by status', async () => {
    await repos.requests.create(sampleRequest({ requestCode: 'D1', status: 'DRAFT' }));
    await repos.requests.create(sampleRequest({ requestCode: 'C1', status: 'COMPLETED' }));
    expect(await repos.requests.findByStatus('DRAFT')).toHaveLength(1);
  });
  it('search filters by acceptanceType', async () => {
    await repos.requests.create(sampleRequest({ requestCode: 'F', acceptanceType: 'FINAL' }));
    await repos.requests.create(sampleRequest({ requestCode: 'P', acceptanceType: 'PARTIAL' }));
    expect((await repos.requests.search({ acceptanceType: 'FINAL' })).total).toBe(1);
  });
});

// ACR-R-04
describe('MemoryAcceptanceRequestRepository — search + pagination', () => {
  let repos: AcceptanceRepositories;
  beforeEach(() => { repos = createMemoryAcceptanceRepositories(); });

  it('returns all when no filter', async () => {
    await repos.requests.create(sampleRequest({ requestCode: 'S1' }));
    await repos.requests.create(sampleRequest({ requestCode: 'S2' }));
    expect((await repos.requests.search({})).total).toBe(2);
  });
  it('paginates correctly', async () => {
    for (let i = 0; i < 5; i++) await repos.requests.create(sampleRequest({ requestCode: `P${i}` }));
    const result = await repos.requests.search({ page: 1, pageSize: 3 });
    expect(result.items).toHaveLength(3);
  });
  it('search by department', async () => {
    await repos.requests.create(sampleRequest({ requestCode: 'X1', department: 'BLD' }));
    await repos.requests.create(sampleRequest({ requestCode: 'X2', department: 'TECH' }));
    expect((await repos.requests.search({ department: 'BLD' })).total).toBe(1);
  });
});

// ACR-R-05
describe('MemoryAcceptanceCommitteeRepository', () => {
  let repos: AcceptanceRepositories;
  beforeEach(() => { repos = createMemoryAcceptanceRepositories(); });

  it('creates a committee', async () => {
    const c = await repos.committees.create(sampleCommittee());
    expect(c.committeeCode).toBe('HDNT-01');
  });
  it('findByRequestId returns committee', async () => {
    await repos.committees.create(sampleCommittee({ requestId: 'R-1' }));
    expect((await repos.committees.findByRequestId('R-1'))?.committeeCode).toBe('HDNT-01');
  });
  it('findByRequestId returns null when none', async () => {
    expect(await repos.committees.findByRequestId('NONE')).toBeNull();
  });
});

// ACR-R-06
describe('MemoryAcceptanceMemberRepository', () => {
  let repos: AcceptanceRepositories;
  beforeEach(() => { repos = createMemoryAcceptanceRepositories(); });

  it('creates a member', async () => {
    const m = await repos.members.create(sampleMember());
    expect(m.memberCode).toBe('EMP-01');
  });
  it('findActiveByCommitteeId returns only active', async () => {
    await repos.members.create(sampleMember({ memberCode: 'A', isActive: true }));
    await repos.members.create(sampleMember({ memberCode: 'B', isActive: false }));
    expect(await repos.members.findActiveByCommitteeId('COMM-1')).toHaveLength(1);
  });
  it('findByRequestId returns active members for request', async () => {
    await repos.members.create(sampleMember({ memberCode: 'C', requestId: 'REQ-1', isActive: true }));
    expect(await repos.members.findByRequestId('REQ-1')).toHaveLength(1);
  });
});

// ACR-R-07
describe('MemoryAcceptanceSessionRepository', () => {
  let repos: AcceptanceRepositories;
  beforeEach(() => { repos = createMemoryAcceptanceRepositories(); });

  it('creates a session', async () => {
    const s = await repos.sessions.create(sampleSession());
    expect(s.id).toBeTruthy();
  });
  it('findByRequestId sorted by sessionNumber', async () => {
    await repos.sessions.create(sampleSession({ sessionNumber: 2 }));
    await repos.sessions.create(sampleSession({ sessionNumber: 1 }));
    const all = await repos.sessions.findByRequestId('R-1');
    expect(all[0]?.sessionNumber).toBe(1);
  });
  it('findCompletedByRequestId returns only COMPLETED', async () => {
    await repos.sessions.create(sampleSession({ sessionNumber: 1, status: 'COMPLETED' }));
    await repos.sessions.create(sampleSession({ sessionNumber: 2, status: 'PENDING' }));
    expect(await repos.sessions.findCompletedByRequestId('R-1')).toHaveLength(1);
  });
});

// ACR-R-08
describe('MemoryAcceptanceItemRepository', () => {
  let repos: AcceptanceRepositories;
  beforeEach(() => { repos = createMemoryAcceptanceRepositories(); });

  it('creates an item', async () => {
    const i = await repos.items.create(sampleItem());
    expect(i.itemCode).toBe('ITEM-01');
  });
  it('findBySessionId returns items for session', async () => {
    await repos.items.create(sampleItem({ sessionId: 'S-1' }));
    await repos.items.create(sampleItem({ itemCode: 'ITEM-02', sessionId: 'S-2' }));
    expect(await repos.items.findBySessionId('S-1')).toHaveLength(1);
  });
  it('countAcceptedByRequestId counts ACCEPTED', async () => {
    await repos.items.create(sampleItem({ requestId: 'R-1', status: 'ACCEPTED' }));
    await repos.items.create(sampleItem({ itemCode: 'X', requestId: 'R-1', status: 'REJECTED' }));
    expect(await repos.items.countAcceptedByRequestId('R-1')).toBe(1);
  });
});

// ACR-R-09
describe('MemoryAcceptanceMinuteRepository', () => {
  let repos: AcceptanceRepositories;
  beforeEach(() => { repos = createMemoryAcceptanceRepositories(); });

  it('creates a minute', async () => {
    const m = await repos.minutes.create(sampleMinute());
    expect(m.minuteCode).toBe('BB/001');
  });
  it('findBySessionId returns minute for session', async () => {
    await repos.minutes.create(sampleMinute({ sessionId: 'S-1' }));
    expect((await repos.minutes.findBySessionId('S-1'))?.minuteCode).toBe('BB/001');
  });
  it('findByRequestId returns all minutes for request', async () => {
    await repos.minutes.create(sampleMinute({ minuteCode: 'BB/001' }));
    await repos.minutes.create(sampleMinute({ minuteCode: 'BB/002' }));
    expect(await repos.minutes.findByRequestId('R-1')).toHaveLength(2);
  });
});

// ACR-R-10
describe('MemoryAcceptanceHistoryRepository', () => {
  let repos: AcceptanceRepositories;
  beforeEach(() => { repos = createMemoryAcceptanceRepositories(); });

  it('creates a history entry', async () => {
    const e = await repos.history.create({ requestId: 'R-1', action: 'CREATED', performedBy: 'U', performedAt: '2026-01-01T00:00:00Z' } as any);
    expect(e.id).toBeTruthy();
  });
  it('findByRequestId returns sorted by performedAt', async () => {
    await repos.history.create({ requestId: 'R-1', action: 'COMMITTEE_FORMED', performedBy: 'U', performedAt: '2026-02-01T00:00:00Z' } as any);
    await repos.history.create({ requestId: 'R-1', action: 'CREATED',          performedBy: 'U', performedAt: '2026-01-01T00:00:00Z' } as any);
    const events = await repos.history.findByRequestId('R-1');
    expect(events[0]?.action).toBe('CREATED');
  });
  it('findByRequestId filters by requestId', async () => {
    await repos.history.create({ requestId: 'R-1', action: 'CREATED', performedBy: 'U', performedAt: '2026-01-01T00:00:00Z' } as any);
    await repos.history.create({ requestId: 'R-2', action: 'CREATED', performedBy: 'U', performedAt: '2026-01-01T00:00:00Z' } as any);
    expect(await repos.history.findByRequestId('R-1')).toHaveLength(1);
  });
});

// ACR-R-11
describe('MemoryAcceptanceAttachmentRepository', () => {
  let repos: AcceptanceRepositories;
  beforeEach(() => { repos = createMemoryAcceptanceRepositories(); });

  it('creates an attachment', async () => {
    const a = await repos.attachments.create({ requestId: 'R-1', fileName: 'test.pdf', fileType: 'pdf', fileSize: 100, uploadedBy: 'U', documentType: 'ACCEPTANCE_MINUTE' } as any);
    expect(a.fileName).toBe('test.pdf');
  });
  it('countByRequestId returns 0 for empty', async () => {
    expect(await repos.attachments.countByRequestId('NONE')).toBe(0);
  });
  it('findByRequestId returns matching', async () => {
    await repos.attachments.create({ requestId: 'R-1', fileName: 'a.pdf', fileType: 'pdf', fileSize: 100, uploadedBy: 'U', documentType: 'OTHER' } as any);
    expect(await repos.attachments.findByRequestId('R-1')).toHaveLength(1);
  });
});

// ACR-R-12
describe('MemoryAcceptanceRequestRepository — update + delete + count', () => {
  let repos: AcceptanceRepositories;
  beforeEach(() => { repos = createMemoryAcceptanceRepositories(); });

  it('update changes status', async () => {
    const r = await repos.requests.create(sampleRequest());
    const u = await repos.requests.update(r.id, { status: 'COMPLETED' });
    expect(u.status).toBe('COMPLETED');
  });
  it('delete removes record', async () => {
    const r = await repos.requests.create(sampleRequest());
    await repos.requests.delete(r.id);
    expect(await repos.requests.findById(r.id)).toBeNull();
  });
  it('count reflects created records', async () => {
    await repos.requests.create(sampleRequest());
    expect(await repos.requests.count()).toBe(1);
  });
});

// ACR-R-13
describe('createMemoryAcceptanceRepositories factory', () => {
  it('returns 8 repositories', () => {
    const repos = createMemoryAcceptanceRepositories();
    expect(repos.requests).toBeTruthy();
    expect(repos.committees).toBeTruthy();
    expect(repos.members).toBeTruthy();
    expect(repos.sessions).toBeTruthy();
    expect(repos.items).toBeTruthy();
    expect(repos.minutes).toBeTruthy();
    expect(repos.history).toBeTruthy();
    expect(repos.attachments).toBeTruthy();
  });
  it('each call returns independent instances', async () => {
    const a = createMemoryAcceptanceRepositories();
    const b = createMemoryAcceptanceRepositories();
    await a.requests.create(sampleRequest());
    expect(await b.requests.count()).toBe(0);
  });
  it('findByCode returns null when empty', async () => {
    const repos = createMemoryAcceptanceRepositories();
    expect(await repos.requests.findByCode('NT/001')).toBeNull();
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sampleRequest(o: Partial<Omit<AcceptanceRequest, 'id' | 'createdAt' | 'updatedAt'>> = {}): Omit<AcceptanceRequest, 'id' | 'createdAt' | 'updatedAt'> {
  return { requestCode: 'NT/FINAL/2026/0001', acceptanceType: 'FINAL', contractId: 'C-1', requestedBy: 'EMP-01', requestedAt: '2026-07-01T00:00:00Z', department: 'BLD', legalBasis: ['Luật 22/2023/QH15'], status: 'DRAFT', ...o };
}
function sampleCommittee(o: any = {}): any {
  return { requestId: 'R-1', committeeCode: 'HDNT-01', establishedBy: 'DIR-01', establishedAt: '2026-07-01T00:00:00Z', ...o };
}
function sampleMember(o: Partial<AcceptanceMember> = {}): any {
  return { committeeId: 'COMM-1', requestId: 'REQ-1', memberCode: 'EMP-01', memberName: 'Nguyễn A', role: 'CHAIRMAN', isActive: true, ...o };
}
function sampleSession(o: Partial<AcceptanceSession> = {}): any {
  return { requestId: 'R-1', sessionNumber: 1, sessionType: 'FINAL', scheduledDate: '2026-08-01', status: 'PENDING', ...o };
}
function sampleItem(o: any = {}): any {
  return { sessionId: 'S-1', requestId: 'R-1', itemCode: 'ITEM-01', description: 'Hạng mục A', contractedQuantity: 10, acceptedQuantity: 10, rejectedQuantity: 0, status: 'ACCEPTED', ...o };
}
function sampleMinute(o: any = {}): any {
  return { requestId: 'R-1', sessionId: 'S-1', minuteCode: 'BB/001', conclusion: 'Nghiệm thu đạt yêu cầu', status: 'DRAFT', ...o };
}
