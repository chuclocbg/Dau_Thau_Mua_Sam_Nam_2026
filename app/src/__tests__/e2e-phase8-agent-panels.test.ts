/**
 * P8-P: End-to-end tests for Phase 8 agent audit panels (8-K through 8-O) — 56 tests
 *
 * Covers:
 *   - AgentTracePanel (8-K) — chronological message audit trail
 *   - AgentRegistryPanel (8-L) — multi-trace registry overview
 *   - AgentFlowPanel (8-M) — routing/flow summary
 *   - AgentLegalCitationPanel (8-N) — citation frequency
 *   - AgentErrorPanel (8-O) — error-only filtered view
 *
 * All rendering via renderToString (SSR-compatible, no async calls).
 * Uses real createAgentSystem() for registry/bundle fixtures.
 * Message arrays are constructed directly for deterministic assertion.
 *
 * Groups:
 *   E2K-01  (5)  AgentTracePanel — empty and loading states
 *   E2K-02  (5)  AgentTracePanel — live message rendering and sort order
 *   E2K-03  (4)  AgentRegistryPanel — empty and loading states
 *   E2K-04  (5)  AgentRegistryPanel — live registry with logged messages
 *   E2K-05  (4)  AgentFlowPanel — structure and empty state
 *   E2K-06  (4)  AgentFlowPanel — routing grouping and ordering
 *   E2K-07  (4)  AgentLegalCitationPanel — structure and empty state
 *   E2K-08  (5)  AgentLegalCitationPanel — citation frequency and ordering
 *   E2K-09  (4)  AgentErrorPanel — structure and error filtering
 *   E2K-10  (4)  AgentErrorPanel — empty and loading states
 *   E2K-11  (6)  Multi-panel integration — all five panels from one bundle
 *   E2K-12  (6)  SSR consistency and XSS safety
 */

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';

import AgentTracePanel         from '../components/AgentTracePanel';
import AgentRegistryPanel      from '../components/AgentRegistryPanel';
import AgentFlowPanel          from '../components/AgentFlowPanel';
import AgentLegalCitationPanel from '../components/AgentLegalCitationPanel';
import AgentErrorPanel         from '../components/AgentErrorPanel';
import { createAgentSystem }   from '../components/AgentProviderPanel';
import { AgentRegistry }       from '../agents/AgentRegistry';
import type { AgentMessage }   from '../agents/types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const TRACE_A = 'aaaaaaaa-0000-0000-0000-000000000001';
const TRACE_B = 'bbbbbbbb-0000-0000-0000-000000000002';
const T1 = 1_000;
const T2 = 2_000;
const T3 = 3_000;
const T4 = 4_000;

const msgRequest: AgentMessage = {
  traceId:   TRACE_A,
  from:      'user',
  to:        'planner',
  type:      'request',
  payload:   { q: 'mua sắm vật tư' },
  timestamp: T1,
  legalBasis: ['ND-214-2025-D81'],
};

const msgResponse: AgentMessage = {
  traceId:   TRACE_A,
  from:      'planner',
  to:        'user',
  type:      'response',
  payload:   { ok: true },
  timestamp: T2,
  legalBasis: ['ND-214-2025-D81', 'TT-79-2025-D5'],
};

const msgEvent: AgentMessage = {
  traceId:   TRACE_B,
  from:      'legal-reviewer',
  to:        'broadcast',
  type:      'event',
  payload:   { status: 'done' },
  timestamp: T3,
  // no legalBasis — tests that panels skip messages without it
};

const msgError: AgentMessage = {
  traceId:   TRACE_B,
  from:      'risk',
  to:        'planner',
  type:      'error',
  payload:   { code: 500 },
  timestamp: T4,
  legalBasis: ['TT-79-2025-D5'],
};

/** All four messages across both traces. */
const allMessages: AgentMessage[] = [msgRequest, msgResponse, msgEvent, msgError];

