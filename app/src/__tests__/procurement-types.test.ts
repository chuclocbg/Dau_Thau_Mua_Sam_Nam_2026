/**
 * Procurement domain types and type guards
 *
 * Groups (13 × 3 = 39):
 *   PT-01  PACKAGE_TYPES — 5 Vietnamese package categories
 *   PT-02  PROCUREMENT_METHODS — 7 methods from Điều 21 Luật 22/2023
 *   PT-03  APPROVAL_AUTHORITIES — 4 authority levels
 *   PT-04  FUND_SOURCES + RULE_OPERATORS constants
 *   PT-05  isPackageType — type guard
 *   PT-06  isProcurementMethod — type guard
 *   PT-07  isApprovalAuthority — type guard
 *   PT-08  LegalBasis — required + optional fields
 *   PT-09  RuleCondition — field/operator/value shape
 *   PT-10  ProcurementCase — all fields
 *   PT-11  ProcurementDecision — full output shape
 *   PT-12  PackageClassification + ThresholdDecision
 *   PT-13  MethodDecision + ApprovalDecision
 */

import { describe, it, expect } from 'vitest';
import {
  PACKAGE_TYPES,
  PROCUREMENT_METHODS,
  PROCUREMENT_METHOD_NAMES,
  APPROVAL_AUTHORITIES,
  APPROVAL_AUTHORITY_NAMES,
  FUND_SOURCES,
  RULE_OPERATORS,
  isPackageType,
  isProcurementMethod,
  isApprovalAuthority,
  type LegalBasis,
  type RuleCondition,
  type ProcurementCase,
  type ProcurementDecision,
  type PackageClassification,
  type ThresholdDecision,
  type MethodDecision,
  type ApprovalDecision,
} from '../procurement/domain/procurementTypes';

// ─── PT-01: PACKAGE_TYPES ─────────────────────────────────────────────────────

describe('PT-01 PACKAGE_TYPES contains all 5 Vietnamese package categories', () => {
  it('has 5 entries', () => {
    expect(PACKAGE_TYPES).toHaveLength(5);
  });
  it('contains GOODS and CONSTRUCTION', () => {
    expect(PACKAGE_TYPES).toContain('GOODS');
    expect(PACKAGE_TYPES).toContain('CONSTRUCTION');
  });
  it('contains SERVICE, CONSULTING, MIXED', () => {
    expect(PACKAGE_TYPES).toContain('SERVICE');
    expect(PACKAGE_TYPES).toContain('CONSULTING');
    expect(PACKAGE_TYPES).toContain('MIXED');
  });
});

// ─── PT-02: PROCUREMENT_METHODS ──────────────────────────────────────────────

describe('PT-02 PROCUREMENT_METHODS — 7 methods from Điều 21 Luật 22/2023', () => {
  it('has exactly 7 entries', () => {
    expect(PROCUREMENT_METHODS).toHaveLength(7);
  });
  it('contains OPEN_TENDER and DIRECT_APPOINTMENT', () => {
    expect(PROCUREMENT_METHODS).toContain('OPEN_TENDER');
    expect(PROCUREMENT_METHODS).toContain('DIRECT_APPOINTMENT');
  });
  it('PROCUREMENT_METHOD_NAMES has a Vietnamese name for every method', () => {
    for (const m of PROCUREMENT_METHODS) {
      expect(typeof PROCUREMENT_METHOD_NAMES[m]).toBe('string');
      expect(PROCUREMENT_METHOD_NAMES[m].length).toBeGreaterThan(0);
    }
  });
});

// ─── PT-03: APPROVAL_AUTHORITIES ─────────────────────────────────────────────

describe('PT-03 APPROVAL_AUTHORITIES — 4 authority levels', () => {
  it('has 4 entries', () => {
    expect(APPROVAL_AUTHORITIES).toHaveLength(4);
  });
  it('contains UNIT_HEAD and PRIME_MINISTER', () => {
    expect(APPROVAL_AUTHORITIES).toContain('UNIT_HEAD');
    expect(APPROVAL_AUTHORITIES).toContain('PRIME_MINISTER');
  });
  it('APPROVAL_AUTHORITY_NAMES has Vietnamese name for each authority', () => {
    for (const a of APPROVAL_AUTHORITIES) {
      expect(typeof APPROVAL_AUTHORITY_NAMES[a]).toBe('string');
    }
  });
});

// ─── PT-04: FUND_SOURCES + RULE_OPERATORS ────────────────────────────────────

describe('PT-04 FUND_SOURCES and RULE_OPERATORS constants', () => {
  it('FUND_SOURCES has 4 entries including STATE and ODA', () => {
    expect(FUND_SOURCES).toHaveLength(4);
    expect(FUND_SOURCES).toContain('STATE');
    expect(FUND_SOURCES).toContain('ODA');
  });
  it('RULE_OPERATORS has 7 entries', () => {
    expect(RULE_OPERATORS).toHaveLength(7);
  });
  it('RULE_OPERATORS contains LT, GTE, IN, NOT_IN', () => {
    expect(RULE_OPERATORS).toContain('LT');
    expect(RULE_OPERATORS).toContain('GTE');
    expect(RULE_OPERATORS).toContain('IN');
    expect(RULE_OPERATORS).toContain('NOT_IN');
  });
});

