/**
 * Procurement rule evaluator and rule definitions
 *
 * Groups (13 × 3 = 39):
 *   PR-01  testCondition — LT and LTE operators
 *   PR-02  testCondition — GT and GTE operators
 *   PR-03  testCondition — EQ operator (string, number, boolean)
 *   PR-04  testCondition — IN and NOT_IN operators
 *   PR-05  testCondition — undefined field returns false
 *   PR-06  evaluateRuleSpec — all conditions pass → matched=true
 *   PR-07  evaluateRuleSpec — one condition fails → matched=false
 *   PR-08  evaluateRuleSpec — applicableTo filter
 *   PR-09  evaluateRuleSpec — effectiveFrom / effectiveTo filter
 *   PR-10  findMatchingRule — returns first matching rule by priority
 *   PR-11  THRESHOLD_RULES — 8 rules covering all package types
 *   PR-12  METHOD_RULES — covers DIRECT/COMPETITIVE/OPEN for all types
 *   PR-13  EXCEPTION_RULES — urgent, singleSource, nationalSec exceptions
 */

import { describe, it, expect } from 'vitest';
import {
  testCondition,
  evaluateRuleSpec,
  findMatchingRule,
  findAllMatchingRules,
  THRESHOLD_RULES,
  METHOD_RULES,
  EXCEPTION_RULES,
} from '../procurement/rules/procurementRules';
import type { ProcurementCase, ProcurementRuleSpec } from '../procurement/domain/procurementTypes';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BASE_CASE: ProcurementCase = {
  id: 'case-001', packageType: 'GOODS', estimatedValue: 100_000_000,
  fundSource: 'STATE', isUrgent: false, isNationalSec: false,
  isInternational: false, singleSource: false, asOfDate: '2026-07-01',
};

const SMALL_CASE: ProcurementCase = { ...BASE_CASE, estimatedValue: 30_000_000 };
const LARGE_CASE: ProcurementCase = { ...BASE_CASE, estimatedValue: 500_000_000 };
const URGENT_CASE: ProcurementCase = { ...BASE_CASE, estimatedValue: 2_000_000_000, isUrgent: true };
const CONSTRUCTION_SMALL: ProcurementCase = { ...BASE_CASE, packageType: 'CONSTRUCTION', estimatedValue: 80_000_000 };
const CONSULTING_SMALL:   ProcurementCase = { ...BASE_CASE, packageType: 'CONSULTING', estimatedValue: 30_000_000 };

// ─── PR-01: testCondition — LT / LTE ─────────────────────────────────────────

describe('PR-01 testCondition LT and LTE operators', () => {
  it('LT: 30M < 50M → true', () => {
    expect(testCondition({ field: 'estimatedValue', operator: 'LT', value: 50_000_000 }, SMALL_CASE)).toBe(true);
  });
  it('LT: 50M < 50M → false (strict less-than)', () => {
    const at = { ...BASE_CASE, estimatedValue: 50_000_000 };
    expect(testCondition({ field: 'estimatedValue', operator: 'LT', value: 50_000_000 }, at)).toBe(false);
  });
  it('LTE: 50M <= 50M → true (inclusive)', () => {
    const at = { ...BASE_CASE, estimatedValue: 50_000_000 };
    expect(testCondition({ field: 'estimatedValue', operator: 'LTE', value: 50_000_000 }, at)).toBe(true);
  });
});

// ─── PR-02: testCondition — GT / GTE ─────────────────────────────────────────

describe('PR-02 testCondition GT and GTE operators', () => {
  it('GT: 500M > 200M → true', () => {
    expect(testCondition({ field: 'estimatedValue', operator: 'GT', value: 200_000_000 }, LARGE_CASE)).toBe(true);
  });
  it('GT: 200M > 200M → false (strict greater-than)', () => {
    const at = { ...BASE_CASE, estimatedValue: 200_000_000 };
    expect(testCondition({ field: 'estimatedValue', operator: 'GT', value: 200_000_000 }, at)).toBe(false);
  });
  it('GTE: 200M >= 200M → true (inclusive)', () => {
    const at = { ...BASE_CASE, estimatedValue: 200_000_000 };
    expect(testCondition({ field: 'estimatedValue', operator: 'GTE', value: 200_000_000 }, at)).toBe(true);
  });
});

