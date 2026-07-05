/**
 * Procurement Package service functions
 *
 * Groups (13 × 3 = 39):
 *   PS-01  generatePackageNumber formats correctly
 *   PS-02  createPackage() — happy path
 *   PS-03  createPackage() — rejects duplicate code
 *   PS-04  createPackage() — rejects invalid fields
 *   PS-05  createPackage() — seeds OWNER participant and history
 *   PS-06  updatePackage() — merges valid updates
 *   PS-07  updatePackage() — throws on NOT_FOUND
 *   PS-08  updatePackage() — throws on ARCHIVED
 *   PS-09  clonePackage() — creates DRAFT copy with new code
 *   PS-10  clonePackage() — rejects duplicate new code
 *   PS-11  clonePackage() — throws NOT_FOUND for source
 *   PS-12  archivePackage() — transitions to ARCHIVED
 *   PS-13  archivePackage() — guards ACTIVE and already-ARCHIVED
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  generatePackageNumber, createPackage, updatePackage,
  clonePackage, archivePackage, calculateTotals,
} from '../procurement/package/packageService';
import { createMemoryPackageRepositories } from '../procurement/package/memoryPackageRepositories';
import { PackageError } from '../procurement/package/packageTypes';
import type { PackageRepositories } from '../procurement/package/packageRepository';
import type { ProcurementPackage, CreatePackageParams } from '../procurement/package/packageTypes';

function makeRepos() { return createMemoryPackageRepositories(); }

function params(o: Partial<CreatePackageParams> = {}): CreatePackageParams {
  return {
    packageCode: 'DTMS/2026/001', packageName: 'Mua sắm máy tính',
    packageType: 'GOODS', procurementMethod: 'OPEN_TENDER',
    estimatedValue: 500_000_000, fundSource: 'STATE',
    budgetYear: 'BY-2026', department: 'PHONG-TC', owner: 'NV001', ...o,
  };
}

// ─── PS-01: generatePackageNumber ────────────────────────────────────────────

describe('PS-01 generatePackageNumber formats package code', () => {
  it('default prefix DTMS, current year, seq=1', () => {
    const code = generatePackageNumber();
    expect(code).toMatch(/^DTMS\/\d{4}\/001$/);
  });
  it('custom prefix and year', () => {
    expect(generatePackageNumber('CNTT', 2026, 5)).toBe('CNTT/2026/005');
  });
  it('sequence is zero-padded to 3 digits', () => {
    expect(generatePackageNumber('DTMS', 2026, 99)).toBe('DTMS/2026/099');
    expect(generatePackageNumber('DTMS', 2026, 100)).toBe('DTMS/2026/100');
  });
});

// ─── PS-02: createPackage() — happy path ─────────────────────────────────────

describe('PS-02 createPackage() creates package in DRAFT status', () => {
  let repos: PackageRepositories;

  beforeEach(() => { repos = makeRepos(); });

  it('returns ProcurementPackage with id', async () => {
    const pkg = await createPackage(params(), repos);
    expect(pkg.id.length).toBeGreaterThan(0);
    expect(pkg.packageCode).toBe('DTMS/2026/001');
  });
  it('status is DRAFT', async () => {
    const pkg = await createPackage(params(), repos);
    expect(pkg.status).toBe('DRAFT');
  });
  it('estimatedValue and packageType preserved', async () => {
    const pkg = await createPackage(params({ estimatedValue: 200_000_000, packageType: 'SERVICE' }), repos);
    expect(pkg.estimatedValue).toBe(200_000_000);
    expect(pkg.packageType).toBe('SERVICE');
  });
});

// ─── PS-03: createPackage() — duplicate code ─────────────────────────────────

describe('PS-03 createPackage() rejects duplicate packageCode', () => {
  let repos: PackageRepositories;

  beforeEach(async () => {
    repos = makeRepos();
    await createPackage(params(), repos);
  });

  it('throws PackageError on duplicate', async () => {
    await expect(createPackage(params(), repos)).rejects.toThrow(PackageError);
  });
  it('error code is DUPLICATE_CODE', async () => {
    const err = await createPackage(params(), repos).catch(e => e);
    expect(err.code).toBe('DUPLICATE_CODE');
  });
  it('different code is accepted', async () => {
    const pkg = await createPackage(params({ packageCode: 'DTMS/2026/002' }), repos);
    expect(pkg.packageCode).toBe('DTMS/2026/002');
  });
});

// ─── PS-04: createPackage() — invalid fields ─────────────────────────────────

describe('PS-04 createPackage() rejects invalid input', () => {
  let repos: PackageRepositories;
  beforeEach(() => { repos = makeRepos(); });

  it('empty packageCode throws', async () => {
    await expect(createPackage(params({ packageCode: '' }), repos)).rejects.toThrow();
  });
  it('empty packageName throws', async () => {
    await expect(createPackage(params({ packageName: '' }), repos)).rejects.toThrow();
  });
  it('zero estimatedValue throws', async () => {
    await expect(createPackage(params({ estimatedValue: 0 }), repos)).rejects.toThrow();
  });
});

// ─── PS-05: createPackage() — seeds participant and history ───────────────────

describe('PS-05 createPackage() seeds OWNER participant and CREATED history', () => {
  let repos: PackageRepositories;
  let pkg: ProcurementPackage;

  beforeEach(async () => {
    repos = makeRepos();
    pkg = await createPackage(params(), repos);
  });

  it('participants has OWNER entry', () => {
    expect(pkg.participants).toHaveLength(1);
    expect(pkg.participants[0]?.role).toBe('OWNER');
  });
  it('owner employee code matches owner param', () => {
    expect(pkg.participants[0]?.employeeCode).toBe('NV001');
  });
  it('history has CREATED entry', async () => {
    const hist = await repos.history.findByPackageId(pkg.id);
    expect(hist).toHaveLength(1);
    expect(hist[0]?.action).toBe('CREATED');
  });
});

// ─── PS-06: updatePackage() — happy path ─────────────────────────────────────

describe('PS-06 updatePackage() merges valid updates', () => {
  let repos: PackageRepositories;
  let pkg: ProcurementPackage;

  beforeEach(async () => {
    repos = makeRepos();
    pkg = await createPackage(params(), repos);
  });

  it('updates packageName', async () => {
    const u = await updatePackage(pkg.id, { packageName: 'Updated Name' }, repos, 'NV001');
    expect(u.packageName).toBe('Updated Name');
  });
  it('updates status to SUBMITTED', async () => {
    const u = await updatePackage(pkg.id, { status: 'SUBMITTED' }, repos, 'NV001');
    expect(u.status).toBe('SUBMITTED');
  });
  it('update adds history entry', async () => {
    await updatePackage(pkg.id, { description: 'New desc' }, repos, 'NV001');
    const hist = await repos.history.findByPackageId(pkg.id);
    expect(hist.some(h => h.action === 'UPDATED')).toBe(true);
  });
});

// ─── PS-07: updatePackage() — NOT_FOUND ─────────────────────────────────────

describe('PS-07 updatePackage() throws NOT_FOUND', () => {
  const repos = makeRepos();

  it('throws PackageError for unknown id', async () => {
    await expect(updatePackage('ghost', { packageName: 'X' }, repos, 'u')).rejects.toThrow(PackageError);
  });
  it('error code is NOT_FOUND', async () => {
    const err = await updatePackage('missing', {}, repos, 'u').catch(e => e);
    expect(err.code).toBe('NOT_FOUND');
  });
  it('store remains unchanged', async () => {
    try { await updatePackage('x', {}, repos, 'u'); } catch {}
    expect(await repos.packages.count()).toBe(0);
  });
});

// ─── PS-08: updatePackage() — ARCHIVED guard ─────────────────────────────────

describe('PS-08 updatePackage() blocks updates on ARCHIVED packages', () => {
  let repos: PackageRepositories;
  let pkg: ProcurementPackage;

  beforeEach(async () => {
    repos = makeRepos();
    pkg = await createPackage(params(), repos);
    await repos.packages.update(pkg.id, { status: 'ARCHIVED' });
  });

  it('throws PackageError', async () => {
    await expect(updatePackage(pkg.id, { packageName: 'X' }, repos, 'u')).rejects.toThrow(PackageError);
  });
  it('error code is IMMUTABLE', async () => {
    const err = await updatePackage(pkg.id, {}, repos, 'u').catch(e => e);
    expect(err.code).toBe('IMMUTABLE');
  });
  it('package remains ARCHIVED after failed update', async () => {
    try { await updatePackage(pkg.id, { status: 'DRAFT' }, repos, 'u'); } catch {}
    const p = await repos.packages.findById(pkg.id);
    expect(p?.status).toBe('ARCHIVED');
  });
});

// ─── PS-09: clonePackage() — happy path ──────────────────────────────────────

describe('PS-09 clonePackage() creates DRAFT copy with new code', () => {
  let repos: PackageRepositories;
  let original: ProcurementPackage;

  beforeEach(async () => {
    repos = makeRepos();
    original = await createPackage(params(), repos);
    await repos.packages.update(original.id, { status: 'COMPLETED' });
  });

  it('clone has new packageCode', async () => {
    const clone = await clonePackage(original.id, 'DTMS/2026/002', repos, 'NV002');
    expect(clone.packageCode).toBe('DTMS/2026/002');
  });
  it('clone status is DRAFT', async () => {
    const clone = await clonePackage(original.id, 'DTMS/2026/003', repos, 'NV001');
    expect(clone.status).toBe('DRAFT');
  });
  it('clone preserves estimatedValue and packageType', async () => {
    const clone = await clonePackage(original.id, 'DTMS/2026/004', repos, 'NV001');
    expect(clone.estimatedValue).toBe(original.estimatedValue);
    expect(clone.packageType).toBe(original.packageType);
  });
});

// ─── PS-10: clonePackage() — duplicate new code ───────────────────────────────

describe('PS-10 clonePackage() rejects duplicate new code', () => {
  let repos: PackageRepositories;
  let original: ProcurementPackage;

  beforeEach(async () => {
    repos = makeRepos();
    original = await createPackage(params(), repos);
    await createPackage(params({ packageCode: 'DTMS/2026/002' }), repos);
  });

  it('throws PackageError for duplicate new code', async () => {
    await expect(clonePackage(original.id, 'DTMS/2026/002', repos, 'u')).rejects.toThrow(PackageError);
  });
  it('error code is DUPLICATE_CODE', async () => {
    const err = await clonePackage(original.id, 'DTMS/2026/002', repos, 'u').catch(e => e);
    expect(err.code).toBe('DUPLICATE_CODE');
  });
  it('original code as new code is also rejected', async () => {
    await expect(clonePackage(original.id, 'DTMS/2026/001', repos, 'u')).rejects.toThrow();
  });
});

// ─── PS-11: clonePackage() — source not found ────────────────────────────────

describe('PS-11 clonePackage() throws NOT_FOUND for missing source', () => {
  const repos = makeRepos();

  it('throws PackageError', async () => {
    await expect(clonePackage('ghost', 'NEW', repos, 'u')).rejects.toThrow(PackageError);
  });
  it('error code is NOT_FOUND', async () => {
    const err = await clonePackage('missing', 'NEW2', repos, 'u').catch(e => e);
    expect(err.code).toBe('NOT_FOUND');
  });
  it('no package created on failure', async () => {
    try { await clonePackage('x', 'NEW3', repos, 'u'); } catch {}
    expect(await repos.packages.count()).toBe(0);
  });
});

// ─── PS-12: archivePackage() — success ───────────────────────────────────────

describe('PS-12 archivePackage() transitions to ARCHIVED', () => {
  let repos: PackageRepositories;
  let pkg: ProcurementPackage;

  beforeEach(async () => {
    repos = makeRepos();
    pkg = await createPackage(params(), repos);
  });

  it('status becomes ARCHIVED', async () => {
    const archived = await archivePackage(pkg.id, repos, 'NV001');
    expect(archived.status).toBe('ARCHIVED');
  });
  it('history ARCHIVED entry created', async () => {
    await archivePackage(pkg.id, repos, 'NV001');
    const hist = await repos.history.findByPackageId(pkg.id);
    expect(hist.some(h => h.action === 'ARCHIVED')).toBe(true);
  });
  it('SUBMITTED package can be archived', async () => {
    await repos.packages.update(pkg.id, { status: 'SUBMITTED' });
    const archived = await archivePackage(pkg.id, repos, 'NV001');
    expect(archived.status).toBe('ARCHIVED');
  });
});

// ─── PS-13: archivePackage() — guards ────────────────────────────────────────

describe('PS-13 archivePackage() blocks ACTIVE and already-ARCHIVED', () => {
  let repos: PackageRepositories;
  let pkg: ProcurementPackage;

  beforeEach(async () => {
    repos = makeRepos();
    pkg = await createPackage(params(), repos);
  });

  it('already ARCHIVED throws ALREADY_ARCHIVED', async () => {
    await archivePackage(pkg.id, repos, 'NV001');
    const err = await archivePackage(pkg.id, repos, 'NV001').catch(e => e);
    expect(err.code).toBe('ALREADY_ARCHIVED');
  });
  it('ACTIVE package cannot be archived', async () => {
    await repos.packages.update(pkg.id, { status: 'ACTIVE' });
    await expect(archivePackage(pkg.id, repos, 'NV001')).rejects.toThrow(PackageError);
  });
  it('NOT_FOUND throws PackageError', async () => {
    await expect(archivePackage('ghost', makeRepos(), 'u')).rejects.toThrow(PackageError);
  });
});
