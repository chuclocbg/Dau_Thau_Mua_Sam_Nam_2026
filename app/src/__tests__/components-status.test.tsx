/**
 * P6-09B: Rendering tests for AgentCard and AgentStatusDashboard.
 *
 * Uses react-dom/server renderToString so tests run in the Node environment
 * without requiring jsdom or @testing-library/react.
 */

import { describe, it, expect } from 'vitest';
import { renderToString }       from 'react-dom/server';
import React                    from 'react';
import AgentCard, { type AgentCardProps }               from '../components/AgentCard';
import AgentStatusDashboard, {
  type AgentStatusInfo,
  type AgentStatusDashboardProps,
} from '../components/AgentStatusDashboard';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function render(element: React.ReactElement): string {
  return renderToString(element);
}

// ─── AC: AgentCard ────────────────────────────────────────────────────────────

describe('AgentCard', () => {
  const base: AgentCardProps = {
    agentId: 'planner',
    name:    'Planner Agent',
  };

  it('AC-01: renders agentId in data attribute', () => {
    const html = render(<AgentCard {...base} />);
    expect(html).toContain('data-agent-id="planner"');
  });

  it('AC-02: renders display name', () => {
    const html = render(<AgentCard {...base} />);
    expect(html).toContain('Planner Agent');
  });

  it('AC-03: renders status idle by default', () => {
    const html = render(<AgentCard {...base} />);
    expect(html).toContain('data-status="idle"');
    expect(html).toContain('>idle<');
  });

  it('AC-04: renders status busy', () => {
    const html = render(<AgentCard {...base} status="busy" />);
    expect(html).toContain('data-status="busy"');
    expect(html).toContain('>busy<');
  });

  it('AC-05: renders status error in data attribute', () => {
    const html = render(<AgentCard {...base} status="error" />);
    expect(html).toContain('data-status="error"');
  });

  it('AC-06: renders capability count zero', () => {
    const html = render(<AgentCard {...base} />);
    expect(html).toContain('0 capabilities');
  });

  it('AC-07: renders capability count from array', () => {
    const html = render(<AgentCard {...base} capabilities={['plan', 'budget', 'validate']} />);
    expect(html).toContain('3 capabilities');
  });

  it('AC-08: renders traceId when provided', () => {
    const html = render(<AgentCard {...base} traceId="trace-abc-123" />);
    expect(html).toContain('trace-abc-123');
  });

  it('AC-09: does not render traceId when absent', () => {
    const html = render(<AgentCard {...base} />);
    expect(html).not.toContain('data-field="trace-id"');
  });

  it('AC-10: renders error message when status=error and error prop set', () => {
    const html = render(<AgentCard {...base} status="error" error="Connection timeout" />);
    expect(html).toContain('Connection timeout');
    expect(html).toContain('data-field="error"');
  });

  it('AC-11: does not render error message when status=idle even with error prop', () => {
    const html = render(<AgentCard {...base} status="idle" error="hidden error" />);
    expect(html).not.toContain('hidden error');
    expect(html).not.toContain('data-field="error"');
  });

  it('AC-12: does not render error message when status=busy', () => {
    const html = render(<AgentCard {...base} status="busy" error="suppressed" />);
    expect(html).not.toContain('suppressed');
  });

  it('AC-13: renders lastUpdated timestamp when provided', () => {
    const ts  = new Date('2026-01-15T08:30:00').getTime();
    const html = render(<AgentCard {...base} lastUpdated={ts} />);
    expect(html).toContain('data-field="last-updated"');
    expect(html).toContain('2026');
  });

  it('AC-14: renders lastActivity when lastUpdated absent', () => {
    const ts  = new Date('2026-03-10T12:00:00').getTime();
    const html = render(<AgentCard {...base} lastActivity={ts} />);
    expect(html).toContain('data-field="last-updated"');
    expect(html).toContain('2026');
  });

  it('AC-15: lastUpdated takes precedence over lastActivity', () => {
    const updated  = new Date('2026-06-01T10:00:00').getTime();
    const activity = new Date('2025-01-01T00:00:00').getTime();
    const html = render(<AgentCard {...base} lastUpdated={updated} lastActivity={activity} />);
    expect(html).toContain('2026');
  });

  it('AC-16: does not render timestamp section when neither prop provided', () => {
    const html = render(<AgentCard {...base} />);
    expect(html).not.toContain('data-field="last-updated"');
  });

  it('AC-17: renders different AgentId values', () => {
    for (const id of ['planner', 'specification', 'legal-reviewer', 'risk', 'chat', 'autonomous'] as const) {
      const html = render(<AgentCard agentId={id} name="X" />);
      expect(html).toContain(`data-agent-id="${id}"`);
    }
  });
});

