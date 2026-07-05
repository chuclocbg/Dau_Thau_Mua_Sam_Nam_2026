import { describe, it, expect } from 'vitest';
import {
  FUNDING_SOURCE_TYPES,
  createFundingCommitment, releaseFundingCommitment,
  createFundingReservation, consumeFundingReservation, cancelFundingReservation,
} from '../shared/financial/fundingSource';
import { createMoney, FinancialError } from '../shared/financial/money';

function commitment(overrides = {}) {
  return createFundingCommitment({
    id: 'C-001', allocationId: 'BA-001', amount: createMoney(10_000_000n, 'VND'),
    committedBy: 'USER-01', ...overrides,
  });
}

function reservation(overrides = {}) {
  return createFundingReservation({
    id: 'R-001', allocationId: 'BA-001',
    reservedAmount: createMoney(5_000_000n, 'VND'),
    purpose: 'Package procurement reserve', reservedBy: 'USER-01', ...overrides,
  });
}

// FIN-F-01
describe('FundingSourceType', () => {
  it('includes STATE', () => {
    expect(FUNDING_SOURCE_TYPES).toContain('STATE');
  });
  it('includes ODA', () => {
    expect(FUNDING_SOURCE_TYPES).toContain('ODA');
  });
  it('has 4 types', () => {
    expect(FUNDING_SOURCE_TYPES).toHaveLength(4);
  });
});

// FIN-F-02
describe('createFundingCommitment — happy path', () => {
  it('creates ACTIVE commitment', () => {
    expect(commitment().status).toBe('ACTIVE');
  });
  it('stores allocationId', () => {
    expect(commitment().allocationId).toBe('BA-001');
  });
  it('stores amount', () => {
    expect(commitment().amount.amount).toBe(10_000_000n);
  });
});

// FIN-F-03
describe('createFundingCommitment — validation', () => {
  it('throws for empty allocationId', () => {
    expect(() => commitment({ allocationId: '' })).toThrow(FinancialError);
  });
  it('throws for zero amount', () => {
    expect(() => commitment({ amount: createMoney(0n, 'VND') })).toThrow(FinancialError);
  });
  it('committedAt is set to now', () => {
    const c = commitment();
    expect(c.committedAt).toBeTruthy();
  });
});

// FIN-F-04
describe('createFundingCommitment — optional fields', () => {
  it('stores packageId when provided', () => {
    const c = commitment({ packageId: 'PKG-001' });
    expect(c.packageId).toBe('PKG-001');
  });
  it('stores notes when provided', () => {
    const c = commitment({ notes: 'Ghi chú' });
    expect(c.notes).toBe('Ghi chú');
  });
  it('packageId is undefined when not provided', () => {
    expect(commitment().packageId).toBeUndefined();
  });
});

// FIN-F-05
describe('releaseFundingCommitment', () => {
  it('transitions ACTIVE → RELEASED', () => {
    expect(releaseFundingCommitment(commitment()).status).toBe('RELEASED');
  });
  it('throws for non-ACTIVE commitment', () => {
    const c = releaseFundingCommitment(commitment());
    expect(() => releaseFundingCommitment(c)).toThrow(FinancialError);
  });
  it('error code is INVALID_STATUS', () => {
    const c = releaseFundingCommitment(commitment());
    try { releaseFundingCommitment(c); }
    catch (e) { expect((e as FinancialError).code).toBe('INVALID_STATUS'); }
  });
});

// FIN-F-06
describe('createFundingReservation — happy path', () => {
  it('creates RESERVED reservation', () => {
    expect(reservation().status).toBe('RESERVED');
  });
  it('stores reservedAmount', () => {
    expect(reservation().reservedAmount.amount).toBe(5_000_000n);
  });
  it('stores purpose', () => {
    expect(reservation().purpose).toBe('Package procurement reserve');
  });
});

