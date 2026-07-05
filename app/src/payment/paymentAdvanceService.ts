/**
 * Advance Payment Service (Tạm ứng)
 *
 * Handles ADVANCE payment type.
 * All limits (maxRate) are resolved from the PaymentRuleEngine — never hardcoded.
 * The applicable rule is stored in PaymentRequest.resolvedRuleId for traceability.
 */

import type { Money } from '../shared/financial/money';
import { multiplyMoney } from '../shared/financial/money';
import type { LegalBasis } from '../shared/financial/financialFactory';
import type { PaymentRequest, CreatePaymentRequestParams } from './paymentTypes';
import { PaymentError } from './paymentTypes';
import type { IPaymentRequestRepository, IPaymentHistoryRepository } from './paymentRepository';
import type { PaymentLegalRule, PaymentRuleContext } from './paymentLegalRule';
import { resolvePaymentRule } from './paymentLegalRule';
import { PAYMENT_LEGAL_RULES } from './paymentRuleRegistry';
import { createPaymentRequest } from './paymentService';

export interface AdvancePaymentParams {
  requestCode:   string;
  contractId:    string;
  contractValue: Money;
  packageId?:    string;
  acceptanceId?: string;
  requestedBy:   string;
  department:    string;
  packageType:   string;
  fundSource:    string;
  advanceRate:   number;   // requested rate as decimal, e.g. 0.25 for 25%
  legalBasis?:   readonly LegalBasis[];
  notes?:        string;
  rules?:        readonly PaymentLegalRule[];  // injectable for testing
}

export interface AdvancePaymentResult {
  request:       PaymentRequest;
  resolvedRuleId: string;
  appliedRate:   number;
  maxRate:       number;
  advanceAmount: Money;
  legalBasis:    readonly LegalBasis[];
}

// ─── Create advance payment request ──────────────────────────────────────────

export async function createAdvancePaymentRequest(
  repo:        IPaymentRequestRepository,
  historyRepo: IPaymentHistoryRepository,
  params:      AdvancePaymentParams,
): Promise<AdvancePaymentResult> {
  const rules = params.rules ?? PAYMENT_LEGAL_RULES;
  const asOfDate = new Date().toISOString().slice(0, 10);
  const ctx: PaymentRuleContext = {
    packageType: params.packageType,
    fundSource:  params.fundSource,
    asOfDate,
  };

  const resolution = resolvePaymentRule('ADVANCE_RATE', ctx, rules);
  if (!resolution.resolved || !resolution.rule) {
    throw new PaymentError(
      'RULE_NOT_FOUND',
      'fundSource',
      `No ADVANCE_RATE rule for packageType=${params.packageType} fundSource=${params.fundSource}`,
    );
  }

  const maxRate = resolution.params['maxRate'] ?? 1;
  if (params.advanceRate > maxRate) {
    throw new PaymentError(
      'ADVANCE_RATE_EXCEEDED',
      'advanceRate',
      `Advance rate ${(params.advanceRate * 100).toFixed(1)}% exceeds maximum ${(maxRate * 100).toFixed(0)}% per rule ${resolution.rule.ruleId}`,
    );
  }

  const advanceAmount = multiplyMoney(params.contractValue, params.advanceRate);

  const createParams: CreatePaymentRequestParams = {
    requestCode:   params.requestCode,
    paymentType:   'ADVANCE',
    contractId:    params.contractId,
    packageId:     params.packageId,
    acceptanceId:  params.acceptanceId,
    requestedBy:   params.requestedBy,
    department:    params.department,
    amount:        advanceAmount,
    legalBasis:    params.legalBasis?.length ? params.legalBasis : resolution.legalBasis,
    notes:         params.notes,
  };

  const request = await createPaymentRequest(
    repo, historyRepo, createParams, resolution.rule.ruleId,
  );

  return {
    request,
    resolvedRuleId: resolution.rule.ruleId,
    appliedRate:    params.advanceRate,
    maxRate,
    advanceAmount,
    legalBasis:     resolution.legalBasis,
  };
}

// ─── Calculate max advance amount for context ─────────────────────────────────

export function calculateMaxAdvanceAmount(
  contractValue: Money,
  packageType:   string,
  fundSource:    string,
  asOfDate:      string,
  rules:         readonly PaymentLegalRule[] = PAYMENT_LEGAL_RULES,
): { maxAmount: Money; maxRate: number; ruleId: string | null } {
  const ctx: PaymentRuleContext = { packageType, fundSource, asOfDate };
  const resolution = resolvePaymentRule('ADVANCE_RATE', ctx, rules);
  if (!resolution.resolved) {
    return { maxAmount: multiplyMoney(contractValue, 0), maxRate: 0, ruleId: null };
  }
  const maxRate = resolution.params['maxRate'] ?? 0;
  return {
    maxAmount: multiplyMoney(contractValue, maxRate),
    maxRate,
    ruleId: resolution.rule?.ruleId ?? null,
  };
}

// ─── Check if advance guarantee is required ───────────────────────────────────

export function isAdvanceGuaranteeRequired(
  packageType: string,
  fundSource:  string,
  asOfDate:    string,
  rules:       readonly PaymentLegalRule[] = PAYMENT_LEGAL_RULES,
): boolean {
  const ctx: PaymentRuleContext = { packageType, fundSource, asOfDate };
  const resolution = resolvePaymentRule('ADVANCE_RATE', ctx, rules);
  return resolution.resolved && (resolution.params['guaranteeRequired'] ?? 0) === 1;
}
