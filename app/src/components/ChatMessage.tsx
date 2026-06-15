import type { ChatMessage as ChatMessageRecord } from '../agents/ChatAgent';

export interface ChatMessageProps {
  message: ChatMessageRecord;
}

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString('vi-VN');
}

export default function ChatMessage({ message }: ChatMessageProps) {
  return (
    <div
      data-message-id={message.id}
      data-role={message.role}
      data-confidence={message.confidence}
    >
      <span data-field="role">{message.role}</span>
      <span data-field="content">{message.content}</span>
      <span data-field="confidence">{message.confidence}</span>
      <span data-field="timestamp">{formatTimestamp(message.timestamp)}</span>
      <span data-field="sources-count">{`${message.sources.length} sources`}</span>
      <span data-field="findings-count">{`${message.relatedFindings?.length ?? 0} findings`}</span>
    </div>
  );
}
