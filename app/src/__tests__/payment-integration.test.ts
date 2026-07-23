import { describe, it, expect } from 'vitest';
import {
  contractToContractMoney, buildPaymentRuleContextFromContract,
  acceptanceToPaymentBaseParams, buildPaymentLegalBasisFromAcceptance,
  resolveAdvanceRuleForContext, buildExtendedPaymentLegalBasis,
} from '../payment/paymentIntegration';
import { createMoney } from '../shared/financial/money';

// Minimal frozen-type shapes; we only use fields referenced by paymentIntegration.ts
const sampleContract = {
  id: 'C-001',
  contractNumber: 'HD-2026-001',
  contractValue: 100_000_000,
  currency: 'VND',
  title: 'Test Contract',
  status: 'EFFECTIVE' as const,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
} as any;

const sampleAcceptance = {
  id: 'ACC-001',
  requestCode: 'BN-001',
  contractId: 'C-001',
  requestedBy: 'user1',
  department: 'D1',
  legalBasis: ['22/2023/QH15', 'TT 79/2025/TT-BTC'],
  status: 'COMPLETED' as const,
  sessionType: 'FINAL' as const,
  createdAt: '2026-06-01T00:00:00Z',
  updatedAt: '2026-06-01T00:00:00Z',
} as any;

// PAY-I-01
describe('contractToContractMoney — basic', () => {
  it('returns Money with bigint amount', () => {
    const m = contractToContractMoney(sampleContract);
    expect(typeof m.amount).toBe('bigint');
  });
  it('amount equals contractValue as bigint', () => {
    const m = contractToContractMoney(sampleContract);
    expect(m.amount).toBe(100_000_000n);
  });
  it('currency matches contract currency', () => {
    const m = contractToContractMoney(sampleContract);
    expect(m.currency).toBe('VND');
  });
});

// PAY-I-02
describe('contractToContractMoney — edge cases', () => {
  it('handles zero contractValue', () => {
    const c = { ...sampleContract, contractValue: 0 };
    const m = contractToContractMoney(c);
    expect(m.amount).toBe(0n);
  });
  it('handles large contractValue without float error', () => {
    const c = { ...sampleContract, contractValue: 50_000_000_000 };
    const m = contractToContractMoney(c);
    expect(m.amount).toBe(50_000_000_000n);
  });
  it('handles USD currency', () => {
    const c = { ...sampleContract, currency: 'USD' };
    const m = contractToContractMoney(c);
    expect(m.currency).toBe('USD');
  });
});

