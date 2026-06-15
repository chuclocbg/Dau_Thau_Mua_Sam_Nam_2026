import type { ChatMessage as ChatMessageRecord } from '../agents/ChatAgent';

export interface ChatMessageProps {
  message: ChatMessageRecord;
}

export default function ChatMessage(_props: ChatMessageProps) {
  return <div>ChatMessage</div>;
}
