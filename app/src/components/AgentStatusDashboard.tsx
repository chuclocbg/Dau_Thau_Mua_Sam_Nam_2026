import type { AgentId } from '../agents/types';
import AgentCard from './AgentCard';

export interface AgentStatusInfo {
  agentId:       AgentId;
  name:          string;
  status:        'idle' | 'busy' | 'error';
  capabilities?: string[];
  lastActivity?: number;
  // P6-09B
  traceId?:      string;
  lastUpdated?:  number;
  error?:        string;
}

export interface AgentStatusDashboardProps {
  agents?:  AgentStatusInfo[];
  // P6-09B
  loading?: boolean;
  error?:   string;
}

export default function AgentStatusDashboard({
  agents,
  loading,
  error,
}: AgentStatusDashboardProps) {
  if (loading) {
    return <div data-state="loading">Đang tải...</div>;
  }

  if (error !== undefined) {
    return <div data-state="error">{error}</div>;
  }

  if (agents === undefined || agents.length === 0) {
    return <div data-state="empty">Không có agent nào.</div>;
  }

  return (
    <div data-state="ready">
      {agents.map(agent => (
        <AgentCard
          key={agent.agentId}
          agentId={agent.agentId}
          name={agent.name}
          status={agent.status}
          capabilities={agent.capabilities}
          traceId={agent.traceId}
          lastUpdated={agent.lastUpdated}
          lastActivity={agent.lastActivity}
          error={agent.error}
        />
      ))}
    </div>
  );
}
