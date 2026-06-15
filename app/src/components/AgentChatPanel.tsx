import type { AgentId }                         from '../agents/types';
import type { ChatMessage as ChatMessageRecord } from '../agents/ChatAgent';
import ChatMessage                               from './ChatMessage';

export interface AgentChatPanelProps {
  agentId?:       AgentId;
  messages?:      ChatMessageRecord[];
  onSendMessage?: (text: string) => void;
  // P6-09D
  loading?:       boolean;
  error?:         string;
}

export default function AgentChatPanel({
  messages,
  loading,
  error,
}: AgentChatPanelProps) {
  if (loading) {
    return <div data-state="loading">Đang tải...</div>;
  }

  if (error !== undefined) {
    return <div data-state="error">{error}</div>;
  }

  if (messages === undefined || messages.length === 0) {
    return <div data-state="empty">Chưa có tin nhắn nào.</div>;
  }

  return (
    <div data-state="ready">
      {messages.map(msg => (
        <ChatMessage key={msg.id} message={msg} />
      ))}
    </div>
  );
}
