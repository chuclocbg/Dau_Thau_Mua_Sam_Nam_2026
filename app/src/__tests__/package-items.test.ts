/**
 * PackageItem repository + calculateTotals
 *
 * Groups (13 × 3 = 39):
 *   PI-01  create() — id/timestamps, estimatedTotal preserved
 *   PI-02  findByPackageId() — scoped to packageId
 *   PI-03  deleteByPackageId() — removes all items for a package
 *   PI-04  sumByPackageId() — sums estimatedTotal
 *   PI-05  calculateTotals() service — delegates to sumByPackageId
 *   PI-06  update() — changes fields
 *   PI-07  delete() single item
 *   PI-08  multiple packages — items are isolated
 *   PI-09  item with quantity × unitPrice integrity
 *   PI-10  findAll() — returns all items across all packages
 *   PI-11  count() — reflects creates and deletes
 *   PI-12  findByPackageId() returns empty for unknown packageId
 *   PI-13  sumByPackageId() returns 0 for empty package
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryPackageItemRepository } from '../procurement/package/memoryPackageRepositories';
import { calculateTotals } from '../procurement/package/packageService';
import { createMemoryPackageRepositories } from '../procurement/package/memoryPackageRepositories';
import type { PackageItem } from '../procurement/package/packageTypes';

type ItemInput = Omit<PackageItem, 'id' | 'createdAt' | 'updatedAt'>;

function makeRepo() { return new MemoryPackageItemRepository(); }

function itemInput(o: Partial<ItemInput> = {}): ItemInput {
  return {
    packageId: 'pkg-001', itemCode: 'IT-001', name: 'Máy tính',
    unit: 'chiếc', quantity: 5, estimatedUnitPrice: 20_000_000,
    estimatedTotal: 100_000_000, category: 'CNTT',
    technicalSpecification: 'Core i7', ...o,
  };
}

// ─── PI-01: create() ─────────────────────────────────────────────────────────

describe('PI-01 create() adds item with generated id and timestamps', () => {
  const repo = makeRepo();

  it('returns item with id', async () => {
    const i = await repo.create(itemInput());
    expect(i.id.length).toBeGreaterThan(0);
  });
  it('createdAt is ISO string', async () => {
    const i = await repo.create(itemInput({ itemCode: 'X' }));
    expect(i.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
  it('estimatedTotal preserved', async () => {
    const i = await repo.create(itemInput({ quantity: 10, estimatedUnitPrice: 5_000_000, estimatedTotal: 50_000_000 }));
    expect(i.estimatedTotal).toBe(50_000_000);
  });
});

// ─── PI-02: findByPackageId() ────────────────────────────────────────────────

describe('PI-02 findByPackageId() returns only items for that package', () => {
  let repo: MemoryPackageItemRepository;

  beforeEach(async () => {
    repo = makeRepo();
    await repo.create(itemInput({ packageId: 'pkg-001', itemCode: 'A' }));
    await repo.create(itemInput({ packageId: 'pkg-001', itemCode: 'B' }));
    await repo.create(itemInput({ packageId: 'pkg-002', itemCode: 'C' }));
  });

  it('pkg-001 returns 2 items', async () => {
    expect(await repo.findByPackageId('pkg-001')).toHaveLength(2);
  });
  it('pkg-002 returns 1 item', async () => {
    expect(await repo.findByPackageId('pkg-002')).toHaveLength(1);
  });
  it('unknown packageId returns empty', async () => {
    expect(await repo.findByPackageId('pkg-999')).toHaveLength(0);
  });
});

// ─── PI-03: deleteByPackageId() ──────────────────────────────────────────────

describe('PI-03 deleteByPackageId() removes all items for that package', () => {
  let repo: MemoryPackageItemRepository;

  beforeEach(async () => {
    repo = makeRepo();
    await repo.create(itemInput({ packageId: 'pkg-001', itemCode: 'A' }));
    await repo.create(itemInput({ packageId: 'pkg-001', itemCode: 'B' }));
    await repo.create(itemInput({ packageId: 'pkg-002', itemCode: 'C' }));
  });

  it('pkg-001 items are removed', async () => {
    await repo.deleteByPackageId('pkg-001');
    expect(await repo.findByPackageId('pkg-001')).toHaveLength(0);
  });
  it('pkg-002 items remain', async () => {
    await repo.deleteByPackageId('pkg-001');
    expect(await repo.findByPackageId('pkg-002')).toHaveLength(1);
  });
  it('deleting unknown packageId does not throw', async () => {
    await expect(repo.deleteByPackageId('pkg-999')).resolves.toBeUndefined();
  });
});

// ─── PI-04: sumByPackageId() ─────────────────────────────────────────────────

describe('PI-04 sumByPackageId() sums estimatedTotal', () => {
  let repo: MemoryPackageItemRepository;

  beforeEach(async () => {
    repo = makeRepo();
    await repo.create(itemInput({ packageId: 'pkg-001', itemCode: 'A', estimatedTotal: 100_000_000 }));
    await repo.create(itemInput({ packageId: 'pkg-001', itemCode: 'B', estimatedTotal: 200_000_000 }));
    await repo.create(itemInput({ packageId: 'pkg-002', itemCode: 'C', estimatedTotal: 50_000_000 }));
  });

  it('pkg-001 sum = 300M', async () => {
    expect(await repo.sumByPackageId('pkg-001')).toBe(300_000_000);
  });
  it('pkg-002 sum = 50M', async () => {
    expect(await repo.sumByPackageId('pkg-002')).toBe(50_000_000);
  });
  it('unknown packageId sum = 0', async () => {
    expect(await repo.sumByPackageId('pkg-999')).toBe(0);
  });
});

// ─── PI-05: calculateTotals() service ────────────────────────────────────────

describe('PI-05 calculateTotals() service delegates to item repo', () => {
  it('returns sum of items for package', async () => {
    const repos = createMemoryPackageRepositories();
    await repos.items.create(itemInput({ packageId: 'P1', itemCode: 'A', estimatedTotal: 300_000_000 }));
    await repos.items.create(itemInput({ packageId: 'P1', itemCode: 'B', estimatedTotal: 150_000_000 }));
    expect(await calculateTotals('P1', repos)).toBe(450_000_000);
  });
  it('returns 0 for package with no items', async () => {
    const repos = createMemoryPackageRepositories();
    expect(await calculateTotals('EMPTY', repos)).toBe(0);
  });
  it('totals are per-package, not global', async () => {
    const repos = createMemoryPackageRepositories();
    await repos.items.create(itemInput({ packageId: 'PA', itemCode: 'A', estimatedTotal: 100_000_000 }));
    await repos.items.create(itemInput({ packageId: 'PB', itemCode: 'B', estimatedTotal: 999_000_000 }));
    expect(await calculateTotals('PA', repos)).toBe(100_000_000);
  });
});

// ─── PI-06: update() ─────────────────────────────────────────────────────────

describe('PI-06 update() modifies item fields', () => {
  let repo: MemoryPackageItemRepository;
  let item: PackageItem;

  beforeEach(async () => {
    repo = makeRepo();
    item = await repo.create(itemInput());
  });

  it('name is updated', async () => {
    const u = await repo.update(item.id, { name: 'Máy in' });
    expect(u.name).toBe('Máy in');
  });
  it('quantity update does not auto-recalculate estimatedTotal', async () => {
    const u = await repo.update(item.id, { quantity: 20 });
    expect(u.quantity).toBe(20);
    expect(u.estimatedTotal).toBe(100_000_000);  // unchanged; caller must set it
  });
  it('estimatedTotal can be updated separately', async () => {
    const u = await repo.update(item.id, { estimatedTotal: 400_000_000 });
    expect(u.estimatedTotal).toBe(400_000_000);
  });
});

// ─── PI-07: delete() single item ─────────────────────────────────────────────

describe('PI-07 delete() removes single item by id', () => {
  let repo: MemoryPackageItemRepository;
  let a: PackageItem;
  let b: PackageItem;

  beforeEach(async () => {
    repo = makeRepo();
    a = await repo.create(itemInput({ itemCode: 'A' }));
    b = await repo.create(itemInput({ itemCode: 'B' }));
  });

  it('deleted item returns null from findById', async () => {
    await repo.delete(a.id);
    expect(await repo.findById(a.id)).toBeNull();
  });
  it('other item still exists', async () => {
    await repo.delete(a.id);
    expect(await repo.findById(b.id)).not.toBeNull();
  });
  it('count decreases by 1', async () => {
    await repo.delete(a.id);
    expect(await repo.count()).toBe(1);
  });
});

// ─── PI-08: multiple packages isolation ──────────────────────────────────────

describe('PI-08 items from different packages are isolated', () => {
  let repo: MemoryPackageItemRepository;

  beforeEach(async () => {
    repo = makeRepo();
    for (let p = 1; p <= 3; p++) {
      for (let i = 1; i <= 3; i++) {
        await repo.create(itemInput({ packageId: `pkg-${p}`, itemCode: `IT-${p}-${i}` }));
      }
    }
  });

  it('each package has exactly 3 items', async () => {
    for (let p = 1; p <= 3; p++) {
      expect(await repo.findByPackageId(`pkg-${p}`)).toHaveLength(3);
    }
  });
  it('total count is 9', async () => {
    expect(await repo.count()).toBe(9);
  });
  it('deleteByPackageId for one does not affect others', async () => {
    await repo.deleteByPackageId('pkg-1');
    expect(await repo.findByPackageId('pkg-2')).toHaveLength(3);
  });
});

// ─── PI-09: estimatedTotal integrity ─────────────────────────────────────────

describe('PI-09 estimatedTotal = quantity × estimatedUnitPrice', () => {
  it('5 × 20M = 100M', async () => {
    const repo = makeRepo();
    const i = await repo.create(itemInput({ quantity: 5, estimatedUnitPrice: 20_000_000, estimatedTotal: 100_000_000 }));
    expect(i.estimatedTotal).toBe(i.quantity * i.estimatedUnitPrice);
  });
  it('1 × 500M = 500M', async () => {
    const repo = makeRepo();
    const i = await repo.create(itemInput({ quantity: 1, estimatedUnitPrice: 500_000_000, estimatedTotal: 500_000_000 }));
    expect(i.estimatedTotal).toBe(500_000_000);
  });
  it('3 × 333333 = 999999', async () => {
    const repo = makeRepo();
    const i = await repo.create(itemInput({ quantity: 3, estimatedUnitPrice: 333_333, estimatedTotal: 999_999 }));
    expect(i.estimatedTotal).toBe(999_999);
  });
});

// ─── PI-10: findAll() across all packages ────────────────────────────────────

describe('PI-10 findAll() returns all items regardless of packageId', () => {
  it('returns empty array for empty repo', async () => {
    expect(await makeRepo().findAll()).toHaveLength(0);
  });
  it('returns all items when multiple packages', async () => {
    const repo = makeRepo();
    await repo.create(itemInput({ packageId: 'P1', itemCode: 'A' }));
    await repo.create(itemInput({ packageId: 'P2', itemCode: 'B' }));
    expect(await repo.findAll()).toHaveLength(2);
  });
  it('findAll includes items after update', async () => {
    const repo = makeRepo();
    const i = await repo.create(itemInput());
    await repo.update(i.id, { name: 'Updated' });
    const all = await repo.findAll();
    expect(all[0]?.name).toBe('Updated');
  });
});

// ─── PI-11: count() ──────────────────────────────────────────────────────────

describe('PI-11 count() reflects creates and deletes', () => {
  it('empty repo = 0', async () => {
    expect(await makeRepo().count()).toBe(0);
  });
  it('3 creates = count 3', async () => {
    const repo = makeRepo();
    for (const c of ['A','B','C']) await repo.create(itemInput({ itemCode: c }));
    expect(await repo.count()).toBe(3);
  });
  it('count after deleteByPackageId reflects removal', async () => {
    const repo = makeRepo();
    await repo.create(itemInput({ packageId: 'P', itemCode: 'A' }));
    await repo.create(itemInput({ packageId: 'P', itemCode: 'B' }));
    await repo.deleteByPackageId('P');
    expect(await repo.count()).toBe(0);
  });
});

// ─── PI-12: findByPackageId() unknown ────────────────────────────────────────

describe('PI-12 findByPackageId() returns empty for unknown packageId', () => {
  it('no items for unknown package', async () => {
    const repo = makeRepo();
    expect(await repo.findByPackageId('UNKNOWN')).toHaveLength(0);
  });
  it('empty repo always returns empty', async () => {
    expect(await makeRepo().findByPackageId('ANY')).toHaveLength(0);
  });
  it('after deleting all items of a package, findByPackageId returns empty', async () => {
    const repo = makeRepo();
    await repo.create(itemInput({ packageId: 'P', itemCode: 'X' }));
    await repo.deleteByPackageId('P');
    expect(await repo.findByPackageId('P')).toHaveLength(0);
  });
});

// ─── PI-13: sumByPackageId() returns 0 ──────────────────────────────────────

describe('PI-13 sumByPackageId() returns 0 for empty or unknown package', () => {
  it('returns 0 for unknown packageId', async () => {
    expect(await makeRepo().sumByPackageId('NONE')).toBe(0);
  });
  it('returns 0 after deleteByPackageId', async () => {
    const repo = makeRepo();
    await repo.create(itemInput({ packageId: 'P', estimatedTotal: 50_000_000 }));
    await repo.deleteByPackageId('P');
    expect(await repo.sumByPackageId('P')).toBe(0);
  });
  it('sum is additive as items are added', async () => {
    const repo = makeRepo();
    await repo.create(itemInput({ packageId: 'P', itemCode: 'A', estimatedTotal: 10 }));
    expect(await repo.sumByPackageId('P')).toBe(10);
    await repo.create(itemInput({ packageId: 'P', itemCode: 'B', estimatedTotal: 20 }));
    expect(await repo.sumByPackageId('P')).toBe(30);
  });
});
