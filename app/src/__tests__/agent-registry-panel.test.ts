/**
 * 8-L: AgentRegistryPanel — 56 tests
 *
 * Groups:
 *   AR-01  (5)  Module exports and constants
 *   AR-02  (5)  buildTraceSummary — pure function coverage
 *   AR-03  (5)  Root element structure — ready state
 *   AR-04  (5)  Trace list items and data attributes
 *   AR-05  (4)  Error flag display
 *   AR-06  (4)  Ordering by firstTimestamp ascending
 *   AR-07  (5)  Empty state — traceIds=[]
 *   AR-08  (4)  Loading state
 *   AR-09  (5)  Empty trace — traceId with no logged messages
 *   AR-10  (5)  Multiple traces
 *   AR-11  (4)  Total message count aggregation across traces
 *   AR-12  (5)  SSR safety and edge cases
 *
 * All rendering via renderToString (SSR-compatible, no async).
 */

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';

import AgentRegistryPanel, {
  AGENT_REGISTRY_PANEL_VERSION,
  buildTraceSummary,
} from '../components/AgentRegistryPanel';
import type { AgentRegistryPanelProps } from '../components/AgentRegistryPanel';
import { AgentRegistry } from '../agents/AgentRegistry';
import type { AgentMessage } from '../agents/types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const TRACE_1 = 'aaaaaaaa-0000-0000-0000-000000000001';
const TRACE_2 = 'bbbbbbbb-0000-0000-0000-000000000002';
const TRACE_EMPTY = 'cccccccc-0000-0000-0000-000000000003'; // never logged

const T1 = 1_000; // earliest
const T2 = 2_000;
const T3 = 3_000; // latest

function makeMsg(traceId: string, overrides: Partial<AgentMessage> = {}): AgentMessage {
  return {
    traceId,
    from:      'user',
    to:        'planner',
    type:      'request',
    payload:   {},
    timestamp: T1,
    ...overrides,
  };
}

// base registry: TRACE_1 has 2 msgs (request+response); TRACE_2 has 1 msg (error)
const baseRegistry = new AgentRegistry();
baseRegistry.log(makeMsg(TRACE_1, { type: 'request',  from: 'user',    to: 'planner', timestamp: T1 }));
baseRegistry.log(makeMsg(TRACE_1, { type: 'response', from: 'planner', to: 'user',    timestamp: T2 }));
baseRegistry.log(makeMsg(TRACE_2, { type: 'error',    from: 'user',    to: 'risk',    timestamp: T3 }));

function render(
  registry: AgentRegistry,
  traceIds: string[],
  extra: Partial<AgentRegistryPanelProps> = {},
): string {
  return renderToString(
    React.createElement(AgentRegistryPanel, { registry, traceIds, ...extra }),
  );
}

// ─── AR-01: Module exports and constants ──────────────────────────────────────

describe('AR-01: module exports and constants', () => {
  it('AR-01-01: AgentRegistryPanel is a function', () => {
    expect(typeof AgentRegistryPanel).toBe('function');
  });

  it('AR-01-02: AGENT_REGISTRY_PANEL_VERSION is "8-L"', () => {
    expect(AGENT_REGISTRY_PANEL_VERSION).toBe('8-L');
  });

  it('AR-01-03: buildTraceSummary is a function', () => {
    expect(typeof buildTraceSummary).toBe('function');
  });

  it('AR-01-04: default render with empty traceIds returns non-empty HTML', () => {
    expect(render(baseRegistry, []).length).toBeGreaterThan(30);
  });

  it('AR-01-05: AgentRegistryPanelProps type is importable (structural)', () => {
    const props: AgentRegistryPanelProps = { registry: baseRegistry, traceIds: [] };
    expect(typeof props).toBe('object');
  });
});

// ─── AR-02: buildTraceSummary — pure function coverage ────────────────────────

