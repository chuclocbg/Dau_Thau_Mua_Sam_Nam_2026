import { describe, it, expect } from 'vitest';
import {
  validateCreatePaymentRequestParams,
  validateAdvanceAmount,
  validateRetentionRate,
  validateGuaranteeRate,
  validatePaymentDeadline,
  requiresTreasurySubmission,
  validateStatusTransition,
  validatePaymentRequest,
  buildRuleContext,
} from '../payment/paymentValidation';
import { createMoney } from '../shared/financial/money';

const vnd = (n: number) => createMoney(BigInt(n), 'VND');
const contract100m = vnd(100_000_000);
const today = '2026-07-01';

// PAY-V-01
describe('validateCreatePaymentRequestParams — valid', () => {
  const valid = {
    requestCode: 'PR-001', paymentType: 'ADVANCE' as const,
    contractId: 'C-001', requestedBy: 'user1', department: 'DEPT',
    amount: vnd(10_000_000),
  };
  it('returns valid=true', () => expect(validateCreatePaymentRequestParams(valid).valid).toBe(true));
  it('has no errors', () => expect(validateCreatePaymentRequestParams(valid).errors.length).toBe(0));
  it('uses PROCUREMENT_LEGAL_BASIS default', () => {
    const r = validateCreatePaymentRequestParams(valid);
    expect(r.legalBasis.length).toBeGreaterThan(0);
  });
});

// PAY-V-02
describe('validateCreatePaymentRequestParams — invalid', () => {
  it('errors on empty requestCode', () => {
    const r = validateCreatePaymentRequestParams({
      requestCode: '', paymentType: 'ADVANCE', contractId: 'C', requestedBy: 'u', department: 'D', amount: vnd(1),
    });
    expect(r.valid).toBe(false);
  });
  it('errors on empty contractId', () => {
    const r = validateCreatePaymentRequestParams({
      requestCode: 'PR', paymentType: 'ADVANCE', contractId: '', requestedBy: 'u', department: 'D', amount: vnd(1),
    });
    expect(r.valid).toBe(false);
  });
  it('errors on zero amount', () => {
    const r = validateCreatePaymentRequestParams({
      requestCode: 'PR', paymentType: 'ADVANCE', contractId: 'C', requestedBy: 'u', department: 'D', amount: vnd(0),
    });
    expect(r.valid).toBe(false);
  });
});

// PAY-V-03
describe('validateAdvanceAmount — STATE fund', () => {
  it('accepts 30% of contract value', () => {
    const r = validateAdvanceAmount({
      amount: vnd(30_000_000), contractValue: contract100m,
      packageType: 'GOODS', fundSource: 'STATE', asOfDate: today,
    });
    expect(r.valid).toBe(true);
  });
  it('rejects 31% of contract value', () => {
    const r = validateAdvanceAmount({
      amount: vnd(31_000_000), contractValue: contract100m,
      packageType: 'GOODS', fundSource: 'STATE', asOfDate: today,
    });
    expect(r.valid).toBe(false);
  });
  it('returns resolvedRuleId', () => {
    const r = validateAdvanceAmount({
      amount: vnd(10_000_000), contractValue: contract100m,
      packageType: 'GOODS', fundSource: 'STATE', asOfDate: today,
    });
    expect(r.resolvedRule).toBeDefined();
  });
});

// PAY-V-04
describe('validateAdvanceAmount — ENTERPRISE fund', () => {
  it('accepts 15% of contract value', () => {
    const r = validateAdvanceAmount({
      amount: vnd(15_000_000), contractValue: contract100m,
      packageType: 'GOODS', fundSource: 'ENTERPRISE', asOfDate: today,
    });
    expect(r.valid).toBe(true);
  });
  it('rejects 16% of contract value', () => {
    const r = validateAdvanceAmount({
      amount: vnd(16_000_000), contractValue: contract100m,
      packageType: 'GOODS', fundSource: 'ENTERPRISE', asOfDate: today,
    });
    expect(r.valid).toBe(false);
  });
  it('has lower maxRate than STATE', () => {
    const entRule = validateAdvanceAmount({
      amount: vnd(20_000_000), contractValue: contract100m,
      packageType: 'GOODS', fundSource: 'ENTERPRISE', asOfDate: today,
    });
    expect(entRule.valid).toBe(false);
  });
});

