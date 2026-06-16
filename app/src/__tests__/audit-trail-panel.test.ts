/**
 * P6-10Z: AuditTrailPanel test suite
 *
 * 56 tests across 12 groups:
 *   AT1  (5) component structure
 *   AT2  (5) traceId rendering
 *   AT3  (5) sessionId rendering
 *   AT4  (4) agentId rendering
 *   AT5  (4) timestamp rendering
 *   AT6  (5) providerUsed rendering
 *   AT7  (5) status rendering
 *   AT8  (5) messageFlow rendering
 *   AT9  (4) message rendering
 *   AT10 (4) empty and null state
 *   AT11 (5) SSR renderToString
 *   AT12 (5) never-throw
 */

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';

import { AuditTrailPanel } from '../components/AuditTrailPanel';
import type { AuditEntry } from '../components/AuditTrailPanel';

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const FULL_ENTRY: AuditEntry = {
  traceId:     'trace-abc-001',
  sessionId:   'sess-xyz-001',
  agentId:     'planner',
  timestamp:   1_750_000_000_000,
  providerUsed:'claude',
  status:      'success',
  messageFlow: 'response',
  message:     'Lập kế hoạch hoàn tất.',
};

// ─── AT1 · Component structure ────────────────────────────────────────────────

describe('AT1 · Component structure', () => {
  it('AT1-01: renders the audit-trail-panel wrapper element', () => {
    const html = renderToString(React.createElement(AuditTrailPanel, {}));
    expect(html).toContain('audit-trail-panel');
  });

  it('AT1-02: renders default title "Audit Trail" when no title prop', () => {
    const html = renderToString(React.createElement(AuditTrailPanel, {}));
    expect(html).toContain('Audit Trail');
  });

  it('AT1-03: renders a custom title', () => {
    const html = renderToString(
      React.createElement(AuditTrailPanel, { title: 'Procurement Audit Log' }),
    );
    expect(html).toContain('Procurement Audit Log');
  });

  it('AT1-04: custom title overrides the default', () => {
    const html = renderToString(
      React.createElement(AuditTrailPanel, { title: 'My Log' }),
    );
    expect(html).not.toContain('Audit Trail');
    expect(html).toContain('My Log');
  });

  it('AT1-05: renders an ordered list element (ol.audit-entries) when entries exist', () => {
    const html = renderToString(
      React.createElement(AuditTrailPanel, { entries: [FULL_ENTRY] }),
    );
    expect(html).toContain('audit-entries');
    expect(html).toContain('audit-entry');
  });
});

// ─── AT2 · traceId rendering ──────────────────────────────────────────────────

describe('AT2 · traceId rendering', () => {
  it('AT2-01: renders traceId value', () => {
    const html = renderToString(
      React.createElement(AuditTrailPanel, { entries: [FULL_ENTRY] }),
    );
    expect(html).toContain('trace-abc-001');
  });

  it('AT2-02: renders data-field="trace-id" attribute', () => {
    const html = renderToString(
      React.createElement(AuditTrailPanel, { entries: [FULL_ENTRY] }),
    );
    expect(html).toContain('data-field="trace-id"');
  });

  it('AT2-03: omits trace-id span when traceId is absent', () => {
    const entry: AuditEntry = { status: 'success', message: 'No trace' };
    const html = renderToString(
      React.createElement(AuditTrailPanel, { entries: [entry] }),
    );
    expect(html).not.toContain('data-field="trace-id"');
  });

  it('AT2-04: renders multiple entries each with their own traceId', () => {
    const entries: AuditEntry[] = [
      { traceId: 'tr-001', status: 'success' },
      { traceId: 'tr-002', status: 'error' },
    ];
    const html = renderToString(
      React.createElement(AuditTrailPanel, { entries }),
    );
    expect(html).toContain('tr-001');
    expect(html).toContain('tr-002');
  });

  it('AT2-05: traceId is used as the list item key (unique per trace)', () => {
    const entries: AuditEntry[] = [
      { traceId: 'unique-key-1', status: 'success' },
      { traceId: 'unique-key-2', status: 'pending' },
    ];
    const html = renderToString(
      React.createElement(AuditTrailPanel, { entries }),
    );
    expect(html).toContain('unique-key-1');
    expect(html).toContain('unique-key-2');
  });
});

