import { describe, it, expect, beforeEach } from 'vitest';
import { createMemoryContractRepositories } from '../contract/contractFactory';
import type { ContractRepositories } from '../contract/contractRepositories';
import type { Contract, ContractGuarantee } from '../contract/contractTypes';

// CTR-R-01
describe('MemoryContractRepository — create + findById', () => {
  let repos: ContractRepositories;
  beforeEach(() => { repos = createMemoryContractRepositories(); });

  it('creates a contract with generated id', async () => {
    const c = await repos.contracts.create(sampleContract());
    expect(c.id).toBeTruthy();
  });
  it('findById returns created contract', async () => {
    const c = await repos.contracts.create(sampleContract());
    expect(await repos.contracts.findById(c.id)).toEqual(c);
  });
  it('findById returns null for unknown id', async () => {
    expect(await repos.contracts.findById('NO')).toBeNull();
  });
});

// CTR-R-02
describe('MemoryContractRepository — findByNumber', () => {
  let repos: ContractRepositories;
  beforeEach(() => { repos = createMemoryContractRepositories(); });

  it('finds by contractNumber', async () => {
    await repos.contracts.create(sampleContract({ contractNumber: 'HĐ/001' }));
    expect((await repos.contracts.findByNumber('HĐ/001'))?.contractNumber).toBe('HĐ/001');
  });
  it('returns null for unknown number', async () => {
    expect(await repos.contracts.findByNumber('NOPE')).toBeNull();
  });
  it('distinguishes different numbers', async () => {
    await repos.contracts.create(sampleContract({ contractNumber: 'HĐ/A' }));
    await repos.contracts.create(sampleContract({ contractNumber: 'HĐ/B' }));
    expect((await repos.contracts.findByNumber('HĐ/A'))?.contractNumber).toBe('HĐ/A');
  });
});

// CTR-R-03
describe('MemoryContractRepository — findByStatus', () => {
  let repos: ContractRepositories;
  beforeEach(() => { repos = createMemoryContractRepositories(); });

  it('filters by status', async () => {
    await repos.contracts.create(sampleContract({ contractNumber: 'A', status: 'DRAFT' }));
    await repos.contracts.create(sampleContract({ contractNumber: 'B', status: 'SIGNED' }));
    expect(await repos.contracts.findByStatus('DRAFT')).toHaveLength(1);
  });
  it('returns empty for no match', async () => {
    await repos.contracts.create(sampleContract());
    expect(await repos.contracts.findByStatus('COMPLETED')).toHaveLength(0);
  });
  it('returns all EFFECTIVE contracts', async () => {
    await repos.contracts.create(sampleContract({ contractNumber: 'X', status: 'EFFECTIVE' }));
    await repos.contracts.create(sampleContract({ contractNumber: 'Y', status: 'EFFECTIVE' }));
    expect(await repos.contracts.findByStatus('EFFECTIVE')).toHaveLength(2);
  });
});

// CTR-R-04
describe('MemoryContractRepository — findByPackageId + findByWinnerCode', () => {
  let repos: ContractRepositories;
  beforeEach(() => { repos = createMemoryContractRepositories(); });

  it('filters by packageId', async () => {
    await repos.contracts.create(sampleContract({ contractNumber: 'P1', packageId: 'PKG-1' }));
    await repos.contracts.create(sampleContract({ contractNumber: 'P2', packageId: 'PKG-2' }));
    expect(await repos.contracts.findByPackageId('PKG-1')).toHaveLength(1);
  });
  it('filters by winnerCode', async () => {
    await repos.contracts.create(sampleContract({ contractNumber: 'W1', winnerCode: 'VND-01' }));
    await repos.contracts.create(sampleContract({ contractNumber: 'W2', winnerCode: 'VND-02' }));
    expect(await repos.contracts.findByWinnerCode('VND-01')).toHaveLength(1);
  });
  it('findByPackageId returns empty for no match', async () => {
    expect(await repos.contracts.findByPackageId('NONE')).toHaveLength(0);
  });
});

// CTR-R-05
describe('MemoryContractRepository — search', () => {
  let repos: ContractRepositories;
  beforeEach(() => { repos = createMemoryContractRepositories(); });

  it('returns all when no filter', async () => {
    await repos.contracts.create(sampleContract({ contractNumber: 'S1' }));
    await repos.contracts.create(sampleContract({ contractNumber: 'S2' }));
    expect((await repos.contracts.search({})).total).toBe(2);
  });
  it('filters by status in search', async () => {
    await repos.contracts.create(sampleContract({ contractNumber: 'D1', status: 'DRAFT' }));
    await repos.contracts.create(sampleContract({ contractNumber: 'E1', status: 'EFFECTIVE' }));
    expect((await repos.contracts.search({ status: 'DRAFT' })).total).toBe(1);
  });
  it('paginates correctly', async () => {
    for (let i = 0; i < 5; i++) await repos.contracts.create(sampleContract({ contractNumber: `N${i}` }));
    const result = await repos.contracts.search({ page: 1, pageSize: 3 });
    expect(result.items).toHaveLength(3);
    expect(result.pageSize).toBe(3);
  });
});

