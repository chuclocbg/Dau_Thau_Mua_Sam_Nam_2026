/**
 * Legal Schema — TypeScript interfaces for all 12 Phase A entities.
 *
 * Entities: LegalDocument (extended), LegalVersion, Article, Clause, Point,
 * Appendix, LegalCitation, LegalReference, LegalKeyword, LegalDomain,
 * Amendment, EffectivePeriod.
 *
 * Extends the existing legalRegistry.ts LegalDocument with article-level
 * and versioning structure.  Does NOT redefine registry fields.
 *
 * Pure types + factory helpers + type guards.  No I/O. No side effects.
 */

import type { LegalDocument, LegalDocumentType, LegalDocumentStatus } from './legalRegistry';
export type { LegalDocument, LegalDocumentType, LegalDocumentStatus };

// ─── Amendment type ───────────────────────────────────────────────────────────

export type AmendmentType =
  | 'REPLACE'     // Thay thế toàn bộ
  | 'MODIFY'      // Sửa đổi
  | 'ADD'         // Bổ sung
  | 'REPEAL'      // Bãi bỏ
  | 'SUSPEND'     // Đình chỉ
  | 'EXTEND'      // Gia hạn
  | 'IMPLEMENT';  // Hướng dẫn thi hành

export const AMENDMENT_TYPES: readonly AmendmentType[] = [
  'REPLACE', 'MODIFY', 'ADD', 'REPEAL', 'SUSPEND', 'EXTEND', 'IMPLEMENT',
];

// ─── LegalVersion ─────────────────────────────────────────────────────────────

export interface LegalVersion {
  readonly id:          string;   // "${documentId}@${versionDate}"
  readonly documentId:  string;
  readonly versionDate: string;   // YYYY-MM-DD
  readonly changeNote:  string;
  readonly amendedById: string | null;  // Amendment.id
  readonly isBaseline:  boolean;
}

// ─── Article ──────────────────────────────────────────────────────────────────

export interface Article {
  readonly id:         string;   // "${documentId}-dieu-${number}"
  readonly documentId: string;
  readonly versionId:  string | null;
  readonly number:     number;
  readonly title:      string;
  readonly content:    string;
  readonly chapterRef: string | null;   // "I", "II"
  readonly sortOrder:  number;
}

// ─── Clause ───────────────────────────────────────────────────────────────────

export interface Clause {
  readonly id:        string;   // "${articleId}-khoan-${number}"
  readonly articleId: string;
  readonly number:    number;
  readonly content:   string;
  readonly sortOrder: number;
}

// ─── Point ────────────────────────────────────────────────────────────────────

export interface Point {
  readonly id:        string;   // "${clauseId}-diem-${label}"
  readonly clauseId:  string;
  readonly label:     string;   // 'a', 'b', 'c'
  readonly content:   string;
  readonly sortOrder: number;
}

// ─── Appendix ─────────────────────────────────────────────────────────────────

export interface Appendix {
  readonly id:         string;
  readonly documentId: string;
  readonly versionId:  string | null;
  readonly number:     string;   // 'I', 'II', '1'
  readonly title:      string;
  readonly content:    string;
}

// ─── LegalCitation ────────────────────────────────────────────────────────────

export interface LegalCitation {
  readonly id:            string;
  readonly citingDocId:   string;
  readonly citedDocId:    string;
  readonly citingArticle: string | null;
  readonly citedArticle:  string | null;
  readonly citedClause:   string | null;
  readonly citedPoint:    string | null;
  readonly formatted:     string;
  readonly isDirect:      boolean;
}

// ─── LegalReference ───────────────────────────────────────────────────────────

export interface LegalReference {
  readonly documentSymbol: string;
  readonly articleNumber?: string;
  readonly clauseNumber?:  string;
  readonly pointLabel?:    string;
  readonly formatted:      string;
}

// ─── LegalKeyword ─────────────────────────────────────────────────────────────

export interface LegalKeyword {
  readonly id:            string;
  readonly term:          string;
  readonly definition:    string;
  readonly domain:        string;
  readonly sourceDocId:   string | null;
  readonly sourceArticle: string | null;
  readonly synonyms:      readonly string[];
}

// ─── LegalDomain ──────────────────────────────────────────────────────────────

export interface LegalDomain {
  readonly id:          string;   // "dau_thau"
  readonly name:        string;   // "Đấu thầu"
  readonly description: string;
  readonly documentIds: readonly string[];
}

// ─── Amendment ────────────────────────────────────────────────────────────────

export interface Amendment {
  readonly id:                 string;
  readonly baseDocumentId:     string;
  readonly amendingDocumentId: string;
  readonly amendmentType:      AmendmentType;
  readonly effectiveDate:      string;         // YYYY-MM-DD
  readonly affectedArticles:   readonly string[];
  readonly summary:            string;
}

// ─── EffectivePeriod ──────────────────────────────────────────────────────────

export interface EffectivePeriod {
  readonly id:         string;
  readonly documentId: string;
  readonly versionId:  string | null;
  readonly startDate:  string;         // YYYY-MM-DD
  readonly endDate:    string | null;  // null = still in force
  readonly endReason:  string | null;
}

// ─── Full schema aggregate ────────────────────────────────────────────────────

export interface LegalSchemaRecord {
  readonly document:        LegalDocument;
  readonly versions:        readonly LegalVersion[];
  readonly articles:        readonly Article[];
  readonly clauses:         readonly Clause[];
  readonly points:          readonly Point[];
  readonly appendices:      readonly Appendix[];
  readonly citations:       readonly LegalCitation[];
  readonly keywords:        readonly LegalKeyword[];
  readonly amendments:      readonly Amendment[];
  readonly effectivePeriods: readonly EffectivePeriod[];
}

// ─── Factory helpers ──────────────────────────────────────────────────────────

export function makeArticleId(documentId: string, number: number): string {
  return `${documentId}-dieu-${number}`;
}

export function makeClauseId(articleId: string, number: number): string {
  return `${articleId}-khoan-${number}`;
}

export function makePointId(clauseId: string, label: string): string {
  return `${clauseId}-diem-${label}`;
}

export function makeVersionId(documentId: string, versionDate: string): string {
  return `${documentId}@${versionDate}`;
}

export function makeEffectivePeriodId(documentId: string, startDate: string): string {
  return `${documentId}:${startDate}`;
}

export function formatReference(ref: LegalReference): string {
  const parts: string[] = [];
  if (ref.pointLabel)    parts.push(`điểm ${ref.pointLabel}`);
  if (ref.clauseNumber)  parts.push(ref.clauseNumber);
  if (ref.articleNumber) parts.push(ref.articleNumber);
  parts.push(ref.documentSymbol);
  return parts.join(' ');
}

// ─── Type guards ──────────────────────────────────────────────────────────────

export function isAmendmentType(value: unknown): value is AmendmentType {
  return typeof value === 'string' &&
    (AMENDMENT_TYPES as readonly string[]).includes(value);
}

export function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/.test(value);
}

export function isEffectiveOn(period: EffectivePeriod, date: string): boolean {
  return period.startDate <= date && (period.endDate === null || period.endDate > date);
}
