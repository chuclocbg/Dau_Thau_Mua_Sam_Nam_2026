/**
 * P7-02: AutonomousWorkflowPanel — 56 tests
 *
 * All tests use renderToString so the initial hook values are exercised
 * without any async agent calls.  The `initial*` props seed the component's
 * state for every branch that would otherwise require user interaction.
 *
 * Groups:
 *   AW-01  (5)  never-throw
 *   AW-02  (5)  initial structure
 *   AW-03  (5)  loading state
 *   AW-04  (5)  error state
 *   AW-05  (5)  session — basic fields
 *   AW-06  (5)  session — workflow state variants
 *   AW-07  (4)  session — summary and traceId
 *   AW-08  (4)  session — pendingQuestion
 *   AW-09  (4)  session — completedAt
 *   AW-10  (4)  run button
 *   AW-11  (5)  pause button visibility
 *   AW-12  (5)  resume button visibility
 */

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';

import AutonomousWorkflowPanel from '../components/AutonomousWorkflowPanel';
import type { AutonomousWorkflowPanelProps } from '../components/AutonomousWorkflowPanel';
import { AgentRegistry, AutonomousAgent } from '../agents';
import type { AgentSession, WorkflowState } from '../agents';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeAgent(): AutonomousAgent {
  return new AutonomousAgent(new AgentRegistry());
}

function makeSession(overrides: Partial<AgentSession> = {}): AgentSession {
  return {
    sessionId:   'sess-test-001',
    state:       'planning',
    goal:        'Mua 20 máy tính để bàn',
    messageLog:  [],
    startedAt:   1_700_000_000_000,
    specRetries: 0,
    ...overrides,
  };
}

function render(props: AutonomousWorkflowPanelProps): string {
  return renderToString(React.createElement(AutonomousWorkflowPanel, props));
}

// ─── AW-01 · never-throw ──────────────────────────────────────────────────────

describe('AW-01 · never-throw', () => {
  it('AW-01-01: renders without throwing with only agent prop', () => {
    expect(() => render({ agent: makeAgent() })).not.toThrow();
  });

  it('AW-01-02: renders without throwing with initialSession', () => {
    expect(() => render({ agent: makeAgent(), initialSession: makeSession() })).not.toThrow();
  });

  it('AW-01-03: renders without throwing with initialLoading=true', () => {
    expect(() => render({ agent: makeAgent(), initialLoading: true })).not.toThrow();
  });

  it('AW-01-04: renders without throwing with initialError', () => {
    expect(() => render({ agent: makeAgent(), initialError: 'Something went wrong' })).not.toThrow();
  });

  it('AW-01-05: renders without throwing with all initial props', () => {
    expect(() => render({
      agent:           makeAgent(),
      initialSession:  makeSession(),
      initialSummary:  'Bước lập kế hoạch hoàn tất.',
      initialTraceId:  'trace-001',
      initialError:    undefined,
      initialLoading:  false,
    })).not.toThrow();
  });
});

// ─── AW-02 · initial structure ────────────────────────────────────────────────

describe('AW-02 · initial structure', () => {
  it('AW-02-01: outer div has data-panel="autonomous-workflow"', () => {
    expect(render({ agent: makeAgent() })).toContain('data-panel="autonomous-workflow"');
  });

  it('AW-02-02: has controls div with data-field="controls"', () => {
    expect(render({ agent: makeAgent() })).toContain('data-field="controls"');
  });

  it('AW-02-03: has goal input with data-field="goal-input"', () => {
    expect(render({ agent: makeAgent() })).toContain('data-field="goal-input"');
  });

  it('AW-02-04: has run button with data-action="run"', () => {
    expect(render({ agent: makeAgent() })).toContain('data-action="run"');
  });

  it('AW-02-05: WorkflowPanel empty state rendered when no session', () => {
    expect(render({ agent: makeAgent() })).toContain('data-state="empty"');
  });
});

// ─── AW-03 · loading state ────────────────────────────────────────────────────

describe('AW-03 · loading state', () => {
  it('AW-03-01: initialLoading=true → run button shows "Đang chạy..."', () => {
    expect(render({ agent: makeAgent(), initialLoading: true })).toContain('Đang chạy...');
  });

  it('AW-03-02: initialLoading=true → run button is disabled', () => {
    const html = render({ agent: makeAgent(), initialLoading: true });
    // disabled appears near the run button
    expect(html).toContain('data-action="run"');
    expect(html).toContain('disabled');
  });

  it('AW-03-03: initialLoading=true → goal input is disabled', () => {
    const html = render({ agent: makeAgent(), initialLoading: true });
    expect(html).toContain('data-field="goal-input"');
    expect(html).toContain('disabled');
  });

  it('AW-03-04: initialLoading=false → run button text is "Khởi động quy trình"', () => {
    expect(render({ agent: makeAgent(), initialLoading: false }))
      .toContain('Khởi động quy trình');
  });

  it('AW-03-05: initialLoading=true → no error div shown by default', () => {
    expect(render({ agent: makeAgent(), initialLoading: true }))
      .not.toContain('data-field="error"');
  });
});

