/**
 * Retention & Warranty Release Service (Khấu trừ bảo hành)
 *
 * Manages retention money (khấu trừ bảo hành) and warranty release.
 * All rates and durations are resolved via PaymentRuleEngine.
 */

import type { Money } from '../shared/financial/money';
import { multiplyMoney, compareMoney } from '../shared/financial/money';
import type { LegalBasis } from '../shared/financial/financialFactory';
import type { PaymentRequest, CreatePaymentRequestParams } from './paymentTypes';
import { PaymentError } from './paymentTypes';
import type { IPaymentRequestRepository, IPaymentHistoryRepository } from './paymentRepository';
import type { PaymentLegalRule, PaymentRuleContext } from './paymentLegalRule';
import { resolvePaymentRule } from './paymentLegalRule';
import { PAYMENT_LEGAL_RULES } from './paymentRuleRegistry';
import { createPaymentRequest } from './paymentService';

export interface RetentionPaymentParams {
  requestCode:    string;
  contractId:     string;
  contractValue:  Money;
  packageId?:     string;
  acceptanceId?:  string;
  requestedBy:    string;
  department:     string;
  packageType:    string;
  fundSource:     string;
  retentionRate?: number;  // optional: if omitted, uses defaultRate from rule
  legalBasis?:    readonly LegalBasis[];
  notes?:         string;
  rules?:         readonly PaymentLegalRule[];
}

export interface RetentionPaymentResult {
  request:       PaymentRequest;
  resolvedRuleId: string;
  appliedRate:   number;
  maxRate:       number;
  retainedAmount: Money;
  maxDurationMonths: number;
  legalBasis:    readonly LegalBasis[];
}

// ─── Create retention payment request ────────────────────────────────────────

export async function createRetentionPaymentRequest(
  repo:        IPaymentRequestRepository,
  historyRepo: IPaymentHistoryRepository,
  params:      RetentionPaymentParams,
): Promise<RetentionPaymentResult> {
  const rules = params.rules ?? PAYMENT_LEGAL_RULES;
  const asOfDate = new Date().toISOString().slice(0, 10);
  const ctx: PaymentRuleContext = {
    packageType: params.packageType,
    fundSource:  params.fundSource,
    asOfDate,
  };

  const resolution = resolvePaymentRule('RETENTION_RATE', ctx, rules);
  if (!resolution.resolved || !resolution.rule) {
    throw new PaymentError('RULE_NOT_FOUND', 'retention', 'No RETENTION_RATE rule found for context');
  }

  const maxRate = resolution.params['maxRate'] ?? 0.10;
  const defaultRate = resolution.params['defaultRate'] ?? 0.05;
  const appliedRate = params.retentionRate ?? defaultRate;
  const maxDurationMonths = resolution.params['maxDurationMonths'] ?? 24;

  if (appliedRate > maxRate) {
    throw new PaymentError(
      'RETENTION_RATE_EXCEEDED',
      'retentionRate',
      `Retention rate ${(appliedRate * 100).toFixed(1)}% exceeds maximum ${(maxRate * 100).toFixed(0)}% per rule ${resolution.rule.ruleId}`,
    );
  }

  const retainedAmount = multiplyMoney(params.contractValue, appliedRate);

  const createParams: CreatePaymentRequestParams = {
    requestCode:  params.requestCode,
    paymentType:  'RETENTION_RELEASE',
    contractId:   params.contractId,
    packageId:    params.packageId,
    acceptanceId: params.acceptanceId,
    requestedBy:  params.requestedBy,
    department:   params.department,
    amount:       retainedAmount,
    legalBasis:   params.legalBasis?.length ? params.legalBasis : resolution.legalBasis,
    notes:        params.notes,
  };

  const request = await createPaymentRequest(repo, historyRepo, createParams, resolution.rule.ruleId);

  return {
    request,
    resolvedRuleId:    resolution.rule.ruleId,
    appliedRate,
    maxRate,
    retainedAmount,
    maxDurationMonths,
    legalBasis:        resolution.legalBasis,
  };
}

// ─── Create warranty release request ─────────────────────────────────────────

export async function createWarrantyReleaseRequest(
  repo:        IPaymentRequestRepository,
  historyRepo: IPaymentHistoryRepository,
  params:      Omit<RetentionPaymentParams, 'retentionRate'> & { releaseAmount: Money },
): Promise<PaymentRequest> {
  const createParams: CreatePaymentRequestParams = {
    requestCode:  params.requestCode,
    paymentType:  'WARRANTY_RELEASE',
    contractId:   params.contractId,
    packageId:    params.packageId,
    acceptanceId: params.acceptanceId,
    requestedBy:  params.requestedBy,
    department:   params.department,
    amount:       params.releaseAmount,
    legalBasis:   params.legalBasis,
    notes:        params.notes,
  };
  return createPaymentRequest(repo, historyRepo, createParams);
}

// ─── Calculate retained amount ────────────────────────────────────────────────

export function calculateRetainedAmount(
  contractValue: Money,
  packageType:   string,
  fundSource:    string,
  asOfDate:      string,
  rules:         readonly PaymentLegalRule[] = PAYMENT_LEGAL_RULES,
): { amount: Money; rate: number; ruleId: string | null } {
  const ctx: PaymentRuleContext = { packageType, fundSource, asOfDate };
  const resolution = resolvePaymentRule('RETENTION_RATE', ctx, rules);
  if (!resolution.resolved) {
    return { amount: multiplyMoney(contractValue, 0), rate: 0, ruleId: null };
  }
  const rate = resolution.params['defaultRate'] ?? 0;
  return {
    amount: multiplyMoney(contractValue, rate),
    rate,
    ruleId: resolution.rule?.ruleId ?? null,
  };
}

// ─── Get retention duration from rule ────────────────────────────────────────

export function getMaxRetentionDuration(
  packageType: string,
  fundSource:  string,
  asOfDate:    string,
  rules:       readonly PaymentLegalRule[] = PAYMENT_LEGAL_RULES,
): number {
  const ctx: PaymentRuleContext = { packageType, fundSource, asOfDate };
  const resolution = resolvePaymentRule('RETENTION_RATE', ctx, rules);
  return resolution.params['maxDurationMonths'] ?? 24;
}
