import type { AgentId } from '../agents/types';

export interface AgentCardProps {
  agentId: AgentId;
  name: string;
  status?: 'idle' | 'busy' | 'error';
  capabilities?: string[];
  lastActivity?: number;
}

export default function AgentCard(_props: AgentCardProps) {
  return <div>AgentCard</div>;
}
