import { describe, it, expect } from 'vitest';
import {
  createRetentionPaymentRequest, calculateRetainedAmount,
  getMaxRetentionDuration,
} from '../payment/paymentRetentionService';
import {
  MemoryPaymentRequestRepository, MemoryPaymentHistoryRepository,
} from '../payment/paymentRepository';
import { createMoney } from '../shared/financial/money';
import type { PaymentLegalRule } from '../payment/paymentLegalRule';

const vnd = (n: number) => createMoney(BigInt(n), 'VND');
const contract = vnd(100_000_000);
const today = '2026-07-01';

function repos() {
  return {
    req: new MemoryPaymentRequestRepository(),
    hist: new MemoryPaymentHistoryRepository(),
  };
}

// PAY-RET-01
describe('createRetentionPaymentRequest — basic', () => {
  it('creates RETENTION_RELEASE payment', async () => {
    const { req, hist } = repos();
    const r = await createRetentionPaymentRequest(req, hist, {
      requestCode: 'PR-RET-001', contractId: 'C-001', contractValue: contract,
      requestedBy: 'user1', department: 'D1',
      packageType: 'GOODS', fundSource: 'STATE', retentionRate: 0.05,
    });
    expect(r.request.paymentType).toBe('RETENTION_RELEASE');
  });
  it('retainedAmount equals 5% of contractValue', async () => {
    const { req, hist } = repos();
    const r = await createRetentionPaymentRequest(req, hist, {
      requestCode: 'PR-RET-001', contractId: 'C-001', contractValue: contract,
      requestedBy: 'user1', department: 'D1',
      packageType: 'GOODS', fundSource: 'STATE', retentionRate: 0.05,
    });
    expect(r.retainedAmount.amount).toBe(5_000_000n);
  });
  it('status is DRAFT', async () => {
    const { req, hist } = repos();
    const r = await createRetentionPaymentRequest(req, hist, {
      requestCode: 'PR-RET-001', contractId: 'C-001', contractValue: contract,
      requestedBy: 'user1', department: 'D1',
      packageType: 'GOODS', fundSource: 'STATE', retentionRate: 0.05,
    });
    expect(r.request.status).toBe('DRAFT');
  });
});

// PAY-RET-02
describe('createRetentionPaymentRequest — rate enforcement', () => {
  it('rejects rate > 10%', async () => {
    const { req, hist } = repos();
    await expect(createRetentionPaymentRequest(req, hist, {
      requestCode: 'PR-RET-X', contractId: 'C', contractValue: contract,
      requestedBy: 'u', department: 'D',
      packageType: 'GOODS', fundSource: 'STATE', retentionRate: 0.11,
    })).rejects.toMatchObject({ code: 'RETENTION_RATE_EXCEEDED' });
  });
  it('accepts exactly 10%', async () => {
    const { req, hist } = repos();
    const r = await createRetentionPaymentRequest(req, hist, {
      requestCode: 'PR-RET-MAX', contractId: 'C', contractValue: contract,
      requestedBy: 'u', department: 'D',
      packageType: 'GOODS', fundSource: 'STATE', retentionRate: 0.10,
    });
    expect(r.retainedAmount.amount).toBe(10_000_000n);
  });
  it('resolvedRuleId is set', async () => {
    const { req, hist } = repos();
    const r = await createRetentionPaymentRequest(req, hist, {
      requestCode: 'PR-RET-R', contractId: 'C', contractValue: contract,
      requestedBy: 'u', department: 'D',
      packageType: 'GOODS', fundSource: 'STATE', retentionRate: 0.05,
    });
    expect(r.request.resolvedRuleId).toBeDefined();
  });
});

