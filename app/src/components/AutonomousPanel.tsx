import type { AgentSession, UserQuestion } from '../agents/AutonomousAgent';

export interface AutonomousPanelProps {
  session?: AgentSession;
  pendingQuestion?: UserQuestion;
  onStart?: (goal: string) => void;
  onAnswer?: (questionId: string, answer: string) => void;
}

export default function AutonomousPanel(_props: AutonomousPanelProps) {
  return <div>AutonomousPanel</div>;
}
