/**
 * 8-K: AgentTracePanel — 56 tests
 *
 * Groups:
 *   TR-01  (5)  Module exports and constants
 *   TR-02  (5)  Root element structure — ready state
 *   TR-03  (5)  Message list and item data attributes
 *   TR-04  (5)  formatTimestamp — UTC HH:MM:SS.mmm conversion
 *   TR-05  (4)  Message type display [REQUEST] / [RESPONSE] / [EVENT] / [ERROR]
 *   TR-06  (4)  From/To routing display and attributes
 *   TR-07  (5)  Sort ordering by timestamp ascending (stable)
 *   TR-08  (4)  Loading state
 *   TR-09  (5)  Empty trace fallback
 *   TR-10  (5)  Legal basis display
 *   TR-11  (4)  TraceId header display and data attribute
 *   TR-12  (5)  SSR safety and formatPayload
 *
 * All rendering via renderToString (SSR-compatible, no async).
 */

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';

import AgentTracePanel, {
  AGENT_TRACE_VERSION,
  formatTimestamp,
  formatPayload,
} from '../components/AgentTracePanel';
import type { AgentTracePanelProps } from '../components/AgentTracePanel';
import type { AgentMessage } from '../agents/types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const TRACE_ID = '11111111-2222-3333-4444-555555555555';
const T1 = 1_000;   // 00:00:01.000
const T2 = 2_000;   // 00:00:02.000
const T3 = 3_000;   // 00:00:03.000

function makeMsg(overrides: Partial<AgentMessage> = {}): AgentMessage {
  return {
    traceId:   TRACE_ID,
    from:      'user',
    to:        'planner',
    type:      'request',
    payload:   { goal: 'test' },
    timestamp: T1,
    ...overrides,
  };
}

function render(messages: AgentMessage[] = [], extra: Partial<AgentTracePanelProps> = {}): string {
  return renderToString(React.createElement(AgentTracePanel, { messages, ...extra }));
}

// ─── TR-01: Module exports and constants ──────────────────────────────────────

describe('TR-01: module exports and constants', () => {
  it('TR-01-01: AgentTracePanel is a function', () => {
    expect(typeof AgentTracePanel).toBe('function');
  });

  it('TR-01-02: AGENT_TRACE_VERSION is "8-K"', () => {
    expect(AGENT_TRACE_VERSION).toBe('8-K');
  });

  it('TR-01-03: formatTimestamp is a function', () => {
    expect(typeof formatTimestamp).toBe('function');
  });

  it('TR-01-04: formatPayload is a function', () => {
    expect(typeof formatPayload).toBe('function');
  });

  it('TR-01-05: default render (no messages) returns non-empty HTML', () => {
    expect(render().length).toBeGreaterThan(50);
  });
});

// ─── TR-02: Root element structure — ready state ──────────────────────────────

describe('TR-02: root element structure — ready state', () => {
  it('TR-02-01: messages present → data-panel="agent-trace"', () => {
    expect(render([makeMsg()])).toContain('data-panel="agent-trace"');
  });

  it('TR-02-02: messages present → data-state="ready"', () => {
    expect(render([makeMsg()])).toContain('data-state="ready"');
  });

  it('TR-02-03: data-message-count reflects messages.length', () => {
    const html = render([makeMsg(), makeMsg({ timestamp: T2 })]);
    expect(html).toContain('data-message-count="2"');
  });

  it('TR-02-04: data-field="title" present', () => {
    expect(render([makeMsg()])).toContain('data-field="title"');
  });

  it('TR-02-05: data-field="message-list" on <ol>', () => {
    expect(render([makeMsg()])).toContain('data-field="message-list"');
  });
});

// ─── TR-03: Message list and item data attributes ─────────────────────────────

describe('TR-03: message list and item data attributes', () => {
  it('TR-03-01: single message → data-trace-message="1"', () => {
    expect(render([makeMsg()])).toContain('data-trace-message="1"');
  });

  it('TR-03-02: data-type matches msg.type', () => {
    expect(render([makeMsg({ type: 'request' })])).toContain('data-type="request"');
  });

  it('TR-03-03: data-from matches msg.from', () => {
    expect(render([makeMsg({ from: 'user' })])).toContain('data-from="user"');
  });

  it('TR-03-04: data-to matches msg.to', () => {
    expect(render([makeMsg({ to: 'planner' })])).toContain('data-to="planner"');
  });

  it('TR-03-05: data-timestamp matches msg.timestamp', () => {
    expect(render([makeMsg({ timestamp: T1 })])).toContain(`data-timestamp="${T1}"`);
  });
});

// ─── TR-04: formatTimestamp — UTC HH:MM:SS.mmm conversion ────────────────────