describe('AR-02: buildTraceSummary', () => {
  it('AR-02-01: unknown traceId → messageCount=0, all type counts=0', () => {
    const s = buildTraceSummary(baseRegistry, TRACE_EMPTY);
    expect(s.messageCount).toBe(0);
    expect(s.requestCount).toBe(0);
    expect(s.errorCount).toBe(0);
  });

  it('AR-02-02: TRACE_1 → messageCount=2, requestCount=1, responseCount=1', () => {
    const s = buildTraceSummary(baseRegistry, TRACE_1);
    expect(s.messageCount).toBe(2);
    expect(s.requestCount).toBe(1);
    expect(s.responseCount).toBe(1);
  });

  it('AR-02-03: TRACE_2 → messageCount=1, errorCount=1', () => {
    const s = buildTraceSummary(baseRegistry, TRACE_2);
    expect(s.messageCount).toBe(1);
    expect(s.errorCount).toBe(1);
  });

  it('AR-02-04: TRACE_1 firstTimestamp = T1, lastTimestamp = T2', () => {
    const s = buildTraceSummary(baseRegistry, TRACE_1);
    expect(s.firstTimestamp).toBe(T1);
    expect(s.lastTimestamp).toBe(T2);
  });

  it('AR-02-05: empty trace → firstTimestamp=null, lastTimestamp=null', () => {
    const s = buildTraceSummary(baseRegistry, TRACE_EMPTY);
    expect(s.firstTimestamp).toBeNull();
    expect(s.lastTimestamp).toBeNull();
  });
});

// ─── AR-03: Root element structure — ready state ──────────────────────────────

describe('AR-03: root element structure — ready state', () => {
  it('AR-03-01: traceIds present → data-panel="agent-registry"', () => {
    expect(render(baseRegistry, [TRACE_1])).toContain('data-panel="agent-registry"');
  });

  it('AR-03-02: traceIds present → data-state="ready"', () => {
    expect(render(baseRegistry, [TRACE_1])).toContain('data-state="ready"');
  });

  it('AR-03-03: data-trace-count matches traceIds.length', () => {
    expect(render(baseRegistry, [TRACE_1, TRACE_2])).toContain('data-trace-count="2"');
  });

  it('AR-03-04: data-total-messages = sum of message counts', () => {
    // TRACE_1=2, TRACE_2=1 → total=3
    expect(render(baseRegistry, [TRACE_1, TRACE_2])).toContain('data-total-messages="3"');
  });

  it('AR-03-05: data-field="title" present', () => {
    expect(render(baseRegistry, [TRACE_1])).toContain('data-field="title"');
  });
});

// ─── AR-04: Trace list items and data attributes ──────────────────────────────

describe('AR-04: trace list items and data attributes', () => {
  it('AR-04-01: data-field="trace-list" on <ol>', () => {
    expect(render(baseRegistry, [TRACE_1])).toContain('data-field="trace-list"');
  });

  it('AR-04-02: <li> has data-trace-id with full traceId', () => {
    expect(render(baseRegistry, [TRACE_1])).toContain(`data-trace-id="${TRACE_1}"`);
  });

  it('AR-04-03: <li> has data-message-count', () => {
    expect(render(baseRegistry, [TRACE_1])).toContain('data-message-count="2"');
  });

  it('AR-04-04: <li> has data-request-count and data-response-count', () => {
    const html = render(baseRegistry, [TRACE_1]);
    expect(html).toContain('data-request-count="1"');
    expect(html).toContain('data-response-count="1"');
  });

  it('AR-04-05: <li> has data-event-count and data-error-count', () => {
    const html = render(baseRegistry, [TRACE_1]);
    expect(html).toContain('data-event-count="0"');
    expect(html).toContain('data-error-count="0"');
  });
});

// ─── AR-05: Error flag display ────────────────────────────────────────────────

describe('AR-05: error flag display', () => {
  it('AR-05-01: clean trace → no data-field="error-flag"', () => {
    expect(render(baseRegistry, [TRACE_1])).not.toContain('data-field="error-flag"');
  });

  it('AR-05-02: errored trace → data-field="error-flag" present', () => {
    expect(render(baseRegistry, [TRACE_2])).toContain('data-field="error-flag"');
  });

  it('AR-05-03: error flag shows [ERROR] text', () => {
    expect(render(baseRegistry, [TRACE_2])).toContain('[ERROR]');
  });

  it('AR-05-04: mixed traces — only errored trace shows error flag', () => {
    const html = render(baseRegistry, [TRACE_1, TRACE_2]);
    // TRACE_1 is clean so no [ERROR] for it, but TRACE_2 has one
    expect(html).toContain('data-field="error-flag"');
    // TRACE_1 section should not carry error-count > 0
    expect(html).toContain('data-error-count="1"');  // TRACE_2
    expect(html).toContain('data-error-count="0"');  // TRACE_1
  });
});

