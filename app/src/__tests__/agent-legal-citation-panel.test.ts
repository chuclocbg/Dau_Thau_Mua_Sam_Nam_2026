/**
 * 8-N: AgentLegalCitationPanel — 56 tests
 *
 * Groups:
 *   LC-01  (5)  Module exports and constants
 *   LC-02  (5)  buildCitationSummaries — pure function
 *   LC-03  (5)  Root element structure — ready state
 *   LC-04  (5)  Citation list items and data attributes
 *   LC-05  (4)  Sorting by messageCount descending
 *   LC-06  (4)  Messages with no legalBasis → empty state
 *   LC-07  (5)  Empty state — messages=[]
 *   LC-08  (4)  Loading state
 *   LC-09  (5)  Single citation
 *   LC-10  (5)  Multiple citations
 *   LC-11  (4)  Multiple citations per message
 *   LC-12  (5)  SSR safety and edge cases
 *
 * All rendering via renderToString (SSR-compatible, no async).
 */

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';

import AgentLegalCitationPanel, {
  AGENT_LEGAL_CITATION_PANEL_VERSION,
  buildCitationSummaries,
} from '../components/AgentLegalCitationPanel';
import type { AgentLegalCitationPanelProps } from '../components/AgentLegalCitationPanel';
import type { AgentMessage } from '../agents/types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const TRACE_ID = 'bbbbbbbb-1111-2222-3333-444444444444';
const T1 = 1_000;
const T2 = 2_000;
const T3 = 3_000;

// Short ASCII citation strings — safe for HTML attribute comparisons in tests
const CITE_A = 'ND-214-2025-D81';   // most referenced: 3 times
const CITE_B = 'TT-79-2025-D5';    // 2 times
const CITE_C = 'TT-80-2025-D3';    // 1 time

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
 * Base message set:
 *   msg1: legalBasis=[CITE_A, CITE_B]   → CITE_A+1, CITE_B+1
 *   msg2: legalBasis=[CITE_A, CITE_C]   → CITE_A+1, CITE_C+1
 *   msg3: legalBasis=[CITE_A, CITE_B]   → CITE_A+1, CITE_B+1
 *   msg4: legalBasis=undefined           → skipped
 *
 * Expected counts: CITE_A=3, CITE_B=2, CITE_C=1
 * Sorted desc: CITE_A first, CITE_B second, CITE_C third
 */
const baseMessages: AgentMessage[] = [
  makeMsg({ legalBasis: [CITE_A, CITE_B], timestamp: T1 }),
  makeMsg({ legalBasis: [CITE_A, CITE_C], timestamp: T2 }),
  makeMsg({ legalBasis: [CITE_A, CITE_B], timestamp: T3 }),
  makeMsg({ timestamp: T1 }), // no legalBasis
];

function render(
  messages: AgentMessage[],
  extra: Partial<AgentLegalCitationPanelProps> = {},
): string {
  return renderToString(
    React.createElement(AgentLegalCitationPanel, { messages, ...extra }),
  );
}

// ─── LC-01: Module exports and constants ──────────────────────────────────────

describe('LC-01: module exports and constants', () => {
  it('LC-01-01: AgentLegalCitationPanel is a function', () => {
    expect(typeof AgentLegalCitationPanel).toBe('function');
  });

  it('LC-01-02: AGENT_LEGAL_CITATION_PANEL_VERSION is "8-N"', () => {
    expect(AGENT_LEGAL_CITATION_PANEL_VERSION).toBe('8-N');
  });

  it('LC-01-03: buildCitationSummaries is a function', () => {
    expect(typeof buildCitationSummaries).toBe('function');
  });

  it('LC-01-04: render with empty messages returns non-empty HTML', () => {
    expect(render([]).length).toBeGreaterThan(30);
  });

  it('LC-01-05: AgentLegalCitationPanelProps type is importable (structural)', () => {
    const props: AgentLegalCitationPanelProps = { messages: [] };
    expect(typeof props).toBe('object');
  });
});

// ─── LC-02: buildCitationSummaries — pure function ───────────────────────────

