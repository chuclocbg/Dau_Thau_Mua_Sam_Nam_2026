/**
 * 8-L: AgentRegistryPanel — multi-trace registry overview.
 *
 * Queries a live AgentRegistry for one or more traceIds, computes per-trace
 * statistics, and renders a summary list.  This is the "bird's eye view" of
 * all registry activity — contrast with:
 *
 *   AuditTrailPanel  (P6-10Z): accepts pre-processed AuditEntry[] (status,
 *                    provider, human-readable message).  No registry integration.
 *   AgentTracePanel  (8-K):    accepts ONE AgentMessage[] trace and renders
 *                    individual message detail (from→to, payload, timestamp).
 *   AgentRegistryPanel (8-L):  holds a live AgentRegistry + list of traceIds,
 *                    calls getTrace() for each, aggregates type counts and time
 *                    range, and renders one summary row per trace.
 *
 * Component structure:
 *   <div data-panel="agent-registry" data-state="ready|empty|loading"
 *        data-trace-count="{n}" data-total-messages="{m}">
 *     <h2 data-field="title">
 *     <ol data-field="trace-list">
 *       <li data-trace-id="{full}" data-message-count data-request-count
 *           data-response-count data-event-count data-error-count
 *           data-first-timestamp="{unix-ms|''}">
 *         <span data-field="trace-id">      — first 8 chars + '…'
 *         <span data-field="message-count">
 *         <span data-field="type-breakdown"> — "{r} req / {resp} res / {e} evt / {err} err"
 *         [<span data-field="error-flag">]   — only when errorCount > 0
 *         [<span data-field="first-timestamp">] — UTC HH:MM:SS.mmm, only when present
 *
 * Ordering:
 *   Traces sorted ascending by firstTimestamp (earliest first).
 *   Traces with no messages (firstTimestamp=null) sort after all others.
 *   Stable sort — equal firstTimestamps preserve traceIds array order.
 *
 * Fallback when traceIds=[]:
 *   data-state="empty", data-trace-count="0", data-total-messages="0".
 *
 * buildTraceSummary uses optional chaining (registry?.getTrace) so that
 * defensive tests can pass null without throwing.
 *
 * Pure functional — no hooks, no browser globals, SSR-compatible.
 */

import type { AgentRegistry } from '../agents/AgentRegistry';
import { formatTimestamp } from '../utils/agentFormatters';

// ─── Public constants ─────────────────────────────────────────────────────────

export const AGENT_REGISTRY_PANEL_VERSION = '8-L';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TraceSummary {
  traceId:        string;
  messageCount:   number;
  requestCount:   number;
  responseCount:  number;
  eventCount:     number;
  errorCount:     number;
  /** Unix-ms of the earliest message, or null when trace has no messages. */
  firstTimestamp: number | null;
  /** Unix-ms of the latest message, or null when trace has no messages. */
  lastTimestamp:  number | null;
}

export interface AgentRegistryPanelProps {
  /** Live AgentRegistry — getTrace() called inside the component. */
  registry:  AgentRegistry;
  /** TraceIds to summarise; may be empty. */
  traceIds:  string[];
  loading?:  boolean;
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

/**
 * Fetches all messages for traceId from the registry and aggregates counts.
 * Uses optional chaining so null registries (defensive tests) return zeros.
 */
export function buildTraceSummary(registry: AgentRegistry | null, traceId: string): TraceSummary {
  const messages = registry?.getTrace(traceId) ?? [];
  const timestamps = messages.map(m => m.timestamp);

  return {
    traceId,
    messageCount:   messages.length,
    requestCount:   messages.filter(m => m.type === 'request').length,
    responseCount:  messages.filter(m => m.type === 'response').length,
    eventCount:     messages.filter(m => m.type === 'event').length,
    errorCount:     messages.filter(m => m.type === 'error').length,
    firstTimestamp: timestamps.length > 0 ? Math.min(...timestamps) : null,
    lastTimestamp:  timestamps.length > 0 ? Math.max(...timestamps) : null,
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AgentRegistryPanel({
  registry,
  traceIds,
  loading = false,
}: AgentRegistryPanelProps) {
  if (loading) {
    return (
      <div data-panel="agent-registry" data-state="loading">
        <span data-field="message">Đang tải registry...</span>
      </div>
    );
  }

  if (traceIds.length === 0) {
    return (
      <div
        data-panel="agent-registry"
        data-state="empty"
        data-trace-count={0}
        data-total-messages={0}
      >
        <h2 data-field="title">Tổng quan Registry</h2>
        <span data-field="empty-message">Chưa có trace nào trong registry.</span>
      </div>
    );
  }

  const summaries = traceIds.map(id => buildTraceSummary(registry, id));

  // Sort ascending by firstTimestamp; traces with no messages (null) sort last
  const sorted = [...summaries].sort((a, b) => {
    const ta = a.firstTimestamp ?? Infinity;
    const tb = b.firstTimestamp ?? Infinity;
    return ta - tb;
  });

  const totalMessages = sorted.reduce((acc, s) => acc + s.messageCount, 0);
  const traceCount    = sorted.length;

  return (
    <div
      data-panel="agent-registry"
      data-state="ready"
      data-trace-count={traceCount}
      data-total-messages={totalMessages}
    >
      <h2 data-field="title">
        {`Tổng quan Registry: ${traceCount} trace, ${totalMessages} thông điệp`}
      </h2>
      <ol data-field="trace-list">
        {sorted.map((summary, i) => {
          const ft = summary.firstTimestamp;
          return (
            <li
              key={`${summary.traceId}-${i}`}
              data-trace-id={summary.traceId}
              data-message-count={summary.messageCount}
              data-request-count={summary.requestCount}
              data-response-count={summary.responseCount}
              data-event-count={summary.eventCount}
              data-error-count={summary.errorCount}
              data-first-timestamp={ft !== null ? String(ft) : ''}
            >
              <span data-field="trace-id">{`${summary.traceId.slice(0, 8)}…`}</span>
              <span data-field="message-count">{summary.messageCount}</span>
              <span data-field="type-breakdown">
                {`${summary.requestCount} req / ${summary.responseCount} res / ${summary.eventCount} evt / ${summary.errorCount} err`}
              </span>
              {summary.errorCount > 0 && (
                <span data-field="error-flag">[ERROR]</span>
              )}
              {ft !== null && (
                <span data-field="first-timestamp">{formatTimestamp(ft)}</span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