// ─── AR-06: Ordering by firstTimestamp ascending ──────────────────────────────

describe('AR-06: ordering by firstTimestamp', () => {
  it('AR-06-01: single trace renders as first item (data-trace-id present)', () => {
    const html = render(baseRegistry, [TRACE_1]);
    expect(html).toContain(`data-trace-id="${TRACE_1}"`);
  });

  it('AR-06-02: earlier trace appears before later trace in HTML', () => {
    // TRACE_1 firstTimestamp=T1=1000; TRACE_2 firstTimestamp=T3=3000
    const html = render(baseRegistry, [TRACE_1, TRACE_2]);
    const pos1 = html.indexOf(`data-trace-id="${TRACE_1}"`);
    const pos2 = html.indexOf(`data-trace-id="${TRACE_2}"`);
    expect(pos1).toBeLessThan(pos2);
  });

  it('AR-06-03: out-of-order input [TRACE_2, TRACE_1] → TRACE_1 still renders first', () => {
    const html = render(baseRegistry, [TRACE_2, TRACE_1]);
    const pos1 = html.indexOf(`data-trace-id="${TRACE_1}"`);
    const pos2 = html.indexOf(`data-trace-id="${TRACE_2}"`);
    expect(pos1).toBeLessThan(pos2);
  });

  it('AR-06-04: empty trace (null firstTimestamp) sorts after traces with messages', () => {
    // TRACE_EMPTY has no messages; TRACE_1 has firstTimestamp=T1
    const html = render(baseRegistry, [TRACE_EMPTY, TRACE_1]);
    const posTrace1 = html.indexOf(`data-trace-id="${TRACE_1}"`);
    const posEmpty  = html.indexOf(`data-trace-id="${TRACE_EMPTY}"`);
    expect(posTrace1).toBeLessThan(posEmpty);
  });
});

// ─── AR-07: Empty state (traceIds=[]) ────────────────────────────────────────

describe('AR-07: empty state — traceIds=[]', () => {
  it('AR-07-01: traceIds=[] → data-state="empty"', () => {
    expect(render(baseRegistry, [])).toContain('data-state="empty"');
  });

  it('AR-07-02: data-trace-count="0"', () => {
    expect(render(baseRegistry, [])).toContain('data-trace-count="0"');
  });

  it('AR-07-03: data-total-messages="0"', () => {
    expect(render(baseRegistry, [])).toContain('data-total-messages="0"');
  });

  it('AR-07-04: no data-field="trace-list"', () => {
    expect(render(baseRegistry, [])).not.toContain('data-field="trace-list"');
  });

  it('AR-07-05: fallback message text present', () => {
    expect(render(baseRegistry, [])).toContain('Chưa có trace nào');
  });
});

// ─── AR-08: Loading state ─────────────────────────────────────────────────────

describe('AR-08: loading state', () => {
  it('AR-08-01: loading=true → data-state="loading"', () => {
    expect(render(baseRegistry, [TRACE_1], { loading: true })).toContain('data-state="loading"');
  });

  it('AR-08-02: loading=true → loading message text present', () => {
    expect(render(baseRegistry, [TRACE_1], { loading: true })).toContain('registry');
  });

  it('AR-08-03: loading=true → no data-trace-count attribute', () => {
    expect(render(baseRegistry, [TRACE_1], { loading: true })).not.toContain('data-trace-count');
  });

  it('AR-08-04: loading=false (default) → data-state="ready" when traceIds given', () => {
    expect(render(baseRegistry, [TRACE_1], { loading: false })).toContain('data-state="ready"');
  });
});

// ─── AR-09: Empty trace (traceId with no logged messages) ────────────────────

describe('AR-09: empty trace — traceId with no messages', () => {
  it('AR-09-01: unknown traceId → data-message-count="0" on that item', () => {
    const html = render(baseRegistry, [TRACE_EMPTY]);
    expect(html).toContain('data-message-count="0"');
  });

  it('AR-09-02: all type counts are 0 for empty trace', () => {
    const html = render(baseRegistry, [TRACE_EMPTY]);
    expect(html).toContain('data-request-count="0"');
    expect(html).toContain('data-error-count="0"');
  });

  it('AR-09-03: no data-field="first-timestamp" span for empty trace', () => {
    expect(render(baseRegistry, [TRACE_EMPTY])).not.toContain('data-field="first-timestamp"');
  });

  it('AR-09-04: no error flag for empty trace', () => {
    expect(render(baseRegistry, [TRACE_EMPTY])).not.toContain('data-field="error-flag"');
  });

  it('AR-09-05: empty trace item is still rendered in the trace list', () => {
    const html = render(baseRegistry, [TRACE_EMPTY]);
    expect(html).toContain(`data-trace-id="${TRACE_EMPTY}"`);
    expect(html).toContain('data-field="trace-list"');
  });
});

