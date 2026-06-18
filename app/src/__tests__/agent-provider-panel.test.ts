/**
 * P7-01: AgentProviderPanel + createAgentSystem — 56 tests
 *
 * Groups:
 *   AP-01  (4)  never-throw — undefined / null / empty inputs
 *   AP-02  (4)  loading state
 *   AP-03  (5)  empty state (no agents)
 *   AP-04  (4)  ready state — agent count
 *   AP-05  (5)  ready state — agent names
 *   AP-06  (5)  ready state — capability counts
 *   AP-07  (5)  data attributes
 *   AP-08  (4)  title prop
 *   AP-09  (5)  createAgentSystem — bundle shape
 *   AP-10  (6)  createAgentSystem — agent IDs
 *   AP-11  (5)  createAgentSystem — agent names
 *   AP-12  (4)  createAgentSystem — capabilities
 */

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';

import AgentProviderPanel, {
  createAgentSystem,
} from '../components/AgentProviderPanel';
import type { AgentStatusInfo } from '../components/AgentProviderPanel';
import { AgentRegistry } from '../agents';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const makeAgent = (
  id: string,
  name: string,
  capabilities: string[] = ['cap-a'],
): AgentStatusInfo => ({ id: id as AgentStatusInfo['id'], name, capabilities });

const ONE   = [makeAgent('planner', 'Planner Agent')];
const THREE = [
  makeAgent('planner',       'Planner Agent',         ['a', 'b']),
  makeAgent('specification', 'Specification Agent',   ['c']),
  makeAgent('risk',          'Risk Agent',            ['d', 'e', 'f']),
];

function render(props: React.ComponentProps<typeof AgentProviderPanel>): string {
  return renderToString(React.createElement(AgentProviderPanel, props));
}

// ─── AP-01 · never-throw ──────────────────────────────────────────────────────

describe('AP-01 · never-throw — undefined/null/empty inputs', () => {
  it('AP-01-01: renders without throwing when called with no props', () => {
    expect(() => renderToString(React.createElement(AgentProviderPanel, {}))).not.toThrow();
  });

  it('AP-01-02: renders without throwing when agents=null', () => {
    expect(() => render({ agents: null })).not.toThrow();
  });

  it('AP-01-03: renders without throwing when agents=[]', () => {
    expect(() => render({ agents: [] })).not.toThrow();
  });

  it('AP-01-04: renders without throwing when an agent has empty capabilities', () => {
    const agents = [makeAgent('chat', 'Chat Agent', [])];
    expect(() => render({ agents })).not.toThrow();
  });
});

// ─── AP-02 · loading state ────────────────────────────────────────────────────

describe('AP-02 · loading state', () => {
  it('AP-02-01: loading=true → data-state="loading"', () => {
    expect(render({ loading: true })).toContain('data-state="loading"');
  });

  it('AP-02-02: loading=true → Vietnamese loading message', () => {
    expect(render({ loading: true })).toContain('Đang khởi động agent');
  });

  it('AP-02-03: loading=true with agents provided → still shows loading state', () => {
    expect(render({ loading: true, agents: ONE })).toContain('data-state="loading"');
  });

  it('AP-02-04: loading=false → does not show loading state', () => {
    expect(render({ loading: false, agents: ONE })).not.toContain('data-state="loading"');
  });
});

// ─── AP-03 · empty state ─────────────────────────────────────────────────────

describe('AP-03 · empty state (no agents)', () => {
  it('AP-03-01: no agents prop → data-state="empty"', () => {
    expect(renderToString(React.createElement(AgentProviderPanel, {}))).toContain('data-state="empty"');
  });

  it('AP-03-02: agents=null → data-state="empty"', () => {
    expect(render({ agents: null })).toContain('data-state="empty"');
  });

  it('AP-03-03: agents=[] → data-state="empty"', () => {
    expect(render({ agents: [] })).toContain('data-state="empty"');
  });

  it('AP-03-04: empty state contains Vietnamese empty message', () => {
    expect(render({ agents: [] })).toContain('Chưa có agent nào');
  });

  it('AP-03-05: empty state does not contain data-state="ready"', () => {
    expect(render({ agents: [] })).not.toContain('data-state="ready"');
  });
});

// ─── AP-04 · ready state — agent count ───────────────────────────────────────