// ─── AW-04 · error state ─────────────────────────────────────────────────────

describe('AW-04 · error state', () => {
  it('AW-04-01: initialError → div with data-field="error" present', () => {
    expect(render({ agent: makeAgent(), initialError: 'AUTONOMOUS_MISSING_GOAL' }))
      .toContain('data-field="error"');
  });

  it('AW-04-02: initialError → error message text in output', () => {
    expect(render({ agent: makeAgent(), initialError: 'Lỗi thử nghiệm' }))
      .toContain('Lỗi thử nghiệm');
  });

  it('AW-04-03: no error by default → no data-field="error"', () => {
    expect(render({ agent: makeAgent() })).not.toContain('data-field="error"');
  });

  it('AW-04-04: empty string error → no error div (empty string is falsy)', () => {
    expect(render({ agent: makeAgent(), initialError: '' }))
      .not.toContain('data-field="error"');
  });

  it('AW-04-05: initialError + initialSession → both error and session-id in output', () => {
    const html = render({
      agent:          makeAgent(),
      initialError:   'Test error',
      initialSession: makeSession({ sessionId: 'sess-combo-001' }),
    });
    expect(html).toContain('data-field="error"');
    expect(html).toContain('sess-combo-001');
  });
});

// ─── AW-05 · session basic fields ────────────────────────────────────────────

describe('AW-05 · session basic fields', () => {
  const session = makeSession({ sessionId: 'sess-check-001', state: 'planning', messageLog: [] });
  const html = () => render({ agent: makeAgent(), initialSession: session });

  it('AW-05-01: session.sessionId appears in output', () => {
    expect(html()).toContain('sess-check-001');
  });

  it('AW-05-02: session.state appears in output', () => {
    expect(html()).toContain('planning');
  });

  it('AW-05-03: message-count span present', () => {
    expect(html()).toContain('data-field="message-count"');
  });

  it('AW-05-04: data-session-id attribute present', () => {
    expect(html()).toContain('data-session-id="sess-check-001"');
  });

  it('AW-05-05: data-workflow-state attribute present', () => {
    expect(html()).toContain('data-workflow-state="planning"');
  });
});

// ─── AW-06 · session workflow state variants ──────────────────────────────────

describe('AW-06 · session workflow state variants', () => {
  function stateHtml(state: WorkflowState): string {
    return render({ agent: makeAgent(), initialSession: makeSession({ state }) });
  }

  it('AW-06-01: state="specifying" → data-workflow-state="specifying"', () => {
    expect(stateHtml('specifying')).toContain('data-workflow-state="specifying"');
  });

  it('AW-06-02: state="legal-review" → data-workflow-state="legal-review"', () => {
    expect(stateHtml('legal-review')).toContain('data-workflow-state="legal-review"');
  });

  it('AW-06-03: state="risk-assessment" → data-workflow-state="risk-assessment"', () => {
    expect(stateHtml('risk-assessment')).toContain('data-workflow-state="risk-assessment"');
  });

  it('AW-06-04: state="done" → data-workflow-state="done"', () => {
    expect(stateHtml('done')).toContain('data-workflow-state="done"');
  });

  it('AW-06-05: state="error" → data-workflow-state="error"', () => {
    expect(stateHtml('error')).toContain('data-workflow-state="error"');
  });
});

// ─── AW-07 · summary and traceId ─────────────────────────────────────────────

describe('AW-07 · summary and traceId', () => {
  it('AW-07-01: initialSummary + initialSession → data-field="summary" present', () => {
    const html = render({
      agent:          makeAgent(),
      initialSession: makeSession(),
      initialSummary: 'Bước lập kế hoạch hoàn tất.',
    });
    expect(html).toContain('data-field="summary"');
  });

  it('AW-07-02: initialSummary text appears in output', () => {
    const html = render({
      agent:          makeAgent(),
      initialSession: makeSession(),
      initialSummary: 'Tóm tắt bước 1.',
    });
    expect(html).toContain('Tóm tắt bước 1.');
  });

  it('AW-07-03: no summary → no data-field="summary"', () => {
    expect(render({ agent: makeAgent(), initialSession: makeSession() }))
      .not.toContain('data-field="summary"');
  });

  it('AW-07-04: initialTraceId + initialSession → data-field="trace-id" present', () => {
    const html = render({
      agent:          makeAgent(),
      initialSession: makeSession(),
      initialTraceId: 'trace-abc-123',
    });
    expect(html).toContain('data-field="trace-id"');
  });
});

// ─── AW-08 · pendingQuestion ─────────────────────────────────────────────────

