/**
 * Prisma repository implementations — Phase M1 Production Prisma Layer.
 * STATUS: IMPLEMENTED, PENDING PRODUCTION VERIFICATION — never executed against a real
 * database in this environment (Docker unavailable). Do not treat as tested until the
 * docs/infrastructure.md first-run checklist has been run and this note updated.
 *
 * Known deliberate behavioral difference from the memory backend: `PrismaLegalDocumentRepository
 * .delete()` enforces referential integrity (throws if versions/articles/citations/etc. still
 * reference the document — Prisma default onDelete: Restrict) where the memory backend silently
 * leaves orphaned records in unrelated Maps. This is treated as a production correctness
 * improvement, not a regression — see docs/prisma-production.md.
 */

import type {
  ILegalDocumentRepository,
  IArticleRepository,
  IAmendmentRepository,
  ICitationRepository,
  IKeywordRepository,
  IEffectivePeriodRepository,
  ImportStats,
} from './legalRepositories';
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
import { makeArticleId, makeClauseId, makePointId, makeVersionId, makeEffectivePeriodId } from './legalSchema';
import type { ParsedDocument } from '../agents/VietnamLegalStructureParser';
import { getPrismaClient } from '../persistence/prismaClient.ts';

// ─── 1. LegalDocument repository ─────────────────────────────────────────────

export class PrismaLegalDocumentRepository implements ILegalDocumentRepository {
  async save(doc: LegalDocument): Promise<void> {
    const prisma = getPrismaClient();
    const data = {
      symbol: doc.symbol,
      title: doc.title,
      type: doc.type,
      issuer: doc.issuer,
      effectiveDate: doc.effectiveDate,
      expiredDate: doc.expiredDate ?? null,
      status: doc.status,
      supersededBy: doc.supersededBy ?? null,
      replaces: doc.replaces !== undefined ? [...doc.replaces] : [],
      source: doc.source,
      priority: doc.priority,
      tags: [...doc.tags],
      summary: doc.summary,
      confidence: doc.confidence,
      fullText: doc.fullText ?? null,
    };
    await prisma.legalDocument.upsert({
      where: { id: doc.id },
      create: { id: doc.id, ...data },
      update: data,
    });
  }

  async findById(id: string): Promise<LegalDocument | null> {
    const prisma = getPrismaClient();
    const row = await prisma.legalDocument.findUnique({ where: { id } });
    return row as LegalDocument | null;
  }

  async findBySymbol(symbol: string): Promise<LegalDocument | null> {
    const prisma = getPrismaClient();
    const row = await prisma.legalDocument.findUnique({ where: { symbol } });
    return row as LegalDocument | null;
  }

  async findAll(): Promise<readonly LegalDocument[]> {
    const prisma = getPrismaClient();
    const rows = await prisma.legalDocument.findMany();
    return rows as unknown as LegalDocument[];
  }

  async findByDomain(domain: string): Promise<readonly LegalDocument[]> {
    const prisma = getPrismaClient();
    const rows = await prisma.legalDocument.findMany({ where: { tags: { has: domain } } });
    return rows as unknown as LegalDocument[];
  }

  async delete(id: string): Promise<void> {
    const prisma = getPrismaClient();
    await prisma.legalDocument.delete({ where: { id } });
  }
}

// ─── 2. Article repository ────────────────────────────────────────────────────

export class PrismaArticleRepository implements IArticleRepository {
  async saveArticle(a: Article): Promise<void> {
    const prisma = getPrismaClient();
    const data = {
      documentId: a.documentId, versionId: a.versionId,
      number: a.number, title: a.title, content: a.content,
      chapterRef: a.chapterRef, sortOrder: a.sortOrder,
    };
    await prisma.article.upsert({ where: { id: a.id }, create: { id: a.id, ...data }, update: data });
  }

  async findArticle(id: string): Promise<Article | null> {
    const prisma = getPrismaClient();
    return (await prisma.article.findUnique({ where: { id } })) as Article | null;
  }