/** Fresh registry pre-populated with all four messages. */
function makeRegistry(): AgentRegistry {
  const reg = new AgentRegistry();
  for (const m of allMessages) reg.log(m);
  return reg;
}

// ─── E2K-01: AgentTracePanel — empty and loading states ──────────────────────

describe('E2K-01 · AgentTracePanel — empty and loading states', () => {
  it('E2K-01-01: renders without throwing for messages=[]', () => {
    expect(() =>
      renderToString(React.createElement(AgentTracePanel, { messages: [] })),
    ).not.toThrow();
  });

  it('E2K-01-02: data-panel="agent-trace" present', () => {
    const html = renderToString(React.createElement(AgentTracePanel, { messages: [] }));
    expect(html).toContain('data-panel="agent-trace"');
  });

  it('E2K-01-03: data-state="empty" for messages=[]', () => {
    const html = renderToString(React.createElement(AgentTracePanel, { messages: [] }));
    expect(html).toContain('data-state="empty"');
  });

  it('E2K-01-04: data-state="loading" when loading=true', () => {
    const html = renderToString(
      React.createElement(AgentTracePanel, { messages: [], loading: true }),
    );
    expect(html).toContain('data-state="loading"');
  });

  it('E2K-01-05: data-message-count="0" for empty messages', () => {
    const html = renderToString(React.createElement(AgentTracePanel, { messages: [] }));
    expect(html).toContain('data-message-count="0"');
  });
});

// ─── E2K-02: AgentTracePanel — live message rendering and sort order ──────────

describe('E2K-02 · AgentTracePanel — live message rendering and sort order', () => {
  const traceAMessages = [msgRequest, msgResponse];

  it('E2K-02-01: data-state="ready" for non-empty messages', () => {
    const html = renderToString(React.createElement(AgentTracePanel, { messages: traceAMessages }));
    expect(html).toContain('data-state="ready"');
  });

  it('E2K-02-02: data-message-count="2" for two messages', () => {
    const html = renderToString(React.createElement(AgentTracePanel, { messages: traceAMessages }));
    expect(html).toContain('data-message-count="2"');
  });

  it('E2K-02-03: traceId attribute written when traceId prop supplied', () => {
    const html = renderToString(
      React.createElement(AgentTracePanel, { messages: traceAMessages, traceId: TRACE_A }),
    );
    expect(html).toContain('data-trace-id');
    expect(html).toContain(TRACE_A.slice(0, 8));
  });

  it('E2K-02-04: both message types shown (request and response)', () => {
    const html = renderToString(React.createElement(AgentTracePanel, { messages: traceAMessages }));
    expect(html).toContain('data-type="request"');
    expect(html).toContain('data-type="response"');
  });

  it('E2K-02-05: messages sorted ascending by timestamp even when input is reversed', () => {
    const reversed = [msgResponse, msgRequest]; // T2 before T1 in input
    const html = renderToString(React.createElement(AgentTracePanel, { messages: reversed }));
    // After ascending sort, user (T1) appears before planner (T2) in the rendered list
    const requestPos  = html.indexOf('data-from="user"');
    const responsePos = html.indexOf('data-from="planner"');
    expect(requestPos).toBeGreaterThan(-1);
    expect(responsePos).toBeGreaterThan(-1);
    expect(requestPos).toBeLessThan(responsePos);
  });
});

// ─── E2K-03: AgentRegistryPanel — empty and loading states ───────────────────

