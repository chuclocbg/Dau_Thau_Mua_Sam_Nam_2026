/**
 * P6-09E: Integration rendering tests across all UI components.
 *
 * Tests component composition — props flowing from parent to child,
 * combined rendering of sibling components, large-scale scenarios,
 * null/undefined prop safety, and SSR renderToString compatibility.
 *
 * No jsdom, no hooks, no browser APIs.  Uses react-dom/server renderToString.
 */

import { describe, it, expect } from 'vitest';
import { renderToString }       from 'react-dom/server';
import React                    from 'react';

import AgentStatusDashboard, {
  type AgentStatusInfo,
}                             from '../components/AgentStatusDashboard';
import AgentCard              from '../components/AgentCard';
import WorkflowPanel          from '../components/WorkflowPanel';
import StepTimeline, { type WorkflowStep } from '../components/StepTimeline';
import AgentChatPanel         from '../components/AgentChatPanel';
import ChatMessage            from '../components/ChatMessage';
import ChatInput              from '../components/ChatInput';
import AutonomousPanel        from '../components/AutonomousPanel';

import type { ChatMessage as ChatMessageRecord } from '../agents/ChatAgent';
import type { AgentSession, UserQuestion }       from '../agents/AutonomousAgent';
import type { WorkflowState }                    from '../agents/AutonomousAgent';
import type { AgentId }                          from '../agents/types';

// ─── Shared factories ─────────────────────────────────────────────────────────

function render(el: React.ReactElement): string {
  return renderToString(el);
}

