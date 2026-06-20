/**
 * Legal v1.5 — Search adapter
 *
 * Bridges the new index-based pipeline (legalIndex.json → searchLegalIndex →
 * legalCitationEngine) to the existing SearchResult[] shape consumed by
 * ChatAgent and LegalReviewerAgent.
 *
 * Exported functions:
 *   searchWithFallback(query, topK)          — for ChatAgent.searchKnowledge()
 *   enrichLegalBasis(query, existing)        — for LegalReviewerAgent.reviewPackage()
 *
 * Fallback:
 *   If searchLegalIndex() returns 0 results (or throws), both functions
 *   fall back to the hardcoded legalKnowledgeBase.ts (Legal v1.0).
 *
 * ChatAgent and LegalReviewerAgent are NOT modified beyond the single-line
 * import swap that wires in this adapter.
 */

import type { LegalEntry, SearchResult } from './legalKnowledgeBase';
import { searchLegalKB } from './legalKnowledgeBase';
import { searchLegalIndex, type SearchIndexResult } from './searchLegalIndex';
import { extractCitations } from './legalCitationEngine';

// ─── Category → appliesTo mapping ────────────────────────────────────────────
// Mirrors CATEGORY_APPLIESTO in buildLegalKB.ts (that file has Node.js deps
// and cannot be imported in browser/test contexts).

const CATEGORY_APPLIESTO: Record<string, string[]> = {
  Laws:                 ['legal-review', 'khlcnt', 'authority'],
  Decrees:              ['procurement', 'budget-planning', 'khlcnt'],
  Circulars:            ['publication', 'payment', 'khlcnt'],
  VBHN:                 ['legal-review', 'khlcnt', 'authority'],
  Forms:                ['documentation'],
  School_Regulations:   ['authority', 'budget-planning'],
  Procurement_Examples: ['procurement'],
  root:                 ['legal-review'],
};

// ─── Internal adapter ─────────────────────────────────────────────────────────

/**
 * Converts SearchIndexResult[] + CitationResult[] → SearchResult[].
 *
 * Mapping:
 *   CitationResult.citation → entry.source  (formal citation as KB "source")
 *   SearchIndexResult.title → entry.title
 *   SearchIndexResult.content → entry.content
 *   SearchIndexResult.category → entry.appliesTo (via CATEGORY_APPLIESTO)
 *   SearchIndexResult.score → result.score
 *   highlights: [] — buildAnswer() falls back to content lines when empty
 */
function adaptToSearchResults(results: SearchIndexResult[]): SearchResult[] {
  const citations = extractCitations(results);
  return results.map((r, i): SearchResult => {
    const entry: LegalEntry = {
      id:        r.sourceFile.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-'),
      title:     r.title,
      source:    citations[i]?.citation ?? r.title,
      keywords:  [],
      content:   r.content,
      appliesTo: CATEGORY_APPLIESTO[r.category] ?? ['legal-review'],
    };
    return { entry, score: r.score, highlights: [] };
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Searches the legal knowledge base with automatic fallback.
 *
 * Primary:  searchLegalIndex() + legalCitationEngine()
 * Fallback: searchLegalKB() (hardcoded KB) when the index returns 0 results
 *           or throws (e.g., legalIndex.json unavailable at build time).
 *
 * Return type: SearchResult[] — identical to searchLegalKB(), ensuring
 * ChatAgent.searchKnowledge() and buildAnswer() remain unchanged.
 */
export function searchWithFallback(query: string, topK = 3): SearchResult[] {
  try {
    const results = searchLegalIndex(query, { topK, minScore: 1 });
    if (results.length > 0) {
      return adaptToSearchResults(results);
    }
  } catch {
    // Index unavailable or corrupted — fall through to KB
  }
  return searchLegalKB(query, topK);
}

/**
 * Enriches an existing legal-basis string array with index-based citations.
 *
 * Used by LegalReviewerAgent.reviewPackage() to append formally extracted
 * citations (e.g., "Khoản 2 Điều 12 Nghị định 214/2025/NĐ-CP") to the
 * static REVIEWER_LEGAL_BASIS entries already collected by the reviewer.
 *
 * Returns the merged array (Set-deduplicated).
 * Never throws — enrichment is additive; failures leave existing intact.
 */
export function enrichLegalBasis(query: string, existing: string[]): string[] {
  const citations = new Set<string>(existing);
  try {
    const results = searchLegalIndex(query, { topK: 3, minScore: 1 });
    if (results.length > 0) {
      for (const c of extractCitations(results)) {
        citations.add(c.citation);
      }
    }
  } catch {
    // enrichment is best-effort; never throws
  }
  return [...citations];
}
