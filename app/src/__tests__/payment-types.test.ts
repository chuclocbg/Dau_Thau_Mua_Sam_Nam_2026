import { describe, it, expect } from 'vitest';
import {
  PAYMENT_STATUSES, PAYMENT_TYPES, TREASURY_STATUSES, PAYMENT_ACTIONS,
  PaymentError,
  isPaymentStatus, isPaymentType, isTreasuryStatus, isPaymentAction,
} from '../payment/paymentTypes';
import { createMoney } from '../shared/financial/money';

const vnd = (n: number) => createMoney(BigInt(n), 'VND');

// PAY-T-01
describe('PAYMENT_STATUSES', () => {
  it('contains DRAFT', () => expect(PAYMENT_STATUSES).toContain('DRAFT'));
  it('contains PAID', ()  => expect(PAYMENT_STATUSES).toContain('PAID'));
  it('contains CANCELLED', () => expect(PAYMENT_STATUSES).toContain('CANCELLED'));
});

// PAY-T-02
describe('PAYMENT_TYPES', () => {
  it('contains ADVANCE', () => expect(PAYMENT_TYPES).toContain('ADVANCE'));
  it('contains PROGRESS', () => expect(PAYMENT_TYPES).toContain('PROGRESS'));
  it('contains RETENTION_RELEASE', () => expect(PAYMENT_TYPES).toContain('RETENTION_RELEASE'));
});

// PAY-T-03
describe('TREASURY_STATUSES', () => {
  it('contains SUBMITTED', () => expect(TREASURY_STATUSES).toContain('SUBMITTED'));
  it('contains APPROVED', () => expect(TREASURY_STATUSES).toContain('APPROVED'));
  it('contains REJECTED', () => expect(TREASURY_STATUSES).toContain('REJECTED'));
});

// PAY-T-04
describe('PAYMENT_ACTIONS', () => {
  it('contains CREATED', () => expect(PAYMENT_ACTIONS).toContain('CREATED'));
  it('contains TREASURY_APPROVED', () => expect(PAYMENT_ACTIONS).toContain('TREASURY_APPROVED'));
  it('contains SUSPENDED', () => expect(PAYMENT_ACTIONS).toContain('SUSPENDED'));
});

// PAY-T-05
describe('PaymentError', () => {
  it('has code property', () => {
    const e = new PaymentError('NOT_FOUND', 'id', 'not found');
    expect(e.code).toBe('NOT_FOUND');
  });
  it('has field property', () => {
    const e = new PaymentError('INVALID', 'amount', 'bad');
    expect(e.field).toBe('amount');
  });
  it('is instanceof Error', () => {
    expect(new PaymentError('X', 'y', 'z')).toBeInstanceOf(Error);
  });
});

// PAY-T-06
describe('isPaymentStatus', () => {
  it('returns true for DRAFT', () => expect(isPaymentStatus('DRAFT')).toBe(true));
  it('returns false for unknown', () => expect(isPaymentStatus('UNKNOWN')).toBe(false));
  it('returns false for non-string', () => expect(isPaymentStatus(42)).toBe(false));
});

// PAY-T-07
describe('isPaymentType', () => {
  it('returns true for ADVANCE', () => expect(isPaymentType('ADVANCE')).toBe(true));
  it('returns true for FINAL', () => expect(isPaymentType('FINAL')).toBe(true));
  it('returns false for unknown', () => expect(isPaymentType('LEND')).toBe(false));
});

// PAY-T-08
describe('isTreasuryStatus', () => {
  it('returns true for PENDING', () => expect(isTreasuryStatus('PENDING')).toBe(true));
  it('returns true for RETURNED', () => expect(isTreasuryStatus('RETURNED')).toBe(true));
  it('returns false for unknown', () => expect(isTreasuryStatus('DONE')).toBe(false));
});

// PAY-T-09
describe('isPaymentAction', () => {
  it('returns true for PAID', () => expect(isPaymentAction('PAID')).toBe(true));
  it('returns false for unknown', () => expect(isPaymentAction('DELETED')).toBe(false));
  it('returns false for non-string', () => expect(isPaymentAction(null)).toBe(false));
});

// PAY-T-10
describe('Money in payment context', () => {
  it('uses bigint amount', () => expect(vnd(1_000_000).amount).toBe(1_000_000n));
  it('currency is VND', () => expect(vnd(500).currency).toBe('VND'));
  it('large VND amount is exact', () => expect(vnd(50_000_000_000).amount).toBe(50_000_000_000n));
});

// PAY-T-11
describe('Payment type counts', () => {
  it('PAYMENT_TYPES has 6 items', () => expect(PAYMENT_TYPES.length).toBe(6));
  it('PAYMENT_STATUSES has 10 items', () => expect(PAYMENT_STATUSES.length).toBe(10));
  it('TREASURY_STATUSES has 5 items', () => expect(TREASURY_STATUSES.length).toBe(5));
});

// PAY-T-12
describe('ADVANCE and WARRANTY types', () => {
  it('WARRANTY_RELEASE is a payment type', () => expect(PAYMENT_TYPES).toContain('WARRANTY_RELEASE'));
  it('GUARANTEE_RELEASE is a payment type', () => expect(PAYMENT_TYPES).toContain('GUARANTEE_RELEASE'));
  it('PROGRESS is a payment type', () => expect(PAYMENT_TYPES).toContain('PROGRESS'));
});

// PAY-T-13
describe('Status values completeness', () => {
  it('PENDING_APPROVAL is a status', () => expect(PAYMENT_STATUSES).toContain('PENDING_APPROVAL'));
  it('SUBMITTED_TREASURY is a status', () => expect(PAYMENT_STATUSES).toContain('SUBMITTED_TREASURY'));
  it('TREASURY_REJECTED is a status', () => expect(PAYMENT_STATUSES).toContain('TREASURY_REJECTED'));
});
