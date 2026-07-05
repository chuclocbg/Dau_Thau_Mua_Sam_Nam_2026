/**
 * Payment Validation
 *
 * ALL validation that involves legal limits (advance rates, retention rates,
 * guarantee requirements, payment deadlines) routes through the PaymentRuleEngine.
 * No percentages or day counts are hardcoded here.
 */

import type { Money } from '../shared/financial/money';
import { compareMoney, multiplyMoney } from '../shared/financial/money';
import { PROCUREMENT_LEGAL_BASIS } from '../shared/financial/financialFactory';
import type { PaymentRequest, PaymentValidationResult, CreatePaymentRequestParams } from './paymentTypes';
import { PAYMENT_TYPES, PAYMENT_STATUSES } from './paymentTypes';
import type { PaymentRuleContext, PaymentLegalRule } from './paymentLegalRule';
import { resolvePaymentRule } from './paymentLegalRule';
import { PAYMENT_LEGAL_RULES } from './paymentRuleRegistry';

// ─── Context builder ──────────────────────────────────────────────────────────

export function buildRuleContext(
  packageType: string,
  fundSource:  string,
  asOfDate:    string,
  authority?:  string,
): PaymentRuleContext {
  return { packageType, fundSource, authority, asOfDate };
}

// ─── Validate PaymentRequest params ──────────────────────────────────────────

export function validateCreatePaymentRequestParams(
  params: CreatePaymentRequestParams,
): PaymentValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!params.requestCode?.trim())       errors.push('requestCode is required');
  if (!params.contractId?.trim())        errors.push('contractId is required');
  if (!params.requestedBy?.trim())       errors.push('requestedBy is required');
  if (!params.department?.trim())        errors.push('department is required');
  if (!PAYMENT_TYPES.includes(params.paymentType as never))
    errors.push(`paymentType '${params.paymentType}' is not valid`);
  if (!params.amount || params.amount.amount <= 0n)
    errors.push('amount must be positive');
  if (!params.legalBasis?.length)
    warnings.push('No legalBasis provided; will use PROCUREMENT_LEGAL_BASIS defaults');

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    legalBasis: params.legalBasis ?? PROCUREMENT_LEGAL_BASIS,
  };
}

// ─── Validate advance amount against resolved rule ────────────────────────────

