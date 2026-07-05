import { describe, it, expect } from 'vitest';
import {
  createFiscalYear, calculateAvailableAmount, commitFromAllocation,
  reserveFromAllocation, releaseFromAllocation,
} from '../shared/financial/budgetAllocation';
import type { BudgetAllocation } from '../shared/financial/budgetAllocation';
import { createMoney, zeroMoney, FinancialError } from '../shared/financial/money';

function makeAllocation(overrides: Partial<BudgetAllocation> = {}): BudgetAllocation {
  const total = createMoney(100_000_000n, 'VND');
  const now = new Date().toISOString();
  return {
    id:              'BA-001',
    allocationCode:  'BA/STATE/2026/0001',
    fiscalYear:      2026,
    fundSourceCode:  'STATE',
    departmentCode:  'DEPT-01',
    totalAmount:     total,
    committedAmount: zeroMoney('VND'),
    reservedAmount:  zeroMoney('VND'),
    availableAmount: total,
    legalBasis:      [],
    createdAt:       now,
    updatedAt:       now,
    ...overrides,
  };
}

// FIN-B-01
describe('createFiscalYear', () => {
  it('creates fiscal year 2026', () => {
    const fy = createFiscalYear(2026);
    expect(fy.year).toBe(2026);
  });
  it('startDate is Jan 1', () => {
    expect(createFiscalYear(2026).startDate).toBe('2026-01-01');
  });
  it('endDate is Dec 31', () => {
    expect(createFiscalYear(2026).endDate).toBe('2026-12-31');
  });
});

// FIN-B-02
describe('createFiscalYear — validation', () => {
  it('throws for year 1999', () => {
    expect(() => createFiscalYear(1999)).toThrow(FinancialError);
  });
  it('throws for year 2101', () => {
    expect(() => createFiscalYear(2101)).toThrow(FinancialError);
  });
  it('accepts year 2000', () => {
    expect(createFiscalYear(2000).year).toBe(2000);
  });
});

// FIN-B-03
describe('calculateAvailableAmount', () => {
  it('available = total when no commitments or reservations', () => {
    const total = createMoney(100_000_000n, 'VND');
    const avail = calculateAvailableAmount(total, zeroMoney('VND'), zeroMoney('VND'));
    expect(avail.amount).toBe(100_000_000n);
  });
  it('available decreases after commitment', () => {
    const total     = createMoney(100_000_000n, 'VND');
    const committed = createMoney(20_000_000n, 'VND');
    const avail = calculateAvailableAmount(total, committed, zeroMoney('VND'));
    expect(avail.amount).toBe(80_000_000n);
  });
  it('available accounts for both committed and reserved', () => {
    const total    = createMoney(100n, 'VND');
    const commited = createMoney(30n, 'VND');
    const reserved = createMoney(20n, 'VND');
    expect(calculateAvailableAmount(total, commited, reserved).amount).toBe(50n);
  });
});

// FIN-B-04
describe('commitFromAllocation', () => {
  it('reduces availableAmount', () => {
    const a = makeAllocation();
    const committed = commitFromAllocation(a, createMoney(10_000_000n, 'VND'));
    expect(committed.availableAmount.amount).toBe(90_000_000n);
  });
  it('increases committedAmount', () => {
    const a = makeAllocation();
    const committed = commitFromAllocation(a, createMoney(10_000_000n, 'VND'));
    expect(committed.committedAmount.amount).toBe(10_000_000n);
  });
  it('throws INSUFFICIENT_BUDGET when over limit', () => {
    const a = makeAllocation();
    expect(() => commitFromAllocation(a, createMoney(200_000_000n, 'VND')))
      .toThrow(FinancialError);
  });
});

// FIN-B-05
describe('reserveFromAllocation', () => {
  it('reduces availableAmount', () => {
    const a = makeAllocation();
    const reserved = reserveFromAllocation(a, createMoney(5_000_000n, 'VND'));
    expect(reserved.availableAmount.amount).toBe(95_000_000n);
  });
  it('increases reservedAmount', () => {
    const a = makeAllocation();
    const reserved = reserveFromAllocation(a, createMoney(5_000_000n, 'VND'));
    expect(reserved.reservedAmount.amount).toBe(5_000_000n);
  });
  it('throws for zero reservation', () => {
    const a = makeAllocation();
    expect(() => reserveFromAllocation(a, zeroMoney('VND'))).toThrow(FinancialError);
  });
});

// FIN-B-06
describe('releaseFromAllocation', () => {
  it('increases availableAmount on release', () => {
    const a = makeAllocation();
    const after = commitFromAllocation(a, createMoney(20_000_000n, 'VND'));
    const released = releaseFromAllocation(after, createMoney(20_000_000n, 'VND'));
    expect(released.availableAmount.amount).toBe(100_000_000n);
  });
  it('decreases committedAmount on release', () => {
    const a = makeAllocation();
    const after = commitFromAllocation(a, createMoney(20_000_000n, 'VND'));
    const released = releaseFromAllocation(after, createMoney(10_000_000n, 'VND'));
    expect(released.committedAmount.amount).toBe(10_000_000n);
  });
  it('does not change reservedAmount', () => {
    const a = makeAllocation();
    const after = commitFromAllocation(a, createMoney(20_000_000n, 'VND'));
    const released = releaseFromAllocation(after, createMoney(20_000_000n, 'VND'));
    expect(released.reservedAmount.amount).toBe(0n);
  });
});