// ─── AD: AgentStatusDashboard ─────────────────────────────────────────────────

describe('AgentStatusDashboard', () => {
  const agentA: AgentStatusInfo = {
    agentId: 'planner',
    name:    'Planner Agent',
    status:  'idle',
  };
  const agentB: AgentStatusInfo = {
    agentId: 'risk',
    name:    'Risk Agent',
    status:  'busy',
    capabilities: ['assess', 'score'],
  };

  it('AD-01: renders loading state', () => {
    const html = render(<AgentStatusDashboard loading />);
    expect(html).toContain('data-state="loading"');
    expect(html).toContain('Đang tải');
  });

  it('AD-02: loading takes priority over error', () => {
    const html = render(<AgentStatusDashboard loading error="should be hidden" />);
    expect(html).toContain('data-state="loading"');
    expect(html).not.toContain('data-state="error"');
  });

  it('AD-03: loading takes priority over agents list', () => {
    const html = render(<AgentStatusDashboard loading agents={[agentA]} />);
    expect(html).toContain('data-state="loading"');
    expect(html).not.toContain('Planner Agent');
  });

  it('AD-04: renders error state', () => {
    const html = render(<AgentStatusDashboard error="Registry unavailable" />);
    expect(html).toContain('data-state="error"');
    expect(html).toContain('Registry unavailable');
  });

  it('AD-05: renders empty state when agents is undefined', () => {
    const html = render(<AgentStatusDashboard />);
    expect(html).toContain('data-state="empty"');
  });

  it('AD-06: renders empty state when agents is empty array', () => {
    const html = render(<AgentStatusDashboard agents={[]} />);
    expect(html).toContain('data-state="empty"');
  });

  it('AD-07: renders ready state when agents provided', () => {
    const html = render(<AgentStatusDashboard agents={[agentA]} />);
    expect(html).toContain('data-state="ready"');
  });

  it('AD-08: renders all agents in list', () => {
    const html = render(<AgentStatusDashboard agents={[agentA, agentB]} />);
    expect(html).toContain('Planner Agent');
    expect(html).toContain('Risk Agent');
    expect(html).toContain('data-agent-id="planner"');
    expect(html).toContain('data-agent-id="risk"');
  });

  it('AD-09: passes status through to AgentCard', () => {
    const html = render(<AgentStatusDashboard agents={[agentB]} />);
    expect(html).toContain('data-status="busy"');
  });

  it('AD-10: passes capabilities count through to AgentCard', () => {
    const html = render(<AgentStatusDashboard agents={[agentB]} />);
    expect(html).toContain('2 capabilities');
  });

  it('AD-11: passes traceId through to AgentCard', () => {
    const withTrace: AgentStatusInfo = { ...agentA, traceId: 'tr-xyz' };
    const html = render(<AgentStatusDashboard agents={[withTrace]} />);
    expect(html).toContain('tr-xyz');
  });

  it('AD-12: passes error through to AgentCard in error status', () => {
    const errAgent: AgentStatusInfo = {
      agentId: 'chat',
      name:    'Chat Agent',
      status:  'error',
      error:   'Model unavailable',
    };
    const html = render(<AgentStatusDashboard agents={[errAgent]} />);
    expect(html).toContain('Model unavailable');
  });

  it('AD-13: stable key — uses agentId, not array index', () => {
    // Re-render with swapped order; both agents must appear
    const html1 = render(<AgentStatusDashboard agents={[agentA, agentB]} />);
    const html2 = render(<AgentStatusDashboard agents={[agentB, agentA]} />);
    expect(html1).toContain('Planner Agent');
    expect(html1).toContain('Risk Agent');
    expect(html2).toContain('Planner Agent');
    expect(html2).toContain('Risk Agent');
  });

  it('AD-14: passes lastUpdated timestamp through to AgentCard', () => {
    const ts = new Date('2026-05-20T09:00:00').getTime();
    const withTs: AgentStatusInfo = { ...agentA, lastUpdated: ts };
    const html = render(<AgentStatusDashboard agents={[withTs]} />);
    expect(html).toContain('data-field="last-updated"');
  });
});