describe('LC-02: buildCitationSummaries — pure function', () => {
  it('LC-02-01: empty array → empty result', () => {
    expect(buildCitationSummaries([])).toHaveLength(0);
  });

  it('LC-02-02: 3 messages all citing CITE_A → single entry with messageCount=3', () => {
    const msgs = [
      makeMsg({ legalBasis: [CITE_A] }),
      makeMsg({ legalBasis: [CITE_A] }),
      makeMsg({ legalBasis: [CITE_A] }),
    ];
    const result = buildCitationSummaries(msgs);
    expect(result).toHaveLength(1);
    expect(result[0].citation).toBe(CITE_A);
    expect(result[0].messageCount).toBe(3);
  });

  it('LC-02-03: baseMessages → 3 distinct citations with correct counts', () => {
    const result = buildCitationSummaries(baseMessages);
    expect(result).toHaveLength(3);
    const a = result.find(r => r.citation === CITE_A);
    const b = result.find(r => r.citation === CITE_B);
    const c = result.find(r => r.citation === CITE_C);
    expect(a?.messageCount).toBe(3);
    expect(b?.messageCount).toBe(2);
    expect(c?.messageCount).toBe(1);
  });

  it('LC-02-04: result sorted descending by messageCount', () => {
    const result = buildCitationSummaries(baseMessages);
    expect(result[0].messageCount).toBeGreaterThanOrEqual(result[1].messageCount);
    expect(result[1].messageCount).toBeGreaterThanOrEqual(result[2].messageCount);
  });

  it('LC-02-05: messages without legalBasis do not contribute to any count', () => {
    const msgs = [
      makeMsg({ legalBasis: [CITE_A] }),
      makeMsg(), // no legalBasis — should be skipped
      makeMsg(), // no legalBasis — should be skipped
    ];
    const result = buildCitationSummaries(msgs);
    expect(result).toHaveLength(1);
    expect(result[0].messageCount).toBe(1);
  });
});

// ─── LC-03: Root element structure — ready state ──────────────────────────────

describe('LC-03: root element structure — ready state', () => {
  it('LC-03-01: data-panel="agent-legal-citation"', () => {
    expect(render(baseMessages)).toContain('data-panel="agent-legal-citation"');
  });

  it('LC-03-02: data-state="ready" when citations found', () => {
    expect(render(baseMessages)).toContain('data-state="ready"');
  });

  it('LC-03-03: data-citation-count = number of unique citations', () => {
    expect(render(baseMessages)).toContain('data-citation-count="3"');
  });

  it('LC-03-04: data-total-messages = input messages.length (including no-citation msgs)', () => {
    // baseMessages has 4 messages (3 with legalBasis + 1 without)
    expect(render(baseMessages)).toContain('data-total-messages="4"');
  });

  it('LC-03-05: data-field="title" present', () => {
    expect(render(baseMessages)).toContain('data-field="title"');
  });
});

// ─── LC-04: Citation list items and data attributes ───────────────────────────

describe('LC-04: citation list items and data attributes', () => {
  it('LC-04-01: data-field="citation-list" on <ol>', () => {
    expect(render(baseMessages)).toContain('data-field="citation-list"');
  });

  it('LC-04-02: first <li> has data-citation="1"', () => {
    expect(render(baseMessages)).toContain('data-citation="1"');
  });

  it('LC-04-03: <li> has data-citation-text attribute matching citation string', () => {
    expect(render(baseMessages)).toContain(`data-citation-text="${CITE_A}"`);
  });

  it('LC-04-04: <li> has data-message-count attribute', () => {
    expect(render(baseMessages)).toContain('data-message-count="3"');
  });

  it('LC-04-05: span data-field="citation-text" contains the citation string', () => {
    const html = render(baseMessages);
    expect(html).toContain('data-field="citation-text"');
    expect(html).toContain(CITE_A);
  });
});

// ─── LC-05: Sorting by messageCount descending ────────────────────────────────

describe('LC-05: sorting by messageCount descending', () => {
  it('LC-05-01: CITE_A (count=3) appears before CITE_B (count=2) in output', () => {
    const html = render(baseMessages);
    expect(html.indexOf(CITE_A)).toBeLessThan(html.indexOf(CITE_B));
  });

  it('LC-05-02: reversed input yields the same sorted citation order', () => {
    const reversed = [...baseMessages].reverse();
    const htmlFwd = render(baseMessages);
    const htmlRev = render(reversed);
    const firstCiteFwd = htmlFwd.match(/data-citation-text="([^"]+)"/)?.[1];
    const firstCiteRev = htmlRev.match(/data-citation-text="([^"]+)"/)?.[1];
    expect(firstCiteFwd).toBe(CITE_A);
    expect(firstCiteRev).toBe(CITE_A);
  });

  it('LC-05-03: data-citation="1" element has CITE_A (highest count)', () => {
    const html = render(baseMessages);
    const pos1 = html.indexOf('data-citation="1"');
    const afterFirst = html.slice(pos1);
    expect(afterFirst).toContain(`data-citation-text="${CITE_A}"`);
  });

  it('LC-05-04: CITE_C (count=1) appears last', () => {
    const html = render(baseMessages);
    const posA = html.indexOf(CITE_A);
    const posB = html.indexOf(CITE_B);
    const posC = html.indexOf(CITE_C);
    expect(posC).toBeGreaterThan(posA);
    expect(posC).toBeGreaterThan(posB);
  });
});

