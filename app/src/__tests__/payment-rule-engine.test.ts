import { describe, it, expect } from 'vitest';
import {
  testPaymentCondition, matchesPaymentRule, resolvePaymentRule,
  resolveAllPaymentRules, isRulePresentlyEffective,
} from '../payment/paymentLegalRule';
import type { PaymentLegalRule, PaymentRuleContext } from '../payment/paymentLegalRule';
import {
  PAYMENT_LEGAL_RULES, ADVANCE_RATE_RULES,
} from '../payment/paymentRuleRegistry';
import { createLegalBasis } from '../shared/financial/financialFactory';

const stateCtx: PaymentRuleContext = {
  packageType: 'GOODS', fundSource: 'STATE', asOfDate: '2026-07-01',
};
const entCtx: PaymentRuleContext = {
  packageType: 'SERVICE', fundSource: 'ENTERPRISE', asOfDate: '2026-07-01',
};

// PAY-RE-01
describe('testPaymentCondition — EQ', () => {
  it('matches equal string', () => {
    expect(testPaymentCondition({ field: 'fundSource', operator: 'EQ', value: 'STATE' }, { fundSource: 'STATE' })).toBe(true);
  });
  it('fails non-equal string', () => {
    expect(testPaymentCondition({ field: 'fundSource', operator: 'EQ', value: 'ODA' }, { fundSource: 'STATE' })).toBe(false);
  });
  it('fails missing field', () => {
    expect(testPaymentCondition({ field: 'missing', operator: 'EQ', value: 'X' }, {})).toBe(false);
  });
});

// PAY-RE-02
describe('testPaymentCondition — IN / NOT_IN', () => {
  it('IN matches', () => {
    expect(testPaymentCondition({ field: 'fundSource', operator: 'IN', value: ['STATE', 'ODA'] }, { fundSource: 'STATE' })).toBe(true);
  });
  it('NOT_IN matches when absent', () => {
    expect(testPaymentCondition({ field: 'fundSource', operator: 'NOT_IN', value: ['STATE'] }, { fundSource: 'ODA' })).toBe(true);
  });
  it('IN fails when absent', () => {
    expect(testPaymentCondition({ field: 'fundSource', operator: 'IN', value: ['ODA'] }, { fundSource: 'STATE' })).toBe(false);
  });
});

// PAY-RE-03
describe('testPaymentCondition — numeric', () => {
  it('LT matches', () => {
    expect(testPaymentCondition({ field: 'amount', operator: 'LT', value: 100 }, { amount: 50 })).toBe(true);
  });
  it('GTE matches', () => {
    expect(testPaymentCondition({ field: 'amount', operator: 'GTE', value: 100 }, { amount: 100 })).toBe(true);
  });
  it('GT fails equal', () => {
    expect(testPaymentCondition({ field: 'amount', operator: 'GT', value: 100 }, { amount: 100 })).toBe(false);
  });
});

// PAY-RE-04
describe('matchesPaymentRule — effective date', () => {
  const rule = ADVANCE_RATE_RULES[0]!;
  it('matches when asOfDate >= effectiveFrom', () => {
    expect(matchesPaymentRule(rule, stateCtx)).toBe(true);
  });
  it('fails when asOfDate < effectiveFrom', () => {
    const earlyCtx = { ...stateCtx, asOfDate: '2020-01-01' };
    expect(matchesPaymentRule(rule, earlyCtx)).toBe(false);
  });
  it('fails when supersededBy is set', () => {
    const superseded = { ...rule, supersededBy: 'NEWER-RULE' };
    expect(matchesPaymentRule(superseded, stateCtx)).toBe(false);
  });
});

// PAY-RE-04b (KI-010)
describe('isRulePresentlyEffective — date/supersession only, no packageType/fundSource/authority needed', () => {
  const rule = ADVANCE_RATE_RULES[0]!;
  it('true when asOfDate is within [effectiveFrom, effectiveTo)', () => {
    expect(isRulePresentlyEffective(rule, '2026-07-01')).toBe(true);
  });
  it('false when asOfDate < effectiveFrom', () => {
    expect(isRulePresentlyEffective(rule, '2020-01-01')).toBe(false);
  });
  it('false when asOfDate >= effectiveTo (non-null)', () => {
    const expired = { ...rule, effectiveTo: '2026-01-01' };
    expect(isRulePresentlyEffective(expired, '2026-07-01')).toBe(false);
  });
  it('true when effectiveTo is null (still in force) and asOfDate is well past effectiveFrom', () => {
    expect(rule.effectiveTo).toBeNull();
    expect(isRulePresentlyEffective(rule, '2030-01-01')).toBe(true);
  });
  it('false when supersededBy is set, regardless of date', () => {
    const superseded = { ...rule, supersededBy: 'NEWER-RULE' };
    expect(isRulePresentlyEffective(superseded, '2026-07-01')).toBe(false);
  });
  it('does not require packageType/fundSource/authority -- unlike matchesPaymentRule', () => {
    // rule.applicableFundingSources is ['STATE', 'ODA'] -- matchesPaymentRule would reject a
    // context with a non-matching fundSource, but isRulePresentlyEffective only checks dates.
    expect(isRulePresentlyEffective(rule, '2026-07-01')).toBe(true);
  });
});