describe('E2K-03 · AgentRegistryPanel — empty and loading states', () => {
  const emptyReg = new AgentRegistry();

  it('E2K-03-01: renders without throwing for traceIds=[]', () => {
    expect(() =>
      renderToString(React.createElement(AgentRegistryPanel, { registry: emptyReg, traceIds: [] })),
    ).not.toThrow();
  });

  it('E2K-03-02: data-panel="agent-registry" present', () => {
    const html = renderToString(
      React.createElement(AgentRegistryPanel, { registry: emptyReg, traceIds: [] }),
    );
    expect(html).toContain('data-panel="agent-registry"');
  });

  it('E2K-03-03: data-state="empty" for traceIds=[]', () => {
    const html = renderToString(
      React.createElement(AgentRegistryPanel, { registry: emptyReg, traceIds: [] }),
    );
    expect(html).toContain('data-state="empty"');
  });

  it('E2K-03-04: data-state="loading" when loading=true', () => {
    const html = renderToString(
      React.createElement(AgentRegistryPanel, { registry: emptyReg, traceIds: [], loading: true }),
    );
    expect(html).toContain('data-state="loading"');
  });
});

// ─── E2K-04: AgentRegistryPanel — live registry with logged messages ──────────

describe('E2K-04 · AgentRegistryPanel — live registry with logged messages', () => {
  const reg = makeRegistry();

  it('E2K-04-01: data-state="ready" when traceIds contains known traces', () => {
    const html = renderToString(
      React.createElement(AgentRegistryPanel, { registry: reg, traceIds: [TRACE_A, TRACE_B] }),
    );
    expect(html).toContain('data-state="ready"');
  });

  it('E2K-04-02: data-trace-count="2" for two traceIds', () => {
    const html = renderToString(
      React.createElement(AgentRegistryPanel, { registry: reg, traceIds: [TRACE_A, TRACE_B] }),
    );
    expect(html).toContain('data-trace-count="2"');
  });

  it('E2K-04-03: data-total-messages="4" for 4 logged messages across both traces', () => {
    const html = renderToString(
      React.createElement(AgentRegistryPanel, { registry: reg, traceIds: [TRACE_A, TRACE_B] }),
    );
    expect(html).toContain('data-total-messages="4"');
  });

  it('E2K-04-04: TRACE_A prefix visible in rendered trace-id span', () => {
    const html = renderToString(
      React.createElement(AgentRegistryPanel, { registry: reg, traceIds: [TRACE_A] }),
    );
    expect(html).toContain(TRACE_A.slice(0, 8));
  });

  it('E2K-04-05: createAgentSystem().registry is a valid AgentRegistry instance', () => {
    const bundle = createAgentSystem();
    expect(() =>
      renderToString(
        React.createElement(AgentRegistryPanel, { registry: bundle.registry, traceIds: [] }),
      ),
    ).not.toThrow();
  });
});

// ─── E2K-05: AgentFlowPanel — structure and empty state ──────────────────────

describe('E2K-05 · AgentFlowPanel — structure and empty state', () => {
  it('E2K-05-01: renders without throwing for messages=[]', () => {
    expect(() =>
      renderToString(React.createElement(AgentFlowPanel, { messages: [] })),
    ).not.toThrow();
  });

  it('E2K-05-02: data-panel="agent-flow" present', () => {
    const html = renderToString(React.createElement(AgentFlowPanel, { messages: [] }));
    expect(html).toContain('data-panel="agent-flow"');
  });

  it('E2K-05-03: data-state="empty" for messages=[]', () => {
    const html = renderToString(React.createElement(AgentFlowPanel, { messages: [] }));
    expect(html).toContain('data-state="empty"');
  });

  it('E2K-05-04: data-state="loading" when loading=true', () => {
    const html = renderToString(
      React.createElement(AgentFlowPanel, { messages: [], loading: true }),
    );
    expect(html).toContain('data-state="loading"');
  });
});

// ─── E2K-06: AgentFlowPanel — routing grouping and ordering ──────────────────

