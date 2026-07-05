import { describe, it, expect } from 'vitest';
import {
  createAdvancePaymentRequest, calculateMaxAdvanceAmount, isAdvanceGuaranteeRequired,
} from '../payment/paymentAdvanceService';
import {
  MemoryPaymentRequestRepository, MemoryPaymentHistoryRepository,
} from '../payment/paymentRepository';
import { createMoney } from '../shared/financial/money';
import type { PaymentLegalRule } from '../payment/paymentLegalRule';
import { PAYMENT_LEGAL_RULES } from '../payment/paymentRuleRegistry';

const vnd = (n: number) => createMoney(BigInt(n), 'VND');
const contract = vnd(100_000_000);
const today = '2026-07-01';

function repos() {
  return {
    req: new MemoryPaymentRequestRepository(),
    hist: new MemoryPaymentHistoryRepository(),
  };
}

// PAY-A-01
describe('createAdvancePaymentRequest — STATE 25%', () => {
  it('creates ADVANCE payment request', async () => {
    const { req, hist } = repos();
    const result = await createAdvancePaymentRequest(req, hist, {
      requestCode: 'PR-ADV-001', contractId: 'C-001', contractValue: contract,
      requestedBy: 'user1', department: 'D1',
      packageType: 'GOODS', fundSource: 'STATE', advanceRate: 0.25,
    });
    expect(result.request.paymentType).toBe('ADVANCE');
  });
  it('amount is 25% of contract', async () => {
    const { req, hist } = repos();
    const result = await createAdvancePaymentRequest(req, hist, {
      requestCode: 'PR-ADV-001', contractId: 'C-001', contractValue: contract,
      requestedBy: 'user1', department: 'D1',
      packageType: 'GOODS', fundSource: 'STATE', advanceRate: 0.25,
    });
    expect(result.advanceAmount.amount).toBe(25_000_000n);
  });
  it('stores resolvedRuleId', async () => {
    const { req, hist } = repos();
    const result = await createAdvancePaymentRequest(req, hist, {
      requestCode: 'PR-ADV-001', contractId: 'C-001', contractValue: contract,
      requestedBy: 'user1', department: 'D1',
      packageType: 'GOODS', fundSource: 'STATE', advanceRate: 0.25,
    });
    expect(result.request.resolvedRuleId).toBeDefined();
  });
});

// PAY-A-02
describe('createAdvancePaymentRequest — STATE rate enforcement', () => {
  it('rejects advance rate > 30%', async () => {
    const { req, hist } = repos();
    await expect(createAdvancePaymentRequest(req, hist, {
      requestCode: 'PR-ADV-X', contractId: 'C-001', contractValue: contract,
      requestedBy: 'user1', department: 'D1',
      packageType: 'GOODS', fundSource: 'STATE', advanceRate: 0.31,
    })).rejects.toMatchObject({ code: 'ADVANCE_RATE_EXCEEDED' });
  });
  it('accepts exactly 30%', async () => {
    const { req, hist } = repos();
    const result = await createAdvancePaymentRequest(req, hist, {
      requestCode: 'PR-ADV-MAX', contractId: 'C-001', contractValue: contract,
      requestedBy: 'user1', department: 'D1',
      packageType: 'GOODS', fundSource: 'STATE', advanceRate: 0.30,
    });
    expect(result.advanceAmount.amount).toBe(30_000_000n);
  });
  it('returned maxRate matches rule', async () => {
    const { req, hist } = repos();
    const result = await createAdvancePaymentRequest(req, hist, {
      requestCode: 'PR-ADV-001', contractId: 'C-001', contractValue: contract,
      requestedBy: 'user1', department: 'D1',
      packageType: 'GOODS', fundSource: 'STATE', advanceRate: 0.20,
    });
    expect(result.maxRate).toBe(0.30);
  });
});

