/**
 * P7-E2E: End-to-end UI tests for Phase 7 panels — 56 tests
 *
 * Covers:
 *   - AgentProviderPanel
 *   - WorkflowPanel
 *   - ChatInterfacePanel
 *   - AutonomousWorkflowPanel
 *   - App.tsx integration (createAgentSystem() → panels)
 *   - Multi-panel interaction
 *   - AgentSystemBundle wiring (registry, agents, autonomous, chat)
 *
 * All rendering is done via renderToString (SSR-compatible, no async calls).
 *
 * Groups:
 *   P7E-01  (5)  createAgentSystem — full bundle shape
 *   P7E-02  (5)  AgentProviderPanel — renders all 6 agents from bundle
 *   P7E-03  (5)  WorkflowPanel — all render states
 *   P7E-04  (5)  ChatInterfacePanel — structural integration with bundle.chat
 *   P7E-05  (5)  AutonomousWorkflowPanel — structural integration with bundle.autonomous
 *   P7E-06  (4)  Multi-panel — AgentProviderPanel + WorkflowPanel
 *   P7E-07  (4)  Multi-panel — WorkflowPanel + ChatInterfacePanel
 *   P7E-08  (4)  AgentSystemBundle — agent IDs complete set
 *   P7E-09  (4)  AgentSystemBundle — capability integrity
 *   P7E-10  (4)  Panel wiring — AgentProviderPanel receives live bundle.agents
 *   P7E-11  (5)  SSR consistency — determinism and XSS safety
 *   P7E-12  (6)  App.tsx-style — all 3 Phase-7 panels from one bundle
 */

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';

import AgentProviderPanel, { createAgentSystem } from '../components/AgentProviderPanel';
import WorkflowPanel                              from '../components/WorkflowPanel';
import ChatInterfacePanel                         from '../components/ChatInterfacePanel';
import AutonomousWorkflowPanel                    from '../components/AutonomousWorkflowPanel';

import { AgentRegistry, AutonomousAgent, ChatAgent } from '../agents';
import type { AgentSession }                         from '../agents';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeSession(overrides: Partial<AgentSession> = {}): AgentSession {
  return {
    sessionId:   'p7e-session-001',
    state:       'planning',
    goal:        'Mua sắm vật tư tiêu hao',
    messageLog:  [],
    startedAt:   1_700_000_000_000,
    specRetries: 0,
    ...overrides,
  };
}

// ─── P7E-01 · createAgentSystem — full bundle shape ──────────────────────────

describe('P7E-01 · createAgentSystem — full bundle shape', () => {
  const bundle = createAgentSystem();

  it('P7E-01-01: bundle has registry key', () => {
    expect(bundle).toHaveProperty('registry');
  });

  it('P7E-01-02: bundle has agents key', () => {
    expect(bundle).toHaveProperty('agents');
  });

  it('P7E-01-03: bundle has autonomous key', () => {
    expect(bundle).toHaveProperty('autonomous');
  });

  it('P7E-01-04: bundle has chat key', () => {
    expect(bundle).toHaveProperty('chat');
  });

  it('P7E-01-05: bundle.agents has exactly 6 items', () => {
    expect(bundle.agents).toHaveLength(6);
  });
});

// ─── P7E-02 · AgentProviderPanel — renders from bundle ───────────────────────

describe('P7E-02 · AgentProviderPanel — renders all 6 agents from bundle', () => {
  const { agents } = createAgentSystem();
  const html = renderToString(React.createElement(AgentProviderPanel, { agents }));

  it('P7E-02-01: renders data-state="ready" with 6 agents', () => {
    expect(html).toContain('data-state="ready"');
  });

  it('P7E-02-02: renders exactly 6 li items', () => {
    const count = (html.match(/<li /g) ?? []).length;
    expect(count).toBe(6);
  });

  it('P7E-02-03: data-agent-id="chat" present', () => {
    expect(html).toContain('data-agent-id="chat"');
  });

  it('P7E-02-04: data-agent-id="autonomous" present', () => {
    expect(html).toContain('data-agent-id="autonomous"');
  });

  it('P7E-02-05: every agent has a non-zero capability count rendered', () => {
    const countSpans = html.match(/data-field="capability-count">(\d+)</g) ?? [];
    const counts = countSpans.map(s => parseInt(s.match(/>(\d+)</)![1], 10));
    expect(counts.length).toBe(6);
    for (const count of counts) {
      expect(count).toBeGreaterThan(0);
    }
  });
});

