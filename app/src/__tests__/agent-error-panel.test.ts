/**
 * 8-O: AgentErrorPanel — 56 tests
 *
 * Groups:
 *   EP-01  (5)  Module exports and constants
 *   EP-02  (5)  filterErrorMessages — pure function
 *   EP-03  (5)  Root element structure — ready state
 *   EP-04  (5)  Error list items and data attributes
 *   EP-05  (4)  Timestamp display
 *   EP-06  (4)  Payload display
 *   EP-07  (5)  Empty state — no error messages
 *   EP-08  (4)  Loading state
 *   EP-09  (5)  Single error message
 *   EP-10  (5)  Multiple error messages
 *   EP-11  (4)  Ordering by timestamp ascending
 *   EP-12  (5)  SSR safety and edge cases
 *
 * All rendering via renderToString (SSR-compatible, no async).
 */

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';

import AgentErrorPanel, {
  AGENT_ERROR_PANEL_VERSION,
  filterErrorMessages,
} from '../components/AgentErrorPanel';
import type { AgentErrorPanelProps } from '../components/AgentErrorPanel';
import type { AgentMessage } from '../agents/types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const TRACE_1 = 'aaaaaaaa-1111-2222-3333-444444444444';
const TRACE_2 = 'bbbbbbbb-1111-2222-3333-444444444444';

const T1 = 1_000;   // earliest
const T2 = 2_000;
const T3 = 3_000;   // latest

function makeMsg(overrides: Partial<AgentMessage> = {}): AgentMessage {
  return {
    traceId:   TRACE_1,
    from:      'user',
    to:        'planner',
    type:      'request',
    payload:   { action: 'test' },
    timestamp: T2,
    ...overrides,
  };
}

/**
 * Base message set — mix of types and traces:
 *   msg1: request  (should be filtered OUT)
 *   msg2: response (should be filtered OUT)
 *   msg3: error    TRACE_2, T1 (earliest — appears first after sort)
 *   msg4: error    TRACE_1, T3 (latest  — appears second after sort)
 *
 * After filterErrorMessages: [msg3(T1), msg4(T3)]
 * data-error-count=2, data-total-messages=4
 */
const baseMessages: AgentMessage[] = [
  makeMsg({ type: 'request',  from: 'user',    to: 'planner',        timestamp: T2, traceId: TRACE_1 }),
  makeMsg({ type: 'response', from: 'planner', to: 'user',           timestamp: T2, traceId: TRACE_1 }),
  makeMsg({ type: 'error',    from: 'risk',    to: 'user',           timestamp: T1, traceId: TRACE_2, legalBasis: ['ND-214-2025-D81'] }),
  makeMsg({ type: 'error',    from: 'planner', to: 'legal-reviewer', timestamp: T3, traceId: TRACE_1 }),
];

function render(
  messages: AgentMessage[],
  extra: Partial<AgentErrorPanelProps> = {},
): string {
  return renderToString(
    React.createElement(AgentErrorPanel, { messages, ...extra }),
  );
}

// ─── EP-01: Module exports and constants ──────────────────────────────────────

describe('EP-01: module exports and constants', () => {
  it('EP-01-01: AgentErrorPanel is a function', () => {
    expect(typeof AgentErrorPanel).toBe('function');
  });

  it('EP-01-02: AGENT_ERROR_PANEL_VERSION is "8-O"', () => {
    expect(AGENT_ERROR_PANEL_VERSION).toBe('8-O');
  });

  it('EP-01-03: filterErrorMessages is a function', () => {
    expect(typeof filterErrorMessages).toBe('function');
  });

  it('EP-01-04: render with empty messages returns non-empty HTML', () => {
    expect(render([]).length).toBeGreaterThan(30);
  });

  it('EP-01-05: AgentErrorPanelProps type is importable (structural)', () => {
    const props: AgentErrorPanelProps = { messages: [] };
    expect(typeof props).toBe('object');
  });
});

// ─── EP-02: filterErrorMessages — pure function ───────────────────────────────

