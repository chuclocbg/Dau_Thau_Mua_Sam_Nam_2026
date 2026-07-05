/**
 * Memory repository implementations for testing without infrastructure.
 *
 * All six classes implement the async interfaces from legalRepositories.ts.
 * Backed by plain Maps — same logic as the sync stores but wrapped in
 * Promise.resolve() so they satisfy the interface contracts.
 *
 * Production services inject these in unit / integration tests.
 * PrismaRepositories are injected in production (see prismaRepositories.ts).
 */

import {
  makeArticleId,
  makeClauseId,
  makePointId,
  makeVersionId,
  makeEffectivePeriodId,
  isEffectiveOn,
  type LegalDocument,
  type LegalVersion,
  type Article,
  type Clause,
  type Point,
  type Appendix,
  type LegalCitation,
  type LegalKeyword,
  type LegalDomain,
  type Amendment,
  type EffectivePeriod,
} from './legalSchema';
import type { ParsedDocument } from '../agents/VietnamLegalStructureParser';
import type {
  ILegalDocumentRepository,
  IArticleRepository,
  IAmendmentRepository,
  ICitationRepository,
  IKeywordRepository,
  IEffectivePeriodRepository,
  ImportStats,
} from './legalRepositories';

// ─── 1. MemoryLegalDocumentRepository ────────────────────────────────────────

export class MemoryLegalDocumentRepository implements ILegalDocumentRepository {
  private readonly docs = new Map<string, LegalDocument>();

  async save(doc: LegalDocument): Promise<void> {
    this.docs.set(doc.id, doc);
  }

  async findById(id: string): Promise<LegalDocument | null> {
    return this.docs.get(id) ?? null;
  }

  async findBySymbol(symbol: string): Promise<LegalDocument | null> {
    return [...this.docs.values()].find(d => d.symbol === symbol) ?? null;
  }

  async findAll(): Promise<readonly LegalDocument[]> {
    return [...this.docs.values()];
  }

  async findByDomain(domain: string): Promise<readonly LegalDocument[]> {
    return [...this.docs.values()].filter(d => d.tags.includes(domain));
  }

  async delete(id: string): Promise<void> {
    this.docs.delete(id);
  }

  clear(): void { this.docs.clear(); }
}

// ─── 2. MemoryArticleRepository ───────────────────────────────────────────────

export class MemoryArticleRepository implements IArticleRepository {
  private readonly articles   = new Map<string, Article>();
  private readonly clauses    = new Map<string, Clause>();
  private readonly points     = new Map<string, Point>();
  private readonly appendices = new Map<string, Appendix>();

