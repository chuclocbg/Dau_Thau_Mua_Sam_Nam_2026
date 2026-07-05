import { describe, it, expect } from 'vitest';
import {
  validateMoney, assertValidMoney, validateBudgetAllocation, validateFundingCommitment,
  validateGuaranteeRateResult, validateRetentionRateResult, validatePaymentMilestone,
  validateAdvanceRate, validateFiscalYear, validateLegalBasis, validateLegalBasisArray,
  MAX_ADVANCE_RATE,
} from '../shared/financial/financialValidation';
import { createMoney, zeroMoney, FinancialError } from '../shared/financial/money';
import type { BudgetAllocation } from '../shared/financial/budgetAllocation';
import type { FundingCommitment } from '../shared/financial/fundingSource';
import type { PaymentMilestone } from '../shared/financial/paymentSchedule';
import type { LegalBasis } from '../shared/financial/financialFactory';

function alloc(overrides: Partial<BudgetAllocation> = {}): BudgetAllocation {
  const total = createMoney(100n, 'VND');
  const now = new Date().toISOString();
  return { id: 'A1', allocationCode: 'BA/001', fiscalYear: 2026, fundSourceCode: 'STATE',
           departmentCode: 'DEPT-01', totalAmount: total, committedAmount: zeroMoney('VND'),
           reservedAmount: zeroMoney('VND'), availableAmount: total, legalBasis: [],
           createdAt: now, updatedAt: now, ...overrides };
}

function commit(overrides: Partial<FundingCommitment> = {}): FundingCommitment {
  const now = new Date().toISOString();
  return { id: 'C1', allocationId: 'BA-001', amount: createMoney(10n, 'VND'),
           committedAt: now, committedBy: 'U', status: 'ACTIVE',
           createdAt: now, updatedAt: now, ...overrides };
}

function milestone(overrides: Partial<PaymentMilestone> = {}): PaymentMilestone {
  return { id: 'M1', code: 'MS-01', description: 'Đợt 1', scheduledDate: '2026-08-01',
           dueAmount: createMoney(50n, 'VND'), status: 'PENDING', ...overrides };
}

// FIN-VAL-01
describe('validateMoney', () => {
  it('valid VND money returns valid=true', () => {
    expect(validateMoney(createMoney(100n, 'VND')).valid).toBe(true);
  });
  it('zero VND is valid', () => {
    expect(validateMoney(zeroMoney('VND')).valid).toBe(true);
  });
  it('invalid currency returns valid=false', () => {
    expect(validateMoney({ amount: 100n, currency: 'GBP' as never }).valid).toBe(false);
  });
});

// FIN-VAL-02
describe('assertValidMoney', () => {
  it('does not throw for valid money', () => {
    expect(() => assertValidMoney(createMoney(1n, 'VND'))).not.toThrow();
  });
  it('throws FinancialError for invalid currency', () => {
    expect(() => assertValidMoney({ amount: 1n, currency: 'XYZ' as never })).toThrow(FinancialError);
  });
  it('error code is INVALID_AMOUNT', () => {
    try { assertValidMoney({ amount: 1n, currency: 'XYZ' as never }); }
    catch (e) { expect((e as FinancialError).code).toBe('INVALID_AMOUNT'); }
  });
});

// FIN-VAL-03
describe('validateBudgetAllocation', () => {
  it('valid allocation returns valid=true', () => {
    expect(validateBudgetAllocation(alloc()).valid).toBe(true);
  });
  it('invalid when allocationCode empty', () => {
    expect(validateBudgetAllocation(alloc({ allocationCode: '' })).valid).toBe(false);
  });
  it('invalid when availableAmount negative', () => {
    expect(validateBudgetAllocation(alloc({ availableAmount: { amount: -1n, currency: 'VND' } })).valid).toBe(false);
  });
});

// FIN-VAL-04
describe('validateFundingCommitment', () => {
  it('valid commitment returns valid=true', () => {
    expect(validateFundingCommitment(commit()).valid).toBe(true);
  });
  it('invalid when allocationId empty', () => {
    expect(validateFundingCommitment(commit({ allocationId: '' })).valid).toBe(false);
  });
  it('invalid when amount is zero', () => {
    expect(validateFundingCommitment(commit({ amount: zeroMoney('VND') })).valid).toBe(false);
  });
});

