import { describe, it, expect, beforeEach } from 'vitest';
import { formCommittee, addMember, removeMember, getCommitteeMembers } from '../acceptance/acceptanceCommittee';
import { createAcceptanceRequest } from '../acceptance/acceptanceService';
import { createMemoryAcceptanceRepositories } from '../acceptance/acceptanceFactory';
import type { AcceptanceRepositories } from '../acceptance/acceptanceRepositories';
import { AcceptanceError } from '../acceptance/acceptanceTypes';
import type { CreateAcceptanceParams, FormCommitteeParams, AddMemberParams } from '../acceptance/acceptanceTypes';

// ACR-C-01
describe('formCommittee — happy path', () => {
  let repos: AcceptanceRepositories;
  let requestId: string;
  beforeEach(async () => {
    repos = createMemoryAcceptanceRepositories();
    requestId = (await createAcceptanceRequest(rparams(), repos)).id;
  });

  it('creates a committee', async () => {
    const c = await formCommittee(requestId, cparams(), 'DIR', repos);
    expect(c.committeeCode).toBe('HDNT-01');
  });
  it('advances request status to COMMITTEE_FORMED', async () => {
    await formCommittee(requestId, cparams(), 'DIR', repos);
    const r = await repos.requests.findById(requestId);
    expect(r?.status).toBe('COMMITTEE_FORMED');
  });
  it('records COMMITTEE_FORMED history event', async () => {
    await formCommittee(requestId, cparams(), 'DIR', repos);
    const events = await repos.history.findByRequestId(requestId);
    expect(events.some(e => e.action === 'COMMITTEE_FORMED')).toBe(true);
  });
});

// ACR-C-02
describe('formCommittee — validation', () => {
  let repos: AcceptanceRepositories;
  let requestId: string;
  beforeEach(async () => {
    repos = createMemoryAcceptanceRepositories();
    requestId = (await createAcceptanceRequest(rparams(), repos)).id;
  });

  it('throws for unknown requestId', async () => {
    await expect(formCommittee('NONE', cparams(), 'DIR', repos)).rejects.toThrow(AcceptanceError);
  });
  it('throws when committeeCode is empty', async () => {
    await expect(formCommittee(requestId, { ...cparams(), committeeCode: '' }, 'DIR', repos)).rejects.toThrow(AcceptanceError);
  });
  it('throws when committee already formed', async () => {
    await formCommittee(requestId, cparams(), 'DIR', repos);
    await expect(formCommittee(requestId, { ...cparams(), committeeCode: 'HDNT-02' }, 'DIR', repos)).rejects.toThrow(AcceptanceError);
  });
});

// ACR-C-03
describe('formCommittee — optional fields', () => {
  let repos: AcceptanceRepositories;
  let requestId: string;
  beforeEach(async () => {
    repos = createMemoryAcceptanceRepositories();
    requestId = (await createAcceptanceRequest(rparams(), repos)).id;
  });

  it('stores decisionReference', async () => {
    const c = await formCommittee(requestId, { ...cparams(), decisionReference: 'QĐ-01/2026' }, 'DIR', repos);
    expect(c.decisionReference).toBe('QĐ-01/2026');
  });
  it('stores requestId on committee', async () => {
    const c = await formCommittee(requestId, cparams(), 'DIR', repos);
    expect(c.requestId).toBe(requestId);
  });
  it('only DRAFT requests can form committee', async () => {
    await repos.requests.update(requestId, { status: 'IN_PROGRESS' });
    await expect(formCommittee(requestId, cparams(), 'DIR', repos)).rejects.toThrow(AcceptanceError);
  });
});