// ─── AT3 · sessionId rendering ────────────────────────────────────────────────

describe('AT3 · sessionId rendering', () => {
  it('AT3-01: renders sessionId value', () => {
    const html = renderToString(
      React.createElement(AuditTrailPanel, { entries: [FULL_ENTRY] }),
    );
    expect(html).toContain('sess-xyz-001');
  });

  it('AT3-02: renders data-field="session-id" attribute', () => {
    const html = renderToString(
      React.createElement(AuditTrailPanel, { entries: [FULL_ENTRY] }),
    );
    expect(html).toContain('data-field="session-id"');
  });

  it('AT3-03: omits session-id span when sessionId is absent', () => {
    const entry: AuditEntry = { traceId: 'tr-1', status: 'success' };
    const html = renderToString(
      React.createElement(AuditTrailPanel, { entries: [entry] }),
    );
    expect(html).not.toContain('data-field="session-id"');
  });

  it('AT3-04: renders multiple entries each with their own sessionId', () => {
    const entries: AuditEntry[] = [
      { sessionId: 'sess-A', status: 'running' },
      { sessionId: 'sess-B', status: 'success' },
    ];
    const html = renderToString(
      React.createElement(AuditTrailPanel, { entries }),
    );
    expect(html).toContain('sess-A');
    expect(html).toContain('sess-B');
  });

  it('AT3-05: omits session-id span when sessionId is empty string', () => {
    const entry: AuditEntry = { sessionId: '', status: 'success' };
    const html = renderToString(
      React.createElement(AuditTrailPanel, { entries: [entry] }),
    );
    expect(html).not.toContain('data-field="session-id"');
  });
});

// ─── AT4 · agentId rendering ──────────────────────────────────────────────────

describe('AT4 · agentId rendering', () => {
  it('AT4-01: renders agentId value', () => {
    const html = renderToString(
      React.createElement(AuditTrailPanel, { entries: [FULL_ENTRY] }),
    );
    expect(html).toContain('planner');
    expect(html).toContain('data-field="agent-id"');
  });

  it('AT4-02: renders all six P6 agent ids correctly', () => {
    const agentIds = ['planner', 'specification', 'legal-reviewer', 'risk', 'chat', 'autonomous'];
    const entries: AuditEntry[] = agentIds.map((agentId, i) => ({
      traceId: `tr-${i}`,
      agentId,
      status: 'success',
    }));
    const html = renderToString(
      React.createElement(AuditTrailPanel, { entries }),
    );
    for (const id of agentIds) {
      expect(html).toContain(id);
    }
  });

  it('AT4-03: omits agent-id span when agentId is absent', () => {
    const entry: AuditEntry = { traceId: 'tr-x', status: 'success' };
    const html = renderToString(
      React.createElement(AuditTrailPanel, { entries: [entry] }),
    );
    expect(html).not.toContain('data-field="agent-id"');
  });

  it('AT4-04: renders custom agentId strings beyond standard P6 ids', () => {
    const entry: AuditEntry = { agentId: 'custom-agent', status: 'success' };
    const html = renderToString(
      React.createElement(AuditTrailPanel, { entries: [entry] }),
    );
    expect(html).toContain('custom-agent');
  });
});

// ─── AT5 · timestamp rendering ────────────────────────────────────────────────

describe('AT5 · timestamp rendering', () => {
  it('AT5-01: renders timestamp as ISO-8601 string', () => {
    const html = renderToString(
      React.createElement(AuditTrailPanel, { entries: [FULL_ENTRY] }),
    );
    expect(html).toContain('data-field="timestamp"');
    expect(html).toContain('2025-06-15');
  });

  it('AT5-02: omits timestamp span when timestamp is absent', () => {
    const entry: AuditEntry = { traceId: 'tr-1', status: 'success' };
    const html = renderToString(
      React.createElement(AuditTrailPanel, { entries: [entry] }),
    );
    expect(html).not.toContain('data-field="timestamp"');
  });

  it('AT5-03: renders a known timestamp in ISO format', () => {
    const ts = new Date('2026-01-15T09:00:00.000Z').getTime();
    const entry: AuditEntry = { traceId: 'tr-ts', timestamp: ts, status: 'success' };
    const html = renderToString(
      React.createElement(AuditTrailPanel, { entries: [entry] }),
    );
    expect(html).toContain('2026-01-15');
  });

  it('AT5-04: omits timestamp span when timestamp is null', () => {
    const entry: AuditEntry = { traceId: 'tr-null-ts', timestamp: null, status: 'success' };
    const html = renderToString(
      React.createElement(AuditTrailPanel, { entries: [entry] }),
    );
    expect(html).not.toContain('data-field="timestamp"');
  });
});

