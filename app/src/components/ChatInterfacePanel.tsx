/**
 * P7-03: ChatInterfacePanel — wires AgentChatPanel to the ChatAgent.
 *
 * Manages conversation history in React and delegates each turn to
 * ChatAgent via AgentMessage / process().  AgentChatPanel receives the
 * accumulated message list and renders it.
 *
 * The `initial*` props are provided for SSR-safe testing with renderToString —
 * they seed the initial hook values so every state variant is renderable
 * without executing async agent calls.
 */

import { useState, useCallback } from 'react';

import {
  ChatAgent,
  type AgentMessage,
  type ChatInput,
  type ChatOutput,
  type ChatMessage as ChatMessageRecord,
} from '../agents';

import AgentChatPanel from './AgentChatPanel';

// ─── Local trace-id helper ────────────────────────────────────────────────────
// generateTraceId is not re-exported from the agents barrel, so we provide
// a lightweight equivalent that satisfies the audit-trail non-empty invariant.

function makeTraceId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChatInterfacePanelProps {
  agent:            ChatAgent;
  // ── Initial state overrides (for testing / SSR snapshots) ──────────────────
  initialMessages?: ChatMessageRecord[];
  initialInput?:    string;
  initialLoading?:  boolean;
  initialError?:    string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ChatInterfacePanel({
  agent,
  initialMessages = [],
  initialInput    = '',
  initialLoading  = false,
  initialError,
}: ChatInterfacePanelProps) {
  const [messages, setMessages] = useState<ChatMessageRecord[]>(initialMessages);
  const [input,    setInput]    = useState<string>(initialInput);
  const [loading,  setLoading]  = useState<boolean>(initialLoading);
  const [error,    setError]    = useState<string | undefined>(initialError);

  const handleSend = useCallback(async (): Promise<void> => {
    const text = input.trim();
    if (!text) return;

    const userMsg: ChatMessageRecord = {
      id:         makeTraceId(),
      role:       'user',
      content:    text,
      sources:    [],
      confidence: 'high',
      timestamp:  Date.now(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setError(undefined);

    const chatInput: ChatInput = {
      message: text,
      history: messages,
    };

    const agentMsg: AgentMessage = {
      traceId:   makeTraceId(),
      from:      'user',
      to:        'chat',
      type:      'request',
      payload:   chatInput,
      timestamp: Date.now(),
    };

    try {
      const response = await agent.process(agentMsg);
      if (response.type === 'error') {
        const errPayload = response.payload as { message?: string };
        setError(errPayload.message ?? 'Lỗi không xác định');
      } else {
        const output = response.payload as ChatOutput;
        const agentReply: ChatMessageRecord = {
          id:              makeTraceId(),
          role:            'agent',
          content:         output.answer,
          sources:         output.sources,
          confidence:      output.confidence,
          timestamp:       Date.now(),
          relatedFindings: output.relatedFindings,
        };
        setMessages(prev => [...prev, agentReply]);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [agent, input, messages]);

  return (
    <div data-panel="chat-interface">
      <div data-field="controls">
        <input
          data-field="chat-input"
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Nhập câu hỏi về pháp lý mua sắm..."
          disabled={loading}
        />
        <button
          data-action="send"
          onClick={handleSend}
          disabled={loading || !input.trim()}
        >
          {loading ? 'Đang gửi...' : 'Gửi'}
        </button>
      </div>
      <div data-field="chat-area">
        <AgentChatPanel
          messages={messages}
          loading={loading}
          error={error}
        />
      </div>
    </div>
  );
}