// PAY-RE-05
describe('matchesPaymentRule — package type filter', () => {
  const constructionRule: PaymentLegalRule = {
    ...ADVANCE_RATE_RULES[0]!,
    ruleId: 'TEST-CONST',
    applicablePackageTypes: ['CONSTRUCTION'],
    conditions: [],
  };
  it('matches CONSTRUCTION context', () => {
    expect(matchesPaymentRule(constructionRule, { ...stateCtx, packageType: 'CONSTRUCTION' })).toBe(true);
  });
  it('fails GOODS context', () => {
    expect(matchesPaymentRule(constructionRule, stateCtx)).toBe(false);
  });
  it('empty applicablePackageTypes matches all', () => {
    const allTypes = { ...constructionRule, applicablePackageTypes: [] };
    expect(matchesPaymentRule(allTypes, stateCtx)).toBe(true);
  });
});

// PAY-RE-06
describe('matchesPaymentRule — fund source filter', () => {
  const odaOnly: PaymentLegalRule = {
    ...ADVANCE_RATE_RULES[0]!,
    ruleId: 'TEST-ODA',
    applicableFundingSources: ['ODA'],
    conditions: [{ field: 'fundSource', operator: 'EQ', value: 'ODA' }],
  };
  it('matches ODA context', () => {
    expect(matchesPaymentRule(odaOnly, { ...stateCtx, fundSource: 'ODA' })).toBe(true);
  });
  it('fails STATE context', () => {
    expect(matchesPaymentRule(odaOnly, stateCtx)).toBe(false);
  });
  it('empty applicableFundingSources matches all', () => {
    const allFunds = { ...odaOnly, applicableFundingSources: [], conditions: [] };
    expect(matchesPaymentRule(allFunds, stateCtx)).toBe(true);
  });
});

// PAY-RE-07
describe('resolvePaymentRule — ADVANCE_RATE STATE', () => {
  it('resolves for STATE fund', () => {
    const r = resolvePaymentRule('ADVANCE_RATE', stateCtx, PAYMENT_LEGAL_RULES);
    expect(r.resolved).toBe(true);
  });
  it('returns maxRate 0.30', () => {
    const r = resolvePaymentRule('ADVANCE_RATE', stateCtx, PAYMENT_LEGAL_RULES);
    expect(r.params['maxRate']).toBe(0.30);
  });
  it('returns legalBasis', () => {
    const r = resolvePaymentRule('ADVANCE_RATE', stateCtx, PAYMENT_LEGAL_RULES);
    expect(r.legalBasis.length).toBeGreaterThan(0);
  });
});

// PAY-RE-08
describe('resolvePaymentRule — ADVANCE_RATE ENTERPRISE', () => {
  it('resolves for ENTERPRISE fund', () => {
    const r = resolvePaymentRule('ADVANCE_RATE', entCtx, PAYMENT_LEGAL_RULES);
    expect(r.resolved).toBe(true);
  });
  it('returns maxRate 0.15', () => {
    const r = resolvePaymentRule('ADVANCE_RATE', entCtx, PAYMENT_LEGAL_RULES);
    expect(r.params['maxRate']).toBe(0.15);
  });
  it('guaranteeRequired is 0', () => {
    const r = resolvePaymentRule('ADVANCE_RATE', entCtx, PAYMENT_LEGAL_RULES);
    expect(r.params['guaranteeRequired']).toBe(0);
  });
});

