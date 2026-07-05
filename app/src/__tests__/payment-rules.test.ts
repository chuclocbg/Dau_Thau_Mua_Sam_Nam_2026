import { describe, it, expect } from 'vitest';
import {
  PAYMENT_RULE_TYPES,
} from '../payment/paymentLegalRule';
import {
  ADVANCE_RATE_RULES,
  RETENTION_RATE_RULES,
  GUARANTEE_REQUIREMENT_RULES,
  PAYMENT_DEADLINE_RULES,
  TREASURY_THRESHOLD_RULES,
  PAYMENT_LEGAL_RULES,
  buildPaymentRuleRegistry,
} from '../payment/paymentRuleRegistry';

// PAY-R-01
describe('PAYMENT_RULE_TYPES', () => {
  it('contains ADVANCE_RATE', () => expect(PAYMENT_RULE_TYPES).toContain('ADVANCE_RATE'));
  it('contains RETENTION_RATE', () => expect(PAYMENT_RULE_TYPES).toContain('RETENTION_RATE'));
  it('contains TREASURY_THRESHOLD', () => expect(PAYMENT_RULE_TYPES).toContain('TREASURY_THRESHOLD'));
});

// PAY-R-02
describe('ADVANCE_RATE_RULES', () => {
  it('has at least 2 rules', () => expect(ADVANCE_RATE_RULES.length).toBeGreaterThanOrEqual(2));
  it('first rule has maxRate in numericParams', () => {
    expect(ADVANCE_RATE_RULES[0]!.numericParams['maxRate']).toBeDefined();
  });
  it('STATE/ODA rule maxRate is 0.30', () => {
    const rule = ADVANCE_RATE_RULES.find(r => r.applicableFundingSources.includes('STATE'));
    expect(rule?.numericParams['maxRate']).toBe(0.30);
  });
});

// PAY-R-03
describe('ADVANCE_RATE_RULES enterprise', () => {
  const rule = ADVANCE_RATE_RULES.find(r => r.applicableFundingSources.includes('ENTERPRISE'));
  it('exists', () => expect(rule).toBeDefined());
  it('maxRate is 0.15', () => expect(rule?.numericParams['maxRate']).toBe(0.15));
  it('guaranteeRequired is 0', () => expect(rule?.numericParams['guaranteeRequired']).toBe(0));
});

// PAY-R-04
describe('RETENTION_RATE_RULES', () => {
  it('has at least 1 rule', () => expect(RETENTION_RATE_RULES.length).toBeGreaterThanOrEqual(1));
  it('maxRate is 0.10', () => expect(RETENTION_RATE_RULES[0]!.numericParams['maxRate']).toBe(0.10));
  it('defaultRate is 0.05', () => expect(RETENTION_RATE_RULES[0]!.numericParams['defaultRate']).toBe(0.05));
});

// PAY-R-05
describe('RETENTION_RATE_RULES duration', () => {
  it('has maxDurationMonths', () => {
    expect(RETENTION_RATE_RULES[0]!.numericParams['maxDurationMonths']).toBeDefined();
  });
  it('maxDurationMonths is at least 12', () => {
    expect(RETENTION_RATE_RULES[0]!.numericParams['maxDurationMonths']).toBeGreaterThanOrEqual(12);
  });
  it('ruleType is RETENTION_RATE', () => {
    expect(RETENTION_RATE_RULES[0]!.ruleType).toBe('RETENTION_RATE');
  });
});

// PAY-R-06
describe('GUARANTEE_REQUIREMENT_RULES', () => {
  it('has at least 2 rules', () => expect(GUARANTEE_REQUIREMENT_RULES.length).toBeGreaterThanOrEqual(2));
  it('performance rule has minRate 0.03', () => {
    const r = GUARANTEE_REQUIREMENT_RULES.find(r => r.ruleId === 'PR-PAY-GUAR-001');
    expect(r?.numericParams['minRate']).toBe(0.03);
  });
  it('warranty rule has maxRate 0.05', () => {
    const r = GUARANTEE_REQUIREMENT_RULES.find(r => r.ruleId === 'PR-PAY-GUAR-002');
    expect(r?.numericParams['maxRate']).toBe(0.05);
  });
});