describe('E2K-06 · AgentFlowPanel — routing grouping and ordering', () => {
  it('E2K-06-01: data-state="ready" for non-empty messages', () => {
    const html = renderToString(React.createElement(AgentFlowPanel, { messages: allMessages }));
    expect(html).toContain('data-state="ready"');
  });

  it('E2K-06-02: data-route-count="4" — four distinct (from, to) pairs in allMessages', () => {
    // user→planner, planner→user, legal-reviewer→broadcast, risk→planner
    const html = renderToString(React.createElement(AgentFlowPanel, { messages: allMessages }));
    expect(html).toContain('data-route-count="4"');
  });

  it('E2K-06-03: data-total-messages="4" for 4 messages', () => {
    const html = renderToString(React.createElement(AgentFlowPanel, { messages: allMessages }));
    expect(html).toContain('data-total-messages="4"');
  });

  it('E2K-06-04: data-field="route-list" present in ready state', () => {
    const html = renderToString(React.createElement(AgentFlowPanel, { messages: allMessages }));
    expect(html).toContain('data-field="route-list"');
  });
});

// ─── E2K-07: AgentLegalCitationPanel — structure and empty state ──────────────

describe('E2K-07 · AgentLegalCitationPanel — structure and empty state', () => {
  it('E2K-07-01: renders without throwing for messages=[]', () => {
    expect(() =>
      renderToString(React.createElement(AgentLegalCitationPanel, { messages: [] })),
    ).not.toThrow();
  });

  it('E2K-07-02: data-panel="agent-legal-citation" present', () => {
    const html = renderToString(React.createElement(AgentLegalCitationPanel, { messages: [] }));
    expect(html).toContain('data-panel="agent-legal-citation"');
  });

  it('E2K-07-03: data-state="empty" when no messages have legalBasis', () => {
    // msgEvent has no legalBasis — should trigger empty state
    const html = renderToString(React.createElement(AgentLegalCitationPanel, { messages: [msgEvent] }));
    expect(html).toContain('data-state="empty"');
  });

  it('E2K-07-04: data-state="loading" when loading=true', () => {
    const html = renderToString(
      React.createElement(AgentLegalCitationPanel, { messages: [], loading: true }),
    );
    expect(html).toContain('data-state="loading"');
  });
});

// ─── E2K-08: AgentLegalCitationPanel — citation frequency and ordering ─────────

describe('E2K-08 · AgentLegalCitationPanel — citation frequency and ordering', () => {
  // ND-214-2025-D81: msgRequest(1) + msgResponse(1) = 2 occurrences
  // TT-79-2025-D5:   msgResponse(1) + msgError(1)   = 2 occurrences
  const withCitations = [msgRequest, msgResponse, msgError];

  it('E2K-08-01: data-state="ready" when messages have legalBasis', () => {
    const html = renderToString(React.createElement(AgentLegalCitationPanel, { messages: withCitations }));
    expect(html).toContain('data-state="ready"');
  });

  it('E2K-08-02: data-citation-count="2" for two distinct citations', () => {
    const html = renderToString(React.createElement(AgentLegalCitationPanel, { messages: withCitations }));
    expect(html).toContain('data-citation-count="2"');
  });

  it('E2K-08-03: data-total-messages reflects raw input length', () => {
    const html = renderToString(React.createElement(AgentLegalCitationPanel, { messages: withCitations }));
    expect(html).toContain('data-total-messages="3"');
  });

  it('E2K-08-04: citation text from first message visible in output', () => {
    const html = renderToString(React.createElement(AgentLegalCitationPanel, { messages: withCitations }));
    expect(html).toContain('ND-214-2025-D81');
  });

  it('E2K-08-05: data-field="citation-list" present in ready state', () => {
    const html = renderToString(React.createElement(AgentLegalCitationPanel, { messages: withCitations }));
    expect(html).toContain('data-field="citation-list"');
  });
});

// ─── E2K-09: AgentErrorPanel — structure and error filtering ─────────────────

