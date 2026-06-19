/**
 * 8-M: AgentFlowPanel — routing/flow summary for a flat AgentMessage[].
 *
 * Groups messages by unique (from, to) routing pair, computes per-pair type
 * counts, and renders a list sorted by traffic volume (most messages first).
 * This is the "who talks to whom" view — complementary to but distinct from:
 *
 *   AuditTrailPanel  (P6-10Z): accepts pre-processed AuditEntry[] with
 *                    sessionId, providerUsed, status, and human-readable
 *                    message.  No routing structure.
 *   AgentTracePanel  (8-K):    detail view of ONE AgentMessage[] trace —
 *                    individual message rows (from→to, payload, timestamp).
 *   AgentRegistryPanel (8-L):  statistics grouped by traceId, queries a live
 *                    AgentRegistry.getTrace().  No cross-trace routing view.
 *   AgentFlowPanel   (8-M):    accepts a flat AgentMessage[] from any number
 *                    of traces, groups by (from, to) pair, counts per type,
 *                    and sorts descending by messageCount.  No registry dep.
 *
 * Component structure:
 *   <div data-panel="agent-flow" data-state="ready|empty|loading"
 *        data-route-count="{n}" data-total-messages="{m}">
 *     <h2 data-field="title">
 *     <ol data-field="route-list">
 *       <li data-route="{1-based}" data-from="{from}" data-to="{to}"
 *           data-message-count data-request-count data-response-count
 *           data-event-count data-error-count>
 *         <span data-field="routing">     — "{from} → {to}" (template literal)
 *         <span data-field="message-count">
 *         <span data-field="type-breakdown"> — "{r} req / {resp} res / {e} evt / {err} err"
 *         [<span data-field="error-flag">]   — only when errorCount > 0
 *
 * Ordering:
 *   Routes sorted descending by messageCount (highest traffic first).
 *   Stable sort — equal counts preserve map insertion order (first-seen pair wins).
 *
 * Pure functional — no hooks, no browser globals, SSR-compatible.
 */

import type { AgentMessage } from '../agents/types';

// ─── Public constants ─────────────────────────────────────────────────────────

export const AGENT_FLOW_PANEL_VERSION = '8-M';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FlowRoute {
  from:          string;
  to:            string;
  messageCount:  number;
  requestCount:  number;
  responseCount: number;
  eventCount:    number;
  errorCount:    number;
}

export interface AgentFlowPanelProps {
  /** Flat array of AgentMessages from any number of traces. */
  messages: AgentMessage[];
  loading?: boolean;
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

/**
 * Groups messages by unique (from, to) pair and accumulates per-type counts.
 * Result sorted descending by messageCount; stable for equal counts.
 */
export function buildFlowRoutes(messages: AgentMessage[]): FlowRoute[] {
  const map = new Map<string, FlowRoute>();

  for (const msg of messages) {
    const key = `${msg.from}|||${msg.to}`;
    const r = map.get(key);
    if (r) {
      r.messageCount++;
      if (msg.type === 'request')  r.requestCount++;
      if (msg.type === 'response') r.responseCount++;
      if (msg.type === 'event')    r.eventCount++;
      if (msg.type === 'error')    r.errorCount++;
    } else {
      map.set(key, {
        from:          msg.from,
        to:            msg.to,
        messageCount:  1,
        requestCount:  msg.type === 'request'  ? 1 : 0,
        responseCount: msg.type === 'response' ? 1 : 0,
        eventCount:    msg.type === 'event'    ? 1 : 0,
        errorCount:    msg.type === 'error'    ? 1 : 0,
      });
    }
  }

  return [...map.values()].sort((a, b) => b.messageCount - a.messageCount);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AgentFlowPanel({
  messages,
  loading = false,
}: AgentFlowPanelProps) {
  if (loading) {
    return (
      <div data-panel="agent-flow" data-state="loading">
        <span data-field="message">Đang tải luồng thông điệp...</span>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div
        data-panel="agent-flow"
        data-state="empty"
        data-route-count={0}
        data-total-messages={0}
      >
        <h2 data-field="title">Luồng thông điệp Agent</h2>
        <span data-field="empty-message">Chưa có thông điệp nào để phân tích luồng.</span>
      </div>
    );
  }

  const routes       = buildFlowRoutes(messages);
  const routeCount   = routes.length;
  const totalMessages = messages.length;

  return (
    <div
      data-panel="agent-flow"
      data-state="ready"
      data-route-count={routeCount}
      data-total-messages={totalMessages}
    >
      <h2 data-field="title">
        {`Luồng thông điệp Agent: ${routeCount} tuyến, ${totalMessages} thông điệp`}
      </h2>
      <ol data-field="route-list">
        {routes.map((route, i) => (
          <li
            key={`${route.from}|||${route.to}`}
            data-route={i + 1}
            data-from={route.from}
            data-to={route.to}
            data-message-count={route.messageCount}
            data-request-count={route.requestCount}
            data-response-count={route.responseCount}
            data-event-count={route.eventCount}
            data-error-count={route.errorCount}
          >
            <span data-field="routing">{`${route.from} → ${route.to}`}</span>
            <span data-field="message-count">{route.messageCount}</span>
            <span data-field="type-breakdown">
              {`${route.requestCount} req / ${route.responseCount} res / ${route.eventCount} evt / ${route.errorCount} err`}
            </span>
            {route.errorCount > 0 && (
              <span data-field="error-flag">[ERROR]</span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