// PAY-A-03
describe('createAdvancePaymentRequest — ENTERPRISE fund', () => {
  it('rejects advance rate > 15% for ENTERPRISE', async () => {
    const { req, hist } = repos();
    await expect(createAdvancePaymentRequest(req, hist, {
      requestCode: 'PR-ADV-ENT', contractId: 'C-001', contractValue: contract,
      requestedBy: 'user1', department: 'D1',
      packageType: 'GOODS', fundSource: 'ENTERPRISE', advanceRate: 0.16,
    })).rejects.toThrow();
  });
  it('accepts 15% for ENTERPRISE', async () => {
    const { req, hist } = repos();
    const result = await createAdvancePaymentRequest(req, hist, {
      requestCode: 'PR-ADV-ENT', contractId: 'C-001', contractValue: contract,
      requestedBy: 'user1', department: 'D1',
      packageType: 'GOODS', fundSource: 'ENTERPRISE', advanceRate: 0.15,
    });
    expect(result.advanceAmount.amount).toBe(15_000_000n);
  });
  it('returned maxRate is 0.15', async () => {
    const { req, hist } = repos();
    const result = await createAdvancePaymentRequest(req, hist, {
      requestCode: 'PR-ADV-ENT', contractId: 'C-001', contractValue: contract,
      requestedBy: 'user1', department: 'D1',
      packageType: 'GOODS', fundSource: 'ENTERPRISE', advanceRate: 0.10,
    });
    expect(result.maxRate).toBe(0.15);
  });
});

// PAY-A-04
describe('createAdvancePaymentRequest — legal basis', () => {
  it('uses resolved rule legalBasis', async () => {
    const { req, hist } = repos();
    const result = await createAdvancePaymentRequest(req, hist, {
      requestCode: 'PR-ADV-LB', contractId: 'C-001', contractValue: contract,
      requestedBy: 'user1', department: 'D1',
      packageType: 'GOODS', fundSource: 'STATE', advanceRate: 0.20,
    });
    expect(result.legalBasis.length).toBeGreaterThan(0);
  });
  it('custom legalBasis overrides resolved', async () => {
    const { req, hist } = repos();
    const custom = [{ document: 'CUSTOM', summary: 'x' }];
    const result = await createAdvancePaymentRequest(req, hist, {
      requestCode: 'PR-ADV-C', contractId: 'C-001', contractValue: contract,
      requestedBy: 'user1', department: 'D1',
      packageType: 'GOODS', fundSource: 'STATE', advanceRate: 0.10,
      legalBasis: custom,
    });
    expect(result.request.legalBasis[0]?.document).toBe('CUSTOM');
  });
  it('legalBasis stored in request', async () => {
    const { req, hist } = repos();
    const result = await createAdvancePaymentRequest(req, hist, {
      requestCode: 'PR-ADV-001', contractId: 'C-001', contractValue: contract,
      requestedBy: 'user1', department: 'D1',
      packageType: 'GOODS', fundSource: 'STATE', advanceRate: 0.10,
    });
    expect(Array.isArray(result.request.legalBasis)).toBe(true);
  });
});

// PAY-A-05
describe('createAdvancePaymentRequest — unknown fund source', () => {
  it('throws RULE_NOT_FOUND for unmapped fundSource', async () => {
    const { req, hist } = repos();
    await expect(createAdvancePaymentRequest(req, hist, {
      requestCode: 'PR-X', contractId: 'C', contractValue: contract,
      requestedBy: 'u', department: 'D',
      packageType: 'GOODS', fundSource: 'UNKNOWN_FUND', advanceRate: 0.10,
    })).rejects.toMatchObject({ code: 'RULE_NOT_FOUND' });
  });
  it('state request creates history', async () => {
    const { req, hist } = repos();
    await createAdvancePaymentRequest(req, hist, {
      requestCode: 'PR-H', contractId: 'C', contractValue: contract,
      requestedBy: 'u', department: 'D',
      packageType: 'GOODS', fundSource: 'STATE', advanceRate: 0.10,
    });
    const all = await hist.findAll();
    expect(all.length).toBeGreaterThan(0);
  });
  it('oda same maxRate as STATE', async () => {
    const { req, hist } = repos();
    const result = await createAdvancePaymentRequest(req, hist, {
      requestCode: 'PR-ODA', contractId: 'C', contractValue: contract,
      requestedBy: 'u', department: 'D',
      packageType: 'GOODS', fundSource: 'ODA', advanceRate: 0.30,
    });
    expect(result.maxRate).toBe(0.30);
  });
});