// PAY-V-05
describe('validateRetentionRate', () => {
  it('accepts 5% retention', () => {
    const r = validateRetentionRate({ rate: 0.05, packageType: 'GOODS', fundSource: 'STATE', asOfDate: today });
    expect(r.valid).toBe(true);
  });
  it('rejects 11% retention', () => {
    const r = validateRetentionRate({ rate: 0.11, packageType: 'GOODS', fundSource: 'STATE', asOfDate: today });
    expect(r.valid).toBe(false);
  });
  it('rejects negative rate', () => {
    const r = validateRetentionRate({ rate: -0.01, packageType: 'GOODS', fundSource: 'STATE', asOfDate: today });
    expect(r.valid).toBe(false);
  });
});

// PAY-V-06
describe('validateGuaranteeRate — PERFORMANCE', () => {
  it('accepts 5% performance guarantee', () => {
    const r = validateGuaranteeRate({ guaranteeType: 'PERFORMANCE', rate: 0.05, packageType: 'GOODS', fundSource: 'STATE', asOfDate: today });
    expect(r.valid).toBe(true);
  });
  it('rejects 11% performance guarantee', () => {
    const r = validateGuaranteeRate({ guaranteeType: 'PERFORMANCE', rate: 0.11, packageType: 'GOODS', fundSource: 'STATE', asOfDate: today });
    expect(r.valid).toBe(false);
  });
  it('rejects 1% performance guarantee (below min)', () => {
    const r = validateGuaranteeRate({ guaranteeType: 'PERFORMANCE', rate: 0.01, packageType: 'GOODS', fundSource: 'STATE', asOfDate: today });
    expect(r.valid).toBe(false);
  });
});

// PAY-V-07
describe('validatePaymentDeadline — STATE', () => {
  it('accepts 29 days', () => {
    const r = validatePaymentDeadline({ daysSinceAcceptance: 29, packageType: 'GOODS', fundSource: 'STATE', asOfDate: today });
    expect(r.valid).toBe(true);
  });
  it('rejects 31 days for STATE', () => {
    const r = validatePaymentDeadline({ daysSinceAcceptance: 31, packageType: 'GOODS', fundSource: 'STATE', asOfDate: today });
    expect(r.valid).toBe(false);
  });
  it('accepts 44 days for ENTERPRISE', () => {
    const r = validatePaymentDeadline({ daysSinceAcceptance: 44, packageType: 'GOODS', fundSource: 'ENTERPRISE', asOfDate: today });
    expect(r.valid).toBe(true);
  });
});

// PAY-V-08
describe('requiresTreasurySubmission', () => {
  it('returns true for STATE', () => {
    expect(requiresTreasurySubmission({ fundSource: 'STATE', packageType: 'GOODS', asOfDate: today })).toBe(true);
  });
  it('returns true for ODA', () => {
    expect(requiresTreasurySubmission({ fundSource: 'ODA', packageType: 'GOODS', asOfDate: today })).toBe(true);
  });
  it('returns false for ENTERPRISE', () => {
    expect(requiresTreasurySubmission({ fundSource: 'ENTERPRISE', packageType: 'GOODS', asOfDate: today })).toBe(false);
  });
});

// PAY-V-09
describe('validateStatusTransition — allowed', () => {
  it('DRAFT → PENDING_APPROVAL allowed', () => {
    expect(validateStatusTransition('DRAFT', 'PENDING_APPROVAL').valid).toBe(true);
  });
  it('APPROVED → SUBMITTED_TREASURY allowed', () => {
    expect(validateStatusTransition('APPROVED', 'SUBMITTED_TREASURY').valid).toBe(true);
  });
  it('TREASURY_APPROVED → PAID allowed', () => {
    expect(validateStatusTransition('TREASURY_APPROVED', 'PAID').valid).toBe(true);
  });
});