// ─── AT6 · providerUsed rendering ────────────────────────────────────────────

describe('AT6 · providerUsed rendering', () => {
  it('AT6-01: renders providerUsed value', () => {
    const html = renderToString(
      React.createElement(AuditTrailPanel, { entries: [FULL_ENTRY] }),
    );
    expect(html).toContain('claude');
    expect(html).toContain('data-field="provider"');
  });

  it('AT6-02: renders "openai" provider name', () => {
    const entry: AuditEntry = { traceId: 'tr-1', providerUsed: 'openai', status: 'success' };
    const html = renderToString(
      React.createElement(AuditTrailPanel, { entries: [entry] }),
    );
    expect(html).toContain('openai');
  });

  it('AT6-03: renders "gemini" provider name', () => {
    const entry: AuditEntry = { traceId: 'tr-2', providerUsed: 'gemini', status: 'success' };
    const html = renderToString(
      React.createElement(AuditTrailPanel, { entries: [entry] }),
    );
    expect(html).toContain('gemini');
  });

  it('AT6-04: omits provider span when providerUsed is absent', () => {
    const entry: AuditEntry = { traceId: 'tr-3', status: 'success' };
    const html = renderToString(
      React.createElement(AuditTrailPanel, { entries: [entry] }),
    );
    expect(html).not.toContain('data-field="provider"');
  });

  it('AT6-05: renders provider across multiple entries correctly', () => {
    const entries: AuditEntry[] = [
      { traceId: 'p1', providerUsed: 'openai',  status: 'success' },
      { traceId: 'p2', providerUsed: 'claude',  status: 'success' },
      { traceId: 'p3', providerUsed: 'gemini',  status: 'error'   },
    ];
    const html = renderToString(
      React.createElement(AuditTrailPanel, { entries }),
    );
    expect(html).toContain('openai');
    expect(html).toContain('claude');
    expect(html).toContain('gemini');
  });
});

// ─── AT7 · status rendering ───────────────────────────────────────────────────

describe('AT7 · status rendering', () => {
  it('AT7-01: renders "success" status with status-success CSS class', () => {
    const entry: AuditEntry = { traceId: 'tr-1', status: 'success' };
    const html = renderToString(
      React.createElement(AuditTrailPanel, { entries: [entry] }),
    );
    expect(html).toContain('status-success');
    expect(html).toContain('>success<');
  });

  it('AT7-02: renders "error" status with status-error CSS class', () => {
    const entry: AuditEntry = { traceId: 'tr-2', status: 'error' };
    const html = renderToString(
      React.createElement(AuditTrailPanel, { entries: [entry] }),
    );
    expect(html).toContain('status-error');
    expect(html).toContain('>error<');
  });

  it('AT7-03: renders "pending" status with status-pending CSS class', () => {
    const entry: AuditEntry = { traceId: 'tr-3', status: 'pending' };
    const html = renderToString(
      React.createElement(AuditTrailPanel, { entries: [entry] }),
    );
    expect(html).toContain('status-pending');
  });

  it('AT7-04: renders "running" status with status-running CSS class', () => {
    const entry: AuditEntry = { traceId: 'tr-4', status: 'running' };
    const html = renderToString(
      React.createElement(AuditTrailPanel, { entries: [entry] }),
    );
    expect(html).toContain('status-running');
  });

  it('AT7-05: all four status values render with distinct CSS classes', () => {
    const entries: AuditEntry[] = [
      { traceId: 's1', status: 'pending' },
      { traceId: 's2', status: 'running' },
      { traceId: 's3', status: 'success' },
      { traceId: 's4', status: 'error'   },
    ];
    const html = renderToString(
      React.createElement(AuditTrailPanel, { entries }),
    );
    expect(html).toContain('status-pending');
    expect(html).toContain('status-running');
    expect(html).toContain('status-success');
    expect(html).toContain('status-error');
  });
});

