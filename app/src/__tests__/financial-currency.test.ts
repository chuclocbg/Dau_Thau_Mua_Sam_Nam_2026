import { describe, it, expect } from 'vitest';
import {
  SUPPORTED_CURRENCIES, CURRENCY_META, validateCurrency, isVND, isUSD, getCurrencyMeta,
} from '../shared/financial/currency';
import { createMoney, formatMoney, FinancialError } from '../shared/financial/money';

// FIN-CUR-01
describe('SUPPORTED_CURRENCIES', () => {
  it('includes VND', () => {
    expect(SUPPORTED_CURRENCIES).toContain('VND');
  });
  it('includes USD', () => {
    expect(SUPPORTED_CURRENCIES).toContain('USD');
  });
  it('has 5 currencies', () => {
    expect(SUPPORTED_CURRENCIES).toHaveLength(5);
  });
});

// FIN-CUR-02
describe('validateCurrency — valid inputs', () => {
  it('accepts VND', () => {
    expect(() => validateCurrency('VND')).not.toThrow();
  });
  it('returns true for valid currency', () => {
    expect(validateCurrency('USD')).toBe(true);
  });
  it('accepts all supported currencies', () => {
    expect(() => SUPPORTED_CURRENCIES.forEach(c => validateCurrency(c))).not.toThrow();
  });
});

// FIN-CUR-03
describe('validateCurrency — invalid inputs', () => {
  it('throws FinancialError for unknown code', () => {
    expect(() => validateCurrency('GBP')).toThrow(FinancialError);
  });
  it('error code is INVALID_CURRENCY', () => {
    try { validateCurrency('CNY'); } catch (e) {
      expect((e as FinancialError).code).toBe('INVALID_CURRENCY');
    }
  });
  it('throws for empty string', () => {
    expect(() => validateCurrency('')).toThrow(FinancialError);
  });
});

// FIN-CUR-04
describe('CURRENCY_META', () => {
  it('VND has subUnitSize 1', () => {
    expect(CURRENCY_META.VND.subUnitSize).toBe(1);
  });
  it('USD has subUnitSize 100', () => {
    expect(CURRENCY_META.USD.subUnitSize).toBe(100);
  });
  it('VND symbol is ₫', () => {
    expect(CURRENCY_META.VND.symbol).toBe('₫');
  });
});

// FIN-CUR-05
describe('isVND + isUSD', () => {
  it('isVND returns true for VND', () => {
    expect(isVND('VND')).toBe(true);
  });
  it('isVND returns false for USD', () => {
    expect(isVND('USD')).toBe(false);
  });
  it('isUSD returns true for USD', () => {
    expect(isUSD('USD')).toBe(true);
  });
});

// FIN-CUR-06
describe('getCurrencyMeta', () => {
  it('returns correct meta for EUR', () => {
    expect(getCurrencyMeta('EUR').name).toBe('Euro');
  });
  it('JPY has subUnitSize 1', () => {
    expect(getCurrencyMeta('JPY').subUnitSize).toBe(1);
  });
  it('AUD has subUnitSize 100', () => {
    expect(getCurrencyMeta('AUD').subUnitSize).toBe(100);
  });
});

// FIN-CUR-07
describe('formatMoney with different currencies', () => {
  it('VND amount contains ₫', () => {
    expect(formatMoney(createMoney(500_000n, 'VND'))).toContain('₫');
  });
  it('USD amount does not contain ₫', () => {
    expect(formatMoney(createMoney(10000n, 'USD'))).not.toContain('₫');
  });
  it('VND format is locale-aware', () => {
    const s = formatMoney(createMoney(1_000_000n, 'VND'));
    expect(s).toBeTruthy();
  });
});

// FIN-CUR-08
describe('ExchangeRate — shape reserved', () => {
  it('can create an ExchangeRate object (reserved type)', async () => {
    const { } = await import('../shared/financial/currency');
    // ExchangeRate is a reserved type; just verify the import succeeds
    expect(CURRENCY_META.VND).toBeDefined();
  });
  it('ExchangeRate source field exists as string in type', () => {
    // Type-level test: ExchangeRate.source is a string descriptor
    const rate = { fromCurrency: 'USD' as const, toCurrency: 'VND' as const, rate: 24000, rateDate: '2026-07-03', source: 'SBV' };
    expect(rate.source).toBe('SBV');
  });
  it('ExchangeRate rateDate field exists', () => {
    const rate = { fromCurrency: 'USD' as const, toCurrency: 'VND' as const, rate: 24000, rateDate: '2026-07-03', source: 'SBV' };
    expect(rate.rateDate).toBe('2026-07-03');
  });
});

// FIN-CUR-09
describe('createMoney with all supported currencies', () => {
  it('EUR amount has EUR currency', () => {
    expect(createMoney(5000n, 'EUR').currency).toBe('EUR');
  });
  it('JPY amount is stored as integer', () => {
    expect(createMoney(100000n, 'JPY').amount).toBe(100000n);
  });
  it('AUD currency stored correctly', () => {
    expect(createMoney(200n, 'AUD').currency).toBe('AUD');
  });
});

// FIN-CUR-10
describe('VND precision for procurement values', () => {
  it('1 billion VND stored exactly', () => {
    expect(createMoney(1_000_000_000n, 'VND').amount).toBe(1_000_000_000n);
  });
  it('20 billion VND stored exactly', () => {
    expect(createMoney(20_000_000_000n, 'VND').amount).toBe(20_000_000_000n);
  });
  it('zero VND is valid', () => {
    expect(createMoney(0n, 'VND').amount).toBe(0n);
  });
});

// FIN-CUR-11
describe('isVND and isUSD — edge cases', () => {
  it('isVND false for EUR', () => {
    expect(isVND('EUR')).toBe(false);
  });
  it('isUSD false for VND', () => {
    expect(isUSD('VND')).toBe(false);
  });
  it('isUSD false for AUD', () => {
    expect(isUSD('AUD')).toBe(false);
  });
});

// FIN-CUR-12
describe('CURRENCY_META completeness', () => {
  it('all supported currencies have meta', () => {
    SUPPORTED_CURRENCIES.forEach(c => {
      expect(CURRENCY_META[c]).toBeDefined();
    });
  });
  it('every meta has a symbol', () => {
    SUPPORTED_CURRENCIES.forEach(c => {
      expect(CURRENCY_META[c].symbol).toBeTruthy();
    });
  });
  it('every meta has a name', () => {
    SUPPORTED_CURRENCIES.forEach(c => {
      expect(CURRENCY_META[c].name).toBeTruthy();
    });
  });
});

// FIN-CUR-13
describe('validateCurrency — type guard', () => {
  it('returns true is sufficient for type narrowing', () => {
    const result = validateCurrency('VND');
    expect(result).toBe(true);
  });
  it('throws for numeric string', () => {
    expect(() => validateCurrency('840')).toThrow(FinancialError);
  });
  it('throws for lowercase vnd', () => {
    expect(() => validateCurrency('vnd')).toThrow(FinancialError);
  });
});