// ─── P7E-03 · WorkflowPanel — all render states ──────────────────────────────

describe('P7E-03 · WorkflowPanel — all render states', () => {
  it('P7E-03-01: renders data-state="empty" when session is undefined', () => {
    const html = renderToString(React.createElement(WorkflowPanel, {}));
    expect(html).toContain('data-state="empty"');
  });

  it('P7E-03-02: empty state contains Vietnamese "Chưa có phiên làm việc"', () => {
    const html = renderToString(React.createElement(WorkflowPanel, {}));
    expect(html).toContain('Chưa có phiên làm việc');
  });

  it('P7E-03-03: renders data-workflow-state matching session.state', () => {
    const html = renderToString(
      React.createElement(WorkflowPanel, { session: makeSession({ state: 'legal-review' }) }),
    );
    expect(html).toContain('data-workflow-state="legal-review"');
  });

  it('P7E-03-04: renders data-field="session-id" with session.sessionId value', () => {
    const html = renderToString(
      React.createElement(WorkflowPanel, { session: makeSession() }),
    );
    expect(html).toContain('data-field="session-id"');
    expect(html).toContain('p7e-session-001');
  });

  it('P7E-03-05: renders data-field="summary" when summary prop is provided', () => {
    const html = renderToString(
      React.createElement(WorkflowPanel, {
        session: makeSession(),
        summary: 'Tóm tắt quy trình kiểm tra',
      }),
    );
    expect(html).toContain('data-field="summary"');
    expect(html).toContain('Tóm tắt quy trình kiểm tra');
  });
});

// ─── P7E-04 · ChatInterfacePanel — structural integration ────────────────────

describe('P7E-04 · ChatInterfacePanel — structural integration with bundle.chat', () => {
  const { chat } = createAgentSystem();

  it('P7E-04-01: renders without throwing with bundle.chat', () => {
    expect(() =>
      renderToString(React.createElement(ChatInterfacePanel, { agent: chat })),
    ).not.toThrow();
  });

  it('P7E-04-02: has data-panel="chat-interface"', () => {
    const html = renderToString(React.createElement(ChatInterfacePanel, { agent: chat }));
    expect(html).toContain('data-panel="chat-interface"');
  });

  it('P7E-04-03: has data-field="chat-area"', () => {
    const html = renderToString(React.createElement(ChatInterfacePanel, { agent: chat }));
    expect(html).toContain('data-field="chat-area"');
  });

  it('P7E-04-04: chat-area contains data-state="empty" when no messages', () => {
    const html = renderToString(React.createElement(ChatInterfacePanel, { agent: chat }));
    expect(html).toContain('data-state="empty"');
    expect(html).toContain('Chưa có tin nhắn nào');
  });

  it('P7E-04-05: controls section has chat-input and send button', () => {
    const html = renderToString(React.createElement(ChatInterfacePanel, { agent: chat }));
    expect(html).toContain('data-field="chat-input"');
    expect(html).toContain('data-action="send"');
  });
});

// ─── P7E-05 · AutonomousWorkflowPanel — structural integration ───────────────

describe('P7E-05 · AutonomousWorkflowPanel — structural integration with bundle.autonomous', () => {
  const { autonomous } = createAgentSystem();

  it('P7E-05-01: renders without throwing with bundle.autonomous', () => {
    expect(() =>
      renderToString(React.createElement(AutonomousWorkflowPanel, { agent: autonomous })),
    ).not.toThrow();
  });

  it('P7E-05-02: has data-panel="autonomous-workflow"', () => {
    const html = renderToString(React.createElement(AutonomousWorkflowPanel, { agent: autonomous }));
    expect(html).toContain('data-panel="autonomous-workflow"');
  });

  it('P7E-05-03: WorkflowPanel inside renders data-state="empty" (no session initially)', () => {
    const html = renderToString(React.createElement(AutonomousWorkflowPanel, { agent: autonomous }));
    expect(html).toContain('data-state="empty"');
  });

  it('P7E-05-04: controls section has goal-input', () => {
    const html = renderToString(React.createElement(AutonomousWorkflowPanel, { agent: autonomous }));
    expect(html).toContain('data-field="goal-input"');
  });

  it('P7E-05-05: run button present in controls', () => {
    const html = renderToString(React.createElement(AutonomousWorkflowPanel, { agent: autonomous }));
    expect(html).toContain('data-action="run"');
  });
});

