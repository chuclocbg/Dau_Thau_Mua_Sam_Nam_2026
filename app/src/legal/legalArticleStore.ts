/**
 * LegalArticleStore — in-memory repository for Article, Clause, Point, Appendix.
 *
 * Implements the repository pattern for sub-document structural entities.
 * Backed by plain Map — no I/O, no external deps, fully testable in jsdom.
 *
 * Public API:
 *   addArticle / getArticle / listArticles(documentId)
 *   addClause  / getClause  / listClauses(articleId)
 *   addPoint   / getPoint   / listPoints(clauseId)
 *   addAppendix / getAppendix / listAppendices(documentId)
 *   importFromParsed(documentId, versionId, parsedDocument) — bulk import
 *   clear() — reset all stores (for testing)
 */

import {
  makeArticleId,
  makeClauseId,
  makePointId,
  type Article,
  type Clause,
  type Point,
  type Appendix,
} from './legalSchema';
import type { ParsedDocument } from '../agents/VietnamLegalStructureParser';

// ─── Store ────────────────────────────────────────────────────────────────────

export class LegalArticleStore {
  private readonly articles   = new Map<string, Article>();
  private readonly clauses    = new Map<string, Clause>();
  private readonly points     = new Map<string, Point>();
  private readonly appendices = new Map<string, Appendix>();

  // ── Articles ────────────────────────────────────────────────────────────────

  addArticle(a: Article): void {
    this.articles.set(a.id, a);
  }

  getArticle(id: string): Article | undefined {
    return this.articles.get(id);
  }

  listArticles(documentId: string): Article[] {
    return [...this.articles.values()]
      .filter(a => a.documentId === documentId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  // ── Clauses ─────────────────────────────────────────────────────────────────

  addClause(c: Clause): void {
    this.clauses.set(c.id, c);
  }

  getClause(id: string): Clause | undefined {
    return this.clauses.get(id);
  }

  listClauses(articleId: string): Clause[] {
    return [...this.clauses.values()]
      .filter(c => c.articleId === articleId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  // ── Points ──────────────────────────────────────────────────────────────────

  addPoint(p: Point): void {
    this.points.set(p.id, p);
  }

  getPoint(id: string): Point | undefined {
    return this.points.get(id);
  }

  listPoints(clauseId: string): Point[] {
    return [...this.points.values()]
      .filter(p => p.clauseId === clauseId)
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  // ── Appendices ──────────────────────────────────────────────────────────────

  addAppendix(a: Appendix): void {
    this.appendices.set(a.id, a);
  }

  getAppendix(id: string): Appendix | undefined {
    return this.appendices.get(id);
  }

  listAppendices(documentId: string): Appendix[] {
    return [...this.appendices.values()]
      .filter(a => a.documentId === documentId);
  }

  // ── Bulk import ──────────────────────────────────────────────────────────────

  importFromParsed(
    documentId: string,
    versionId:  string | null,
    parsed:     ParsedDocument,
  ): { articleCount: number; clauseCount: number; pointCount: number; appendixCount: number } {
    let clauseCount = 0;
    let pointCount  = 0;

    for (const [i, parsedArticle] of parsed.articles.entries()) {
      const articleId = makeArticleId(documentId, parsedArticle.number);

      this.addArticle({
        id:         articleId,
        documentId,
        versionId,
        number:     parsedArticle.number,
        title:      parsedArticle.title,
        content:    parsedArticle.content,
        chapterRef: null,
        sortOrder:  i,
      });

      for (const parsedClause of parsedArticle.clauses) {
        const clauseId = makeClauseId(articleId, parsedClause.number);

        this.addClause({
          id:        clauseId,
          articleId,
          number:    parsedClause.number,
          content:   parsedClause.content,
          sortOrder: parsedClause.number,
        });
        clauseCount++;

        for (const [j, parsedPoint] of parsedClause.points.entries()) {
          this.addPoint({
            id:        makePointId(clauseId, parsedPoint.label),
            clauseId,
            label:     parsedPoint.label,
            content:   parsedPoint.content,
            sortOrder: j,
          });
          pointCount++;
        }
      }
    }

    for (const [i, pa] of parsed.appendices.entries()) {
      const appendixId = `${documentId}-phuluc-${pa.number || i + 1}`;
      this.addAppendix({
        id:         appendixId,
        documentId,
        versionId,
        number:     pa.number,
        title:      pa.title,
        content:    pa.content,
      });
    }

    return {
      articleCount:  parsed.articles.length,
      clauseCount,
      pointCount,
      appendixCount: parsed.appendices.length,
    };
  }

  // ── Stats ────────────────────────────────────────────────────────────────────

  stats(): { articles: number; clauses: number; points: number; appendices: number } {
    return {
      articles:   this.articles.size,
      clauses:    this.clauses.size,
      points:     this.points.size,
      appendices: this.appendices.size,
    };
  }

  clear(): void {
    this.articles.clear();
    this.clauses.clear();
    this.points.clear();
    this.appendices.clear();
  }
}