// PAY-RE-09
describe('resolvePaymentRule — RETENTION_RATE', () => {
  it('resolves for any context', () => {
    const r = resolvePaymentRule('RETENTION_RATE', stateCtx, PAYMENT_LEGAL_RULES);
    expect(r.resolved).toBe(true);
  });
  it('maxRate is 0.10', () => {
    const r = resolvePaymentRule('RETENTION_RATE', stateCtx, PAYMENT_LEGAL_RULES);
    expect(r.params['maxRate']).toBe(0.10);
  });
  it('rule is not null', () => {
    const r = resolvePaymentRule('RETENTION_RATE', stateCtx, PAYMENT_LEGAL_RULES);
    expect(r.rule).not.toBeNull();
  });
});

// PAY-RE-10
describe('resolvePaymentRule — TREASURY_THRESHOLD', () => {
  it('resolves for STATE fund', () => {
    const r = resolvePaymentRule('TREASURY_THRESHOLD', stateCtx, PAYMENT_LEGAL_RULES);
    expect(r.resolved).toBe(true);
  });
  it('required is 1 for STATE', () => {
    const r = resolvePaymentRule('TREASURY_THRESHOLD', stateCtx, PAYMENT_LEGAL_RULES);
    expect(r.params['required']).toBe(1);
  });
  it('does not resolve for ENTERPRISE (no treasury)', () => {
    const r = resolvePaymentRule('TREASURY_THRESHOLD', entCtx, PAYMENT_LEGAL_RULES);
    expect(r.resolved).toBe(false);
  });
});

// PAY-RE-11
describe('resolvePaymentRule — no match', () => {
  it('returns resolved=false when no rules', () => {
    const r = resolvePaymentRule('ADVANCE_RATE', stateCtx, []);
    expect(r.resolved).toBe(false);
  });
  it('returns empty params', () => {
    const r = resolvePaymentRule('ADVANCE_RATE', stateCtx, []);
    expect(Object.keys(r.params).length).toBe(0);
  });
  it('returns empty legalBasis', () => {
    const r = resolvePaymentRule('ADVANCE_RATE', stateCtx, []);
    expect(r.legalBasis.length).toBe(0);
  });
});

// PAY-RE-12
describe('resolvePaymentRule — future law extension', () => {
  const newRule: PaymentLegalRule = {
    ruleId: 'FUTURE-001',
    ruleName: 'New Advance Rule',
    ruleType: 'ADVANCE_RATE',
    legalReferences: [createLegalBasis({ document: 'NĐ-99/2027/NĐ-CP', effectiveDate: '2027-01-01' })],
    effectiveFrom: '2027-01-01',
    effectiveTo: null,
    applicablePackageTypes: [],
    applicableFundingSources: ['STATE'],
    applicableAuthorities: [],
    numericParams: { maxRate: 0.25, minRate: 0, guaranteeRequired: 1 },
    conditions: [{ field: 'fundSource', operator: 'IN', value: ['STATE'] }],
    priority: 5,
    description: 'Future rule with lower advance rate',
  };
  const extendedCtx = { ...stateCtx, asOfDate: '2027-06-01' };

  it('future rule resolves when asOfDate matches', () => {
    const rules = [...PAYMENT_LEGAL_RULES, newRule];
    const r = resolvePaymentRule('ADVANCE_RATE', extendedCtx, rules);
    expect(r.resolved).toBe(true);
  });
  it('future rule overrides with higher priority (lower number)', () => {
    const rules = [...PAYMENT_LEGAL_RULES, newRule];
    const r = resolvePaymentRule('ADVANCE_RATE', extendedCtx, rules);
    expect(r.rule?.ruleId).toBe('FUTURE-001');
  });
  it('future rule does not affect 2026 context', () => {
    const rules = [...PAYMENT_LEGAL_RULES, newRule];
    const r = resolvePaymentRule('ADVANCE_RATE', stateCtx, rules);
    expect(r.rule?.ruleId).not.toBe('FUTURE-001');
  });
});

// PAY-RE-13
describe('resolveAllPaymentRules', () => {
  it('returns an object with all rule types as keys', () => {
    const all = resolveAllPaymentRules(stateCtx, PAYMENT_LEGAL_RULES);
    expect(Object.keys(all).length).toBeGreaterThanOrEqual(4);
  });
  it('ADVANCE_RATE is resolved', () => {
    const all = resolveAllPaymentRules(stateCtx, PAYMENT_LEGAL_RULES);
    expect(all['ADVANCE_RATE'].resolved).toBe(true);
  });
  it('unmatched types return resolved=false', () => {
    const all = resolveAllPaymentRules(stateCtx, PAYMENT_LEGAL_RULES);
    // BUDGET_COMMITMENT_LIMIT has no rules in bootstrap set
    expect(all['BUDGET_COMMITMENT_LIMIT'].resolved).toBe(false);
  });
});
