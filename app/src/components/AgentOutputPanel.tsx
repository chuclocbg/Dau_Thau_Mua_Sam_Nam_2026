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

import React from 'react';
import type {
  PlannerAgent,
  SpecificationAgent,
  LegalReviewerAgent,
  RiskAgent,
  IAgent,
} from '../agents';
import LegalSummaryPanel, { type LegalSummaryPanelProps } from './LegalSummaryPanel';
import CitationCardPanel from './CitationCardPanel';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AgentOutputPanelProps {
  planner:       PlannerAgent;
  spec:          SpecificationAgent;
  legal:         LegalReviewerAgent;
  risk:          RiskAgent;
  loading?:      boolean;
  /** Legal v2.1: optional pipeline metadata to display below the agent list. */
  legalSummary?: LegalSummaryPanelProps | null;
  /** Legal v2.2: AgentMessage.legalBasis — grouped citation cards rendered below legalSummary. */
  citations?:    string[] | null;
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
  loading     = false,
  legalSummary,
  citations,
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
      {/* Legal v2.1: render pipeline metadata summary when provided */}
      {legalSummary != null && <LegalSummaryPanel {...legalSummary} />}
      {/* Legal v2.2: render citation card panel below legal summary */}
      <CitationCardPanel legalBasis={citations ?? []} />
    </div>
  );
}
