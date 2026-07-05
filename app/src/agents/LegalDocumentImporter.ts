/**
 * LegalDocumentImporter — orchestrates import of Vietnamese legal documents.
 *
 * Accepts a file (text/HTML/DOCX/PDF), extracts text via LegalTextExtractor,
 * then parses structure via VietnamLegalStructureParser.
 *
 * Produces ImportedDocument — the canonical representation fed to LegalRegistry.
 *
 * Seed documents:
 *   22/2023/QH15   — Luật Đấu thầu
 *   214/2025/NĐ-CP — Nghị định quy định chi tiết Luật Đấu thầu
 *   104/2026/NĐ-CP — Nghị định sửa đổi, bổ sung
 *   79/2025/TT-BTC — Thông tư Bộ Tài chính
 *   13/2026/TT-BCT — Thông tư Bộ Công Thương
 */

import {
  extractByFormat,
  detectFormat,
  type DocFormat,
} from './LegalTextExtractor';
import {
  VietnamLegalStructureParser,
  type ParsedDocument,
  type ParsedArticle,
  type ParsedClause,
  type ParsedPoint,
  type ParsedAppendix,
} from './VietnamLegalStructureParser';

export type { ParsedDocument, ParsedArticle, ParsedClause, ParsedPoint, ParsedAppendix };

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ImportedDocument {
  readonly id:            string;          // kebab-case from symbol
  readonly symbol:        string;          // "22/2023/QH15"
  readonly documentType:  string;
  readonly issuer:        string;
  readonly title:         string;
  readonly signDate:      string | null;
  readonly effectiveDate: string | null;
  readonly articleCount:  number;
  readonly clauseCount:   number;
  readonly pointCount:    number;
  readonly appendixCount: number;
  readonly parsed:        ParsedDocument;
  readonly importedAt:    string;          // ISO 8601
  readonly sourceFormat:  DocFormat;
}

export interface ImportOptions {
  readonly filename?: string;
  readonly mimeType?: string;
  readonly format?:   DocFormat;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function symbolToId(symbol: string): string {
  return symbol.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-');
}

function countClauses(articles: readonly ParsedArticle[]): number {
  return articles.reduce((s, a) => s + a.clauses.length, 0);
}

function countPoints(articles: readonly ParsedArticle[]): number {
  return articles.reduce((s, a) =>
    s + a.clauses.reduce((cs, c) => cs + c.points.length, 0), 0);
}

// ─── Importer ─────────────────────────────────────────────────────────────────

export class LegalDocumentImporter {
  private readonly parser = new VietnamLegalStructureParser();

  /**
   * Import from plain text (pre-extracted or plain-text documents).
   * Synchronous; no I/O.
   */
  importText(text: string, opts: ImportOptions = {}): ImportedDocument {
    const format = opts.format ?? 'TEXT';
    const parsed = this.parser.parse(text);
    return this.build(parsed, format);
  }

  /**
   * Import from HTML string.
   * Synchronous; no I/O.
   */
  importHtml(html: string): ImportedDocument {
    const { text } = extractHtmlSync(html);
    const parsed   = this.parser.parse(text);
    return this.build(parsed, 'HTML');
  }

  /**
   * Import from DOCX ArrayBuffer (async — jszip internally uses Promises).
   */
  async importDocx(buffer: ArrayBuffer): Promise<ImportedDocument> {
    const { text } = await extractByFormat(buffer, 'DOCX');
    const parsed   = this.parser.parse(text);
    return this.build(parsed, 'DOCX');
  }

  /**
   * Import from any supported format, detected from filename/MIME hint.
   */
  async import(
    input:  string | ArrayBuffer,
    opts:   ImportOptions = {},
  ): Promise<ImportedDocument> {
    const hint   = opts.filename ?? opts.mimeType ?? '';
    const format = opts.format   ?? detectFormat(hint);
    const { text } = await extractByFormat(input as string, format);
    const parsed   = this.parser.parse(text);
    return this.build(parsed, format);
  }

  private build(parsed: ParsedDocument, format: DocFormat): ImportedDocument {
    const { metadata, articles, appendices } = parsed;
    return {
      id:            symbolToId(metadata.symbol || 'unknown'),
      symbol:        metadata.symbol,
      documentType:  metadata.documentType,
      issuer:        metadata.issuer,
      title:         metadata.title,
      signDate:      metadata.signDate,
      effectiveDate: metadata.effectiveDate,
      articleCount:  articles.length,
      clauseCount:   countClauses(articles),
      pointCount:    countPoints(articles),
      appendixCount: appendices.length,
      parsed,
      importedAt:    new Date().toISOString(),
      sourceFormat:  format,
    };
  }
}

// ─── Internal sync HTML extractor (avoid async for importHtml) ────────────────

function extractHtmlSync(html: string): { text: string } {
  if (!html.trim()) return { text: '' };
  const doc  = new DOMParser().parseFromString(html, 'text/html');
  const body = doc.body ?? doc.documentElement;
  const raw  = body.textContent ?? '';
  return { text: raw.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim() };
}

// ─── Seed document registry ───────────────────────────────────────────────────

/** Canonical seed document symbols for Phase A. */
export const SEED_DOCUMENT_SYMBOLS = [
  '22/2023/QH15',
  '214/2025/NĐ-CP',
  '104/2026/NĐ-CP',
  '79/2025/TT-BTC',
  '13/2026/TT-BCT',
] as const;

export type SeedSymbol = typeof SEED_DOCUMENT_SYMBOLS[number];

export function isSeedDocument(symbol: string): symbol is SeedSymbol {
  return (SEED_DOCUMENT_SYMBOLS as readonly string[]).includes(symbol);
}
