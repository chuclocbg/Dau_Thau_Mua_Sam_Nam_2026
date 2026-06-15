import type { WorkflowState } from '../agents/AutonomousAgent';
import type { AgentMessage }  from '../agents/types';

export interface WorkflowStep {
  state:        WorkflowState;
  label:        string;
  completedAt?: number;
}

export interface StepTimelineProps {
  currentState?: WorkflowState;
  steps?:        WorkflowStep[];
  messageLog?:   AgentMessage[];
}

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString('vi-VN');
}

export default function StepTimeline({
  currentState,
  steps = [],
}: StepTimelineProps) {
  if (steps.length === 0) {
    return <div data-state="empty">Không có bước nào.</div>;
  }

  return (
    <ol data-state="timeline">
      {steps.map(step => {
        const isActive    = step.state === currentState;
        const isCompleted = step.completedAt !== undefined;
        return (
          <li
            key={step.state}
            data-step-state={step.state}
            data-active={isActive    ? 'true' : 'false'}
            data-completed={isCompleted ? 'true' : 'false'}
          >
            <span data-field="label">{step.label}</span>
            <span data-field="state">{step.state}</span>
            {isCompleted && (
              <span data-field="completed-at">{formatTimestamp(step.completedAt!)}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
