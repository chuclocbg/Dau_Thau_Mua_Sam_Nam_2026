/**
 * P6-10X: UI Components test suite
 *
 * 56 tests across 12 groups:
 *   UX1  (5) Dashboard
 *   UX2  (5) ProviderPanel
 *   UX3  (5) SessionPanel
 *   UX4  (5) MemoryPanel
 *   UX5  (5) WorkflowEnginePanel
 *   UX6  (4) AgentPanel
 *   UX7  (4) ToolPanel
 *   UX8  (5) ChatPanel
 *   UX9  (5) large scenarios
 *   UX10 (4) null props
 *   UX11 (5) SSR renderToString
 *   UX12 (4) never-throw
 */

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';

import { Dashboard }     from '../components/Dashboard';
import { ProviderPanel } from '../components/ProviderPanel';
import { SessionPanel }  from '../components/SessionPanel';
import { MemoryPanel }   from '../components/MemoryPanel';
import { WorkflowEnginePanel } from '../components/WorkflowEnginePanel';
import { AgentPanel }    from '../components/AgentPanel';
import { ToolPanel }     from '../components/ToolPanel';
import { ChatPanel }     from '../components/ChatPanel';

import type { ProviderInfo }       from '../components/ProviderPanel';
import type { SessionDisplayInfo } from '../components/SessionPanel';
import type { MemorySnapshotInfo } from '../components/MemoryPanel';
import type { WorkflowInfo }       from '../components/WorkflowEnginePanel';
import type { AgentInfo }          from '../components/AgentPanel';
import type { ToolInfo }           from '../components/ToolPanel';
import type { ChatMessage }        from '../components/ChatPanel';

// ─── UX1 · Dashboard ──────────────────────────────────────────────────────────

describe('UX1 · Dashboard', () => {
  it('UX1-01: renders default title when no title prop', () => {
    const html = renderToString(React.createElement(Dashboard, {}));
    expect(html).toContain('AI Dashboard');
  });

  it('UX1-02: renders custom title', () => {
    const html = renderToString(React.createElement(Dashboard, { title: 'Procurement AI' }));
    expect(html).toContain('Procurement AI');
  });

  it('UX1-03: renders all seven panel sections', () => {
    const html = renderToString(React.createElement(Dashboard, {}));
    expect(html).toContain('provider-panel');
    expect(html).toContain('session-panel');
    expect(html).toContain('memory-panel');
    expect(html).toContain('workflow-engine-panel');
    expect(html).toContain('agent-panel');
    expect(html).toContain('tool-panel');
    expect(html).toContain('chat-panel');
  });

  it('UX1-04: passes providers data down to provider section', () => {
    const providers: ProviderInfo[] = [{ id: 'gpt4', name: 'GPT-4', status: 'available' }];
    const html = renderToString(React.createElement(Dashboard, { providers }));
    expect(html).toContain('GPT-4');
    expect(html).toContain('available');
  });

  it('UX1-05: renders without throwing when all props are omitted', () => {
    expect(() => renderToString(React.createElement(Dashboard, {}))).not.toThrow();
  });
});

// ─── UX2 · ProviderPanel ──────────────────────────────────────────────────────

describe('UX2 · ProviderPanel', () => {
  it('UX2-01: renders default title and empty-state with no providers', () => {
    const html = renderToString(React.createElement(ProviderPanel, {}));
    expect(html).toContain('Providers');
    expect(html).toContain('No providers registered');
  });

  it('UX2-02: renders a single provider name', () => {
    const providers: ProviderInfo[] = [{ id: 'c1', name: 'Claude', status: 'available' }];
    const html = renderToString(React.createElement(ProviderPanel, { providers }));
    expect(html).toContain('Claude');
  });

  it('UX2-03: renders CSS class derived from provider status', () => {
    const providers: ProviderInfo[] = [{ id: 'g1', name: 'Gemini', status: 'error' }];
    const html = renderToString(React.createElement(ProviderPanel, { providers }));
    expect(html).toContain('status-error');
  });

  it('UX2-04: renders provider model when supplied', () => {
    const providers: ProviderInfo[] = [{ id: 'o1', name: 'OpenAI', status: 'available', model: 'gpt-4o' }];
    const html = renderToString(React.createElement(ProviderPanel, { providers }));
    expect(html).toContain('gpt-4o');
  });

  it('UX2-05: renders multiple providers each with a stable key', () => {
    const providers: ProviderInfo[] = [
      { id: 'a', name: 'Alpha', status: 'available' },
      { id: 'b', name: 'Beta',  status: 'unavailable' },
      { id: 'c', name: 'Gamma', status: 'available' },
    ];
    const html = renderToString(React.createElement(ProviderPanel, { providers }));
    expect(html).toContain('Alpha');
    expect(html).toContain('Beta');
    expect(html).toContain('Gamma');
  });
});

