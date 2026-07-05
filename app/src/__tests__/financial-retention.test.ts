import { describe, it, expect } from 'vitest';
import {
  calculateRetentionAmount, createRetentionMoney, releaseRetention,
  validateRetentionRate, MAX_RETENTION_RATE, DEFAULT_RETENTION_RATE,
} from '../shared/financial/retentionMoney';
import { createMoney, FinancialError } from '../shared/financial/money';

const contractValue = createMoney(200_000_000n, 'VND'); // 200M VND

// FIN-R-01
describe('validateRetentionRate', () => {
  it('accepts 0.05 (5%)', () => {
    expect(() => validateRetentionRate(0.05)).not.toThrow();
  });
  it('accepts 0.10 (MAX)', () => {
    expect(() => validateRetentionRate(MAX_RETENTION_RATE)).not.toThrow();
  });
  it('accepts 0.00', () => {
    expect(() => validateRetentionRate(0)).not.toThrow();
  });
});

// FIN-R-02
describe('validateRetentionRate — invalid', () => {
  it('throws for rate > 0.10', () => {
    expect(() => validateRetentionRate(0.11)).toThrow(FinancialError);
  });
  it('throws for negative rate', () => {
    expect(() => validateRetentionRate(-0.01)).toThrow(FinancialError);
  });
  it('error code is INVALID_RETENTION', () => {
    try { validateRetentionRate(0.15); }
    catch (e) { expect((e as FinancialError).code).toBe('INVALID_RETENTION'); }
  });
});

// FIN-R-03
describe('calculateRetentionAmount', () => {
  it('calculates 5% of 200M = 10M', () => {
    expect(calculateRetentionAmount(contractValue, 0.05).amount).toBe(10_000_000n);
  });
  it('calculates 10% of 200M = 20M', () => {
    expect(calculateRetentionAmount(contractValue, 0.10).amount).toBe(20_000_000n);
  });
  it('result is in VND', () => {
    expect(calculateRetentionAmount(contractValue, 0.05).currency).toBe('VND');
  });
});

// FIN-R-04
describe('createRetentionMoney — happy path', () => {
  it('creates HELD retention', () => {
    const r = createRetentionMoney({ id: 'RET-001', contractId: 'CTR-001', contractValue, retentionRate: 0.05 });
    expect(r.status).toBe('HELD');
  });
  it('retentionAmount is contractValue × rate', () => {
    const r = createRetentionMoney({ id: 'RET-001', contractId: 'CTR-001', contractValue, retentionRate: 0.05 });
    expect(r.retentionAmount.amount).toBe(10_000_000n);
  });
  it('releasedAmount starts at 0', () => {
    const r = createRetentionMoney({ id: 'RET-001', contractId: 'CTR-001', contractValue, retentionRate: 0.05 });
    expect(r.releasedAmount.amount).toBe(0n);
  });
});

// FIN-R-05
describe('createRetentionMoney — derived fields', () => {
  it('heldAmount equals retentionAmount initially', () => {
    const r = createRetentionMoney({ id: 'RET-001', contractId: 'CTR-001', contractValue, retentionRate: 0.05 });
    expect(r.heldAmount.amount).toBe(r.retentionAmount.amount);
  });
  it('throws for invalid retention rate', () => {
    expect(() => createRetentionMoney({ id: 'RET-001', contractId: 'CTR-001', contractValue, retentionRate: 0.20 }))
      .toThrow(FinancialError);
  });
  it('createdAt is set', () => {
    const r = createRetentionMoney({ id: 'RET-001', contractId: 'CTR-001', contractValue, retentionRate: 0.05 });
    expect(r.createdAt).toBeTruthy();
  });
});

// FIN-R-06
describe('releaseRetention — partial', () => {
  it('reduces heldAmount', () => {
    const r = createRetentionMoney({ id: 'R-1', contractId: 'C-1', contractValue, retentionRate: 0.05 });
    const released = releaseRetention(r, createMoney(5_000_000n, 'VND'));
    expect(released.heldAmount.amount).toBe(5_000_000n);
  });
  it('advances to PARTIALLY_RELEASED', () => {
    const r = createRetentionMoney({ id: 'R-1', contractId: 'C-1', contractValue, retentionRate: 0.05 });
    const released = releaseRetention(r, createMoney(5_000_000n, 'VND'));
    expect(released.status).toBe('PARTIALLY_RELEASED');
  });
  it('releasedAmount increases', () => {
    const r = createRetentionMoney({ id: 'R-1', contractId: 'C-1', contractValue, retentionRate: 0.05 });
    const released = releaseRetention(r, createMoney(3_000_000n, 'VND'));
    expect(released.releasedAmount.amount).toBe(3_000_000n);
  });
});

// FIN-R-07
describe('releaseRetention — full', () => {
  it('advances to FULLY_RELEASED when all released', () => {
    const r = createRetentionMoney({ id: 'R-1', contractId: 'C-1', contractValue, retentionRate: 0.05 });
    const released = releaseRetention(r, r.retentionAmount);
    expect(released.status).toBe('FULLY_RELEASED');
  });
  it('heldAmount is 0 after full release', () => {
    const r = createRetentionMoney({ id: 'R-1', contractId: 'C-1', contractValue, retentionRate: 0.05 });
    const released = releaseRetention(r, r.retentionAmount);
    expect(released.heldAmount.amount).toBe(0n);
  });
  it('throws when releasing from FULLY_RELEASED', () => {
    const r = createRetentionMoney({ id: 'R-1', contractId: 'C-1', contractValue, retentionRate: 0.05 });
    const released = releaseRetention(r, r.retentionAmount);
    expect(() => releaseRetention(released, createMoney(1n, 'VND'))).toThrow(FinancialError);
  });
});

