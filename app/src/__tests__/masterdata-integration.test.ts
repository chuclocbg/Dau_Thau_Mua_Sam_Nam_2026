/**
 * Integration bridge — masterdataIntegration.ts
 *
 * Groups (13 × 3 = 39):
 *   MI-01  resolveApprovalAuthorityLimit — known active authority
 *   MI-02  resolveApprovalAuthorityLimit — inactive / unknown returns 0
 *   MI-03  validateApprovalAuthorityFromMasterData — within limit
 *   MI-04  validateApprovalAuthorityFromMasterData — over limit
 *   MI-05  resolvePackageTypeFromMasterData — active vs inactive
 *   MI-06  resolveProcurementMethodFromMasterData — active vs archived
 *   MI-07  resolveDocumentTemplatesForState — state filter
 *   MI-08  resolveDocumentTemplatesForState — unmatched state returns empty
 *   MI-09  buildWorkflowParamsFromMasterData — happy path
 *   MI-10  buildWorkflowParamsFromMasterData — throws on unknown packageType
 *   MI-11  buildWorkflowParamsFromMasterData — throws on unknown method
 *   MI-12  buildWorkflowParamsFromMasterData — throws on unknown authority
 *   MI-13  buildWorkflowParamsFromMasterData — throws on inactive code
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  resolveApprovalAuthorityLimit,
  validateApprovalAuthorityFromMasterData,
  resolvePackageTypeFromMasterData,
  resolveProcurementMethodFromMasterData,
  resolveDocumentTemplatesForState,
  buildWorkflowParamsFromMasterData,
} from '../masterdata/masterdataIntegration';
import { MemoryMasterDataRepository } from '../masterdata/memoryMasterData';
import {
  createMemoryMasterDataRepositories, seedDefaultData,
} from '../masterdata/masterdataFactory';
import type {
  ApprovalAuthority, PackageType, ProcurementMethod, DocumentTemplate,
} from '../masterdata/masterdataTypes';
import type { MasterDataRepositories } from '../masterdata/masterdataRepository';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeAuthRepo() { return new MemoryMasterDataRepository<ApprovalAuthority>(); }
function makePTRepo()   { return new MemoryMasterDataRepository<PackageType>(); }
function makePMRepo()   { return new MemoryMasterDataRepository<ProcurementMethod>(); }
function makeDTRepo()   { return new MemoryMasterDataRepository<DocumentTemplate>(); }

// ─── MI-01: resolveApprovalAuthorityLimit — known active ─────────────────────

describe('MI-01 resolveApprovalAuthorityLimit returns maxValue for active authority', () => {
  const repo = makeAuthRepo();

  it('UNIT_HEAD limit = 5 billion', async () => {
    await repo.create({ code: 'UNIT_HEAD', name: 'Người đứng đầu', isActive: true, isArchived: false, level: 1, maxValue: 5_000_000_000 });
    expect(await resolveApprovalAuthorityLimit('UNIT_HEAD', repo)).toBe(5_000_000_000);
  });
  it('MINISTER limit = 50 billion', async () => {
    await repo.create({ code: 'MINISTER', name: 'Bộ trưởng', isActive: true, isArchived: false, level: 2, maxValue: 50_000_000_000 });
    expect(await resolveApprovalAuthorityLimit('MINISTER', repo)).toBe(50_000_000_000);
  });
  it('PRIME_MINISTER limit = MAX_SAFE_INTEGER', async () => {
    await repo.create({ code: 'PRIME_MINISTER', name: 'Thủ tướng', isActive: true, isArchived: false, level: 3, maxValue: Number.MAX_SAFE_INTEGER });
    expect(await resolveApprovalAuthorityLimit('PRIME_MINISTER', repo)).toBe(Number.MAX_SAFE_INTEGER);
  });
});

// ─── MI-02: resolveApprovalAuthorityLimit — inactive / unknown ───────────────

describe('MI-02 resolveApprovalAuthorityLimit returns 0 for inactive or unknown', () => {
  it('unknown code returns 0', async () => {
    const repo = makeAuthRepo();
    expect(await resolveApprovalAuthorityLimit('GHOST', repo)).toBe(0);
  });
  it('inactive authority returns 0', async () => {
    const repo = makeAuthRepo();
    await repo.create({ code: 'INACTIVE', name: 'I', isActive: false, isArchived: false, level: 1, maxValue: 999 });
    expect(await resolveApprovalAuthorityLimit('INACTIVE', repo)).toBe(0);
  });
  it('archived authority returns 0', async () => {
    const repo = makeAuthRepo();
    const a = await repo.create({ code: 'ARCH', name: 'A', isActive: true, isArchived: false, level: 1, maxValue: 999 });
    await repo.archive(a.id);
    expect(await resolveApprovalAuthorityLimit('ARCH', repo)).toBe(0);
  });
});

// ─── MI-03: validateApprovalAuthorityFromMasterData — within limit ───────────

describe('MI-03 validateApprovalAuthorityFromMasterData returns true when within limit', () => {
  let repo: MemoryMasterDataRepository<ApprovalAuthority>;

  beforeEach(async () => {
    repo = makeAuthRepo();
    await repo.create({ code: 'UNIT_HEAD', name: 'UH', isActive: true, isArchived: false, level: 1, maxValue: 5_000_000_000 });
  });

  it('1 billion < 5 billion limit → true', async () => {
    expect(await validateApprovalAuthorityFromMasterData({ estimatedValue: 1_000_000_000, approvalAuthority: 'UNIT_HEAD' }, repo)).toBe(true);
  });
  it('exactly at limit is false (strict less-than)', async () => {
    expect(await validateApprovalAuthorityFromMasterData({ estimatedValue: 5_000_000_000, approvalAuthority: 'UNIT_HEAD' }, repo)).toBe(false);
  });
  it('zero value is always within any limit', async () => {
    expect(await validateApprovalAuthorityFromMasterData({ estimatedValue: 0, approvalAuthority: 'UNIT_HEAD' }, repo)).toBe(true);
  });
});

// ─── MI-04: validateApprovalAuthorityFromMasterData — over limit ─────────────

describe('MI-04 validateApprovalAuthorityFromMasterData returns false when over limit', () => {
  let repo: MemoryMasterDataRepository<ApprovalAuthority>;

  beforeEach(async () => {
    repo = makeAuthRepo();
    await repo.create({ code: 'UNIT_HEAD', name: 'UH', isActive: true, isArchived: false, level: 1, maxValue: 5_000_000_000 });
  });

  it('6 billion > 5 billion limit → false', async () => {
    expect(await validateApprovalAuthorityFromMasterData({ estimatedValue: 6_000_000_000, approvalAuthority: 'UNIT_HEAD' }, repo)).toBe(false);
  });
  it('unknown authority code → false (limit = 0)', async () => {
    expect(await validateApprovalAuthorityFromMasterData({ estimatedValue: 1, approvalAuthority: 'GHOST' }, repo)).toBe(false);
  });
  it('inactive authority → false', async () => {
    await repo.create({ code: 'INACT', name: 'I', isActive: false, isArchived: false, level: 2, maxValue: 50_000_000_000 });
    expect(await validateApprovalAuthorityFromMasterData({ estimatedValue: 1, approvalAuthority: 'INACT' }, repo)).toBe(false);
  });
});

// ─── MI-05: resolvePackageTypeFromMasterData ─────────────────────────────────

describe('MI-05 resolvePackageTypeFromMasterData returns active entity or null', () => {
  let repo: MemoryMasterDataRepository<PackageType>;

  it('returns active PackageType by code', async () => {
    repo = makePTRepo();
    await repo.create({ code: 'GOODS', name: 'Hàng hóa', isActive: true, isArchived: false, category: 'Mua sắm' });
    const pt = await resolvePackageTypeFromMasterData('GOODS', repo);
    expect(pt?.code).toBe('GOODS');
  });
  it('returns null for unknown code', async () => {
    repo = makePTRepo();
    expect(await resolvePackageTypeFromMasterData('NONE', repo)).toBeNull();
  });
  it('returns null for inactive code', async () => {
    repo = makePTRepo();
    await repo.create({ code: 'OLD', name: 'Old', isActive: false, isArchived: false, category: '' });
    expect(await resolvePackageTypeFromMasterData('OLD', repo)).toBeNull();
  });
});

// ─── MI-06: resolveProcurementMethodFromMasterData ───────────────────────────

describe('MI-06 resolveProcurementMethodFromMasterData returns active entity or null', () => {
  let repo: MemoryMasterDataRepository<ProcurementMethod>;

  it('returns active method by code', async () => {
    repo = makePMRepo();
    await repo.create({ code: 'OPEN_TENDER', name: 'OT', isActive: true, isArchived: false, applicablePackageTypeCodes: ['GOODS'] });
    expect(await resolveProcurementMethodFromMasterData('OPEN_TENDER', repo)).not.toBeNull();
  });
  it('returns null for unknown code', async () => {
    repo = makePMRepo();
    expect(await resolveProcurementMethodFromMasterData('NONE', repo)).toBeNull();
  });
  it('returns null for archived method', async () => {
    repo = makePMRepo();
    const m = await repo.create({ code: 'OLD_METHOD', name: 'Old', isActive: true, isArchived: false, applicablePackageTypeCodes: [] });
    await repo.archive(m.id);
    expect(await resolveProcurementMethodFromMasterData('OLD_METHOD', repo)).toBeNull();
  });
});

// ─── MI-07: resolveDocumentTemplatesForState ─────────────────────────────────

describe('MI-07 resolveDocumentTemplatesForState filters by state', () => {
  let repo: MemoryMasterDataRepository<DocumentTemplate>;

  beforeEach(async () => {
    repo = makeDTRepo();
    await repo.create({ code: 'KHLCNT', name: 'KH', isActive: true, isArchived: false, templateType: 'KH', content: '', applicableStates: ['METHOD_SELECTED'] });
    await repo.create({ code: 'HSMT',   name: 'HS', isActive: true, isArchived: false, templateType: 'HS', content: '', applicableStates: ['DOCUMENT_PREPARATION'] });
    await repo.create({ code: 'BBDG',   name: 'BB', isActive: true, isArchived: false, templateType: 'BB', content: '', applicableStates: ['EVALUATION'] });
  });

  it('METHOD_SELECTED returns KHLCNT template', async () => {
    const templates = await resolveDocumentTemplatesForState('METHOD_SELECTED', repo);
    expect(templates).toHaveLength(1);
    expect(templates[0]?.code).toBe('KHLCNT');
  });
  it('DOCUMENT_PREPARATION returns HSMT template', async () => {
    const templates = await resolveDocumentTemplatesForState('DOCUMENT_PREPARATION', repo);
    expect(templates[0]?.code).toBe('HSMT');
  });
  it('EVALUATION returns BBDG template', async () => {
    const templates = await resolveDocumentTemplatesForState('EVALUATION', repo);
    expect(templates[0]?.code).toBe('BBDG');
  });
});

// ─── MI-08: resolveDocumentTemplatesForState — no match ──────────────────────

describe('MI-08 resolveDocumentTemplatesForState returns empty for unmatched state', () => {
  let repo: MemoryMasterDataRepository<DocumentTemplate>;

  beforeEach(async () => {
    repo = makeDTRepo();
    await repo.create({ code: 'T1', name: 'T', isActive: true, isArchived: false, templateType: 'T', content: '', applicableStates: ['EVALUATION'] });
  });

  it('DRAFT state has no templates', async () => {
    expect(await resolveDocumentTemplatesForState('DRAFT', repo)).toHaveLength(0);
  });
  it('empty repo always returns empty', async () => {
    const empty = makeDTRepo();
    expect(await resolveDocumentTemplatesForState('METHOD_SELECTED', empty)).toHaveLength(0);
  });
  it('archived template is not returned', async () => {
    const t = await repo.create({ code: 'ARC', name: 'A', isActive: true, isArchived: false, templateType: 'A', content: '', applicableStates: ['DRAFT'] });
    await repo.archive(t.id);
    expect(await resolveDocumentTemplatesForState('DRAFT', repo)).toHaveLength(0);
  });
});

// ─── MI-09: buildWorkflowParamsFromMasterData — happy path ───────────────────

describe('MI-09 buildWorkflowParamsFromMasterData resolves all codes', () => {
  let repos: MasterDataRepositories;

  beforeEach(async () => {
    repos = createMemoryMasterDataRepositories();
    await seedDefaultData(repos);
  });

  it('returns WorkflowCreationParams with resolved codes', async () => {
    const params = await buildWorkflowParamsFromMasterData({
      packageId: 'PKG-001', packageTypeCode: 'GOODS', estimatedValue: 100_000_000,
      procurementMethodCode: 'OPEN_TENDER', approvalAuthorityCode: 'UNIT_HEAD', performedBy: 'user1',
    }, repos);
    expect(params.packageType).toBe('GOODS');
    expect(params.procurementMethod).toBe('OPEN_TENDER');
    expect(params.approvalAuthority).toBe('UNIT_HEAD');
  });
  it('packageId and estimatedValue are passed through', async () => {
    const params = await buildWorkflowParamsFromMasterData({
      packageId: 'PKG-XYZ', packageTypeCode: 'SERVICE', estimatedValue: 50_000_000,
      procurementMethodCode: 'DIRECT_PROCUREMENT', approvalAuthorityCode: 'UNIT_HEAD', performedBy: 'user2',
    }, repos);
    expect(params.packageId).toBe('PKG-XYZ');
    expect(params.estimatedValue).toBe(50_000_000);
  });
  it('performedBy is passed through', async () => {
    const params = await buildWorkflowParamsFromMasterData({
      packageId: 'P', packageTypeCode: 'GOODS', estimatedValue: 1,
      procurementMethodCode: 'OPEN_TENDER', approvalAuthorityCode: 'MINISTER', performedBy: 'admin',
    }, repos);
    expect(params.performedBy).toBe('admin');
  });
});

// ─── MI-10: buildWorkflowParamsFromMasterData — unknown packageType ───────────

describe('MI-10 buildWorkflowParamsFromMasterData throws on unknown packageType', () => {
  let repos: MasterDataRepositories;

  beforeEach(async () => {
    repos = createMemoryMasterDataRepositories();
    await seedDefaultData(repos);
  });

  it('throws with unknown packageTypeCode', async () => {
    await expect(buildWorkflowParamsFromMasterData({
      packageId: 'P', packageTypeCode: 'UNKNOWN_TYPE', estimatedValue: 1,
      procurementMethodCode: 'OPEN_TENDER', approvalAuthorityCode: 'UNIT_HEAD', performedBy: 'u',
    }, repos)).rejects.toThrow(/UNKNOWN_TYPE/);
  });
  it('error message mentions the offending code', async () => {
    const err = await buildWorkflowParamsFromMasterData({
      packageId: 'P', packageTypeCode: 'BAD_CODE', estimatedValue: 1,
      procurementMethodCode: 'OPEN_TENDER', approvalAuthorityCode: 'UNIT_HEAD', performedBy: 'u',
    }, repos).catch(e => e);
    expect(err.message).toMatch(/BAD_CODE/);
  });
  it('does not resolve other fields if packageType fails', async () => {
    await expect(buildWorkflowParamsFromMasterData({
      packageId: 'P', packageTypeCode: 'INVALID', estimatedValue: 1,
      procurementMethodCode: 'OPEN_TENDER', approvalAuthorityCode: 'UNIT_HEAD', performedBy: 'u',
    }, repos)).rejects.toThrow();
  });
});

// ─── MI-11: buildWorkflowParamsFromMasterData — unknown method ───────────────

describe('MI-11 buildWorkflowParamsFromMasterData throws on unknown procurementMethod', () => {
  let repos: MasterDataRepositories;

  beforeEach(async () => {
    repos = createMemoryMasterDataRepositories();
    await seedDefaultData(repos);
  });

  it('throws on unknown procurementMethodCode', async () => {
    await expect(buildWorkflowParamsFromMasterData({
      packageId: 'P', packageTypeCode: 'GOODS', estimatedValue: 1,
      procurementMethodCode: 'GHOST_METHOD', approvalAuthorityCode: 'UNIT_HEAD', performedBy: 'u',
    }, repos)).rejects.toThrow(/GHOST_METHOD/);
  });
  it('error identifies the method code', async () => {
    const err = await buildWorkflowParamsFromMasterData({
      packageId: 'P', packageTypeCode: 'GOODS', estimatedValue: 1,
      procurementMethodCode: 'BAD_METHOD', approvalAuthorityCode: 'UNIT_HEAD', performedBy: 'u',
    }, repos).catch(e => e);
    expect(err.message).toMatch(/BAD_METHOD/);
  });
  it('valid packageType + invalid method still throws', async () => {
    await expect(buildWorkflowParamsFromMasterData({
      packageId: 'P', packageTypeCode: 'CONSTRUCTION', estimatedValue: 1,
      procurementMethodCode: 'NOT_FOUND', approvalAuthorityCode: 'UNIT_HEAD', performedBy: 'u',
    }, repos)).rejects.toThrow();
  });
});

// ─── MI-12: buildWorkflowParamsFromMasterData — unknown authority ─────────────

describe('MI-12 buildWorkflowParamsFromMasterData throws on unknown approvalAuthority', () => {
  let repos: MasterDataRepositories;

  beforeEach(async () => {
    repos = createMemoryMasterDataRepositories();
    await seedDefaultData(repos);
  });

  it('throws on unknown approvalAuthorityCode', async () => {
    await expect(buildWorkflowParamsFromMasterData({
      packageId: 'P', packageTypeCode: 'GOODS', estimatedValue: 1,
      procurementMethodCode: 'OPEN_TENDER', approvalAuthorityCode: 'PRESIDENT', performedBy: 'u',
    }, repos)).rejects.toThrow(/PRESIDENT/);
  });
  it('error identifies the authority code', async () => {
    const err = await buildWorkflowParamsFromMasterData({
      packageId: 'P', packageTypeCode: 'GOODS', estimatedValue: 1,
      procurementMethodCode: 'OPEN_TENDER', approvalAuthorityCode: 'NO_SUCH_AUTH', performedBy: 'u',
    }, repos).catch(e => e);
    expect(err.message).toMatch(/NO_SUCH_AUTH/);
  });
  it('valid codes + invalid authority still throws', async () => {
    await expect(buildWorkflowParamsFromMasterData({
      packageId: 'P', packageTypeCode: 'SERVICE', estimatedValue: 1,
      procurementMethodCode: 'LIMITED_TENDER', approvalAuthorityCode: 'GHOST', performedBy: 'u',
    }, repos)).rejects.toThrow();
  });
});

// ─── MI-13: buildWorkflowParamsFromMasterData — inactive code ────────────────

describe('MI-13 buildWorkflowParamsFromMasterData throws on inactive or archived code', () => {
  let repos: MasterDataRepositories;

  beforeEach(async () => {
    repos = createMemoryMasterDataRepositories();
    await seedDefaultData(repos);
  });

  it('throws if packageType is archived', async () => {
    const goods = await repos.packageTypes.findByCode('GOODS');
    await repos.packageTypes.archive(goods!.id);
    await expect(buildWorkflowParamsFromMasterData({
      packageId: 'P', packageTypeCode: 'GOODS', estimatedValue: 1,
      procurementMethodCode: 'OPEN_TENDER', approvalAuthorityCode: 'UNIT_HEAD', performedBy: 'u',
    }, repos)).rejects.toThrow();
  });
  it('throws if procurementMethod is archived', async () => {
    const m = await repos.procurementMethods.findByCode('OPEN_TENDER');
    await repos.procurementMethods.archive(m!.id);
    await expect(buildWorkflowParamsFromMasterData({
      packageId: 'P', packageTypeCode: 'GOODS', estimatedValue: 1,
      procurementMethodCode: 'OPEN_TENDER', approvalAuthorityCode: 'UNIT_HEAD', performedBy: 'u',
    }, repos)).rejects.toThrow();
  });
  it('throws if approvalAuthority is archived', async () => {
    const a = await repos.approvalAuthorities.findByCode('UNIT_HEAD');
    await repos.approvalAuthorities.archive(a!.id);
    await expect(buildWorkflowParamsFromMasterData({
      packageId: 'P', packageTypeCode: 'GOODS', estimatedValue: 1,
      procurementMethodCode: 'OPEN_TENDER', approvalAuthorityCode: 'UNIT_HEAD', performedBy: 'u',
    }, repos)).rejects.toThrow();
  });
});