  async listArticles(documentId: string): Promise<readonly Article[]> {
    const prisma = getPrismaClient();
    const rows = await prisma.article.findMany({ where: { documentId }, orderBy: { sortOrder: 'asc' } });
    return rows as unknown as Article[];
  }

  async saveClause(c: Clause): Promise<void> {
    const prisma = getPrismaClient();
    const data = { articleId: c.articleId, number: c.number, content: c.content, sortOrder: c.sortOrder };
    await prisma.clause.upsert({ where: { id: c.id }, create: { id: c.id, ...data }, update: data });
  }

  async findClause(id: string): Promise<Clause | null> {
    const prisma = getPrismaClient();
    return (await prisma.clause.findUnique({ where: { id } })) as Clause | null;
  }

  async listClauses(articleId: string): Promise<readonly Clause[]> {
    const prisma = getPrismaClient();
    const rows = await prisma.clause.findMany({ where: { articleId }, orderBy: { sortOrder: 'asc' } });
    return rows as unknown as Clause[];
  }

  async savePoint(p: Point): Promise<void> {
    const prisma = getPrismaClient();
    const data = { clauseId: p.clauseId, label: p.label, content: p.content, sortOrder: p.sortOrder };
    await prisma.point.upsert({ where: { id: p.id }, create: { id: p.id, ...data }, update: data });
  }

  async findPoint(id: string): Promise<Point | null> {
    const prisma = getPrismaClient();
    return (await prisma.point.findUnique({ where: { id } })) as Point | null;
  }

  async listPoints(clauseId: string): Promise<readonly Point[]> {
    const prisma = getPrismaClient();
    const rows = await prisma.point.findMany({ where: { clauseId }, orderBy: { label: 'asc' } });
    return rows as unknown as Point[];
  }

  async saveAppendix(a: Appendix): Promise<void> {
    const prisma = getPrismaClient();
    const data = { documentId: a.documentId, versionId: a.versionId, number: a.number, title: a.title, content: a.content };
    await prisma.appendix.upsert({ where: { id: a.id }, create: { id: a.id, ...data }, update: data });
  }

  async findAppendix(id: string): Promise<Appendix | null> {
    const prisma = getPrismaClient();
    return (await prisma.appendix.findUnique({ where: { id } })) as Appendix | null;
  }

  async listAppendices(documentId: string): Promise<readonly Appendix[]> {
    const prisma = getPrismaClient();
    const rows = await prisma.appendix.findMany({ where: { documentId } });
    return rows as unknown as Appendix[];
  }

  /** Transactional: either the whole parsed document imports, or none of it does. */
  async importFromParsed(documentId: string, versionId: string | null, parsed: ParsedDocument): Promise<ImportStats> {
    const prisma = getPrismaClient();
    let clauseCount = 0;
    let pointCount = 0;

    await prisma.$transaction(async (tx) => {
      for (const [i, pa] of parsed.articles.entries()) {
        const articleId = makeArticleId(documentId, pa.number);
        await tx.article.upsert({
          where: { id: articleId },
          create: { id: articleId, documentId, versionId, number: pa.number, title: pa.title, content: pa.content, chapterRef: null, sortOrder: i },
          update: { documentId, versionId, number: pa.number, title: pa.title, content: pa.content, sortOrder: i },
        });
        for (const pc of pa.clauses) {
          const clauseId = makeClauseId(articleId, pc.number);
          await tx.clause.upsert({
            where: { id: clauseId },
            create: { id: clauseId, articleId, number: pc.number, content: pc.content, sortOrder: pc.number },
            update: { articleId, number: pc.number, content: pc.content, sortOrder: pc.number },
          });
          clauseCount++;
          for (const [j, pp] of pc.points.entries()) {
            const pointId = makePointId(clauseId, pp.label);
            await tx.point.upsert({
              where: { id: pointId },
              create: { id: pointId, clauseId, label: pp.label, content: pp.content, sortOrder: j },
              update: { clauseId, label: pp.label, content: pp.content, sortOrder: j },
            });
            pointCount++;
          }
        }
      }
      for (const [i, pa] of parsed.appendices.entries()) {
        const appendixId = `${documentId}-phuluc-${pa.number || i + 1}`;
        await tx.appendix.upsert({
          where: { id: appendixId },
          create: { id: appendixId, documentId, versionId, number: pa.number, title: pa.title, content: pa.content },
          update: { documentId, versionId, number: pa.number, title: pa.title, content: pa.content },
        });
      }
    });

    return { articleCount: parsed.articles.length, clauseCount, pointCount, appendixCount: parsed.appendices.length };
  }
}

