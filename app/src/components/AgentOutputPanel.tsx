/**
 * 8-B: AgentOutputPanel — surfaces metadata for the 4 specialist agents
 * (Planner, Specification, LegalReviewer, Risk) that were previously
 * instantiated but invisible to the UI.
 *
 * Renders each agent's id, name, capability count, and full capability list
 * with data-* attributes so the UI is machine-readable and testable via
 * renderToString without any async agent calls.
 *
 * Pure functional — no hooks, no browser globals, SSR-compatible.
 */

import type {
  PlannerAgent,
  SpecificationAgent,
  LegalReviewerAgent,
  RiskAgent,
  IAgent,
} from '../agents';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AgentOutputPanelProps {
  planner:  PlannerAgent;
  spec:     SpecificationAgent;
  legal:    LegalReviewerAgent;
  risk:     RiskAgent;
  loading?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function AgentSection({ agent }: { agent: IAgent }) {
  const caps = agent.getCapabilities();
  return (
    <li data-section={agent.id} data-agent-id={agent.id}>
      <span data-field="name">{agent.name}</span>
      <span data-field="capability-count">{caps.length}</span>
      <ul data-field="capabilities">
        {caps.map(cap => (
          <li key={cap} data-capability={cap}>{cap}</li>
        ))}
      </ul>
    </li>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AgentOutputPanel({
  planner,
  spec,
  legal,
  risk,
  loading = false,
}: AgentOutputPanelProps) {
  if (loading) {
    return (
      <div data-panel="agent-output" data-state="loading">
        Đang tải tác nhân chuyên biệt...
      </div>
    );
  }

  return (
    <div data-panel="agent-output" data-state="ready" data-agent-count={4}>
      <h2 data-field="title">Tác nhân chuyên biệt</h2>
      <ul data-field="agent-list">
        <AgentSection agent={planner} />
        <AgentSection agent={spec} />
        <AgentSection agent={legal} />
        <AgentSection agent={risk} />
      </ul>
    </div>
  );
}