function makeMsg(overrides: Partial<ChatMessageRecord> = {}): ChatMessageRecord {
  return {
    id:         'msg-001',
    role:       'user',
    content:    'Câu hỏi mặc định',
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

function makeAgent(
  agentId: AgentId,
  name: string,
  overrides: Partial<AgentStatusInfo> = {},
): AgentStatusInfo {
  return { agentId, name, status: 'idle', ...overrides };
}

const ALL_AGENT_IDS: AgentId[] = [
  'planner', 'specification', 'legal-reviewer', 'risk', 'chat', 'autonomous',
];

const ALL_WORKFLOW_STATES: WorkflowState[] = [
  'idle', 'planning', 'specifying', 'legal-review', 'risk-assessment',
  'ask-user', 'ready-for-export', 'exporting', 'done', 'error',
];

// ─── UI1: AgentStatusDashboard + AgentCard integration ───────────────────────

describe('UI1 — AgentStatusDashboard + AgentCard integration', () => {
  const AGENTS: AgentStatusInfo[] = [
    makeAgent('planner',     'Planner Agent',      { capabilities: ['plan', 'budget'] }),
    makeAgent('risk',        'Risk Agent',          { capabilities: ['assess'] }),
    makeAgent('legal-reviewer', 'Legal Agent',      { status: 'busy' }),
  ];

  it('UI1-01: multiple agents — each AgentCard appears with correct name', () => {
    const html = render(<AgentStatusDashboard agents={AGENTS} />);
    expect(html).toContain('Planner Agent');
    expect(html).toContain('Risk Agent');
    expect(html).toContain('Legal Agent');
  });

  it('UI1-02: multiple agents — each agentId data attribute present', () => {
    const html = render(<AgentStatusDashboard agents={AGENTS} />);
    expect(html).toContain('data-agent-id="planner"');
    expect(html).toContain('data-agent-id="risk"');
    expect(html).toContain('data-agent-id="legal-reviewer"');
  });

  it('UI1-03: loading state — no AgentCard content rendered', () => {
    const html = render(<AgentStatusDashboard agents={AGENTS} loading />);
    expect(html).toContain('data-state="loading"');
    expect(html).not.toContain('Planner Agent');
    expect(html).not.toContain('data-agent-id');
  });

  it('UI1-04: error state — error shown, no AgentCard content', () => {
    const html = render(<AgentStatusDashboard agents={AGENTS} error="Registry offline" />);
    expect(html).toContain('data-state="error"');
    expect(html).toContain('Registry offline');
    expect(html).not.toContain('data-agent-id');
  });

  it('UI1-05: empty state when agents array is empty', () => {
    const html = render(<AgentStatusDashboard agents={[]} />);
    expect(html).toContain('data-state="empty"');
    expect(html).not.toContain('data-agent-id');
  });

  it('UI1-06: stable keys — all agents present regardless of array order', () => {
    const reversed = [...AGENTS].reverse();
    const html1 = render(<AgentStatusDashboard agents={AGENTS}   />);
    const html2 = render(<AgentStatusDashboard agents={reversed} />);
    expect(html1).toContain('data-agent-id="planner"');
    expect(html1).toContain('data-agent-id="legal-reviewer"');
    expect(html2).toContain('data-agent-id="planner"');
    expect(html2).toContain('data-agent-id="legal-reviewer"');
  });

  it('UI1-07: capability count flows through to AgentCard child', () => {
    const html = render(<AgentStatusDashboard agents={AGENTS} />);
    expect(html).toContain('2 capabilities');  // planner
    expect(html).toContain('1 capabilities');  // risk
  });

  it('UI1-08: status flows through to AgentCard child', () => {
    const html = render(<AgentStatusDashboard agents={AGENTS} />);
    expect(html).toContain('data-status="busy"');
  });

  it('UI1-09: traceId flows through to AgentCard child', () => {
    const withTrace = makeAgent('chat', 'Chat Agent', { traceId: 'tr-ui1-test' });
    const html = render(<AgentStatusDashboard agents={[withTrace]} />);
    expect(html).toContain('tr-ui1-test');
  });

  it('UI1-10: error message flows to AgentCard when status=error', () => {
    const errAgent = makeAgent('autonomous', 'Autonomous Agent', {
      status: 'error',
      error:  'Model không phản hồi',
    });
    const html = render(<AgentStatusDashboard agents={[errAgent]} />);
    expect(html).toContain('Model không phản hồi');
  });
});

// ─── UI2: WorkflowPanel + StepTimeline integration ───────────────────────────

describe('UI2 — WorkflowPanel + StepTimeline integration', () => {
  const STEPS: WorkflowStep[] = [
    { state: 'planning',     label: 'Lập kế hoạch' },
    { state: 'specifying',   label: 'Xây dựng HSYC' },
    { state: 'legal-review', label: 'Thẩm định pháp lý' },
    { state: 'done',         label: 'Hoàn thành', completedAt: new Date('2026-03-20T10:00:00').getTime() },
  ];

  it('UI2-01: empty workflow — both components in default/empty state', () => {
    const html = render(
      <div>
        <WorkflowPanel />
        <StepTimeline />
      </div>,
    );
    expect(html).toContain('Chưa có phiên làm việc');
    expect(html).toContain('Không có bước nào');
  });

  it('UI2-02: session drives WorkflowPanel state text', () => {
    const session = makeSession({ state: 'planning' });
    const html    = render(<WorkflowPanel session={session} />);
    expect(html).toContain('>planning<');
    expect(html).toContain('data-workflow-state="planning"');
  });

  it('UI2-03: one step renders in StepTimeline', () => {
    const html = render(<StepTimeline steps={[STEPS[0]]} />);
    expect(html).toContain('Lập kế hoạch');
    expect(html).toContain('data-step-state="planning"');
  });

  it('UI2-04: multiple steps all appear in timeline', () => {
    const html = render(<StepTimeline steps={STEPS} />);
    expect(html).toContain('Lập kế hoạch');
    expect(html).toContain('Xây dựng HSYC');
    expect(html).toContain('Thẩm định pháp lý');
    expect(html).toContain('Hoàn thành');
  });

  it('UI2-05: active step — currentState matches session.state', () => {
    const session = makeSession({ state: 'specifying' });
    const html    = render(
      <div>
        <WorkflowPanel session={session} />
        <StepTimeline steps={STEPS} currentState={session.state} />
      </div>,
    );
    expect(html).toContain('data-step-state="specifying" data-active="true"');
    expect(html).toContain('data-step-state="planning" data-active="false"');
  });

  it('UI2-06: completed step has data-completed="true" and timestamp', () => {
    const html = render(<StepTimeline steps={STEPS} />);
    expect(html).toContain('data-step-state="done" data-active="false" data-completed="true"');
    expect(html).toContain('data-field="completed-at"');
  });

  it('UI2-07: summary text renders in WorkflowPanel', () => {
    const html = render(
      <WorkflowPanel session={makeSession()} summary="Bước lập kế hoạch đã xong." />,
    );
    expect(html).toContain('data-field="summary"');
    expect(html).toContain('Bước lập kế hoạch đã xong.');
  });

  it('UI2-08: traceId renders in WorkflowPanel', () => {
    const html = render(
      <WorkflowPanel session={makeSession()} traceId="tr-wf-ui2" />,
    );
    expect(html).toContain('data-field="trace-id"');
    expect(html).toContain('tr-wf-ui2');
  });

  it('UI2-09: session message count reflects messageLog length', () => {
    const log = Array.from({ length: 7 }, (_, i) => ({
      traceId: `t${i}`, from: 'user' as const, to: 'planner' as const,
      type: 'request' as const, payload: {}, timestamp: i,
    }));
    const html = render(<WorkflowPanel session={makeSession({ messageLog: log })} />);
    expect(html).toContain('7 messages');
  });
});

// ─── UI3: AgentChatPanel + ChatMessage integration ────────────────────────────

describe('UI3 — AgentChatPanel + ChatMessage integration', () => {
  const MSG_USER:  ChatMessageRecord = makeMsg({ id: 'u1', role: 'user',   content: 'Câu hỏi của người dùng', confidence: 'high',   sources: ['s1'] });
  const MSG_AGENT: ChatMessageRecord = makeMsg({ id: 'a1', role: 'agent',  content: 'Trả lời từ agent',       confidence: 'medium', sources: ['s1', 's2', 's3'] });
  const MSG_SYS:   ChatMessageRecord = makeMsg({ id: 's1', role: 'system', content: 'Thông báo hệ thống',     confidence: 'low',    sources: [] });

  it('UI3-01: empty chat renders empty state', () => {
    const html = render(<AgentChatPanel />);
    expect(html).toContain('data-state="empty"');
  });

  it('UI3-02: loading renders loading state, not messages', () => {
    const html = render(<AgentChatPanel loading messages={[MSG_USER]} />);
    expect(html).toContain('data-state="loading"');
    expect(html).not.toContain('Câu hỏi của người dùng');
  });

  it('UI3-03: error renders error state with message', () => {
    const html = render(<AgentChatPanel error="Không thể kết nối" />);
    expect(html).toContain('data-state="error"');
    expect(html).toContain('Không thể kết nối');
  });

  it('UI3-04: many messages — all content rendered', () => {
    const html = render(<AgentChatPanel messages={[MSG_USER, MSG_AGENT, MSG_SYS]} />);
    expect(html).toContain('Câu hỏi của người dùng');
    expect(html).toContain('Trả lời từ agent');
    expect(html).toContain('Thông báo hệ thống');
  });

  it('UI3-05: confidence renders in each ChatMessage child', () => {
    const html = render(<AgentChatPanel messages={[MSG_USER, MSG_AGENT, MSG_SYS]} />);
    expect(html).toContain('data-confidence="high"');
    expect(html).toContain('data-confidence="medium"');
    expect(html).toContain('data-confidence="low"');
  });

  it('UI3-06: timestamp renders in each ChatMessage child', () => {
    const html = render(<AgentChatPanel messages={[MSG_USER]} />);
    expect(html).toContain('data-field="timestamp"');
  });

  it('UI3-07: sources count flows through correctly', () => {
    const html = render(<AgentChatPanel messages={[MSG_USER, MSG_AGENT, MSG_SYS]} />);
    expect(html).toContain('1 sources');
    expect(html).toContain('3 sources');
    expect(html).toContain('0 sources');
  });

  it('UI3-08: relatedFindings count renders for each message', () => {
    const withFindings = makeMsg({
      id:             'f1',
      relatedFindings: [{ type: 'HIGH' } as never, { type: 'LOW' } as never],
    });
    const html = render(<AgentChatPanel messages={[withFindings]} />);
    expect(html).toContain('2 findings');
  });

  it('UI3-09: message id used as key — all message ids present in output', () => {
    const html = render(<AgentChatPanel messages={[MSG_USER, MSG_AGENT, MSG_SYS]} />);
    expect(html).toContain('data-message-id="u1"');
    expect(html).toContain('data-message-id="a1"');
    expect(html).toContain('data-message-id="s1"');
  });

  it('UI3-10: role attribute on each ChatMessage child', () => {
    const html = render(<AgentChatPanel messages={[MSG_USER, MSG_AGENT, MSG_SYS]} />);
    expect(html).toContain('data-role="user"');
    expect(html).toContain('data-role="agent"');
    expect(html).toContain('data-role="system"');
  });
});

// ─── UI4: AutonomousPanel integration ─────────────────────────────────────────

describe('UI4 — AutonomousPanel integration', () => {
  const QUESTION: UserQuestion = {
    questionId: 'q-ap-001',
    agentId:    'autonomous',
    question:   'Xác nhận phương thức chỉ định thầu?',
    required:   true,
    legalContext: 'Điều 24 NĐ 214/2025',
  };

  it('UI4-01: renders goal from session', () => {
    const html = render(
      <AutonomousPanel session={makeSession({ goal: 'Mua thiết bị y tế năm 2026' })} />,
    );
    expect(html).toContain('data-field="goal"');
    expect(html).toContain('Mua thiết bị y tế năm 2026');
  });

  it('UI4-02: renders current state from session', () => {
    const html = render(
      <AutonomousPanel session={makeSession({ state: 'risk-assessment' })} />,
    );
    expect(html).toContain('data-field="state"');
    expect(html).toContain('>risk-assessment<');
  });

  it('UI4-03: renders pendingQuestion question text', () => {
    const html = render(
      <AutonomousPanel
        session={makeSession({ state: 'ask-user', pendingQuestion: QUESTION })}
      />,
    );
    expect(html).toContain('data-field="pending-question"');
    expect(html).toContain('Xác nhận phương thức chỉ định thầu?');
  });

  it('UI4-04: renders completedAt when session is done', () => {
    const ts = new Date('2026-07-01T14:00:00').getTime();
    const html = render(
      <AutonomousPanel session={makeSession({ state: 'done', completedAt: ts })} />,
    );
    expect(html).toContain('data-field="completed-at"');
    expect(html).toContain('2026');
  });

  it('UI4-05: renders traceId when provided', () => {
    const html = render(
      <AutonomousPanel session={makeSession()} traceId="tr-auto-ui4" />,
    );
    expect(html).toContain('data-field="trace-id"');
    expect(html).toContain('tr-auto-ui4');
  });

  it('UI4-06: data-has-start reflects callback presence — true', () => {
    const html = render(<AutonomousPanel onStart={() => {}} />);
    expect(html).toContain('data-has-start="true"');
  });

  it('UI4-07: data-has-start reflects callback absence — false', () => {
    const html = render(<AutonomousPanel />);
    expect(html).toContain('data-has-start="false"');
  });

  it('UI4-08: data-has-answer reflects callback presence — true', () => {
    const html = render(<AutonomousPanel onAnswer={() => {}} />);
    expect(html).toContain('data-has-answer="true"');
  });

  it('UI4-09: data-has-answer reflects callback absence — false', () => {
    const html = render(<AutonomousPanel />);
    expect(html).toContain('data-has-answer="false"');
  });

  it('UI4-10: renders summary text', () => {
    const html = render(
      <AutonomousPanel session={makeSession()} summary="Hoàn thành đánh giá pháp lý." />,
    );
    expect(html).toContain('data-field="summary"');
    expect(html).toContain('Hoàn thành đánh giá pháp lý.');
  });
});

// ─── UI5: Large rendering scenarios ──────────────────────────────────────────

describe('UI5 — Large rendering scenarios', () => {
  it('UI5-01: 50 messages in AgentChatPanel — all message ids present', () => {
    const messages: ChatMessageRecord[] = Array.from({ length: 50 }, (_, i) => ({
      id:         `msg-${i}`,
      role:       (['user', 'agent', 'system'] as const)[i % 3],
      content:    `Tin nhắn số ${i}`,
      sources:    i % 5 === 0 ? ['s1', 's2'] : [],
      confidence: (['high', 'medium', 'low'] as const)[i % 3],
      timestamp:  1_750_000_000_000 + i * 1000,
    }));

    const html = render(<AgentChatPanel messages={messages} />);

    expect(html).toContain('data-state="ready"');
    // Spot-check first, middle, and last message IDs
    expect(html).toContain('data-message-id="msg-0"');
    expect(html).toContain('data-message-id="msg-24"');
    expect(html).toContain('data-message-id="msg-49"');
    // Verify total count via substring occurrences (crude but effective)
    const matches = html.match(/data-message-id="/g);
    expect(matches?.length).toBe(50);
  });

  it('UI5-02: all 10 WorkflowState steps in StepTimeline', () => {
    const steps: WorkflowStep[] = ALL_WORKFLOW_STATES.map(s => ({
      state: s,
      label: `Bước: ${s}`,
    }));

    const html = render(<StepTimeline steps={steps} currentState="planning" />);

    expect(html).toContain('data-state="timeline"');
    for (const state of ALL_WORKFLOW_STATES) {
      expect(html).toContain(`data-step-state="${state}"`);
    }
    expect(html).toContain('data-active="true"');
    // Only planning should be active
    const activeCount = (html.match(/data-active="true"/g) ?? []).length;
    expect(activeCount).toBe(1);
  });

  it('UI5-03: all 6 AgentId values rendered in AgentStatusDashboard', () => {
    const agents: AgentStatusInfo[] = ALL_AGENT_IDS.map(id =>
      makeAgent(id, `${id} agent`),
    );

    const html = render(<AgentStatusDashboard agents={agents} />);

    expect(html).toContain('data-state="ready"');
    for (const id of ALL_AGENT_IDS) {
      expect(html).toContain(`data-agent-id="${id}"`);
    }
    const cardCount = (html.match(/data-agent-id="/g) ?? []).length;
    expect(cardCount).toBe(6);
  });
});

// ─── UI6: Null and undefined props ────────────────────────────────────────────

describe('UI6 — Null and undefined props (graceful rendering)', () => {
  it('UI6-01: AgentChatPanel with no props renders empty state', () => {
    expect(() => render(<AgentChatPanel />)).not.toThrow();
    const html = render(<AgentChatPanel />);
    expect(html).toContain('data-state="empty"');
  });

  it('UI6-02: AgentStatusDashboard with no props renders empty state', () => {
    expect(() => render(<AgentStatusDashboard />)).not.toThrow();
    const html = render(<AgentStatusDashboard />);
    expect(html).toContain('data-state="empty"');
  });

  it('UI6-03: WorkflowPanel with no props renders empty state', () => {
    expect(() => render(<WorkflowPanel />)).not.toThrow();
    const html = render(<WorkflowPanel />);
    expect(html).toContain('data-state="empty"');
  });

  it('UI6-04: StepTimeline with no props renders empty state', () => {
    expect(() => render(<StepTimeline />)).not.toThrow();
    const html = render(<StepTimeline />);
    expect(html).toContain('data-state="empty"');
  });

  it('UI6-05: AutonomousPanel with no props renders root element', () => {
    expect(() => render(<AutonomousPanel />)).not.toThrow();
    const html = render(<AutonomousPanel />);
    expect(html).toContain('data-has-start="false"');
    expect(html).toContain('data-has-answer="false"');
  });

  it('UI6-06: ChatInput with no props renders textarea and button', () => {
    expect(() => render(<ChatInput />)).not.toThrow();
    const html = render(<ChatInput />);
    expect(html).toContain('<textarea');
    expect(html).toContain('data-field="send"');
  });

  it('UI6-07: AgentCard with minimal required props renders correctly', () => {
    expect(() => render(<AgentCard agentId="planner" name="Test" />)).not.toThrow();
    const html = render(<AgentCard agentId="planner" name="Test" />);
    expect(html).toContain('data-agent-id="planner"');
    expect(html).toContain('0 capabilities');
  });

  it('UI6-08: ChatMessage with zero sources and no findings renders counts', () => {
    const msg = makeMsg({ sources: [], relatedFindings: undefined });
    expect(() => render(<ChatMessage message={msg} />)).not.toThrow();
    const html = render(<ChatMessage message={msg} />);
    expect(html).toContain('0 sources');
    expect(html).toContain('0 findings');
  });

  it('UI6-09: AgentStatusDashboard with undefined agents is identical to empty array', () => {
    const htmlUndef = render(<AgentStatusDashboard agents={undefined} />);
    const htmlEmpty = render(<AgentStatusDashboard agents={[]} />);
    expect(htmlUndef).toBe(htmlEmpty);
  });
});

// ─── UI7: SSR renderToString compatibility ────────────────────────────────────

describe('UI7 — SSR renderToString compatibility', () => {
  const FULL_MSG = makeMsg({
    id: 'full-msg', role: 'agent', content: 'Đây là câu trả lời.',
    sources: ['src-A', 'src-B'], confidence: 'medium',
    relatedFindings: [{ type: 'HIGH' } as never],
  });

  const FULL_SESSION = makeSession({
    state:       'legal-review',
    goal:        'Mua thiết bị phòng lab',
    messageLog:  [
      { traceId: 't1', from: 'user', to: 'planner', type: 'request', payload: {}, timestamp: 1 },
    ],
    completedAt: undefined,
  });

  const FULL_QUESTION: UserQuestion = {
    questionId: 'q-full', agentId: 'autonomous',
    question: 'Xác nhận ngưỡng chào giá?', required: true,
  };

  it('UI7-01: AgentChatPanel renders to string without throwing', () => {
    expect(() => render(<AgentChatPanel messages={[FULL_MSG]} />)).not.toThrow();
    expect(render(<AgentChatPanel messages={[FULL_MSG]} />).length).toBeGreaterThan(0);
  });

  it('UI7-02: AgentStatusDashboard renders to string without throwing', () => {
    const agents = ALL_AGENT_IDS.map(id => makeAgent(id, id));
    expect(() => render(<AgentStatusDashboard agents={agents} />)).not.toThrow();
  });

  it('UI7-03: WorkflowPanel renders to string without throwing', () => {
    expect(() => render(<WorkflowPanel session={FULL_SESSION} traceId="tr-ssr" summary="OK" />)).not.toThrow();
  });

  it('UI7-04: StepTimeline renders to string without throwing', () => {
    const steps: WorkflowStep[] = ALL_WORKFLOW_STATES.map(s => ({ state: s, label: s }));
    expect(() => render(<StepTimeline steps={steps} currentState="legal-review" />)).not.toThrow();
  });

  it('UI7-05: ChatMessage renders to string without throwing', () => {
    expect(() => render(<ChatMessage message={FULL_MSG} />)).not.toThrow();
  });

  it('UI7-06: ChatInput renders to string without throwing', () => {
    expect(() => render(<ChatInput placeholder="..." disabled value="prefill" />)).not.toThrow();
  });

  it('UI7-07: AutonomousPanel renders to string without throwing', () => {
    expect(() => render(
      <AutonomousPanel
        session={FULL_SESSION}
        pendingQuestion={FULL_QUESTION}
        onStart={() => {}}
        onAnswer={() => {}}
        traceId="tr-ap-ssr"
        summary="Step summary."
      />,
    )).not.toThrow();
  });

  it('UI7-08: AgentCard renders to string without throwing', () => {
    expect(() => render(
      <AgentCard
        agentId="autonomous"
        name="Autonomous Agent"
        status="error"
        capabilities={['run', 'pause', 'resume']}
        traceId="tr-card"
        error="Timeout"
        lastUpdated={Date.now()}
      />,
    )).not.toThrow();
  });

  it('UI7-09: all components rendered together in one tree without throwing', () => {
    const agents  = ALL_AGENT_IDS.map(id => makeAgent(id, id));
    const steps: WorkflowStep[] = [
      { state: 'planning', label: 'Plan' },
      { state: 'done',     label: 'Done', completedAt: 1_750_000_000_000 },
    ];

    expect(() => render(
      <div>
        <AgentStatusDashboard agents={agents} />
        <WorkflowPanel session={FULL_SESSION} summary="Summary" traceId="tr-tree" />
        <StepTimeline steps={steps} currentState="planning" />
        <AgentChatPanel messages={[FULL_MSG]} />
        <ChatInput placeholder="Type here" />
        <AutonomousPanel
          session={FULL_SESSION}
          pendingQuestion={FULL_QUESTION}
          onStart={() => {}}
          onAnswer={() => {}}
          traceId="tr-ap"
          summary="AP summary"
        />
      </div>,
    )).not.toThrow();
  });

  it('UI7-10: output is non-empty HTML string for every component', () => {
    const cases: React.ReactElement[] = [
      <AgentChatPanel key="cp" />,
      <AgentStatusDashboard key="asd" />,
      <WorkflowPanel key="wp" />,
      <StepTimeline key="st" />,
      <ChatInput key="ci" />,
      <AutonomousPanel key="ap" />,
      <AgentCard key="ac" agentId="planner" name="P" />,
      <ChatMessage key="cm" message={FULL_MSG} />,
    ];
    for (const el of cases) {
      const html = render(el);
      expect(typeof html).toBe('string');
      expect(html.length).toBeGreaterThan(0);
    }
  });
});
