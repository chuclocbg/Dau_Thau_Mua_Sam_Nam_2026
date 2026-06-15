import type { AgentId } from '../agents/types';

export interface AgentStatusInfo {
  agentId: AgentId;
  name: string;
  status: 'idle' | 'busy' | 'error';
  capabilities?: string[];
  lastActivity?: number;
}

export interface AgentStatusDashboardProps {
  agents?: AgentStatusInfo[];
}

export default function AgentStatusDashboard(_props: AgentStatusDashboardProps) {
  return <div>AgentStatusDashboard</div>;
}
