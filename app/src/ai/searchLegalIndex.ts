/**
 * Legal v1.3 — Search layer over legalIndex.json
 *
 * Exports:
 *   searchIndex(entries, query, options?)   — testable, takes any IndexEntry[]
 *   searchLegalIndex(query, options?)       — production, uses bundled legalIndex.json
 *
 * Scoring is identical to legalKnowledgeBase.ts (BM25-lite):
 *   keyword match  +3 per query token
 *   title match    +2 per query token
 *   content freq   +0.5 per matching token
 *
 * ChatAgent and LegalReviewerAgent are NOT modified.
 */

import _indexData from './legalIndex.json';

// ─── Types ────────────────────────────────────────────────────────────────────

interface IndexEntry {
  id: string;
  title: string;
  category: string;
  sourceFile: string;
  effectiveDate: string;
  keywords: string[];
  content: string;
  appliesTo: string[];
}

const LOADED_ENTRIES = (_indexData as { entries: IndexEntry[] }).entries;

export interface SearchIndexResult {
  score: number;
  title: string;
  category: string;
  sourceFile: string;
  effectiveDate: string;
  content: string;
}

export interface SearchOptions {
  /** Filter to entries whose category matches exactly (case-insensitive) */
  category?: string;
  /** Filter to entries with this exact effectiveDate string */
  effectiveDate?: string;
  /** Maximum results to return (default: 5) */
  topK?: number;
  /** Minimum score to include in results (default: 1) */
  minScore?: number;
}

// ─── Tokenizer ────────────────────────────────────────────────────────────────

/**
 * Same NFD + diacritic-strip normalisation as legalKnowledgeBase.ts tokenize().
 * Ensures Vietnamese accent-insensitive matching:
 *   "dau thau" and "đấu thầu" both tokenise to ["dau", "thau"]
 */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')   // strip combining diacritical marks
    .replace(/đ/g, 'd')
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 3);
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

function scoreEntry(qTokens: string[], entry: IndexEntry): number {
  if (qTokens.length === 0) return 0;

  // Build a pre-tokenised content bag once per entry
  const entryTokens = tokenize(
    [entry.title, ...entry.keywords, entry.content].join(' '),
  );

  let score = 0;
  for (const qt of qTokens) {
    // +3 keyword match (index keywords are already ASCII-normalised by textToKeywords)
    if (entry.keywords.some(kw => kw.toLowerCase().includes(qt))) score += 3;
    // +2 title match
    if (entry.title.toLowerCase().includes(qt) ||
        tokenize(entry.title).some(t => t.includes(qt))) score += 2;
    // +0.5 per matching content token
    score += entryTokens.filter(t => t === qt || t.includes(qt)).length * 0.5;
  }
  return score;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Search any IndexEntry array. Exported for unit testing with controlled data.
 *
 * Filters (category, effectiveDate) are applied before scoring.
 * Results are sorted by score descending, then sliced to topK.
 */
export function searchIndex(
  entries: IndexEntry[],
  query: string,
  options: SearchOptions = {},
): SearchIndexResult[] {
  const { category, effectiveDate, topK = 5, minScore = 1 } = options;
  if (!query.trim()) return [];

  const qTokens = tokenize(query);

  let pool = entries;
  if (category) {
    pool = pool.filter(e => e.category.toLowerCase() === category.toLowerCase());
  }
  if (effectiveDate) {
    pool = pool.filter(e => e.effectiveDate === effectiveDate);
  }

  return pool
    .map(e => ({
      score: scoreEntry(qTokens, e),
      title: e.title,
      category: e.category,
      sourceFile: e.sourceFile,
      effectiveDate: e.effectiveDate,
      content: e.content,
    }))
    .filter(r => r.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

/**
 * Search the bundled legalIndex.json.
 * Identical scoring and options to searchIndex().
 */
export function searchLegalIndex(
  query: string,
  options?: SearchOptions,
): SearchIndexResult[] {
  return searchIndex(LOADED_ENTRIES, query, options);
}