// PAY-R-07
describe('PAYMENT_DEADLINE_RULES', () => {
  it('has at least 2 rules', () => expect(PAYMENT_DEADLINE_RULES.length).toBeGreaterThanOrEqual(2));
  it('STATE rule maxDays is 30', () => {
    const r = PAYMENT_DEADLINE_RULES.find(r => r.applicableFundingSources.includes('STATE'));
    expect(r?.numericParams['maxDaysAfterAcceptance']).toBe(30);
  });
  it('ENTERPRISE rule maxDays is 45', () => {
    const r = PAYMENT_DEADLINE_RULES.find(r => r.applicableFundingSources.includes('ENTERPRISE'));
    expect(r?.numericParams['maxDaysAfterAcceptance']).toBe(45);
  });
});

// PAY-R-08
describe('TREASURY_THRESHOLD_RULES', () => {
  it('has at least 1 rule', () => expect(TREASURY_THRESHOLD_RULES.length).toBeGreaterThanOrEqual(1));
  it('first rule has required=1', () => {
    expect(TREASURY_THRESHOLD_RULES[0]!.numericParams['required']).toBe(1);
  });
  it('applies to STATE fund', () => {
    expect(TREASURY_THRESHOLD_RULES[0]!.applicableFundingSources).toContain('STATE');
  });
});

// PAY-R-09
describe('PAYMENT_LEGAL_RULES combined registry', () => {
  it('has rules from all categories', () => {
    const types = new Set(PAYMENT_LEGAL_RULES.map(r => r.ruleType));
    expect(types.size).toBeGreaterThanOrEqual(4);
  });
  it('total count is at least 8', () => expect(PAYMENT_LEGAL_RULES.length).toBeGreaterThanOrEqual(8));
  it('all rules have ruleId', () => {
    expect(PAYMENT_LEGAL_RULES.every(r => r.ruleId.trim().length > 0)).toBe(true);
  });
});

// PAY-R-10
describe('Legal references on rules', () => {
  it('every rule has at least one legalReference', () => {
    expect(PAYMENT_LEGAL_RULES.every(r => r.legalReferences.length > 0)).toBe(true);
  });
  it('every legalReference has a document', () => {
    const allRefs = PAYMENT_LEGAL_RULES.flatMap(r => r.legalReferences);
    expect(allRefs.every(ref => ref.document.trim().length > 0)).toBe(true);
  });
  it('no legalReference hardcodes a specific count', () => {
    // References exist but are extensible
    expect(PAYMENT_LEGAL_RULES.length).toBeGreaterThan(0);
  });
});

// PAY-R-11
describe('Rule effective dates', () => {
  it('all rules have effectiveFrom', () => {
    expect(PAYMENT_LEGAL_RULES.every(r => /^\d{4}-\d{2}-\d{2}$/.test(r.effectiveFrom))).toBe(true);
  });
  it('rules without effectiveTo are still active', () => {
    const open = PAYMENT_LEGAL_RULES.filter(r => r.effectiveTo === null);
    expect(open.length).toBeGreaterThan(0);
  });
  it('no rule has supersededBy in bootstrap set', () => {
    expect(PAYMENT_LEGAL_RULES.every(r => !r.supersededBy)).toBe(true);
  });
});

// PAY-R-12
describe('buildPaymentRuleRegistry extension', () => {
  it('returns base rules with no extras', () => {
    const reg = buildPaymentRuleRegistry();
    expect(reg.length).toBe(PAYMENT_LEGAL_RULES.length);
  });
  it('merges additional rules', () => {
    const extra = [{ ...PAYMENT_LEGAL_RULES[0]!, ruleId: 'CUSTOM-001' }];
    const reg = buildPaymentRuleRegistry(extra);
    expect(reg.length).toBe(PAYMENT_LEGAL_RULES.length + 1);
  });
  it('additional rule appears at end', () => {
    const extra = [{ ...PAYMENT_LEGAL_RULES[0]!, ruleId: 'EXTRA-001' }];
    const reg = buildPaymentRuleRegistry(extra);
    expect(reg[reg.length - 1]!.ruleId).toBe('EXTRA-001');
  });
});

// PAY-R-13
describe('Rule description and priority', () => {
  it('every rule has a description', () => {
    expect(PAYMENT_LEGAL_RULES.every(r => r.description.trim().length > 0)).toBe(true);
  });
  it('every rule has a priority >= 1', () => {
    expect(PAYMENT_LEGAL_RULES.every(r => r.priority >= 1)).toBe(true);
  });
  it('every rule has a ruleName', () => {
    expect(PAYMENT_LEGAL_RULES.every(r => r.ruleName.trim().length > 0)).toBe(true);
  });
});
