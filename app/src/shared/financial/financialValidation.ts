import type { Money } from './money';
import { FinancialError, isPositiveMoney, compareMoney } from './money';
import { SUPPORTED_CURRENCIES } from './currency';
import { validateRetentionRate } from './retentionMoney';
import { validateGuaranteeRate } from './guarantee';
import type { GuaranteeType } from './guarantee';
import type { PaymentMilestone } from './paymentSchedule';
import type { BudgetAllocation } from './budgetAllocation';
import type { FundingCommitment } from './fundingSource';
import type { LegalBasis } from './financialFactory';

export interface ValidationResult {
  readonly valid:  boolean;
  readonly errors: readonly string[];
}

function ok(): ValidationResult  { return { valid: true,  errors: [] }; }
function fail(msg: string): ValidationResult { return { valid: false, errors: [msg] }; }
function fails(msgs: string[]): ValidationResult { return { valid: false, errors: msgs }; }

export function validateMoney(m: Money): ValidationResult {
  const errs: string[] = [];
  if (!(SUPPORTED_CURRENCIES as readonly string[]).includes(m.currency))
    errs.push(`Unsupported currency: ${m.currency}`);
  if (m.amount < 0n)
    errs.push(`Amount cannot be negative: ${m.amount}`);
  return errs.length ? fails(errs) : ok();
}

export function assertValidMoney(m: Money): void {
  const r = validateMoney(m);
  if (!r.valid) throw new FinancialError('INVALID_AMOUNT', 'money', r.errors.join('; '));
}

export function validateBudgetAllocation(allocation: BudgetAllocation): ValidationResult {
  const errs: string[] = [];
  if (!allocation.allocationCode.trim())       errs.push('allocationCode is required');
  if (!allocation.fundSourceCode.trim())       errs.push('fundSourceCode is required');
  if (!allocation.departmentCode.trim())       errs.push('departmentCode is required');
  if (allocation.fiscalYear < 2000 || allocation.fiscalYear > 2100)
    errs.push(`Fiscal year out of range: ${allocation.fiscalYear}`);
  if (allocation.availableAmount.amount < 0n)  errs.push('availableAmount cannot be negative');
  return errs.length ? fails(errs) : ok();
}

export function validateFundingCommitment(commitment: FundingCommitment): ValidationResult {
  const errs: string[] = [];
  if (!commitment.allocationId.trim())     errs.push('allocationId is required');
  if (!commitment.committedBy.trim())      errs.push('committedBy is required');
  if (!isPositiveMoney(commitment.amount)) errs.push('commitment amount must be positive');
  return errs.length ? fails(errs) : ok();
}

export function validateGuaranteeRateResult(type: GuaranteeType, rate: number): ValidationResult {
  try {
    validateGuaranteeRate(type, rate);
    return ok();
  } catch (e) {
    return fail((e as Error).message);
  }
}

export function validateRetentionRateResult(rate: number): ValidationResult {
  try {
    validateRetentionRate(rate);
    return ok();
  } catch (e) {
    return fail((e as Error).message);
  }
}

export function validatePaymentMilestone(milestone: PaymentMilestone): ValidationResult {
  const errs: string[] = [];
  if (!milestone.code.trim())              errs.push('code is required');
  if (!milestone.description.trim())       errs.push('description is required');
  if (!isPositiveMoney(milestone.dueAmount)) errs.push('dueAmount must be positive');
  if (!milestone.scheduledDate)            errs.push('scheduledDate is required');
  return errs.length ? fails(errs) : ok();
}

// Advance rate per TT 79/2025/TT-BTC: ≤ 30% for most package types
export const MAX_ADVANCE_RATE = 0.30;

export function validateAdvanceRate(rate: number): ValidationResult {
  if (rate < 0 || rate > MAX_ADVANCE_RATE)
    return fail(`Advance rate ${rate} exceeds maximum allowed ${MAX_ADVANCE_RATE} (TT 79/2025/TT-BTC)`);
  return ok();
}

export function validateFiscalYear(year: number): ValidationResult {
  if (!Number.isInteger(year) || year < 2000 || year > 2100)
    return fail(`Fiscal year out of range: ${year}`);
  return ok();
}

export function validateLegalBasis(basis: LegalBasis): ValidationResult {
  if (!basis.document?.trim())
    return fail('LegalBasis.document is required');
  return ok();
}

export function validateLegalBasisArray(bases: readonly LegalBasis[]): ValidationResult {
  const errs: string[] = [];
  bases.forEach((b, i) => {
    if (!b.document?.trim()) errs.push(`bases[${i}].document is required`);
  });
  return errs.length ? fails(errs) : ok();
}