describe('EP-02: filterErrorMessages — pure function', () => {
  it('EP-02-01: empty array → empty result', () => {
    expect(filterErrorMessages([])).toHaveLength(0);
  });

  it('EP-02-02: non-error messages are filtered out', () => {
    const msgs = [
      makeMsg({ type: 'request'  }),
      makeMsg({ type: 'response' }),
      makeMsg({ type: 'event'    }),
    ];
    expect(filterErrorMessages(msgs)).toHaveLength(0);
  });

  it('EP-02-03: error messages are included', () => {
    const msgs = [makeMsg({ type: 'error' }), makeMsg({ type: 'error' })];
    expect(filterErrorMessages(msgs)).toHaveLength(2);
  });

  it('EP-02-04: mixed types → only errors returned', () => {
    const result = filterErrorMessages(baseMessages);
    expect(result).toHaveLength(2);
    expect(result.every(m => m.type === 'error')).toBe(true);
  });

  it('EP-02-05: result sorted ascending by timestamp — earlier error first', () => {
    const result = filterErrorMessages(baseMessages);
    expect(result[0].timestamp).toBe(T1);
    expect(result[1].timestamp).toBe(T3);
  });
});

// ─── EP-03: Root element structure — ready state ──────────────────────────────

describe('EP-03: root element structure — ready state', () => {
  it('EP-03-01: error messages present → data-panel="agent-error"', () => {
    expect(render(baseMessages)).toContain('data-panel="agent-error"');
  });

  it('EP-03-02: data-state="ready" when errors found', () => {
    expect(render(baseMessages)).toContain('data-state="ready"');
  });

  it('EP-03-03: data-error-count = number of error messages', () => {
    expect(render(baseMessages)).toContain('data-error-count="2"');
  });

  it('EP-03-04: data-total-messages = input messages.length (including non-errors)', () => {
    expect(render(baseMessages)).toContain(`data-total-messages="${baseMessages.length}"`);
  });

  it('EP-03-05: data-field="title" present', () => {
    expect(render(baseMessages)).toContain('data-field="title"');
  });
});

// ─── EP-04: Error list items and data attributes ──────────────────────────────

describe('EP-04: error list items and data attributes', () => {
  it('EP-04-01: data-field="error-list" on <ol>', () => {
    expect(render(baseMessages)).toContain('data-field="error-list"');
  });

  it('EP-04-02: first <li> has data-error="1"', () => {
    expect(render(baseMessages)).toContain('data-error="1"');
  });

  it('EP-04-03: <li> has data-trace-id attribute with full traceId', () => {
    const html = render(baseMessages);
    expect(html).toContain(`data-trace-id="${TRACE_2}"`); // first error is TRACE_2
  });

  it('EP-04-04: <li> has data-from and data-to attributes', () => {
    const html = render(baseMessages);
    expect(html).toContain('data-from="risk"');
    expect(html).toContain('data-to="user"');
  });

  it('EP-04-05: <li> has data-timestamp with unix-ms value', () => {
    expect(render(baseMessages)).toContain(`data-timestamp="${T1}"`);
  });
});

// ─── EP-05: Timestamp display ─────────────────────────────────────────────────