// FIN-R-08
describe('releaseRetention — over-release guard', () => {
  it('throws when releasing more than held', () => {
    const r = createRetentionMoney({ id: 'R-1', contractId: 'C-1', contractValue, retentionRate: 0.05 });
    expect(() => releaseRetention(r, createMoney(50_000_000n, 'VND'))).toThrow(FinancialError);
  });
  it('error code is INSUFFICIENT_BUDGET', () => {
    const r = createRetentionMoney({ id: 'R-1', contractId: 'C-1', contractValue, retentionRate: 0.05 });
    try { releaseRetention(r, createMoney(50_000_000n, 'VND')); }
    catch (e) { expect((e as FinancialError).code).toBe('INSUFFICIENT_BUDGET'); }
  });
  it('partial release returns new object', () => {
    const r = createRetentionMoney({ id: 'R-1', contractId: 'C-1', contractValue, retentionRate: 0.05 });
    const released = releaseRetention(r, createMoney(1n, 'VND'));
    expect(released).not.toBe(r);
  });
});

// FIN-R-09
describe('MAX_RETENTION_RATE constant', () => {
  it('is 0.10 (10%)', () => {
    expect(MAX_RETENTION_RATE).toBe(0.10);
  });
  it('DEFAULT_RETENTION_RATE.rate is 0.05', () => {
    expect(DEFAULT_RETENTION_RATE.rate).toBe(0.05);
  });
  it('DEFAULT_RETENTION_RATE.maxDuration is 12 months', () => {
    expect(DEFAULT_RETENTION_RATE.maxDuration).toBe(12);
  });
});

// FIN-R-10
describe('DEFAULT_RETENTION_RATE legalBasis', () => {
  it('references NĐ 214/2025/NĐ-CP', () => {
    expect(DEFAULT_RETENTION_RATE.legalBasis.document).toContain('214/2025');
  });
  it('has an article', () => {
    expect(DEFAULT_RETENTION_RATE.legalBasis.article).toBeTruthy();
  });
  it('has a summary', () => {
    expect(DEFAULT_RETENTION_RATE.legalBasis.summary).toBeTruthy();
  });
});

// FIN-R-11
describe('RetentionMoney — sequential releases', () => {
  it('two partial releases accumulate correctly', () => {
    const r = createRetentionMoney({ id: 'R-1', contractId: 'C-1', contractValue, retentionRate: 0.10 });
    const r1 = releaseRetention(r, createMoney(10_000_000n, 'VND'));
    const r2 = releaseRetention(r1, createMoney(10_000_000n, 'VND'));
    expect(r2.releasedAmount.amount).toBe(20_000_000n);
  });
  it('status is PARTIALLY_RELEASED after first of two', () => {
    const r = createRetentionMoney({ id: 'R-1', contractId: 'C-1', contractValue, retentionRate: 0.10 });
    const r1 = releaseRetention(r, createMoney(10_000_000n, 'VND'));
    expect(r1.status).toBe('PARTIALLY_RELEASED');
  });
  it('status is FULLY_RELEASED after both', () => {
    const r = createRetentionMoney({ id: 'R-1', contractId: 'C-1', contractValue, retentionRate: 0.10 });
    const r1 = releaseRetention(r, createMoney(10_000_000n, 'VND'));
    const r2 = releaseRetention(r1, createMoney(10_000_000n, 'VND'));
    expect(r2.status).toBe('FULLY_RELEASED');
  });
});

// FIN-R-12
describe('RetentionMoney — identity fields', () => {
  it('id is stored', () => {
    const r = createRetentionMoney({ id: 'RET-TEST', contractId: 'CTR-001', contractValue, retentionRate: 0.05 });
    expect(r.id).toBe('RET-TEST');
  });
  it('contractId is stored', () => {
    const r = createRetentionMoney({ id: 'RET-001', contractId: 'CTR-XYZABC', contractValue, retentionRate: 0.05 });
    expect(r.contractId).toBe('CTR-XYZABC');
  });
  it('retentionRate is stored', () => {
    const r = createRetentionMoney({ id: 'RET-001', contractId: 'CTR-001', contractValue, retentionRate: 0.07 });
    expect(r.retentionRate).toBe(0.07);
  });
});

// FIN-R-13
describe('releaseRetention — immutability', () => {
  it('original retention status unchanged after release', () => {
    const r = createRetentionMoney({ id: 'R-1', contractId: 'C-1', contractValue, retentionRate: 0.05 });
    releaseRetention(r, createMoney(1n, 'VND'));
    expect(r.status).toBe('HELD');
  });
  it('original heldAmount unchanged after release', () => {
    const r = createRetentionMoney({ id: 'R-1', contractId: 'C-1', contractValue, retentionRate: 0.05 });
    const held = r.heldAmount.amount;
    releaseRetention(r, createMoney(1n, 'VND'));
    expect(r.heldAmount.amount).toBe(held);
  });
  it('releaseRetention returns new object', () => {
    const r = createRetentionMoney({ id: 'R-1', contractId: 'C-1', contractValue, retentionRate: 0.05 });
    expect(releaseRetention(r, createMoney(1n, 'VND'))).not.toBe(r);
  });
});
