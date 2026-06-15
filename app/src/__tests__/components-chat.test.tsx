/**
 * P6-09D: Rendering tests for AgentChatPanel, ChatMessage, ChatInput,
 * and AutonomousPanel.
 *
 * Uses react-dom/server renderToString (Node environment, no jsdom needed).
 */

import { describe, it, expect } from 'vitest';
import { renderToString }       from 'react-dom/server';
import React                    from 'react';

import AgentChatPanel, { type AgentChatPanelProps } from '../components/AgentChatPanel';
import ChatMessage,    { type ChatMessageProps }     from '../components/ChatMessage';
import ChatInput,      { type ChatInputProps }       from '../components/ChatInput';
import AutonomousPanel, { type AutonomousPanelProps } from '../components/AutonomousPanel';

import type { ChatMessage as ChatMessageRecord }        from '../agents/ChatAgent';
import type { AgentSession, UserQuestion }              from '../agents/AutonomousAgent';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function render(element: React.ReactElement): string {
  return renderToString(element);
}

function makeMsg(overrides: Partial<ChatMessageRecord> = {}): ChatMessageRecord {
  return {
    id:         'msg-001',
    role:       'user',
    content:    'Phương thức lựa chọn nhà thầu nào phù hợp?',
    sources:    [],
    confidence: 'high',
    timestamp:  1_750_000_000_000,
    ...overrides,
  };
}

function makeSession(overrides: Partial<AgentSession> = {}): AgentSession {
  return {
    sessionId:   'sess-001',
    state:       'idle',
    goal:        'Mua sắm thiết bị văn phòng',
    messageLog:  [],
    startedAt:   1_750_000_000_000,
    specRetries: 0,
    ...overrides,
  };
}

const MSG_A: ChatMessageRecord = makeMsg({ id: 'a', content: 'Câu hỏi A', role: 'user' });
const MSG_B: ChatMessageRecord = makeMsg({ id: 'b', content: 'Trả lời B', role: 'agent', confidence: 'medium', sources: ['src1', 'src2'] });
const MSG_C: ChatMessageRecord = makeMsg({ id: 'c', content: 'Thông báo C', role: 'system', confidence: 'low' });

// ─── CP: AgentChatPanel ───────────────────────────────────────────────────────

describe('AgentChatPanel', () => {
  it('CP-01: renders empty state when messages is undefined', () => {
    const html = render(<AgentChatPanel />);
    expect(html).toContain('data-state="empty"');
  });

  it('CP-02: renders empty state when messages is empty array', () => {
    const html = render(<AgentChatPanel messages={[]} />);
    expect(html).toContain('data-state="empty"');
  });

  it('CP-03: renders loading state', () => {
    const html = render(<AgentChatPanel loading />);
    expect(html).toContain('data-state="loading"');
    expect(html).toContain('Đang tải');
  });

  it('CP-04: loading takes priority over error', () => {
    const html = render(<AgentChatPanel loading error="should be hidden" />);
    expect(html).toContain('data-state="loading"');
    expect(html).not.toContain('data-state="error"');
  });

  it('CP-05: loading takes priority over messages', () => {
    const html = render(<AgentChatPanel loading messages={[MSG_A]} />);
    expect(html).toContain('data-state="loading"');
    expect(html).not.toContain('Câu hỏi A');
  });

  it('CP-06: renders error state', () => {
    const html = render(<AgentChatPanel error="Lỗi kết nối" />);
    expect(html).toContain('data-state="error"');
    expect(html).toContain('Lỗi kết nối');
  });

  it('CP-07: renders ready state with one message', () => {
    const html = render(<AgentChatPanel messages={[MSG_A]} />);
    expect(html).toContain('data-state="ready"');
    expect(html).toContain('Câu hỏi A');
  });

  it('CP-08: renders many messages', () => {
    const html = render(<AgentChatPanel messages={[MSG_A, MSG_B, MSG_C]} />);
    expect(html).toContain('Câu hỏi A');
    expect(html).toContain('Trả lời B');
    expect(html).toContain('Thông báo C');
  });

  it('CP-09: uses message.id as stable key — all messages present', () => {
    const html = render(<AgentChatPanel messages={[MSG_B, MSG_A]} />);
    expect(html).toContain('data-message-id="a"');
    expect(html).toContain('data-message-id="b"');
  });

  it('CP-10: error message is visible in error state body', () => {
    const html = render(<AgentChatPanel error="Agent không phản hồi" />);
    expect(html).toContain('Agent không phản hồi');
  });
});

// ─── CM: ChatMessage ──────────────────────────────────────────────────────────

