/**
 * Master data entity types and type guards
 *
 * Groups (13 × 3 = 39):
 *   MT-01  MasterDataEntity base shape
 *   MT-02  Department — parentId optional, level required
 *   MT-03  Employee — departmentId, email, roles[]
 *   MT-04  ApprovalAuthority — level + maxValue
 *   MT-05  Vendor — taxCode + isBlacklisted
 *   MT-06  FundSource — type enum values
 *   MT-07  BudgetYear — year, startDate, endDate, totalBudget
 *   MT-08  PackageType — category string
 *   MT-09  ProcurementMethod — applicablePackageTypeCodes[]
 *   MT-10  ProcurementCategory — parentCategoryId optional
 *   MT-11  DocumentTemplate — templateType, content, applicableStates[]
 *   MT-12  SearchQuery + PagedResult shapes
 *   MT-13  Type guards and MasterDataValidationError
 */

import { describe, it, expect } from 'vitest';
import {
  isFundSourceType,
  isMasterDataEntity,
  MasterDataValidationError,
} from '../masterdata/masterdataTypes';
import type {
  MasterDataEntity, Department, Employee, ApprovalAuthority, Vendor,
  FundSource, BudgetYear, PackageType, ProcurementMethod, ProcurementCategory,
  DocumentTemplate, SearchQuery, PagedResult,
} from '../masterdata/masterdataTypes';

// ─── MT-01: MasterDataEntity base shape ──────────────────────────────────────

describe('MT-01 MasterDataEntity base shape has required fields', () => {
  const entity: MasterDataEntity = {
    id: 'e1', code: 'DEPT-01', name: 'Test', isActive: true,
    isArchived: false, createdAt: '2026-07-01T00:00:00Z', updatedAt: '2026-07-01T00:00:00Z',
  };

  it('has id, code, name fields', () => {
    expect(entity.id).toBe('e1');
    expect(entity.code).toBe('DEPT-01');
    expect(entity.name).toBe('Test');
  });
  it('has isActive and isArchived booleans', () => {
    expect(entity.isActive).toBe(true);
    expect(entity.isArchived).toBe(false);
  });
  it('has ISO createdAt and updatedAt', () => {
    expect(entity.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}/);
    expect(entity.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}/);
  });
});

// ─── MT-02: Department ────────────────────────────────────────────────────────

describe('MT-02 Department has optional parentId and required level', () => {
  it('top-level department has no parentId', () => {
    const dept: Department = {
      id: 'd1', code: 'PHONG-TC', name: 'Phòng Tài chính', isActive: true,
      isArchived: false, level: 1, createdAt: '', updatedAt: '',
    };
    expect(dept.parentId).toBeUndefined();
    expect(dept.level).toBe(1);
  });
  it('child department has parentId', () => {
    const child: Department = {
      id: 'd2', code: 'TO-KE', name: 'Tổ Kế toán', isActive: true,
      isArchived: false, level: 2, parentId: 'd1', createdAt: '', updatedAt: '',
    };
    expect(child.parentId).toBe('d1');
  });
  it('level reflects hierarchy depth', () => {
    const top: Department = { id: 'd3', code: 'BAN', name: 'Ban Giám hiệu', isActive: true, isArchived: false, level: 1, createdAt: '', updatedAt: '' };
    expect(top.level).toBe(1);
  });
});

// ─── MT-03: Employee ─────────────────────────────────────────────────────────

describe('MT-03 Employee has departmentId, email, and roles array', () => {
  const emp: Employee = {
    id: 'e1', code: 'NV001', name: 'Nguyễn Văn A', isActive: true,
    isArchived: false, departmentId: 'd1', email: 'a@uni.edu.vn',
    roles: ['PROCUREMENT_OFFICER', 'APPROVER'], createdAt: '', updatedAt: '',
  };

  it('has departmentId and email', () => {
    expect(emp.departmentId).toBe('d1');
    expect(emp.email).toContain('@');
  });
  it('roles is a non-empty array', () => {
    expect(Array.isArray(emp.roles)).toBe(true);
    expect(emp.roles.length).toBeGreaterThan(0);
  });
  it('roles contains valid role strings', () => {
    expect(emp.roles).toContain('PROCUREMENT_OFFICER');
  });
});

// ─── MT-04: ApprovalAuthority ─────────────────────────────────────────────────