describe('TR-04: formatTimestamp — UTC conversion', () => {
  it('TR-04-01: formatTimestamp(0) → "00:00:00.000"', () => {
    expect(formatTimestamp(0)).toBe('00:00:00.000');
  });

  it('TR-04-02: formatTimestamp(1000) → "00:00:01.000"', () => {
    expect(formatTimestamp(1_000)).toBe('00:00:01.000');
  });

  it('TR-04-03: formatTimestamp of known UTC datetime → correct HH:MM:SS.mmm', () => {
    const ts = Date.UTC(2026, 0, 1, 8, 30, 45, 123); // 2026-01-01T08:30:45.123Z
    expect(formatTimestamp(ts)).toBe('08:30:45.123');
  });

  it('TR-04-04: formatted timestamp visible in data-field="timestamp"', () => {
    const html = render([makeMsg({ timestamp: 1_000 })]);
    expect(html).toContain('data-field="timestamp"');
    expect(html).toContain('00:00:01.000');
  });

  it('TR-04-05: formatTimestamp(59999) → "00:00:59.999"', () => {
    expect(formatTimestamp(59_999)).toBe('00:00:59.999');
  });
});

// ─── TR-05: Message type display ──────────────────────────────────────────────

describe('TR-05: message type display', () => {
  it('TR-05-01: type="request" → [REQUEST] in output', () => {
    expect(render([makeMsg({ type: 'request' })])).toContain('[REQUEST]');
  });

  it('TR-05-02: type="response" → [RESPONSE] in output', () => {
    expect(render([makeMsg({ type: 'response' })])).toContain('[RESPONSE]');
  });

  it('TR-05-03: type="event" → [EVENT] in output', () => {
    expect(render([makeMsg({ type: 'event' })])).toContain('[EVENT]');
  });

  it('TR-05-04: type="error" → [ERROR] in output', () => {
    expect(render([makeMsg({ type: 'error' })])).toContain('[ERROR]');
  });
});

// ─── TR-06: From/To routing display and attributes ───────────────────────────

describe('TR-06: from/to routing display', () => {
  it('TR-06-01: from="user" to="planner" → "user → planner" in text', () => {
    const html = render([makeMsg({ from: 'user', to: 'planner' })]);
    expect(html).toContain('user → planner');
  });

  it('TR-06-02: from="planner" to="user" → "planner → user" in text', () => {
    const html = render([makeMsg({ from: 'planner', to: 'user' })]);
    expect(html).toContain('planner → user');
  });

  it('TR-06-03: to="broadcast" → text includes "broadcast"', () => {
    const html = render([makeMsg({ to: 'broadcast' })]);
    expect(html).toContain('broadcast');
  });

  it('TR-06-04: both data-from and data-to attributes present on <li>', () => {
    const html = render([makeMsg({ from: 'risk', to: 'user' })]);
    expect(html).toContain('data-from="risk"');
    expect(html).toContain('data-to="user"');
  });
});

// ─── TR-07: Sort ordering by timestamp ascending ──────────────────────────────

describe('TR-07: sort ordering by timestamp ascending', () => {
  it('TR-07-01: single message → data-trace-message="1"', () => {
    expect(render([makeMsg({ timestamp: T2 })])).toContain('data-trace-message="1"');
  });

  it('TR-07-02: two messages in order → earlier timestamp gets position 1', () => {
    const html = render([makeMsg({ timestamp: T1 }), makeMsg({ timestamp: T2 })]);
    const pos1 = html.indexOf(`data-timestamp="${T1}"`);
    const pos2 = html.indexOf(`data-timestamp="${T2}"`);
    expect(pos1).toBeLessThan(pos2);
  });

  it('TR-07-03: out-of-order input → sorted ascending by timestamp', () => {
    const msgs = [
      makeMsg({ timestamp: T3 }),
      makeMsg({ timestamp: T1 }),
      makeMsg({ timestamp: T2 }),
    ];
    const html = render(msgs);
    const pos1 = html.indexOf(`data-timestamp="${T1}"`);
    const pos2 = html.indexOf(`data-timestamp="${T2}"`);
    const pos3 = html.indexOf(`data-timestamp="${T3}"`);
    expect(pos1).toBeLessThan(pos2);
    expect(pos2).toBeLessThan(pos3);
  });

  it('TR-07-04: three messages → data-trace-message="1", "2", "3" all present', () => {
    const msgs = [makeMsg({ timestamp: T1 }), makeMsg({ timestamp: T2 }), makeMsg({ timestamp: T3 })];
    const html = render(msgs);
    expect(html).toContain('data-trace-message="1"');
    expect(html).toContain('data-trace-message="2"');
    expect(html).toContain('data-trace-message="3"');
  });

  it('TR-07-05: equal timestamps → original array order preserved (stable sort)', () => {
    const msgs = [
      makeMsg({ timestamp: T1, from: 'user',    to: 'planner' }),
      makeMsg({ timestamp: T1, from: 'planner', to: 'user'    }),
    ];
    const html = render(msgs);
    const pos1 = html.indexOf('user → planner');
    const pos2 = html.indexOf('planner → user');
    expect(pos1).toBeLessThan(pos2);
  });
});

// ─── TR-08: Loading state ─────────────────────────────────────────────────────