// PAY-A-06
describe('calculateMaxAdvanceAmount', () => {
  it('STATE fund returns 30% of contract', () => {
    const r = calculateMaxAdvanceAmount(contract, 'GOODS', 'STATE', today);
    expect(r.maxAmount.amount).toBe(30_000_000n);
  });
  it('ENTERPRISE fund returns 15% of contract', () => {
    const r = calculateMaxAdvanceAmount(contract, 'GOODS', 'ENTERPRISE', today);
    expect(r.maxAmount.amount).toBe(15_000_000n);
  });
  it('returns null ruleId when no rule', () => {
    const r = calculateMaxAdvanceAmount(contract, 'GOODS', 'UNKNOWN_FUND', today);
    expect(r.ruleId).toBeNull();
  });
});

// PAY-A-07
describe('isAdvanceGuaranteeRequired', () => {
  it('returns true for STATE fund', () => {
    expect(isAdvanceGuaranteeRequired('GOODS', 'STATE', today)).toBe(true);
  });
  it('returns false for ENTERPRISE fund', () => {
    expect(isAdvanceGuaranteeRequired('GOODS', 'ENTERPRISE', today)).toBe(false);
  });
  it('returns true for ODA fund', () => {
    expect(isAdvanceGuaranteeRequired('GOODS', 'ODA', today)).toBe(true);
  });
});

// PAY-A-08
describe('createAdvancePaymentRequest — injectable rules', () => {
  const customRule: PaymentLegalRule = {
    ruleId: 'TEST-ADV', ruleName: 'Test', ruleType: 'ADVANCE_RATE',
    legalReferences: [],
    effectiveFrom: '2000-01-01', effectiveTo: null,
    applicablePackageTypes: [], applicableFundingSources: [],
    applicableAuthorities: [],
    numericParams: { maxRate: 0.40, minRate: 0, guaranteeRequired: 0 },
    conditions: [],
    priority: 1, description: 'Test 40%',
  };
  it('uses injected rule over default', async () => {
    const { req, hist } = repos();
    const result = await createAdvancePaymentRequest(req, hist, {
      requestCode: 'PR-TEST', contractId: 'C', contractValue: contract,
      requestedBy: 'u', department: 'D',
      packageType: 'GOODS', fundSource: 'STATE', advanceRate: 0.35,
      rules: [customRule],
    });
    expect(result.maxRate).toBe(0.40);
  });
  it('injected rule allows higher advance rate', async () => {
    const { req, hist } = repos();
    const result = await createAdvancePaymentRequest(req, hist, {
      requestCode: 'PR-TEST2', contractId: 'C', contractValue: contract,
      requestedBy: 'u', department: 'D',
      packageType: 'GOODS', fundSource: 'STATE', advanceRate: 0.35,
      rules: [customRule],
    });
    expect(result.advanceAmount.amount).toBe(35_000_000n);
  });
  it('resolvedRuleId matches injected rule', async () => {
    const { req, hist } = repos();
    const result = await createAdvancePaymentRequest(req, hist, {
      requestCode: 'PR-TEST3', contractId: 'C', contractValue: contract,
      requestedBy: 'u', department: 'D',
      packageType: 'GOODS', fundSource: 'STATE', advanceRate: 0.10,
      rules: [customRule],
    });
    expect(result.resolvedRuleId).toBe('TEST-ADV');
  });
});

// PAY-A-09
describe('Advance amount precision (bigint)', () => {
  it('no floating-point rounding on large VND', () => {
    const bigContract = vnd(50_000_000_000);
    const r = calculateMaxAdvanceAmount(bigContract, 'GOODS', 'STATE', today);
    expect(r.maxAmount.amount).toBe(15_000_000_000n);
  });
  it('amount currency matches contract', async () => {
    const { req, hist } = repos();
    const result = await createAdvancePaymentRequest(req, hist, {
      requestCode: 'PR-CUR', contractId: 'C', contractValue: contract,
      requestedBy: 'u', department: 'D',
      packageType: 'GOODS', fundSource: 'STATE', advanceRate: 0.10,
    });
    expect(result.advanceAmount.currency).toBe('VND');
  });
  it('requestCode stored on request', async () => {
    const { req, hist } = repos();
    const result = await createAdvancePaymentRequest(req, hist, {
      requestCode: 'PR-CODE-TEST', contractId: 'C', contractValue: contract,
      requestedBy: 'u', department: 'D',
      packageType: 'GOODS', fundSource: 'STATE', advanceRate: 0.10,
    });
    expect(result.request.requestCode).toBe('PR-CODE-TEST');
  });
});