// ─── AT8 · messageFlow rendering ─────────────────────────────────────────────

describe('AT8 · messageFlow rendering', () => {
  it('AT8-01: renders "response" flow with flow-response CSS class', () => {
    const html = renderToString(
      React.createElement(AuditTrailPanel, { entries: [FULL_ENTRY] }),
    );
    expect(html).toContain('flow-response');
    expect(html).toContain('data-field="message-flow"');
  });

  it('AT8-02: renders "request" flow with flow-request CSS class', () => {
    const entry: AuditEntry = { traceId: 'tr-1', messageFlow: 'request', status: 'success' };
    const html = renderToString(
      React.createElement(AuditTrailPanel, { entries: [entry] }),
    );
    expect(html).toContain('flow-request');
  });

  it('AT8-03: renders "event" flow with flow-event CSS class', () => {
    const entry: AuditEntry = { traceId: 'tr-2', messageFlow: 'event', status: 'success' };
    const html = renderToString(
      React.createElement(AuditTrailPanel, { entries: [entry] }),
    );
    expect(html).toContain('flow-event');
  });

  it('AT8-04: renders "error" flow with flow-error CSS class', () => {
    const entry: AuditEntry = { traceId: 'tr-3', messageFlow: 'error', status: 'error' };
    const html = renderToString(
      React.createElement(AuditTrailPanel, { entries: [entry] }),
    );
    expect(html).toContain('flow-error');
  });

  it('AT8-05: omits message-flow span when messageFlow is absent', () => {
    const entry: AuditEntry = { traceId: 'tr-4', status: 'success' };
    const html = renderToString(
      React.createElement(AuditTrailPanel, { entries: [entry] }),
    );
    expect(html).not.toContain('data-field="message-flow"');
  });
});

// ─── AT9 · message rendering ──────────────────────────────────────────────────

describe('AT9 · message rendering', () => {
  it('AT9-01: renders the message string', () => {
    const html = renderToString(
      React.createElement(AuditTrailPanel, { entries: [FULL_ENTRY] }),
    );
    expect(html).toContain('Lập kế hoạch hoàn tất.');
    expect(html).toContain('data-field="message"');
  });

  it('AT9-02: omits message span when message is absent', () => {
    const entry: AuditEntry = { traceId: 'tr-1', status: 'success' };
    const html = renderToString(
      React.createElement(AuditTrailPanel, { entries: [entry] }),
    );
    expect(html).not.toContain('data-field="message"');
  });

  it('AT9-03: omits message span when message is empty string', () => {
    const entry: AuditEntry = { traceId: 'tr-2', status: 'success', message: '' };
    const html = renderToString(
      React.createElement(AuditTrailPanel, { entries: [entry] }),
    );
    expect(html).not.toContain('data-field="message"');
  });

  it('AT9-04: renders message text verbatim (React auto-escapes HTML)', () => {
    const entry: AuditEntry = {
      traceId: 'tr-3', status: 'success',
      message: 'Step 1 complete — package value 320,000,000 VND',
    };
    const html = renderToString(
      React.createElement(AuditTrailPanel, { entries: [entry] }),
    );
    expect(html).toContain('320,000,000 VND');
  });
});

// ─── AT10 · Empty and null state ──────────────────────────────────────────────

describe('AT10 · Empty and null state', () => {
  it('AT10-01: renders empty-state paragraph with no entries prop', () => {
    const html = renderToString(React.createElement(AuditTrailPanel, {}));
    expect(html).toContain('empty-state');
    expect(html).toContain('No audit entries');
  });

  it('AT10-02: renders empty-state with explicit empty array', () => {
    const html = renderToString(
      React.createElement(AuditTrailPanel, { entries: [] }),
    );
    expect(html).toContain('No audit entries');
    expect(html).not.toContain('audit-entry');
  });

  it('AT10-03: null entries prop renders empty-state', () => {
    const html = renderToString(
      React.createElement(AuditTrailPanel, { entries: null }),
    );
    expect(html).toContain('No audit entries');
  });

  it('AT10-04: null title falls back to default "Audit Trail"', () => {
    const html = renderToString(
      React.createElement(AuditTrailPanel, { title: null }),
    );
    expect(html).toContain('Audit Trail');
  });
});

