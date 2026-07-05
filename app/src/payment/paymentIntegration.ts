/**
 * Payment Integration Bridge
 *
 * ONLY file in src/payment/ that imports from frozen modules outside this directory.
 * One-way: frozen modules NEVER import from here.
 *
 * Bridges:
 *   - src/acceptance/acceptanceTypes.ts → PaymentRequest helpers
 *   - src/contract/contractTypes.ts     → Payment context helpers
 *   - src/shared/financial/            → Money, LegalBasis
 */

import type { AcceptanceRequest } from '../acceptance/acceptanceTypes';
import type { Contract } from '../contract/contractTypes';
import type { Money, CurrencyCode } from '../shared/financial/money';
import { createMoney } from '../shared/financial/money';
import type { LegalBasis } from '../shared/financial/financialFactory';
import { createLegalBasis, PROCUREMENT_LEGAL_BASIS } from '../shared/financial/financialFactory';
import { mergeLegalBasis } from '../shared/financial/financialIntegration';
import type { CreatePaymentRequestParams, PaymentSummary } from './paymentTypes';
import type { PaymentRuleContext } from './paymentLegalRule';
import { resolvePaymentRule } from './paymentLegalRule';
import { PAYMENT_LEGAL_RULES } from './paymentRuleRegistry';

// ─── Contract → Payment helpers ───────────────────────────────────────────────

export function contractToContractMoney(contract: Contract): Money {
  // Contract.contractValue is a number (VNĐ whole units) in the frozen schema
  const currency: CurrencyCode =
    contract.currency === 'USD' ? 'USD' :
    contract.currency === 'EUR' ? 'EUR' : 'VND';
  return createMoney(BigInt(Math.round(contract.contractValue)), currency);
}

export function buildPaymentRuleContextFromContract(
  packageType: string,
  fundSource:  string,
  asOfDate?:   string,
): PaymentRuleContext {
  return {
    packageType,
    fundSource,
    asOfDate: asOfDate ?? new Date().toISOString().slice(0, 10),
  };
}

// ─── Acceptance → Payment params ──────────────────────────────────────────────

export function acceptanceToPaymentBaseParams(
  acceptance:    AcceptanceRequest,
  amount:        Money,
  requestedBy:   string,
  department:    string,
): Partial<CreatePaymentRequestParams> {
  return {
    contractId:   acceptance.contractId,
    acceptanceId: acceptance.id,
    packageId:    acceptance.packageId,
    requestedBy,
    department,
    amount,
    legalBasis:   buildPaymentLegalBasisFromAcceptance(acceptance),
  };
}

// ─── Build LegalBasis from acceptance.legalBasis (string[]) ──────────────────
// AcceptanceRequest.legalBasis is string[] per KI-002 (frozen module).
// Best-effort conversion to structured LegalBasis.

export function buildPaymentLegalBasisFromAcceptance(
  acceptance: AcceptanceRequest,
): readonly LegalBasis[] {
  const converted: LegalBasis[] = acceptance.legalBasis
    .filter(s => s.trim())
    .map(s => createLegalBasis({ document: s.trim(), summary: 'From acceptance record' }));
  return mergeLegalBasis(PROCUREMENT_LEGAL_BASIS, converted);
}

// ─── Resolve payment rules for a given context ────────────────────────────────

export function resolveAdvanceRuleForContext(
  packageType: string,
  fundSource:  string,
  asOfDate?:   string,
): ReturnType<typeof resolvePaymentRule> {
  const ctx = buildPaymentRuleContextFromContract(packageType, fundSource, asOfDate);
  return resolvePaymentRule('ADVANCE_RATE', ctx, PAYMENT_LEGAL_RULES);
}

export function resolveRetentionRuleForContext(
  packageType: string,
  fundSource:  string,
  asOfDate?:   string,
): ReturnType<typeof resolvePaymentRule> {
  const ctx = buildPaymentRuleContextFromContract(packageType, fundSource, asOfDate);
  return resolvePaymentRule('RETENTION_RATE', ctx, PAYMENT_LEGAL_RULES);
}

export function resolveTreasuryRuleForContext(
  packageType: string,
  fundSource:  string,
  asOfDate?:   string,
): ReturnType<typeof resolvePaymentRule> {
  const ctx = buildPaymentRuleContextFromContract(packageType, fundSource, asOfDate);
  return resolvePaymentRule('TREASURY_THRESHOLD', ctx, PAYMENT_LEGAL_RULES);
}

// ─── Format payment summary for external display ──────────────────────────────

export function formatPaymentSummaryForDisplay(summary: PaymentSummary): {
  code:            string;
  type:            string;
  status:          string;
  amount:          string;
  legalBasisCount: number;
  isOverdue:       boolean;
} {
  return {
    code:            summary.requestCode,
    type:            summary.paymentType,
    status:          summary.status,
    amount:          `${summary.amount.amount.toString()} ${summary.amount.currency}`,
    legalBasisCount: summary.legalBasisCount,
    isOverdue:       summary.isOverdue,
  };
}

// ─── Merge additional LegalBasis into the default corpus ─────────────────────

export function buildExtendedPaymentLegalBasis(
  additional: readonly LegalBasis[],
): readonly LegalBasis[] {
  return mergeLegalBasis(PROCUREMENT_LEGAL_BASIS, additional);
}
