/**
 * 8-O: AgentErrorPanel — cross-trace error message detail panel.
 *
 * Accepts a flat AgentMessage[], filters to only type==='error' messages,
 * sorts them ascending by timestamp, and renders each with full detail
 * (routing, payload excerpt, trace-id, legal basis count).
 *
 * Use-case: audit reviewers want a single "what went wrong and when" view
 * across all traces in a procurement session, without navigating trace-by-trace.
 *
 * Distinct from all existing audit components:
 *
 *   AuditTrailPanel  (P6-10Z): accepts pre-processed AuditEntry[] with
 *                    sessionId, providerUsed, status, human-readable message.
 *                    No raw AgentMessage structure.
 *   AgentTracePanel  (8-K):    shows ALL message types for ONE trace in
 *                    chronological order.  Not filtered to errors.
 *   AgentRegistryPanel (8-L):  per-traceId statistics — errorCount is a
 *                    number, not detailed error messages.  Needs live registry.
 *   AgentFlowPanel   (8-M):    per-route traffic — errorCount per (from,to)
 *                    pair.  No message content.
 *   AgentLegalCitationPanel (8-N): groups by citation string.  Shows all
 *                    message types, not only errors.
 *   AgentErrorPanel  (8-O):    accepts flat AgentMessage[] from ANY traces,
 *                    keeps ONLY type==='error', sorts ascending by timestamp,
 *                    and renders each error with full routing, payload, and
 *                    trace-id.  Quick triage across the entire session.
 *
 * Component structure:
 *   <div data-panel="agent-error" data-state="ready|empty|loading"
 *        data-error-count="{n}" data-total-messages="{m}">
 *     <h2 data-field="title">
 *     <ol data-field="error-list">
 *       <li data-error="{1-based}" data-trace-id="{full}" data-from="{from}"
 *           data-to="{to}" data-timestamp="{unix-ms}">
 *         <span data-field="index">
 *         <span data-field="timestamp">  — UTC 'HH:MM:SS.mmm'
 *         <span data-field="routing">    — "{from} → {to}" (template literal)
 *         <span data-field="trace-id">   — first 8 chars + '…' (template literal)
 *         <span data-field="payload">    — JSON, truncated at 120 chars
 *         [<span data-field="legal-basis-count">] — only when legalBasis present
 *
 * Empty state (no error messages):
 *   Triggered when messages=[] OR when no message has type==='error'.
 *   data-total-messages still reflects the raw input messages.length.
 *
 * Ordering:
 *   Errors sorted ascending by timestamp (earliest first).
 *   Stable sort — equal timestamps preserve original input order.
 *
 * Pure functional — no hooks, no browser globals, SSR-compatible.
 */

import type { AgentMessage } from '../agents/types';

// ─── Public constants ─────────────────────────────────────────────────────────

export const AGENT_ERROR_PANEL_VERSION = '8-O';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AgentErrorPanelProps {
  /** Flat array of AgentMessages from any number of traces. */
  messages: AgentMessage[];
  loading?: boolean;
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

/**
 * Keeps only type==='error' messages and sorts ascending by timestamp.
 * Stable sort preserves input order for equal timestamps.
 */
export function filterErrorMessages(messages: AgentMessage[]): AgentMessage[] {
  return messages
    .filter(m => m.type === 'error')
    .sort((a, b) => a.timestamp - b.timestamp);
}

/** Converts unix-ms to UTC 'HH:MM:SS.mmm' — deterministic, SSR-safe. */
function fmtTs(ts: number): string {
  const iso = new Date(ts).toISOString();
  const timePart = iso.split('T')[1] ?? '';
  return timePart.replace('Z', '');
}

/**
 * Serialises payload to compact JSON, truncated at 120 chars.
 * Returns '—' for undefined; '[non-serializable]' on circular-ref error.
 */
function fmtPayload(payload: unknown): string {
  try {
    const s = JSON.stringify(payload);
    if (!s) return '—';
    return s.length > 120 ? s.slice(0, 117) + '…' : s;
  } catch {
    return '[non-serializable]';
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AgentErrorPanel({
  messages,
  loading = false,
}: AgentErrorPanelProps) {
  if (loading) {
    return (
      <div data-panel="agent-error" data-state="loading">
        <span data-field="message">Đang tải nhật ký lỗi...</span>
      </div>
    );
  }

  const errors = filterErrorMessages(messages);

  if (errors.length === 0) {
    return (
      <div
        data-panel="agent-error"
        data-state="empty"
        data-error-count={0}
        data-total-messages={messages.length}
      >
        <h2 data-field="title">Lỗi Agent</h2>
        <span data-field="empty-message">Không có lỗi nào trong nhật ký.</span>
      </div>
    );
  }

  return (
    <div
      data-panel="agent-error"
      data-state="ready"
      data-error-count={errors.length}
      data-total-messages={messages.length}
    >
      <h2 data-field="title">{`Lỗi Agent: ${errors.length} lỗi`}</h2>
      <ol data-field="error-list">
        {errors.map((msg, i) => (
          <li
            key={`${msg.traceId}-${i}`}
            data-error={i + 1}
            data-trace-id={msg.traceId}
            data-from={msg.from}
            data-to={msg.to}
            data-timestamp={msg.timestamp}
          >
            <span data-field="index">{i + 1}</span>
            <span data-field="timestamp">{fmtTs(msg.timestamp)}</span>
            <span data-field="routing">{`${msg.from} → ${msg.to}`}</span>
            <span data-field="trace-id">{`${msg.traceId.slice(0, 8)}…`}</span>
            <span data-field="payload">{fmtPayload(msg.payload)}</span>
            {msg.legalBasis != null && msg.legalBasis.length > 0 && (
              <span data-field="legal-basis-count">{msg.legalBasis.length}</span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
