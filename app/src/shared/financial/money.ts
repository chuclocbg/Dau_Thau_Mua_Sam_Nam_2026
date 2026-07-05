export const FINANCIAL_ERROR_CODES = [
  'CURRENCY_MISMATCH', 'NEGATIVE_AMOUNT', 'ZERO_AMOUNT', 'INVALID_CURRENCY',
  'INVALID_RATE', 'INSUFFICIENT_BUDGET', 'INVALID_PERCENTAGE', 'INVALID_FISCAL_YEAR',
  'DUPLICATE_COMMITMENT', 'INVALID_GUARANTEE', 'EXPIRED_GUARANTEE', 'INVALID_RETENTION',
  'NOT_FOUND', 'INVALID_STATUS', 'INVALID_AMOUNT',
] as const;

export type FinancialErrorCode = typeof FINANCIAL_ERROR_CODES[number];

export class FinancialError extends Error {
  constructor(
    public readonly code: FinancialErrorCode,
    public readonly field: string,
    message: string,
  ) {
    super(message);
    this.name = 'FinancialError';
  }
}

export type CurrencyCode = 'VND' | 'USD' | 'EUR' | 'JPY' | 'AUD';

// Money is an immutable value object. amount is in the smallest unit of the currency.
// For VND (no sub-units): 1 VND = 1n. For USD (cents): 1 USD = 100n.
// We use bigint to avoid IEEE 754 floating-point rounding for large VNĐ values.
export interface Money {
  readonly amount:   bigint;
  readonly currency: CurrencyCode;
}

export function createMoney(amount: number | bigint, currency: CurrencyCode): Money {
  const big = typeof amount === 'bigint' ? amount : BigInt(Math.round(amount));
  if (big < 0n) throw new FinancialError('NEGATIVE_AMOUNT', 'amount', `Amount cannot be negative: ${amount}`);
  return { amount: big, currency };
}

export function zeroMoney(currency: CurrencyCode): Money { return { amount: 0n, currency }; }
export function isZeroMoney(m: Money): boolean { return m.amount === 0n; }
export function isPositiveMoney(m: Money): boolean { return m.amount > 0n; }

export function addMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b, 'add');
  return { amount: a.amount + b.amount, currency: a.currency };
}

export function subtractMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b, 'subtract');
  if (b.amount > a.amount)
    throw new FinancialError('NEGATIVE_AMOUNT', 'amount', 'Subtraction would yield negative amount');
  return { amount: a.amount - b.amount, currency: a.currency };
}

export function multiplyMoney(m: Money, factor: number): Money {
  if (factor < 0)
    throw new FinancialError('NEGATIVE_AMOUNT', 'factor', `Factor cannot be negative: ${factor}`);
  return { amount: BigInt(Math.round(Number(m.amount) * factor)), currency: m.currency };
}

export function compareMoney(a: Money, b: Money): -1 | 0 | 1 {
  assertSameCurrency(a, b, 'compare');
  return a.amount < b.amount ? -1 : a.amount > b.amount ? 1 : 0;
}

export function sumMoney(items: readonly Money[], currency: CurrencyCode): Money {
  return items.reduce((acc, m) => addMoney(acc, m), zeroMoney(currency));
}

export function formatMoney(m: Money): string {
  const n = Number(m.amount);
  if (m.currency === 'VND') return n.toLocaleString('vi-VN') + ' ₫';
  // For non-VND: amount stored as cents → divide by 100 for display
  return (n / 100).toLocaleString('en-US', { style: 'currency', currency: m.currency });
}

function assertSameCurrency(a: Money, b: Money, op: string): void {
  if (a.currency !== b.currency)
    throw new FinancialError('CURRENCY_MISMATCH', 'currency',
      `Cannot ${op} ${a.currency} and ${b.currency}`);
}
