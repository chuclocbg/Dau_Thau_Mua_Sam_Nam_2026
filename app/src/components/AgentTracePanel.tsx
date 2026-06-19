/**
 * 8-K: AgentTracePanel — displays raw AgentMessage[] from AgentRegistry.getTrace()
 * chronologically, providing a live audit trail of the multi-agent message flow.
 *
 * Structure:
 *   <div data-panel="agent-trace" data-state="ready|empty|loading"
 *        data-message-count="{n}">
 *     <h2 data-field="title">Nhật ký kiểm toán Agent</h2>
 *     [<span data-field="trace-id" data-trace-id="{full}">TraceID: {8-char}…</span>]
 *     <ol data-field="message-list">
 *       <li data-trace-message="{1-based}" data-type="{type}"
 *           data-from="{from}" data-to="{to}" data-timestamp="{unix-ms}">
 *         <span data-field="index">          — 1-based position after sort
 *         <span data-field="timestamp">      — formatTimestamp() → 'HH:MM:SS.mmm' UTC
 *         <span data-field="type">           — [REQUEST] / [RESPONSE] / [EVENT] / [ERROR]
 *         <span data-field="routing">        — "{from} → {to}"
 *         <span data-field="payload">        — formatPayload() — truncated at 120 chars
 *         [<ul data-field="legal-basis">]    — only when msg.legalBasis?.length > 0
 *           <li data-legal-ref="{i}">
 *
 * Ordering:
 *   Messages sorted ascending by timestamp (earliest first).
 *   Stable sort — equal timestamps preserve original array order.
 *
 * Timestamp handling:
 *   formatTimestamp(ts) converts unix-ms to UTC 'HH:MM:SS.mmm' via toISOString()
 *   — deterministic across environments, safe for renderToString.
 *
 * Fallback when trace log is empty (messages=[]):
 *   data-state="empty", data-message-count="0".
 *   traceId is still shown in the header so the caller can identify which trace
 *   was queried even when no messages were recorded.
 *
 * Pure functional — no hooks, no browser globals, SSR-compatible.
 * Designed for AgentRegistry.getTrace(traceId) output from Phase 6/8 agents.
 */

import type { AgentMessage } from '../agents/types';
import { formatTimestamp, formatPayload } from '../utils/agentFormatters';
export { formatTimestamp, formatPayload };

// ─── Public constants ─────────────────────────────────────────────────────────

export const AGENT_TRACE_VERSION = '8-K';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AgentTracePanelProps {
  /** Raw trace messages from AgentRegistry.getTrace() — sorted inside component. */
  messages:  AgentMessage[];
  /** Full traceId shown in header; truncated to 8 chars + '…' in display text. */
  traceId?:  string | null;
  loading?:  boolean;
}

// ─── Pure helpers (exported for unit-testing) ─────────────────────────────────

// ─── Component ────────────────────────────────────────────────────────────────

export default function AgentTracePanel({
  messages,
  traceId,
  loading = false,
}: AgentTracePanelProps) {
  if (loading) {
    return (
      <div data-panel="agent-trace" data-state="loading">
        <span data-field="message">Đang tải nhật ký kiểm toán...</span>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div data-panel="agent-trace" data-state="empty" data-message-count={0}>
        <h2 data-field="title">Nhật ký kiểm toán Agent</h2>
        {traceId != null && (
          <span data-field="trace-id" data-trace-id={traceId}>
            {`TraceID: ${traceId.slice(0, 8)}…`}
          </span>
        )}
        <span data-field="empty-message">
          Chưa có thông điệp nào trong nhật ký kiểm toán.
        </span>
      </div>
    );
  }

  const sorted = [...messages].sort((a, b) => a.timestamp - b.timestamp);

  return (
    <div
      data-panel="agent-trace"
      data-state="ready"
      data-message-count={sorted.length}
    >
      <h2 data-field="title">Nhật ký kiểm toán Agent</h2>
      {traceId != null && (
        <span data-field="trace-id" data-trace-id={traceId}>
          {`TraceID: ${traceId.slice(0, 8)}…`}
        </span>
      )}
      <ol data-field="message-list">
        {sorted.map((msg, i) => (
          <li
            key={`${msg.traceId}-${i}`}
            data-trace-message={i + 1}
            data-type={msg.type}
            data-from={msg.from}
            data-to={msg.to}
            data-timestamp={msg.timestamp}
          >
            <span data-field="index">{i + 1}</span>
            <span data-field="timestamp">{formatTimestamp(msg.timestamp)}</span>
            <span data-field="type">{`[${msg.type.toUpperCase()}]`}</span>
            <span data-field="routing">{`${msg.from} → ${msg.to}`}</span>
            <span data-field="payload">{formatPayload(msg.payload)}</span>
            {msg.legalBasis != null && msg.legalBasis.length > 0 && (
              <ul data-field="legal-basis">
                {msg.legalBasis.map((b, j) => (
                  <li key={j} data-legal-ref={j}>{b}</li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
