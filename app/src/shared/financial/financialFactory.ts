import type { Money, CurrencyCode } from './money';
import { createMoney } from './money';

// ─── LegalBasis — structured legal citation (RULE-09) ─────────────────────────
//
// This is the canonical structured legal reference for the financial domain and
// all future modules (Payment, Dashboard, AI Advisory, Reporting).
// Replaces free-text string[] legal references. Aligns with RULE-09.
//
// The five procurement seed instruments are available as PROCUREMENT_LEGAL_BASIS.

export interface LegalBasis {
  readonly document:          string;  // "22/2023/QH15", "214/2025/NĐ-CP"
  readonly documentNumber?:   string;  // full number if different from document symbol
  readonly article?:          string;  // "Điều 22", "Khoản 3"
  readonly clause?:           string;  // "Khoản 1"
  readonly point?:            string;  // "điểm a"
  readonly appendix?:         string;  // "Phụ lục I"
  readonly effectiveDate?:    string;  // YYYY-MM-DD
  readonly issuingAuthority?: string;  // "Quốc hội", "Chính phủ", "Bộ Tài chính"
  readonly summary?:          string;  // one-line human-readable description
  readonly url?:              string;  // optional external link
}

export function createLegalBasis(params: {
  document:          string;
  documentNumber?:   string;
  article?:          string;
  clause?:           string;
  point?:            string;
  appendix?:         string;
  effectiveDate?:    string;
  issuingAuthority?: string;
  summary?:          string;
  url?:              string;
}): LegalBasis {
  if (!params.document?.trim())
    throw new Error('LegalBasis.document is required');
  return { ...params };
}

// Five procurement seed instruments as structured LegalBasis objects.
// These are the initial legal baseline. New instruments can be added without code changes.
export const PROCUREMENT_LEGAL_BASIS: readonly LegalBasis[] = [
  { document: '22/2023/QH15',     issuingAuthority: 'Quốc hội',        effectiveDate: '2024-01-01', summary: 'Luật Đấu thầu' },
  { document: '214/2025/NĐ-CP',   issuingAuthority: 'Chính phủ',       effectiveDate: '2025-07-01', summary: 'NĐ chi tiết Luật Đấu thầu' },
  { document: '104/2026/NĐ-CP',   issuingAuthority: 'Chính phủ',       effectiveDate: '2026-06-01', summary: 'NĐ sửa đổi NĐ 214/2025' },
  { document: 'TT 13/2026/TT-BCT',issuingAuthority: 'Bộ Công Thương',  effectiveDate: '2026-05-01', summary: 'TT hàng hóa thương mại' },
  { document: 'TT 79/2025/TT-BTC',issuingAuthority: 'Bộ Tài chính',    effectiveDate: '2025-08-01', summary: 'TT tài chính đấu thầu' },
];

// ─── Financial Events ─────────────────────────────────────────────────────────

export const FINANCIAL_EVENT_TYPES = [
  'FUNDING_ALLOCATED',
  'FUNDING_RESERVED',
  'BUDGET_COMMITTED',
  'BUDGET_RELEASED',
  'GUARANTEE_ISSUED',
  'GUARANTEE_EXPIRED',
  'GUARANTEE_RELEASED',
  'GUARANTEE_FORFEITED',
  'RETENTION_CREATED',
  'RETENTION_RELEASED',
  'MILESTONE_PAID',
  'ADVANCE_PAID',
] as const;

export type FinancialEventType = typeof FINANCIAL_EVENT_TYPES[number];

export interface FinancialEvent {
  readonly id:          string;
  readonly type:        FinancialEventType;
  readonly occurredAt:  string; // ISO 8601
  readonly amount?:     Money;
  readonly currency?:   CurrencyCode;
  readonly entityId:    string;
  readonly entityType:  string; // "BudgetAllocation" | "FundingCommitment" | "Guarantee" | etc.
  readonly performedBy: string;
  readonly legalBasis?: LegalBasis;
  readonly notes?:      string;
}

export function createFinancialEvent(params: {
  id:          string;
  type:        FinancialEventType;
  entityId:    string;
  entityType:  string;
  performedBy: string;
  amount?:     Money;
  currency?:   CurrencyCode;
  legalBasis?: LegalBasis;
  notes?:      string;
}): FinancialEvent {
  if (!params.entityId.trim())
    throw new Error('FinancialEvent.entityId is required');
  if (!params.performedBy.trim())
    throw new Error('FinancialEvent.performedBy is required');
  return { ...params, occurredAt: new Date().toISOString() };
}

// ─── Code generators ──────────────────────────────────────────────────────────

export function buildBudgetAllocationCode(
  fundSourceCode: string,
  fiscalYear:     number,
  seq:            number,
): string {
  return `BA/${fundSourceCode}/${fiscalYear}/${String(seq).padStart(4, '0')}`;
}

export function buildGuaranteeNumber(
  type:         'ADVANCE' | 'PERFORMANCE' | 'WARRANTY',
  contractCode: string,
  seq:          number,
): string {
  const prefix = type === 'ADVANCE' ? 'BL-TU' : type === 'PERFORMANCE' ? 'BL-TH' : 'BL-BH';
  return `${prefix}/${contractCode}/${String(seq).padStart(3, '0')}`;
}

// ─── Money factory helpers ────────────────────────────────────────────────────

export function vnd(amount: number | bigint): Money {
  return createMoney(amount, 'VND');
}

export function usdCents(amount: number | bigint): Money {
  return createMoney(amount, 'USD');
}