// ─── 3. Amendment repository ──────────────────────────────────────────────────

export class PrismaAmendmentRepository implements IAmendmentRepository {
  async saveAmendment(a: Amendment): Promise<void> {
    const prisma = getPrismaClient();
    const data = {
      baseDocumentId: a.baseDocumentId, amendingDocumentId: a.amendingDocumentId,
      amendmentType: a.amendmentType, effectiveDate: a.effectiveDate,
      affectedArticles: [...a.affectedArticles], summary: a.summary,
    };
    await prisma.amendment.upsert({ where: { id: a.id }, create: { id: a.id, ...data }, update: data });
  }

  async findAmendment(id: string): Promise<Amendment | null> {
    const prisma = getPrismaClient();
    return (await prisma.amendment.findUnique({ where: { id } })) as Amendment | null;
  }

  async listAmendments(baseDocumentId: string, asOf?: string): Promise<readonly Amendment[]> {
    const prisma = getPrismaClient();
    const rows = await prisma.amendment.findMany({
      where: { baseDocumentId, ...(asOf ? { effectiveDate: { lte: asOf } } : {}) },
      orderBy: asOf ? { effectiveDate: 'asc' } : undefined,
    });
    return rows as unknown as Amendment[];
  }

  async saveVersion(v: LegalVersion): Promise<void> {
    const prisma = getPrismaClient();
    const data = {
      documentId: v.documentId, versionDate: v.versionDate,
      changeNote: v.changeNote, amendedById: v.amendedById, isBaseline: v.isBaseline,
    };
    await prisma.legalVersion.upsert({ where: { id: v.id }, create: { id: v.id, ...data }, update: data });
  }

  async findVersion(id: string): Promise<LegalVersion | null> {
    const prisma = getPrismaClient();
    return (await prisma.legalVersion.findUnique({ where: { id } })) as LegalVersion | null;
  }

  async listVersions(documentId: string): Promise<readonly LegalVersion[]> {
    const prisma = getPrismaClient();
    const rows = await prisma.legalVersion.findMany({ where: { documentId }, orderBy: { versionDate: 'asc' } });
    return rows as unknown as LegalVersion[];
  }

  async baselineVersion(documentId: string, effectiveDate: string): Promise<LegalVersion> {
    const prisma = getPrismaClient();
    const existing = await prisma.legalVersion.findFirst({ where: { documentId, isBaseline: true } });
    if (existing) return existing as LegalVersion;

    const v: LegalVersion = {
      id: makeVersionId(documentId, effectiveDate),
      documentId, versionDate: effectiveDate,
      changeNote: 'Văn bản gốc', amendedById: null, isBaseline: true,
    };
    await this.saveVersion(v);
    return v;
  }
}

// ─── 4. Citation repository ───────────────────────────────────────────────────

export class PrismaCitationRepository implements ICitationRepository {
  async saveCitation(c: LegalCitation): Promise<void> {
    const prisma = getPrismaClient();
    const data = {
      citingDocId: c.citingDocId, citedDocId: c.citedDocId,
      citingArticle: c.citingArticle, citedArticle: c.citedArticle,
      citedClause: c.citedClause, citedPoint: c.citedPoint,
      formatted: c.formatted, isDirect: c.isDirect,
    };
    await prisma.legalCitation.upsert({ where: { id: c.id }, create: { id: c.id, ...data }, update: data });
  }