// ─── PR-03: testCondition — EQ ───────────────────────────────────────────────

describe('PR-03 testCondition EQ operator', () => {
  it('EQ: packageType "GOODS" === "GOODS" → true', () => {
    expect(testCondition({ field: 'packageType', operator: 'EQ', value: 'GOODS' }, BASE_CASE)).toBe(true);
  });
  it('EQ: packageType "GOODS" === "SERVICE" → false', () => {
    expect(testCondition({ field: 'packageType', operator: 'EQ', value: 'SERVICE' }, BASE_CASE)).toBe(false);
  });
  it('EQ: isUrgent false === false → true', () => {
    expect(testCondition({ field: 'isUrgent', operator: 'EQ', value: false }, BASE_CASE)).toBe(true);
  });
});

// ─── PR-04: testCondition — IN / NOT_IN ──────────────────────────────────────

describe('PR-04 testCondition IN and NOT_IN operators', () => {
  it('IN: packageType "GOODS" in ["GOODS", "SERVICE"] → true', () => {
    expect(testCondition({ field: 'packageType', operator: 'IN', value: ['GOODS', 'SERVICE'] }, BASE_CASE)).toBe(true);
  });
  it('IN: packageType "GOODS" in ["CONSULTING"] → false', () => {
    expect(testCondition({ field: 'packageType', operator: 'IN', value: ['CONSULTING'] }, BASE_CASE)).toBe(false);
  });
  it('NOT_IN: packageType "GOODS" not in ["CONSULTING", "CONSTRUCTION"] → true', () => {
    expect(testCondition({ field: 'packageType', operator: 'NOT_IN', value: ['CONSULTING', 'CONSTRUCTION'] }, BASE_CASE)).toBe(true);
  });
});

// ─── PR-05: testCondition — undefined field ───────────────────────────────────

describe('PR-05 testCondition returns false for undefined/missing field', () => {
  it('field "nonexistent" → false regardless of operator', () => {
    expect(testCondition({ field: 'nonexistent', operator: 'EQ', value: 'x' }, BASE_CASE)).toBe(false);
  });
  it('field "singleSource" undefined → false for EQ true', () => {
    const noSingle = { ...BASE_CASE, singleSource: undefined };
    expect(testCondition({ field: 'singleSource', operator: 'EQ', value: true }, noSingle as ProcurementCase)).toBe(false);
  });
  it('non-number field with LT operator → false', () => {
    expect(testCondition({ field: 'packageType', operator: 'LT', value: 100 }, BASE_CASE)).toBe(false);
  });
});

// ─── PR-06: evaluateRuleSpec — all pass ───────────────────────────────────────

describe('PR-06 evaluateRuleSpec returns matched=true when all conditions pass', () => {
  const spec: ProcurementRuleSpec = {
    id: 'TEST-001', category: 'THRESHOLD', name: 'Test', description: 'Test rule',
    legalBasis: [{ document: '22/2023/QH15', article: 'Điều 26' }],
    effectiveFrom: '2024-01-01', effectiveTo: null, priority: 10,
    applicableTo: ['GOODS'],
    conditions: [{ field: 'estimatedValue', operator: 'LTE', value: 50_000_000 }],
    exceptions: [], output: { band: 'DIRECT' }, examples: [],
  };

  it('evaluates matched=true for SMALL_CASE', () => {
    expect(evaluateRuleSpec(spec, SMALL_CASE).matched).toBe(true);
  });
  it('output contains band=DIRECT', () => {
    expect(evaluateRuleSpec(spec, SMALL_CASE).output).toMatchObject({ band: 'DIRECT' });
  });
  it('reason is "All conditions met"', () => {
    expect(evaluateRuleSpec(spec, SMALL_CASE).reason).toContain('All conditions met');
  });
});

// ─── PR-07: evaluateRuleSpec — condition fails ────────────────────────────────