// ─── AR-10: Multiple traces ───────────────────────────────────────────────────

describe('AR-10: multiple traces', () => {
  it('AR-10-01: two traceIds → data-trace-count="2"', () => {
    expect(render(baseRegistry, [TRACE_1, TRACE_2])).toContain('data-trace-count="2"');
  });

  it('AR-10-02: each trace has its own distinct data-trace-id in output', () => {
    const html = render(baseRegistry, [TRACE_1, TRACE_2]);
    expect(html).toContain(`data-trace-id="${TRACE_1}"`);
    expect(html).toContain(`data-trace-id="${TRACE_2}"`);
  });

  it('AR-10-03: data-total-messages = sum across traces (2+1=3)', () => {
    expect(render(baseRegistry, [TRACE_1, TRACE_2])).toContain('data-total-messages="3"');
  });

  it('AR-10-04: TRACE_2 has data-error-count="1", TRACE_1 has data-error-count="0"', () => {
    const html = render(baseRegistry, [TRACE_1, TRACE_2]);
    expect(html).toContain('data-error-count="1"');
    expect(html).toContain('data-error-count="0"');
  });

  it('AR-10-05: type-breakdown text present for each trace', () => {
    const html = render(baseRegistry, [TRACE_1, TRACE_2]);
    expect(html).toContain('data-field="type-breakdown"');
  });
});

// ─── AR-11: Total message count aggregation ───────────────────────────────────

describe('AR-11: total message count aggregation', () => {
  it('AR-11-01: single trace with 2 messages → data-total-messages="2"', () => {
    expect(render(baseRegistry, [TRACE_1])).toContain('data-total-messages="2"');
  });

  it('AR-11-02: two traces (2+1) → data-total-messages="3"', () => {
    expect(render(baseRegistry, [TRACE_1, TRACE_2])).toContain('data-total-messages="3"');
  });

  it('AR-11-03: all empty traces → data-total-messages="0"', () => {
    const emptyReg = new AgentRegistry();
    expect(render(emptyReg, [TRACE_EMPTY])).toContain('data-total-messages="0"');
  });

  it('AR-11-04: error messages count toward total (TRACE_2 has 1 error → total includes it)', () => {
    const s = buildTraceSummary(baseRegistry, TRACE_2);
    expect(s.messageCount).toBe(1);
    expect(s.errorCount).toBe(1);
    // messageCount includes all types
    expect(s.requestCount + s.responseCount + s.eventCount + s.errorCount).toBe(s.messageCount);
  });
});

// ─── AR-12: SSR safety and edge cases ────────────────────────────────────────

describe('AR-12: SSR safety and edge cases', () => {
  it('AR-12-01: renderToString with valid registry and traceIds does not throw', () => {
    expect(() => render(baseRegistry, [TRACE_1, TRACE_2])).not.toThrow();
  });

  it('AR-12-02: renderToString with empty traceIds does not throw', () => {
    expect(() => render(baseRegistry, [])).not.toThrow();
  });

  it('AR-12-03: null registry (defensive) does not throw', () => {
    expect(() =>
      render(null as unknown as AgentRegistry, [TRACE_1])
    ).not.toThrow();
  });

  it('AR-12-04: traceId display truncated to 8 chars + "…"', () => {
    const html = render(baseRegistry, [TRACE_1]);
    // TRACE_1 starts with 'aaaaaaaa'; display should show 'aaaaaaaa…'
    expect(html).toContain('aaaaaaaa…');
  });

  it('AR-12-05: HTML chars in traceId escaped in output', () => {
    const xssReg = new AgentRegistry();
    const xssId  = '<script>xss</script>';
    xssReg.log(makeMsg(xssId, { traceId: xssId }));
    const html = render(xssReg, [xssId]);
    expect(html).not.toContain('<script>xss');
  });
});
