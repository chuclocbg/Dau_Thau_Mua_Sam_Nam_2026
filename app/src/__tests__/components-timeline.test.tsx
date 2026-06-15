/**
 * P6-09C: Rendering tests for StepTimeline and WorkflowPanel.
 *
 * Uses react-dom/server renderToString (Node environment, no jsdom needed).
 */

import { describe, it, expect } from 'vitest';
import { renderToString }       from 'react-dom/server';
import React                    from 'react';
import StepTimeline, { type WorkflowStep, type StepTimelineProps } from '../components/StepTimeline';
import WorkflowPanel, { type WorkflowPanelProps }                  from '../components/WorkflowPanel';
import type { AgentSession, UserQuestion }                          from '../agents/AutonomousAgent';
import type { WorkflowState }                                       from '../agents/AutonomousAgent';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function render(element: React.ReactElement): string {
  return renderToString(element);
}

function makeSession(overrides: Partial<AgentSession> = {}): AgentSession {
  return {
    sessionId:   'sess-001',
    state:       'idle',
    goal:        'Mua sắm thiết bị văn phòng',
    messageLog:  [],
    startedAt:   1_750_000_000_000,
    specRetries: 0,
    ...overrides,
  };
}

const STEP_PLANNING: WorkflowStep = { state: 'planning',    label: 'Lập kế hoạch'   };
const STEP_SPEC:     WorkflowStep = { state: 'specifying',  label: 'Xây dựng HSYC'  };
const STEP_LEGAL:    WorkflowStep = { state: 'legal-review',label: 'Thẩm định pháp lý' };
const STEP_DONE:     WorkflowStep = {
  state:       'done',
  label:       'Hoàn thành',
  completedAt: new Date('2026-03-15T10:00:00').getTime(),
};

// ─── ST: StepTimeline ─────────────────────────────────────────────────────────

describe('StepTimeline', () => {
  it('ST-01: renders empty state when steps is undefined', () => {
    const html = render(<StepTimeline />);
    expect(html).toContain('data-state="empty"');
  });

  it('ST-02: renders empty state when steps is empty array', () => {
    const html = render(<StepTimeline steps={[]} />);
    expect(html).toContain('data-state="empty"');
  });

  it('ST-03: renders timeline container when steps provided', () => {
    const html = render(<StepTimeline steps={[STEP_PLANNING]} />);
    expect(html).toContain('data-state="timeline"');
    expect(html).not.toContain('data-state="empty"');
  });

  it('ST-04: renders one step — label', () => {
    const html = render(<StepTimeline steps={[STEP_PLANNING]} />);
    expect(html).toContain('Lập kế hoạch');
    expect(html).toContain('data-field="label"');
  });

  it('ST-05: renders one step — state text', () => {
    const html = render(<StepTimeline steps={[STEP_PLANNING]} />);
    expect(html).toContain('data-field="state"');
    expect(html).toContain('>planning<');
  });

  it('ST-06: renders multiple steps', () => {
    const html = render(<StepTimeline steps={[STEP_PLANNING, STEP_SPEC, STEP_LEGAL]} />);
    expect(html).toContain('Lập kế hoạch');
    expect(html).toContain('Xây dựng HSYC');
    expect(html).toContain('Thẩm định pháp lý');
  });

  it('ST-07: active step has data-active="true"', () => {
    const html = render(
      <StepTimeline steps={[STEP_PLANNING, STEP_SPEC]} currentState="specifying" />,
    );
    expect(html).toContain('data-step-state="specifying" data-active="true"');
  });

  it('ST-08: non-active step has data-active="false"', () => {
    const html = render(
      <StepTimeline steps={[STEP_PLANNING, STEP_SPEC]} currentState="specifying" />,
    );
    expect(html).toContain('data-step-state="planning" data-active="false"');
  });

  it('ST-09: all steps inactive when currentState is undefined', () => {
    const html = render(<StepTimeline steps={[STEP_PLANNING, STEP_SPEC]} />);
    expect(html).not.toContain('data-active="true"');
  });

  it('ST-10: completed step has data-completed="true"', () => {
    const html = render(<StepTimeline steps={[STEP_DONE]} />);
    expect(html).toContain('data-step-state="done" data-active="false" data-completed="true"');
  });

  it('ST-11: uncompleted step has data-completed="false"', () => {
    const html = render(<StepTimeline steps={[STEP_PLANNING]} />);
    expect(html).toContain('data-completed="false"');
  });

  it('ST-12: renders completedAt when step is completed', () => {
    const html = render(<StepTimeline steps={[STEP_DONE]} />);
    expect(html).toContain('data-field="completed-at"');
    expect(html).toContain('2026');
  });

  it('ST-13: does not render completed-at when step is not completed', () => {
    const html = render(<StepTimeline steps={[STEP_PLANNING]} />);
    expect(html).not.toContain('data-field="completed-at"');
  });

  it('ST-14: stable key — uses step.state, renders all items regardless of order', () => {
    const html1 = render(<StepTimeline steps={[STEP_PLANNING, STEP_SPEC]} />);
    const html2 = render(<StepTimeline steps={[STEP_SPEC, STEP_PLANNING]} />);
    expect(html1).toContain('data-step-state="planning"');
    expect(html1).toContain('data-step-state="specifying"');
    expect(html2).toContain('data-step-state="planning"');
    expect(html2).toContain('data-step-state="specifying"');
  });

  it('ST-15: active step can also be completed', () => {
    const activeCompleted: WorkflowStep = {
      state: 'done', label: 'Xong', completedAt: Date.now(),
    };
    const html = render(<StepTimeline steps={[activeCompleted]} currentState="done" />);
    expect(html).toContain('data-active="true"');
    expect(html).toContain('data-completed="true"');
  });

  it('ST-16: every WorkflowState value is renderable as a step', () => {
    const states: WorkflowState[] = [
      'idle', 'planning', 'specifying', 'legal-review', 'risk-assessment',
      'ask-user', 'ready-for-export', 'exporting', 'done', 'error',
    ];
    const steps: WorkflowStep[] = states.map(s => ({ state: s, label: s }));
    const html = render(<StepTimeline steps={steps} currentState="planning" />);
    for (const s of states) {
      expect(html).toContain(`data-step-state="${s}"`);
    }
  });
});