// PAY-A-10
describe('Advance rate boundary conditions', () => {
  it('0% advance throws (zero amount invalid)', async () => {
    const { req, hist } = repos();
    await expect(createAdvancePaymentRequest(req, hist, {
      requestCode: 'PR-ZERO', contractId: 'C', contractValue: contract,
      requestedBy: 'u', department: 'D',
      packageType: 'GOODS', fundSource: 'STATE', advanceRate: 0,
    })).rejects.toThrow();
  });
  it('negative advance rate throws', async () => {
    // 0% advance creates a vnd(0) amount which triggers ZERO_AMOUNT
    const { req, hist } = repos();
    await expect(createAdvancePaymentRequest(req, hist, {
      requestCode: 'PR-NEG', contractId: 'C', contractValue: contract,
      requestedBy: 'u', department: 'D',
      packageType: 'GOODS', fundSource: 'STATE', advanceRate: -0.05,
    })).rejects.toThrow();
  });
  it('exactly 30% for STATE does not throw', async () => {
    const { req, hist } = repos();
    const result = await createAdvancePaymentRequest(req, hist, {
      requestCode: 'PR-EXACT', contractId: 'C', contractValue: contract,
      requestedBy: 'u', department: 'D',
      packageType: 'GOODS', fundSource: 'STATE', advanceRate: 0.30,
    });
    expect(result.appliedRate).toBe(0.30);
  });
});

// PAY-A-11
describe('createAdvancePaymentRequest — all package types', () => {
  const types = ['GOODS', 'CONSTRUCTION', 'CONSULTING', 'SERVICE', 'MIXED'];
  types.forEach(pkgType => {
    it(`creates ADVANCE for ${pkgType} (STATE fund)`, async () => {
      const { req, hist } = repos();
      const result = await createAdvancePaymentRequest(req, hist, {
        requestCode: `PR-${pkgType}`, contractId: 'C', contractValue: contract,
        requestedBy: 'u', department: 'D',
        packageType: pkgType, fundSource: 'STATE', advanceRate: 0.20,
      });
      expect(result.request.status).toBe('DRAFT');
    });
  });
});

// PAY-A-12
describe('Advance request lifecycle after creation', () => {
  it('starts in DRAFT status', async () => {
    const { req, hist } = repos();
    const result = await createAdvancePaymentRequest(req, hist, {
      requestCode: 'PR-LC', contractId: 'C', contractValue: contract,
      requestedBy: 'u', department: 'D',
      packageType: 'GOODS', fundSource: 'STATE', advanceRate: 0.20,
    });
    expect(result.request.status).toBe('DRAFT');
  });
  it('paymentType is ADVANCE', async () => {
    const { req, hist } = repos();
    const result = await createAdvancePaymentRequest(req, hist, {
      requestCode: 'PR-T', contractId: 'C', contractValue: contract,
      requestedBy: 'u', department: 'D',
      packageType: 'GOODS', fundSource: 'STATE', advanceRate: 0.10,
    });
    expect(result.request.paymentType).toBe('ADVANCE');
  });
  it('amount is bigint', async () => {
    const { req, hist } = repos();
    const result = await createAdvancePaymentRequest(req, hist, {
      requestCode: 'PR-B', contractId: 'C', contractValue: contract,
      requestedBy: 'u', department: 'D',
      packageType: 'GOODS', fundSource: 'STATE', advanceRate: 0.10,
    });
    expect(typeof result.advanceAmount.amount).toBe('bigint');
  });
});

// PAY-A-13
describe('Advance guarantee flag', () => {
  it('STATE has guaranteeRequired=1', () => {
    const ctx = { packageType: 'GOODS', fundSource: 'STATE', asOfDate: today };
    expect(isAdvanceGuaranteeRequired(ctx.packageType, ctx.fundSource, ctx.asOfDate)).toBe(true);
  });
  it('PPP has guaranteeRequired=0', () => {
    expect(isAdvanceGuaranteeRequired('GOODS', 'PPP', today)).toBe(false);
  });
  it('calculateMaxAdvanceAmount returns maxRate', () => {
    const r = calculateMaxAdvanceAmount(contract, 'GOODS', 'STATE', today);
    expect(r.maxRate).toBe(0.30);
  });
});
