/**
 * Domain Layer — shared types, hierarchy constants, and utility helpers.
 *
 * Rules:
 *   - No I/O. No async. Pure values and functions only.
 *   - All domain services import from this file; never from repositories.
 *   - No business logic lives in repositories — only CRUD.
 */

import type { LegalDocumentType } from '../legalRegistry';
import type { Amendment, LegalCitation, EffectivePeriod, Article } from '../legalSchema';
export type { Article };

// ─── Vietnamese legal hierarchy (1 = highest authority) ──────────────────────

export const DOC_HIERARCHY_LEVEL: Readonly<Record<LegalDocumentType, number>> = {
  LAW:                 1,
  RESOLUTION:          2,
  DECREE:              3,
  CIRCULAR:            4,
  DECISION:            5,
  INTERNAL_REGULATION: 6,
  GUIDELINE:           7,
};

export function docTypeToLevel(type: LegalDocumentType): number {
  return DOC_HIERARCHY_LEVEL[type];
}

export function isHigherAuthority(typeA: LegalDocumentType, typeB: LegalDocumentType): boolean {
  return docTypeToLevel(typeA) < docTypeToLevel(typeB);
}

// ─── Runtime legal status ─────────────────────────────────────────────────────
// Distinct from LegalDocumentStatus (registry metadata) —
// this reflects what the law engine determines at a given date.

export type LegalStatus =
  | 'IN_FORCE'
  | 'SUPERSEDED'
  | 'REPEALED'
  | 'SUSPENDED'
  | 'PENDING'
  | 'UNKNOWN';

export const LEGAL_STATUS_VALUES: readonly LegalStatus[] = [
  'IN_FORCE', 'SUPERSEDED', 'REPEALED', 'SUSPENDED', 'PENDING', 'UNKNOWN',
];

export function isLegalStatus(value: unknown): value is LegalStatus {
  return typeof value === 'string' && (LEGAL_STATUS_VALUES as readonly string[]).includes(value);
}

// ─── Conflict resolution ──────────────────────────────────────────────────────

export type ConflictRule = 'HIERARCHY' | 'LEX_POSTERIOR' | 'LEX_SPECIALIS' | 'PRIORITY';

export const CONFLICT_RULES: readonly ConflictRule[] = [
  'HIERARCHY', 'LEX_POSTERIOR', 'LEX_SPECIALIS', 'PRIORITY',
];

export interface ConflictResolution {
  readonly prevailingDocId: string;
  readonly yieldsDocId:     string;
  readonly rule:            ConflictRule;
  readonly reason:          string;
}

// ─── Applicability ────────────────────────────────────────────────────────────

export interface ApplicabilityContext {
  readonly asOfDate:           string;        // YYYY-MM-DD (required)
  readonly domainId?:          string;        // e.g. 'procurement'
  readonly subjectMatter?:     string;        // keyword to match in article text
  readonly procurementMethod?: string;        // 'OPEN' | 'DIRECT' | 'COMPETITIVE'
  readonly value?:             number;        // contract value in VND
}

export interface ApplicabilityResult {
  readonly articleId:      string;
  readonly documentId:     string;
  readonly relevanceScore: number;            // 0.0–1.0
  readonly reason:         string;
}

// ─── Amendment chain ──────────────────────────────────────────────────────────

export interface AmendmentChainEntry {
  readonly amendment:   Amendment;
  readonly appliedDate: string;              // = amendment.effectiveDate
}

// ─── Procurement / threshold ──────────────────────────────────────────────────

export interface ProcurementRule {
  readonly id:            string;
  readonly method:        string;            // 'OPEN_TENDER' | 'DIRECT' | 'COMPETITIVE_QUOTE'
  readonly minValue:      number;            // VND, inclusive
  readonly maxValue:      number | null;     // null = open-ended (no upper bound)
  readonly documentRef:   string;            // symbol of governing document
  readonly effectiveDate: string;
}

export interface ThresholdBand {
  readonly domain:      string;              // 'goods' | 'services' | 'construction' | '*'
  readonly minValue:    number;
  readonly maxValue:    number | null;
  readonly method:      string;
  readonly documentRef: string;
}

export interface ThresholdResult {
  readonly band:   ThresholdBand;
  readonly method: string;
}

// ─── Citation ─────────────────────────────────────────────────────────────────

export interface CitationTarget {
  readonly docId:          string;
  readonly articleNumber?: number;
  readonly clauseNumber?:  number;
  readonly pointLabel?:    string;
}

// ─── Cross-references ─────────────────────────────────────────────────────────

export interface CrossReferenceResult {
  readonly cites:   readonly LegalCitation[];   // citations FROM this document
  readonly citedBy: readonly LegalCitation[];   // citations TO this document
}

// ─── Effective document result ────────────────────────────────────────────────

export interface EffectiveDocumentResult {
  readonly docId:     string;
  readonly isInForce: boolean;
  readonly period:    EffectivePeriod | null;
  readonly status:    LegalStatus;
}
