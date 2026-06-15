import type { AgentSession } from '../agents/AutonomousAgent';

export interface WorkflowPanelProps {
  session?:   AgentSession;
  onAction?:  (action: string) => void;
  // P6-09C
  traceId?:   string;
  summary?:   string;
}

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString('vi-VN');
}

export default function WorkflowPanel({
  session,
  traceId,
  summary,
}: WorkflowPanelProps) {
  if (session === undefined) {
    return <div data-state="empty">Chưa có phiên làm việc.</div>;
  }

  return (
    <div data-session-id={session.sessionId} data-workflow-state={session.state}>
      <span data-field="session-id">{session.sessionId}</span>
      <span data-field="state">{session.state}</span>
      <span data-field="message-count">{`${session.messageLog.length} messages`}</span>
      {summary !== undefined && (
        <span data-field="summary">{summary}</span>
      )}
      {session.pendingQuestion !== undefined && (
        <span data-field="pending-question">{session.pendingQuestion.question}</span>
      )}
      {session.completedAt !== undefined && (
        <span data-field="completed-at">{formatTimestamp(session.completedAt)}</span>
      )}
      {traceId !== undefined && (
        <span data-field="trace-id">{traceId}</span>
      )}
    </div>
  );
}