// PAY-RET-03
describe('createRetentionPaymentRequest — legal basis', () => {
  it('legalBasis is populated', async () => {
    const { req, hist } = repos();
    const r = await createRetentionPaymentRequest(req, hist, {
      requestCode: 'PR-RET-LB', contractId: 'C', contractValue: contract,
      requestedBy: 'u', department: 'D',
      packageType: 'GOODS', fundSource: 'STATE', retentionRate: 0.05,
    });
    expect(r.request.legalBasis.length).toBeGreaterThan(0);
  });
  it('custom legalBasis is used when provided', async () => {
    const { req, hist } = repos();
    const r = await createRetentionPaymentRequest(req, hist, {
      requestCode: 'PR-RET-CLB', contractId: 'C', contractValue: contract,
      requestedBy: 'u', department: 'D',
      packageType: 'GOODS', fundSource: 'STATE', retentionRate: 0.05,
      legalBasis: [{ document: 'CUSTOM-DOC', summary: 'Custom' }],
    });
    expect(r.request.legalBasis[0]?.document).toBe('CUSTOM-DOC');
  });
  it('records history', async () => {
    const { req, hist } = repos();
    const r = await createRetentionPaymentRequest(req, hist, {
      requestCode: 'PR-RET-H', contractId: 'C', contractValue: contract,
      requestedBy: 'u', department: 'D',
      packageType: 'GOODS', fundSource: 'STATE', retentionRate: 0.05,
    });
    const history = await hist.findByRequestId(r.request.id);
    expect(history.length).toBeGreaterThan(0);
  });
});

// PAY-RET-04
describe('createRetentionPaymentRequest — injectable rules', () => {
  const customRule: PaymentLegalRule = {
    ruleId: 'TEST-RET', ruleName: 'Test Retention', ruleType: 'RETENTION_RATE',
    legalReferences: [], effectiveFrom: '2000-01-01', effectiveTo: null,
    applicablePackageTypes: [], applicableFundingSources: [],
    applicableAuthorities: [],
    numericParams: { maxRate: 0.20, defaultRate: 0.10, maxDurationMonths: 24 },
    conditions: [], priority: 1, description: 'Test 20%',
  };
  it('injected rule allows higher rate', async () => {
    const { req, hist } = repos();
    const r = await createRetentionPaymentRequest(req, hist, {
      requestCode: 'PR-RET-INJ', contractId: 'C', contractValue: contract,
      requestedBy: 'u', department: 'D',
      packageType: 'GOODS', fundSource: 'STATE', retentionRate: 0.15,
      rules: [customRule],
    });
    expect(r.retainedAmount.amount).toBe(15_000_000n);
  });
  it('resolvedRuleId matches injected rule', async () => {
    const { req, hist } = repos();
    const r = await createRetentionPaymentRequest(req, hist, {
      requestCode: 'PR-RET-INJ2', contractId: 'C', contractValue: contract,
      requestedBy: 'u', department: 'D',
      packageType: 'GOODS', fundSource: 'STATE', retentionRate: 0.10,
      rules: [customRule],
    });
    expect(r.resolvedRuleId).toBe('TEST-RET');
  });
  it('strict rule rejects 5%', async () => {
    const strictRule: PaymentLegalRule = {
      ...customRule, ruleId: 'STRICT-RET',
      numericParams: { maxRate: 0.03, defaultRate: 0.02, maxDurationMonths: 12 },
    };
    const { req, hist } = repos();
    await expect(createRetentionPaymentRequest(req, hist, {
      requestCode: 'PR-RET-STRICT', contractId: 'C', contractValue: contract,
      requestedBy: 'u', department: 'D',
      packageType: 'GOODS', fundSource: 'STATE', retentionRate: 0.05,
      rules: [strictRule],
    })).rejects.toThrow();
  });
});

// PAY-RET-05
describe('createRetentionPaymentRequest — validation', () => {
  it('throws on empty contractId', async () => {
    const { req, hist } = repos();
    await expect(createRetentionPaymentRequest(req, hist, {
      requestCode: 'PR', contractId: '', contractValue: contract,
      requestedBy: 'u', department: 'D',
      packageType: 'GOODS', fundSource: 'STATE', retentionRate: 0.05,
    })).rejects.toThrow();
  });
  it('throws on negative rate (amount would be negative)', async () => {
    const { req, hist } = repos();
    await expect(createRetentionPaymentRequest(req, hist, {
      requestCode: 'PR', contractId: 'C', contractValue: contract,
      requestedBy: 'u', department: 'D',
      packageType: 'GOODS', fundSource: 'STATE', retentionRate: -0.01,
    })).rejects.toThrow();
  });
  it('uses defaultRate when retentionRate not provided', async () => {
    const { req, hist } = repos();
    const r = await createRetentionPaymentRequest(req, hist, {
      requestCode: 'PR-DEF', contractId: 'C', contractValue: contract,
      requestedBy: 'u', department: 'D',
      packageType: 'GOODS', fundSource: 'STATE',
    });
    expect(r.appliedRate).toBe(0.05);  // defaultRate from rule
  });
});