describe('ChatMessage', () => {
  it('CM-01: renders role in data attribute', () => {
    const html = render(<ChatMessage message={makeMsg({ role: 'agent' })} />);
    expect(html).toContain('data-role="agent"');
  });

  it('CM-02: renders role text in field span', () => {
    const html = render(<ChatMessage message={makeMsg({ role: 'system' })} />);
    expect(html).toContain('data-field="role"');
    expect(html).toContain('>system<');
  });

  it('CM-03: renders content', () => {
    const html = render(<ChatMessage message={makeMsg({ content: 'Nội dung tin nhắn kiểm tra.' })} />);
    expect(html).toContain('data-field="content"');
    expect(html).toContain('Nội dung tin nhắn kiểm tra.');
  });

  it('CM-04: renders confidence in data attribute', () => {
    const html = render(<ChatMessage message={makeMsg({ confidence: 'medium' })} />);
    expect(html).toContain('data-confidence="medium"');
  });

  it('CM-05: renders confidence text in field span', () => {
    const html = render(<ChatMessage message={makeMsg({ confidence: 'low' })} />);
    expect(html).toContain('data-field="confidence"');
    expect(html).toContain('>low<');
  });

  it('CM-06: renders timestamp field', () => {
    const ts   = new Date('2026-04-10T09:00:00').getTime();
    const html = render(<ChatMessage message={makeMsg({ timestamp: ts })} />);
    expect(html).toContain('data-field="timestamp"');
    expect(html).toContain('2026');
  });

  it('CM-07: renders sources count zero', () => {
    const html = render(<ChatMessage message={makeMsg({ sources: [] })} />);
    expect(html).toContain('0 sources');
  });

  it('CM-08: renders sources count from array', () => {
    const html = render(<ChatMessage message={makeMsg({ sources: ['s1', 's2', 's3'] })} />);
    expect(html).toContain('3 sources');
  });

  it('CM-09: renders relatedFindings count zero when undefined', () => {
    const html = render(<ChatMessage message={makeMsg({ relatedFindings: undefined })} />);
    expect(html).toContain('0 findings');
  });

  it('CM-10: renders relatedFindings count from array', () => {
    // LegalFinding is an opaque type here — cast to satisfy the interface
    const findings = [{ type: 'CRITICAL' }, { type: 'HIGH' }] as Parameters<typeof makeMsg>[0]['relatedFindings'];
    const html = render(<ChatMessage message={makeMsg({ relatedFindings: findings })} />);
    expect(html).toContain('2 findings');
  });

  it('CM-11: renders message id in data attribute', () => {
    const html = render(<ChatMessage message={makeMsg({ id: 'msg-xyz-456' })} />);
    expect(html).toContain('data-message-id="msg-xyz-456"');
  });

  it('CM-12: all three role values render correctly', () => {
    for (const role of ['user', 'agent', 'system'] as const) {
      const html = render(<ChatMessage message={makeMsg({ role })} />);
      expect(html).toContain(`data-role="${role}"`);
    }
  });
});

// ─── CI: ChatInput ────────────────────────────────────────────────────────────

describe('ChatInput', () => {
  it('CI-01: renders textarea element', () => {
    const html = render(<ChatInput />);
    expect(html).toContain('<textarea');
    expect(html).toContain('data-field="input"');
  });

  it('CI-02: renders send button', () => {
    const html = render(<ChatInput />);
    expect(html).toContain('data-field="send"');
    expect(html).toContain('Gửi');
  });

  it('CI-03: renders placeholder text', () => {
    const html = render(<ChatInput placeholder="Nhập câu hỏi của bạn..." />);
    expect(html).toContain('placeholder="Nhập câu hỏi của bạn..."');
  });

  it('CI-04: disabled state — textarea has disabled attribute', () => {
    const html = render(<ChatInput disabled />);
    expect(html).toContain('data-disabled="true"');
  });

  it('CI-05: disabled state — button has disabled attribute', () => {
    const html = render(<ChatInput disabled />);
    // React 19 renders disabled on both textarea and button
    const buttonIdx  = html.indexOf('data-field="send"');
    const disabledOc = html.indexOf('disabled', buttonIdx);
    expect(disabledOc).toBeGreaterThan(buttonIdx);
  });

  it('CI-06: not disabled by default', () => {
    const html = render(<ChatInput />);
    expect(html).toContain('data-disabled="false"');
  });

  it('CI-07: renders value in textarea', () => {
    const html = render(<ChatInput value="Câu hỏi đã điền sẵn." />);
    expect(html).toContain('Câu hỏi đã điền sẵn.');
  });

  it('CI-08: empty value renders empty textarea', () => {
    const html = render(<ChatInput value="" />);
    expect(html).toContain('<textarea');
  });

  it('CI-09: placeholder and value coexist', () => {
    const html = render(<ChatInput placeholder="Gợi ý..." value="Nội dung" />);
    expect(html).toContain('placeholder="Gợi ý..."');
    expect(html).toContain('Nội dung');
  });
});

