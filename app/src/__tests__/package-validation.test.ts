/**
 * Procurement Package validation rules
 *
 * Groups (13 × 3 = 39):
 *   PV-01  validateUniquePackageCode — new code accepted
 *   PV-02  validateUniquePackageCode — duplicate rejected
 *   PV-03  validateUniquePackageCode — excludeId allows own code
 *   PV-04  assertUniquePackageCode throws PackageError
 *   PV-05  validateBudgetAmounts — valid amounts pass
 *   PV-06  validateBudgetAmounts — negative amounts fail
 *   PV-07  validateBudgetBalance — totals match
 *   PV-08  validateBudgetBalance — mismatch detected
 *   PV-09  validateDepartmentExists — active vs inactive
 *   PV-10  validateFundSourceExists — active vs inactive
 *   PV-11  validateRequiredFields — all required present
 *   PV-12  validateRequiredFields — missing required fails
 *   PV-13  validatePackageSync composite result
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  validateUniquePackageCode, assertUniquePackageCode,
  validateBudgetAmounts, validateBudgetBalance,
  validateDepartmentExists, validateFundSourceExists,
  validateRequiredFields, validatePackageSync,
} from '../procurement/package/packageValidation';
import { PackageError } from '../procurement/package/packageTypes';
import { MemoryProcurementPackageRepository } from '../procurement/package/memoryPackageRepositories';
import { MemoryMasterDataRepository } from '../masterdata/memoryMasterData';
import type { Department, FundSource } from '../masterdata/masterdataTypes';
import type { ProcurementPackage, PackageBudget } from '../procurement/package/packageTypes';

type PkgInput = Omit<ProcurementPackage, 'id' | 'createdAt' | 'updatedAt'>;
function pkgInput(o: Partial<PkgInput> = {}): PkgInput {
  return {
    packageCode: 'X', packageName: 'Test', description: '',
    packageType: 'GOODS', procurementMethod: 'OPEN_TENDER',
    estimatedValue: 100_000_000, fundSource: 'STATE', budgetYear: 'BY-2026',
    department: 'PHONG-TC', owner: 'NV001', status: 'DRAFT',
    schedule: {}, funding: [], participants: [], ...o,
  };
}

function budget(o: Partial<PackageBudget> = {}): Pick<PackageBudget, 'approvedAmount'|'committedAmount'|'spentAmount'|'remainingAmount'> {
  return { approvedAmount: 500_000_000, committedAmount: 100_000_000, spentAmount: 50_000_000, remainingAmount: 350_000_000, ...o };
}

// ─── PV-01: validateUniquePackageCode — accepted ─────────────────────────────

describe('PV-01 validateUniquePackageCode returns true for new codes', () => {
  const repo = new MemoryProcurementPackageRepository();

  it('empty repo accepts any code', async () => {
    expect(await validateUniquePackageCode('NEW', repo)).toBe(true);
  });
  it('different code from existing accepted', async () => {
    await repo.create(pkgInput({ packageCode: 'A' }));
    expect(await validateUniquePackageCode('B', repo)).toBe(true);
  });
  it('case-different code is treated as unique', async () => {
    await repo.create(pkgInput({ packageCode: 'DTMS/26/001' }));
    expect(await validateUniquePackageCode('dtms/26/001', repo)).toBe(true);
  });
});

// ─── PV-02: validateUniquePackageCode — rejected ─────────────────────────────

describe('PV-02 validateUniquePackageCode returns false for duplicate', () => {
  let repo: MemoryProcurementPackageRepository;

  beforeEach(async () => {
    repo = new MemoryProcurementPackageRepository();
    await repo.create(pkgInput({ packageCode: 'DUPE' }));
  });

  it('same code returns false', async () => {
    expect(await validateUniquePackageCode('DUPE', repo)).toBe(false);
  });
  it('second duplicate also false', async () => {
    await repo.create(pkgInput({ packageCode: 'DUPE2' }));
    expect(await validateUniquePackageCode('DUPE2', repo)).toBe(false);
  });
  it('submitted package code also conflicts', async () => {
    await repo.create(pkgInput({ packageCode: 'SUB', status: 'SUBMITTED' }));
    expect(await validateUniquePackageCode('SUB', repo)).toBe(false);
  });
});

// ─── PV-03: validateUniquePackageCode — excludeId ─────────────────────────────

describe('PV-03 validateUniquePackageCode excludeId skips own record', () => {
  let repo: MemoryProcurementPackageRepository;
  let existing: ProcurementPackage;

  beforeEach(async () => {
    repo = new MemoryProcurementPackageRepository();
    existing = await repo.create(pkgInput({ packageCode: 'OWN' }));
  });

  it('same code with excludeId returns true', async () => {
    expect(await validateUniquePackageCode('OWN', repo, existing.id)).toBe(true);
  });
  it('other entity with same code still blocked', async () => {
    const other = await repo.create(pkgInput({ packageCode: 'OTHER' }));
    expect(await validateUniquePackageCode('OWN', repo, other.id)).toBe(false);
  });
  it('wrong excludeId blocks self', async () => {
    expect(await validateUniquePackageCode('OWN', repo, 'wrong-id')).toBe(false);
  });
});

// ─── PV-04: assertUniquePackageCode throws PackageError ──────────────────────

describe('PV-04 assertUniquePackageCode throws on duplicate', () => {
  it('throws PackageError for duplicate code', async () => {
    const repo = new MemoryProcurementPackageRepository();
    await repo.create(pkgInput({ packageCode: 'TAKEN' }));
    await expect(assertUniquePackageCode('TAKEN', repo)).rejects.toThrow(PackageError);
  });
  it('error code is DUPLICATE_CODE', async () => {
    const repo = new MemoryProcurementPackageRepository();
    await repo.create(pkgInput({ packageCode: 'T2' }));
    const err = await assertUniquePackageCode('T2', repo).catch(e => e);
    expect(err.code).toBe('DUPLICATE_CODE');
  });
  it('resolves without error for free code', async () => {
    const repo = new MemoryProcurementPackageRepository();
    await expect(assertUniquePackageCode('FREE', repo)).resolves.toBeUndefined();
  });
});

// ─── PV-05: validateBudgetAmounts — valid ────────────────────────────────────

describe('PV-05 validateBudgetAmounts returns valid for non-negative amounts', () => {
  it('all zero amounts pass', () => {
    expect(validateBudgetAmounts({ approvedAmount: 0, committedAmount: 0, spentAmount: 0, remainingAmount: 0 }).valid).toBe(true);
  });
  it('typical budget passes', () => {
    expect(validateBudgetAmounts(budget()).valid).toBe(true);
  });
  it('large amounts pass', () => {
    const r = validateBudgetAmounts({ approvedAmount: 50_000_000_000, committedAmount: 0, spentAmount: 0, remainingAmount: 50_000_000_000 });
    expect(r.valid).toBe(true);
  });
});

// ─── PV-06: validateBudgetAmounts — invalid ──────────────────────────────────

describe('PV-06 validateBudgetAmounts fails for negative amounts', () => {
  it('negative approvedAmount fails', () => {
    const r = validateBudgetAmounts(budget({ approvedAmount: -1 }));
    expect(r.valid).toBe(false);
    expect(r.errors).toContain('approvedAmount cannot be negative');
  });
  it('negative remainingAmount fails', () => {
    const r = validateBudgetAmounts(budget({ remainingAmount: -100 }));
    expect(r.valid).toBe(false);
  });
  it('multiple negative amounts produce multiple errors', () => {
    const r = validateBudgetAmounts({ approvedAmount: -1, committedAmount: -1, spentAmount: 0, remainingAmount: 0 });
    expect(r.errors.length).toBeGreaterThanOrEqual(2);
  });
});

// ─── PV-07: validateBudgetBalance — totals match ─────────────────────────────

describe('PV-07 validateBudgetBalance passes when totals match', () => {
  it('500 − 100 − 50 = 350 passes', () => {
    const r = validateBudgetBalance(budget());
    expect(r.valid).toBe(true);
  });
  it('all zeros pass', () => {
    const r = validateBudgetBalance({ approvedAmount: 0, committedAmount: 0, spentAmount: 0, remainingAmount: 0 });
    expect(r.valid).toBe(true);
  });
  it('no committed or spent: remaining = approved', () => {
    const r = validateBudgetBalance({ approvedAmount: 100, committedAmount: 0, spentAmount: 0, remainingAmount: 100 });
    expect(r.valid).toBe(true);
  });
});

// ─── PV-08: validateBudgetBalance — mismatch ─────────────────────────────────

describe('PV-08 validateBudgetBalance fails on mismatch', () => {
  it('wrong remainingAmount fails', () => {
    const r = validateBudgetBalance(budget({ remainingAmount: 999 }));
    expect(r.valid).toBe(false);
    expect(r.errors[0]).toMatch(/remainingAmount/);
  });
  it('committed + spent exceeds approved fails', () => {
    const r = validateBudgetBalance({ approvedAmount: 100, committedAmount: 80, spentAmount: 40, remainingAmount: -20 });
    expect(r.valid).toBe(false);
  });
  it('near-zero remaining produces a warning', () => {
    const r = validateBudgetBalance({ approvedAmount: 1000, committedAmount: 900, spentAmount: 95, remainingAmount: 5 });
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});

// ─── PV-09: validateDepartmentExists ──────────────────────────────────────────

describe('PV-09 validateDepartmentExists checks master data', () => {
  it('returns true for active department', async () => {
    const repo = new MemoryMasterDataRepository<Department>();
    await repo.create({ code: 'PHONG-TC', name: 'TC', isActive: true, isArchived: false, level: 1 });
    expect(await validateDepartmentExists('PHONG-TC', repo)).toBe(true);
  });
  it('returns false for unknown code', async () => {
    const repo = new MemoryMasterDataRepository<Department>();
    expect(await validateDepartmentExists('GHOST', repo)).toBe(false);
  });
  it('returns false for inactive department', async () => {
    const repo = new MemoryMasterDataRepository<Department>();
    await repo.create({ code: 'OLD', name: 'Old', isActive: false, isArchived: false, level: 1 });
    expect(await validateDepartmentExists('OLD', repo)).toBe(false);
  });
});

// ─── PV-10: validateFundSourceExists ─────────────────────────────────────────

describe('PV-10 validateFundSourceExists checks master data', () => {
  it('returns true for active fund source', async () => {
    const repo = new MemoryMasterDataRepository<FundSource>();
    await repo.create({ code: 'STATE', name: 'Vốn nhà nước', isActive: true, isArchived: false, type: 'STATE' });
    expect(await validateFundSourceExists('STATE', repo)).toBe(true);
  });
  it('returns false for unknown code', async () => {
    const repo = new MemoryMasterDataRepository<FundSource>();
    expect(await validateFundSourceExists('GRANT', repo)).toBe(false);
  });
  it('returns false for archived fund source', async () => {
    const repo = new MemoryMasterDataRepository<FundSource>();
    const fs = await repo.create({ code: 'OLD', name: 'Old', isActive: true, isArchived: false, type: 'STATE' });
    await repo.archive(fs.id);
    expect(await validateFundSourceExists('OLD', repo)).toBe(false);
  });
});

// ─── PV-11: validateRequiredFields — present ─────────────────────────────────

describe('PV-11 validateRequiredFields passes when all required are present', () => {
  it('complete package input passes', () => {
    const r = validateRequiredFields(pkgInput());
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });
  it('extra optional fields do not affect result', () => {
    const r = validateRequiredFields(pkgInput({ procurementCategory: 'CAT-IT' }));
    expect(r.valid).toBe(true);
  });
  it('returns empty errors array on success', () => {
    const r = validateRequiredFields(pkgInput({ packageCode: 'DTMS/2026/001' }));
    expect(r.errors).toHaveLength(0);
  });
});

// ─── PV-12: validateRequiredFields — missing ─────────────────────────────────

describe('PV-12 validateRequiredFields fails on missing fields', () => {
  it('missing packageCode produces error', () => {
    const r = validateRequiredFields({ ...pkgInput(), packageCode: '' });
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => e.includes('packageCode'))).toBe(true);
  });
  it('missing packageName produces error', () => {
    const r = validateRequiredFields({ ...pkgInput(), packageName: '' });
    expect(r.valid).toBe(false);
  });
  it('missing owner and department produce 2 errors', () => {
    const r = validateRequiredFields({ ...pkgInput(), owner: '', department: '' });
    expect(r.errors.length).toBeGreaterThanOrEqual(2);
  });
});

// ─── PV-13: validatePackageSync composite ────────────────────────────────────

describe('PV-13 validatePackageSync runs required fields + estimatedValue checks', () => {
  it('valid package passes sync validation', () => {
    expect(validatePackageSync(pkgInput()).valid).toBe(true);
  });
  it('zero estimatedValue fails', () => {
    const r = validatePackageSync(pkgInput({ estimatedValue: 0 }));
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => e.includes('estimatedValue'))).toBe(true);
  });
  it('missing required fields + invalid value accumulates errors', () => {
    const r = validatePackageSync({ packageCode: '', packageName: '', estimatedValue: -1 });
    expect(r.errors.length).toBeGreaterThan(1);
  });
});
