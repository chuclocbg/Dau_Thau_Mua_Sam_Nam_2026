/**
 * 8-N: AgentLegalCitationPanel — legal citation frequency summary.
 *
 * Collects every string from AgentMessage.legalBasis[] across a flat
 * AgentMessage[], counts how many times each distinct citation is referenced,
 * and renders an ordered list sorted by frequency (most-cited first).
 *
 * Use-case: audit reviewers can immediately see which laws and decrees the
 * multi-agent system actually relied upon — and how heavily — across an
 * entire procurement session.
 *
 * Distinct from all existing audit components:
 *
 *   AuditTrailPanel  (P6-10Z): accepts pre-processed AuditEntry[] with
 *                    sessionId, providerUsed, status, human-readable message.
 *                    No legalBasis structure.
 *   AgentTracePanel  (8-K):    per-message detail for ONE trace —
 *                    shows the legalBasis of each individual message.
 *   AgentRegistryPanel (8-L):  statistics grouped by traceId, needs a live
 *                    AgentRegistry.  No citation analysis.
 *   AgentFlowPanel   (8-M):    groups messages by (from, to) routing pair.
 *                    Shows type counts per route, not citation frequency.
 *   AgentLegalCitationPanel (8-N): groups by citation string, counts how many
 *                    messages reference each citation, sorts by frequency.
 *                    No registry dep — accepts plain AgentMessage[].
 *
 * Component structure:
 *   <div data-panel="agent-legal-citation" data-state="ready|empty|loading"
 *        data-citation-count="{n}" data-total-messages="{m}">
 *     <h2 data-field="title">
 *     <ol data-field="citation-list">
 *       <li data-citation="{1-based}" data-citation-text="{text}"
 *           data-message-count="{count}">
 *         <span data-field="citation-text">{text}
 *         <span data-field="message-count">{count}
 *
 * Empty state (citations.length === 0):
 *   Triggered when messages=[] OR when all messages have no legalBasis.
 *   data-total-messages still reflects the input messages.length.
 *
 * Counting rule:
 *   Each occurrence of a citation string in a message's legalBasis[] is
 *   counted independently.  A message with legalBasis: ['A', 'A'] contributes
 *   2 to citation A's count.  Messages with undefined/null legalBasis are
 *   silently skipped.
 *
 * Ordering:
 *   Citations sorted descending by count (most-cited first).
 *   Stable sort — equal counts preserve map insertion order (first-seen first).
 *
 * Pure functional — no hooks, no browser globals, SSR-compatible.
 */

import type { AgentMessage } from '../agents/types';

// ─── Public constants ─────────────────────────────────────────────────────────

export const AGENT_LEGAL_CITATION_PANEL_VERSION = '8-N';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CitationSummary {
  /** The exact legal citation string from AgentMessage.legalBasis[]. */
  citation:     string;
  /** Total occurrences across all messages (not deduplicated per message). */
  messageCount: number;
}

export interface AgentLegalCitationPanelProps {
  /** Flat array of AgentMessages from any number of traces. */
  messages: AgentMessage[];
  loading?: boolean;
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

/**
 * Collects all legalBasis strings from messages, counts occurrences of each
 * distinct citation, and returns them sorted descending by count.
 * Messages without legalBasis are silently skipped.
 */
export function buildCitationSummaries(messages: AgentMessage[]): CitationSummary[] {
  const map = new Map<string, number>();

  for (const msg of messages) {
    if (msg.legalBasis != null) {
      for (const cite of msg.legalBasis) {
        map.set(cite, (map.get(cite) ?? 0) + 1);
      }
    }
  }

  return [...map.entries()]
    .map(([citation, messageCount]) => ({ citation, messageCount }))
    .sort((a, b) => b.messageCount - a.messageCount);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AgentLegalCitationPanel({
  messages,
  loading = false,
}: AgentLegalCitationPanelProps) {
  if (loading) {
    return (
      <div data-panel="agent-legal-citation" data-state="loading">
        <span data-field="message">Đang tải trích dẫn pháp lý...</span>
      </div>
    );
  }

  const citations = buildCitationSummaries(messages);

  if (citations.length === 0) {
    return (
      <div
        data-panel="agent-legal-citation"
        data-state="empty"
        data-citation-count={0}
        data-total-messages={messages.length}
      >
        <h2 data-field="title">Trích dẫn pháp lý Agent</h2>
        <span data-field="empty-message">Chưa có trích dẫn pháp lý nào trong nhật ký.</span>
      </div>
    );
  }

  return (
    <div
      data-panel="agent-legal-citation"
      data-state="ready"
      data-citation-count={citations.length}
      data-total-messages={messages.length}
    >
      <h2 data-field="title">
        {`Trích dẫn pháp lý Agent: ${citations.length} văn bản`}
      </h2>
      <ol data-field="citation-list">
        {citations.map((summary, i) => (
          <li
            key={summary.citation}
            data-citation={i + 1}
            data-citation-text={summary.citation}
            data-message-count={summary.messageCount}
          >
            <span data-field="citation-text">{summary.citation}</span>
            <span data-field="message-count">{summary.messageCount}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
