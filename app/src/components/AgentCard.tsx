import type { AgentId } from '../agents/types';
import { formatTimestampLocale } from '../utils/agentFormatters';

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
        <span data-field="last-updated">{formatTimestampLocale(displayTime)}</span>
      )}
    </div>
  );
}