// ─── UX3 · SessionPanel ───────────────────────────────────────────────────────

describe('UX3 · SessionPanel', () => {
  it('UX3-01: renders default title and empty-state with no sessions', () => {
    const html = renderToString(React.createElement(SessionPanel, {}));
    expect(html).toContain('Sessions');
    expect(html).toContain('No active sessions');
  });

  it('UX3-02: renders an IDLE session', () => {
    const sessions: SessionDisplayInfo[] = [{ id: 's1', state: 'IDLE', label: 'Boot session' }];
    const html = renderToString(React.createElement(SessionPanel, { sessions }));
    expect(html).toContain('Boot session');
    expect(html).toContain('IDLE');
  });

  it('UX3-03: renders a RUNNING session with appropriate CSS class', () => {
    const sessions: SessionDisplayInfo[] = [{ id: 's2', state: 'RUNNING', label: 'Active' }];
    const html = renderToString(React.createElement(SessionPanel, { sessions }));
    expect(html).toContain('state-running');
  });

  it('UX3-04: renders an ERROR session', () => {
    const sessions: SessionDisplayInfo[] = [{ id: 's3', state: 'ERROR', label: 'Failed run' }];
    const html = renderToString(React.createElement(SessionPanel, { sessions }));
    expect(html).toContain('ERROR');
    expect(html).toContain('Failed run');
  });

  it('UX3-05: renders multiple sessions in order', () => {
    const sessions: SessionDisplayInfo[] = [
      { id: 'sa', state: 'IDLE',      label: 'First'  },
      { id: 'sb', state: 'COMPLETED', label: 'Second' },
    ];
    const html = renderToString(React.createElement(SessionPanel, { sessions }));
    expect(html).toContain('First');
    expect(html).toContain('Second');
    expect(html).toContain('COMPLETED');
  });
});

// ─── UX4 · MemoryPanel ────────────────────────────────────────────────────────

describe('UX4 · MemoryPanel', () => {
  it('UX4-01: renders default title and empty-state with no snapshots', () => {
    const html = renderToString(React.createElement(MemoryPanel, {}));
    expect(html).toContain('Memory');
    expect(html).toContain('No memory snapshots');
  });

  it('UX4-02: renders a single snapshot with its label', () => {
    const snapshots: MemorySnapshotInfo[] = [{ id: 'm1', label: 'Session A', turnCount: 3 }];
    const html = renderToString(React.createElement(MemoryPanel, { snapshots }));
    expect(html).toContain('Session A');
  });

  it('UX4-03: renders turn count', () => {
    const snapshots: MemorySnapshotInfo[] = [{ id: 'm2', label: 'Run', turnCount: 7 }];
    const html = renderToString(React.createElement(MemoryPanel, { snapshots }));
    expect(html).toContain('7 turns');
  });

  it('UX4-04: renders total tokens when provided', () => {
    const snapshots: MemorySnapshotInfo[] = [{ id: 'm3', label: 'X', turnCount: 2, totalTokens: 512 }];
    const html = renderToString(React.createElement(MemoryPanel, { snapshots }));
    expect(html).toContain('512 tokens');
  });

  it('UX4-05: omits token span when totalTokens is absent', () => {
    const snapshots: MemorySnapshotInfo[] = [{ id: 'm4', label: 'Y', turnCount: 1 }];
    const html = renderToString(React.createElement(MemoryPanel, { snapshots }));
    expect(html).not.toContain('tokens');
  });
});

// ─── UX5 · WorkflowEnginePanel ────────────────────────────────────────────────

describe('UX5 · WorkflowEnginePanel', () => {
  it('UX5-01: renders default title and empty-state with no workflows', () => {
    const html = renderToString(React.createElement(WorkflowEnginePanel, {}));
    expect(html).toContain('Workflows');
    expect(html).toContain('No workflows registered');
  });

  it('UX5-02: renders a single workflow name', () => {
    const workflows: WorkflowInfo[] = [{ id: 'wf1', name: 'Procurement Flow', status: 'pending' }];
    const html = renderToString(React.createElement(WorkflowEnginePanel, { workflows }));
    expect(html).toContain('Procurement Flow');
  });

  it('UX5-03: renders workflow status with CSS class', () => {
    const workflows: WorkflowInfo[] = [{ id: 'wf2', name: 'Run', status: 'completed' }];
    const html = renderToString(React.createElement(WorkflowEnginePanel, { workflows }));
    expect(html).toContain('status-completed');
  });

  it('UX5-04: renders step count when provided', () => {
    const workflows: WorkflowInfo[] = [{ id: 'wf3', name: 'Pipeline', status: 'running', stepCount: 5 }];
    const html = renderToString(React.createElement(WorkflowEnginePanel, { workflows }));
    expect(html).toContain('5 steps');
  });

  it('UX5-05: renders multiple workflows', () => {
    const workflows: WorkflowInfo[] = [
      { id: 'w1', name: 'Alpha Flow', status: 'pending' },
      { id: 'w2', name: 'Beta Flow',  status: 'completed' },
    ];
    const html = renderToString(React.createElement(WorkflowEnginePanel, { workflows }));
    expect(html).toContain('Alpha Flow');
    expect(html).toContain('Beta Flow');
  });
});