describe('TR-08: loading state', () => {
  it('TR-08-01: loading=true → data-state="loading"', () => {
    expect(render([], { loading: true })).toContain('data-state="loading"');
  });

  it('TR-08-02: loading=true → loading message text present', () => {
    expect(render([], { loading: true })).toContain('nhật ký kiểm toán');
  });

  it('TR-08-03: loading=true → no data-message-count attribute', () => {
    expect(render([], { loading: true })).not.toContain('data-message-count');
  });

  it('TR-08-04: loading=false (default) → data-state="empty" when no messages', () => {
    expect(render([], { loading: false })).toContain('data-state="empty"');
  });
});

// ─── TR-09: Empty trace fallback ──────────────────────────────────────────────

describe('TR-09: empty trace fallback', () => {
  it('TR-09-01: messages=[] → data-state="empty"', () => {
    expect(render([])).toContain('data-state="empty"');
  });

  it('TR-09-02: messages=[] → data-message-count="0"', () => {
    expect(render([])).toContain('data-message-count="0"');
  });

  it('TR-09-03: messages=[] → fallback text present', () => {
    expect(render([])).toContain('Chưa có thông điệp nào');
  });

  it('TR-09-04: messages=[] → no data-field="message-list"', () => {
    expect(render([])).not.toContain('data-field="message-list"');
  });

  it('TR-09-05: messages=[] with traceId → data-field="trace-id" still shown', () => {
    const html = render([], { traceId: TRACE_ID });
    expect(html).toContain('data-field="trace-id"');
    expect(html).toContain('data-state="empty"');
  });
});

// ─── TR-10: Legal basis display ───────────────────────────────────────────────

describe('TR-10: legal basis display', () => {
  it('TR-10-01: msg without legalBasis → no data-field="legal-basis"', () => {
    const html = render([makeMsg()]);
    expect(html).not.toContain('data-field="legal-basis"');
  });

  it('TR-10-02: msg with legalBasis=[] → no data-field="legal-basis"', () => {
    const html = render([makeMsg({ legalBasis: [] })]);
    expect(html).not.toContain('data-field="legal-basis"');
  });

  it('TR-10-03: msg with legalBasis=["Điều 44..."] → data-field="legal-basis" present', () => {
    const html = render([makeMsg({ legalBasis: ['Điều 44 khoản 7 Luật Đấu thầu 22/2023/QH15'] })]);
    expect(html).toContain('data-field="legal-basis"');
  });

  it('TR-10-04: legal citation text visible', () => {
    const citation = 'Điều 44 khoản 7 Luật Đấu thầu 22/2023/QH15';
    const html = render([makeMsg({ legalBasis: [citation] })]);
    expect(html).toContain(citation);
  });

  it('TR-10-05: two citations → two data-legal-ref items', () => {
    const html = render([makeMsg({
      legalBasis: [
        'Điều 44 khoản 7 Luật Đấu thầu 22/2023/QH15',
        'Điều 62 Luật Đấu thầu 22/2023/QH15',
      ],
    })]);
    expect(html).toContain('data-legal-ref="0"');
    expect(html).toContain('data-legal-ref="1"');
  });
});

// ─── TR-11: TraceId header display and data attribute ─────────────────────────

describe('TR-11: traceId header', () => {
  it('TR-11-01: no traceId prop → no data-field="trace-id"', () => {
    expect(render([makeMsg()])).not.toContain('data-field="trace-id"');
  });

  it('TR-11-02: traceId provided → data-field="trace-id" present', () => {
    expect(render([makeMsg()], { traceId: TRACE_ID })).toContain('data-field="trace-id"');
  });

  it('TR-11-03: traceId display text truncated to 8 chars + "…"', () => {
    const html = render([makeMsg()], { traceId: TRACE_ID });
    expect(html).toContain('TraceID: 11111111…');
  });

  it('TR-11-04: data-trace-id attribute holds the full traceId', () => {
    const html = render([makeMsg()], { traceId: TRACE_ID });
    expect(html).toContain(`data-trace-id="${TRACE_ID}"`);
  });
});

// ─── TR-12: SSR safety and formatPayload ─────────────────────────────────────

describe('TR-12: SSR safety and formatPayload', () => {
  it('TR-12-01: renderToString with many messages does not throw', () => {
    const msgs = Array.from({ length: 20 }, (_, i) =>
      makeMsg({ timestamp: i * 100, payload: { step: i } }),
    );
    expect(() => render(msgs)).not.toThrow();
  });

  it('TR-12-02: formatPayload with string payload → returns JSON-quoted string', () => {
    const result = formatPayload('hello');
    expect(result).toBe('"hello"');
  });

  it('TR-12-03: formatPayload with object longer than 120 chars → truncated with "…"', () => {
    const longPayload = { message: 'A'.repeat(150) };
    const result = formatPayload(longPayload);
    expect(result.endsWith('…')).toBe(true);
    expect(result.length).toBeLessThanOrEqual(120);
  });

  it('TR-12-04: formatPayload(null) → "null" (does not throw)', () => {
    const result = formatPayload(null);
    expect(typeof result).toBe('string');
    expect(result).toBe('null');
  });

  it('TR-12-05: XSS — <script> in payload is HTML-escaped in SSR output', () => {
    const html = render([makeMsg({ payload: '<script>alert(1)</script>' })]);
    expect(html).not.toContain('<script>alert');
  });
});
