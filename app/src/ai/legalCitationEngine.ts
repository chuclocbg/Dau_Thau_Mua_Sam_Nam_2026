/**
 * Legal v1.4 — Citation engine on top of searchLegalIndex()
 *
 * Accepts SearchIndexResult[] and extracts formal Vietnamese legal citations:
 *   "Điểm a Khoản 2 Điều 12 Nghị định 214/2025/NĐ-CP"
 *   "Khoản 1 Điều 5 Luật đấu thầu số 22/2023/QH15"
 *   "Điều 1 Thông tư 79/2025/TT-BTC"
 *
 * Exports:
 *   extractDocumentName(title)              — normalise title to short doc name
 *   extractArticleRef(content)              — find best Điều/Khoản/Điểm reference
 *   formatCitation(articleRef, docName)     — combine into citation string
 *   extractCitations(results)               — map SearchIndexResult[] → CitationResult[]
 *
 * ChatAgent and LegalReviewerAgent are NOT modified.
 */

import type { SearchIndexResult } from './searchLegalIndex';

// ─── Public types ──────────────────────────────────────────────────────────────

export interface CitationResult {
  citation: string;        // e.g. "Khoản 2 Điều 12 Nghị định 214/2025/NĐ-CP"
  title: string;
  effectiveDate: string;
  sourceFile: string;
  content: string;
}

// ─── Article-reference patterns (most specific first) ─────────────────────────

// Recognised Vietnamese legal citation components:
//   Điểm  = lettered sub-point (a, b, c … đ)
//   Khoản = numbered clause
//   Điều  = numbered article

const ARTICLE_PATTERNS: RegExp[] = [
  /Điểm\s+[a-zđ]\s+[Kk]hoản\s+\d+\s+[Đđ]iều\s+\d+/,  // Điểm a Khoản 2 Điều 12
  /[Kk]hoản\s+\d+\s+[Đđ]iều\s+\d+/,                    // Khoản 2 Điều 12
  /[Đđ]iều\s+\d+/,                                       // Điều 12
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Derives a short, human-readable document name from the index entry title.
 *
 * Examples:
 *   "4. Nghị định 214_2025_NĐ-CP hướng dẫn..."  →  "Nghị định 214/2025/NĐ-CP"
 *   "9. Thông tư 79_2025_TT-BTC hướng dẫn..."   →  "Thông tư 79/2025/TT-BTC"
 *   "1. Luật đấu thầu số 22_2023_QH15"           →  "Luật đấu thầu số 22/2023/QH15"
 *   "Nghị định 60/2021/NĐ-CP"                    →  "Nghị định 60/2021/NĐ-CP"  (unchanged)
 */
export function extractDocumentName(title: string): string {
  // Remove leading "N. " prefix (e.g. "1. ", "15. ")
  const clean = title.replace(/^\d+\.\s*/, '');

  // Find the document code: digits / year / type-code
  // Handles separators _ / and - to cover both filename-style and formatted codes
  const codeMatch = clean.match(/\d+[-_/]\d{4}[-_/][A-ZĐNQ][A-Z0-9ĐQ/-]+/);
  if (!codeMatch) return clean.trim();

  // Slice up to (and including) the code, then normalise underscores → slashes
  const codeEnd = clean.indexOf(codeMatch[0]) + codeMatch[0].length;
  return clean
    .slice(0, codeEnd)
    .replace(/_(\d{4})_/g, '/$1/')           // "22_2023_" → "22/2023/"
    .replace(/_([A-ZĐNQ][A-Z0-9-]*)$/, '/$1')  // trailing "_NĐ-CP" → "/NĐ-CP"
    .trim();
}

/**
 * Finds the most specific Điều/Khoản/Điểm reference in a content chunk.
 * Returns null when no reference is found (citation falls back to document name).
 */
export function extractArticleRef(content: string): string | null {
  for (const pattern of ARTICLE_PATTERNS) {
    const match = content.match(pattern);
    if (match) return match[0].trim();
  }
  return null;
}

/**
 * Combines an optional article reference with a document name into a citation.
 *
 * formatCitation('Khoản 2 Điều 12', 'Nghị định 214/2025/NĐ-CP')
 *   → "Khoản 2 Điều 12 Nghị định 214/2025/NĐ-CP"
 *
 * formatCitation(null, 'Luật đấu thầu số 22/2023/QH15')
 *   → "Luật đấu thầu số 22/2023/QH15"
 */
export function formatCitation(
  articleRef: string | null,
  documentName: string,
): string {
  return articleRef ? `${articleRef} ${documentName}` : documentName;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Converts an array of search results into formal legal citations.
 * One CitationResult is produced per SearchIndexResult (same order, same length).
 *
 * The function is pure: deterministic, no I/O, no side effects.
 */
export function extractCitations(
  results: SearchIndexResult[],
): CitationResult[] {
  return results.map(r => {
    const documentName = extractDocumentName(r.title);
    const articleRef = extractArticleRef(r.content);
    return {
      citation: formatCitation(articleRef, documentName),
      title: r.title,
      effectiveDate: r.effectiveDate,
      sourceFile: r.sourceFile,
      content: r.content,
    };
  });
}
