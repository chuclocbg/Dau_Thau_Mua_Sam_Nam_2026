import type { AgentSession, UserQuestion } from '../agents/AutonomousAgent';

export interface AutonomousPanelProps {
  session?:         AgentSession;
  pendingQuestion?: UserQuestion;
  onStart?:         (goal: string) => void;
  onAnswer?:        (questionId: string, answer: string) => void;
  // P6-09D
  traceId?:         string;
  summary?:         string;
}

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString('vi-VN');
}

export default function AutonomousPanel({
  session,
  pendingQuestion,
  onStart,
  onAnswer,
  traceId,
  summary,
}: AutonomousPanelProps) {
  // pendingQuestion prop takes precedence over session.pendingQuestion
  const question = pendingQuestion ?? session?.pendingQuestion;

  return (
    <div
      data-has-start={onStart  !== undefined ? 'true' : 'false'}
      data-has-answer={onAnswer !== undefined ? 'true' : 'false'}
    >
      {session !== undefined && (
        <>
          <span data-field="goal">{session.goal}</span>
          <span data-field="state">{session.state}</span>
          {session.completedAt !== undefined && (
            <span data-field="completed-at">{formatTimestamp(session.completedAt)}</span>
          )}
        </>
      )}
      {summary !== undefined && (
        <span data-field="summary">{summary}</span>
      )}
      {traceId !== undefined && (
        <span data-field="trace-id">{traceId}</span>
      )}
      {question !== undefined && (
        <div data-field="pending-question">
          <span data-field="question-id">{question.questionId}</span>
          <span data-field="question-text">{question.question}</span>
        </div>
      )}
    </div>
  );
}
