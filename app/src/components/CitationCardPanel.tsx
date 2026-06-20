/**
 * Legal v2.2 — CitationCardPanel
 *
 * Groups AgentMessage.legalBasis[] by legal document and displays
 * article/clause references as a hierarchical card list.
 *
 * Returns null when legalBasis is empty or undefined.
 * Duplicates are removed before grouping.
 *
 * Pure functional. No hooks. No browser globals. SSR-compatible.
 */

import React from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CitationCardPanelProps {
  legalBasis?: string[];
}

// ─── Grouping logic ───────────────────────────────────────────────────────────

// Patterns ordered most-common-first. Each captures the canonical doc identifier.
const DOC_NAME_PATTERNS: RegExp[] = [
  /Luật[^—;\n]*?\d+\/\d+\/QH\d+/,              // Luật Đấu thầu 22/2023/QH15
  /Ngh[iị]\s*[đĐdD][iị]nh\s+\d+\/\d+\/NĐ-CP/, // Nghị định 214/2025/NĐ-CP
  /Th[ôo]ng\s*t[ưu]\s+\d+\/\d+\/TT-[A-Z]+/,   // Thông tư 79/2025/TT-BTC
  /\d+\/VBHN-[A-Z]+/,                          // 74/VBHN-VPQH
];

const FALLBACK_GROUP = 'Văn bản khác';

function extractDocumentName(citation: string): string {
  for (const pattern of DOC_NAME_PATTERNS) {
    const m = citation.match(pattern);
    if (m) {
      // Normalize "Luật ... số X/Y/QHZ" → "Luật ... X/Y/QHZ" to merge variant spellings
      return m[0].trim().replace(/\s+số\s+(?=\d)/, ' ');
    }
  }
  return FALLBACK_GROUP;
}

function extractArticle(citation: string, docName: string): string {
  if (docName === FALLBACK_GROUP) return citation.replace(/\s*—.*$/s, '').trim();
  const article = citation
    .replace(docName, '')
    .replace(/\s*[;—].*$/s, '')  // strip description and any trailing doc refs after semicolon
    .trim();
  return article || citation.replace(/\s*—.*$/s, '').trim();
}

/** Deduplicates then groups citation strings by extracted document name. */
export function groupCitations(citations: string[]): Map<string, string[]> {
  const unique = [...new Set(citations)];
  const groups = new Map<string, string[]>();

  for (const citation of unique) {
    const docName = extractDocumentName(citation);
    const article = extractArticle(citation, docName);
    const existing = groups.get(docName) ?? [];
    if (!existing.includes(article)) {
      groups.set(docName, [...existing, article]);
    }
  }

  return groups;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CitationCardPanel({ legalBasis = [] }: CitationCardPanelProps) {
  if (legalBasis.length === 0) return null;

  const groups = groupCitations(legalBasis);

  return (
    <div data-panel="citation-card">
      <h3 data-field="title">Trích dẫn pháp lý</h3>
      {[...groups.entries()].map(([docName, articles]) => (
        <div
          key={docName}
          data-field="citation-group"
          data-doc-name={docName}
        >
          <h4 data-field="doc-name">{docName}</h4>
          <ul data-field="article-list">
            {articles.map((article, i) => (
              <li key={i} data-field="article">{article}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
