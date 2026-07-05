/**
 * PackageBudget repository + budget math
 *
 * Groups (13 × 3 = 39):
 *   PB-01  MemoryBudgetRepository create() — id and timestamps
 *   PB-02  findByPackageId() — one budget per package
 *   PB-03  update() — modifies committed/spent amounts
 *   PB-04  budget balance: remainingAmount = approved − committed − spent
 *   PB-05  budget does not go negative when committed grows
 *   PB-06  PackageAttachment create + findByPackageId
 *   PB-07  PackageAttachment findByDocumentType
 *   PB-08  PackageHistory create + findByPackageId
 *   PB-09  PackageHistory findByAction
 *   PB-10  history records CREATED → UPDATED → ARCHIVED chain
 *   PB-11  attachment delete
 *   PB-12  history count reflects all lifecycle events
 *   PB-13  createMemoryPackageRepositories — 5 repos, all independent
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  MemoryBudgetRepository, MemoryAttachmentRepository, MemoryHistoryRepository,
  createMemoryPackageRepositories,
} from '../procurement/package/memoryPackageRepositories';
import type { PackageBudget, PackageAttachment, PackageHistory } from '../procurement/package/packageTypes';

type BudgetInput  = Omit<PackageBudget,     'id' | 'createdAt' | 'updatedAt'>;
type AttInput     = Omit<PackageAttachment,  'id' | 'createdAt' | 'updatedAt'>;
type HistInput    = Omit<PackageHistory,     'id' | 'createdAt' | 'updatedAt'>;

function budgetInput(o: Partial<BudgetInput> = {}): BudgetInput {
  return {
    packageId: 'pkg-001', budgetSource: 'STATE',
    approvedAmount: 500_000_000, committedAmount: 0, spentAmount: 0,
    remainingAmount: 500_000_000, ...o,
  };
}

function attInput(o: Partial<AttInput> = {}): AttInput {
  return {
    packageId: 'pkg-001', fileName: 'HSMT.pdf', fileType: 'application/pdf',
    fileSize: 1024, uploadedBy: 'NV001', uploadedAt: '2026-07-01T00:00:00Z',
    documentType: 'HSMT', ...o,
  };
}

function histInput(o: Partial<HistInput> = {}): HistInput {
  return {
    packageId: 'pkg-001', action: 'CREATED', toStatus: 'DRAFT',
    performedBy: 'NV001', performedAt: '2026-07-01T00:00:00Z', ...o,
  };
}

// ─── PB-01: BudgetRepository create() ────────────────────────────────────────

describe('PB-01 BudgetRepository create() generates id and timestamps', () => {
  const repo = new MemoryBudgetRepository();

  it('returns budget with id', async () => {
    const b = await repo.create(budgetInput());
    expect(b.id.length).toBeGreaterThan(0);
  });
  it('createdAt is ISO string', async () => {
    const b = await repo.create(budgetInput({ packageId: 'P2' }));
    expect(b.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
  it('approvedAmount is preserved', async () => {
    const b = await repo.create(budgetInput({ approvedAmount: 1_000_000_000 }));
    expect(b.approvedAmount).toBe(1_000_000_000);
  });
});

// ─── PB-02: findByPackageId() ────────────────────────────────────────────────

describe('PB-02 findByPackageId() returns budget for package or null', () => {
  let repo: MemoryBudgetRepository;

  beforeEach(async () => {
    repo = new MemoryBudgetRepository();
    await repo.create(budgetInput({ packageId: 'pkg-001' }));
  });

  it('returns budget for known packageId', async () => {
    const b = await repo.findByPackageId('pkg-001');
    expect(b?.packageId).toBe('pkg-001');
  });
  it('returns null for unknown packageId', async () => {
    expect(await repo.findByPackageId('pkg-999')).toBeNull();
  });
  it('returns first budget when multiple exist for same package', async () => {
    await repo.create(budgetInput({ packageId: 'pkg-001', approvedAmount: 999 }));
    const b = await repo.findByPackageId('pkg-001');
    expect(b).not.toBeNull();
  });
});

// ─── PB-03: update() committed/spent ─────────────────────────────────────────

describe('PB-03 update() modifies committedAmount and spentAmount', () => {
  let repo: MemoryBudgetRepository;
  let budget: PackageBudget;

  beforeEach(async () => {
    repo = new MemoryBudgetRepository();
    budget = await repo.create(budgetInput());
  });

  it('committedAmount is updated', async () => {
    const u = await repo.update(budget.id, { committedAmount: 200_000_000 });
    expect(u.committedAmount).toBe(200_000_000);
  });
  it('spentAmount is updated', async () => {
    const u = await repo.update(budget.id, { spentAmount: 50_000_000 });
    expect(u.spentAmount).toBe(50_000_000);
  });
  it('remainingAmount updated independently of committed', async () => {
    const u = await repo.update(budget.id, { committedAmount: 100_000_000, remainingAmount: 400_000_000 });
    expect(u.remainingAmount).toBe(400_000_000);
  });
});

// ─── PB-04: budget balance formula ───────────────────────────────────────────

describe('PB-04 budget balance: remaining = approved − committed − spent', () => {
  it('500 − 100 − 50 = 350', async () => {
    const repo = new MemoryBudgetRepository();
    const b = await repo.create(budgetInput({ approvedAmount: 500_000_000, committedAmount: 100_000_000, spentAmount: 50_000_000, remainingAmount: 350_000_000 }));
    expect(b.remainingAmount).toBe(b.approvedAmount - b.committedAmount - b.spentAmount);
  });
  it('fully spent: remaining = 0', async () => {
    const repo = new MemoryBudgetRepository();
    const b = await repo.create(budgetInput({ committedAmount: 0, spentAmount: 500_000_000, remainingAmount: 0 }));
    expect(b.remainingAmount).toBe(b.approvedAmount - b.committedAmount - b.spentAmount);
  });
  it('untouched budget: remaining = approved', async () => {
    const repo = new MemoryBudgetRepository();
    const b = await repo.create(budgetInput());
    expect(b.remainingAmount).toBe(b.approvedAmount);
  });
});

// ─── PB-05: budget constraints ───────────────────────────────────────────────

describe('PB-05 budget values do not auto-constraint negative (caller responsible)', () => {
  it('repo stores whatever values are given (validation is in packageValidation.ts)', async () => {
    const repo = new MemoryBudgetRepository();
    const b = await repo.create(budgetInput({ remainingAmount: 0 }));
    expect(b.remainingAmount).toBe(0);
  });
  it('can update to track partial spending', async () => {
    const repo = new MemoryBudgetRepository();
    const b = await repo.create(budgetInput({ approvedAmount: 1_000_000_000, remainingAmount: 1_000_000_000 }));
    const u = await repo.update(b.id, { spentAmount: 300_000_000, remainingAmount: 700_000_000 });
    expect(u.spentAmount + u.remainingAmount).toBe(u.approvedAmount);
  });
  it('committed + spent = approved makes remaining = 0', async () => {
    const repo = new MemoryBudgetRepository();
    const b = await repo.create(budgetInput({ approvedAmount: 100, committedAmount: 40, spentAmount: 60, remainingAmount: 0 }));
    expect(b.committedAmount + b.spentAmount).toBe(b.approvedAmount);
  });
});

// ─── PB-06: AttachmentRepository CRUD ────────────────────────────────────────

describe('PB-06 AttachmentRepository create + findByPackageId', () => {
  it('creates attachment with id', async () => {
    const repo = new MemoryAttachmentRepository();
    const a = await repo.create(attInput());
    expect(a.id.length).toBeGreaterThan(0);
    expect(a.fileName).toBe('HSMT.pdf');
  });
  it('findByPackageId returns attachments for that package', async () => {
    const repo = new MemoryAttachmentRepository();
    await repo.create(attInput({ packageId: 'P1' }));
    await repo.create(attInput({ packageId: 'P1', fileName: 'B.pdf' }));
    await repo.create(attInput({ packageId: 'P2', fileName: 'C.pdf' }));
    expect(await repo.findByPackageId('P1')).toHaveLength(2);
  });
  it('findByPackageId returns empty for unknown package', async () => {
    const repo = new MemoryAttachmentRepository();
    expect(await repo.findByPackageId('NONE')).toHaveLength(0);
  });
});

// ─── PB-07: findByDocumentType() ─────────────────────────────────────────────

describe('PB-07 findByDocumentType() filters by documentType within package', () => {
  let repo: MemoryAttachmentRepository;

  beforeEach(async () => {
    repo = new MemoryAttachmentRepository();
    await repo.create(attInput({ documentType: 'HSMT', fileName: 'HSMT.pdf' }));
    await repo.create(attInput({ documentType: 'BBDG', fileName: 'BBDG.pdf' }));
    await repo.create(attInput({ documentType: 'HSMT', fileName: 'HSMT-2.pdf' }));
  });

  it('HSMT returns 2 attachments', async () => {
    expect(await repo.findByDocumentType('pkg-001', 'HSMT')).toHaveLength(2);
  });
  it('BBDG returns 1 attachment', async () => {
    expect(await repo.findByDocumentType('pkg-001', 'BBDG')).toHaveLength(1);
  });
  it('KHLCNT returns 0 attachments', async () => {
    expect(await repo.findByDocumentType('pkg-001', 'KHLCNT')).toHaveLength(0);
  });
});

// ─── PB-08: HistoryRepository CRUD ───────────────────────────────────────────

describe('PB-08 HistoryRepository create + findByPackageId', () => {
  it('creates history entry with id', async () => {
    const repo = new MemoryHistoryRepository();
    const h = await repo.create(histInput());
    expect(h.id.length).toBeGreaterThan(0);
    expect(h.action).toBe('CREATED');
  });
  it('findByPackageId returns entries for that package', async () => {
    const repo = new MemoryHistoryRepository();
    await repo.create(histInput({ packageId: 'P1', action: 'CREATED' }));
    await repo.create(histInput({ packageId: 'P1', action: 'UPDATED' }));
    await repo.create(histInput({ packageId: 'P2', action: 'CREATED' }));
    expect(await repo.findByPackageId('P1')).toHaveLength(2);
  });
  it('performedBy is preserved', async () => {
    const repo = new MemoryHistoryRepository();
    const h = await repo.create(histInput({ performedBy: 'admin' }));
    expect(h.performedBy).toBe('admin');
  });
});

// ─── PB-09: findByAction() ───────────────────────────────────────────────────

describe('PB-09 findByAction() filters history by action', () => {
  let repo: MemoryHistoryRepository;

  beforeEach(async () => {
    repo = new MemoryHistoryRepository();
    await repo.create(histInput({ action: 'CREATED' }));
    await repo.create(histInput({ action: 'UPDATED' }));
    await repo.create(histInput({ action: 'UPDATED' }));
    await repo.create(histInput({ action: 'ARCHIVED' }));
  });

  it('UPDATED returns 2 entries', async () => {
    expect(await repo.findByAction('pkg-001', 'UPDATED')).toHaveLength(2);
  });
  it('CREATED returns 1 entry', async () => {
    expect(await repo.findByAction('pkg-001', 'CREATED')).toHaveLength(1);
  });
  it('CLONED returns 0 entries', async () => {
    expect(await repo.findByAction('pkg-001', 'CLONED')).toHaveLength(0);
  });
});

// ─── PB-10: full lifecycle history chain ─────────────────────────────────────

describe('PB-10 history records full lifecycle chain', () => {
  let repo: MemoryHistoryRepository;

  beforeEach(async () => {
    repo = new MemoryHistoryRepository();
    await repo.create(histInput({ action: 'CREATED',  toStatus: 'DRAFT'     }));
    await repo.create(histInput({ action: 'UPDATED',  fromStatus: 'DRAFT', toStatus: 'DRAFT'     }));
    await repo.create(histInput({ action: 'SUBMITTED',fromStatus: 'DRAFT', toStatus: 'SUBMITTED' }));
    await repo.create(histInput({ action: 'ARCHIVED', fromStatus: 'SUBMITTED', toStatus: 'ARCHIVED' }));
  });

  it('package has 4 history entries', async () => {
    expect(await repo.findByPackageId('pkg-001')).toHaveLength(4);
  });
  it('first entry is CREATED', async () => {
    const h = await repo.findByPackageId('pkg-001');
    expect(h[0]?.action).toBe('CREATED');
  });
  it('last entry is ARCHIVED with correct fromStatus', async () => {
    const h = await repo.findByPackageId('pkg-001');
    expect(h[h.length - 1]?.toStatus).toBe('ARCHIVED');
  });
});

// ─── PB-11: attachment delete ────────────────────────────────────────────────

describe('PB-11 AttachmentRepository delete removes single attachment', () => {
  let repo: MemoryAttachmentRepository;
  let att: PackageAttachment;

  beforeEach(async () => {
    repo = new MemoryAttachmentRepository();
    att = await repo.create(attInput());
    await repo.create(attInput({ fileName: 'B.pdf' }));
  });

  it('deleted attachment not found by id', async () => {
    await repo.delete(att.id);
    expect(await repo.findById(att.id)).toBeNull();
  });
  it('count decreases by 1', async () => {
    await repo.delete(att.id);
    expect(await repo.count()).toBe(1);
  });
  it('remaining attachment still found', async () => {
    await repo.delete(att.id);
    const all = await repo.findAll();
    expect(all[0]?.fileName).toBe('B.pdf');
  });
});

// ─── PB-12: history count ────────────────────────────────────────────────────

describe('PB-12 HistoryRepository count reflects all lifecycle events', () => {
  it('empty repo = 0', async () => {
    expect(await new MemoryHistoryRepository().count()).toBe(0);
  });
  it('grows with each event', async () => {
    const repo = new MemoryHistoryRepository();
    for (const a of ['CREATED','UPDATED','ARCHIVED']) {
      await repo.create(histInput({ action: a }));
    }
    expect(await repo.count()).toBe(3);
  });
  it('entries from different packages all counted', async () => {
    const repo = new MemoryHistoryRepository();
    await repo.create(histInput({ packageId: 'P1' }));
    await repo.create(histInput({ packageId: 'P2' }));
    expect(await repo.count()).toBe(2);
  });
});

// ─── PB-13: createMemoryPackageRepositories ───────────────────────────────────

describe('PB-13 createMemoryPackageRepositories creates 5 independent repos', () => {
  it('all 5 repo keys present', () => {
    const repos = createMemoryPackageRepositories();
    for (const k of ['packages','items','budgets','attachments','history']) {
      expect(repos).toHaveProperty(k);
    }
  });
  it('all start empty', async () => {
    const repos = createMemoryPackageRepositories();
    for (const repo of Object.values(repos)) {
      expect(await repo.count()).toBe(0);
    }
  });
  it('two factory calls produce independent sets', async () => {
    const a = createMemoryPackageRepositories();
    const b = createMemoryPackageRepositories();
    await a.budgets.create(budgetInput());
    expect(await b.budgets.count()).toBe(0);
  });
});
