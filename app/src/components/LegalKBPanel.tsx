/**
 * 8-D: LegalKBPanel — surfaces live legal KB search results for the
 * current procurement package context.
 *
 * Accepts a query string and a pre-computed SearchResult array so the
 * component itself is pure / SSR-compatible and trivially testable via
 * renderToString.  Callers (App.tsx) invoke searchLegalKB and pass results
 * as a prop — no browser globals, no hooks, no async calls inside.
 */

import type { SearchResult } from '../ai/legalKnowledgeBase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LegalKBPanelProps {
  query:    string;
  results:  SearchResult[];
  loading?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function LegalKBPanel({
  query,
  results,
  loading = false,
}: LegalKBPanelProps) {
  if (loading) {
    return (
      <div data-panel="legal-kb" data-state="loading">
        <span data-field="message">Đang tìm kiếm căn cứ pháp lý...</span>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div data-panel="legal-kb" data-state="empty" data-result-count={0}>
        <span data-field="query">{query}</span>
        <span data-field="message">Không tìm thấy căn cứ pháp lý phù hợp.</span>
      </div>
    );
  }

  return (
    <div data-panel="legal-kb" data-state="ready" data-result-count={results.length}>
      <h2 data-field="title">Căn cứ pháp lý liên quan</h2>
      <span data-field="query">{query}</span>
      <span data-field="result-count">{results.length}</span>
      <ul data-field="result-list">
        {results.map(({ entry, score, highlights }) => (
          <li key={entry.id} data-result-id={entry.id} data-score={score.toFixed(2)}>
            <span data-field="title">{entry.title}</span>
            <span data-field="source">{entry.source}</span>
            <span data-field="score">{score.toFixed(2)}</span>
            {entry.appliesTo && entry.appliesTo.length > 0 && (
              <span data-field="applies-to">{entry.appliesTo.join(', ')}</span>
            )}
            {highlights.length > 0 && (
              <ul data-field="highlights">
                {highlights.map((h, i) => (
                  <li key={i} data-field="highlight">{h}</li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
