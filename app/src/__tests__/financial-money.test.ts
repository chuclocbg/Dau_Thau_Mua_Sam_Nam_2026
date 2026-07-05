import { describe, it, expect } from 'vitest';
import {
  createMoney, addMoney, subtractMoney, multiplyMoney, compareMoney,
  sumMoney, zeroMoney, isZeroMoney, isPositiveMoney, formatMoney,
  FinancialError,
} from '../shared/financial/money';

// FIN-M-01
describe('createMoney — valid inputs', () => {
  it('creates Money from number', () => {
    expect(createMoney(1_000_000, 'VND').amount).toBe(1_000_000n);
  });
  it('creates Money from bigint', () => {
    expect(createMoney(500n, 'VND').amount).toBe(500n);
  });
  it('stores currency', () => {
    expect(createMoney(100, 'USD').currency).toBe('USD');
  });
});

// FIN-M-02
describe('createMoney — error cases', () => {
  it('throws FinancialError for negative number', () => {
    expect(() => createMoney(-1, 'VND')).toThrow(FinancialError);
  });
  it('throws FinancialError for negative bigint', () => {
    expect(() => createMoney(-1n, 'VND')).toThrow(FinancialError);
  });
  it('error code is NEGATIVE_AMOUNT', () => {
    try { createMoney(-5, 'VND'); } catch (e) {
      expect((e as FinancialError).code).toBe('NEGATIVE_AMOUNT');
    }
  });
});

// FIN-M-03
describe('zeroMoney + isZeroMoney + isPositiveMoney', () => {
  it('zeroMoney has amount 0n', () => {
    expect(zeroMoney('VND').amount).toBe(0n);
  });
  it('isZeroMoney returns true for zero', () => {
    expect(isZeroMoney(zeroMoney('VND'))).toBe(true);
  });
  it('isPositiveMoney returns false for zero', () => {
    expect(isPositiveMoney(zeroMoney('VND'))).toBe(false);
  });
});

// FIN-M-04
describe('addMoney', () => {
  it('adds two VND amounts', () => {
    const a = createMoney(1_000_000n, 'VND');
    const b = createMoney(2_000_000n, 'VND');
    expect(addMoney(a, b).amount).toBe(3_000_000n);
  });
  it('throws CURRENCY_MISMATCH for different currencies', () => {
    const a = createMoney(100, 'VND');
    const b = createMoney(100, 'USD');
    expect(() => addMoney(a, b)).toThrow(FinancialError);
  });
  it('error code is CURRENCY_MISMATCH', () => {
    try { addMoney(createMoney(1, 'VND'), createMoney(1, 'USD')); } catch (e) {
      expect((e as FinancialError).code).toBe('CURRENCY_MISMATCH');
    }
  });
});

// FIN-M-05
describe('subtractMoney', () => {
  it('subtracts two VND amounts', () => {
    const a = createMoney(5_000_000n, 'VND');
    const b = createMoney(2_000_000n, 'VND');
    expect(subtractMoney(a, b).amount).toBe(3_000_000n);
  });
  it('allows subtracting to exactly zero', () => {
    const m = createMoney(100n, 'VND');
    expect(subtractMoney(m, m).amount).toBe(0n);
  });
  it('throws NEGATIVE_AMOUNT when result would be negative', () => {
    const a = createMoney(100n, 'VND');
    const b = createMoney(200n, 'VND');
    expect(() => subtractMoney(a, b)).toThrow(FinancialError);
  });
});

// FIN-M-06
describe('multiplyMoney', () => {
  it('multiplies by integer factor', () => {
    expect(multiplyMoney(createMoney(1_000_000n, 'VND'), 3).amount).toBe(3_000_000n);
  });
  it('multiplies by decimal factor (0.05 retention)', () => {
    expect(multiplyMoney(createMoney(100_000_000n, 'VND'), 0.05).amount).toBe(5_000_000n);
  });
  it('throws for negative factor', () => {
    expect(() => multiplyMoney(createMoney(100n, 'VND'), -1)).toThrow(FinancialError);
  });
});