// ─── UX6 · AgentPanel ─────────────────────────────────────────────────────────

describe('UX6 · AgentPanel', () => {
  it('UX6-01: renders default title and empty-state with no agents', () => {
    const html = renderToString(React.createElement(AgentPanel, {}));
    expect(html).toContain('Agents');
    expect(html).toContain('No agents registered');
  });

  it('UX6-02: renders a single agent name', () => {
    const agents: AgentInfo[] = [{ id: 'ag1', name: 'Planner Agent' }];
    const html = renderToString(React.createElement(AgentPanel, { agents }));
    expect(html).toContain('Planner Agent');
  });

  it('UX6-03: renders agent description when provided', () => {
    const agents: AgentInfo[] = [{ id: 'ag2', name: 'Legal Reviewer', description: 'Reviews legal text' }];
    const html = renderToString(React.createElement(AgentPanel, { agents }));
    expect(html).toContain('Reviews legal text');
  });

  it('UX6-04: renders multiple agents', () => {
    const agents: AgentInfo[] = [
      { id: 'x', name: 'Agent X' },
      { id: 'y', name: 'Agent Y', taskCount: 3 },
    ];
    const html = renderToString(React.createElement(AgentPanel, { agents }));
    expect(html).toContain('Agent X');
    expect(html).toContain('Agent Y');
    expect(html).toContain('3 tasks');
  });
});

// ─── UX7 · ToolPanel ──────────────────────────────────────────────────────────

describe('UX7 · ToolPanel', () => {
  it('UX7-01: renders default title and empty-state with no tools', () => {
    const html = renderToString(React.createElement(ToolPanel, {}));
    expect(html).toContain('Tools');
    expect(html).toContain('No tools registered');
  });

  it('UX7-02: renders a single tool name', () => {
    const tools: ToolInfo[] = [{ name: 'search_web', description: 'Searches the web' }];
    const html = renderToString(React.createElement(ToolPanel, { tools }));
    expect(html).toContain('search_web');
  });

  it('UX7-03: renders tool description when provided', () => {
    const tools: ToolInfo[] = [{ name: 'read_file', description: 'Reads a local file' }];
    const html = renderToString(React.createElement(ToolPanel, { tools }));
    expect(html).toContain('Reads a local file');
  });

  it('UX7-04: renders multiple tools with param counts', () => {
    const tools: ToolInfo[] = [
      { name: 'tool_a', paramCount: 2 },
      { name: 'tool_b', paramCount: 0 },
    ];
    const html = renderToString(React.createElement(ToolPanel, { tools }));
    expect(html).toContain('tool_a');
    expect(html).toContain('2 params');
    expect(html).toContain('tool_b');
    expect(html).toContain('0 params');
  });
});

// ─── UX8 · ChatPanel ──────────────────────────────────────────────────────────

describe('UX8 · ChatPanel', () => {
  it('UX8-01: renders default title and empty-state with no messages', () => {
    const html = renderToString(React.createElement(ChatPanel, {}));
    expect(html).toContain('Chat');
    expect(html).toContain('No messages');
  });

  it('UX8-02: renders a user message', () => {
    const messages: ChatMessage[] = [{ id: 'u1', role: 'user', content: 'Hello!' }];
    const html = renderToString(React.createElement(ChatPanel, { messages }));
    expect(html).toContain('Hello!');
    expect(html).toContain('chat-message--user');
  });

  it('UX8-03: renders an assistant message', () => {
    const messages: ChatMessage[] = [{ id: 'a1', role: 'assistant', content: 'Hi there.' }];
    const html = renderToString(React.createElement(ChatPanel, { messages }));
    expect(html).toContain('Hi there.');
    expect(html).toContain('chat-message--assistant');
  });

  it('UX8-04: renders a system message', () => {
    const messages: ChatMessage[] = [{ id: 'sys1', role: 'system', content: 'You are helpful.' }];
    const html = renderToString(React.createElement(ChatPanel, { messages }));
    expect(html).toContain('You are helpful.');
    expect(html).toContain('chat-message--system');
  });

  it('UX8-05: renders multiple messages preserving role classes', () => {
    const messages: ChatMessage[] = [
      { id: 'm1', role: 'user',      content: 'Question' },
      { id: 'm2', role: 'assistant', content: 'Answer'   },
    ];
    const html = renderToString(React.createElement(ChatPanel, { messages }));
    expect(html).toContain('Question');
    expect(html).toContain('Answer');
    expect(html).toContain('chat-message--user');
    expect(html).toContain('chat-message--assistant');
  });
});

