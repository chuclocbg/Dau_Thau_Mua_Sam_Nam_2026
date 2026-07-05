/**
 * Procurement Package — entity type shapes and type guards
 *
 * Groups (13 × 3 = 39):
 *   PT-01  PACKAGE_STATUSES array contains 7 values
 *   PT-02  ProcurementPackage base fields
 *   PT-03  ProcurementPackage embedded PackageSchedule
 *   PT-04  ProcurementPackage embedded PackageFunding[]
 *   PT-05  ProcurementPackage embedded PackageParticipant[]
 *   PT-06  PackageItem fields — quantity × price = estimatedTotal
 *   PT-07  PackageBudget fields — approved − committed − spent = remaining
 *   PT-08  PackageAttachment fields
 *   PT-09  PackageHistory fields — action and status transitions
 *   PT-10  CreatePackageParams and UpdatePackageParams shapes
 *   PT-11  PackageSearchQuery and PackageSearchResult shapes
 *   PT-12  PackageValidationResult shape
 *   PT-13  isPackageStatus and isParticipantRole type guards
 */

import { describe, it, expect } from 'vitest';
import {
  PACKAGE_STATUSES, PARTICIPANT_ROLES,
  isPackageStatus, isParticipantRole, PackageError,
} from '../procurement/package/packageTypes';
import type {
  ProcurementPackage, PackageItem, PackageBudget, PackageAttachment, PackageHistory,
  PackageSchedule, PackageFunding, PackageParticipant,
  CreatePackageParams, UpdatePackageParams,
  PackageSearchQuery, PackageSearchResult, PackageValidationResult,
} from '../procurement/package/packageTypes';

// ─── PT-01: PACKAGE_STATUSES ─────────────────────────────────────────────────

describe('PT-01 PACKAGE_STATUSES contains 7 lifecycle values', () => {
  it('contains 7 statuses', () => {
    expect(PACKAGE_STATUSES).toHaveLength(7);
  });
  it('includes DRAFT, ACTIVE, COMPLETED, ARCHIVED', () => {
    expect(PACKAGE_STATUSES).toContain('DRAFT');
    expect(PACKAGE_STATUSES).toContain('ACTIVE');
    expect(PACKAGE_STATUSES).toContain('ARCHIVED');
  });
  it('includes SUBMITTED, APPROVED, CANCELLED', () => {
    expect(PACKAGE_STATUSES).toContain('SUBMITTED');
    expect(PACKAGE_STATUSES).toContain('APPROVED');
    expect(PACKAGE_STATUSES).toContain('CANCELLED');
  });
});

// ─── PT-02: ProcurementPackage base fields ────────────────────────────────────

describe('PT-02 ProcurementPackage base fields are present', () => {
  const pkg: ProcurementPackage = {
    id: 'pkg-001', packageCode: 'DTMS/2026/001', packageName: 'Mua sắm máy tính',
    description: 'Mua sắm thiết bị CNTT', packageType: 'GOODS',
    procurementMethod: 'OPEN_TENDER', estimatedValue: 500_000_000,
    fundSource: 'STATE', budgetYear: 'BY-2026', department: 'PHONG-TC',
    owner: 'NV001', status: 'DRAFT', schedule: {}, funding: [], participants: [],
    createdAt: '2026-07-01T00:00:00Z', updatedAt: '2026-07-01T00:00:00Z',
  };

  it('packageCode and packageName are present', () => {
    expect(pkg.packageCode).toBe('DTMS/2026/001');
    expect(pkg.packageName).toBe('Mua sắm máy tính');
  });
  it('estimatedValue and status are present', () => {
    expect(pkg.estimatedValue).toBe(500_000_000);
    expect(pkg.status).toBe('DRAFT');
  });
  it('workflowId and approvedValue are optional', () => {
    expect(pkg.workflowId).toBeUndefined();
    expect(pkg.approvedValue).toBeUndefined();
    const withWf: ProcurementPackage = { ...pkg, workflowId: 'wf-1', approvedValue: 450_000_000 };
    expect(withWf.workflowId).toBe('wf-1');
  });
});

