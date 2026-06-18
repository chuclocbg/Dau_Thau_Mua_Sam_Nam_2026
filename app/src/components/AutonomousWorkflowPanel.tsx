/**
 * P7-02: AutonomousWorkflowPanel — wires WorkflowPanel to the AutonomousAgent
 * state machine.
 *
 * Manages session state in React and delegates all procurement orchestration
 * to the AutonomousAgent via AgentMessage / process().  WorkflowPanel receives
 * the live AgentSession as a prop and renders its current state.
 *
 * The `initial*` props are provided for SSR-safe testing with renderToString —
 * they seed the initial hook values so every state variant is renderable
 * without executing async agent calls.
 */

import { useState, useCallback } from 'react';

import {
  AutonomousAgent,
  type AgentMessage,
  type AgentSession,
  type AutonomousInput,
  type AutonomousOutput,
} from '../agents';

import WorkflowPanel from './WorkflowPanel';

// ─── Local trace-id helper ────────────────────────────────────────────────────
// generateTraceId is not re-exported from the agents barrel, so we provide
// a lightweight equivalent that satisfies the audit-trail non-empty invariant.

function makeTraceId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AutonomousWorkflowPanelProps {
  agent:           AutonomousAgent;
  // ── Initial state overrides (for testing / SSR snapshots) ──────────────────
  initialSession?: AgentSession;
  initialSummary?: string;
  initialTraceId?: string;
  initialError?:   string;
  initialLoading?: boolean;
}

// ─── Active states where pause is meaningful ─────────────────────────────────
const PAUSABLE_STATES = new Set(['planning', 'specifying', 'legal-review', 'risk-assessment']);

// ─── Component ────────────────────────────────────────────────────────────────

export default function AutonomousWorkflowPanel({
  agent,
  initialSession,
  initialSummary,
  initialTraceId,
  initialError,
  initialLoading = false,
}: AutonomousWorkflowPanelProps) {
  const [session, setSession] = useState<AgentSession | undefined>(initialSession);
  const [summary, setSummary] = useState<string | undefined>(initialSummary);
  const [traceId, setTraceId] = useState<string | undefined>(initialTraceId);
  const [loading, setLoading] = useState<boolean>(initialLoading);
  const [error, setError]     = useState<string | undefined>(initialError);
  const [goal, setGoal]       = useState('');

  const sendAction = useCallback(async (input: AutonomousInput): Promise<void> => {
    const tid: string = makeTraceId();
    setTraceId(tid);
    setLoading(true);
    setError(undefined);

    const msg: AgentMessage = {
      traceId:   tid,
      from:      'user',
      to:        'autonomous',
      type:      'request',
      payload:   input,
      timestamp: Date.now(),
    };

    try {
      const response = await agent.process(msg);
      if (response.type === 'error') {
        const errPayload = response.payload as { message?: string };
        setError(errPayload.message ?? 'Lỗi không xác định');
      } else {
        const output = response.payload as AutonomousOutput;
        setSession(output.session);
        setSummary(output.summary);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [agent]);

  const handleRun = useCallback((): void => {
    if (!goal.trim()) return;
    void sendAction({ action: 'run', goal: goal.trim() });
  }, [goal, sendAction]);

  const handlePause = useCallback((): void => {
    void sendAction({ action: 'pause' });
  }, [sendAction]);

  const handleResume = useCallback((): void => {
    if (!session?.pendingQuestion) return;
    void sendAction({
      action:     'resume',
      userAnswer: {
        questionId: session.pendingQuestion.questionId,
        answer:     'Xác nhận tiếp tục',
      },
    });
  }, [session, sendAction]);

  const showPause  = session !== undefined && PAUSABLE_STATES.has(session.state);
  const showResume = session?.state === 'ask-user';

  return (
    <div data-panel="autonomous-workflow">
      <div data-field="controls">
        <input
          data-field="goal-input"
          type="text"
          value={goal}
          onChange={e => setGoal(e.target.value)}
          placeholder="Mô tả mục tiêu mua sắm..."
          disabled={loading}
        />
        <button
          data-action="run"
          onClick={handleRun}
          disabled={loading || !goal.trim()}
        >
          {loading ? 'Đang chạy...' : 'Khởi động quy trình'}
        </button>
        {showPause && (
          <button data-action="pause" onClick={handlePause} disabled={loading}>
            Tạm dừng
          </button>
        )}
        {showResume && (
          <button data-action="resume" onClick={handleResume} disabled={loading}>
            Tiếp tục
          </button>
        )}
      </div>

      {error !== undefined && error !== '' && (
        <div data-field="error">{error}</div>
      )}

      <WorkflowPanel
        session={session}
        summary={summary}
        traceId={traceId}
      />
    </div>
  );
}