export function validateAdvanceAmount(params: {
  amount:        Money;
  contractValue: Money;
  packageType:   string;
  fundSource:    string;
  asOfDate:      string;
  rules?:        readonly PaymentLegalRule[];
}): PaymentValidationResult {
  const rules = params.rules ?? PAYMENT_LEGAL_RULES;
  const ctx = buildRuleContext(params.packageType, params.fundSource, params.asOfDate);
  const resolution = resolvePaymentRule('ADVANCE_RATE', ctx, rules);

  if (!resolution.resolved || !resolution.rule) {
    return {
      valid: false,
      errors: [`No ADVANCE_RATE rule found for packageType=${params.packageType} fundSource=${params.fundSource}`],
      warnings: [],
      legalBasis: [],
    };
  }

  const maxRate = resolution.params['maxRate'] ?? 1;
  const maxAllowed = multiplyMoney(params.contractValue, maxRate);
  const errors: string[] = [];
  if (compareMoney(params.amount, maxAllowed) > 0) {
    errors.push(
      `Advance amount exceeds rule ${resolution.rule.ruleId}: max rate is ${(maxRate * 100).toFixed(0)}% of contract value`,
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings: [],
    resolvedRule: resolution.rule.ruleId,
    legalBasis: resolution.legalBasis,
  };
}

// ─── Validate retention rate ──────────────────────────────────────────────────

export function validateRetentionRate(params: {
  rate:        number;
  packageType: string;
  fundSource:  string;
  asOfDate:    string;
  rules?:      readonly PaymentLegalRule[];
}): PaymentValidationResult {
  const rules = params.rules ?? PAYMENT_LEGAL_RULES;
  const ctx = buildRuleContext(params.packageType, params.fundSource, params.asOfDate);
  const resolution = resolvePaymentRule('RETENTION_RATE', ctx, rules);

  if (!resolution.resolved || !resolution.rule) {
    return {
      valid: false,
      errors: ['No RETENTION_RATE rule found for context'],
      warnings: [],
      legalBasis: [],
    };
  }

  const maxRate = resolution.params['maxRate'] ?? 1;
  const errors: string[] = [];
  if (params.rate > maxRate)
    errors.push(`Retention rate ${(params.rate * 100).toFixed(1)}% exceeds max ${(maxRate * 100).toFixed(0)}% per ${resolution.rule.ruleId}`);
  if (params.rate < 0)
    errors.push('Retention rate must not be negative');

  return {
    valid: errors.length === 0,
    errors,
    warnings: [],
    resolvedRule: resolution.rule.ruleId,
    legalBasis: resolution.legalBasis,
  };
}

// ─── Validate guarantee rate ──────────────────────────────────────────────────

export function validateGuaranteeRate(params: {
  guaranteeType: 'PERFORMANCE' | 'WARRANTY' | 'ADVANCE';
  rate:          number;
  packageType:   string;
  fundSource:    string;
  asOfDate:      string;
  rules?:        readonly PaymentLegalRule[];
}): PaymentValidationResult {
  const rules = params.rules ?? PAYMENT_LEGAL_RULES;
  const ctx = buildRuleContext(params.packageType, params.fundSource, params.asOfDate);
  const resolution = resolvePaymentRule('GUARANTEE_REQUIREMENT', ctx, rules);

  if (!resolution.resolved || !resolution.rule) {
    return {
      valid: true,
      errors: [],
      warnings: [`No GUARANTEE_REQUIREMENT rule found for ${params.guaranteeType}`],
      legalBasis: [],
    };
  }

  const minRate = resolution.params['minRate'] ?? 0;
  const maxRate = resolution.params['maxRate'] ?? 1;
  const errors: string[] = [];
  if (params.rate < minRate)
    errors.push(`Guarantee rate ${(params.rate * 100).toFixed(1)}% below minimum ${(minRate * 100).toFixed(0)}%`);
  if (params.rate > maxRate)
    errors.push(`Guarantee rate ${(params.rate * 100).toFixed(1)}% exceeds maximum ${(maxRate * 100).toFixed(0)}%`);

  return {
    valid: errors.length === 0,
    errors,
    warnings: [],
    resolvedRule: resolution.rule.ruleId,
    legalBasis: resolution.legalBasis,
  };
}

// ─── Validate payment deadline ────────────────────────────────────────────────

export function validatePaymentDeadline(params: {
  daysSinceAcceptance: number;
  packageType:         string;
  fundSource:          string;
  asOfDate:            string;
  rules?:              readonly PaymentLegalRule[];
}): PaymentValidationResult {
  const rules = params.rules ?? PAYMENT_LEGAL_RULES;
  const ctx = buildRuleContext(params.packageType, params.fundSource, params.asOfDate);
  const resolution = resolvePaymentRule('PAYMENT_DEADLINE', ctx, rules);

  if (!resolution.resolved || !resolution.rule) {
    return { valid: true, errors: [], warnings: ['No PAYMENT_DEADLINE rule found'], legalBasis: [] };
  }

  const maxDays = resolution.params['maxDaysAfterAcceptance'] ?? 9999;
  const errors: string[] = [];
  if (params.daysSinceAcceptance > maxDays)
    errors.push(`Payment overdue: ${params.daysSinceAcceptance} days since acceptance exceeds limit of ${maxDays} days per ${resolution.rule.ruleId}`);

  return {
    valid: errors.length === 0,
    errors,
    warnings: [],
    resolvedRule: resolution.rule.ruleId,
    legalBasis: resolution.legalBasis,
  };
}

// ─── Validate treasury requirement ────────────────────────────────────────────

export function requiresTreasurySubmission(params: {
  fundSource:  string;
  packageType: string;
  asOfDate:    string;
  rules?:      readonly PaymentLegalRule[];
}): boolean {
  const rules = params.rules ?? PAYMENT_LEGAL_RULES;
  const ctx = buildRuleContext(params.packageType, params.fundSource, params.asOfDate);
  const resolution = resolvePaymentRule('TREASURY_THRESHOLD', ctx, rules);
  return resolution.resolved && (resolution.params['required'] ?? 0) === 1;
}

// ─── Validate full PaymentRequest status transition ───────────────────────────

export function validateStatusTransition(
  from: string,
  to:   string,
): PaymentValidationResult {
  const allowed: Record<string, readonly string[]> = {
    DRAFT:               ['PENDING_APPROVAL', 'CANCELLED'],
    PENDING_APPROVAL:    ['APPROVED', 'REJECTED', 'CANCELLED'],
    APPROVED:            ['SUBMITTED_TREASURY', 'SUSPENDED', 'CANCELLED'],
    SUBMITTED_TREASURY:  ['TREASURY_APPROVED', 'TREASURY_REJECTED'],
    TREASURY_APPROVED:   ['PAID'],
    TREASURY_REJECTED:   ['APPROVED', 'CANCELLED'],
    SUSPENDED:           ['APPROVED', 'CANCELLED'],
    PAID:                [],
    CANCELLED:           [],
    REJECTED:            [],
  };
  const valid = (allowed[from] ?? []).includes(to);
  return {
    valid,
    errors: valid ? [] : [`Transition from ${from} to ${to} is not permitted`],
    warnings: [],
    legalBasis: [],
  };
}

// ─── Validate PaymentRequest entity ──────────────────────────────────────────

export function validatePaymentRequest(req: PaymentRequest): PaymentValidationResult {
  const errors: string[] = [];
  if (!req.requestCode?.trim())   errors.push('requestCode is required');
  if (!req.contractId?.trim())    errors.push('contractId is required');
  if (!req.requestedBy?.trim())   errors.push('requestedBy is required');
  if (!req.department?.trim())    errors.push('department is required');
  if (!req.amount || req.amount.amount <= 0n) errors.push('amount must be positive');
  if (!PAYMENT_STATUSES.includes(req.status as never)) errors.push('status is invalid');

  return {
    valid: errors.length === 0,
    errors,
    warnings: [],
    legalBasis: req.legalBasis,
  };
}