// ─── LC-06: Messages with no legalBasis → empty state ────────────────────────

describe('LC-06: messages with no legalBasis → empty state', () => {
  it('LC-06-01: messages where all legalBasis=undefined → data-state="empty"', () => {
    const msgs = [makeMsg(), makeMsg()];
    expect(render(msgs)).toContain('data-state="empty"');
  });

  it('LC-06-02: messages where all legalBasis=[] → data-state="empty"', () => {
    const msgs = [
      makeMsg({ legalBasis: [] }),
      makeMsg({ legalBasis: [] }),
    ];
    expect(render(msgs)).toContain('data-state="empty"');
  });

  it('LC-06-03: data-citation-count="0" when no citations found', () => {
    const msgs = [makeMsg(), makeMsg()];
    expect(render(msgs)).toContain('data-citation-count="0"');
  });

  it('LC-06-04: data-total-messages reflects input length even when no citations', () => {
    const msgs = [makeMsg(), makeMsg(), makeMsg()];
    expect(render(msgs)).toContain('data-total-messages="3"');
  });
});

// ─── LC-07: Empty state — messages=[] ────────────────────────────────────────

describe('LC-07: empty state — messages=[]', () => {
  it('LC-07-01: messages=[] → data-state="empty"', () => {
    expect(render([])).toContain('data-state="empty"');
  });

  it('LC-07-02: data-citation-count="0"', () => {
    expect(render([])).toContain('data-citation-count="0"');
  });

  it('LC-07-03: data-total-messages="0"', () => {
    expect(render([])).toContain('data-total-messages="0"');
  });

  it('LC-07-04: no data-field="citation-list"', () => {
    expect(render([])).not.toContain('data-field="citation-list"');
  });

  it('LC-07-05: fallback text present', () => {
    expect(render([])).toContain('Chưa có trích dẫn');
  });
});

// ─── LC-08: Loading state ─────────────────────────────────────────────────────

describe('LC-08: loading state', () => {
  it('LC-08-01: loading=true → data-state="loading"', () => {
    expect(render(baseMessages, { loading: true })).toContain('data-state="loading"');
  });

  it('LC-08-02: loading=true → loading text present', () => {
    expect(render(baseMessages, { loading: true })).toContain('Đang tải');
  });

  it('LC-08-03: loading=true → no data-citation-count attribute', () => {
    expect(render(baseMessages, { loading: true })).not.toContain('data-citation-count');
  });

  it('LC-08-04: loading=false (default) → data-state="ready" when citations present', () => {
    expect(render(baseMessages, { loading: false })).toContain('data-state="ready"');
  });
});

// ─── LC-09: Single citation ───────────────────────────────────────────────────

describe('LC-09: single citation', () => {
  const singleCite: AgentMessage[] = [
    makeMsg({ legalBasis: [CITE_A] }),
    makeMsg({ legalBasis: [CITE_A] }),
  ];

  it('LC-09-01: two messages citing CITE_A → data-citation-count="1"', () => {
    expect(render(singleCite)).toContain('data-citation-count="1"');
  });

  it('LC-09-02: data-message-count="2" on the single citation item', () => {
    expect(render(singleCite)).toContain('data-message-count="2"');
  });

  it('LC-09-03: data-citation="1" present', () => {
    expect(render(singleCite)).toContain('data-citation="1"');
  });

  it('LC-09-04: citation text appears in output', () => {
    expect(render(singleCite)).toContain(CITE_A);
  });

  it('LC-09-05: no data-citation="2" (only one unique citation)', () => {
    expect(render(singleCite)).not.toContain('data-citation="2"');
  });
});

// ─── LC-10: Multiple citations ────────────────────────────────────────────────