// CTR-R-06
describe('MemoryContractAmendmentRepository', () => {
  let repos: ContractRepositories;
  beforeEach(() => { repos = createMemoryContractRepositories(); });

  it('creates an amendment', async () => {
    const a = await repos.amendments.create(sampleAmendment());
    expect(a.id).toBeTruthy();
  });
  it('findByContractId returns amendments sorted by number', async () => {
    await repos.amendments.create(sampleAmendment({ amendmentNumber: 2 }));
    await repos.amendments.create(sampleAmendment({ amendmentNumber: 1 }));
    const all = await repos.amendments.findByContractId('C-1');
    expect(all[0]?.amendmentNumber).toBe(1);
  });
  it('findLatestByContractId returns highest number', async () => {
    await repos.amendments.create(sampleAmendment({ amendmentNumber: 1 }));
    await repos.amendments.create(sampleAmendment({ amendmentNumber: 2 }));
    const latest = await repos.amendments.findLatestByContractId('C-1');
    expect(latest?.amendmentNumber).toBe(2);
  });
});

// CTR-R-07
describe('MemoryContractMilestoneRepository', () => {
  let repos: ContractRepositories;
  beforeEach(() => { repos = createMemoryContractRepositories(); });

  it('creates a milestone', async () => {
    const m = await repos.milestones.create(sampleMilestone());
    expect(m.milestoneCode).toBe('MS-01');
  });
  it('findByContractId returns sorted by plannedDate', async () => {
    await repos.milestones.create(sampleMilestone({ milestoneCode: 'B', plannedDate: '2026-06-01' }));
    await repos.milestones.create(sampleMilestone({ milestoneCode: 'A', plannedDate: '2026-03-01' }));
    const all = await repos.milestones.findByContractId('C-1');
    expect(all[0]?.milestoneCode).toBe('A');
  });
  it('findPendingByContractId returns only PENDING', async () => {
    await repos.milestones.create(sampleMilestone({ milestoneCode: 'P', status: 'PENDING' }));
    await repos.milestones.create(sampleMilestone({ milestoneCode: 'R', status: 'REACHED' }));
    expect(await repos.milestones.findPendingByContractId('C-1')).toHaveLength(1);
  });
});

// CTR-R-08
describe('MemoryContractGuaranteeRepository', () => {
  let repos: ContractRepositories;
  beforeEach(() => { repos = createMemoryContractRepositories(); });

  it('creates a guarantee', async () => {
    const g = await repos.guarantees.create(sampleGuarantee());
    expect(g.guaranteeType).toBe('PERFORMANCE');
  });
  it('findActiveByContractId returns only ACTIVE', async () => {
    await repos.guarantees.create(sampleGuarantee({ status: 'ACTIVE' }));
    await repos.guarantees.create(sampleGuarantee({ status: 'RETURNED' }));
    expect(await repos.guarantees.findActiveByContractId('C-1')).toHaveLength(1);
  });
  it('findByType returns active guarantee of given type', async () => {
    await repos.guarantees.create(sampleGuarantee({ guaranteeType: 'PERFORMANCE' }));
    const found = await repos.guarantees.findByType('C-1', 'PERFORMANCE');
    expect(found?.guaranteeType).toBe('PERFORMANCE');
  });
});

// CTR-R-09
describe('MemoryContractHistoryRepository', () => {
  let repos: ContractRepositories;
  beforeEach(() => { repos = createMemoryContractRepositories(); });

  it('creates a history entry', async () => {
    const e = await repos.history.create({ contractId: 'C-1', action: 'CREATED', performedBy: 'U', performedAt: '2026-01-01T00:00:00Z' } as any);
    expect(e.id).toBeTruthy();
  });
  it('findByContractId returns sorted by performedAt', async () => {
    await repos.history.create({ contractId: 'C-1', action: 'SIGNED',   performedBy: 'U', performedAt: '2026-02-01T00:00:00Z' } as any);
    await repos.history.create({ contractId: 'C-1', action: 'CREATED',  performedBy: 'U', performedAt: '2026-01-01T00:00:00Z' } as any);
    const events = await repos.history.findByContractId('C-1');
    expect(events[0]?.action).toBe('CREATED');
  });
  it('findByPerformedBy filters correctly', async () => {
    await repos.history.create({ contractId: 'C-1', action: 'CREATED', performedBy: 'USR-1', performedAt: '2026-01-01T00:00:00Z' } as any);
    await repos.history.create({ contractId: 'C-2', action: 'CREATED', performedBy: 'USR-2', performedAt: '2026-01-01T00:00:00Z' } as any);
    expect(await repos.history.findByPerformedBy('USR-1')).toHaveLength(1);
  });
});

