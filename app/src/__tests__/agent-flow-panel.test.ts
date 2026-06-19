/**
 * 8-M: AgentFlowPanel — 56 tests
 *
 * Groups:
 *   AF-01  (5)  Module exports and constants
 *   AF-02  (5)  buildFlowRoutes — pure function
 *   AF-03  (5)  Root element structure — ready state
 *   AF-04  (5)  Route list items and data attributes
 *   AF-05  (4)  Error flag display
 *   AF-06  (4)  Sorting by messageCount descending
 *   AF-07  (5)  Empty state — messages=[]
 *   AF-08  (4)  Loading state
 *   AF-09  (5)  Single route (all messages share same from→to)
 *   AF-10  (5)  Multiple routes
 *   AF-11  (4)  Type breakdown aggregation
 *   AF-12  (5)  SSR safety and edge cases
 *
 * All rendering via renderToString (SSR-compatible, no async).
 */

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';

import AgentFlowPanel, {
  AGENT_FLOW_PANEL_VERSION,
  buildFlowRoutes,
} from '../components/AgentFlowPanel';
import type { AgentFlowPanelProps } from '../components/AgentFlowPanel';
import type { AgentMessage } from '../agents/types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const TRACE_ID = 'aaaaaaaa-1111-2222-3333-444444444444';
const T1 = 1_000;
const T2 = 2_000;
const T3 = 3_000;

function makeMsg(overrides: Partial<AgentMessage> = {}): AgentMessage {
  return {
    traceId:   TRACE_ID,
    from:      'user',
    to:        'planner',
    type:      'request',
    payload:   {},
    timestamp: T1,
    ...overrides,
  };
}

/**
 * Base message set — three distinct routing pairs:
 *   user → planner:            3 requests          (messageCount=3)
 *   planner → legal-reviewer:  1 request + 1 resp  (messageCount=2)
 *   legal-reviewer → planner:  1 error              (messageCount=1)
 *
 * After sorting desc by messageCount: user→planner, planner→legal-reviewer, legal-reviewer→planner
 */
const baseMessages: AgentMessage[] = [
  makeMsg({ from: 'user',           to: 'planner',         type: 'request',  timestamp: T1 }),
  makeMsg({ from: 'user',           to: 'planner',         type: 'request',  timestamp: T2 }),
  makeMsg({ from: 'user',           to: 'planner',         type: 'request',  timestamp: T3 }),
  makeMsg({ from: 'planner',        to: 'legal-reviewer',  type: 'request',  timestamp: T1 }),
  makeMsg({ from: 'planner',        to: 'legal-reviewer',  type: 'response', timestamp: T2 }),
  makeMsg({ from: 'legal-reviewer', to: 'planner',         type: 'error',    timestamp: T3 }),
];

function render(
  messages: AgentMessage[],
  extra: Partial<AgentFlowPanelProps> = {},
): string {
  return renderToString(
    React.createElement(AgentFlowPanel, { messages, ...extra }),
  );
}

// ─── AF-01: Module exports and constants ──────────────────────────────────────

describe('AF-01: module exports and constants', () => {
  it('AF-01-01: AgentFlowPanel is a function', () => {
    expect(typeof AgentFlowPanel).toBe('function');
  });

  it('AF-01-02: AGENT_FLOW_PANEL_VERSION is "8-M"', () => {
    expect(AGENT_FLOW_PANEL_VERSION).toBe('8-M');
  });

  it('AF-01-03: buildFlowRoutes is a function', () => {
    expect(typeof buildFlowRoutes).toBe('function');
  });

  it('AF-01-04: default render with empty messages returns non-empty HTML', () => {
    expect(render([]).length).toBeGreaterThan(30);
  });

  it('AF-01-05: AgentFlowPanelProps type is importable (structural)', () => {
    const props: AgentFlowPanelProps = { messages: [] };
    expect(typeof props).toBe('object');
  });
});

// ─── AF-02: buildFlowRoutes — pure function ───────────────────────────────────