// PAY-RET-06
describe('calculateRetainedAmount', () => {
  it('rate 5% of 100m = 5m', () => {
    const r = calculateRetainedAmount(contract, 'GOODS', 'STATE', today);
    expect(r.amount.amount).toBe(5_000_000n);
  });
  it('rate field equals defaultRate from rule', () => {
    const r = calculateRetainedAmount(contract, 'GOODS', 'STATE', today);
    expect(r.rate).toBe(0.05);
  });
  it('ruleId is non-null when rule found', () => {
    const r = calculateRetainedAmount(contract, 'GOODS', 'STATE', today);
    expect(r.ruleId).not.toBeNull();
  });
});

// PAY-RET-07
describe('calculateRetainedAmount — precision', () => {
  it('large amount has no float rounding', () => {
    const bigContract = vnd(1_000_000_000);
    const r = calculateRetainedAmount(bigContract, 'GOODS', 'STATE', today);
    expect(r.amount.amount).toBe(50_000_000n);
  });
  it('currency matches input', () => {
    const r = calculateRetainedAmount(contract, 'GOODS', 'STATE', today);
    expect(r.amount.currency).toBe('VND');
  });
  it('universal rule resolves for any fund', () => {
    // RETENTION_RATE rule has empty applicableFundingSources = matches all
    const r = calculateRetainedAmount(contract, 'GOODS', 'ENTERPRISE', today);
    expect(r.ruleId).not.toBeNull();
  });
});

// PAY-RET-08
describe('getMaxRetentionDuration', () => {
  it('returns number of months', () => {
    const months = getMaxRetentionDuration('GOODS', 'STATE', today);
    expect(typeof months).toBe('number');
  });
  it('at least 12 months for STATE', () => {
    const months = getMaxRetentionDuration('GOODS', 'STATE', today);
    expect(months).toBeGreaterThanOrEqual(12);
  });
  it('returns fallback (24) for unknown fund', () => {
    const months = getMaxRetentionDuration('GOODS', 'UNKNOWN_FUND', today);
    expect(months).toBe(24);  // implementation fallback: ?? 24
  });
});

// PAY-RET-09
describe('Retention all package types', () => {
  const types = ['GOODS', 'CONSTRUCTION', 'CONSULTING', 'SERVICE'];
  types.forEach(pkgType => {
    it(`calculates retention for ${pkgType}`, () => {
      const r = calculateRetainedAmount(contract, pkgType, 'STATE', today);
      expect(r.amount.amount).toBe(5_000_000n);
    });
  });
  it('MIXED type also works', () => {
    const r = calculateRetainedAmount(contract, 'MIXED', 'STATE', today);
    expect(r.amount.amount).toBeGreaterThanOrEqual(0n);
  });
});

// PAY-RET-10
describe('Retention paymentType and amount precision', () => {
  it('paymentType is always RETENTION_RELEASE', async () => {
    const { req, hist } = repos();
    const r = await createRetentionPaymentRequest(req, hist, {
      requestCode: 'PR-TYPE', contractId: 'C', contractValue: contract,
      requestedBy: 'u', department: 'D',
      packageType: 'GOODS', fundSource: 'STATE', retentionRate: 0.05,
    });
    expect(r.request.paymentType).toBe('RETENTION_RELEASE');
  });
  it('amount currency is VND', async () => {
    const { req, hist } = repos();
    const r = await createRetentionPaymentRequest(req, hist, {
      requestCode: 'PR-CUR', contractId: 'C', contractValue: contract,
      requestedBy: 'u', department: 'D',
      packageType: 'GOODS', fundSource: 'STATE', retentionRate: 0.05,
    });
    expect(r.retainedAmount.currency).toBe('VND');
  });
  it('amount is bigint', async () => {
    const { req, hist } = repos();
    const r = await createRetentionPaymentRequest(req, hist, {
      requestCode: 'PR-BIG', contractId: 'C', contractValue: contract,
      requestedBy: 'u', department: 'D',
      packageType: 'GOODS', fundSource: 'STATE', retentionRate: 0.05,
    });
    expect(typeof r.retainedAmount.amount).toBe('bigint');
  });
});