// ─── PT-05: isPackageType ─────────────────────────────────────────────────────

describe('PT-05 isPackageType type guard', () => {
  it('returns true for all 5 valid package types', () => {
    expect(PACKAGE_TYPES.every(t => isPackageType(t))).toBe(true);
  });
  it('returns false for unknown or lowercase string', () => {
    expect(isPackageType('goods')).toBe(false);
    expect(isPackageType('UNKNOWN')).toBe(false);
  });
  it('returns false for null and number', () => {
    expect(isPackageType(null)).toBe(false);
    expect(isPackageType(42)).toBe(false);
  });
});

// ─── PT-06: isProcurementMethod ───────────────────────────────────────────────

describe('PT-06 isProcurementMethod type guard', () => {
  it('returns true for all 7 valid methods', () => {
    expect(PROCUREMENT_METHODS.every(m => isProcurementMethod(m))).toBe(true);
  });
  it('returns false for partial or lowercase match', () => {
    expect(isProcurementMethod('OPEN')).toBe(false);
    expect(isProcurementMethod('open_tender')).toBe(false);
  });
  it('returns false for null and undefined', () => {
    expect(isProcurementMethod(null)).toBe(false);
    expect(isProcurementMethod(undefined)).toBe(false);
  });
});

// ─── PT-07: isApprovalAuthority ───────────────────────────────────────────────

describe('PT-07 isApprovalAuthority type guard', () => {
  it('returns true for all 4 valid authorities', () => {
    expect(APPROVAL_AUTHORITIES.every(a => isApprovalAuthority(a))).toBe(true);
  });
  it('returns false for invalid strings', () => {
    expect(isApprovalAuthority('PRESIDENT')).toBe(false);
    expect(isApprovalAuthority('')).toBe(false);
  });
  it('returns false for non-string', () => {
    expect(isApprovalAuthority(0)).toBe(false);
    expect(isApprovalAuthority(undefined)).toBe(false);
  });
});

// ─── PT-08: LegalBasis ────────────────────────────────────────────────────────

describe('PT-08 LegalBasis document + article required; clause/point optional', () => {
  it('minimal legal basis has document and article', () => {
    const lb: LegalBasis = { document: '22/2023/QH15', article: 'Điều 22' };
    expect(lb.document).toBe('22/2023/QH15');
    expect(lb.article).toBe('Điều 22');
  });
  it('full legal basis includes clause and point', () => {
    const lb: LegalBasis = {
      document: '22/2023/QH15', article: 'Điều 23',
      clause: 'khoản 1', point: 'điểm a',
    };
    expect(lb.clause).toBe('khoản 1');
    expect(lb.point).toBe('điểm a');
  });
  it('clause and point are undefined when omitted', () => {
    const lb: LegalBasis = { document: '214/2025/NĐ-CP', article: 'Điều 56' };
    expect(lb.clause).toBeUndefined();
    expect(lb.point).toBeUndefined();
  });
});

// ─── PT-09: RuleCondition ────────────────────────────────────────────────────

describe('PT-09 RuleCondition field/operator/value shape', () => {
  it('numeric LTE condition uses number value', () => {
    const c: RuleCondition = { field: 'estimatedValue', operator: 'LTE', value: 50_000_000 };
    expect(c.operator).toBe('LTE');
    expect(typeof c.value).toBe('number');
  });
  it('IN condition accepts string array value', () => {
    const c: RuleCondition = { field: 'packageType', operator: 'IN', value: ['GOODS', 'SERVICE'] };
    expect(Array.isArray(c.value)).toBe(true);
    expect(c.value).toContain('GOODS');
  });
  it('EQ condition can use boolean value', () => {
    const c: RuleCondition = { field: 'isUrgent', operator: 'EQ', value: true };
    expect(c.value).toBe(true);
  });
});

// ─── PT-10: ProcurementCase ───────────────────────────────────────────────────

describe('PT-10 ProcurementCase has all required fields', () => {
  const pkg: ProcurementCase = {
    id: 'case-001', packageType: 'GOODS', estimatedValue: 50_000_000,
    fundSource: 'STATE', isUrgent: false, isNationalSec: false,
    isInternational: false, asOfDate: '2026-07-01',
  };

  it('has id, packageType, estimatedValue', () => {
    expect(pkg.id).toBe('case-001');
    expect(pkg.packageType).toBe('GOODS');
    expect(pkg.estimatedValue).toBe(50_000_000);
  });
  it('has fundSource, isUrgent, isNationalSec, isInternational', () => {
    expect(pkg.fundSource).toBe('STATE');
    expect(pkg.isUrgent).toBe(false);
    expect(pkg.isNationalSec).toBe(false);
    expect(pkg.isInternational).toBe(false);
  });
  it('singleSource is optional (undefined by default)', () => {
    expect(pkg.singleSource).toBeUndefined();
    const withSingle: ProcurementCase = { ...pkg, singleSource: true };
    expect(withSingle.singleSource).toBe(true);
  });
});