describe('AP-04 · ready state — agent count', () => {
  it('AP-04-01: 1 agent → data-state="ready"', () => {
    expect(render({ agents: ONE })).toContain('data-state="ready"');
  });

  it('AP-04-02: 3 agents → renders three <li> elements', () => {
    const html = render({ agents: THREE });
    const count = (html.match(/<li /g) ?? []).length;
    expect(count).toBe(3);
  });

  it('AP-04-03: 6 agents → renders six <li> elements', () => {
    const { agents } = createAgentSystem();
    const html = render({ agents });
    const count = (html.match(/<li /g) ?? []).length;
    expect(count).toBe(6);
  });

  it('AP-04-04: ready state has data-field="agent-list"', () => {
    expect(render({ agents: ONE })).toContain('data-field="agent-list"');
  });
});

// ─── AP-05 · ready state — agent names ───────────────────────────────────────

describe('AP-05 · ready state — agent names', () => {
  it('AP-05-01: single agent name appears in rendered HTML', () => {
    const agents = [makeAgent('planner', 'Procurement Planner Agent')];
    expect(render({ agents })).toContain('Procurement Planner Agent');
  });

  it('AP-05-02: all three names appear in 3-agent render', () => {
    const html = render({ agents: THREE });
    expect(html).toContain('Planner Agent');
    expect(html).toContain('Specification Agent');
    expect(html).toContain('Risk Agent');
  });

  it('AP-05-03: name is inside a span with data-field="name"', () => {
    const html = render({ agents: ONE });
    expect(html).toContain('data-field="name"');
    expect(html).toContain('Planner Agent');
  });

  it('AP-05-04: Vietnamese name renders without corruption', () => {
    const agents = [makeAgent('chat', 'Tư vấn Mua sắm')];
    expect(render({ agents })).toContain('Tư vấn Mua sắm');
  });

  it('AP-05-05: each li contains data-agent-id matching the agent id', () => {
    const html = render({ agents: THREE });
    expect(html).toContain('data-agent-id="planner"');
    expect(html).toContain('data-agent-id="specification"');
    expect(html).toContain('data-agent-id="risk"');
  });
});

// ─── AP-06 · ready state — capability counts ─────────────────────────────────

describe('AP-06 · ready state — capability counts', () => {
  it('AP-06-01: agent with 3 capabilities → "3" in capability-count span', () => {
    const agents = [makeAgent('risk', 'Risk Agent', ['a', 'b', 'c'])];
    expect(render({ agents })).toContain('>3<');
  });

  it('AP-06-02: agent with 0 capabilities → "0" in capability-count span', () => {
    const agents = [makeAgent('chat', 'Chat Agent', [])];
    expect(render({ agents })).toContain('>0<');
  });

  it('AP-06-03: capability-count span has data-field="capability-count"', () => {
    expect(render({ agents: ONE })).toContain('data-field="capability-count"');
  });

  it('AP-06-04: two agents with different counts both render their values', () => {
    const agents = [
      makeAgent('planner', 'Planner', ['a', 'b']),
      makeAgent('chat',    'Chat',    ['x', 'y', 'z']),
    ];
    const html = render({ agents });
    expect(html).toContain('>2<');
    expect(html).toContain('>3<');
  });

  it('AP-06-05: capability count equals capabilities.length', () => {
    const caps = ['p', 'q', 'r', 's', 't'];
    const agents = [makeAgent('legal-reviewer', 'Legal', caps)];
    const html = render({ agents });
    expect(html).toContain(`>${caps.length}<`);
  });
});

// ─── AP-07 · data attributes ─────────────────────────────────────────────────

describe('AP-07 · data attributes', () => {
  it('AP-07-01: always has data-panel="agent-provider" (empty state)', () => {
    expect(render({ agents: [] })).toContain('data-panel="agent-provider"');
  });

  it('AP-07-02: always has data-panel="agent-provider" (ready state)', () => {
    expect(render({ agents: ONE })).toContain('data-panel="agent-provider"');
  });

  it('AP-07-03: always has data-panel="agent-provider" (loading state)', () => {
    expect(render({ loading: true })).toContain('data-panel="agent-provider"');
  });

  it('AP-07-04: title element has data-field="title"', () => {
    expect(render({ agents: ONE })).toContain('data-field="title"');
  });

  it('AP-07-05: ul has data-field="agent-list"', () => {
    expect(render({ agents: THREE })).toContain('data-field="agent-list"');
  });
});

// ─── AP-08 · title prop ───────────────────────────────────────────────────────