// ─── WP: WorkflowPanel ────────────────────────────────────────────────────────

describe('WorkflowPanel', () => {
  it('WP-01: renders empty state when session is undefined', () => {
    const html = render(<WorkflowPanel />);
    expect(html).toContain('data-state="empty"');
  });

  it('WP-02: renders sessionId', () => {
    const html = render(<WorkflowPanel session={makeSession()} />);
    expect(html).toContain('sess-001');
    expect(html).toContain('data-field="session-id"');
    expect(html).toContain('data-session-id="sess-001"');
  });

  it('WP-03: renders current WorkflowState text', () => {
    const html = render(<WorkflowPanel session={makeSession({ state: 'planning' })} />);
    expect(html).toContain('data-field="state"');
    expect(html).toContain('>planning<');
    expect(html).toContain('data-workflow-state="planning"');
  });

  it('WP-04: renders summary when provided', () => {
    const html = render(
      <WorkflowPanel session={makeSession()} summary="Đã lập xong kế hoạch mua sắm." />,
    );
    expect(html).toContain('data-field="summary"');
    expect(html).toContain('Đã lập xong kế hoạch mua sắm.');
  });

  it('WP-05: does not render summary field when summary absent', () => {
    const html = render(<WorkflowPanel session={makeSession()} />);
    expect(html).not.toContain('data-field="summary"');
  });

  it('WP-06: renders pendingQuestion text when present', () => {
    const question: UserQuestion = {
      questionId: 'q-001',
      agentId:    'autonomous',
      question:   'Phương thức lựa chọn nhà thầu nào?',
      required:   true,
    };
    const html = render(
      <WorkflowPanel session={makeSession({ state: 'ask-user', pendingQuestion: question })} />,
    );
    expect(html).toContain('data-field="pending-question"');
    expect(html).toContain('Phương thức lựa chọn nhà thầu nào?');
  });

  it('WP-07: does not render pending-question field when none', () => {
    const html = render(<WorkflowPanel session={makeSession()} />);
    expect(html).not.toContain('data-field="pending-question"');
  });

  it('WP-08: renders completedAt timestamp when present', () => {
    const ts = new Date('2026-06-01T15:30:00').getTime();
    const html = render(<WorkflowPanel session={makeSession({ completedAt: ts })} />);
    expect(html).toContain('data-field="completed-at"');
    expect(html).toContain('2026');
  });

  it('WP-09: does not render completed-at field when absent', () => {
    const html = render(<WorkflowPanel session={makeSession()} />);
    expect(html).not.toContain('data-field="completed-at"');
  });

  it('WP-10: renders message count', () => {
    const session = makeSession({ messageLog: [
      { traceId: 't1', from: 'user', to: 'planner', type: 'request', payload: {}, timestamp: 1 },
      { traceId: 't2', from: 'planner', to: 'user', type: 'response', payload: {}, timestamp: 2 },
      { traceId: 't3', from: 'autonomous', to: 'risk', type: 'request', payload: {}, timestamp: 3 },
    ]});
    const html = render(<WorkflowPanel session={session} />);
    expect(html).toContain('data-field="message-count"');
    expect(html).toContain('3 messages');
  });

  it('WP-11: renders zero message count for empty log', () => {
    const html = render(<WorkflowPanel session={makeSession()} />);
    expect(html).toContain('0 messages');
  });

  it('WP-12: renders traceId when provided', () => {
    const html = render(<WorkflowPanel session={makeSession()} traceId="trace-xyz-999" />);
    expect(html).toContain('data-field="trace-id"');
    expect(html).toContain('trace-xyz-999');
  });

  it('WP-13: does not render trace-id field when traceId absent', () => {
    const html = render(<WorkflowPanel session={makeSession()} />);
    expect(html).not.toContain('data-field="trace-id"');
  });

  it('WP-14: renders different workflow states correctly', () => {
    const states: WorkflowState[] = ['idle', 'planning', 'legal-review', 'done', 'error'];
    for (const state of states) {
      const html = render(<WorkflowPanel session={makeSession({ state })} />);
      expect(html).toContain(`data-workflow-state="${state}"`);
      expect(html).toContain(`>${state}<`);
    }
  });
});
