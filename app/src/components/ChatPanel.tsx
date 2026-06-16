/**
 * P6-10X: ChatPanel — SSR-compatible conversation message view.
 * No hooks, no browser APIs, never throws.
 * React automatically escapes string children — no XSS risk.
 */

export type MessageRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id?: string | null;
  role?: MessageRole | string | null;
  content?: string | null;
  timestamp?: number | null;
}

export interface ChatPanelProps {
  messages?: ChatMessage[] | null;
  title?: string | null;
}

export function ChatPanel({ messages, title }: ChatPanelProps = {}) {
  const safeMessages = Array.isArray(messages) ? messages : [];
  const safeTitle = typeof title === 'string' ? title : 'Chat';

  return (
    <div className="chat-panel">
      <h2>{safeTitle}</h2>
      {safeMessages.length === 0
        ? <p className="empty-state">No messages.</p>
        : (
          <ol className="chat-messages">
            {safeMessages.map((m, i) => {
              const entry   = (m !== null && typeof m === 'object') ? m : {} as ChatMessage;
              const id      = typeof entry.id      === 'string' ? entry.id      : `msg-${i}`;
              const role    = typeof entry.role    === 'string' ? entry.role    : 'user';
              const content = typeof entry.content === 'string' ? entry.content : '';
              return (
                <li key={id} className={`chat-message chat-message--${role}`}>
                  <span className="message-role">{role}</span>
                  <span className="message-content">{content}</span>
                </li>
              );
            })}
          </ol>
        )
      }
    </div>
  );
}