describe('MT-04 ApprovalAuthority has numeric level and maxValue', () => {
  const auth: ApprovalAuthority = {
    id: 'a1', code: 'UNIT_HEAD', name: 'Người đứng đầu', isActive: true,
    isArchived: false, level: 1, maxValue: 5_000_000_000, createdAt: '', updatedAt: '',
  };

  it('maxValue is a positive number (VNĐ)', () => {
    expect(auth.maxValue).toBeGreaterThan(0);
    expect(auth.maxValue).toBe(5_000_000_000);
  });
  it('level is a positive integer', () => {
    expect(auth.level).toBeGreaterThan(0);
  });
  it('PRIME_MINISTER can have MAX_SAFE_INTEGER maxValue', () => {
    const pm: ApprovalAuthority = {
      ...auth, id: 'a3', code: 'PRIME_MINISTER', name: 'Thủ tướng',
      level: 3, maxValue: Number.MAX_SAFE_INTEGER,
    };
    expect(pm.maxValue).toBe(Number.MAX_SAFE_INTEGER);
  });
});

// ─── MT-05: Vendor ───────────────────────────────────────────────────────────

describe('MT-05 Vendor has taxCode and isBlacklisted flag', () => {
  const vendor: Vendor = {
    id: 'v1', code: 'VDR001', name: 'Công ty ABC', isActive: true,
    isArchived: false, taxCode: '0123456789', address: 'Hà Nội',
    isBlacklisted: false, createdAt: '', updatedAt: '',
  };

  it('taxCode is a non-empty string', () => {
    expect(vendor.taxCode.length).toBeGreaterThan(0);
  });
  it('isBlacklisted defaults to false for normal vendors', () => {
    expect(vendor.isBlacklisted).toBe(false);
  });
  it('contactEmail is optional', () => {
    expect(vendor.contactEmail).toBeUndefined();
    const withEmail: Vendor = { ...vendor, contactEmail: 'contact@abc.vn' };
    expect(withEmail.contactEmail).toBe('contact@abc.vn');
  });
});

// ─── MT-06: FundSource ───────────────────────────────────────────────────────

describe('MT-06 FundSource type is one of 4 defined values', () => {
  it('STATE type is valid', () => {
    const fs: FundSource = { id: 'fs1', code: 'STATE', name: 'Vốn nhà nước', isActive: true, isArchived: false, type: 'STATE', createdAt: '', updatedAt: '' };
    expect(isFundSourceType(fs.type)).toBe(true);
  });
  it('all 4 types pass isFundSourceType guard', () => {
    for (const t of ['STATE', 'ODA', 'PPP', 'ENTERPRISE']) {
      expect(isFundSourceType(t)).toBe(true);
    }
  });
  it('unknown string fails isFundSourceType guard', () => {
    expect(isFundSourceType('GRANT')).toBe(false);
    expect(isFundSourceType(null)).toBe(false);
  });
});

// ─── MT-07: BudgetYear ───────────────────────────────────────────────────────

describe('MT-07 BudgetYear has year, date range, and totalBudget', () => {
  const by: BudgetYear = {
    id: 'by1', code: 'BY-2026', name: 'Năm ngân sách 2026', isActive: true,
    isArchived: false, year: 2026, startDate: '2026-01-01', endDate: '2026-12-31',
    totalBudget: 1_000_000_000, createdAt: '', updatedAt: '',
  };

  it('year is a 4-digit integer', () => {
    expect(by.year).toBe(2026);
    expect(by.year.toString()).toHaveLength(4);
  });
  it('startDate is before endDate', () => {
    expect(by.startDate < by.endDate).toBe(true);
  });
  it('totalBudget is a positive number', () => {
    expect(by.totalBudget).toBeGreaterThan(0);
  });
});

// ─── MT-08: PackageType ──────────────────────────────────────────────────────

describe('MT-08 PackageType has a category display string', () => {
  it('GOODS has a Vietnamese category', () => {
    const pt: PackageType = {
      id: 'pt1', code: 'GOODS', name: 'Hàng hóa', isActive: true,
      isArchived: false, category: 'Mua sắm hàng hóa', createdAt: '', updatedAt: '',
    };
    expect(pt.category.length).toBeGreaterThan(0);
  });
  it('code maps to procurement engine PACKAGE_TYPES', () => {
    const codes = ['GOODS', 'SERVICE', 'CONSULTING', 'CONSTRUCTION', 'MIXED'];
    for (const code of codes) {
      const pt: PackageType = { id: code, code, name: code, isActive: true, isArchived: false, category: code, createdAt: '', updatedAt: '' };
      expect(pt.code).toBe(code);
    }
  });
  it('name is a Vietnamese display string', () => {
    const pt: PackageType = { id: 'c', code: 'CONSTRUCTION', name: 'Xây lắp', isActive: true, isArchived: false, category: 'Xây dựng', createdAt: '', updatedAt: '' };
    expect(pt.name).toBe('Xây lắp');
  });
});

// ─── MT-09: ProcurementMethod ─────────────────────────────────────────────────