// PAY-V-10
describe('validateStatusTransition — blocked', () => {
  it('DRAFT → PAID blocked', () => {
    expect(validateStatusTransition('DRAFT', 'PAID').valid).toBe(false);
  });
  it('PAID → CANCELLED blocked', () => {
    expect(validateStatusTransition('PAID', 'CANCELLED').valid).toBe(false);
  });
  it('CANCELLED → APPROVED blocked', () => {
    expect(validateStatusTransition('CANCELLED', 'APPROVED').valid).toBe(false);
  });
});

// PAY-V-11
describe('validatePaymentRequest', () => {
  const validReq = {
    id: 'r1', requestCode: 'PR-001', paymentType: 'ADVANCE' as const,
    contractId: 'C1', requestedBy: 'u1', requestedAt: new Date().toISOString(),
    department: 'D1', amount: vnd(1_000_000), legalBasis: [],
    status: 'DRAFT' as const, createdAt: '', updatedAt: '',
  };
  it('valid request passes', () => expect(validatePaymentRequest(validReq).valid).toBe(true));
  it('missing requestCode fails', () => {
    expect(validatePaymentRequest({ ...validReq, requestCode: '' }).valid).toBe(false);
  });
  it('zero amount fails', () => {
    expect(validatePaymentRequest({ ...validReq, amount: vnd(0) }).valid).toBe(false);
  });
});

// PAY-V-12
describe('buildRuleContext', () => {
  it('builds context with required fields', () => {
    const ctx = buildRuleContext('GOODS', 'STATE', '2026-07-01');
    expect(ctx.packageType).toBe('GOODS');
  });
  it('includes fundSource', () => {
    const ctx = buildRuleContext('GOODS', 'ODA', '2026-07-01');
    expect(ctx.fundSource).toBe('ODA');
  });
  it('includes optional authority', () => {
    const ctx = buildRuleContext('GOODS', 'STATE', '2026-07-01', 'UNIT_HEAD');
    expect(ctx.authority).toBe('UNIT_HEAD');
  });
});

// PAY-V-13
describe('Validation uses rule engine (no hardcoded values)', () => {
  it('custom rule overrides maxRate', () => {
    const customRules = [{
      ruleId: 'CUSTOM', ruleName: 'Custom', ruleType: 'ADVANCE_RATE' as const,
      legalReferences: [], effectiveFrom: '2000-01-01', effectiveTo: null,
      applicablePackageTypes: [], applicableFundingSources: ['STATE'],
      applicableAuthorities: [], numericParams: { maxRate: 0.10, minRate: 0, guaranteeRequired: 0 },
      conditions: [{ field: 'fundSource', operator: 'IN' as const, value: ['STATE'] }],
      priority: 1, description: 'Custom 10% rule',
    }];
    const r = validateAdvanceAmount({
      amount: vnd(11_000_000), contractValue: contract100m,
      packageType: 'GOODS', fundSource: 'STATE', asOfDate: today, rules: customRules,
    });
    expect(r.valid).toBe(false);  // 11% exceeds custom max of 10%
  });
  it('custom rule allows higher rate', () => {
    const customRules = [{
      ruleId: 'CUSTOM2', ruleName: 'Custom2', ruleType: 'ADVANCE_RATE' as const,
      legalReferences: [], effectiveFrom: '2000-01-01', effectiveTo: null,
      applicablePackageTypes: [], applicableFundingSources: ['STATE'],
      applicableAuthorities: [], numericParams: { maxRate: 0.50, minRate: 0, guaranteeRequired: 0 },
      conditions: [{ field: 'fundSource', operator: 'IN' as const, value: ['STATE'] }],
      priority: 1, description: 'Custom 50% rule',
    }];
    const r = validateAdvanceAmount({
      amount: vnd(40_000_000), contractValue: contract100m,
      packageType: 'GOODS', fundSource: 'STATE', asOfDate: today, rules: customRules,
    });
    expect(r.valid).toBe(true);
  });
  it('validation returns legalBasis from rule', () => {
    const r = validateAdvanceAmount({
      amount: vnd(20_000_000), contractValue: contract100m,
      packageType: 'GOODS', fundSource: 'STATE', asOfDate: today,
    });
    expect(r.legalBasis.length).toBeGreaterThan(0);
  });
});