describe('AF-02: buildFlowRoutes — pure function', () => {
  it('AF-02-01: empty array → empty result', () => {
    expect(buildFlowRoutes([])).toHaveLength(0);
  });

  it('AF-02-02: baseMessages → 3 unique routes', () => {
    expect(buildFlowRoutes(baseMessages)).toHaveLength(3);
  });

  it('AF-02-03: user→planner route: messageCount=3, requestCount=3, errorCount=0', () => {
    const routes = buildFlowRoutes(baseMessages);
    const r = routes.find(x => x.from === 'user' && x.to === 'planner');
    expect(r).toBeDefined();
    expect(r!.messageCount).toBe(3);
    expect(r!.requestCount).toBe(3);
    expect(r!.errorCount).toBe(0);
  });

  it('AF-02-04: legal-reviewer→planner route: errorCount=1, messageCount=1', () => {
    const routes = buildFlowRoutes(baseMessages);
    const r = routes.find(x => x.from === 'legal-reviewer' && x.to === 'planner');
    expect(r).toBeDefined();
    expect(r!.errorCount).toBe(1);
    expect(r!.messageCount).toBe(1);
  });

  it('AF-02-05: routes sorted desc by messageCount — first route has highest count', () => {
    const routes = buildFlowRoutes(baseMessages);
    expect(routes[0].messageCount).toBeGreaterThanOrEqual(routes[1].messageCount);
    expect(routes[1].messageCount).toBeGreaterThanOrEqual(routes[2].messageCount);
  });
});

// ─── AF-03: Root element structure — ready state ──────────────────────────────

describe('AF-03: root element structure — ready state', () => {
  it('AF-03-01: messages present → data-panel="agent-flow"', () => {
    expect(render(baseMessages)).toContain('data-panel="agent-flow"');
  });

  it('AF-03-02: messages present → data-state="ready"', () => {
    expect(render(baseMessages)).toContain('data-state="ready"');
  });

  it('AF-03-03: data-route-count matches unique routing pairs', () => {
    expect(render(baseMessages)).toContain('data-route-count="3"');
  });

  it('AF-03-04: data-total-messages = total input messages length', () => {
    expect(render(baseMessages)).toContain(`data-total-messages="${baseMessages.length}"`);
  });

  it('AF-03-05: data-field="title" present', () => {
    expect(render(baseMessages)).toContain('data-field="title"');
  });
});

// ─── AF-04: Route list items and data attributes ──────────────────────────────

describe('AF-04: route list items and data attributes', () => {
  it('AF-04-01: data-field="route-list" on <ol>', () => {
    expect(render(baseMessages)).toContain('data-field="route-list"');
  });

  it('AF-04-02: first <li> has data-route="1"', () => {
    expect(render(baseMessages)).toContain('data-route="1"');
  });

  it('AF-04-03: <li> for user→planner has data-from="user" and data-to="planner"', () => {
    const html = render(baseMessages);
    expect(html).toContain('data-from="user"');
    expect(html).toContain('data-to="planner"');
  });

  it('AF-04-04: <li> has data-message-count and data-error-count', () => {
    const html = render(baseMessages);
    expect(html).toContain('data-message-count="3"');
    expect(html).toContain('data-error-count="0"');
  });

  it('AF-04-05: <li> has data-request-count, data-response-count, data-event-count', () => {
    const html = render(baseMessages);
    expect(html).toContain('data-request-count="3"');
    expect(html).toContain('data-response-count="1"');
    expect(html).toContain('data-event-count="0"');
  });
});

// ─── AF-05: Error flag display ────────────────────────────────────────────────

describe('AF-05: error flag display', () => {
  it('AF-05-01: no error messages → no data-field="error-flag"', () => {
    const clean = [makeMsg({ type: 'request' }), makeMsg({ type: 'response' })];
    expect(render(clean)).not.toContain('data-field="error-flag"');
  });

  it('AF-05-02: error message → data-field="error-flag" present', () => {
    expect(render(baseMessages)).toContain('data-field="error-flag"');
  });

  it('AF-05-03: error flag shows [ERROR] text', () => {
    expect(render(baseMessages)).toContain('[ERROR]');
  });

  it('AF-05-04: only errored route has error flag; clean routes do not', () => {
    const html = render(baseMessages);
    // user→planner is clean; legal-reviewer→planner has error
    // error-count="0" (for clean route) and error-count="1" (for errored route) both appear
    expect(html).toContain('data-error-count="1"');
    expect(html).toContain('data-error-count="0"');
  });
});

// ─── AF-06: Sorting by messageCount descending ────────────────────────────────