describe('MT-09 ProcurementMethod has applicablePackageTypeCodes array', () => {
  const method: ProcurementMethod = {
    id: 'm1', code: 'OPEN_TENDER', name: 'Đấu thầu rộng rãi', isActive: true,
    isArchived: false, applicablePackageTypeCodes: ['GOODS', 'SERVICE', 'CONSTRUCTION'],
    createdAt: '', updatedAt: '',
  };

  it('applicablePackageTypeCodes is an array', () => {
    expect(Array.isArray(method.applicablePackageTypeCodes)).toBe(true);
  });
  it('includes GOODS and SERVICE', () => {
    expect(method.applicablePackageTypeCodes).toContain('GOODS');
    expect(method.applicablePackageTypeCodes).toContain('SERVICE');
  });
  it('name is a Vietnamese string', () => {
    expect(method.name).toMatch(/[ĐđTt]hầu/);
  });
});

// ─── MT-10: ProcurementCategory ──────────────────────────────────────────────

describe('MT-10 ProcurementCategory has packageTypeCode and optional parentCategoryId', () => {
  it('root category has no parentCategoryId', () => {
    const cat: ProcurementCategory = {
      id: 'pc1', code: 'CAT-IT', name: 'Thiết bị CNTT', isActive: true,
      isArchived: false, packageTypeCode: 'GOODS', createdAt: '', updatedAt: '',
    };
    expect(cat.parentCategoryId).toBeUndefined();
    expect(cat.packageTypeCode).toBe('GOODS');
  });
  it('sub-category has parentCategoryId', () => {
    const sub: ProcurementCategory = {
      id: 'pc2', code: 'CAT-LAPTOP', name: 'Máy tính xách tay', isActive: true,
      isArchived: false, packageTypeCode: 'GOODS', parentCategoryId: 'pc1',
      createdAt: '', updatedAt: '',
    };
    expect(sub.parentCategoryId).toBe('pc1');
  });
  it('packageTypeCode is a non-empty string', () => {
    const cat: ProcurementCategory = {
      id: 'pc3', code: 'CAT-BUILD', name: 'Công trình xây dựng', isActive: true,
      isArchived: false, packageTypeCode: 'CONSTRUCTION', createdAt: '', updatedAt: '',
    };
    expect(cat.packageTypeCode.length).toBeGreaterThan(0);
  });
});

// ─── MT-11: DocumentTemplate ──────────────────────────────────────────────────

describe('MT-11 DocumentTemplate has templateType, content, applicableStates', () => {
  const tmpl: DocumentTemplate = {
    id: 'dt1', code: 'ho-so-moi-thau', name: 'Hồ sơ mời thầu', isActive: true,
    isArchived: false, templateType: 'HSMT', content: '[HSMT content]',
    applicableStates: ['DOCUMENT_PREPARATION'], createdAt: '', updatedAt: '',
  };

  it('templateType is a non-empty string', () => {
    expect(tmpl.templateType.length).toBeGreaterThan(0);
  });
  it('content is a string (may be template body)', () => {
    expect(typeof tmpl.content).toBe('string');
  });
  it('applicableStates is a non-empty array of state IDs', () => {
    expect(tmpl.applicableStates).toContain('DOCUMENT_PREPARATION');
  });
});

// ─── MT-12: SearchQuery + PagedResult ─────────────────────────────────────────

describe('MT-12 SearchQuery and PagedResult shapes', () => {
  it('SearchQuery accepts term, isActive, page, pageSize', () => {
    const q: SearchQuery = { term: 'phòng', isActive: true, page: 1, pageSize: 20 };
    expect(q.term).toBe('phòng');
    expect(q.page).toBe(1);
  });
  it('PagedResult has items, total, page, pageSize', () => {
    const r: PagedResult<MasterDataEntity> = {
      items: [], total: 0, page: 1, pageSize: 20,
    };
    expect(r.total).toBe(0);
    expect(Array.isArray(r.items)).toBe(true);
  });
  it('SearchQuery all fields are optional', () => {
    const q: SearchQuery = {};
    expect(q.term).toBeUndefined();
    expect(q.page).toBeUndefined();
  });
});

// ─── MT-13: Type guards and MasterDataValidationError ─────────────────────────

describe('MT-13 isMasterDataEntity guard and MasterDataValidationError', () => {
  it('isMasterDataEntity returns true for valid entity', () => {
    const e: MasterDataEntity = { id: '1', code: 'C', name: 'N', isActive: true, isArchived: false, createdAt: '', updatedAt: '' };
    expect(isMasterDataEntity(e)).toBe(true);
  });
  it('isMasterDataEntity returns false for null and primitives', () => {
    expect(isMasterDataEntity(null)).toBe(false);
    expect(isMasterDataEntity('string')).toBe(false);
  });
  it('MasterDataValidationError has code, field, and message', () => {
    const err = new MasterDataValidationError('DUPLICATE_CODE', 'code', 'Code exists');
    expect(err.code).toBe('DUPLICATE_CODE');
    expect(err.field).toBe('code');
    expect(err.message).toBe('Code exists');
    expect(err.name).toBe('MasterDataValidationError');
  });
});