// ACR-C-04
describe('addMember — happy path', () => {
  let repos: AcceptanceRepositories;
  let requestId: string;
  let committeeId: string;
  beforeEach(async () => {
    repos = createMemoryAcceptanceRepositories();
    requestId = (await createAcceptanceRequest(rparams(), repos)).id;
    const c = await formCommittee(requestId, cparams(), 'DIR', repos);
    committeeId = c.id;
  });

  it('adds a member', async () => {
    const m = await addMember(requestId, committeeId, mparams(), 'DIR', repos);
    expect(m.memberCode).toBe('EMP-01');
  });
  it('member is active', async () => {
    const m = await addMember(requestId, committeeId, mparams(), 'DIR', repos);
    expect(m.isActive).toBe(true);
  });
  it('records MEMBER_ADDED event', async () => {
    await addMember(requestId, committeeId, mparams(), 'DIR', repos);
    const events = await repos.history.findByRequestId(requestId);
    expect(events.some(e => e.action === 'MEMBER_ADDED')).toBe(true);
  });
});

// ACR-C-05
describe('addMember — duplicate guard', () => {
  let repos: AcceptanceRepositories;
  let requestId: string;
  let committeeId: string;
  beforeEach(async () => {
    repos = createMemoryAcceptanceRepositories();
    requestId = (await createAcceptanceRequest(rparams(), repos)).id;
    const c = await formCommittee(requestId, cparams(), 'DIR', repos);
    committeeId = c.id;
  });

  it('throws when same memberCode added twice', async () => {
    await addMember(requestId, committeeId, mparams(), 'DIR', repos);
    await expect(addMember(requestId, committeeId, mparams(), 'DIR', repos)).rejects.toThrow(AcceptanceError);
  });
  it('allows different memberCode in same committee', async () => {
    await addMember(requestId, committeeId, mparams(), 'DIR', repos);
    const m2 = await addMember(requestId, committeeId, { ...mparams(), memberCode: 'EMP-02', role: 'MEMBER' }, 'DIR', repos);
    expect(m2.memberCode).toBe('EMP-02');
  });
  it('throws for unknown committeeId', async () => {
    await expect(addMember(requestId, 'NONE', mparams(), 'DIR', repos)).rejects.toThrow(AcceptanceError);
  });
});

// ACR-C-06
describe('addMember — roles', () => {
  let repos: AcceptanceRepositories;
  let requestId: string;
  let committeeId: string;
  beforeEach(async () => {
    repos = createMemoryAcceptanceRepositories();
    requestId = (await createAcceptanceRequest(rparams(), repos)).id;
    const c = await formCommittee(requestId, cparams(), 'DIR', repos);
    committeeId = c.id;
  });

  it('stores CHAIRMAN role', async () => {
    const m = await addMember(requestId, committeeId, { ...mparams(), role: 'CHAIRMAN' }, 'DIR', repos);
    expect(m.role).toBe('CHAIRMAN');
  });
  it('stores EXPERT role', async () => {
    const m = await addMember(requestId, committeeId, { ...mparams(), memberCode: 'EXP-01', role: 'EXPERT' }, 'DIR', repos);
    expect(m.role).toBe('EXPERT');
  });
  it('stores organization when provided', async () => {
    const m = await addMember(requestId, committeeId, { ...mparams(), organization: 'Viện Xây dựng' }, 'DIR', repos);
    expect(m.organization).toBe('Viện Xây dựng');
  });
});

// ACR-C-07
describe('removeMember', () => {
  let repos: AcceptanceRepositories;
  let requestId: string;
  let committeeId: string;
  beforeEach(async () => {
    repos = createMemoryAcceptanceRepositories();
    requestId = (await createAcceptanceRequest(rparams(), repos)).id;
    const c = await formCommittee(requestId, cparams(), 'DIR', repos);
    committeeId = c.id;
  });

  it('sets isActive to false', async () => {
    const m = await addMember(requestId, committeeId, mparams(), 'DIR', repos);
    const removed = await removeMember(m.id, 'DIR', repos);
    expect(removed.isActive).toBe(false);
  });
  it('records MEMBER_REMOVED event', async () => {
    const m = await addMember(requestId, committeeId, mparams(), 'DIR', repos);
    await removeMember(m.id, 'DIR', repos);
    const events = await repos.history.findByRequestId(requestId);
    expect(events.some(e => e.action === 'MEMBER_REMOVED')).toBe(true);
  });
  it('throws for unknown memberId', async () => {
    await expect(removeMember('NONE', 'DIR', repos)).rejects.toThrow(AcceptanceError);
  });
});