describe('LC-10: multiple citations', () => {
  it('LC-10-01: 3 unique citations → data-citation-count="3"', () => {
    expect(render(baseMessages)).toContain('data-citation-count="3"');
  });

  it('LC-10-02: all three citation texts appear in output', () => {
    const html = render(baseMessages);
    expect(html).toContain(CITE_A);
    expect(html).toContain(CITE_B);
    expect(html).toContain(CITE_C);
  });

  it('LC-10-03: data-total-messages = total input messages.length', () => {
    expect(render(baseMessages)).toContain(`data-total-messages="${baseMessages.length}"`);
  });

  it('LC-10-04: data-citation="1", "2", "3" all present', () => {
    const html = render(baseMessages);
    expect(html).toContain('data-citation="1"');
    expect(html).toContain('data-citation="2"');
    expect(html).toContain('data-citation="3"');
  });

  it('LC-10-05: three data-field="citation-text" spans present', () => {
    const matches = render(baseMessages).match(/data-field="citation-text"/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBe(3);
  });
});

// ─── LC-11: Multiple citations per message ────────────────────────────────────

describe('LC-11: multiple citations per message', () => {
  it('LC-11-01: msg with [CITE_A, CITE_B] contributes 1 to each citation count', () => {
    const msgs = [makeMsg({ legalBasis: [CITE_A, CITE_B] })];
    const result = buildCitationSummaries(msgs);
    const a = result.find(r => r.citation === CITE_A);
    const b = result.find(r => r.citation === CITE_B);
    expect(a?.messageCount).toBe(1);
    expect(b?.messageCount).toBe(1);
  });

  it('LC-11-02: two msgs each with [CITE_A, CITE_B] → each citation count=2', () => {
    const msgs = [
      makeMsg({ legalBasis: [CITE_A, CITE_B] }),
      makeMsg({ legalBasis: [CITE_A, CITE_B] }),
    ];
    const result = buildCitationSummaries(msgs);
    expect(result.find(r => r.citation === CITE_A)?.messageCount).toBe(2);
    expect(result.find(r => r.citation === CITE_B)?.messageCount).toBe(2);
  });

  it('LC-11-03: duplicate citation within same legalBasis[] → counted twice', () => {
    const msgs = [makeMsg({ legalBasis: [CITE_A, CITE_A] })];
    const result = buildCitationSummaries(msgs);
    expect(result).toHaveLength(1);
    expect(result[0].messageCount).toBe(2);
  });

  it('LC-11-04: two msgs each with a different citation → both have messageCount=1', () => {
    const msgs = [
      makeMsg({ legalBasis: [CITE_A] }),
      makeMsg({ legalBasis: [CITE_B] }),
    ];
    const result = buildCitationSummaries(msgs);
    expect(result).toHaveLength(2);
    expect(result[0].messageCount).toBe(1);
    expect(result[1].messageCount).toBe(1);
  });
});

// ─── LC-12: SSR safety and edge cases ────────────────────────────────────────

describe('LC-12: SSR safety and edge cases', () => {
  it('LC-12-01: renderToString with baseMessages does not throw', () => {
    expect(() => render(baseMessages)).not.toThrow();
  });

  it('LC-12-02: renderToString with messages=[] does not throw', () => {
    expect(() => render([])).not.toThrow();
  });

  it('LC-12-03: title uses template literal — no React 19 comment injection', () => {
    const html = render(baseMessages);
    expect(html).not.toContain('<!-- -->');
    expect(html).toContain('3 văn bản');
  });

  it('LC-12-04: large input (100 messages, 2 citations) renders correctly', () => {
    const msgs: AgentMessage[] = [];
    for (let i = 0; i < 60; i++) {
      msgs.push(makeMsg({ legalBasis: [CITE_A], timestamp: i }));
    }
    for (let i = 0; i < 40; i++) {
      msgs.push(makeMsg({ legalBasis: [CITE_B], timestamp: i }));
    }
    const html = render(msgs);
    expect(html).toContain('data-citation-count="2"');
    expect(html).toContain('data-total-messages="100"');
    // CITE_A (60) should appear before CITE_B (40)
    expect(html.indexOf(CITE_A)).toBeLessThan(html.indexOf(CITE_B));
  });

  it('LC-12-05: citation text appearing in data attribute is rendered by React without injection', () => {
    const msgs = [makeMsg({ legalBasis: [CITE_A] })];
    const html = render(msgs);
    // The span content should equal CITE_A without surrounding comment nodes
    expect(html).toContain(`>${CITE_A}<`);
  });
});
