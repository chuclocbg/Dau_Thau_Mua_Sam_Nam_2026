/**
 * Legal Repository Interfaces — Phase A production contracts.
 *
 * All methods are async (Promise-based) so implementations can use:
 *   - MemoryRepository  (tests, no infrastructure)
 *   - PrismaRepository  (production, PostgreSQL)
 *   - Any future adapter (IndexedDB, REST, etc.)
 *
 * Services depend ONLY on these interfaces — never on a concrete class.
 *
 * Six interfaces matching the PM specification:
 *   ILegalDocumentRepository
 *   IArticleRepository
 *   IAmendmentRepository
 *   ICitationRepository
 *   IKeywordRepository
 *   IEffectivePeriodRepository
 */

import type {
  LegalDocument,
  LegalVersion,
  Article,
  Clause,
  Point,
  Appendix,
  LegalCitation,
  LegalKeyword,
  LegalDomain,
  Amendment,
  EffectivePeriod,
} from './legalSchema';
import type { ParsedDocument } from '../agents/VietnamLegalStructureParser';

// ─── Error thrown by Prisma stubs until infrastructure is configured ──────────

export class PrismaNotReadyError extends Error {
  constructor(method: string) {
    super(`Prisma not configured — ${method} requires @prisma/client and DATABASE_URL`);
    this.name = 'PrismaNotReadyError';
  }
}

// ─── 1. LegalDocument repository ─────────────────────────────────────────────

export interface ILegalDocumentRepository {
  save(doc: LegalDocument): Promise<void>;
  findById(id: string): Promise<LegalDocument | null>;
  findBySymbol(symbol: string): Promise<LegalDocument | null>;
  findAll(): Promise<readonly LegalDocument[]>;
  findByDomain(domain: string): Promise<readonly LegalDocument[]>;
  delete(id: string): Promise<void>;
}

// ─── 2. Article repository ────────────────────────────────────────────────────

export interface ImportStats {
  articleCount:  number;
  clauseCount:   number;
  pointCount:    number;
  appendixCount: number;
}

export interface IArticleRepository {
  saveArticle(a: Article): Promise<void>;
  findArticle(id: string): Promise<Article | null>;
  listArticles(documentId: string): Promise<readonly Article[]>;

  saveClause(c: Clause): Promise<void>;
  findClause(id: string): Promise<Clause | null>;
  listClauses(articleId: string): Promise<readonly Clause[]>;

  savePoint(p: Point): Promise<void>;
  findPoint(id: string): Promise<Point | null>;
  listPoints(clauseId: string): Promise<readonly Point[]>;

  saveAppendix(a: Appendix): Promise<void>;
  findAppendix(id: string): Promise<Appendix | null>;
  listAppendices(documentId: string): Promise<readonly Appendix[]>;

  importFromParsed(
    documentId: string,
    versionId:  string | null,
    parsed:     ParsedDocument,
  ): Promise<ImportStats>;
}

// ─── 3. Amendment repository ──────────────────────────────────────────────────

export interface IAmendmentRepository {
  saveAmendment(a: Amendment): Promise<void>;
  findAmendment(id: string): Promise<Amendment | null>;
  listAmendments(baseDocumentId: string, asOf?: string): Promise<readonly Amendment[]>;

  saveVersion(v: LegalVersion): Promise<void>;
  findVersion(id: string): Promise<LegalVersion | null>;
  listVersions(documentId: string): Promise<readonly LegalVersion[]>;
  baselineVersion(documentId: string, effectiveDate: string): Promise<LegalVersion>;
}

// ─── 4. Citation repository ───────────────────────────────────────────────────

export interface ICitationRepository {
  saveCitation(c: LegalCitation): Promise<void>;
  listCitationsFrom(citingDocId: string): Promise<readonly LegalCitation[]>;
  listCitationsTo(citedDocId: string): Promise<readonly LegalCitation[]>;
}

// ─── 5. Keyword repository ────────────────────────────────────────────────────

export interface IKeywordRepository {
  saveKeyword(k: LegalKeyword): Promise<void>;
  findKeyword(term: string, domain?: string): Promise<LegalKeyword | null>;
  listKeywords(domain?: string): Promise<readonly LegalKeyword[]>;

  saveDomain(d: LegalDomain): Promise<void>;
  findDomain(id: string): Promise<LegalDomain | null>;
  listDomains(): Promise<readonly LegalDomain[]>;
}

// ─── 6. Effective period repository ──────────────────────────────────────────

export interface IEffectivePeriodRepository {
  savePeriod(p: EffectivePeriod): Promise<void>;
  closePeriod(documentId: string, endDate: string, reason: string): Promise<void>;
  resolveEffectivePeriod(documentId: string, asOfDate: string): Promise<EffectivePeriod | null>;
  isDocumentInForce(documentId: string, asOfDate: string): Promise<boolean>;
  openPeriod(documentId: string, startDate: string, versionId: string | null): Promise<EffectivePeriod>;
}