describe('AP-08 · title prop', () => {
  it('AP-08-01: no title prop → default "Hệ thống Agent"', () => {
    expect(render({ agents: ONE })).toContain('Hệ thống Agent');
  });

  it('AP-08-02: custom title renders in output', () => {
    expect(render({ agents: ONE, title: 'Danh sách Agent AI' })).toContain('Danh sách Agent AI');
  });

  it('AP-08-03: title=null → falls back to default', () => {
    expect(render({ agents: ONE, title: null })).toContain('Hệ thống Agent');
  });

  it('AP-08-04: title appears inside an h2 element', () => {
    const html = render({ agents: ONE, title: 'My Title' });
    expect(html).toMatch(/<h2[^>]*>My Title<\/h2>/);
  });
});

// ─── AP-09 · createAgentSystem — bundle shape ────────────────────────────────

describe('AP-09 · createAgentSystem — bundle shape', () => {
  const bundle = createAgentSystem();

  it('AP-09-01: returns object with "registry" key', () => {
    expect(bundle).toHaveProperty('registry');
  });

  it('AP-09-02: returns object with "agents" key', () => {
    expect(bundle).toHaveProperty('agents');
  });

  it('AP-09-03: registry is an AgentRegistry instance', () => {
    expect(bundle.registry).toBeInstanceOf(AgentRegistry);
  });

  it('AP-09-04: agents is an array', () => {
    expect(Array.isArray(bundle.agents)).toBe(true);
  });

  it('AP-09-05: agents has exactly 6 items', () => {
    expect(bundle.agents).toHaveLength(6);
  });
});

// ─── AP-10 · createAgentSystem — agent IDs ───────────────────────────────────

describe('AP-10 · createAgentSystem — agent IDs', () => {
  const { agents } = createAgentSystem();
  const ids = agents.map(a => a.id);

  it('AP-10-01: "planner" id is present', () => {
    expect(ids).toContain('planner');
  });

  it('AP-10-02: "specification" id is present', () => {
    expect(ids).toContain('specification');
  });

  it('AP-10-03: "legal-reviewer" id is present', () => {
    expect(ids).toContain('legal-reviewer');
  });

  it('AP-10-04: "risk" id is present', () => {
    expect(ids).toContain('risk');
  });

  it('AP-10-05: "chat" id is present', () => {
    expect(ids).toContain('chat');
  });

  it('AP-10-06: "autonomous" id is present', () => {
    expect(ids).toContain('autonomous');
  });
});

// ─── AP-11 · createAgentSystem — agent names ─────────────────────────────────

describe('AP-11 · createAgentSystem — agent names', () => {
  const { agents } = createAgentSystem();
  const byId = Object.fromEntries(agents.map(a => [a.id, a]));

  it('AP-11-01: planner name is "Procurement Planner Agent"', () => {
    expect(byId['planner'].name).toBe('Procurement Planner Agent');
  });

  it('AP-11-02: specification name is "Specification Agent"', () => {
    expect(byId['specification'].name).toBe('Specification Agent');
  });

  it('AP-11-03: legal-reviewer name is "Legal Reviewer Agent"', () => {
    expect(byId['legal-reviewer'].name).toBe('Legal Reviewer Agent');
  });

  it('AP-11-04: risk name is "Risk Agent"', () => {
    expect(byId['risk'].name).toBe('Risk Agent');
  });

  it('AP-11-05: autonomous name is "Autonomous Procurement Agent"', () => {
    expect(byId['autonomous'].name).toBe('Autonomous Procurement Agent');
  });
});

// ─── AP-12 · createAgentSystem — capabilities ────────────────────────────────

describe('AP-12 · createAgentSystem — capabilities', () => {
  const { agents } = createAgentSystem();
  const byId = Object.fromEntries(agents.map(a => [a.id, a]));

  it('AP-12-01: every agent has at least 1 capability', () => {
    for (const agent of agents) {
      expect(agent.capabilities.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('AP-12-02: planner has exactly 4 capabilities', () => {
    expect(byId['planner'].capabilities).toHaveLength(4);
  });

  it('AP-12-03: autonomous has exactly 7 capabilities', () => {
    expect(byId['autonomous'].capabilities).toHaveLength(7);
  });

  it('AP-12-04: two consecutive createAgentSystem() calls return the same agent ids', () => {
    const ids1 = createAgentSystem().agents.map(a => a.id).sort();
    const ids2 = createAgentSystem().agents.map(a => a.id).sort();
    expect(ids1).toEqual(ids2);
  });
});