// ACR-C-08
describe('removeMember — already removed', () => {
  let repos: AcceptanceRepositories;
  let requestId: string;
  let committeeId: string;
  beforeEach(async () => {
    repos = createMemoryAcceptanceRepositories();
    requestId = (await createAcceptanceRequest(rparams(), repos)).id;
    const c = await formCommittee(requestId, cparams(), 'DIR', repos);
    committeeId = c.id;
  });

  it('throws when already removed', async () => {
    const m = await addMember(requestId, committeeId, mparams(), 'DIR', repos);
    await removeMember(m.id, 'DIR', repos);
    await expect(removeMember(m.id, 'DIR', repos)).rejects.toThrow(AcceptanceError);
  });
  it('error code is ALREADY_REMOVED', async () => {
    const m = await addMember(requestId, committeeId, mparams(), 'DIR', repos);
    await removeMember(m.id, 'DIR', repos);
    try { await removeMember(m.id, 'DIR', repos); }
    catch (e) { expect((e as AcceptanceError).code).toBe('ALREADY_REMOVED'); }
  });
  it('findActiveByCommitteeId excludes removed member', async () => {
    const m = await addMember(requestId, committeeId, mparams(), 'DIR', repos);
    await removeMember(m.id, 'DIR', repos);
    expect(await repos.members.findActiveByCommitteeId(committeeId)).toHaveLength(0);
  });
});

// ACR-C-09
describe('getCommitteeMembers', () => {
  let repos: AcceptanceRepositories;
  let requestId: string;
  let committeeId: string;
  beforeEach(async () => {
    repos = createMemoryAcceptanceRepositories();
    requestId = (await createAcceptanceRequest(rparams(), repos)).id;
    const c = await formCommittee(requestId, cparams(), 'DIR', repos);
    committeeId = c.id;
  });

  it('returns empty initially', async () => {
    expect(await getCommitteeMembers(committeeId, repos)).toHaveLength(0);
  });
  it('returns active members', async () => {
    await addMember(requestId, committeeId, mparams(), 'DIR', repos);
    expect(await getCommitteeMembers(committeeId, repos)).toHaveLength(1);
  });
  it('excludes removed members', async () => {
    const m = await addMember(requestId, committeeId, mparams(), 'DIR', repos);
    await removeMember(m.id, 'DIR', repos);
    expect(await getCommitteeMembers(committeeId, repos)).toHaveLength(0);
  });
});

// ACR-C-10
describe('addMember — validation', () => {
  let repos: AcceptanceRepositories;
  let requestId: string;
  let committeeId: string;
  beforeEach(async () => {
    repos = createMemoryAcceptanceRepositories();
    requestId = (await createAcceptanceRequest(rparams(), repos)).id;
    const c = await formCommittee(requestId, cparams(), 'DIR', repos);
    committeeId = c.id;
  });

  it('throws when memberCode is empty', async () => {
    await expect(addMember(requestId, committeeId, { ...mparams(), memberCode: '' }, 'DIR', repos)).rejects.toThrow(AcceptanceError);
  });
  it('throws when memberName is empty', async () => {
    await expect(addMember(requestId, committeeId, { ...mparams(), memberName: '' }, 'DIR', repos)).rejects.toThrow(AcceptanceError);
  });
  it('stores SECRETARY role', async () => {
    const m = await addMember(requestId, committeeId, { ...mparams(), memberCode: 'SEC-01', role: 'SECRETARY' }, 'DIR', repos);
    expect(m.role).toBe('SECRETARY');
  });
});