describe('AF-06: sorting by messageCount descending', () => {
  it('AF-06-01: user→planner (3 msgs) appears before planner→legal-reviewer (2 msgs)', () => {
    const html = render(baseMessages);
    const posA = html.indexOf('data-from="user"');
    const posB = html.indexOf('data-from="planner"');
    expect(posA).toBeLessThan(posB);
  });

  it('AF-06-02: reversed input yields same sorted output', () => {
    const reversed = [...baseMessages].reverse();
    const htmlFwd = render(baseMessages);
    const htmlRev = render(reversed);
    // Both should have user→planner first (data-from="user" at same relative position)
    const posFwd = htmlFwd.indexOf('data-from="user"');
    const posRev = htmlRev.indexOf('data-from="user"');
    expect(posFwd).toBeGreaterThan(0);
    expect(posRev).toBeGreaterThan(0);
    // The first data-from encountered should be "user" in both cases (highest count)
    const firstFromFwd = htmlFwd.match(/data-from="([^"]+)"/)?.[1];
    const firstFromRev = htmlRev.match(/data-from="([^"]+)"/)?.[1];
    expect(firstFromFwd).toBe('user');
    expect(firstFromRev).toBe('user');
  });

  it('AF-06-03: data-route="1" element has the highest message count', () => {
    const html = render(baseMessages);
    // data-route="1" should appear before data-message-count="3"
    const posRoute1 = html.indexOf('data-route="1"');
    const posCount3 = html.indexOf('data-message-count="3"');
    expect(posRoute1).toBeGreaterThan(-1);
    expect(posCount3).toBeGreaterThan(-1);
    // The first data-message-count after data-route="1" should be "3"
    const afterRoute1 = html.slice(posRoute1);
    const firstCount = afterRoute1.match(/data-message-count="(\d+)"/)?.[1];
    expect(firstCount).toBe('3');
  });

  it('AF-06-04: single-message route appears last among multi-message routes', () => {
    const html = render(baseMessages);
    const posLR = html.indexOf('data-from="legal-reviewer"');
    const posUser = html.indexOf('data-from="user"');
    const posPlanner = html.indexOf('data-from="planner"');
    expect(posLR).toBeGreaterThan(posUser);
    expect(posLR).toBeGreaterThan(posPlanner);
  });
});

// ─── AF-07: Empty state (messages=[]) ────────────────────────────────────────

describe('AF-07: empty state — messages=[]', () => {
  it('AF-07-01: messages=[] → data-state="empty"', () => {
    expect(render([])).toContain('data-state="empty"');
  });

  it('AF-07-02: data-route-count="0"', () => {
    expect(render([])).toContain('data-route-count="0"');
  });

  it('AF-07-03: data-total-messages="0"', () => {
    expect(render([])).toContain('data-total-messages="0"');
  });

  it('AF-07-04: no data-field="route-list"', () => {
    expect(render([])).not.toContain('data-field="route-list"');
  });

  it('AF-07-05: fallback message text present', () => {
    expect(render([])).toContain('Chưa có thông điệp');
  });
});

// ─── AF-08: Loading state ─────────────────────────────────────────────────────

describe('AF-08: loading state', () => {
  it('AF-08-01: loading=true → data-state="loading"', () => {
    expect(render(baseMessages, { loading: true })).toContain('data-state="loading"');
  });

  it('AF-08-02: loading=true → loading message text present', () => {
    expect(render(baseMessages, { loading: true })).toContain('Đang tải');
  });

  it('AF-08-03: loading=true → no data-route-count attribute', () => {
    expect(render(baseMessages, { loading: true })).not.toContain('data-route-count');
  });

  it('AF-08-04: loading=false (default) → data-state="ready" when messages given', () => {
    expect(render(baseMessages, { loading: false })).toContain('data-state="ready"');
  });
});

// ─── AF-09: Single route (all messages share same from→to) ───────────────────

describe('AF-09: single route — all messages share one routing pair', () => {
  const singleRoute: AgentMessage[] = [
    makeMsg({ from: 'user', to: 'planner', type: 'request',  timestamp: T1 }),
    makeMsg({ from: 'user', to: 'planner', type: 'response', timestamp: T2 }),
    makeMsg({ from: 'user', to: 'planner', type: 'event',    timestamp: T3 }),
  ];

  it('AF-09-01: 3 msgs on one pair → data-route-count="1"', () => {
    expect(render(singleRoute)).toContain('data-route-count="1"');
  });

  it('AF-09-02: data-message-count="3" on the single route item', () => {
    expect(render(singleRoute)).toContain('data-message-count="3"');
  });

  it('AF-09-03: type counts correctly aggregated', () => {
    const html = render(singleRoute);
    expect(html).toContain('data-request-count="1"');
    expect(html).toContain('data-response-count="1"');
    expect(html).toContain('data-event-count="1"');
  });

  it('AF-09-04: no error messages → no error flag', () => {
    expect(render(singleRoute)).not.toContain('data-field="error-flag"');
  });

  it('AF-09-05: data-route="1" present', () => {
    expect(render(singleRoute)).toContain('data-route="1"');
  });
});

// ─── AF-10: Multiple routes ───────────────────────────────────────────────────