// ─── P7E-06 · Multi-panel — AgentProviderPanel + WorkflowPanel ───────────────

describe('P7E-06 · Multi-panel — AgentProviderPanel + WorkflowPanel', () => {
  const bundle = createAgentSystem();

  it('P7E-06-01: AgentProviderPanel renders without throwing', () => {
    expect(() =>
      renderToString(React.createElement(AgentProviderPanel, { agents: bundle.agents })),
    ).not.toThrow();
  });

  it('P7E-06-02: WorkflowPanel renders without throwing', () => {
    expect(() =>
      renderToString(React.createElement(WorkflowPanel, {})),
    ).not.toThrow();
  });

  it('P7E-06-03: AgentProviderPanel renders data-state="ready" (6 agents)', () => {
    const html = renderToString(React.createElement(AgentProviderPanel, { agents: bundle.agents }));
    expect(html).toContain('data-state="ready"');
  });

  it('P7E-06-04: WorkflowPanel renders data-state="empty" (no session)', () => {
    const html = renderToString(React.createElement(WorkflowPanel, {}));
    expect(html).toContain('data-state="empty"');
  });
});

// ─── P7E-07 · Multi-panel — WorkflowPanel + ChatInterfacePanel ───────────────

describe('P7E-07 · Multi-panel — WorkflowPanel + ChatInterfacePanel', () => {
  const bundle = createAgentSystem();

  it('P7E-07-01: WorkflowPanel renders without throwing', () => {
    expect(() => renderToString(React.createElement(WorkflowPanel, {}))).not.toThrow();
  });

  it('P7E-07-02: ChatInterfacePanel renders without throwing', () => {
    expect(() =>
      renderToString(React.createElement(ChatInterfacePanel, { agent: bundle.chat })),
    ).not.toThrow();
  });

  it('P7E-07-03: WorkflowPanel has data-state="empty"', () => {
    const html = renderToString(React.createElement(WorkflowPanel, {}));
    expect(html).toContain('data-state="empty"');
  });

  it('P7E-07-04: ChatInterfacePanel has data-panel="chat-interface"', () => {
    const html = renderToString(React.createElement(ChatInterfacePanel, { agent: bundle.chat }));
    expect(html).toContain('data-panel="chat-interface"');
  });
});

// ─── P7E-08 · AgentSystemBundle — agent IDs complete set ─────────────────────

describe('P7E-08 · AgentSystemBundle — agent IDs complete set', () => {
  const { agents } = createAgentSystem();
  const ids = agents.map(a => a.id);

  it('P7E-08-01: "planner" id present', () => {
    expect(ids).toContain('planner');
  });

  it('P7E-08-02: "specification" id present', () => {
    expect(ids).toContain('specification');
  });

  it('P7E-08-03: "legal-reviewer" id present', () => {
    expect(ids).toContain('legal-reviewer');
  });

  it('P7E-08-04: "autonomous" id present', () => {
    expect(ids).toContain('autonomous');
  });
});

// ─── P7E-09 · AgentSystemBundle — capability integrity ───────────────────────