// FIN-M-07
describe('compareMoney', () => {
  it('returns -1 when a < b', () => {
    expect(compareMoney(createMoney(100n, 'VND'), createMoney(200n, 'VND'))).toBe(-1);
  });
  it('returns 0 when equal', () => {
    expect(compareMoney(createMoney(500n, 'VND'), createMoney(500n, 'VND'))).toBe(0);
  });
  it('returns 1 when a > b', () => {
    expect(compareMoney(createMoney(999n, 'VND'), createMoney(100n, 'VND'))).toBe(1);
  });
});

// FIN-M-08
describe('compareMoney — currency mismatch', () => {
  it('throws CURRENCY_MISMATCH', () => {
    expect(() => compareMoney(createMoney(1, 'VND'), createMoney(1, 'USD'))).toThrow(FinancialError);
  });
  it('error code is CURRENCY_MISMATCH', () => {
    try { compareMoney(createMoney(1, 'VND'), createMoney(1, 'EUR')); } catch (e) {
      expect((e as FinancialError).code).toBe('CURRENCY_MISMATCH');
    }
  });
  it('compare throws on any currency mismatch', () => {
    expect(() => compareMoney(createMoney(1, 'JPY'), createMoney(1, 'AUD'))).toThrow();
  });
});

// FIN-M-09
describe('sumMoney', () => {
  it('sums empty array to zero', () => {
    expect(sumMoney([], 'VND').amount).toBe(0n);
  });
  it('sums multiple VND amounts', () => {
    const items = [createMoney(100n, 'VND'), createMoney(200n, 'VND'), createMoney(300n, 'VND')];
    expect(sumMoney(items, 'VND').amount).toBe(600n);
  });
  it('preserves currency of result', () => {
    expect(sumMoney([createMoney(1000n, 'VND')], 'VND').currency).toBe('VND');
  });
});

// FIN-M-10
describe('formatMoney', () => {
  it('formats VND with ₫ symbol', () => {
    const m = createMoney(1_000_000n, 'VND');
    expect(formatMoney(m)).toContain('₫');
  });
  it('formats VND large amount', () => {
    const m = createMoney(1_000_000_000n, 'VND');
    expect(formatMoney(m)).toContain('₫');
  });
  it('formats USD as currency', () => {
    const m = createMoney(10_000n, 'USD'); // 100 USD in cents
    expect(formatMoney(m)).not.toContain('₫');
  });
});

// FIN-M-11
describe('large VND values (bigint precision)', () => {
  it('handles 20 billion VND without rounding', () => {
    const m = createMoney(20_000_000_000n, 'VND');
    expect(m.amount).toBe(20_000_000_000n);
  });
  it('adds large values without overflow', () => {
    const a = createMoney(9_000_000_000_000n, 'VND');
    const b = createMoney(9_000_000_000_000n, 'VND');
    expect(addMoney(a, b).amount).toBe(18_000_000_000_000n);
  });
  it('preserves exact bigint value', () => {
    const amount = 123_456_789_012_345n;
    expect(createMoney(amount, 'VND').amount).toBe(amount);
  });
});

// FIN-M-12
describe('isPositiveMoney — edge cases', () => {
  it('returns true for 1n', () => {
    expect(isPositiveMoney(createMoney(1n, 'VND'))).toBe(true);
  });
  it('returns false for zero after subtraction', () => {
    const m = createMoney(100n, 'VND');
    expect(isPositiveMoney(subtractMoney(m, m))).toBe(false);
  });
  it('isZeroMoney returns false for positive', () => {
    expect(isZeroMoney(createMoney(1n, 'VND'))).toBe(false);
  });
});

// FIN-M-13
describe('FinancialError — properties', () => {
  it('has name FinancialError', () => {
    try { createMoney(-1n, 'VND'); } catch (e) {
      expect((e as Error).name).toBe('FinancialError');
    }
  });
  it('has field property', () => {
    try { createMoney(-1n, 'VND'); } catch (e) {
      expect((e as FinancialError).field).toBe('amount');
    }
  });
  it('has code property', () => {
    try { addMoney(createMoney(1, 'VND'), createMoney(1, 'USD')); } catch (e) {
      expect((e as FinancialError).code).toBeDefined();
    }
  });
});