describe('E2K-09 · AgentErrorPanel — structure and error filtering', () => {
  it('E2K-09-01: renders without throwing for all-type input', () => {
    expect(() =>
      renderToString(React.createElement(AgentErrorPanel, { messages: allMessages })),
    ).not.toThrow();
  });

  it('E2K-09-02: data-panel="agent-error" present', () => {
    const html = renderToString(React.createElement(AgentErrorPanel, { messages: allMessages }));
    expect(html).toContain('data-panel="agent-error"');
  });

  it('E2K-09-03: data-error-count="1" — only msgError passes type==="error" filter', () => {
    const html = renderToString(React.createElement(AgentErrorPanel, { messages: allMessages }));
    expect(html).toContain('data-error-count="1"');
  });

  it('E2K-09-04: data-total-messages="4" reflects full input, not filtered count', () => {
    const html = renderToString(React.createElement(AgentErrorPanel, { messages: allMessages }));
    expect(html).toContain('data-total-messages="4"');
  });
});

// ─── E2K-10: AgentErrorPanel — empty and loading states ──────────────────────

describe('E2K-10 · AgentErrorPanel — empty and loading states', () => {
  it('E2K-10-01: data-state="empty" for messages=[]', () => {
    const html = renderToString(React.createElement(AgentErrorPanel, { messages: [] }));
    expect(html).toContain('data-state="empty"');
  });

  it('E2K-10-02: data-state="empty" when input has no error-type messages', () => {
    const noErrors = [msgRequest, msgResponse, msgEvent];
    const html = renderToString(React.createElement(AgentErrorPanel, { messages: noErrors }));
    expect(html).toContain('data-state="empty"');
  });

  it('E2K-10-03: data-state="ready" when at least one error message is present', () => {
    const html = renderToString(React.createElement(AgentErrorPanel, { messages: [msgError] }));
    expect(html).toContain('data-state="ready"');
  });

  it('E2K-10-04: data-state="loading" when loading=true', () => {
    const html = renderToString(
      React.createElement(AgentErrorPanel, { messages: [], loading: true }),
    );
    expect(html).toContain('data-state="loading"');
  });
});

// ─── E2K-11: Multi-panel integration — all five panels from one bundle ─────────

describe('E2K-11 · Multi-panel integration — all five panels from one bundle', () => {
  const bundle = createAgentSystem();
  const reg    = makeRegistry();

  it('E2K-11-01: all five panels render without throwing', () => {
    const renders = [
      () => renderToString(React.createElement(AgentTracePanel, { messages: allMessages })),
      () => renderToString(React.createElement(AgentRegistryPanel, { registry: reg, traceIds: [TRACE_A, TRACE_B] })),
      () => renderToString(React.createElement(AgentFlowPanel, { messages: allMessages })),
      () => renderToString(React.createElement(AgentLegalCitationPanel, { messages: allMessages })),
      () => renderToString(React.createElement(AgentErrorPanel, { messages: allMessages })),
    ];
    for (const render of renders) {
      expect(render).not.toThrow();
    }
  });

  it('E2K-11-02: all five panels carry correct data-panel attribute values', () => {
    const traceHtml    = renderToString(React.createElement(AgentTracePanel, { messages: allMessages }));
    const registryHtml = renderToString(React.createElement(AgentRegistryPanel, { registry: reg, traceIds: [TRACE_A, TRACE_B] }));
    const flowHtml     = renderToString(React.createElement(AgentFlowPanel, { messages: allMessages }));
    const citationHtml = renderToString(React.createElement(AgentLegalCitationPanel, { messages: allMessages }));
    const errorHtml    = renderToString(React.createElement(AgentErrorPanel, { messages: allMessages }));
    expect(traceHtml).toContain('data-panel="agent-trace"');
    expect(registryHtml).toContain('data-panel="agent-registry"');
    expect(flowHtml).toContain('data-panel="agent-flow"');
    expect(citationHtml).toContain('data-panel="agent-legal-citation"');
    expect(errorHtml).toContain('data-panel="agent-error"');
  });

  it('E2K-11-03: AgentTracePanel filtered to TRACE_A only shows 2 messages', () => {
    const traceAOnly = allMessages.filter(m => m.traceId === TRACE_A);
    const html = renderToString(
      React.createElement(AgentTracePanel, { messages: traceAOnly, traceId: TRACE_A }),
    );
    expect(html).toContain('data-message-count="2"');
  });

  it('E2K-11-04: createAgentSystem().registry renders AgentRegistryPanel empty state correctly', () => {
    const html = renderToString(
      React.createElement(AgentRegistryPanel, { registry: bundle.registry, traceIds: [] }),
    );
    expect(html).toContain('data-state="empty"');
  });

  it('E2K-11-05: AgentFlowPanel and AgentErrorPanel both report same data-total-messages', () => {
    const flowHtml  = renderToString(React.createElement(AgentFlowPanel,  { messages: allMessages }));
    const errorHtml = renderToString(React.createElement(AgentErrorPanel, { messages: allMessages }));
    expect(flowHtml).toContain('data-total-messages="4"');
    expect(errorHtml).toContain('data-total-messages="4"');
  });

  it('E2K-11-06: AgentLegalCitationPanel skips messages without legalBasis', () => {
    // msgEvent has no legalBasis — still 2 distinct citations from the other 3 messages
    const html = renderToString(React.createElement(AgentLegalCitationPanel, { messages: allMessages }));
    expect(html).toContain('data-citation-count="2"');
    expect(html).toContain('data-total-messages="4"');
  });
});