// FIN-F-07
describe('createFundingReservation — validation', () => {
  it('throws for empty purpose', () => {
    expect(() => reservation({ purpose: '' })).toThrow(FinancialError);
  });
  it('throws for zero reservedAmount', () => {
    expect(() => reservation({ reservedAmount: createMoney(0n, 'VND') })).toThrow(FinancialError);
  });
  it('reservedAt is set', () => {
    expect(reservation().reservedAt).toBeTruthy();
  });
});

// FIN-F-08
describe('consumeFundingReservation', () => {
  it('transitions RESERVED → CONSUMED', () => {
    expect(consumeFundingReservation(reservation()).status).toBe('CONSUMED');
  });
  it('throws when already CONSUMED', () => {
    const r = consumeFundingReservation(reservation());
    expect(() => consumeFundingReservation(r)).toThrow(FinancialError);
  });
  it('returns new object', () => {
    const r = reservation();
    expect(consumeFundingReservation(r)).not.toBe(r);
  });
});

// FIN-F-09
describe('cancelFundingReservation', () => {
  it('transitions RESERVED → CANCELLED', () => {
    expect(cancelFundingReservation(reservation()).status).toBe('CANCELLED');
  });
  it('throws when CONSUMED', () => {
    const r = consumeFundingReservation(reservation());
    expect(() => cancelFundingReservation(r)).toThrow(FinancialError);
  });
  it('error code is INVALID_STATUS for CONSUMED', () => {
    const r = consumeFundingReservation(reservation());
    try { cancelFundingReservation(r); }
    catch (e) { expect((e as FinancialError).code).toBe('INVALID_STATUS'); }
  });
});

// FIN-F-10
describe('FundingCommitment — immutability', () => {
  it('release returns new object', () => {
    const c = commitment();
    const released = releaseFundingCommitment(c);
    expect(released).not.toBe(c);
  });
  it('original commitment status unchanged after release', () => {
    const c = commitment();
    releaseFundingCommitment(c);
    expect(c.status).toBe('ACTIVE');
  });
  it('original reservation unchanged after consume', () => {
    const r = reservation();
    consumeFundingReservation(r);
    expect(r.status).toBe('RESERVED');
  });
});

// FIN-F-11
describe('FundingCommitment — createdAt/updatedAt', () => {
  it('commitment has createdAt', () => {
    expect(commitment().createdAt).toBeTruthy();
  });
  it('commitment has updatedAt', () => {
    expect(commitment().updatedAt).toBeTruthy();
  });
  it('reservation has createdAt', () => {
    expect(reservation().createdAt).toBeTruthy();
  });
});

// FIN-F-12
describe('cancelFundingReservation — from CANCELLED', () => {
  it('can cancel an already-CANCELLED reservation again (idempotent cancel)', () => {
    const r = cancelFundingReservation(reservation());
    // CANCELLED → CANCELLED is fine (status is not CONSUMED)
    expect(() => cancelFundingReservation(r)).not.toThrow();
  });
  it('cancelled reservation has CANCELLED status', () => {
    expect(cancelFundingReservation(reservation()).status).toBe('CANCELLED');
  });
  it('cancelling a CANCELLED returns new object with CANCELLED', () => {
    const r = cancelFundingReservation(reservation());
    const r2 = cancelFundingReservation(r);
    expect(r2.status).toBe('CANCELLED');
  });
});

// FIN-F-13
describe('FundingReservation — notes field', () => {
  it('stores notes when provided', () => {
    const r = createFundingReservation({
      id: 'R-002', allocationId: 'BA-001',
      reservedAmount: createMoney(1n, 'VND'),
      purpose: 'Test', reservedBy: 'U', notes: 'Ghi chú test',
    });
    expect(r.notes).toBe('Ghi chú test');
  });
  it('notes is undefined when not provided', () => {
    expect(reservation().notes).toBeUndefined();
  });
  it('id is stored', () => {
    expect(reservation().id).toBe('R-001');
  });
});