// FIN-VAL-05
describe('validateGuaranteeRateResult', () => {
  it('PERFORMANCE 0.05 is valid', () => {
    expect(validateGuaranteeRateResult('PERFORMANCE', 0.05).valid).toBe(true);
  });
  it('PERFORMANCE 0.02 is invalid', () => {
    expect(validateGuaranteeRateResult('PERFORMANCE', 0.02).valid).toBe(false);
  });
  it('WARRANTY 0.04 is valid', () => {
    expect(validateGuaranteeRateResult('WARRANTY', 0.04).valid).toBe(true);
  });
});

// FIN-VAL-06
describe('validateRetentionRateResult', () => {
  it('0.05 is valid', () => {
    expect(validateRetentionRateResult(0.05).valid).toBe(true);
  });
  it('0.11 is invalid', () => {
    expect(validateRetentionRateResult(0.11).valid).toBe(false);
  });
  it('0.00 is valid', () => {
    expect(validateRetentionRateResult(0.00).valid).toBe(true);
  });
});

// FIN-VAL-07
describe('validatePaymentMilestone', () => {
  it('valid milestone returns valid=true', () => {
    expect(validatePaymentMilestone(milestone()).valid).toBe(true);
  });
  it('invalid when code empty', () => {
    expect(validatePaymentMilestone(milestone({ code: '' })).valid).toBe(false);
  });
  it('invalid when dueAmount is zero', () => {
    expect(validatePaymentMilestone(milestone({ dueAmount: zeroMoney('VND') })).valid).toBe(false);
  });
});

// FIN-VAL-08
describe('validateAdvanceRate', () => {
  it('0.30 is valid max', () => {
    expect(validateAdvanceRate(0.30).valid).toBe(true);
  });
  it('0.31 is invalid', () => {
    expect(validateAdvanceRate(0.31).valid).toBe(false);
  });
  it('0.00 is valid', () => {
    expect(validateAdvanceRate(0.00).valid).toBe(true);
  });
});

// FIN-VAL-09
describe('validateAdvanceRate — constant', () => {
  it('MAX_ADVANCE_RATE is 0.30', () => {
    expect(MAX_ADVANCE_RATE).toBe(0.30);
  });
  it('negative rate is invalid', () => {
    expect(validateAdvanceRate(-0.01).valid).toBe(false);
  });
  it('error message mentions TT 79', () => {
    expect(validateAdvanceRate(0.31).errors[0]).toContain('79');
  });
});

// FIN-VAL-10
describe('validateFiscalYear', () => {
  it('2026 is valid', () => {
    expect(validateFiscalYear(2026).valid).toBe(true);
  });
  it('1999 is invalid', () => {
    expect(validateFiscalYear(1999).valid).toBe(false);
  });
  it('non-integer is invalid', () => {
    expect(validateFiscalYear(2026.5).valid).toBe(false);
  });
});

// FIN-VAL-11
describe('validateLegalBasis', () => {
  it('valid basis returns valid=true', () => {
    const b: LegalBasis = { document: '22/2023/QH15' };
    expect(validateLegalBasis(b).valid).toBe(true);
  });
  it('empty document is invalid', () => {
    expect(validateLegalBasis({ document: '' }).valid).toBe(false);
  });
  it('document with whitespace-only is invalid', () => {
    expect(validateLegalBasis({ document: '   ' }).valid).toBe(false);
  });
});

// FIN-VAL-12
describe('validateLegalBasisArray', () => {
  it('empty array is valid', () => {
    expect(validateLegalBasisArray([]).valid).toBe(true);
  });
  it('array with valid bases is valid', () => {
    const bases: LegalBasis[] = [{ document: '22/2023/QH15' }, { document: '214/2025/NĐ-CP' }];
    expect(validateLegalBasisArray(bases).valid).toBe(true);
  });
  it('array with empty document is invalid', () => {
    expect(validateLegalBasisArray([{ document: '' }]).valid).toBe(false);
  });
});

// FIN-VAL-13
describe('ValidationResult — error messages', () => {
  it('errors array is empty for valid input', () => {
    expect(validateMoney(createMoney(1n, 'VND')).errors).toHaveLength(0);
  });
  it('errors array has message for invalid input', () => {
    expect(validateBudgetAllocation(alloc({ allocationCode: '' })).errors.length).toBeGreaterThan(0);
  });
  it('validateFundingCommitment errors include reason', () => {
    const r = validateFundingCommitment(commit({ allocationId: '' }));
    expect(r.errors[0]).toContain('allocationId');
  });
});