// ─── UX9 · Large scenarios ────────────────────────────────────────────────────

describe('UX9 · Large scenarios', () => {
  it('UX9-01: renders 100 providers without error', () => {
    const providers: ProviderInfo[] = Array.from({ length: 100 }, (_, i) => ({
      id: `p${i}`, name: `Provider ${i}`, status: i % 2 === 0 ? 'available' : 'unavailable',
    }));
    const html = renderToString(React.createElement(ProviderPanel, { providers }));
    expect(html).toContain('Provider 0');
    expect(html).toContain('Provider 99');
  });

  it('UX9-02: renders 100 sessions without error', () => {
    const sessions: SessionDisplayInfo[] = Array.from({ length: 100 }, (_, i) => ({
      id: `s${i}`, state: 'IDLE' as const, label: `Session ${i}`,
    }));
    const html = renderToString(React.createElement(SessionPanel, { sessions }));
    expect(html).toContain('Session 0');
    expect(html).toContain('Session 99');
  });

  it('UX9-03: renders 200 chat messages without error', () => {
    const messages: ChatMessage[] = Array.from({ length: 200 }, (_, i) => ({
      id: `msg${i}`,
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `Message ${i}`,
    }));
    const html = renderToString(React.createElement(ChatPanel, { messages }));
    expect(html).toContain('Message 0');
    expect(html).toContain('Message 199');
  });

  it('UX9-04: renders 50 workflows with step counts', () => {
    const workflows: WorkflowInfo[] = Array.from({ length: 50 }, (_, i) => ({
      id: `wf${i}`, name: `Workflow ${i}`, status: 'pending', stepCount: i + 1,
    }));
    const html = renderToString(React.createElement(WorkflowEnginePanel, { workflows }));
    expect(html).toContain('Workflow 0');
    expect(html).toContain('Workflow 49');
    expect(html).toContain('50 steps');
  });

  it('UX9-05: Dashboard renders correctly when all panels are fully populated', () => {
    const html = renderToString(React.createElement(Dashboard, {
      title: 'Full Dashboard',
      providers: [{ id: 'p1', name: 'OpenAI', status: 'available' }],
      sessions:  [{ id: 's1', state: 'RUNNING', label: 'Live' }],
      snapshots: [{ id: 'm1', label: 'Snap', turnCount: 5, totalTokens: 1024 }],
      workflows: [{ id: 'w1', name: 'Pipeline', status: 'running', stepCount: 3 }],
      agents:    [{ id: 'a1', name: 'Planner', description: 'Plans tasks' }],
      tools:     [{ name: 'calc', description: 'Math tool', paramCount: 2 }],
      messages:  [{ id: 'c1', role: 'user', content: 'Start' }],
    }));
    expect(html).toContain('Full Dashboard');
    expect(html).toContain('OpenAI');
    expect(html).toContain('Live');
    expect(html).toContain('1024 tokens');
    expect(html).toContain('Pipeline');
    expect(html).toContain('Planner');
    expect(html).toContain('calc');
    expect(html).toContain('Start');
  });
});

// ─── UX10 · Null props ────────────────────────────────────────────────────────

describe('UX10 · Null props', () => {
  it('UX10-01: ProviderPanel accepts null providers and shows empty-state', () => {
    const html = renderToString(React.createElement(ProviderPanel, { providers: null }));
    expect(html).toContain('No providers registered');
  });

  it('UX10-02: ChatPanel accepts null messages and shows empty-state', () => {
    const html = renderToString(React.createElement(ChatPanel, { messages: null }));
    expect(html).toContain('No messages');
  });

  it('UX10-03: SessionPanel accepts null sessions and shows empty-state', () => {
    const html = renderToString(React.createElement(SessionPanel, { sessions: null }));
    expect(html).toContain('No active sessions');
  });

  it('UX10-04: Dashboard accepts null for all list props', () => {
    const html = renderToString(React.createElement(Dashboard, {
      title: null,
      providers: null,
      sessions:  null,
      snapshots: null,
      workflows: null,
      agents:    null,
      tools:     null,
      messages:  null,
    }));
    expect(html).toContain('AI Dashboard');
    expect(html).toContain('No providers registered');
    expect(html).toContain('No active sessions');
  });
});

