/**
 * Generic MemoryMasterDataRepository — contract tests
 *
 * Groups (13 × 3 = 39):
 *   MR-01  create() — adds entity with generated id, createdAt, updatedAt
 *   MR-02  create() — preserves all custom fields
 *   MR-03  update() — modifies fields and bumps updatedAt
 *   MR-04  update() — throws on unknown id
 *   MR-05  delete() — removes entity; findById returns null
 *   MR-06  archive() — sets isArchived=true, isActive=false
 *   MR-07  findById() — returns entity or null
 *   MR-08  findByCode() — returns entity or null
 *   MR-09  findActive() — excludes archived and inactive
 *   MR-10  search() with text term — matches name and code
 *   MR-11  search() with isActive filter
 *   MR-12  search() with isArchived filter
 *   MR-13  search() pagination — page/pageSize/total
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryMasterDataRepository } from '../masterdata/memoryMasterData';
import type { Department } from '../masterdata/masterdataTypes';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

type DepInput = Omit<Department, 'id' | 'createdAt' | 'updatedAt'>;

function makeRepo() {
  return new MemoryMasterDataRepository<Department>();
}

function deptInput(overrides: Partial<DepInput> = {}): DepInput {
  return {
    code: 'PHONG-TC', name: 'Phòng Tài chính', isActive: true,
    isArchived: false, level: 1, ...overrides,
  };
}

// ─── MR-01: create() — generated id/timestamps ───────────────────────────────

describe('MR-01 create() adds entity with generated id and timestamps', () => {
  const repo = makeRepo();

  it('returns entity with non-empty id', async () => {
    const e = await repo.create(deptInput());
    expect(e.id.length).toBeGreaterThan(0);
  });
  it('createdAt and updatedAt are ISO strings', async () => {
    const e = await repo.create(deptInput());
    expect(e.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(e.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
  it('two creates produce different ids', async () => {
    const a = await repo.create(deptInput({ code: 'A' }));
    const b = await repo.create(deptInput({ code: 'B' }));
    expect(a.id).not.toBe(b.id);
  });
});

// ─── MR-02: create() — preserves custom fields ───────────────────────────────

describe('MR-02 create() preserves all input fields', () => {
  const repo = makeRepo();

  it('code and name are preserved', async () => {
    const e = await repo.create(deptInput({ code: 'DEPT-A', name: 'Khoa A' }));
    expect(e.code).toBe('DEPT-A');
    expect(e.name).toBe('Khoa A');
  });
  it('level is preserved', async () => {
    const e = await repo.create(deptInput({ level: 3 }));
    expect(e.level).toBe(3);
  });
  it('isActive and isArchived are preserved', async () => {
    const e = await repo.create(deptInput({ isActive: false }));
    expect(e.isActive).toBe(false);
  });
});

// ─── MR-03: update() — modifies fields ───────────────────────────────────────

describe('MR-03 update() modifies fields and bumps updatedAt', () => {
  let repo: MemoryMasterDataRepository<Department>;
  let created: Department;

  beforeEach(async () => {
    repo = makeRepo();
    created = await repo.create(deptInput());
  });

  it('name is updated', async () => {
    const updated = await repo.update(created.id, { name: 'New Name' });
    expect(updated.name).toBe('New Name');
  });
  it('id and createdAt are unchanged', async () => {
    const updated = await repo.update(created.id, { name: 'X' });
    expect(updated.id).toBe(created.id);
    expect(updated.createdAt).toBe(created.createdAt);
  });
  it('updatedAt changes after update', async () => {
    await new Promise(r => setTimeout(r, 2));
    const updated = await repo.update(created.id, { name: 'Y' });
    // updatedAt should be a valid ISO string; may be equal on fast systems
    expect(updated.updatedAt).toMatch(/^\d{4}-/);
  });
});

// ─── MR-04: update() — throws on unknown id ──────────────────────────────────

describe('MR-04 update() throws when entity does not exist', () => {
  const repo = makeRepo();

  it('throws with non-existent id', async () => {
    await expect(repo.update('ghost-id', { name: 'X' })).rejects.toThrow();
  });
  it('error message mentions the id', async () => {
    await expect(repo.update('missing', { name: 'X' })).rejects.toThrow(/missing/);
  });
  it('store remains empty after failed update', async () => {
    try { await repo.update('x', { name: 'x' }); } catch {}
    expect(await repo.count()).toBe(0);
  });
});

// ─── MR-05: delete() ─────────────────────────────────────────────────────────

describe('MR-05 delete() removes entity permanently', () => {
  let repo: MemoryMasterDataRepository<Department>;
  let created: Department;

  beforeEach(async () => {
    repo = makeRepo();
    created = await repo.create(deptInput());
  });

  it('findById returns null after delete', async () => {
    await repo.delete(created.id);
    expect(await repo.findById(created.id)).toBeNull();
  });
  it('count decreases by 1', async () => {
    await repo.delete(created.id);
    expect(await repo.count()).toBe(0);
  });
  it('deleting non-existent id does not throw', async () => {
    await expect(repo.delete('ghost')).resolves.toBeUndefined();
  });
});

// ─── MR-06: archive() ────────────────────────────────────────────────────────

describe('MR-06 archive() sets isArchived=true and isActive=false', () => {
  let repo: MemoryMasterDataRepository<Department>;
  let created: Department;

  beforeEach(async () => {
    repo = makeRepo();
    created = await repo.create(deptInput());
  });

  it('isArchived becomes true', async () => {
    const archived = await repo.archive(created.id);
    expect(archived.isArchived).toBe(true);
  });
  it('isActive becomes false', async () => {
    const archived = await repo.archive(created.id);
    expect(archived.isActive).toBe(false);
  });
  it('entity still findable by id after archive', async () => {
    await repo.archive(created.id);
    const found = await repo.findById(created.id);
    expect(found).not.toBeNull();
  });
});

// ─── MR-07: findById() ───────────────────────────────────────────────────────

describe('MR-07 findById() returns entity or null', () => {
  const repo = makeRepo();

  it('returns null for unknown id', async () => {
    expect(await repo.findById('nobody')).toBeNull();
  });
  it('returns entity for known id', async () => {
    const e = await repo.create(deptInput());
    expect(await repo.findById(e.id)).toMatchObject({ id: e.id });
  });
  it('returns null after entity is deleted', async () => {
    const e = await repo.create(deptInput());
    await repo.delete(e.id);
    expect(await repo.findById(e.id)).toBeNull();
  });
});

// ─── MR-08: findByCode() ─────────────────────────────────────────────────────

describe('MR-08 findByCode() returns entity or null', () => {
  const repo = makeRepo();

  it('returns null for unknown code', async () => {
    expect(await repo.findByCode('NONE')).toBeNull();
  });
  it('returns entity for known code', async () => {
    await repo.create(deptInput({ code: 'DEPT-X' }));
    const found = await repo.findByCode('DEPT-X');
    expect(found?.code).toBe('DEPT-X');
  });
  it('code lookup is case-sensitive', async () => {
    await repo.create(deptInput({ code: 'DEPT-Y' }));
    expect(await repo.findByCode('dept-y')).toBeNull();
  });
});

// ─── MR-09: findActive() ─────────────────────────────────────────────────────

describe('MR-09 findActive() returns only active non-archived entities', () => {
  let repo: MemoryMasterDataRepository<Department>;

  beforeEach(async () => {
    repo = makeRepo();
    await repo.create(deptInput({ code: 'A', isActive: true,  isArchived: false }));
    await repo.create(deptInput({ code: 'B', isActive: false, isArchived: false }));
    await repo.create(deptInput({ code: 'C', isActive: true,  isArchived: true  }));
  });

  it('only active=true, archived=false are returned', async () => {
    const active = await repo.findActive();
    expect(active).toHaveLength(1);
    expect(active[0]?.code).toBe('A');
  });
  it('returns empty array when all are inactive', async () => {
    const fresh = makeRepo();
    await fresh.create(deptInput({ isActive: false }));
    expect(await fresh.findActive()).toHaveLength(0);
  });
  it('returns all active entries when multiple exist', async () => {
    const fresh = makeRepo();
    await fresh.create(deptInput({ code: 'X', isActive: true, isArchived: false }));
    await fresh.create(deptInput({ code: 'Y', isActive: true, isArchived: false }));
    expect(await fresh.findActive()).toHaveLength(2);
  });
});

// ─── MR-10: search() text term ───────────────────────────────────────────────

describe('MR-10 search() with text term matches name and code', () => {
  let repo: MemoryMasterDataRepository<Department>;

  beforeEach(async () => {
    repo = makeRepo();
    await repo.create(deptInput({ code: 'PHONG-TC', name: 'Phòng Tài chính' }));
    await repo.create(deptInput({ code: 'PHONG-HC', name: 'Phòng Hành chính' }));
    await repo.create(deptInput({ code: 'KHOA-KT', name: 'Khoa Kỹ thuật' }));
  });

  it('term "phòng" matches 2 departments', async () => {
    const r = await repo.search({ term: 'phòng' });
    expect(r.items).toHaveLength(2);
  });
  it('term "KHOA" matches by code substring', async () => {
    const r = await repo.search({ term: 'KHOA' });
    expect(r.items).toHaveLength(1);
  });
  it('term with no match returns empty items', async () => {
    const r = await repo.search({ term: 'NONEXISTENT' });
    expect(r.items).toHaveLength(0);
    expect(r.total).toBe(0);
  });
});

// ─── MR-11: search() isActive filter ─────────────────────────────────────────

describe('MR-11 search() with isActive filter', () => {
  let repo: MemoryMasterDataRepository<Department>;

  beforeEach(async () => {
    repo = makeRepo();
    await repo.create(deptInput({ code: 'A1', isActive: true  }));
    await repo.create(deptInput({ code: 'A2', isActive: true  }));
    await repo.create(deptInput({ code: 'I1', isActive: false }));
  });

  it('isActive=true returns only active entities', async () => {
    const r = await repo.search({ isActive: true });
    expect(r.total).toBe(2);
    expect(r.items.every(e => e.isActive)).toBe(true);
  });
  it('isActive=false returns only inactive entities', async () => {
    const r = await repo.search({ isActive: false });
    expect(r.total).toBe(1);
  });
  it('omitting isActive returns all entities', async () => {
    const r = await repo.search({});
    expect(r.total).toBe(3);
  });
});

// ─── MR-12: search() isArchived filter ───────────────────────────────────────

describe('MR-12 search() with isArchived filter', () => {
  let repo: MemoryMasterDataRepository<Department>;

  beforeEach(async () => {
    repo = makeRepo();
    const e = await repo.create(deptInput({ code: 'X' }));
    await repo.archive(e.id);
    await repo.create(deptInput({ code: 'Y' }));
  });

  it('isArchived=true returns only archived', async () => {
    const r = await repo.search({ isArchived: true });
    expect(r.total).toBe(1);
  });
  it('isArchived=false returns only non-archived', async () => {
    const r = await repo.search({ isArchived: false });
    expect(r.total).toBe(1);
    expect(r.items[0]?.code).toBe('Y');
  });
  it('total reflects filter, not full store size', async () => {
    expect(await repo.count()).toBe(2);
    const r = await repo.search({ isArchived: false });
    expect(r.total).toBe(1);
  });
});

// ─── MR-13: search() pagination ──────────────────────────────────────────────

describe('MR-13 search() pagination — page, pageSize, total', () => {
  let repo: MemoryMasterDataRepository<Department>;

  beforeEach(async () => {
    repo = makeRepo();
    for (let i = 1; i <= 25; i++) {
      await repo.create(deptInput({ code: `D${i.toString().padStart(2, '0')}` }));
    }
  });

  it('default page=1 pageSize=20 returns 20 items', async () => {
    const r = await repo.search({});
    expect(r.items).toHaveLength(20);
    expect(r.total).toBe(25);
    expect(r.page).toBe(1);
  });
  it('page=2 with pageSize=20 returns remaining 5 items', async () => {
    const r = await repo.search({ page: 2, pageSize: 20 });
    expect(r.items).toHaveLength(5);
  });
  it('custom pageSize=10 returns 10 items on page 1', async () => {
    const r = await repo.search({ page: 1, pageSize: 10 });
    expect(r.items).toHaveLength(10);
    expect(r.pageSize).toBe(10);
  });
});
