// financialIntegration.ts — bridge between the financial domain and other platform modules.
// ALLOWED imports: src/masterdata, src/legal
// FORBIDDEN imports: workflow, approval, contract, acceptance, payment

import type { FundSource, BudgetYear } from '../../masterdata/masterdataTypes';
import type { LegalReference as SchemaLegalReference } from '../../legal/legalSchema';
import type { Money } from './money';
import { createMoney } from './money';
import type { FundingSource } from './fundingSource';
import type { LegalBasis } from './financialFactory';
import { PROCUREMENT_LEGAL_BASIS } from './financialFactory';

// ─── Masterdata bridges ───────────────────────────────────────────────────────

// Convert a masterdata FundSource reference into a financial-domain FundingSource stub.
// totalBudget is left at 0 — the caller must supply actual budget from BudgetYear.
export function fundSourceToFinancial(
  src:        FundSource,
  fiscalYear: number,
  budget:     Money,
): FundingSource {
  const now = new Date().toISOString();
  return {
    id:          src.id,
    code:        src.code,
    name:        src.name,
    type:        src.type as 'STATE' | 'ODA' | 'PPP' | 'ENTERPRISE',
    fiscalYear,
    totalBudget: budget,
    isActive:    src.isActive,
    createdAt:   now,
    updatedAt:   now,
  };
}

// Convert a masterdata BudgetYear into a financial-domain Money amount (VND).
export function budgetYearToMoney(by: BudgetYear): Money {
  return createMoney(by.totalBudget, 'VND');
}

// ─── Legal bridges ────────────────────────────────────────────────────────────

// Convert a financial-domain LegalBasis to the schema-layer LegalReference format.
// Used when interacting with the frozen Legal module's citation types.
export function legalBasisToSchemaRef(basis: LegalBasis): SchemaLegalReference {
  return {
    documentSymbol: basis.document,
    articleNumber:  basis.article,
    clauseNumber:   basis.clause,
    pointLabel:     basis.point,
    formatted:      formatLegalBasis(basis),
  };
}

// Convert a schema-layer LegalReference to a financial-domain LegalBasis.
export function schemaRefToLegalBasis(ref: SchemaLegalReference): LegalBasis {
  return {
    document: ref.documentSymbol,
    article:  ref.articleNumber,
    clause:   ref.clauseNumber,
    point:    ref.pointLabel,
  };
}

export function formatLegalBasis(basis: LegalBasis): string {
  const parts: string[] = [];
  if (basis.point)   parts.push(`điểm ${basis.point}`);
  if (basis.clause)  parts.push(basis.clause);
  if (basis.article) parts.push(basis.article);
  parts.push(basis.document);
  return parts.join(' ');
}

// ─── Default legal basis ──────────────────────────────────────────────────────

// Returns the five seed procurement legal instruments as LegalBasis objects.
// Future instruments can be added to PROCUREMENT_LEGAL_BASIS without code changes.
export function getDefaultProcurementLegalBasis(): readonly LegalBasis[] {
  return PROCUREMENT_LEGAL_BASIS;
}

// Merge caller-supplied bases with defaults, deduplicating by document symbol.
export function mergeLegalBasis(
  defaults:   readonly LegalBasis[],
  additional: readonly LegalBasis[],
): readonly LegalBasis[] {
  const seen = new Set(defaults.map(b => b.document));
  const extra = additional.filter(b => !seen.has(b.document));
  return [...defaults, ...extra];
}