// ─── PT-11: ProcurementDecision ───────────────────────────────────────────────

describe('PT-11 ProcurementDecision has all 9 output fields', () => {
  const d: ProcurementDecision = {
    caseId: 'c1',
    packageClassification: {
      packageType: 'GOODS', category: 'Hàng hóa', description: 'test',
      legalBasis: { document: '22/2023/QH15', article: 'Điều 4' },
    },
    threshold: {
      value: 50_000_000, band: 'DIRECT', bandName: 'Mua sắm trực tiếp',
      currency: 'VND', legalBasis: { document: '22/2023/QH15', article: 'Điều 26' },
    },
    method: {
      method: 'DIRECT_PROCUREMENT', methodName: 'Mua sắm trực tiếp',
      legalBasis: { document: '22/2023/QH15', article: 'Điều 26' }, exceptions: [],
    },
    approval: {
      authority: 'UNIT_HEAD', authorityName: 'Người đứng đầu',
      legalBasis: { document: '214/2025/NĐ-CP', article: 'Điều 76' },
    },
    legalDocuments: ['22/2023/QH15'], workflow: ['Bước 1'],
    evaluations: [], asOfDate: '2026-07-01',
  };

  it('caseId and asOfDate are strings', () => {
    expect(typeof d.caseId).toBe('string');
    expect(typeof d.asOfDate).toBe('string');
  });
  it('legalDocuments, workflow, evaluations are arrays', () => {
    expect(Array.isArray(d.legalDocuments)).toBe(true);
    expect(Array.isArray(d.workflow)).toBe(true);
    expect(Array.isArray(d.evaluations)).toBe(true);
  });
  it('has all six capability sub-objects', () => {
    expect(d.packageClassification).toBeTruthy();
    expect(d.threshold).toBeTruthy();
    expect(d.method).toBeTruthy();
    expect(d.approval).toBeTruthy();
  });
});

// ─── PT-12: PackageClassification + ThresholdDecision ─────────────────────────

describe('PT-12 PackageClassification and ThresholdDecision shapes', () => {
  it('PackageClassification packageType matches PACKAGE_TYPES', () => {
    const pc: PackageClassification = {
      packageType: 'CONSTRUCTION', category: 'Xây lắp',
      description: 'Xây dựng công trình', legalBasis: { document: '22/2023/QH15', article: 'Điều 4' },
    };
    expect(isPackageType(pc.packageType)).toBe(true);
  });
  it('ThresholdDecision currency is always "VND"', () => {
    const td: ThresholdDecision = {
      value: 200_000_000, band: 'OPEN_TENDER', bandName: 'Đấu thầu rộng rãi',
      currency: 'VND', legalBasis: { document: '22/2023/QH15', article: 'Điều 22' },
    };
    expect(td.currency).toBe('VND');
  });
  it('ThresholdDecision band is a non-empty string', () => {
    const td: ThresholdDecision = {
      value: 30_000_000, band: 'DIRECT', bandName: 'Mua sắm trực tiếp',
      currency: 'VND', legalBasis: { document: '22/2023/QH15', article: 'Điều 26' },
    };
    expect(td.band.length).toBeGreaterThan(0);
  });
});

// ─── PT-13: MethodDecision + ApprovalDecision ─────────────────────────────────

describe('PT-13 MethodDecision and ApprovalDecision shapes', () => {
  it('MethodDecision.method is a valid ProcurementMethod', () => {
    const md: MethodDecision = {
      method: 'COMPETITIVE_QUOTE', methodName: 'Chào hàng cạnh tranh',
      legalBasis: { document: '22/2023/QH15', article: 'Điều 25' }, exceptions: [],
    };
    expect(isProcurementMethod(md.method)).toBe(true);
  });
  it('MethodDecision.exceptions is an array (empty or with descriptions)', () => {
    const md: MethodDecision = {
      method: 'DIRECT_APPOINTMENT', methodName: 'Chỉ định thầu (khẩn cấp)',
      legalBasis: { document: '22/2023/QH15', article: 'Điều 23' },
      exceptions: ['Chỉ định thầu (khẩn cấp)'],
    };
    expect(md.exceptions).toHaveLength(1);
  });
  it('ApprovalDecision.authority is a valid ApprovalAuthority', () => {
    const ad: ApprovalDecision = {
      authority: 'MINISTER', authorityName: 'Bộ trưởng',
      legalBasis: { document: '214/2025/NĐ-CP', article: 'Điều 77' },
    };
    expect(isApprovalAuthority(ad.authority)).toBe(true);
  });
});