describe('P7E-09 · AgentSystemBundle — capability integrity', () => {
  const { agents } = createAgentSystem();
  const byId = Object.fromEntries(agents.map(a => [a.id, a]));

  it('P7E-09-01: every agent has at least 1 capability', () => {
    for (const agent of agents) {
      expect(agent.capabilities.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('P7E-09-02: chat agent has exactly 5 capabilities', () => {
    expect(byId['chat'].capabilities).toHaveLength(5);
  });

  it('P7E-09-03: planner agent has exactly 4 capabilities', () => {
    expect(byId['planner'].capabilities).toHaveLength(4);
  });

  it('P7E-09-04: autonomous agent has exactly 7 capabilities', () => {
    expect(byId['autonomous'].capabilities).toHaveLength(7);
  });
});

// ─── P7E-10 · Panel wiring — AgentProviderPanel with live bundle ──────────────

describe('P7E-10 · Panel wiring — AgentProviderPanel receives live bundle.agents', () => {
  const { agents } = createAgentSystem();
  const html = renderToString(React.createElement(AgentProviderPanel, { agents }));

  it('P7E-10-01: renders exactly 6 agents (li count)', () => {
    const count = (html.match(/<li /g) ?? []).length;
    expect(count).toBe(6);
  });

  it('P7E-10-02: "Chat Agent" name in output', () => {
    expect(html).toContain('Chat Agent');
  });

  it('P7E-10-03: "Procurement Planner Agent" name in output', () => {
    expect(html).toContain('Procurement Planner Agent');
  });

  it('P7E-10-04: "Autonomous Procurement Agent" name in output', () => {
    expect(html).toContain('Autonomous Procurement Agent');
  });
});

// ─── P7E-11 · SSR consistency — determinism and XSS safety ───────────────────

describe('P7E-11 · SSR consistency — determinism and XSS safety', () => {
  it('P7E-11-01: createAgentSystem() called twice → same agent IDs in same order', () => {
    const ids1 = createAgentSystem().agents.map(a => a.id);
    const ids2 = createAgentSystem().agents.map(a => a.id);
    expect(ids1).toEqual(ids2);
  });

  it('P7E-11-02: AgentProviderPanel output is deterministic for same props', () => {
    const { agents } = createAgentSystem();
    const props = { agents };
    const html1 = renderToString(React.createElement(AgentProviderPanel, props));
    const html2 = renderToString(React.createElement(AgentProviderPanel, props));
    expect(html1).toBe(html2);
  });

  it('P7E-11-03: WorkflowPanel output is deterministic for same props', () => {
    const props = { session: makeSession(), summary: 'Test' };
    const html1 = renderToString(React.createElement(WorkflowPanel, props));
    const html2 = renderToString(React.createElement(WorkflowPanel, props));
    expect(html1).toBe(html2);
  });

  it('P7E-11-04: ChatInterfacePanel output is deterministic for same props', () => {
    const { chat } = createAgentSystem();
    const props = { agent: chat, initialInput: 'test' };
    const html1 = renderToString(React.createElement(ChatInterfacePanel, props));
    const html2 = renderToString(React.createElement(ChatInterfacePanel, props));
    expect(html1).toBe(html2);
  });

  it('P7E-11-05: no <script> tags in any Phase-7 panel output', () => {
    const { agents, chat, autonomous } = createAgentSystem();
    const panels = [
      renderToString(React.createElement(AgentProviderPanel, { agents })),
      renderToString(React.createElement(WorkflowPanel, {})),
      renderToString(React.createElement(ChatInterfacePanel, { agent: chat })),
      renderToString(React.createElement(AutonomousWorkflowPanel, { agent: autonomous })),
    ];
    for (const html of panels) {
      expect(html).not.toContain('<script');
    }
  });
});

// ─── P7E-12 · App.tsx-style — all 3 Phase-7 panels from one bundle ───────────

describe('P7E-12 · App.tsx-style — all 3 Phase-7 panels from one bundle', () => {
  const bundle = createAgentSystem();

  it('P7E-12-01: AutonomousWorkflowPanel renders without throwing with bundle.autonomous', () => {
    expect(() =>
      renderToString(React.createElement(AutonomousWorkflowPanel, { agent: bundle.autonomous })),
    ).not.toThrow();
  });

  it('P7E-12-02: ChatInterfacePanel renders without throwing with bundle.chat', () => {
    expect(() =>
      renderToString(React.createElement(ChatInterfacePanel, { agent: bundle.chat })),
    ).not.toThrow();
  });

  it('P7E-12-03: AgentProviderPanel renders without throwing with bundle.agents', () => {
    expect(() =>
      renderToString(React.createElement(AgentProviderPanel, { agents: bundle.agents })),
    ).not.toThrow();
  });

  it('P7E-12-04: AutonomousWorkflowPanel has data-panel="autonomous-workflow"', () => {
    const html = renderToString(
      React.createElement(AutonomousWorkflowPanel, { agent: bundle.autonomous }),
    );
    expect(html).toContain('data-panel="autonomous-workflow"');
  });

  it('P7E-12-05: ChatInterfacePanel has data-panel="chat-interface"', () => {
    const html = renderToString(
      React.createElement(ChatInterfacePanel, { agent: bundle.chat }),
    );
    expect(html).toContain('data-panel="chat-interface"');
  });

  it('P7E-12-06: AgentProviderPanel has data-panel="agent-provider"', () => {
    const html = renderToString(
      React.createElement(AgentProviderPanel, { agents: bundle.agents }),
    );
    expect(html).toContain('data-panel="agent-provider"');
  });
});