// PAY-RET-11
describe('Retention requestCode and appliedRate', () => {
  it('requestCode stored on request', async () => {
    const { req, hist } = repos();
    const r = await createRetentionPaymentRequest(req, hist, {
      requestCode: 'MY-RETENTION-CODE', contractId: 'C', contractValue: contract,
      requestedBy: 'u', department: 'D',
      packageType: 'GOODS', fundSource: 'STATE', retentionRate: 0.05,
    });
    expect(r.request.requestCode).toBe('MY-RETENTION-CODE');
  });
  it('appliedRate stored', async () => {
    const { req, hist } = repos();
    const r = await createRetentionPaymentRequest(req, hist, {
      requestCode: 'PR-AR', contractId: 'C', contractValue: contract,
      requestedBy: 'u', department: 'D',
      packageType: 'GOODS', fundSource: 'STATE', retentionRate: 0.07,
    });
    expect(r.appliedRate).toBe(0.07);
  });
  it('maxRate is 0.10 for default rules', async () => {
    const { req, hist } = repos();
    const r = await createRetentionPaymentRequest(req, hist, {
      requestCode: 'PR-MR', contractId: 'C', contractValue: contract,
      requestedBy: 'u', department: 'D',
      packageType: 'GOODS', fundSource: 'STATE', retentionRate: 0.05,
    });
    expect(r.maxRate).toBe(0.10);
  });
});

// PAY-RET-12
describe('Retention history audit', () => {
  it('first history entry is CREATED', async () => {
    const { req, hist } = repos();
    const r = await createRetentionPaymentRequest(req, hist, {
      requestCode: 'PR-H1', contractId: 'C', contractValue: contract,
      requestedBy: 'u', department: 'D',
      packageType: 'GOODS', fundSource: 'STATE', retentionRate: 0.05,
    });
    const history = await hist.findByRequestId(r.request.id);
    expect(history[0]?.action).toBe('CREATED');
  });
  it('history entries all reference correct requestId', async () => {
    const { req, hist } = repos();
    const r = await createRetentionPaymentRequest(req, hist, {
      requestCode: 'PR-H2', contractId: 'C', contractValue: contract,
      requestedBy: 'u', department: 'D',
      packageType: 'GOODS', fundSource: 'STATE', retentionRate: 0.05,
    });
    const history = await hist.findByRequestId(r.request.id);
    expect(history.every(e => e.requestId === r.request.id)).toBe(true);
  });
  it('maxDurationMonths is populated on result', async () => {
    const { req, hist } = repos();
    const r = await createRetentionPaymentRequest(req, hist, {
      requestCode: 'PR-DUR', contractId: 'C', contractValue: contract,
      requestedBy: 'u', department: 'D',
      packageType: 'GOODS', fundSource: 'STATE', retentionRate: 0.05,
    });
    expect(r.maxDurationMonths).toBeGreaterThan(0);
  });
});

// PAY-RET-13
describe('Retention rule — universal applicability', () => {
  it('rule applies universally (empty applicableFundingSources)', () => {
    // RETENTION_RATE_RULES has [] = matches all funds
    const r = calculateRetainedAmount(contract, 'GOODS', 'ANY_FUND', today);
    expect(r.ruleId).not.toBeNull();
  });
  it('UNKNOWN_FUND still gets 5% retention', () => {
    const r = calculateRetainedAmount(contract, 'GOODS', 'UNKNOWN_FUND', today);
    expect(r.amount.amount).toBe(5_000_000n);
  });
  it('empty rules list throws or returns null ruleId', () => {
    const r = calculateRetainedAmount(contract, 'GOODS', 'STATE', today, []);
    expect(r.ruleId).toBeNull();
    expect(r.amount.amount).toBe(0n);
  });
});