describe('PR-07 evaluateRuleSpec returns matched=false when condition fails', () => {
  const spec: ProcurementRuleSpec = {
    id: 'TEST-002', category: 'THRESHOLD', name: 'Test', description: 'Test',
    legalBasis: [{ document: '22/2023/QH15', article: 'Điều 26' }],
    effectiveFrom: '2024-01-01', effectiveTo: null, priority: 10,
    applicableTo: [],
    conditions: [{ field: 'estimatedValue', operator: 'LTE', value: 50_000_000 }],
    exceptions: [], output: {}, examples: [],
  };

  it('BASE_CASE (100M) fails LTE 50M condition', () => {
    expect(evaluateRuleSpec(spec, BASE_CASE).matched).toBe(false);
  });
  it('reason mentions the failed field', () => {
    expect(evaluateRuleSpec(spec, BASE_CASE).reason).toContain('estimatedValue');
  });
  it('output is empty on failure', () => {
    expect(Object.keys(evaluateRuleSpec(spec, BASE_CASE).output)).toHaveLength(0);
  });
});

// ─── PR-08: evaluateRuleSpec — applicableTo filter ───────────────────────────

describe('PR-08 evaluateRuleSpec applicableTo filters by package type', () => {
  const goodsOnly: ProcurementRuleSpec = {
    id: 'TEST-003', category: 'METHOD', name: 'Goods only', description: '',
    legalBasis: [{ document: '22/2023/QH15', article: 'Điều 22' }],
    effectiveFrom: '2024-01-01', effectiveTo: null, priority: 10,
    applicableTo: ['GOODS'],
    conditions: [], exceptions: [], output: { method: 'OPEN_TENDER' }, examples: [],
  };

  it('GOODS case matches goods-only rule', () => {
    expect(evaluateRuleSpec(goodsOnly, BASE_CASE).matched).toBe(true);
  });
  it('CONSULTING case does not match goods-only rule', () => {
    expect(evaluateRuleSpec(goodsOnly, CONSULTING_SMALL).matched).toBe(false);
  });
  it('empty applicableTo matches any package type', () => {
    const anyType = { ...goodsOnly, applicableTo: [] as const };
    expect(evaluateRuleSpec(anyType, CONSULTING_SMALL).matched).toBe(true);
  });
});

// ─── PR-09: evaluateRuleSpec — effective period ───────────────────────────────

describe('PR-09 evaluateRuleSpec effective date filtering', () => {
  const futureRule: ProcurementRuleSpec = {
    id: 'TEST-004', category: 'METHOD', name: 'Future', description: '',
    legalBasis: [{ document: '22/2023/QH15', article: 'Điều 22' }],
    effectiveFrom: '2030-01-01', effectiveTo: null, priority: 10,
    applicableTo: [], conditions: [], exceptions: [], output: { method: 'OPEN_TENDER' }, examples: [],
  };
  const expiredRule: ProcurementRuleSpec = {
    ...futureRule, id: 'TEST-005',
    effectiveFrom: '2024-01-01', effectiveTo: '2025-01-01',
  };

  it('rule not yet effective → matched=false', () => {
    expect(evaluateRuleSpec(futureRule, BASE_CASE).matched).toBe(false);
  });
  it('expired rule → matched=false', () => {
    expect(evaluateRuleSpec(expiredRule, BASE_CASE).matched).toBe(false);
  });
  it('rule in effect → matched=true', () => {
    const inEffect = { ...futureRule, effectiveFrom: '2024-01-01' };
    expect(evaluateRuleSpec(inEffect, BASE_CASE).matched).toBe(true);
  });
});

// ─── PR-10: findMatchingRule — priority order ─────────────────────────────────

