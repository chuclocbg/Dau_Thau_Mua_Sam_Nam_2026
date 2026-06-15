import type { AgentSession } from '../agents/AutonomousAgent';

export interface WorkflowPanelProps {
  session?: AgentSession;
  onAction?: (action: string) => void;
}

export default function WorkflowPanel(_props: WorkflowPanelProps) {
  return <div>WorkflowPanel</div>;
}