// CTR-R-10
describe('MemoryContractAttachmentRepository', () => {
  let repos: ContractRepositories;
  beforeEach(() => { repos = createMemoryContractRepositories(); });

  it('creates an attachment', async () => {
    const a = await repos.attachments.create({ contractId: 'C-1', fileName: 'f.pdf', fileType: 'pdf', fileSize: 100, uploadedBy: 'U', documentType: 'CONTRACT_DOCUMENT' } as any);
    expect(a.fileName).toBe('f.pdf');
  });
  it('findByContractId returns matching', async () => {
    await repos.attachments.create({ contractId: 'C-1', fileName: 'a.pdf', fileType: 'pdf', fileSize: 10, uploadedBy: 'U', documentType: 'CONTRACT_DOCUMENT' } as any);
    expect(await repos.attachments.findByContractId('C-1')).toHaveLength(1);
  });
  it('countByContractId returns 0 for empty', async () => {
    expect(await repos.attachments.countByContractId('NONE')).toBe(0);
  });
});

// CTR-R-11
describe('MemoryContractRepository — update + delete', () => {
  let repos: ContractRepositories;
  beforeEach(() => { repos = createMemoryContractRepositories(); });

  it('update changes status', async () => {
    const c = await repos.contracts.create(sampleContract());
    const updated = await repos.contracts.update(c.id, { status: 'SIGNED' });
    expect(updated.status).toBe('SIGNED');
  });
  it('update throws for unknown id', async () => {
    await expect(repos.contracts.update('NO', { status: 'DRAFT' })).rejects.toThrow();
  });
  it('delete removes record', async () => {
    const c = await repos.contracts.create(sampleContract());
    await repos.contracts.delete(c.id);
    expect(await repos.contracts.findById(c.id)).toBeNull();
  });
});

// CTR-R-12
describe('MemoryContractRepository — count', () => {
  let repos: ContractRepositories;
  beforeEach(() => { repos = createMemoryContractRepositories(); });

  it('count is 0 initially', async () => { expect(await repos.contracts.count()).toBe(0); });
  it('count increases after create', async () => {
    await repos.contracts.create(sampleContract());
    expect(await repos.contracts.count()).toBe(1);
  });
  it('findAll returns all records', async () => {
    await repos.contracts.create(sampleContract({ contractNumber: 'A' }));
    await repos.contracts.create(sampleContract({ contractNumber: 'B' }));
    expect(await repos.contracts.findAll()).toHaveLength(2);
  });
});

// CTR-R-13
describe('createMemoryContractRepositories factory', () => {
  it('returns 6 repositories', () => {
    const repos = createMemoryContractRepositories();
    expect(repos.contracts).toBeTruthy();
    expect(repos.amendments).toBeTruthy();
    expect(repos.milestones).toBeTruthy();
    expect(repos.guarantees).toBeTruthy();
    expect(repos.history).toBeTruthy();
    expect(repos.attachments).toBeTruthy();
  });
  it('each call returns independent instances', async () => {
    const a = createMemoryContractRepositories();
    const b = createMemoryContractRepositories();
    await a.contracts.create(sampleContract());
    expect(await b.contracts.count()).toBe(0);
  });
  it('findLatestByContractId returns null when empty', async () => {
    const repos = createMemoryContractRepositories();
    expect(await repos.amendments.findLatestByContractId('NONE')).toBeNull();
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sampleContract(o: Partial<Omit<Contract, 'id' | 'createdAt' | 'updatedAt'>> = {}): Omit<Contract, 'id' | 'createdAt' | 'updatedAt'> {
  return { contractNumber: 'HĐ/001', contractType: 'LUMP_SUM', packageId: 'PKG-1', winnerCode: 'VND-01', winnerName: 'Công ty A', contractValue: 1_000_000_000, currency: 'VND', status: 'DRAFT', ...o };
}
function sampleAmendment(o: any = {}): any {
  return { contractId: 'C-1', amendmentNumber: 1, amendmentCode: 'PLHD/001/01', reason: 'Extend timeline', changedFields: ['expiryDate'], status: 'DRAFT', ...o };
}
function sampleMilestone(o: any = {}): any {
  return { contractId: 'C-1', milestoneCode: 'MS-01', title: 'Delivery', plannedDate: '2026-06-30', plannedValue: 500_000_000, status: 'PENDING', ...o };
}
function sampleGuarantee(o: Partial<ContractGuarantee> = {}): any {
  return { contractId: 'C-1', guaranteeType: 'PERFORMANCE', amount: 100_000_000, issuerCode: 'BANK-01', issuerName: 'VietcomBank', guaranteeNumber: 'G-001', issuedDate: '2026-01-01', expiryDate: '2027-01-01', status: 'ACTIVE', ...o };
}