// ─── UX11 · SSR renderToString ────────────────────────────────────────────────

describe('UX11 · SSR renderToString', () => {
  it('UX11-01: Dashboard produces a non-empty HTML string', () => {
    const html = renderToString(React.createElement(Dashboard, { title: 'SSR Test' }));
    expect(typeof html).toBe('string');
    expect(html.length).toBeGreaterThan(0);
    expect(html).toContain('SSR Test');
  });

  it('UX11-02: ProviderPanel output contains no script tags', () => {
    const providers: ProviderInfo[] = [{ id: 'x', name: 'Safe Provider', status: 'available' }];
    const html = renderToString(React.createElement(ProviderPanel, { providers }));
    expect(html).not.toContain('<script');
  });

  it('UX11-03: ChatPanel escapes HTML special characters in message content', () => {
    const messages: ChatMessage[] = [{ id: 'x', role: 'user', content: '<b>bold</b> & "quoted"' }];
    const html = renderToString(React.createElement(ChatPanel, { messages }));
    expect(html).not.toContain('<b>');
    expect(html).toContain('&lt;b&gt;');
  });

  it('UX11-04: all panels render to non-empty strings independently', () => {
    const panels = [
      React.createElement(ProviderPanel, {}),
      React.createElement(SessionPanel,  {}),
      React.createElement(MemoryPanel,   {}),
      React.createElement(WorkflowEnginePanel, {}),
      React.createElement(AgentPanel,    {}),
      React.createElement(ToolPanel,     {}),
      React.createElement(ChatPanel,     {}),
    ];
    for (const panel of panels) {
      const html = renderToString(panel);
      expect(typeof html).toBe('string');
      expect(html.length).toBeGreaterThan(0);
    }
  });

  it('UX11-05: renderToString output is deterministic for the same props', () => {
    const props = { providers: [{ id: 'p1', name: 'OpenAI', status: 'available' }] };
    const html1 = renderToString(React.createElement(ProviderPanel, props));
    const html2 = renderToString(React.createElement(ProviderPanel, props));
    expect(html1).toBe(html2);
  });
});

// ─── UX12 · Never-throw ───────────────────────────────────────────────────────

describe('UX12 · Never-throw', () => {
  it('UX12-01: ProviderPanel never throws with malformed array items', () => {
    const badProviders = [null, undefined, 42, '', {}, { id: null, name: null }] as unknown as ProviderInfo[];
    expect(() =>
      renderToString(React.createElement(ProviderPanel, { providers: badProviders }))
    ).not.toThrow();
  });

  it('UX12-02: ChatPanel never throws with malformed message items', () => {
    const badMessages = [null, undefined, 0, false, { role: null, content: null }] as unknown as import('../components/ChatPanel').ChatMessage[];
    expect(() =>
      renderToString(React.createElement(ChatPanel, { messages: badMessages }))
    ).not.toThrow();
  });

  it('UX12-03: Dashboard never throws when all props are null', () => {
    expect(() =>
      renderToString(React.createElement(Dashboard, {
        title: null, providers: null, sessions: null,
        snapshots: null, workflows: null, agents: null,
        tools: null, messages: null,
      }))
    ).not.toThrow();
  });

  it('UX12-04: all panels never throw when array contains null items', () => {
    const nullItem = [null] as unknown[];
    expect(() => renderToString(React.createElement(ProviderPanel, { providers: nullItem as ProviderInfo[] }))).not.toThrow();
    expect(() => renderToString(React.createElement(SessionPanel,  { sessions:  nullItem as SessionDisplayInfo[] }))).not.toThrow();
    expect(() => renderToString(React.createElement(MemoryPanel,   { snapshots: nullItem as MemorySnapshotInfo[] }))).not.toThrow();
    expect(() => renderToString(React.createElement(WorkflowEnginePanel, { workflows: nullItem as WorkflowInfo[] }))).not.toThrow();
    expect(() => renderToString(React.createElement(AgentPanel,    { agents:    nullItem as AgentInfo[] }))).not.toThrow();
    expect(() => renderToString(React.createElement(ToolPanel,     { tools:     nullItem as ToolInfo[] }))).not.toThrow();
    expect(() => renderToString(React.createElement(ChatPanel,     { messages:  nullItem as ChatMessage[] }))).not.toThrow();
  });
});