// ─── AP: AutonomousPanel ──────────────────────────────────────────────────────

describe('AutonomousPanel', () => {
  const question: UserQuestion = {
    questionId: 'q-001',
    agentId:    'autonomous',
    question:   'Chọn phương thức đấu thầu nào?',
    required:   true,
  };

  it('AP-01: renders goal from session', () => {
    const html = render(<AutonomousPanel session={makeSession()} />);
    expect(html).toContain('data-field="goal"');
    expect(html).toContain('Mua sắm thiết bị văn phòng');
  });

  it('AP-02: renders session state', () => {
    const html = render(<AutonomousPanel session={makeSession({ state: 'planning' })} />);
    expect(html).toContain('data-field="state"');
    expect(html).toContain('>planning<');
  });

  it('AP-03: renders pendingQuestion from explicit prop', () => {
    const html = render(<AutonomousPanel pendingQuestion={question} />);
    expect(html).toContain('data-field="pending-question"');
    expect(html).toContain('Chọn phương thức đấu thầu nào?');
  });

  it('AP-04: renders pendingQuestion from session when prop not provided', () => {
    const session = makeSession({ state: 'ask-user', pendingQuestion: question });
    const html    = render(<AutonomousPanel session={session} />);
    expect(html).toContain('data-field="pending-question"');
    expect(html).toContain('Chọn phương thức đấu thầu nào?');
  });

  it('AP-05: pendingQuestion prop takes precedence over session.pendingQuestion', () => {
    const propQ: UserQuestion    = { ...question, question: 'Prop question' };
    const sessionQ: UserQuestion = { ...question, questionId: 'q-002', question: 'Session question' };
    const session                = makeSession({ pendingQuestion: sessionQ });
    const html                   = render(<AutonomousPanel session={session} pendingQuestion={propQ} />);
    expect(html).toContain('Prop question');
    expect(html).not.toContain('Session question');
  });

  it('AP-06: does not render pending-question when none', () => {
    const html = render(<AutonomousPanel session={makeSession()} />);
    expect(html).not.toContain('data-field="pending-question"');
  });

  it('AP-07: renders summary when provided', () => {
    const html = render(
      <AutonomousPanel session={makeSession()} summary="Bước lập kế hoạch hoàn thành." />,
    );
    expect(html).toContain('data-field="summary"');
    expect(html).toContain('Bước lập kế hoạch hoàn thành.');
  });

  it('AP-08: does not render summary when absent', () => {
    const html = render(<AutonomousPanel session={makeSession()} />);
    expect(html).not.toContain('data-field="summary"');
  });

  it('AP-09: renders traceId when provided', () => {
    const html = render(<AutonomousPanel session={makeSession()} traceId="tr-auto-999" />);
    expect(html).toContain('data-field="trace-id"');
    expect(html).toContain('tr-auto-999');
  });

  it('AP-10: does not render trace-id when absent', () => {
    const html = render(<AutonomousPanel session={makeSession()} />);
    expect(html).not.toContain('data-field="trace-id"');
  });

  it('AP-11: renders completedAt when session is done', () => {
    const ts   = new Date('2026-05-30T16:00:00').getTime();
    const html = render(<AutonomousPanel session={makeSession({ state: 'done', completedAt: ts })} />);
    expect(html).toContain('data-field="completed-at"');
    expect(html).toContain('2026');
  });

  it('AP-12: does not render completed-at when session is not done', () => {
    const html = render(<AutonomousPanel session={makeSession({ state: 'planning' })} />);
    expect(html).not.toContain('data-field="completed-at"');
  });

  it('AP-13: onStart callback existence — true when provided', () => {
    const html = render(<AutonomousPanel onStart={() => {}} />);
    expect(html).toContain('data-has-start="true"');
  });

  it('AP-14: onStart callback existence — false when absent', () => {
    const html = render(<AutonomousPanel />);
    expect(html).toContain('data-has-start="false"');
  });

  it('AP-15: onAnswer callback existence — true when provided', () => {
    const html = render(<AutonomousPanel onAnswer={() => {}} />);
    expect(html).toContain('data-has-answer="true"');
  });

  it('AP-16: onAnswer callback existence — false when absent', () => {
    const html = render(<AutonomousPanel />);
    expect(html).toContain('data-has-answer="false"');
  });

  it('AP-17: renders nothing session-specific when session is undefined', () => {
    const html = render(<AutonomousPanel />);
    expect(html).not.toContain('data-field="goal"');
    expect(html).not.toContain('data-field="state"');
  });
});