describe('PR-10 findMatchingRule returns first matching rule by priority', () => {
  it('returns lowest-priority-number rule when both match', () => {
    const rules: ProcurementRuleSpec[] = [
      { id: 'R-20', category: 'METHOD', name: 'R-20', description: '', priority: 20,
        legalBasis: [{ document: '22/2023/QH15', article: 'Điều 22' }],
        effectiveFrom: '2024-01-01', effectiveTo: null, applicableTo: [], conditions: [],
        exceptions: [], output: { method: 'OPEN_TENDER' }, examples: [] },
      { id: 'R-10', category: 'METHOD', name: 'R-10', description: '', priority: 10,
        legalBasis: [{ document: '22/2023/QH15', article: 'Điều 22' }],
        effectiveFrom: '2024-01-01', effectiveTo: null, applicableTo: [], conditions: [],
        exceptions: [], output: { method: 'DIRECT_PROCUREMENT' }, examples: [] },
    ];
    expect(findMatchingRule(BASE_CASE, rules)!.id).toBe('R-10');
  });
  it('returns null when no rule matches', () => {
    expect(findMatchingRule(BASE_CASE, [])).toBeNull();
  });
  it('findAllMatchingRules returns all matching rules sorted by priority', () => {
    const rules: ProcurementRuleSpec[] = [
      { id: 'R-A', category: 'METHOD', name: '', description: '', priority: 20,
        legalBasis: [{ document: '22/2023/QH15', article: 'Điều 22' }],
        effectiveFrom: '2024-01-01', effectiveTo: null, applicableTo: [], conditions: [],
        exceptions: [], output: {}, examples: [] },
      { id: 'R-B', category: 'METHOD', name: '', description: '', priority: 5,
        legalBasis: [{ document: '22/2023/QH15', article: 'Điều 22' }],
        effectiveFrom: '2024-01-01', effectiveTo: null, applicableTo: [], conditions: [],
        exceptions: [], output: {}, examples: [] },
    ];
    const all = findAllMatchingRules(BASE_CASE, rules);
    expect(all[0]!.id).toBe('R-B');
    expect(all[1]!.id).toBe('R-A');
  });
});

// ─── PR-11: THRESHOLD_RULES — 8 rules ────────────────────────────────────────

describe('PR-11 THRESHOLD_RULES has 8 rules covering all package types', () => {
  it('has 8 threshold rule definitions', () => {
    expect(THRESHOLD_RULES).toHaveLength(8);
  });
  it('goods small case (30M) matches a DIRECT band rule', () => {
    const match = findMatchingRule(SMALL_CASE, THRESHOLD_RULES);
    expect(match?.output.band).toBe('DIRECT');
  });
  it('construction large case (2B) matches OPEN_TENDER band', () => {
    const bigConstruction: ProcurementCase = { ...BASE_CASE, packageType: 'CONSTRUCTION', estimatedValue: 2_000_000_000 };
    const match = findMatchingRule(bigConstruction, THRESHOLD_RULES);
    expect(match?.output.band).toBe('OPEN_TENDER');
  });
});

// ─── PR-12: METHOD_RULES — coverage ──────────────────────────────────────────

describe('PR-12 METHOD_RULES covers DIRECT/COMPETITIVE/OPEN for all types', () => {
  it('GOODS 30M → DIRECT_PROCUREMENT method', () => {
    const match = findMatchingRule(SMALL_CASE, METHOD_RULES);
    expect(match?.output.method).toBe('DIRECT_PROCUREMENT');
  });
  it('GOODS 100M → COMPETITIVE_QUOTE method', () => {
    const match = findMatchingRule(BASE_CASE, METHOD_RULES);
    expect(match?.output.method).toBe('COMPETITIVE_QUOTE');
  });
  it('CONSTRUCTION 80M → DIRECT_PROCUREMENT (xây lắp)', () => {
    const match = findMatchingRule(CONSTRUCTION_SMALL, METHOD_RULES);
    expect(match?.output.method).toBe('DIRECT_PROCUREMENT');
  });
});

// ─── PR-13: EXCEPTION_RULES ──────────────────────────────────────────────────

describe('PR-13 EXCEPTION_RULES — urgent, singleSource, nationalSec', () => {
  it('has 3 exception rules', () => {
    expect(EXCEPTION_RULES).toHaveLength(3);
  });
  it('URGENT_CASE matches PR-EXC-001 exception', () => {
    const match = findMatchingRule(URGENT_CASE, EXCEPTION_RULES);
    expect(match?.id).toBe('PR-EXC-001');
  });
  it('singleSource case matches PR-EXC-002 exception', () => {
    const single: ProcurementCase = { ...BASE_CASE, singleSource: true };
    const match = findMatchingRule(single, EXCEPTION_RULES);
    expect(match?.id).toBe('PR-EXC-002');
  });
});
