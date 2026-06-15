import type { WorkflowState } from '../agents/AutonomousAgent';
import type { AgentMessage } from '../agents/types';

export interface WorkflowStep {
  state: WorkflowState;
  label: string;
  completedAt?: number;
}

export interface StepTimelineProps {
  currentState?: WorkflowState;
  steps?: WorkflowStep[];
  messageLog?: AgentMessage[];
}

export default function StepTimeline(_props: StepTimelineProps) {
  return <div>StepTimeline</div>;
}