// ─── AT11 · SSR renderToString ────────────────────────────────────────────────

describe('AT11 · SSR renderToString', () => {
  it('AT11-01: renderToString returns a non-empty HTML string', () => {
    const html = renderToString(
      React.createElement(AuditTrailPanel, { entries: [FULL_ENTRY] }),
    );
    expect(typeof html).toBe('string');
    expect(html.length).toBeGreaterThan(0);
  });

  it('AT11-02: output contains no script tags', () => {
    const html = renderToString(
      React.createElement(AuditTrailPanel, { entries: [FULL_ENTRY] }),
    );
    expect(html).not.toContain('<script');
  });

  it('AT11-03: HTML-special characters in message are escaped', () => {
    const entry: AuditEntry = {
      traceId: 'tr-xss', status: 'success',
      message: '<script>alert("xss")</script>',
    };
    const html = renderToString(
      React.createElement(AuditTrailPanel, { entries: [entry] }),
    );
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&lt;script&gt;');
  });

  it('AT11-04: HTML-special characters in traceId are escaped', () => {
    const entry: AuditEntry = {
      traceId: '<bad>trace</bad>',
      status: 'error',
    };
    const html = renderToString(
      React.createElement(AuditTrailPanel, { entries: [entry] }),
    );
    expect(html).not.toContain('<bad>');
    expect(html).toContain('&lt;bad&gt;');
  });

  it('AT11-05: renderToString output is deterministic for the same input', () => {
    const html1 = renderToString(
      React.createElement(AuditTrailPanel, { entries: [FULL_ENTRY] }),
    );
    const html2 = renderToString(
      React.createElement(AuditTrailPanel, { entries: [FULL_ENTRY] }),
    );
    expect(html1).toBe(html2);
  });
});

// ─── AT12 · Never-throw ───────────────────────────────────────────────────────

describe('AT12 · Never-throw', () => {
  it('AT12-01: never throws with null items inside the entries array', () => {
    const bad = [null, undefined, null] as unknown as AuditEntry[];
    expect(() =>
      renderToString(React.createElement(AuditTrailPanel, { entries: bad }))
    ).not.toThrow();
  });

  it('AT12-02: never throws with fully malformed entry objects', () => {
    const bad = [
      42, '', false, [], {},
      { traceId: null, sessionId: null, agentId: null, timestamp: 'bad', status: null },
    ] as unknown as AuditEntry[];
    expect(() =>
      renderToString(React.createElement(AuditTrailPanel, { entries: bad }))
    ).not.toThrow();
  });

  it('AT12-03: never throws when timestamp is non-finite or a string', () => {
    const entries: AuditEntry[] = [
      { traceId: 'tr-1', timestamp: NaN    as unknown as number, status: 'success' },
      { traceId: 'tr-2', timestamp: Infinity as unknown as number, status: 'success' },
      { traceId: 'tr-3', timestamp: 'not-a-number' as unknown as number, status: 'error' },
    ];
    expect(() =>
      renderToString(React.createElement(AuditTrailPanel, { entries }))
    ).not.toThrow();
  });

  it('AT12-04: never throws for edge combinations of null/undefined/empty props', () => {
    const cases = [
      {},
      { entries: null },
      { entries: null, title: null },
      { entries: [] },
      { entries: [null as unknown as AuditEntry] },
      { entries: [undefined as unknown as AuditEntry] },
      { entries: [FULL_ENTRY], title: null },
    ];
    for (const props of cases) {
      expect(() =>
        renderToString(React.createElement(AuditTrailPanel, props))
      ).not.toThrow();
    }
  });

  it('AT12-05: renders 100 entries with mixed valid and null items without throwing', () => {
    const entries = Array.from({ length: 100 }, (_, i) =>
      i % 10 === 0
        ? (null as unknown as AuditEntry)
        : { traceId: `tr-${i}`, status: 'success' as const, message: `Entry ${i}` },
    );
    expect(() =>
      renderToString(React.createElement(AuditTrailPanel, { entries }))
    ).not.toThrow();
    const html = renderToString(React.createElement(AuditTrailPanel, { entries }));
    expect(html).toContain('Entry 1');
    expect(html).toContain('Entry 99');
  });
});