describe('EP-05: timestamp display', () => {
  it('EP-05-01: data-field="timestamp" span present for each error', () => {
    const matches = render(baseMessages).match(/data-field="timestamp"/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBe(2);
  });

  it('EP-05-02: T1=1000ms → displayed as "00:00:01.000"', () => {
    const msgs = [makeMsg({ type: 'error', timestamp: T1 })];
    expect(render(msgs)).toContain('00:00:01.000');
  });

  it('EP-05-03: timestamp=0 → displayed as "00:00:00.000"', () => {
    const msgs = [makeMsg({ type: 'error', timestamp: 0 })];
    expect(render(msgs)).toContain('00:00:00.000');
  });

  it('EP-05-04: data-timestamp attribute carries raw unix-ms integer', () => {
    const msgs = [makeMsg({ type: 'error', timestamp: T3 })];
    expect(render(msgs)).toContain(`data-timestamp="${T3}"`);
  });
});

// ─── EP-06: Payload display ───────────────────────────────────────────────────

describe('EP-06: payload display', () => {
  it('EP-06-01: data-field="payload" span present', () => {
    expect(render(baseMessages)).toContain('data-field="payload"');
  });

  it('EP-06-02: simple object payload shown as JSON string (React escapes " as &quot;)', () => {
    const msgs = [makeMsg({ type: 'error', payload: { code: 42 } })];
    // renderToString HTML-encodes " as &quot; inside text nodes
    expect(render(msgs)).toContain('&quot;code&quot;:42');
  });

  it('EP-06-03: payload JSON exceeding 120 chars is truncated with "…"', () => {
    const longPayload = { data: 'x'.repeat(200) };
    const msgs = [makeMsg({ type: 'error', payload: longPayload })];
    const html = render(msgs);
    expect(html).toContain('…');
    // The raw full value should NOT appear verbatim
    expect(html).not.toContain('x'.repeat(200));
  });

  it('EP-06-04: undefined payload displays "—"', () => {
    const msgs = [makeMsg({ type: 'error', payload: undefined })];
    expect(render(msgs)).toContain('—');
  });
});

// ─── EP-07: Empty state — no error messages ───────────────────────────────────

describe('EP-07: empty state — no error messages', () => {
  it('EP-07-01: no error messages in input → data-state="empty"', () => {
    const msgs = [makeMsg({ type: 'request' }), makeMsg({ type: 'response' })];
    expect(render(msgs)).toContain('data-state="empty"');
  });

  it('EP-07-02: messages=[] → data-state="empty"', () => {
    expect(render([])).toContain('data-state="empty"');
  });

  it('EP-07-03: data-error-count="0" in empty state', () => {
    expect(render([])).toContain('data-error-count="0"');
  });

  it('EP-07-04: no data-field="error-list"', () => {
    expect(render([])).not.toContain('data-field="error-list"');
  });

  it('EP-07-05: fallback text present', () => {
    expect(render([])).toContain('Không có lỗi');
  });
});

// ─── EP-08: Loading state ─────────────────────────────────────────────────────

describe('EP-08: loading state', () => {
  it('EP-08-01: loading=true → data-state="loading"', () => {
    expect(render(baseMessages, { loading: true })).toContain('data-state="loading"');
  });

  it('EP-08-02: loading text present', () => {
    expect(render(baseMessages, { loading: true })).toContain('Đang tải');
  });

  it('EP-08-03: loading=true → no data-error-count attribute', () => {
    expect(render(baseMessages, { loading: true })).not.toContain('data-error-count');
  });

  it('EP-08-04: loading=false (default) → data-state="ready" when errors present', () => {
    expect(render(baseMessages, { loading: false })).toContain('data-state="ready"');
  });
});

// ─── EP-09: Single error message ─────────────────────────────────────────────

describe('EP-09: single error message', () => {
  const singleError: AgentMessage[] = [
    makeMsg({ type: 'error', from: 'risk', to: 'autonomous', timestamp: T2, traceId: TRACE_1 }),
  ];

  it('EP-09-01: one error → data-error-count="1"', () => {
    expect(render(singleError)).toContain('data-error-count="1"');
  });

  it('EP-09-02: data-error="1" present', () => {
    expect(render(singleError)).toContain('data-error="1"');
  });

  it('EP-09-03: no data-error="2" (only one error)', () => {
    expect(render(singleError)).not.toContain('data-error="2"');
  });

  it('EP-09-04: routing span contains "risk → autonomous"', () => {
    expect(render(singleError)).toContain('risk → autonomous');
  });

  it('EP-09-05: trace-id span shows first 8 chars + "…"', () => {
    // TRACE_1 starts with 'aaaaaaaa'
    expect(render(singleError)).toContain('aaaaaaaa…');
  });
});

// ─── EP-10: Multiple error messages ──────────────────────────────────────────

describe('EP-10: multiple error messages', () => {
  it('EP-10-01: two errors → data-error-count="2"', () => {
    expect(render(baseMessages)).toContain('data-error-count="2"');
  });

  it('EP-10-02: data-error="1" and data-error="2" both present', () => {
    const html = render(baseMessages);
    expect(html).toContain('data-error="1"');
    expect(html).toContain('data-error="2"');
  });

  it('EP-10-03: data-total-messages includes non-error messages', () => {
    // baseMessages has 4 total (2 non-error + 2 error)
    expect(render(baseMessages)).toContain('data-total-messages="4"');
  });

  it('EP-10-04: both trace-ids appear in output', () => {
    const html = render(baseMessages);
    expect(html).toContain(`data-trace-id="${TRACE_2}"`);
    expect(html).toContain(`data-trace-id="${TRACE_1}"`);
  });

  it('EP-10-05: legal-basis-count only on msg with legalBasis', () => {
    const html = render(baseMessages);
    // msg3 (TRACE_2) has legalBasis=['ND-214-2025-D81'] → count=1
    // msg4 (TRACE_1) has no legalBasis → no span
    expect(html).toContain('data-field="legal-basis-count"');
    const countMatches = html.match(/data-field="legal-basis-count"/g);
    expect(countMatches!.length).toBe(1);
  });
});

// ─── EP-11: Ordering by timestamp ascending ───────────────────────────────────

describe('EP-11: ordering by timestamp ascending', () => {
  it('EP-11-01: earlier error (T1) appears before later error (T3)', () => {
    const html = render(baseMessages);
    // TRACE_2 has T1 (earliest), TRACE_1 has T3 (latest)
    const posTrace2 = html.indexOf(`data-trace-id="${TRACE_2}"`);
    const posTrace1 = html.indexOf(`data-trace-id="${TRACE_1}"`);
    expect(posTrace2).toBeLessThan(posTrace1);
  });

  it('EP-11-02: reversed input still sorts correctly', () => {
    const reversed = [...baseMessages].reverse();
    const html = render(reversed);
    const posTrace2 = html.indexOf(`data-trace-id="${TRACE_2}"`);
    const posTrace1 = html.indexOf(`data-trace-id="${TRACE_1}"`);
    expect(posTrace2).toBeLessThan(posTrace1);
  });

  it('EP-11-03: data-error="1" item has the earliest timestamp', () => {
    const html = render(baseMessages);
    const posItem1 = html.indexOf('data-error="1"');
    const afterItem1 = html.slice(posItem1);
    expect(afterItem1).toContain(`data-timestamp="${T1}"`);
  });

  it('EP-11-04: equal timestamps — stable sort preserves input order', () => {
    const msgs: AgentMessage[] = [
      makeMsg({ type: 'error', from: 'user',    timestamp: T2, traceId: TRACE_1 }),
      makeMsg({ type: 'error', from: 'planner', timestamp: T2, traceId: TRACE_2 }),
    ];
    const result = filterErrorMessages(msgs);
    // Equal timestamps: TRACE_1 was first in input, stays first after stable sort
    expect(result[0].traceId).toBe(TRACE_1);
    expect(result[1].traceId).toBe(TRACE_2);
  });
});

// ─── EP-12: SSR safety and edge cases ────────────────────────────────────────

describe('EP-12: SSR safety and edge cases', () => {
  it('EP-12-01: renderToString with baseMessages does not throw', () => {
    expect(() => render(baseMessages)).not.toThrow();
  });

  it('EP-12-02: renderToString with messages=[] does not throw', () => {
    expect(() => render([])).not.toThrow();
  });

  it('EP-12-03: routing span uses template literal — no React 19 comment injection', () => {
    const msgs = [makeMsg({ type: 'error', from: 'risk', to: 'autonomous' })];
    const html = render(msgs);
    expect(html).toContain('risk → autonomous');
    expect(html).not.toContain('<!-- -->');
  });

  it('EP-12-04: trace-id span uses template literal — no React 19 comment injection', () => {
    const msgs = [makeMsg({ type: 'error', traceId: TRACE_1 })];
    const html = render(msgs);
    // TRACE_1 starts with 'aaaaaaaa'; display = 'aaaaaaaa…'
    expect(html).toContain('aaaaaaaa…');
    expect(html).not.toContain('<!-- -->');
  });

  it('EP-12-05: non-serializable payload → "[non-serializable]"', () => {
    const circular: Record<string, unknown> = {};
    circular['self'] = circular;
    const msgs = [makeMsg({ type: 'error', payload: circular })];
    expect(render(msgs)).toContain('[non-serializable]');
  });
});
