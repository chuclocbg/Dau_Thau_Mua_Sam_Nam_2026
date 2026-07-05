/**
 * MemoryProcurementPackageRepository — contract tests
 *
 * Groups (13 × 3 = 39):
 *   PR-01  create() — id and timestamps generated
 *   PR-02  create() — preserves all domain fields
 *   PR-03  update() — merges fields, bumps updatedAt
 *   PR-04  update() — throws on unknown id
 *   PR-05  delete() — removes from store
 *   PR-06  findByCode() — exact match, case-sensitive
 *   PR-07  findByStatus() — filters by PackageStatus
 *   PR-08  findByDepartment() — filters by dept code
 *   PR-09  search() by term
 *   PR-10  search() by status + packageType filter
 *   PR-11  search() by value range (minValue / maxValue)
 *   PR-12  search() pagination
 *   PR-13  count() reflects store size
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryProcurementPackageRepository } from '../procurement/package/memoryPackageRepositories';
import type { ProcurementPackage } from '../procurement/package/packageTypes';

type PkgInput = Omit<ProcurementPackage, 'id' | 'createdAt' | 'updatedAt'>;

function makeRepo() { return new MemoryProcurementPackageRepository(); }

function pkgInput(overrides: Partial<PkgInput> = {}): PkgInput {
  return {
    packageCode: 'DTMS/2026/001', packageName: 'Mua sắm máy tính',
    description: '', packageType: 'GOODS', procurementMethod: 'OPEN_TENDER',
    estimatedValue: 500_000_000, fundSource: 'STATE', budgetYear: 'BY-2026',
    department: 'PHONG-TC', owner: 'NV001', status: 'DRAFT',
    schedule: {}, funding: [], participants: [], ...overrides,
  };
}

// ─── PR-01: create() ─────────────────────────────────────────────────────────

describe('PR-01 create() generates id and timestamps', () => {
  const repo = makeRepo();

  it('returns entity with non-empty id', async () => {
    const p = await repo.create(pkgInput());
    expect(p.id.length).toBeGreaterThan(0);
  });
  it('createdAt and updatedAt are ISO strings', async () => {
    const p = await repo.create(pkgInput({ packageCode: 'X' }));
    expect(p.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(p.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
  it('two creates produce different ids', async () => {
    const a = await repo.create(pkgInput({ packageCode: 'A' }));
    const b = await repo.create(pkgInput({ packageCode: 'B' }));
    expect(a.id).not.toBe(b.id);
  });
});

// ─── PR-02: create() preserves domain fields ─────────────────────────────────

describe('PR-02 create() preserves all domain fields', () => {
  const repo = makeRepo();

  it('packageCode and packageName preserved', async () => {
    const p = await repo.create(pkgInput({ packageCode: 'DTMS/26/001', packageName: 'Phòng máy' }));
    expect(p.packageCode).toBe('DTMS/26/001');
    expect(p.packageName).toBe('Phòng máy');
  });
  it('estimatedValue and fundSource preserved', async () => {
    const p = await repo.create(pkgInput({ estimatedValue: 200_000_000, fundSource: 'ODA', packageCode: 'C' }));
    expect(p.estimatedValue).toBe(200_000_000);
    expect(p.fundSource).toBe('ODA');
  });
  it('status starts as DRAFT', async () => {
    const p = await repo.create(pkgInput({ packageCode: 'D' }));
    expect(p.status).toBe('DRAFT');
  });
});

// ─── PR-03: update() ─────────────────────────────────────────────────────────

describe('PR-03 update() merges fields and bumps updatedAt', () => {
  let repo: MemoryProcurementPackageRepository;
  let created: ProcurementPackage;

  beforeEach(async () => {
    repo = makeRepo();
    created = await repo.create(pkgInput());
  });

  it('updates packageName', async () => {
    const u = await repo.update(created.id, { packageName: 'New Name' });
    expect(u.packageName).toBe('New Name');
  });
  it('id and createdAt unchanged', async () => {
    const u = await repo.update(created.id, { description: 'desc' });
    expect(u.id).toBe(created.id);
    expect(u.createdAt).toBe(created.createdAt);
  });
  it('status update persists', async () => {
    const u = await repo.update(created.id, { status: 'SUBMITTED' });
    expect(u.status).toBe('SUBMITTED');
  });
});

// ─── PR-04: update() throws on unknown id ─────────────────────────────────────

describe('PR-04 update() throws when package not found', () => {
  const repo = makeRepo();

  it('throws for unknown id', async () => {
    await expect(repo.update('ghost', { packageName: 'X' })).rejects.toThrow();
  });
  it('error mentions the id', async () => {
    await expect(repo.update('missing-id', {})).rejects.toThrow(/missing-id/);
  });
  it('store remains empty after failed update', async () => {
    try { await repo.update('x', {}); } catch {}
    expect(await repo.count()).toBe(0);
  });
});

// ─── PR-05: delete() ─────────────────────────────────────────────────────────

describe('PR-05 delete() removes package from store', () => {
  let repo: MemoryProcurementPackageRepository;
  let created: ProcurementPackage;

  beforeEach(async () => {
    repo = makeRepo();
    created = await repo.create(pkgInput());
  });

  it('findById returns null after delete', async () => {
    await repo.delete(created.id);
    expect(await repo.findById(created.id)).toBeNull();
  });
  it('count decreases', async () => {
    await repo.delete(created.id);
    expect(await repo.count()).toBe(0);
  });
  it('deleting unknown id does not throw', async () => {
    await expect(repo.delete('ghost')).resolves.toBeUndefined();
  });
});

// ─── PR-06: findByCode() ─────────────────────────────────────────────────────

describe('PR-06 findByCode() exact match, case-sensitive', () => {
  const repo = makeRepo();

  it('returns null for unknown code', async () => {
    expect(await repo.findByCode('NONE')).toBeNull();
  });
  it('returns package for known code', async () => {
    await repo.create(pkgInput({ packageCode: 'DTMS/26/099' }));
    const p = await repo.findByCode('DTMS/26/099');
    expect(p?.packageCode).toBe('DTMS/26/099');
  });
  it('code lookup is case-sensitive', async () => {
    await repo.create(pkgInput({ packageCode: 'UPPER' }));
    expect(await repo.findByCode('upper')).toBeNull();
  });
});

// ─── PR-07: findByStatus() ───────────────────────────────────────────────────

describe('PR-07 findByStatus() filters by status', () => {
  let repo: MemoryProcurementPackageRepository;

  beforeEach(async () => {
    repo = makeRepo();
    await repo.create(pkgInput({ packageCode: 'A', status: 'DRAFT'    }));
    await repo.create(pkgInput({ packageCode: 'B', status: 'DRAFT'    }));
    await repo.create(pkgInput({ packageCode: 'C', status: 'APPROVED' }));
  });

  it('DRAFT returns 2 packages', async () => {
    expect(await repo.findByStatus('DRAFT')).toHaveLength(2);
  });
  it('APPROVED returns 1 package', async () => {
    expect(await repo.findByStatus('APPROVED')).toHaveLength(1);
  });
  it('COMPLETED returns 0 packages', async () => {
    expect(await repo.findByStatus('COMPLETED')).toHaveLength(0);
  });
});

// ─── PR-08: findByDepartment() ───────────────────────────────────────────────

describe('PR-08 findByDepartment() filters by department code', () => {
  let repo: MemoryProcurementPackageRepository;

  beforeEach(async () => {
    repo = makeRepo();
    await repo.create(pkgInput({ packageCode: 'A', department: 'PHONG-TC' }));
    await repo.create(pkgInput({ packageCode: 'B', department: 'PHONG-TC' }));
    await repo.create(pkgInput({ packageCode: 'C', department: 'KHOA-KT'  }));
  });

  it('PHONG-TC returns 2 packages', async () => {
    expect(await repo.findByDepartment('PHONG-TC')).toHaveLength(2);
  });
  it('KHOA-KT returns 1 package', async () => {
    expect(await repo.findByDepartment('KHOA-KT')).toHaveLength(1);
  });
  it('unknown department returns empty', async () => {
    expect(await repo.findByDepartment('DEPT-X')).toHaveLength(0);
  });
});

// ─── PR-09: search() by term ─────────────────────────────────────────────────

describe('PR-09 search() by text term', () => {
  let repo: MemoryProcurementPackageRepository;

  beforeEach(async () => {
    repo = makeRepo();
    await repo.create(pkgInput({ packageCode: 'A', packageName: 'Mua sắm máy tính' }));
    await repo.create(pkgInput({ packageCode: 'B', packageName: 'Xây dựng phòng học' }));
    await repo.create(pkgInput({ packageCode: 'DTMS/26/099', packageName: 'Dịch vụ vệ sinh' }));
  });

  it('term "máy tính" matches 1 package', async () => {
    const r = await repo.search({ term: 'máy tính' });
    expect(r.items).toHaveLength(1);
  });
  it('term "DTMS" matches by code', async () => {
    const r = await repo.search({ term: 'DTMS' });
    expect(r.items).toHaveLength(1);
  });
  it('term with no match returns 0', async () => {
    const r = await repo.search({ term: 'NONEXISTENT' });
    expect(r.total).toBe(0);
  });
});

// ─── PR-10: search() by status + packageType ─────────────────────────────────

describe('PR-10 search() filter by status and packageType', () => {
  let repo: MemoryProcurementPackageRepository;

  beforeEach(async () => {
    repo = makeRepo();
    await repo.create(pkgInput({ packageCode: 'A', status: 'DRAFT',    packageType: 'GOODS'  }));
    await repo.create(pkgInput({ packageCode: 'B', status: 'DRAFT',    packageType: 'SERVICE' }));
    await repo.create(pkgInput({ packageCode: 'C', status: 'APPROVED', packageType: 'GOODS'  }));
  });

  it('status=DRAFT returns 2', async () => {
    const r = await repo.search({ status: 'DRAFT' });
    expect(r.total).toBe(2);
  });
  it('packageType=GOODS returns 2', async () => {
    const r = await repo.search({ packageType: 'GOODS' });
    expect(r.total).toBe(2);
  });
  it('status=DRAFT + packageType=GOODS returns 1', async () => {
    const r = await repo.search({ status: 'DRAFT', packageType: 'GOODS' });
    expect(r.total).toBe(1);
  });
});

// ─── PR-11: search() by value range ──────────────────────────────────────────

describe('PR-11 search() minValue and maxValue filters', () => {
  let repo: MemoryProcurementPackageRepository;

  beforeEach(async () => {
    repo = makeRepo();
    await repo.create(pkgInput({ packageCode: 'A', estimatedValue: 100_000_000 }));
    await repo.create(pkgInput({ packageCode: 'B', estimatedValue: 500_000_000 }));
    await repo.create(pkgInput({ packageCode: 'C', estimatedValue: 2_000_000_000 }));
  });

  it('minValue=200M returns 2 packages', async () => {
    const r = await repo.search({ minValue: 200_000_000 });
    expect(r.total).toBe(2);
  });
  it('maxValue=500M returns 2 packages', async () => {
    const r = await repo.search({ maxValue: 500_000_000 });
    expect(r.total).toBe(2);
  });
  it('minValue=500M maxValue=1B returns 1 package', async () => {
    const r = await repo.search({ minValue: 500_000_000, maxValue: 1_000_000_000 });
    expect(r.total).toBe(1);
  });
});

// ─── PR-12: search() pagination ──────────────────────────────────────────────

describe('PR-12 search() pagination', () => {
  let repo: MemoryProcurementPackageRepository;

  beforeEach(async () => {
    repo = makeRepo();
    for (let i = 1; i <= 25; i++) {
      await repo.create(pkgInput({ packageCode: `P${i.toString().padStart(3,'0')}` }));
    }
  });

  it('default page=1 pageSize=20 returns 20 items', async () => {
    const r = await repo.search({});
    expect(r.items).toHaveLength(20);
    expect(r.total).toBe(25);
  });
  it('page=2 returns remaining 5', async () => {
    const r = await repo.search({ page: 2, pageSize: 20 });
    expect(r.items).toHaveLength(5);
  });
  it('pageSize=10 returns 10 on page 1', async () => {
    const r = await repo.search({ pageSize: 10 });
    expect(r.items).toHaveLength(10);
  });
});

// ─── PR-13: count() ──────────────────────────────────────────────────────────

describe('PR-13 count() reflects store state', () => {
  it('empty repo count is 0', async () => {
    expect(await makeRepo().count()).toBe(0);
  });
  it('count grows with creates', async () => {
    const repo = makeRepo();
    await repo.create(pkgInput({ packageCode: 'A' }));
    await repo.create(pkgInput({ packageCode: 'B' }));
    expect(await repo.count()).toBe(2);
  });
  it('count shrinks with delete', async () => {
    const repo = makeRepo();
    const p = await repo.create(pkgInput());
    await repo.delete(p.id);
    expect(await repo.count()).toBe(0);
  });
});