// PAY-I-03
describe('buildPaymentRuleContextFromContract', () => {
  it('returns context with packageType', () => {
    const ctx = buildPaymentRuleContextFromContract('GOODS', 'STATE');
    expect(ctx.packageType).toBe('GOODS');
  });
  it('returns context with fundSource', () => {
    const ctx = buildPaymentRuleContextFromContract('GOODS', 'STATE');
    expect(ctx.fundSource).toBe('STATE');
  });
  it('uses current date when not provided', () => {
    const ctx = buildPaymentRuleContextFromContract('GOODS', 'STATE');
    expect(ctx.asOfDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// PAY-I-04
describe('buildPaymentRuleContextFromContract — custom date', () => {
  it('uses provided asOfDate', () => {
    const ctx = buildPaymentRuleContextFromContract('CONSTRUCTION', 'ODA', '2027-01-01');
    expect(ctx.asOfDate).toBe('2027-01-01');
  });
  it('reflects construction packageType', () => {
    const ctx = buildPaymentRuleContextFromContract('CONSTRUCTION', 'ODA', '2027-01-01');
    expect(ctx.packageType).toBe('CONSTRUCTION');
  });
  it('reflects ODA fundSource', () => {
    const ctx = buildPaymentRuleContextFromContract('SERVICE', 'ODA', '2026-07-01');
    expect(ctx.fundSource).toBe('ODA');
  });
});

// PAY-I-05
describe('acceptanceToPaymentBaseParams', () => {
  it('includes contractId from acceptance', () => {
    const p = acceptanceToPaymentBaseParams(sampleAcceptance, createMoney(5_000_000n, 'VND'), 'user1', 'D1');
    expect(p.contractId).toBe('C-001');
  });
  it('includes requestedBy', () => {
    const p = acceptanceToPaymentBaseParams(sampleAcceptance, createMoney(5_000_000n, 'VND'), 'user2', 'D1');
    expect(p.requestedBy).toBe('user2');
  });
  it('includes department', () => {
    const p = acceptanceToPaymentBaseParams(sampleAcceptance, createMoney(5_000_000n, 'VND'), 'u', 'DEPT-X');
    expect(p.department).toBe('DEPT-X');
  });
});

// PAY-I-06
describe('acceptanceToPaymentBaseParams — amount', () => {
  it('amount is passed through', () => {
    const amount = createMoney(12_345_678n, 'VND');
    const p = acceptanceToPaymentBaseParams(sampleAcceptance, amount, 'u', 'D');
    expect(p.amount!.amount).toBe(12_345_678n);
  });
  it('amount currency preserved', () => {
    const amount = createMoney(5_000_000n, 'USD');
    const p = acceptanceToPaymentBaseParams(sampleAcceptance, amount, 'u', 'D');
    expect(p.amount!.currency).toBe('USD');
  });
  it('returns required fields', () => {
    const p = acceptanceToPaymentBaseParams(sampleAcceptance, createMoney(1n, 'VND'), 'u', 'D');
    expect(p).toHaveProperty('contractId');
    expect(p).toHaveProperty('requestedBy');
    expect(p).toHaveProperty('department');
    expect(p).toHaveProperty('amount');
  });
});

// PAY-I-07
describe('buildPaymentLegalBasisFromAcceptance — merges with PROCUREMENT_LEGAL_BASIS', () => {
  it('merges acceptance docs with default corpus', () => {
    // PROCUREMENT_LEGAL_BASIS (5) merged with acceptance docs (2, but both are in corpus)
    const bases = buildPaymentLegalBasisFromAcceptance(sampleAcceptance);
    expect(bases.length).toBeGreaterThanOrEqual(2);
  });
  it('acceptance doc 22/2023/QH15 appears in result', () => {
    const bases = buildPaymentLegalBasisFromAcceptance(sampleAcceptance);
    expect(bases.some(b => b.document === '22/2023/QH15')).toBe(true);
  });
  it('each basis has summary', () => {
    const bases = buildPaymentLegalBasisFromAcceptance(sampleAcceptance);
    expect(bases.every(b => typeof b.summary === 'string')).toBe(true);
  });
});

// PAY-I-08
describe('buildPaymentLegalBasisFromAcceptance — empty and edge cases', () => {
  it('empty acceptance legalBasis returns PROCUREMENT_LEGAL_BASIS', () => {
    const acc = { ...sampleAcceptance, legalBasis: [] };
    // mergeLegalBasis(PROCUREMENT_LEGAL_BASIS, []) = 5 default entries
    expect(buildPaymentLegalBasisFromAcceptance(acc).length).toBeGreaterThan(0);
  });
  it('trims whitespace and unique doc appears in result', () => {
    const acc = { ...sampleAcceptance, legalBasis: ['  UNIQUE-DOC-2026  '] };
    const bases = buildPaymentLegalBasisFromAcceptance(acc);
    expect(bases.some(b => b.document === 'UNIQUE-DOC-2026')).toBe(true);
  });
  it('undefined legalBasis throws TypeError (no defensive null check)', () => {
    const acc = { ...sampleAcceptance, legalBasis: undefined };
    expect(() => buildPaymentLegalBasisFromAcceptance(acc)).toThrow();
  });
});

// PAY-I-09
describe('resolveAdvanceRuleForContext', () => {
  it('resolves STATE fund rule', () => {
    const r = resolveAdvanceRuleForContext('GOODS', 'STATE', '2026-07-01');
    expect(r.resolved).toBe(true);
  });
  it('returns maxRate for STATE', () => {
    const r = resolveAdvanceRuleForContext('GOODS', 'STATE', '2026-07-01');
    expect(r.params['maxRate']).toBe(0.30);
  });
  it('ENTERPRISE resolved with 0.15', () => {
    const r = resolveAdvanceRuleForContext('SERVICE', 'ENTERPRISE', '2026-07-01');
    expect(r.params['maxRate']).toBe(0.15);
  });
});

// PAY-I-10
describe('resolveAdvanceRuleForContext — unresolved', () => {
  it('returns resolved=false for UNKNOWN fund', () => {
    const r = resolveAdvanceRuleForContext('GOODS', 'UNKNOWN_FUND', '2026-07-01');
    expect(r.resolved).toBe(false);
  });
  it('returns empty params when unresolved', () => {
    const r = resolveAdvanceRuleForContext('GOODS', 'UNKNOWN_FUND', '2026-07-01');
    expect(Object.keys(r.params).length).toBe(0);
  });
  it('current date works without explicit asOfDate', () => {
    const r = resolveAdvanceRuleForContext('GOODS', 'STATE');
    expect(r.resolved).toBe(true);
  });
});

// PAY-I-11
describe('buildExtendedPaymentLegalBasis', () => {
  it('returns default bases plus additional', () => {
    const extra = [{ document: 'CUSTOM-1', summary: 'Custom' }];
    const bases = buildExtendedPaymentLegalBasis(extra);
    expect(bases.length).toBeGreaterThan(1);
  });
  it('additional basis appears in result', () => {
    const extra = [{ document: 'SPECIAL-DOC', summary: 'Special' }];
    const bases = buildExtendedPaymentLegalBasis(extra);
    expect(bases.some(b => b.document === 'SPECIAL-DOC')).toBe(true);
  });
  it('no duplicates by document name', () => {
    const bases = buildExtendedPaymentLegalBasis([]);
    const docs = bases.map(b => b.document);
    const unique = new Set(docs);
    expect(unique.size).toBe(docs.length);
  });
});

// PAY-I-12
describe('buildExtendedPaymentLegalBasis — empty additional', () => {
  it('returns default bases when no additional provided', () => {
    const bases = buildExtendedPaymentLegalBasis([]);
    expect(bases.length).toBeGreaterThan(0);
  });
  it('all bases have non-empty document', () => {
    const bases = buildExtendedPaymentLegalBasis([]);
    expect(bases.every(b => b.document.trim().length > 0)).toBe(true);
  });
  it('multiple additional preserved', () => {
    const extra = [
      { document: 'EXTRA-1', summary: 'E1' },
      { document: 'EXTRA-2', summary: 'E2' },
    ];
    const bases = buildExtendedPaymentLegalBasis(extra);
    expect(bases.some(b => b.document === 'EXTRA-1')).toBe(true);
    expect(bases.some(b => b.document === 'EXTRA-2')).toBe(true);
  });
});

// PAY-I-13
describe('Integration bridge does not modify frozen types', () => {
  it('contractToContractMoney does not mutate input', () => {
    const c = { ...sampleContract };
    const origValue = c.contractValue;
    contractToContractMoney(c);
    expect(c.contractValue).toBe(origValue);
  });
  it('buildPaymentLegalBasisFromAcceptance does not mutate acceptance', () => {
    const acc = { ...sampleAcceptance, legalBasis: ['22/2023/QH15'] };
    buildPaymentLegalBasisFromAcceptance(acc);
    expect(acc.legalBasis.length).toBe(1);
  });
  it('acceptanceToPaymentBaseParams does not mutate acceptance', () => {
    const acc = { ...sampleAcceptance };
    const origId = acc.id;
    acceptanceToPaymentBaseParams(acc, createMoney(1n, 'VND'), 'u', 'D');
    expect(acc.id).toBe(origId);
  });
});