  async listCitationsFrom(citingDocId: string): Promise<readonly LegalCitation[]> {
    const prisma = getPrismaClient();
    const rows = await prisma.legalCitation.findMany({ where: { citingDocId } });
    return rows as unknown as LegalCitation[];
  }

  async listCitationsTo(citedDocId: string): Promise<readonly LegalCitation[]> {
    const prisma = getPrismaClient();
    const rows = await prisma.legalCitation.findMany({ where: { citedDocId } });
    return rows as unknown as LegalCitation[];
  }
}

// ─── 5. Keyword repository ────────────────────────────────────────────────────

export class PrismaKeywordRepository implements IKeywordRepository {
  async saveKeyword(k: LegalKeyword): Promise<void> {
    const prisma = getPrismaClient();
    const data = {
      term: k.term, definition: k.definition, domain: k.domain,
      sourceDocId: k.sourceDocId, sourceArticle: k.sourceArticle, synonyms: [...k.synonyms],
    };
    await prisma.legalKeyword.upsert({ where: { id: k.id }, create: { id: k.id, ...data }, update: data });
  }

  async findKeyword(term: string, domain?: string): Promise<LegalKeyword | null> {
    const prisma = getPrismaClient();
    if (domain) {
      return (await prisma.legalKeyword.findUnique({ where: { term_domain: { term, domain } } })) as LegalKeyword | null;
    }
    // Case-insensitive fallback when no domain given (matches memory backend's toLowerCase() compare).
    const rows = await prisma.legalKeyword.findMany({ where: { term: { equals: term, mode: 'insensitive' } }, take: 1 });
    return (rows[0] as LegalKeyword) ?? null;
  }

  async listKeywords(domain?: string): Promise<readonly LegalKeyword[]> {
    const prisma = getPrismaClient();
    const rows = await prisma.legalKeyword.findMany(domain ? { where: { domain } } : undefined);
    return rows as unknown as LegalKeyword[];
  }

  async saveDomain(d: LegalDomain): Promise<void> {
    const prisma = getPrismaClient();
    const data = { name: d.name, description: d.description };
    await prisma.legalDomain.upsert({ where: { id: d.id }, create: { id: d.id, ...data }, update: data });
  }

  async findDomain(id: string): Promise<LegalDomain | null> {
    const prisma = getPrismaClient();
    return (await prisma.legalDomain.findUnique({ where: { id } })) as LegalDomain | null;
  }

  async listDomains(): Promise<readonly LegalDomain[]> {
    const prisma = getPrismaClient();
    const rows = await prisma.legalDomain.findMany();
    return rows as unknown as LegalDomain[];
  }
}

// ─── 6. Effective period repository ──────────────────────────────────────────

export class PrismaEffectivePeriodRepository implements IEffectivePeriodRepository {
  async savePeriod(p: EffectivePeriod): Promise<void> {
    const prisma = getPrismaClient();
    const data = {
      documentId: p.documentId, versionId: p.versionId,
      startDate: p.startDate, endDate: p.endDate, endReason: p.endReason,
    };
    await prisma.effectivePeriod.upsert({ where: { id: p.id }, create: { id: p.id, ...data }, update: data });
  }

  async closePeriod(documentId: string, endDate: string, reason: string): Promise<void> {
    const prisma = getPrismaClient();
    const open = await prisma.effectivePeriod.findFirst({ where: { documentId, endDate: null } });
    if (open) {
      await prisma.effectivePeriod.update({ where: { id: open.id }, data: { endDate, endReason: reason } });
    }
  }

  /** asOfDate falls within [startDate, endDate) or endDate is null (still in force). */
  async resolveEffectivePeriod(documentId: string, asOfDate: string): Promise<EffectivePeriod | null> {
    const prisma = getPrismaClient();
    const row = await prisma.effectivePeriod.findFirst({
      where: {
        documentId,
        startDate: { lte: asOfDate },
        OR: [{ endDate: null }, { endDate: { gt: asOfDate } }],
      },
    });
    return row as EffectivePeriod | null;
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
}
