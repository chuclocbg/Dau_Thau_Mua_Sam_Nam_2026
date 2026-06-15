import type { AgentId } from '../agents/types';
import type { ChatMessage as ChatMessageRecord } from '../agents/ChatAgent';

export interface AgentChatPanelProps {
  agentId?: AgentId;
  messages?: ChatMessageRecord[];
  onSendMessage?: (text: string) => void;
}

export default function AgentChatPanel(_props: AgentChatPanelProps) {
  return <div>AgentChatPanel</div>;
}
