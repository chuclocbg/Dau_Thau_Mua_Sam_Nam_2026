/**
 * Payment Legal Rule Engine
 *
 * All payment rules (advance rates, retention rates, guarantees, deadlines,
 * treasury thresholds) are resolved dynamically from this engine.
 *
 * Business code NEVER hardcodes:
 *   - percentages (advance rate, retention rate)
 *   - day counts (payment deadlines)
 *   - thresholds (treasury approval thresholds)
 *   - law document names or numbers
 *
 * To add a new legal requirement, register a new PaymentLegalRule in
 * paymentRuleRegistry.ts — zero business logic changes required.
 */

import type { LegalBasis } from '../shared/financial/financialFactory';

// ─── Rule type ────────────────────────────────────────────────────────────────

export const PAYMENT_RULE_TYPES = [
  'ADVANCE_RATE',           // Maximum and minimum advance payment rate
  'RETENTION_RATE',         // Maximum retention (withholding) rate
  'GUARANTEE_REQUIREMENT',  // Guarantee type requirements and rate bounds
  'PAYMENT_DEADLINE',       // Maximum days from acceptance to payment
  'TREASURY_THRESHOLD',     // Threshold for mandatory treasury submission
  'BUDGET_COMMITMENT_LIMIT',// Maximum commitment per budget allocation
] as const;
export type PaymentRuleType = typeof PAYMENT_RULE_TYPES[number];

// ─── Rule condition ───────────────────────────────────────────────────────────

export type PaymentConditionOperator = 'EQ' | 'IN' | 'NOT_IN' | 'LT' | 'LTE' | 'GT' | 'GTE';

export interface PaymentRuleCondition {
  readonly field:    string;
  readonly operator: PaymentConditionOperator;
  readonly value:    string | number | boolean | readonly string[];
}

// ─── Rule definition ──────────────────────────────────────────────────────────

export interface PaymentLegalRule {
  readonly ruleId:                   string;
  readonly ruleName:                 string;
  readonly ruleType:                 PaymentRuleType;
  readonly legalReferences:          readonly LegalBasis[];
  readonly effectiveFrom:            string;          // YYYY-MM-DD
  readonly effectiveTo:              string | null;   // null = still in force
  readonly supersededBy?:            string;          // ruleId superseding this rule
  readonly applicablePackageTypes:   readonly string[]; // empty = all package types
  readonly applicableFundingSources: readonly string[]; // empty = all fund sources
  readonly applicableAuthorities:    readonly string[]; // empty = all authorities
  readonly numericParams:            Readonly<Record<string, number>>; // maxRate, maxDays, etc.
  readonly conditions:               readonly PaymentRuleCondition[];
  readonly priority:                 number;           // lower = higher priority
  readonly description:              string;
}

// ─── Resolution context ───────────────────────────────────────────────────────

export interface PaymentRuleContext {
  readonly packageType: string;
  readonly fundSource:  string;
  readonly authority?:  string;
  readonly asOfDate:    string;  // YYYY-MM-DD
}

export interface PaymentRuleResolution {
  readonly resolved:   boolean;
  readonly rule:       PaymentLegalRule | null;
  readonly params:     Readonly<Record<string, number>>;
  readonly reason:     string;
  readonly legalBasis: readonly LegalBasis[];
}

// ─── Condition evaluator ──────────────────────────────────────────────────────

export function testPaymentCondition(
  cond: PaymentRuleCondition,
  ctx: Record<string, unknown>,
): boolean {
  const val = ctx[cond.field];
  if (val === undefined || val === null) return false;
  switch (cond.operator) {
    case 'EQ':     return val === cond.value;
    case 'IN':     return (cond.value as readonly string[]).includes(String(val));
    case 'NOT_IN': return !(cond.value as readonly string[]).includes(String(val));
    case 'LT':     return typeof val === 'number' && val < (cond.value as number);
    case 'LTE':    return typeof val === 'number' && val <= (cond.value as number);
    case 'GT':     return typeof val === 'number' && val > (cond.value as number);
    case 'GTE':    return typeof val === 'number' && val >= (cond.value as number);
    default:       return false;
  }
}

// ─── Rule matcher ─────────────────────────────────────────────────────────────

export function matchesPaymentRule(rule: PaymentLegalRule, ctx: PaymentRuleContext): boolean {
  if (ctx.asOfDate < rule.effectiveFrom) return false;
  if (rule.effectiveTo !== null && ctx.asOfDate >= rule.effectiveTo) return false;
  // supersededBy marks an inactive rule — it will never match
  if (rule.supersededBy) return false;
  if (rule.applicablePackageTypes.length > 0 &&
      !rule.applicablePackageTypes.includes(ctx.packageType)) return false;
  if (rule.applicableFundingSources.length > 0 &&
      !rule.applicableFundingSources.includes(ctx.fundSource)) return false;
  if (rule.applicableAuthorities.length > 0 && ctx.authority &&
      !rule.applicableAuthorities.includes(ctx.authority)) return false;
  const ctxMap = ctx as unknown as Record<string, unknown>;
  return rule.conditions.every(c => testPaymentCondition(c, ctxMap));
}

/**
 * Date/supersession effectiveness only (KI-010) -- deliberately narrower than
 * matchesPaymentRule(): does not require packageType/fundSource/authority context,
 * for callers that only need to re-check an already-resolved rule is still valid,
 * not re-resolve one from scratch.
 */
export function isRulePresentlyEffective(rule: PaymentLegalRule, asOfDate: string): boolean {
  if (rule.supersededBy) return false;
  if (asOfDate < rule.effectiveFrom) return false;
  if (rule.effectiveTo !== null && asOfDate >= rule.effectiveTo) return false;
  return true;
}

// ─── Rule resolver ────────────────────────────────────────────────────────────

export function resolvePaymentRule(
  ruleType: PaymentRuleType,
  ctx: PaymentRuleContext,
  rules: readonly PaymentLegalRule[],
): PaymentRuleResolution {
  const typed = rules.filter(r => r.ruleType === ruleType);
  const sorted = [...typed].sort((a, b) => a.priority - b.priority);
  const match = sorted.find(r => matchesPaymentRule(r, ctx));
  if (!match) {
    return {
      resolved: false,
      rule: null,
      params: {},
      reason: `No ${ruleType} rule matched for packageType=${ctx.packageType} fundSource=${ctx.fundSource} asOfDate=${ctx.asOfDate}`,
      legalBasis: [],
    };
  }
  return {
    resolved: true,
    rule: match,
    params: match.numericParams,
    reason: `Resolved rule: ${match.ruleId} — ${match.ruleName}`,
    legalBasis: match.legalReferences,
  };
}

// ─── Helper: resolve all rules of each type for a context ────────────────────

export function resolveAllPaymentRules(
  ctx: PaymentRuleContext,
  rules: readonly PaymentLegalRule[],
): Record<PaymentRuleType, PaymentRuleResolution> {
  return Object.fromEntries(
    PAYMENT_RULE_TYPES.map(t => [t, resolvePaymentRule(t, ctx, rules)]),
  ) as Record<PaymentRuleType, PaymentRuleResolution>;
}