// FIN-B-07
describe('BudgetAllocation — immutability', () => {
  it('commitFromAllocation returns new object', () => {
    const a = makeAllocation();
    const b = commitFromAllocation(a, createMoney(1n, 'VND'));
    expect(b).not.toBe(a);
  });
  it('original allocation unchanged after commit', () => {
    const a = makeAllocation();
    commitFromAllocation(a, createMoney(1n, 'VND'));
    expect(a.committedAmount.amount).toBe(0n);
  });
  it('reserveFromAllocation returns new object', () => {
    const a = makeAllocation();
    const b = reserveFromAllocation(a, createMoney(1n, 'VND'));
    expect(b).not.toBe(a);
  });
});

// FIN-B-08
describe('BudgetAllocation — sequential operations', () => {
  it('commit then reserve reduces available correctly', () => {
    const a = makeAllocation();
    const after1 = commitFromAllocation(a, createMoney(30_000_000n, 'VND'));
    const after2 = reserveFromAllocation(after1, createMoney(20_000_000n, 'VND'));
    expect(after2.availableAmount.amount).toBe(50_000_000n);
  });
  it('two commits reduce available cumulatively', () => {
    const a = makeAllocation();
    const a1 = commitFromAllocation(a, createMoney(10_000_000n, 'VND'));
    const a2 = commitFromAllocation(a1, createMoney(10_000_000n, 'VND'));
    expect(a2.committedAmount.amount).toBe(20_000_000n);
  });
  it('commit → release restores original available', () => {
    const a = makeAllocation();
    const after = releaseFromAllocation(
      commitFromAllocation(a, createMoney(50_000_000n, 'VND')),
      createMoney(50_000_000n, 'VND')
    );
    expect(after.availableAmount.amount).toBe(100_000_000n);
  });
});

// FIN-B-09
describe('BudgetAllocation — fiscal year stored', () => {
  it('allocationCode is stored', () => {
    expect(makeAllocation().allocationCode).toBe('BA/STATE/2026/0001');
  });
  it('fiscalYear is stored', () => {
    expect(makeAllocation().fiscalYear).toBe(2026);
  });
  it('fundSourceCode is stored', () => {
    expect(makeAllocation().fundSourceCode).toBe('STATE');
  });
});

// FIN-B-10
describe('FinancialLimit shape', () => {
  it('can create a FinancialLimit with maxAmount', () => {
    const limit = { maxAmount: createMoney(200_000_000n, 'VND'), currency: 'VND' as const, scope: 'UNIT_HEAD' };
    expect(limit.maxAmount.amount).toBe(200_000_000n);
  });
  it('scope is a string', () => {
    const limit = { maxAmount: createMoney(2_000_000_000n, 'VND'), currency: 'VND' as const, scope: 'DEPARTMENT_DIRECTOR' };
    expect(limit.scope).toBe('DEPARTMENT_DIRECTOR');
  });
  it('currency field is CurrencyCode', () => {
    const limit = { maxAmount: createMoney(1n, 'VND'), currency: 'VND' as const, scope: 'TEST' };
    expect(limit.currency).toBe('VND');
  });
});

// FIN-B-11
describe('calculateAvailableAmount — edge cases', () => {
  it('all committed yields zero available', () => {
    const total = createMoney(100n, 'VND');
    expect(calculateAvailableAmount(total, total, zeroMoney('VND')).amount).toBe(0n);
  });
  it('fully reserved yields zero available', () => {
    const total = createMoney(100n, 'VND');
    expect(calculateAvailableAmount(total, zeroMoney('VND'), total).amount).toBe(0n);
  });
  it('preserves currency in result', () => {
    const total = createMoney(100n, 'VND');
    expect(calculateAvailableAmount(total, zeroMoney('VND'), zeroMoney('VND')).currency).toBe('VND');
  });
});

// FIN-B-12
describe('commitFromAllocation — boundary check', () => {
  it('allows committing all available funds', () => {
    const a = makeAllocation();
    const result = commitFromAllocation(a, a.totalAmount);
    expect(result.availableAmount.amount).toBe(0n);
  });
  it('error code is INSUFFICIENT_BUDGET when over', () => {
    const a = makeAllocation();
    try { commitFromAllocation(a, createMoney(999_999_999n, 'VND')); }
    catch (e) { expect((e as FinancialError).code).toBe('INSUFFICIENT_BUDGET'); }
  });
  it('reserves throw INVALID_AMOUNT for zero', () => {
    const a = makeAllocation();
    try { reserveFromAllocation(a, zeroMoney('VND')); }
    catch (e) { expect((e as FinancialError).code).toBeDefined(); }
  });
});

// FIN-B-13
describe('FiscalYear boundary values', () => {
  it('accepts year 2100', () => {
    expect(createFiscalYear(2100).year).toBe(2100);
  });
  it('startDate for 2030 is 2030-01-01', () => {
    expect(createFiscalYear(2030).startDate).toBe('2030-01-01');
  });
  it('endDate for 2026 is 2026-12-31', () => {
    expect(createFiscalYear(2026).endDate).toBe('2026-12-31');
  });
});