// ACR-C-11
describe('formCommittee — decisionReference', () => {
  let repos: AcceptanceRepositories;
  let requestId: string;
  beforeEach(async () => {
    repos = createMemoryAcceptanceRepositories();
    requestId = (await createAcceptanceRequest(rparams(), repos)).id;
  });

  it('works without decisionReference', async () => {
    const c = await formCommittee(requestId, { committeeCode: 'HDNT-01', establishedBy: 'DIR' }, 'DIR', repos);
    expect(c.decisionReference).toBeUndefined();
  });
  it('stores notes when provided', async () => {
    const c = await formCommittee(requestId, { ...cparams(), notes: 'Theo QĐ 123/2026' }, 'DIR', repos);
    expect(c.notes).toBe('Theo QĐ 123/2026');
  });
  it('committee has id after creation', async () => {
    const c = await formCommittee(requestId, cparams(), 'DIR', repos);
    expect(c.id).toBeTruthy();
  });
});

// ACR-C-12
describe('findByRequestId after committee operations', () => {
  let repos: AcceptanceRepositories;
  let requestId: string;
  let committeeId: string;
  beforeEach(async () => {
    repos = createMemoryAcceptanceRepositories();
    requestId = (await createAcceptanceRequest(rparams(), repos)).id;
    const c = await formCommittee(requestId, cparams(), 'DIR', repos);
    committeeId = c.id;
  });

  it('committee is findable by requestId', async () => {
    const c = await repos.committees.findByRequestId(requestId);
    expect(c?.committeeCode).toBe('HDNT-01');
  });
  it('members are findable by committeeId', async () => {
    await addMember(requestId, committeeId, mparams(), 'DIR', repos);
    expect(await repos.members.findByCommitteeId(committeeId)).toHaveLength(1);
  });
  it('multiple members in same committee', async () => {
    await addMember(requestId, committeeId, mparams(), 'DIR', repos);
    await addMember(requestId, committeeId, { ...mparams(), memberCode: 'EMP-02', role: 'SECRETARY' }, 'DIR', repos);
    expect(await getCommitteeMembers(committeeId, repos)).toHaveLength(2);
  });
});

// ACR-C-13
describe('COMMITTEE_EXISTS error code', () => {
  let repos: AcceptanceRepositories;
  let requestId: string;
  beforeEach(async () => {
    repos = createMemoryAcceptanceRepositories();
    requestId = (await createAcceptanceRequest(rparams(), repos)).id;
  });

  it('error code is COMMITTEE_EXISTS for duplicate committee', async () => {
    await formCommittee(requestId, cparams(), 'DIR', repos);
    try { await formCommittee(requestId, { ...cparams(), committeeCode: 'X' }, 'DIR', repos); }
    catch (e) { expect((e as AcceptanceError).code).toBe('COMMITTEE_EXISTS'); }
  });
  it('error code is NOT_FOUND for unknown request', async () => {
    try { await formCommittee('NONE', cparams(), 'DIR', repos); }
    catch (e) { expect((e as AcceptanceError).code).toBe('NOT_FOUND'); }
  });
  it('error code is DUPLICATE_MEMBER for re-add', async () => {
    const c = await formCommittee(requestId, cparams(), 'DIR', repos);
    await addMember(requestId, c.id, mparams(), 'DIR', repos);
    try { await addMember(requestId, c.id, mparams(), 'DIR', repos); }
    catch (e) { expect((e as AcceptanceError).code).toBe('DUPLICATE_MEMBER'); }
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rparams(): CreateAcceptanceParams {
  return { requestCode: 'NT/FINAL/2026/0001', acceptanceType: 'FINAL', contractId: 'C-001', requestedBy: 'EMP-01', department: 'BLD-01' };
}
function cparams(): FormCommitteeParams {
  return { committeeCode: 'HDNT-01', establishedBy: 'DIR-01' };
}
function mparams(): AddMemberParams {
  return { memberCode: 'EMP-01', memberName: 'Nguyễn Văn A', role: 'CHAIRMAN' };
}