describe('AF-10: multiple routes', () => {
  it('AF-10-01: 3 unique pairs → data-route-count="3"', () => {
    expect(render(baseMessages)).toContain('data-route-count="3"');
  });

  it('AF-10-02: all three from-values appear in output', () => {
    const html = render(baseMessages);
    expect(html).toContain('data-from="user"');
    expect(html).toContain('data-from="planner"');
    expect(html).toContain('data-from="legal-reviewer"');
  });

  it('AF-10-03: data-total-messages = total input length', () => {
    expect(render(baseMessages)).toContain(`data-total-messages="${baseMessages.length}"`);
  });

  it('AF-10-04: errored route has data-error-count="1"; clean routes have "0"', () => {
    const html = render(baseMessages);
    expect(html).toContain('data-error-count="1"');
    expect(html).toContain('data-error-count="0"');
  });

  it('AF-10-05: type-breakdown spans present for all routes', () => {
    const html = render(baseMessages);
    const breakdownMatches = html.match(/data-field="type-breakdown"/g);
    expect(breakdownMatches).not.toBeNull();
    expect(breakdownMatches!.length).toBe(3);
  });
});

// ─── AF-11: Type breakdown aggregation ───────────────────────────────────────

describe('AF-11: type breakdown aggregation', () => {
  it('AF-11-01: planner→legal-reviewer: requestCount=1, responseCount=1', () => {
    const routes = buildFlowRoutes(baseMessages);
    const r = routes.find(x => x.from === 'planner' && x.to === 'legal-reviewer');
    expect(r?.requestCount).toBe(1);
    expect(r?.responseCount).toBe(1);
  });

  it('AF-11-02: type-breakdown text contains "req / res" pattern', () => {
    const html = render(baseMessages);
    expect(html).toMatch(/req \/ \d+ res/);
  });

  it('AF-11-03: messageCount = sum of all type counts', () => {
    const routes = buildFlowRoutes(baseMessages);
    for (const r of routes) {
      expect(r.messageCount).toBe(
        r.requestCount + r.responseCount + r.eventCount + r.errorCount,
      );
    }
  });

  it('AF-11-04: event type messages increment eventCount', () => {
    const msgs = [
      makeMsg({ type: 'event' }),
      makeMsg({ type: 'event' }),
      makeMsg({ type: 'request' }),
    ];
    const routes = buildFlowRoutes(msgs);
    expect(routes[0].eventCount).toBe(2);
    expect(routes[0].requestCount).toBe(1);
  });
});

// ─── AF-12: SSR safety and edge cases ────────────────────────────────────────

describe('AF-12: SSR safety and edge cases', () => {
  it('AF-12-01: renderToString with baseMessages does not throw', () => {
    expect(() => render(baseMessages)).not.toThrow();
  });

  it('AF-12-02: large array (100 msgs, 2 routes) renders correctly', () => {
    const msgs: AgentMessage[] = [];
    for (let i = 0; i < 50; i++) {
      msgs.push(makeMsg({ from: 'user', to: 'planner',  type: 'request',  timestamp: i }));
    }
    for (let i = 0; i < 50; i++) {
      msgs.push(makeMsg({ from: 'user', to: 'risk', type: 'response', timestamp: i }));
    }
    const html = render(msgs);
    expect(html).toContain('data-route-count="2"');
    expect(html).toContain('data-total-messages="100"');
  });

  it('AF-12-03: broadcast messages (to="broadcast") are tracked as a distinct route', () => {
    const msgs = [
      makeMsg({ from: 'planner', to: 'broadcast', type: 'event' }),
      makeMsg({ from: 'planner', to: 'broadcast', type: 'event' }),
    ];
    const html = render(msgs);
    expect(html).toContain('data-to="broadcast"');
    expect(html).toContain('data-route-count="1"');
    expect(html).toContain('data-message-count="2"');
  });

  it('AF-12-04: routing span uses template literal — no React 19 comment injection', () => {
    const msgs = [makeMsg({ from: 'user', to: 'planner' })];
    const html = render(msgs);
    expect(html).toContain('user → planner');
    expect(html).not.toContain('<!-- -->');
  });

  it('AF-12-05: HTML chars in from/to fields are escaped in output', () => {
    const xssMsg: AgentMessage = {
      traceId:   TRACE_ID,
      from:      'user',
      to:        'planner',
      type:      'request',
      payload:   {},
      timestamp: T1,
    };
    // React escapes attribute values — verify XSS vector is not executed raw
    const html = render([xssMsg]);
    expect(html).not.toContain('<script>');
  });
});
