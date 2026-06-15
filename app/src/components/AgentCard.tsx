import type { AgentId } from '../agents/types';

export interface AgentCardProps {
  agentId:       AgentId;
  name:          string;
  status?:       'idle' | 'busy' | 'error';
  capabilities?: string[];
  lastActivity?: number;
  // P6-09B
  traceId?:      string;
  lastUpdated?:  number;
  error?:        string;
}

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString('vi-VN');
}

export default function AgentCard({
  agentId,
  name,
  status = 'idle',
  capabilities = [],
  traceId,
  error,
  lastUpdated,
  lastActivity,
}: AgentCardProps) {
  const displayTime = lastUpdated ?? lastActivity;

  return (
    <div data-agent-id={agentId} data-status={status}>
      <span data-field="name">{name}</span>
      <span data-field="agent-id">{agentId}</span>
      <span data-field="status">{status}</span>
      <span data-field="capability-count">{`${capabilities.length} capabilities`}</span>
      {traceId !== undefined && (
        <span data-field="trace-id">{traceId}</span>
      )}
      {status === 'error' && error !== undefined && (
        <span data-field="error">{error}</span>
      )}
      {displayTime !== undefined && (
        <span data-field="last-updated">{formatTimestamp(displayTime)}</span>
      )}
    </div>
  );
}