// ─── E2K-12: SSR consistency and XSS safety ──────────────────────────────────

describe('E2K-12 · SSR consistency and XSS safety', () => {
  it('E2K-12-01: AgentTracePanel output is deterministic for same props', () => {
    const props = { messages: [msgRequest, msgResponse], traceId: TRACE_A };
    expect(renderToString(React.createElement(AgentTracePanel, props)))
      .toBe(renderToString(React.createElement(AgentTracePanel, props)));
  });

  it('E2K-12-02: AgentRegistryPanel output is deterministic for same props', () => {
    const reg   = makeRegistry();
    const props = { registry: reg, traceIds: [TRACE_A, TRACE_B] };
    expect(renderToString(React.createElement(AgentRegistryPanel, props)))
      .toBe(renderToString(React.createElement(AgentRegistryPanel, props)));
  });

  it('E2K-12-03: AgentFlowPanel output is deterministic for same props', () => {
    const props = { messages: allMessages };
    expect(renderToString(React.createElement(AgentFlowPanel, props)))
      .toBe(renderToString(React.createElement(AgentFlowPanel, props)));
  });

  it('E2K-12-04: AgentLegalCitationPanel output is deterministic for same props', () => {
    const props = { messages: [msgRequest, msgResponse, msgError] };
    expect(renderToString(React.createElement(AgentLegalCitationPanel, props)))
      .toBe(renderToString(React.createElement(AgentLegalCitationPanel, props)));
  });

  it('E2K-12-05: AgentErrorPanel output is deterministic for same props', () => {
    const props = { messages: allMessages };
    expect(renderToString(React.createElement(AgentErrorPanel, props)))
      .toBe(renderToString(React.createElement(AgentErrorPanel, props)));
  });

  it('E2K-12-06: no <script> tags in any of the five panels', () => {
    const reg = makeRegistry();
    const htmlOutputs = [
      renderToString(React.createElement(AgentTracePanel, { messages: allMessages })),
      renderToString(React.createElement(AgentRegistryPanel, { registry: reg, traceIds: [TRACE_A, TRACE_B] })),
      renderToString(React.createElement(AgentFlowPanel, { messages: allMessages })),
      renderToString(React.createElement(AgentLegalCitationPanel, { messages: allMessages })),
      renderToString(React.createElement(AgentErrorPanel, { messages: allMessages })),
    ];
    for (const html of htmlOutputs) {
      expect(html).not.toContain('<script');
    }
  });
});