  async saveArticle(a: Article): Promise<void>  { this.articles.set(a.id, a); }
  async findArticle(id: string): Promise<Article | null> { return this.articles.get(id) ?? null; }
  async listArticles(documentId: string): Promise<readonly Article[]> {
    return [...this.articles.values()]
      .filter(a => a.documentId === documentId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async saveClause(c: Clause): Promise<void>  { this.clauses.set(c.id, c); }
  async findClause(id: string): Promise<Clause | null> { return this.clauses.get(id) ?? null; }
  async listClauses(articleId: string): Promise<readonly Clause[]> {
    return [...this.clauses.values()]
      .filter(c => c.articleId === articleId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async savePoint(p: Point): Promise<void>  { this.points.set(p.id, p); }
  async findPoint(id: string): Promise<Point | null> { return this.points.get(id) ?? null; }
  async listPoints(clauseId: string): Promise<readonly Point[]> {
    return [...this.points.values()]
      .filter(p => p.clauseId === clauseId)
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  async saveAppendix(a: Appendix): Promise<void>  { this.appendices.set(a.id, a); }
  async findAppendix(id: string): Promise<Appendix | null> { return this.appendices.get(id) ?? null; }
  async listAppendices(documentId: string): Promise<readonly Appendix[]> {
    return [...this.appendices.values()].filter(a => a.documentId === documentId);
  }

  async importFromParsed(
    documentId: string,
    versionId:  string | null,
    parsed:     ParsedDocument,
  ): Promise<ImportStats> {
    let clauseCount = 0;
    let pointCount  = 0;

    for (const [i, pa] of parsed.articles.entries()) {
      const articleId = makeArticleId(documentId, pa.number);
      await this.saveArticle({
        id: articleId, documentId, versionId,
        number: pa.number, title: pa.title, content: pa.content,
        chapterRef: null, sortOrder: i,
      });
      for (const pc of pa.clauses) {
        const clauseId = makeClauseId(articleId, pc.number);
        await this.saveClause({ id: clauseId, articleId, number: pc.number, content: pc.content, sortOrder: pc.number });
        clauseCount++;
        for (const [j, pp] of pc.points.entries()) {
          await this.savePoint({ id: makePointId(clauseId, pp.label), clauseId, label: pp.label, content: pp.content, sortOrder: j });
          pointCount++;
        }
      }
    }
    for (const [i, pa] of parsed.appendices.entries()) {
      await this.saveAppendix({
        id: `${documentId}-phuluc-${pa.number || i + 1}`,
        documentId, versionId,
        number: pa.number, title: pa.title, content: pa.content,
      });
    }
    return { articleCount: parsed.articles.length, clauseCount, pointCount, appendixCount: parsed.appendices.length };
  }

  clear(): void {
    this.articles.clear(); this.clauses.clear();
    this.points.clear();   this.appendices.clear();
  }
}

// ─── 3. MemoryAmendmentRepository ────────────────────────────────────────────

export class MemoryAmendmentRepository implements IAmendmentRepository {
  private readonly amendments = new Map<string, Amendment>();
  private readonly versions   = new Map<string, LegalVersion>();

  async saveAmendment(a: Amendment): Promise<void> { this.amendments.set(a.id, a); }
  async findAmendment(id: string): Promise<Amendment | null> { return this.amendments.get(id) ?? null; }
  async listAmendments(baseDocumentId: string, asOf?: string): Promise<readonly Amendment[]> {
    const all = [...this.amendments.values()].filter(a => a.baseDocumentId === baseDocumentId);
    if (!asOf) return all;
    return all.filter(a => a.effectiveDate <= asOf).sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));
  }

  async saveVersion(v: LegalVersion): Promise<void> { this.versions.set(v.id, v); }
  async findVersion(id: string): Promise<LegalVersion | null> { return this.versions.get(id) ?? null; }
  async listVersions(documentId: string): Promise<readonly LegalVersion[]> {
    return [...this.versions.values()]
      .filter(v => v.documentId === documentId)
      .sort((a, b) => a.versionDate.localeCompare(b.versionDate));
  }
  async baselineVersion(documentId: string, effectiveDate: string): Promise<LegalVersion> {
    const existing = [...this.versions.values()].find(v => v.documentId === documentId && v.isBaseline);
    if (existing) return existing;
    const v: LegalVersion = {
      id: makeVersionId(documentId, effectiveDate),
      documentId, versionDate: effectiveDate,
      changeNote: 'Văn bản gốc', amendedById: null, isBaseline: true,
    };
    await this.saveVersion(v);
    return v;
  }

  clear(): void { this.amendments.clear(); this.versions.clear(); }
}

// ─── 4. MemoryCitationRepository ─────────────────────────────────────────────

export class MemoryCitationRepository implements ICitationRepository {
  private readonly citations = new Map<string, LegalCitation>();

  async saveCitation(c: LegalCitation): Promise<void> { this.citations.set(c.id, c); }
  async listCitationsFrom(citingDocId: string): Promise<readonly LegalCitation[]> {
    return [...this.citations.values()].filter(c => c.citingDocId === citingDocId);
  }
  async listCitationsTo(citedDocId: string): Promise<readonly LegalCitation[]> {
    return [...this.citations.values()].filter(c => c.citedDocId === citedDocId);
  }

  clear(): void { this.citations.clear(); }
}

// ─── 5. MemoryKeywordRepository ───────────────────────────────────────────────

export class MemoryKeywordRepository implements IKeywordRepository {
  private readonly keywords = new Map<string, LegalKeyword>();
  private readonly domains  = new Map<string, LegalDomain>();

  async saveKeyword(k: LegalKeyword): Promise<void> { this.keywords.set(k.id, k); }
  async findKeyword(term: string, domain?: string): Promise<LegalKeyword | null> {
    const lower = term.toLowerCase();
    return [...this.keywords.values()].find(k =>
      k.term.toLowerCase() === lower && (!domain || k.domain === domain),
    ) ?? null;
  }
  async listKeywords(domain?: string): Promise<readonly LegalKeyword[]> {
    const all = [...this.keywords.values()];
    return domain ? all.filter(k => k.domain === domain) : all;
  }

  async saveDomain(d: LegalDomain): Promise<void> { this.domains.set(d.id, d); }
  async findDomain(id: string): Promise<LegalDomain | null> { return this.domains.get(id) ?? null; }
  async listDomains(): Promise<readonly LegalDomain[]> { return [...this.domains.values()]; }

  clear(): void { this.keywords.clear(); this.domains.clear(); }
}

// ─── 6. MemoryEffectivePeriodRepository ──────────────────────────────────────

export class MemoryEffectivePeriodRepository implements IEffectivePeriodRepository {
  private readonly periods = new Map<string, EffectivePeriod>();

  async savePeriod(p: EffectivePeriod): Promise<void> { this.periods.set(p.id, p); }

  async closePeriod(documentId: string, endDate: string, reason: string): Promise<void> {
    const open = [...this.periods.values()].find(
      p => p.documentId === documentId && p.endDate === null,
    );
    if (open) this.periods.set(open.id, { ...open, endDate, endReason: reason });
  }

  async resolveEffectivePeriod(documentId: string, asOfDate: string): Promise<EffectivePeriod | null> {
    return [...this.periods.values()].find(
      p => p.documentId === documentId && isEffectiveOn(p, asOfDate),
    ) ?? null;
  }

  async isDocumentInForce(documentId: string, asOfDate: string): Promise<boolean> {
    return (await this.resolveEffectivePeriod(documentId, asOfDate)) !== null;
  }

  async openPeriod(documentId: string, startDate: string, versionId: string | null): Promise<EffectivePeriod> {
    const period: EffectivePeriod = {
      id: makeEffectivePeriodId(documentId, startDate),
      documentId, versionId, startDate,
      endDate: null, endReason: null,
    };
    await this.savePeriod(period);
    return period;
  }

  clear(): void { this.periods.clear(); }
}
