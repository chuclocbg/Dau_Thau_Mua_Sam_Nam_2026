/**
 * Validation functions — unique code/name, active references, authority level, blacklist, dates
 *
 * Groups (13 × 3 = 39):
 *   MV-01  validateUniqueCode — returns true when code is new
 *   MV-02  validateUniqueCode — returns false for duplicate code
 *   MV-03  validateUniqueCode — excludeId skips same entity
 *   MV-04  validateUniqueName — returns true when name is new
 *   MV-05  validateUniqueName — returns false for duplicate name
 *   MV-06  validateUniqueName — excludeId skips same entity
 *   MV-07  validateActiveReference — true for active entity
 *   MV-08  validateActiveReference — false for archived / inactive
 *   MV-09  validateUniqueAuthorityLevel — no conflict
 *   MV-10  validateUniqueAuthorityLevel — conflict with existing level
 *   MV-11  validateVendorNotBlacklisted
 *   MV-12  validateBudgetYearDates — valid and invalid ranges
 *   MV-13  assertUniqueCode + assertUniqueName throw MasterDataValidationError
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryMasterDataRepository } from '../masterdata/memoryMasterData';
import {
  validateUniqueCode, validateUniqueName, validateActiveReference,
  validateUniqueAuthorityLevel, validateVendorNotBlacklisted, validateBudgetYearDates,
  assertUniqueCode, assertUniqueName,
} from '../masterdata/masterdataValidation';
import { MasterDataValidationError } from '../masterdata/masterdataTypes';
import type { Department, ApprovalAuthority, Vendor } from '../masterdata/masterdataTypes';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeDepRepo() { return new MemoryMasterDataRepository<Department>(); }
function makeAuthRepo() { return new MemoryMasterDataRepository<ApprovalAuthority>(); }
function makeVendorRepo() { return new MemoryMasterDataRepository<Vendor>(); }

const baseAuth = (overrides = {}) => ({
  code: 'UNIT_HEAD', name: 'Người đứng đầu', level: 1,
  maxValue: 5_000_000_000, isActive: true, isArchived: false, ...overrides,
});

// ─── MV-01: validateUniqueCode — new code ────────────────────────────────────

describe('MV-01 validateUniqueCode returns true when code is unique', () => {
  const repo = makeDepRepo();

  it('empty repo accepts any code', async () => {
    expect(await validateUniqueCode(repo, 'NEW')).toBe(true);
  });
  it('different code from existing is accepted', async () => {
    await repo.create({ code: 'A', name: 'A', isActive: true, isArchived: false, level: 1 });
    expect(await validateUniqueCode(repo, 'B')).toBe(true);
  });
  it('code with distinct casing is accepted (case-sensitive)', async () => {
    await repo.create({ code: 'DEPT', name: 'D', isActive: true, isArchived: false, level: 1 });
    expect(await validateUniqueCode(repo, 'dept')).toBe(true);
  });
});

// ─── MV-02: validateUniqueCode — duplicate ───────────────────────────────────

describe('MV-02 validateUniqueCode returns false for duplicate', () => {
  let repo: MemoryMasterDataRepository<Department>;

  beforeEach(async () => {
    repo = makeDepRepo();
    await repo.create({ code: 'DUPE', name: 'Original', isActive: true, isArchived: false, level: 1 });
  });

  it('same code returns false', async () => {
    expect(await validateUniqueCode(repo, 'DUPE')).toBe(false);
  });
  it('false even if existing entity is archived', async () => {
    const e = await repo.create({ code: 'ARCH', name: 'Arc', isActive: true, isArchived: false, level: 1 });
    await repo.archive(e.id);
    expect(await validateUniqueCode(repo, 'ARCH')).toBe(false);
  });
  it('second duplicate also returns false', async () => {
    await repo.create({ code: 'DUPE2', name: 'D2', isActive: true, isArchived: false, level: 1 });
    expect(await validateUniqueCode(repo, 'DUPE2')).toBe(false);
  });
});

// ─── MV-03: validateUniqueCode — excludeId ───────────────────────────────────

describe('MV-03 validateUniqueCode accepts own code when excludeId matches', () => {
  let repo: MemoryMasterDataRepository<Department>;
  let existing: Department;

  beforeEach(async () => {
    repo = makeDepRepo();
    existing = await repo.create({ code: 'OWN', name: 'Own', isActive: true, isArchived: false, level: 1 });
  });

  it('same code with excludeId returns true', async () => {
    expect(await validateUniqueCode(repo, 'OWN', existing.id)).toBe(true);
  });
  it('different entity with same code still returns false', async () => {
    const other = await repo.create({ code: 'OTHER', name: 'O', isActive: true, isArchived: false, level: 1 });
    expect(await validateUniqueCode(repo, 'OWN', other.id)).toBe(false);
  });
  it('excludeId with different code still checks uniqueness', async () => {
    expect(await validateUniqueCode(repo, 'OWN', 'some-other-id')).toBe(false);
  });
});

// ─── MV-04: validateUniqueName — new name ────────────────────────────────────

describe('MV-04 validateUniqueName returns true when name is unique', () => {
  const repo = makeDepRepo();

  it('empty repo accepts any name', async () => {
    expect(await validateUniqueName(repo, 'New Name')).toBe(true);
  });
  it('different name from existing is accepted', async () => {
    await repo.create({ code: 'A', name: 'Alpha', isActive: true, isArchived: false, level: 1 });
    expect(await validateUniqueName(repo, 'Beta')).toBe(true);
  });
  it('partial substring does not cause false rejection', async () => {
    await repo.create({ code: 'X', name: 'Phòng Tài chính', isActive: true, isArchived: false, level: 1 });
    expect(await validateUniqueName(repo, 'Phòng Kế hoạch')).toBe(true);
  });
});

// ─── MV-05: validateUniqueName — duplicate ───────────────────────────────────

describe('MV-05 validateUniqueName returns false for duplicate name', () => {
  let repo: MemoryMasterDataRepository<Department>;

  beforeEach(async () => {
    repo = makeDepRepo();
    await repo.create({ code: 'D1', name: 'Phòng Tài chính', isActive: true, isArchived: false, level: 1 });
  });

  it('exact same name returns false', async () => {
    expect(await validateUniqueName(repo, 'Phòng Tài chính')).toBe(false);
  });
  it('name with trailing space is treated differently', async () => {
    expect(await validateUniqueName(repo, 'Phòng Tài chính ')).toBe(true);
  });
  it('second entity with same name also returns false', async () => {
    await repo.create({ code: 'D2', name: 'Khoa Kỹ thuật', isActive: true, isArchived: false, level: 1 });
    expect(await validateUniqueName(repo, 'Khoa Kỹ thuật')).toBe(false);
  });
});

// ─── MV-06: validateUniqueName — excludeId ───────────────────────────────────

describe('MV-06 validateUniqueName accepts own name when excludeId matches', () => {
  let repo: MemoryMasterDataRepository<Department>;
  let existing: Department;

  beforeEach(async () => {
    repo = makeDepRepo();
    existing = await repo.create({ code: 'N1', name: 'My Name', isActive: true, isArchived: false, level: 1 });
  });

  it('same name with excludeId returns true', async () => {
    expect(await validateUniqueName(repo, 'My Name', existing.id)).toBe(true);
  });
  it('different entity with same name still blocked', async () => {
    const other = await repo.create({ code: 'N2', name: 'Other', isActive: true, isArchived: false, level: 1 });
    expect(await validateUniqueName(repo, 'My Name', other.id)).toBe(false);
  });
  it('excludeId with truly new name still passes', async () => {
    expect(await validateUniqueName(repo, 'Brand New', existing.id)).toBe(true);
  });
});

// ─── MV-07: validateActiveReference — active entity ──────────────────────────

describe('MV-07 validateActiveReference returns true for active entity', () => {
  let repo: MemoryMasterDataRepository<Department>;

  it('returns true for active, non-archived entity', async () => {
    repo = makeDepRepo();
    const e = await repo.create({ code: 'A', name: 'A', isActive: true, isArchived: false, level: 1 });
    expect(await validateActiveReference(repo, e.id)).toBe(true);
  });
  it('returns false for unknown id', async () => {
    repo = makeDepRepo();
    expect(await validateActiveReference(repo, 'unknown')).toBe(false);
  });
  it('after create, reference is immediately valid', async () => {
    repo = makeDepRepo();
    const e = await repo.create({ code: 'B', name: 'B', isActive: true, isArchived: false, level: 1 });
    expect(await validateActiveReference(repo, e.id)).toBe(true);
  });
});

// ─── MV-08: validateActiveReference — archived / inactive ────────────────────

describe('MV-08 validateActiveReference returns false for archived or inactive', () => {
  let repo: MemoryMasterDataRepository<Department>;

  it('archived entity is not a valid reference', async () => {
    repo = makeDepRepo();
    const e = await repo.create({ code: 'C', name: 'C', isActive: true, isArchived: false, level: 1 });
    await repo.archive(e.id);
    expect(await validateActiveReference(repo, e.id)).toBe(false);
  });
  it('inactive entity is not a valid reference', async () => {
    repo = makeDepRepo();
    const e = await repo.create({ code: 'D', name: 'D', isActive: false, isArchived: false, level: 1 });
    expect(await validateActiveReference(repo, e.id)).toBe(false);
  });
  it('deleted entity is not a valid reference', async () => {
    repo = makeDepRepo();
    const e = await repo.create({ code: 'E', name: 'E', isActive: true, isArchived: false, level: 1 });
    await repo.delete(e.id);
    expect(await validateActiveReference(repo, e.id)).toBe(false);
  });
});

// ─── MV-09: validateUniqueAuthorityLevel — no conflict ───────────────────────

describe('MV-09 validateUniqueAuthorityLevel returns true when level is free', () => {
  const repo = makeAuthRepo();

  it('empty repo accepts any level', async () => {
    expect(await validateUniqueAuthorityLevel(repo, 1)).toBe(true);
  });
  it('different level from existing is accepted', async () => {
    await repo.create(baseAuth({ code: 'UNIT_HEAD', level: 1 }));
    expect(await validateUniqueAuthorityLevel(repo, 2)).toBe(true);
  });
  it('level 3 is free when only 1 and 2 exist', async () => {
    await repo.create(baseAuth({ code: 'L1', level: 1 }));
    await repo.create(baseAuth({ code: 'L2', level: 2 }));
    expect(await validateUniqueAuthorityLevel(repo, 3)).toBe(true);
  });
});

// ─── MV-10: validateUniqueAuthorityLevel — conflict ──────────────────────────

describe('MV-10 validateUniqueAuthorityLevel returns false for duplicate level', () => {
  let repo: MemoryMasterDataRepository<ApprovalAuthority>;
  let existing: ApprovalAuthority;

  beforeEach(async () => {
    repo = makeAuthRepo();
    existing = await repo.create(baseAuth({ code: 'UNIT_HEAD', level: 1 }));
  });

  it('same level returns false', async () => {
    expect(await validateUniqueAuthorityLevel(repo, 1)).toBe(false);
  });
  it('excludeId allows updating same authority', async () => {
    expect(await validateUniqueAuthorityLevel(repo, 1, existing.id)).toBe(true);
  });
  it('another authority with conflicting level returns false', async () => {
    expect(await validateUniqueAuthorityLevel(repo, 1, 'other-id')).toBe(false);
  });
});

// ─── MV-11: validateVendorNotBlacklisted ─────────────────────────────────────

describe('MV-11 validateVendorNotBlacklisted checks blacklist flag', () => {
  let repo: MemoryMasterDataRepository<Vendor>;

  beforeEach(() => { repo = makeVendorRepo(); });

  it('returns true for non-blacklisted vendor', async () => {
    const v = await repo.create({ code: 'V1', name: 'ABC', isActive: true, isArchived: false, taxCode: '111', address: 'HN', isBlacklisted: false });
    expect(await validateVendorNotBlacklisted(repo, v.id)).toBe(true);
  });
  it('returns false for blacklisted vendor', async () => {
    const v = await repo.create({ code: 'V2', name: 'BAD', isActive: true, isArchived: false, taxCode: '222', address: 'HN', isBlacklisted: true });
    expect(await validateVendorNotBlacklisted(repo, v.id)).toBe(false);
  });
  it('returns false for unknown vendor id', async () => {
    expect(await validateVendorNotBlacklisted(repo, 'ghost')).toBe(false);
  });
});

// ─── MV-12: validateBudgetYearDates ──────────────────────────────────────────

describe('MV-12 validateBudgetYearDates checks date ordering', () => {
  it('returns true when startDate < endDate', async () => {
    expect(await validateBudgetYearDates('2026-01-01', '2026-12-31')).toBe(true);
  });
  it('returns false when startDate === endDate', async () => {
    expect(await validateBudgetYearDates('2026-01-01', '2026-01-01')).toBe(false);
  });
  it('returns false when startDate > endDate', async () => {
    expect(await validateBudgetYearDates('2026-12-31', '2026-01-01')).toBe(false);
  });
});

// ─── MV-13: assertUniqueCode + assertUniqueName throw MasterDataValidationError

describe('MV-13 assert functions throw MasterDataValidationError on violation', () => {
  it('assertUniqueCode throws when code exists', async () => {
    const repo = makeDepRepo();
    await repo.create({ code: 'TAKEN', name: 'T', isActive: true, isArchived: false, level: 1 });
    await expect(assertUniqueCode(repo, 'TAKEN')).rejects.toThrow(MasterDataValidationError);
  });
  it('assertUniqueName throws when name exists', async () => {
    const repo = makeDepRepo();
    await repo.create({ code: 'X', name: 'Taken Name', isActive: true, isArchived: false, level: 1 });
    const err = await assertUniqueName(repo, 'Taken Name').catch(e => e);
    expect(err).toBeInstanceOf(MasterDataValidationError);
    expect(err.code).toBe('DUPLICATE_NAME');
  });
  it('assertUniqueCode does not throw when code is free', async () => {
    const repo = makeDepRepo();
    await expect(assertUniqueCode(repo, 'FREE')).resolves.toBeUndefined();
  });
});