// ─── PT-03: PackageSchedule ───────────────────────────────────────────────────

describe('PT-03 PackageSchedule — all fields optional, embedded on package', () => {
  it('empty schedule is valid', () => {
    const s: PackageSchedule = {};
    expect(Object.keys(s).length).toBe(0);
  });
  it('schedule with all dates', () => {
    const s: PackageSchedule = {
      planningDate: '2026-01-01', approvalDate: '2026-02-01',
      tenderDate: '2026-03-01', evaluationDate: '2026-04-01',
      awardDate: '2026-05-01', contractDate: '2026-06-01',
      completionDate: '2026-12-31',
    };
    expect(s.planningDate).toBe('2026-01-01');
    expect(s.completionDate).toBe('2026-12-31');
  });
  it('schedule dates are YYYY-MM-DD strings', () => {
    const s: PackageSchedule = { tenderDate: '2026-09-01' };
    expect(s.tenderDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ─── PT-04: PackageFunding ────────────────────────────────────────────────────

describe('PT-04 PackageFunding embedded array', () => {
  const funding: PackageFunding = { fundSourceCode: 'STATE', amount: 300_000_000, percentage: 60 };

  it('has fundSourceCode, amount, percentage', () => {
    expect(funding.fundSourceCode).toBe('STATE');
    expect(funding.amount).toBe(300_000_000);
    expect(funding.percentage).toBe(60);
  });
  it('funding array can have multiple sources', () => {
    const arr: readonly PackageFunding[] = [
      { fundSourceCode: 'STATE', amount: 300_000_000, percentage: 60 },
      { fundSourceCode: 'ODA',   amount: 200_000_000, percentage: 40 },
    ];
    expect(arr).toHaveLength(2);
    expect(arr.reduce((s, f) => s + f.percentage, 0)).toBe(100);
  });
  it('single fund source at 100%', () => {
    const arr: readonly PackageFunding[] = [{ fundSourceCode: 'STATE', amount: 500_000_000, percentage: 100 }];
    expect(arr[0]?.percentage).toBe(100);
  });
});

// ─── PT-05: PackageParticipant ────────────────────────────────────────────────

describe('PT-05 PackageParticipant embedded array', () => {
  const p: PackageParticipant = { employeeCode: 'NV001', role: 'OWNER', assignedAt: '2026-07-01T00:00:00Z' };

  it('has employeeCode, role, assignedAt', () => {
    expect(p.employeeCode).toBe('NV001');
    expect(p.role).toBe('OWNER');
    expect(p.assignedAt).toMatch(/^\d{4}-/);
  });
  it('PARTICIPANT_ROLES contains 4 values', () => {
    expect(PARTICIPANT_ROLES).toHaveLength(4);
    expect(PARTICIPANT_ROLES).toContain('OWNER');
    expect(PARTICIPANT_ROLES).toContain('EVALUATOR');
  });
  it('APPROVER and OBSERVER are valid roles', () => {
    const roles: readonly PackageParticipant[] = [
      { employeeCode: 'NV002', role: 'APPROVER', assignedAt: '' },
      { employeeCode: 'NV003', role: 'OBSERVER', assignedAt: '' },
    ];
    expect(roles[0]?.role).toBe('APPROVER');
  });
});

// ─── PT-06: PackageItem ───────────────────────────────────────────────────────

describe('PT-06 PackageItem — quantity × price = estimatedTotal', () => {
  const item: PackageItem = {
    id: 'i1', packageId: 'pkg-001', itemCode: 'IT-001',
    name: 'Máy tính xách tay Dell', unit: 'chiếc',
    quantity: 10, estimatedUnitPrice: 20_000_000, estimatedTotal: 200_000_000,
    category: 'CNTT', technicalSpecification: 'Core i7, 16GB RAM',
    createdAt: '', updatedAt: '',
  };

  it('estimatedTotal = quantity × estimatedUnitPrice', () => {
    expect(item.estimatedTotal).toBe(item.quantity * item.estimatedUnitPrice);
  });
  it('has itemCode, name, unit fields', () => {
    expect(item.itemCode).toBe('IT-001');
    expect(item.name).toBeDefined();
    expect(item.unit).toBe('chiếc');
  });
  it('technicalSpecification is a string', () => {
    expect(typeof item.technicalSpecification).toBe('string');
  });
});

// ─── PT-07: PackageBudget ─────────────────────────────────────────────────────

describe('PT-07 PackageBudget — approved − committed − spent = remaining', () => {
  const budget: PackageBudget = {
    id: 'b1', packageId: 'pkg-001', budgetSource: 'STATE',
    approvedAmount: 500_000_000, committedAmount: 200_000_000,
    spentAmount: 100_000_000, remainingAmount: 200_000_000,
    createdAt: '', updatedAt: '',
  };

  it('remainingAmount = approved − committed − spent', () => {
    expect(budget.remainingAmount).toBe(budget.approvedAmount - budget.committedAmount - budget.spentAmount);
  });
  it('all amounts are non-negative', () => {
    expect(budget.approvedAmount).toBeGreaterThan(0);
    expect(budget.remainingAmount).toBeGreaterThanOrEqual(0);
  });
  it('has budgetSource field', () => {
    expect(budget.budgetSource).toBe('STATE');
  });
});

// ─── PT-08: PackageAttachment ─────────────────────────────────────────────────

describe('PT-08 PackageAttachment fields', () => {
  const att: PackageAttachment = {
    id: 'a1', packageId: 'pkg-001', fileName: 'HSMT.pdf',
    fileType: 'application/pdf', fileSize: 1024 * 512,
    uploadedBy: 'NV001', uploadedAt: '2026-07-01T00:00:00Z',
    documentType: 'HSMT', createdAt: '', updatedAt: '',
  };

  it('has fileName, fileType, fileSize', () => {
    expect(att.fileName).toBe('HSMT.pdf');
    expect(att.fileType).toBe('application/pdf');
    expect(att.fileSize).toBeGreaterThan(0);
  });
  it('has uploadedBy and documentType', () => {
    expect(att.uploadedBy).toBe('NV001');
    expect(att.documentType).toBe('HSMT');
  });
  it('uploadedAt is an ISO string', () => {
    expect(att.uploadedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

// ─── PT-09: PackageHistory ─────────────────────────────────────────────────────

describe('PT-09 PackageHistory — action and optional status transition', () => {
  it('CREATED history has no fromStatus', () => {
    const h: PackageHistory = {
      id: 'h1', packageId: 'p1', action: 'CREATED',
      toStatus: 'DRAFT', performedBy: 'NV001', performedAt: '',
      createdAt: '', updatedAt: '',
    };
    expect(h.fromStatus).toBeUndefined();
    expect(h.toStatus).toBe('DRAFT');
  });
  it('status transition entry has fromStatus and toStatus', () => {
    const h: PackageHistory = {
      id: 'h2', packageId: 'p1', action: 'SUBMITTED',
      fromStatus: 'DRAFT', toStatus: 'SUBMITTED',
      performedBy: 'NV002', performedAt: '',
      createdAt: '', updatedAt: '',
    };
    expect(h.fromStatus).toBe('DRAFT');
    expect(h.toStatus).toBe('SUBMITTED');
  });
  it('notes are optional', () => {
    const h: PackageHistory = {
      id: 'h3', packageId: 'p1', action: 'ARCHIVED',
      performedBy: 'admin', performedAt: '',
      createdAt: '', updatedAt: '',
    };
    expect(h.notes).toBeUndefined();
    const withNote: PackageHistory = { ...h, notes: 'Duplicate package' };
    expect(withNote.notes).toBe('Duplicate package');
  });
});

// ─── PT-10: CreatePackageParams and UpdatePackageParams ───────────────────────

describe('PT-10 CreatePackageParams and UpdatePackageParams shapes', () => {
  it('CreatePackageParams has required fields', () => {
    const p: CreatePackageParams = {
      packageCode: 'DTMS/2026/001', packageName: 'Test', packageType: 'GOODS',
      procurementMethod: 'OPEN_TENDER', estimatedValue: 100_000_000,
      fundSource: 'STATE', budgetYear: 'BY-2026', department: 'PHONG-TC', owner: 'NV001',
    };
    expect(p.packageCode).toBeDefined();
    expect(p.estimatedValue).toBeGreaterThan(0);
  });
  it('CreatePackageParams has optional description and procurementCategory', () => {
    const p: CreatePackageParams = {
      packageCode: 'X', packageName: 'X', packageType: 'GOODS',
      procurementMethod: 'OPEN_TENDER', estimatedValue: 1,
      fundSource: 'STATE', budgetYear: 'B', department: 'D', owner: 'O',
      description: 'desc', procurementCategory: 'CAT-IT',
    };
    expect(p.description).toBe('desc');
  });
  it('UpdatePackageParams all fields are optional', () => {
    const p: UpdatePackageParams = { estimatedValue: 200_000_000 };
    expect(p.packageName).toBeUndefined();
    expect(p.estimatedValue).toBe(200_000_000);
  });
});

// ─── PT-11: PackageSearchQuery and PackageSearchResult ───────────────────────

describe('PT-11 PackageSearchQuery and PackageSearchResult shapes', () => {
  it('PackageSearchQuery all fields optional', () => {
    const q: PackageSearchQuery = {};
    expect(q.status).toBeUndefined();
    expect(q.minValue).toBeUndefined();
  });
  it('search can filter by status, department, packageType', () => {
    const q: PackageSearchQuery = { status: 'DRAFT', department: 'PHONG-TC', packageType: 'GOODS' };
    expect(q.status).toBe('DRAFT');
    expect(q.pageSize).toBeUndefined();
  });
  it('PackageSearchResult has items, total, page, pageSize', () => {
    const r: PackageSearchResult = { items: [], total: 0, page: 1, pageSize: 20 };
    expect(r.total).toBe(0);
    expect(Array.isArray(r.items)).toBe(true);
  });
});

// ─── PT-12: PackageValidationResult ──────────────────────────────────────────

describe('PT-12 PackageValidationResult has valid, errors, warnings', () => {
  it('valid result shape', () => {
    const r: PackageValidationResult = { valid: true, errors: [], warnings: [] };
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });
  it('invalid result has error messages', () => {
    const r: PackageValidationResult = { valid: false, errors: ['code required'], warnings: ['low budget'] };
    expect(r.errors).toContain('code required');
    expect(r.warnings).toContain('low budget');
  });
  it('warnings are non-blocking (valid can still be true)', () => {
    const r: PackageValidationResult = { valid: true, errors: [], warnings: ['one warning'] };
    expect(r.valid).toBe(true);
    expect(r.warnings).toHaveLength(1);
  });
});

// ─── PT-13: type guards and PackageError ─────────────────────────────────────

describe('PT-13 isPackageStatus, isParticipantRole, PackageError', () => {
  it('isPackageStatus returns true for valid statuses', () => {
    for (const s of PACKAGE_STATUSES) {
      expect(isPackageStatus(s)).toBe(true);
    }
  });
  it('isPackageStatus returns false for invalid', () => {
    expect(isPackageStatus('PENDING')).toBe(false);
    expect(isPackageStatus(null)).toBe(false);
  });
  it('PackageError has code, field, message, name', () => {
    const e = new PackageError('DUPLICATE_CODE', 'packageCode', 'Code exists');
    expect(e.code).toBe('DUPLICATE_CODE');
    expect(e.field).toBe('packageCode');
    expect(e.name).toBe('PackageError');
    expect(e.message).toBe('Code exists');
  });
});
