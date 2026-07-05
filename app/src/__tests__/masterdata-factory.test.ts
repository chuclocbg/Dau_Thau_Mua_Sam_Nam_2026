/**
 * Factory functions + seedDefaultData
 *
 * Groups (13 × 3 = 39):
 *   MF-01  createMemoryMasterDataRepositories creates 10 independent repos
 *   MF-02  repos are independent — data in one does not leak to another
 *   MF-03  createPrismaMasterDataRepositories creates 10 real (Phase M1) repos
 *   MF-04  Prisma repos throw without DATABASE_URL on create()
 *   MF-05  Prisma repos throw without DATABASE_URL on update(), delete(), archive()
 *   MF-06  Prisma repos throw without DATABASE_URL on findById(), findByCode()
 *   MF-07  Prisma repos throw without DATABASE_URL on findActive(), search(), count()
 *   MF-08  seedDefaultData creates 3 ApprovalAuthority entries
 *   MF-09  seedDefaultData authority levels and maxValues are correct
 *   MF-10  seedDefaultData creates 5 PackageType entries
 *   MF-11  seedDefaultData creates 7 ProcurementMethod entries
 *   MF-12  seedDefaultData creates 4 FundSource entries
 *   MF-13  seedDefaultData creates 5 DocumentTemplate entries with correct codes
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createMemoryMasterDataRepositories,
  createPrismaMasterDataRepositories,
  seedDefaultData,
} from '../masterdata/masterdataFactory';
import type { MasterDataRepositories } from '../masterdata/masterdataRepository';

// ─── MF-01: createMemoryMasterDataRepositories ────────────────────────────────

describe('MF-01 createMemoryMasterDataRepositories creates 10 repositories', () => {
  const repos = createMemoryMasterDataRepositories();

  it('all 10 repository keys are present', () => {
    const keys = ['departments','employees','approvalAuthorities','fundSources','budgetYears',
      'vendors','procurementCategories','packageTypes','procurementMethods','documentTemplates'];
    for (const k of keys) {
      expect(repos).toHaveProperty(k);
    }
  });
  it('each repo starts empty (count = 0)', async () => {
    const fresh = createMemoryMasterDataRepositories();
    for (const repo of Object.values(fresh)) {
      expect(await repo.count()).toBe(0);
    }
  });
  it('repos are distinct objects', () => {
    expect(repos.departments).not.toBe(repos.employees);
    expect(repos.approvalAuthorities).not.toBe(repos.vendors);
  });
});

// ─── MF-02: repo independence ─────────────────────────────────────────────────

describe('MF-02 repositories are independent — writes do not cross-contaminate', () => {
  it('writing to departments does not affect employees', async () => {
    const repos = createMemoryMasterDataRepositories();
    await repos.departments.create({ code: 'D1', name: 'Dept', isActive: true, isArchived: false, level: 1 });
    expect(await repos.employees.count()).toBe(0);
  });
  it('writing to vendors does not affect packageTypes', async () => {
    const repos = createMemoryMasterDataRepositories();
    await repos.vendors.create({ code: 'V1', name: 'V', isActive: true, isArchived: false, taxCode: '1', address: 'HN', isBlacklisted: false });
    expect(await repos.packageTypes.count()).toBe(0);
  });
  it('two factory calls produce independent repo sets', async () => {
    const a = createMemoryMasterDataRepositories();
    const b = createMemoryMasterDataRepositories();
    await a.departments.create({ code: 'ONLY-A', name: 'A', isActive: true, isArchived: false, level: 1 });
    expect(await b.departments.count()).toBe(0);
  });
});

// ─── MF-03: createPrismaMasterDataRepositories ───────────────────────────────

describe('MF-03 createPrismaMasterDataRepositories creates 10 stub repos', () => {
  const repos = createPrismaMasterDataRepositories();

  it('all 10 repository keys are present', () => {
    const keys = ['departments','employees','approvalAuthorities','fundSources','budgetYears',
      'vendors','procurementCategories','packageTypes','procurementMethods','documentTemplates'];
    for (const k of keys) {
      expect(repos).toHaveProperty(k);
    }
  });
  it('repos are distinct objects', () => {
    expect(repos.departments).not.toBe(repos.employees);
  });
  it('repos are separate from memory repos', () => {
    const mem = createMemoryMasterDataRepositories();
    expect(repos.departments).not.toBe(mem.departments);
  });
});

// ─── MF-04: Prisma stubs throw on create() ───────────────────────────────────

describe('MF-04 Prisma repos throw without DATABASE_URL on create()', () => {
  const repos = createPrismaMasterDataRepositories();

  it('departments.create() throws', async () => {
    await expect(repos.departments.create({ code: 'X', name: 'X', isActive: true, isArchived: false, level: 1 }))
      .rejects.toThrow(/DATABASE_URL/);
  });
  it('vendors.create() throws', async () => {
    await expect(repos.vendors.create({ code: 'V', name: 'V', isActive: true, isArchived: false, taxCode: '1', address: 'HN', isBlacklisted: false }))
      .rejects.toThrow(/DATABASE_URL/);
  });
  it('approvalAuthorities.create() throws', async () => {
    await expect(repos.approvalAuthorities.create({ code: 'A', name: 'A', isActive: true, isArchived: false, level: 1, maxValue: 0 }))
      .rejects.toThrow(/DATABASE_URL/);
  });
});

// ─── MF-05: Prisma stubs throw on write ops ───────────────────────────────────

describe('MF-05 Prisma repos throw without DATABASE_URL on update, delete, archive', () => {
  const repos = createPrismaMasterDataRepositories();

  it('update() throws', async () => {
    await expect(repos.departments.update('id', { name: 'x' })).rejects.toThrow(/DATABASE_URL/);
  });
  it('delete() throws', async () => {
    await expect(repos.departments.delete('id')).rejects.toThrow(/DATABASE_URL/);
  });
  it('archive() throws', async () => {
    await expect(repos.departments.archive('id')).rejects.toThrow(/DATABASE_URL/);
  });
});

// ─── MF-06: Prisma stubs throw on read single ────────────────────────────────

describe('MF-06 Prisma repos throw without DATABASE_URL on findById and findByCode', () => {
  const repos = createPrismaMasterDataRepositories();

  it('findById() throws', async () => {
    await expect(repos.employees.findById('id')).rejects.toThrow(/DATABASE_URL/);
  });
  it('findByCode() throws', async () => {
    await expect(repos.employees.findByCode('CODE')).rejects.toThrow(/DATABASE_URL/);
  });
  it('count() throws', async () => {
    await expect(repos.employees.count()).rejects.toThrow(/DATABASE_URL/);
  });
});

// ─── MF-07: Prisma stubs throw on read multiple ──────────────────────────────

describe('MF-07 Prisma repos throw without DATABASE_URL on findActive and search', () => {
  const repos = createPrismaMasterDataRepositories();

  it('findActive() throws', async () => {
    await expect(repos.packageTypes.findActive()).rejects.toThrow(/DATABASE_URL/);
  });
  it('search() throws', async () => {
    await expect(repos.packageTypes.search({})).rejects.toThrow(/DATABASE_URL/);
  });
  it('error message indicates DATABASE_URL not set', async () => {
    const err = await repos.packageTypes.findActive().catch(e => e);
    expect(err.message).toMatch(/DATABASE_URL|Prisma|database/i);
  });
});

// ─── MF-08: seedDefaultData — approval authorities ───────────────────────────

describe('MF-08 seedDefaultData creates 3 ApprovalAuthority entries', () => {
  let repos: MasterDataRepositories;

  beforeEach(async () => {
    repos = createMemoryMasterDataRepositories();
    await seedDefaultData(repos);
  });

  it('count is 3', async () => {
    expect(await repos.approvalAuthorities.count()).toBe(3);
  });
  it('UNIT_HEAD is present', async () => {
    expect(await repos.approvalAuthorities.findByCode('UNIT_HEAD')).not.toBeNull();
  });
  it('PRIME_MINISTER is present', async () => {
    expect(await repos.approvalAuthorities.findByCode('PRIME_MINISTER')).not.toBeNull();
  });
});

// ─── MF-09: seedDefaultData — authority thresholds ───────────────────────────

describe('MF-09 seeded authority thresholds match legal values', () => {
  let repos: MasterDataRepositories;

  beforeEach(async () => {
    repos = createMemoryMasterDataRepositories();
    await seedDefaultData(repos);
  });

  it('UNIT_HEAD.maxValue = 5 billion VNĐ', async () => {
    const a = await repos.approvalAuthorities.findByCode('UNIT_HEAD');
    expect(a?.maxValue).toBe(5_000_000_000);
  });
  it('MINISTER.maxValue = 50 billion VNĐ', async () => {
    const a = await repos.approvalAuthorities.findByCode('MINISTER');
    expect(a?.maxValue).toBe(50_000_000_000);
  });
  it('PRIME_MINISTER.maxValue = MAX_SAFE_INTEGER', async () => {
    const a = await repos.approvalAuthorities.findByCode('PRIME_MINISTER');
    expect(a?.maxValue).toBe(Number.MAX_SAFE_INTEGER);
  });
});

// ─── MF-10: seedDefaultData — package types ───────────────────────────────────

describe('MF-10 seedDefaultData creates 5 PackageType entries', () => {
  let repos: MasterDataRepositories;

  beforeEach(async () => {
    repos = createMemoryMasterDataRepositories();
    await seedDefaultData(repos);
  });

  it('count is 5', async () => {
    expect(await repos.packageTypes.count()).toBe(5);
  });
  it('GOODS and CONSTRUCTION are present', async () => {
    expect(await repos.packageTypes.findByCode('GOODS')).not.toBeNull();
    expect(await repos.packageTypes.findByCode('CONSTRUCTION')).not.toBeNull();
  });
  it('MIXED is present', async () => {
    expect(await repos.packageTypes.findByCode('MIXED')).not.toBeNull();
  });
});

// ─── MF-11: seedDefaultData — procurement methods ────────────────────────────

describe('MF-11 seedDefaultData creates 7 ProcurementMethod entries', () => {
  let repos: MasterDataRepositories;

  beforeEach(async () => {
    repos = createMemoryMasterDataRepositories();
    await seedDefaultData(repos);
  });

  it('count is 7', async () => {
    expect(await repos.procurementMethods.count()).toBe(7);
  });
  it('OPEN_TENDER and DIRECT_APPOINTMENT are present', async () => {
    expect(await repos.procurementMethods.findByCode('OPEN_TENDER')).not.toBeNull();
    expect(await repos.procurementMethods.findByCode('DIRECT_APPOINTMENT')).not.toBeNull();
  });
  it('COMMUNITY is present', async () => {
    expect(await repos.procurementMethods.findByCode('COMMUNITY')).not.toBeNull();
  });
});

// ─── MF-12: seedDefaultData — fund sources ────────────────────────────────────

describe('MF-12 seedDefaultData creates 4 FundSource entries', () => {
  let repos: MasterDataRepositories;

  beforeEach(async () => {
    repos = createMemoryMasterDataRepositories();
    await seedDefaultData(repos);
  });

  it('count is 4', async () => {
    expect(await repos.fundSources.count()).toBe(4);
  });
  it('STATE and ODA are present', async () => {
    expect(await repos.fundSources.findByCode('STATE')).not.toBeNull();
    expect(await repos.fundSources.findByCode('ODA')).not.toBeNull();
  });
  it('ENTERPRISE is present', async () => {
    expect(await repos.fundSources.findByCode('ENTERPRISE')).not.toBeNull();
  });
});

// ─── MF-13: seedDefaultData — document templates ─────────────────────────────

describe('MF-13 seedDefaultData creates 5 DocumentTemplate entries', () => {
  let repos: MasterDataRepositories;

  beforeEach(async () => {
    repos = createMemoryMasterDataRepositories();
    await seedDefaultData(repos);
  });

  it('count is 5', async () => {
    expect(await repos.documentTemplates.count()).toBe(5);
  });
  it('ke-hoach-lua-chon-nha-thau is present', async () => {
    expect(await repos.documentTemplates.findByCode('ke-hoach-lua-chon-nha-thau')).not.toBeNull();
  });
  it('bien-ban-nghiem-thu is present', async () => {
    const t = await repos.documentTemplates.findByCode('bien-ban-nghiem-thu');
    expect(t?.applicableStates).toContain('ACCEPTANCE');
  });
});
