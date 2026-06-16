/**
 * P6-10Z: AuditTrailPanel — SSR-compatible audit entry list view.
 *
 * Renders audit entries produced by the multi-agent system (P6-01–P6-06)
 * and the provider infrastructure (P6-10A–P6-10W).
 *
 * Each entry surfaces the fields required for State Audit traceability:
 *   traceId       — UUID linking to AgentRegistry.getTrace()
 *   sessionId     — links to SessionManager (P6-10R)
 *   agentId       — which P6 agent produced the entry
 *   timestamp     — Unix-ms; rendered as ISO-8601 string
 *   providerUsed  — LLM provider name (openai / claude / gemini / …)
 *   status        — pending | running | success | error
 *   messageFlow   — request | response | event | error (AgentMessage.type)
 *   message       — human-readable summary
 *
 * No hooks, no browser APIs, never throws.
 */

export type AuditStatus = 'pending' | 'running' | 'success' | 'error';

export type AuditMessageFlow = 'request' | 'response' | 'event' | 'error';

export interface AuditEntry {
  traceId?:      string | null;
  sessionId?:    string | null;
  agentId?:      string | null;
  timestamp?:    number | null;
  providerUsed?: string | null;
  status?:       AuditStatus | string | null;
  messageFlow?:  AuditMessageFlow | string | null;
  message?:      string | null;
}

export interface AuditTrailPanelProps {
  entries?: AuditEntry[] | null;
  title?:   string | null;
}

function safeIsoString(ts: number | null | undefined): string {
  if (typeof ts !== 'number' || !Number.isFinite(ts)) return '';
  try {
    return new Date(ts).toISOString();
  } catch {
    return '';
  }
}

export function AuditTrailPanel({ entries, title }: AuditTrailPanelProps = {}) {
  const safeEntries = Array.isArray(entries) ? entries : [];
  const safeTitle   = typeof title === 'string' ? title : 'Audit Trail';

  return (
    <div className="audit-trail-panel">
      <h2>{safeTitle}</h2>
      {safeEntries.length === 0
        ? <p className="empty-state">No audit entries.</p>
        : (
          <ol className="audit-entries">
            {safeEntries.map((e, i) => {
              const entry       = (e !== null && typeof e === 'object') ? e : {} as AuditEntry;
              const traceId     = typeof entry.traceId     === 'string' ? entry.traceId     : '';
              const sessionId   = typeof entry.sessionId   === 'string' ? entry.sessionId   : '';
              const agentId     = typeof entry.agentId     === 'string' ? entry.agentId     : '';
              const timestamp   = typeof entry.timestamp   === 'number' ? entry.timestamp   : null;
              const provider    = typeof entry.providerUsed=== 'string' ? entry.providerUsed: '';
              const status      = typeof entry.status      === 'string' ? entry.status      : 'pending';
              const flow        = typeof entry.messageFlow === 'string' ? entry.messageFlow : '';
              const message     = typeof entry.message     === 'string' ? entry.message     : '';
              const isoTime     = safeIsoString(timestamp);
              const key         = traceId !== '' ? traceId : `entry-${i}`;

              return (
                <li key={key} className="audit-entry">
                  <span className={`audit-status status-${status}`}>{status}</span>

                  {traceId !== '' && (
                    <span className="audit-trace-id" data-field="trace-id">{traceId}</span>
                  )}

                  {sessionId !== '' && (
                    <span className="audit-session-id" data-field="session-id">{sessionId}</span>
                  )}

                  {agentId !== '' && (
                    <span className="audit-agent-id" data-field="agent-id">{agentId}</span>
                  )}

                  {isoTime !== '' && (
                    <span className="audit-timestamp" data-field="timestamp">{isoTime}</span>
                  )}

                  {provider !== '' && (
                    <span className="audit-provider" data-field="provider">{provider}</span>
                  )}

                  {flow !== '' && (
                    <span className={`audit-flow flow-${flow}`} data-field="message-flow">{flow}</span>
                  )}

                  {message !== '' && (
                    <span className="audit-message" data-field="message">{message}</span>
                  )}
                </li>
              );
            })}
          </ol>
        )
      }
    </div>
  );
}
