/**
 * Entity-specific repository behaviour — 10 entity types
 *
 * Groups (13 × 3 = 39):
 *   ME-01  Department CRUD and hierarchy
 *   ME-02  Employee roles and departmentId reference
 *   ME-03  ApprovalAuthority maxValue range
 *   ME-04  Vendor blacklist toggle
 *   ME-05  FundSource type integrity
 *   ME-06  BudgetYear date range
 *   ME-07  PackageType category
 *   ME-08  ProcurementMethod applicablePackageTypeCodes
 *   ME-09  ProcurementCategory hierarchy
 *   ME-10  DocumentTemplate applicableStates
 *   ME-11  archive() excludes from findActive() across entity types
 *   ME-12  search() returns typed entities with all fields
 *   ME-13  count() reflects create + delete + archive
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryMasterDataRepository } from '../masterdata/memoryMasterData';
import type {
  Department, Employee, ApprovalAuthority, Vendor, FundSource,
  BudgetYear, PackageType, ProcurementMethod, ProcurementCategory, DocumentTemplate,
} from '../masterdata/masterdataTypes';

// ─── ME-01: Department ───────────────────────────────────────────────────────

describe('ME-01 Department CRUD and hierarchy', () => {
  const repo = new MemoryMasterDataRepository<Department>();

  it('creates root department with level 1', async () => {
    const d = await repo.create({ code: 'ROOT', name: 'Root', isActive: true, isArchived: false, level: 1 });
    expect(d.level).toBe(1);
    expect(d.parentId).toBeUndefined();
  });
  it('creates child department with parentId', async () => {
    const parent = await repo.create({ code: 'P', name: 'Parent', isActive: true, isArchived: false, level: 1 });
    const child  = await repo.create({ code: 'C', name: 'Child',  isActive: true, isArchived: false, level: 2, parentId: parent.id });
    expect(child.parentId).toBe(parent.id);
    expect(child.level).toBe(2);
  });
  it('update changes name but not level', async () => {
    const d = await repo.create({ code: 'UPD', name: 'Old', isActive: true, isArchived: false, level: 2 });
    const updated = await repo.update(d.id, { name: 'New' });
    expect(updated.name).toBe('New');
    expect(updated.level).toBe(2);
  });
});

// ─── ME-02: Employee ─────────────────────────────────────────────────────────

describe('ME-02 Employee roles and departmentId', () => {
  const repo = new MemoryMasterDataRepository<Employee>();

  it('creates employee with roles array', async () => {
    const e = await repo.create({ code: 'NV01', name: 'Nguyễn A', isActive: true, isArchived: false, departmentId: 'dep1', email: 'a@h.vn', roles: ['OFFICER'] });
    expect(e.roles).toContain('OFFICER');
  });
  it('roles can have multiple entries', async () => {
    const e = await repo.create({ code: 'NV02', name: 'Nguyễn B', isActive: true, isArchived: false, departmentId: 'dep1', email: 'b@h.vn', roles: ['OFFICER', 'APPROVER'] });
    expect(e.roles).toHaveLength(2);
  });
  it('email is preserved', async () => {
    const e = await repo.create({ code: 'NV03', name: 'Nguyễn C', isActive: true, isArchived: false, departmentId: 'dep2', email: 'c@uni.edu.vn', roles: [] });
    expect(e.email).toBe('c@uni.edu.vn');
  });
});

// ─── ME-03: ApprovalAuthority ─────────────────────────────────────────────────

describe('ME-03 ApprovalAuthority maxValue represents VNĐ threshold', () => {
  const repo = new MemoryMasterDataRepository<ApprovalAuthority>();

  it('UNIT_HEAD has maxValue 5 billion VNĐ', async () => {
    const a = await repo.create({ code: 'UNIT_HEAD', name: 'Người đứng đầu', isActive: true, isArchived: false, level: 1, maxValue: 5_000_000_000 });
    expect(a.maxValue).toBe(5_000_000_000);
  });
  it('MINISTER has maxValue 50 billion VNĐ', async () => {
    const a = await repo.create({ code: 'MINISTER', name: 'Bộ trưởng', isActive: true, isArchived: false, level: 2, maxValue: 50_000_000_000 });
    expect(a.maxValue).toBe(50_000_000_000);
  });
  it('PRIME_MINISTER has MAX_SAFE_INTEGER', async () => {
    const a = await repo.create({ code: 'PRIME_MINISTER', name: 'Thủ tướng', isActive: true, isArchived: false, level: 3, maxValue: Number.MAX_SAFE_INTEGER });
    expect(a.maxValue).toBe(Number.MAX_SAFE_INTEGER);
  });
});

// ─── ME-04: Vendor blacklist ─────────────────────────────────────────────────

describe('ME-04 Vendor blacklist flag can be toggled', () => {
  const repo = new MemoryMasterDataRepository<Vendor>();

  it('creates vendor with isBlacklisted=false', async () => {
    const v = await repo.create({ code: 'V1', name: 'ABC', isActive: true, isArchived: false, taxCode: '001', address: 'HN', isBlacklisted: false });
    expect(v.isBlacklisted).toBe(false);
  });
  it('update sets isBlacklisted=true', async () => {
    const v = await repo.create({ code: 'V2', name: 'BAD', isActive: true, isArchived: false, taxCode: '002', address: 'HN', isBlacklisted: false });
    const updated = await repo.update(v.id, { isBlacklisted: true });
    expect(updated.isBlacklisted).toBe(true);
  });
  it('blacklisted vendors still appear in search results', async () => {
    await repo.create({ code: 'V3', name: 'Evil Co', isActive: true, isArchived: false, taxCode: '003', address: 'HN', isBlacklisted: true });
    const r = await repo.search({ term: 'Evil' });
    expect(r.items).toHaveLength(1);
  });
});

// ─── ME-05: FundSource ───────────────────────────────────────────────────────

describe('ME-05 FundSource type is stored and retrieved correctly', () => {
  const repo = new MemoryMasterDataRepository<FundSource>();

  it('STATE type is preserved', async () => {
    const f = await repo.create({ code: 'STATE', name: 'Vốn nhà nước', isActive: true, isArchived: false, type: 'STATE' });
    expect(f.type).toBe('STATE');
  });
  it('ODA type is preserved', async () => {
    const f = await repo.create({ code: 'ODA', name: 'Vốn ODA', isActive: true, isArchived: false, type: 'ODA' });
    expect(f.type).toBe('ODA');
  });
  it('ENTERPRISE type is preserved', async () => {
    const f = await repo.create({ code: 'ENT', name: 'Vốn DN', isActive: true, isArchived: false, type: 'ENTERPRISE' });
    expect(f.type).toBe('ENTERPRISE');
  });
});

// ─── ME-06: BudgetYear ───────────────────────────────────────────────────────

describe('ME-06 BudgetYear date range and totalBudget', () => {
  const repo = new MemoryMasterDataRepository<BudgetYear>();

  it('creates with year and date range', async () => {
    const by = await repo.create({ code: 'BY26', name: '2026', isActive: true, isArchived: false, year: 2026, startDate: '2026-01-01', endDate: '2026-12-31', totalBudget: 1e9 });
    expect(by.year).toBe(2026);
    expect(by.startDate).toBe('2026-01-01');
  });
  it('totalBudget is preserved', async () => {
    const by = await repo.create({ code: 'BY27', name: '2027', isActive: true, isArchived: false, year: 2027, startDate: '2027-01-01', endDate: '2027-12-31', totalBudget: 2_500_000_000 });
    expect(by.totalBudget).toBe(2_500_000_000);
  });
  it('update changes totalBudget', async () => {
    const by = await repo.create({ code: 'BY28', name: '2028', isActive: true, isArchived: false, year: 2028, startDate: '2028-01-01', endDate: '2028-12-31', totalBudget: 500_000_000 });
    const updated = await repo.update(by.id, { totalBudget: 999_999_999 });
    expect(updated.totalBudget).toBe(999_999_999);
  });
});

// ─── ME-07: PackageType ──────────────────────────────────────────────────────

describe('ME-07 PackageType category is preserved', () => {
  const repo = new MemoryMasterDataRepository<PackageType>();

  it('GOODS category is preserved', async () => {
    const pt = await repo.create({ code: 'GOODS', name: 'Hàng hóa', isActive: true, isArchived: false, category: 'Mua sắm hàng hóa' });
    expect(pt.category).toBe('Mua sắm hàng hóa');
  });
  it('CONSTRUCTION category is preserved', async () => {
    const pt = await repo.create({ code: 'CONS', name: 'Xây lắp', isActive: true, isArchived: false, category: 'Xây dựng' });
    expect(pt.category).toBe('Xây dựng');
  });
  it('update changes category', async () => {
    const pt = await repo.create({ code: 'SVC', name: 'Dịch vụ', isActive: true, isArchived: false, category: 'Dịch vụ cũ' });
    const updated = await repo.update(pt.id, { category: 'Dịch vụ mới' });
    expect(updated.category).toBe('Dịch vụ mới');
  });
});

// ─── ME-08: ProcurementMethod ─────────────────────────────────────────────────

describe('ME-08 ProcurementMethod stores applicablePackageTypeCodes', () => {
  const repo = new MemoryMasterDataRepository<ProcurementMethod>();

  it('OPEN_TENDER applies to all 5 package types', async () => {
    const m = await repo.create({ code: 'OPEN_TENDER', name: 'Đấu thầu rộng rãi', isActive: true, isArchived: false, applicablePackageTypeCodes: ['GOODS','SERVICE','CONSULTING','CONSTRUCTION','MIXED'] });
    expect(m.applicablePackageTypeCodes).toHaveLength(5);
  });
  it('COMPETITIVE_QUOTE applies only to GOODS and SERVICE', async () => {
    const m = await repo.create({ code: 'CQ', name: 'Chào hàng', isActive: true, isArchived: false, applicablePackageTypeCodes: ['GOODS','SERVICE'] });
    expect(m.applicablePackageTypeCodes).toHaveLength(2);
    expect(m.applicablePackageTypeCodes).toContain('GOODS');
  });
  it('codes array is preserved through findByCode', async () => {
    await repo.create({ code: 'DA', name: 'Chỉ định', isActive: true, isArchived: false, applicablePackageTypeCodes: ['GOODS','CONSULTING'] });
    const found = await repo.findByCode('DA');
    expect(found?.applicablePackageTypeCodes).toContain('CONSULTING');
  });
});

// ─── ME-09: ProcurementCategory ───────────────────────────────────────────────

describe('ME-09 ProcurementCategory hierarchy with packageTypeCode', () => {
  const repo = new MemoryMasterDataRepository<ProcurementCategory>();

  it('root category has no parentCategoryId', async () => {
    const c = await repo.create({ code: 'CAT-IT', name: 'CNTT', isActive: true, isArchived: false, packageTypeCode: 'GOODS' });
    expect(c.parentCategoryId).toBeUndefined();
  });
  it('child category has parentCategoryId', async () => {
    const parent = await repo.create({ code: 'P1', name: 'Parent', isActive: true, isArchived: false, packageTypeCode: 'GOODS' });
    const child  = await repo.create({ code: 'C1', name: 'Child', isActive: true, isArchived: false, packageTypeCode: 'GOODS', parentCategoryId: parent.id });
    expect(child.parentCategoryId).toBe(parent.id);
  });
  it('packageTypeCode is preserved through update', async () => {
    const c = await repo.create({ code: 'CAT-CON', name: 'Con', isActive: true, isArchived: false, packageTypeCode: 'CONSTRUCTION' });
    const updated = await repo.update(c.id, { name: 'Updated' });
    expect(updated.packageTypeCode).toBe('CONSTRUCTION');
  });
});

// ─── ME-10: DocumentTemplate ──────────────────────────────────────────────────

describe('ME-10 DocumentTemplate applicableStates and content', () => {
  const repo = new MemoryMasterDataRepository<DocumentTemplate>();

  it('applicableStates array is preserved', async () => {
    const t = await repo.create({ code: 'HSMT', name: 'Hồ sơ mời thầu', isActive: true, isArchived: false, templateType: 'HSMT', content: '[body]', applicableStates: ['DOCUMENT_PREPARATION'] });
    expect(t.applicableStates).toContain('DOCUMENT_PREPARATION');
  });
  it('content is preserved as-is', async () => {
    const t = await repo.create({ code: 'KHLCNT', name: 'KH', isActive: true, isArchived: false, templateType: 'KH', content: 'Template content here', applicableStates: ['METHOD_SELECTED'] });
    expect(t.content).toBe('Template content here');
  });
  it('template applicable to multiple states', async () => {
    const t = await repo.create({ code: 'MULTI', name: 'Multi', isActive: true, isArchived: false, templateType: 'M', content: '', applicableStates: ['EVALUATION', 'APPROVAL'] });
    expect(t.applicableStates).toHaveLength(2);
  });
});

// ─── ME-11: archive() across entity types ────────────────────────────────────

describe('ME-11 archive() excludes from findActive() across entity types', () => {
  it('archived Department excluded from findActive', async () => {
    const repo = new MemoryMasterDataRepository<Department>();
    const d = await repo.create({ code: 'D', name: 'D', isActive: true, isArchived: false, level: 1 });
    await repo.archive(d.id);
    expect(await repo.findActive()).toHaveLength(0);
  });
  it('archived Vendor excluded from findActive', async () => {
    const repo = new MemoryMasterDataRepository<Vendor>();
    const v = await repo.create({ code: 'V', name: 'V', isActive: true, isArchived: false, taxCode: '1', address: 'HN', isBlacklisted: false });
    await repo.archive(v.id);
    expect(await repo.findActive()).toHaveLength(0);
  });
  it('non-archived entity stays in findActive', async () => {
    const repo = new MemoryMasterDataRepository<FundSource>();
    await repo.create({ code: 'FS', name: 'FS', isActive: true, isArchived: false, type: 'STATE' });
    expect(await repo.findActive()).toHaveLength(1);
  });
});

// ─── ME-12: search() returns typed entities ───────────────────────────────────

describe('ME-12 search() returns correctly typed entities', () => {
  it('Employee search returns emails', async () => {
    const repo = new MemoryMasterDataRepository<Employee>();
    await repo.create({ code: 'E1', name: 'Alice', isActive: true, isArchived: false, departmentId: 'dep', email: 'alice@edu.vn', roles: [] });
    const r = await repo.search({ term: 'Alice' });
    expect(r.items[0]?.email).toBe('alice@edu.vn');
  });
  it('ApprovalAuthority search returns maxValue', async () => {
    const repo = new MemoryMasterDataRepository<ApprovalAuthority>();
    await repo.create({ code: 'UH', name: 'Người đứng đầu', isActive: true, isArchived: false, level: 1, maxValue: 5_000_000_000 });
    const r = await repo.search({ term: 'Người' });
    expect(r.items[0]?.maxValue).toBe(5_000_000_000);
  });
  it('PackageType search returns category', async () => {
    const repo = new MemoryMasterDataRepository<PackageType>();
    await repo.create({ code: 'GOODS', name: 'Hàng hóa', isActive: true, isArchived: false, category: 'Mua sắm' });
    const r = await repo.search({ term: 'Hàng' });
    expect(r.items[0]?.category).toBe('Mua sắm');
  });
});

// ─── ME-13: count() reflects create / delete / archive ───────────────────────

describe('ME-13 count() reflects create, delete, and archive', () => {
  let repo: MemoryMasterDataRepository<Department>;

  beforeEach(() => { repo = new MemoryMasterDataRepository<Department>(); });

  it('count grows with each create', async () => {
    await repo.create({ code: 'A', name: 'A', isActive: true, isArchived: false, level: 1 });
    await repo.create({ code: 'B', name: 'B', isActive: true, isArchived: false, level: 1 });
    expect(await repo.count()).toBe(2);
  });
  it('delete reduces count', async () => {
    const e = await repo.create({ code: 'C', name: 'C', isActive: true, isArchived: false, level: 1 });
    await repo.delete(e.id);
    expect(await repo.count()).toBe(0);
  });
  it('archive does NOT reduce count', async () => {
    const e = await repo.create({ code: 'D', name: 'D', isActive: true, isArchived: false, level: 1 });
    await repo.archive(e.id);
    expect(await repo.count()).toBe(1);
  });
});