describe('AW-08 · pendingQuestion', () => {
  const withQuestion = makeSession({
    state: 'ask-user',
    pendingQuestion: {
      questionId:   'q-001',
      agentId:      'autonomous',
      question:     'Xác nhận phương thức đấu thầu?',
      required:     true,
    },
  });

  it('AW-08-01: session with pendingQuestion → data-field="pending-question" present', () => {
    expect(render({ agent: makeAgent(), initialSession: withQuestion }))
      .toContain('data-field="pending-question"');
  });

  it('AW-08-02: session with pendingQuestion → question text in output', () => {
    expect(render({ agent: makeAgent(), initialSession: withQuestion }))
      .toContain('Xác nhận phương thức đấu thầu?');
  });

  it('AW-08-03: session without pendingQuestion → no data-field="pending-question"', () => {
    expect(render({ agent: makeAgent(), initialSession: makeSession({ state: 'planning' }) }))
      .not.toContain('data-field="pending-question"');
  });

  it('AW-08-04: session with pendingQuestion (ask-user) → resume button present', () => {
    expect(render({ agent: makeAgent(), initialSession: withQuestion }))
      .toContain('data-action="resume"');
  });
});

// ─── AW-09 · completedAt ─────────────────────────────────────────────────────

describe('AW-09 · completedAt', () => {
  it('AW-09-01: session with completedAt → data-field="completed-at" present', () => {
    const html = render({
      agent:          makeAgent(),
      initialSession: makeSession({ state: 'done', completedAt: 1_700_100_000_000 }),
    });
    expect(html).toContain('data-field="completed-at"');
  });

  it('AW-09-02: session without completedAt → no data-field="completed-at"', () => {
    expect(render({ agent: makeAgent(), initialSession: makeSession({ state: 'planning' }) }))
      .not.toContain('data-field="completed-at"');
  });

  it('AW-09-03: completedAt value is formatted (non-empty content in span)', () => {
    const html = render({
      agent:          makeAgent(),
      initialSession: makeSession({ state: 'done', completedAt: 1_700_100_000_000 }),
    });
    // Timestamp should produce a non-empty formatted string
    expect(html).toMatch(/data-field="completed-at">[^<]+</);
  });

  it('AW-09-04: state="done" + completedAt → both workflow-state and completed-at shown', () => {
    const html = render({
      agent:          makeAgent(),
      initialSession: makeSession({ state: 'done', completedAt: 1_700_100_000_000 }),
    });
    expect(html).toContain('data-workflow-state="done"');
    expect(html).toContain('data-field="completed-at"');
  });
});

// ─── AW-10 · run button ───────────────────────────────────────────────────────

describe('AW-10 · run button', () => {
  it('AW-10-01: run button has data-action="run"', () => {
    expect(render({ agent: makeAgent() })).toContain('data-action="run"');
  });

  it('AW-10-02: run button text is "Khởi động quy trình" when not loading', () => {
    expect(render({ agent: makeAgent(), initialLoading: false }))
      .toContain('Khởi động quy trình');
  });

  it('AW-10-03: run button text is "Đang chạy..." when loading', () => {
    expect(render({ agent: makeAgent(), initialLoading: true }))
      .toContain('Đang chạy...');
  });

  it('AW-10-04: run button is present regardless of session state', () => {
    const html = render({ agent: makeAgent(), initialSession: makeSession({ state: 'done' }) });
    expect(html).toContain('data-action="run"');
  });
});

// ─── AW-11 · pause button visibility ─────────────────────────────────────────

describe('AW-11 · pause button visibility', () => {
  function pauseVisible(state: WorkflowState): boolean {
    const html = render({ agent: makeAgent(), initialSession: makeSession({ state }) });
    return html.includes('data-action="pause"');
  }

  it('AW-11-01: state="planning" → pause button present', () => {
    expect(pauseVisible('planning')).toBe(true);
  });

  it('AW-11-02: state="specifying" → pause button present', () => {
    expect(pauseVisible('specifying')).toBe(true);
  });

  it('AW-11-03: state="legal-review" → pause button present', () => {
    expect(pauseVisible('legal-review')).toBe(true);
  });

  it('AW-11-04: state="risk-assessment" → pause button present', () => {
    expect(pauseVisible('risk-assessment')).toBe(true);
  });

  it('AW-11-05: state="done" → no pause button', () => {
    expect(pauseVisible('done')).toBe(false);
  });
});

// ─── AW-12 · resume button visibility ────────────────────────────────────────

describe('AW-12 · resume button visibility', () => {
  it('AW-12-01: state="ask-user" → resume button present', () => {
    const html = render({ agent: makeAgent(), initialSession: makeSession({ state: 'ask-user' }) });
    expect(html).toContain('data-action="resume"');
  });

  it('AW-12-02: state="planning" → no resume button', () => {
    const html = render({ agent: makeAgent(), initialSession: makeSession({ state: 'planning' }) });
    expect(html).not.toContain('data-action="resume"');
  });

  it('AW-12-03: state="done" → no resume button', () => {
    const html = render({ agent: makeAgent(), initialSession: makeSession({ state: 'done' }) });
    expect(html).not.toContain('data-action="resume"');
  });

  it('AW-12-04: no session → no resume button', () => {
    expect(render({ agent: makeAgent() })).not.toContain('data-action="resume"');
  });

  it('AW-12-05: state="error" → no resume button', () => {
    const html = render({ agent: makeAgent(), initialSession: makeSession({ state: 'error' }) });
    expect(html).not.toContain('data-action="resume"');
  });
});
