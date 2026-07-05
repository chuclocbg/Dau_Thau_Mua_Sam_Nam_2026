import type { Money, CurrencyCode } from './money';
import { FinancialError, addMoney, subtractMoney, compareMoney, zeroMoney } from './money';
import type { LegalBasis } from './financialFactory';

export interface FiscalYear {
  readonly year:      number;  // e.g. 2026
  readonly startDate: string;  // YYYY-MM-DD
  readonly endDate:   string;  // YYYY-MM-DD
}

export interface FinancialLimit {
  readonly maxAmount: Money;
  readonly currency:  CurrencyCode;
  readonly scope:     string; // "UNIT" | "DEPARTMENT" | "MINISTRY" or free description
}

export interface AnnualBudget {
  readonly id:             string;
  readonly fiscalYear:     number;
  readonly fundSourceCode: string; // references masterdata FundSource.code
  readonly totalAmount:    Money;
  readonly allocatedAmount: Money;
  readonly description?:   string;
  readonly legalBasis:     readonly LegalBasis[];
  readonly createdAt:      string;
  readonly updatedAt:      string;
}

export interface BudgetAllocation {
  readonly id:              string;
  readonly allocationCode:  string;
  readonly fiscalYear:      number;
  readonly fundSourceCode:  string; // references masterdata FundSource.code
  readonly departmentCode:  string; // references masterdata Department.code
  readonly totalAmount:     Money;
  readonly committedAmount: Money;
  readonly reservedAmount:  Money;
  readonly availableAmount: Money; // derived: totalAmount - committedAmount - reservedAmount
  readonly legalBasis:      readonly LegalBasis[];
  readonly notes?:          string;
  readonly createdAt:       string;
  readonly updatedAt:       string;
}

export function createFiscalYear(year: number): FiscalYear {
  if (year < 2000 || year > 2100)
    throw new FinancialError('INVALID_FISCAL_YEAR', 'year', `Fiscal year out of range: ${year}`);
  return {
    year,
    startDate: `${year}-01-01`,
    endDate:   `${year}-12-31`,
  };
}

export function calculateAvailableAmount(
  total:     Money,
  committed: Money,
  reserved:  Money,
): Money {
  return subtractMoney(subtractMoney(total, committed), reserved);
}

export function commitFromAllocation(allocation: BudgetAllocation, amount: Money): BudgetAllocation {
  const newCommitted = addMoney(allocation.committedAmount, amount);
  // Check before subtractMoney (which would throw NEGATIVE_AMOUNT, not INSUFFICIENT_BUDGET)
  if (newCommitted.amount + allocation.reservedAmount.amount > allocation.totalAmount.amount)
    throw new FinancialError('INSUFFICIENT_BUDGET', 'amount',
      `Insufficient budget: committing ${amount.amount} exceeds available ${allocation.availableAmount.amount}`);
  const newAvailable = calculateAvailableAmount(allocation.totalAmount, newCommitted, allocation.reservedAmount);
  return {
    ...allocation,
    committedAmount: newCommitted,
    availableAmount: newAvailable,
    updatedAt: new Date().toISOString(),
  };
}

export function reserveFromAllocation(allocation: BudgetAllocation, amount: Money): BudgetAllocation {
  const newReserved  = addMoney(allocation.reservedAmount, amount);
  const newAvailable = calculateAvailableAmount(allocation.totalAmount, allocation.committedAmount, newReserved);
  if (compareMoney(amount, zeroMoney(amount.currency)) <= 0)
    throw new FinancialError('INVALID_AMOUNT', 'amount', 'Reserve amount must be positive');
  if (newAvailable.amount < 0n)
    throw new FinancialError('INSUFFICIENT_BUDGET', 'amount', 'Insufficient budget for reservation');
  return {
    ...allocation,
    reservedAmount:  newReserved,
    availableAmount: newAvailable,
    updatedAt: new Date().toISOString(),
  };
}

export function releaseFromAllocation(allocation: BudgetAllocation, amount: Money): BudgetAllocation {
  const newCommitted = subtractMoney(allocation.committedAmount, amount);
  const newAvailable = calculateAvailableAmount(allocation.totalAmount, newCommitted, allocation.reservedAmount);
  return {
    ...allocation,
    committedAmount: newCommitted,
    availableAmount: newAvailable,
    updatedAt: new Date().toISOString(),
  };
}
