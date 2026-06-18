/**
 * P7-01: AgentProviderPanel — wires the agents/index.ts barrel into the UI layer.
 *
 * createAgentSystem() instantiates all 6 Phase-6 agents against a shared
 * AgentRegistry and returns metadata for display.  The component itself is
 * SSR-compatible: no hooks, no browser globals, never throws.
 */

import {
  AgentRegistry,
  PlannerAgent,
  SpecificationAgent,
  LegalReviewerAgent,
  RiskAgent,
  ChatAgent,
  AutonomousAgent,
} from '../agents';
import type { AgentId } from '../agents';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AgentStatusInfo {
  id:           AgentId;
  name:         string;
  capabilities: string[];
}

export interface AgentSystemBundle {
  registry:   AgentRegistry;
  agents:     AgentStatusInfo[];
  /** Exposed so Task B (AutonomousWorkflowPanel) can wire live sessions. */
  autonomous: AutonomousAgent;
  /** Exposed so Task C (ChatInterfacePanel) can wire conversation turns. */
  chat:       ChatAgent;
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/**
 * Creates one AgentRegistry, instantiates and registers all 6 agents, and
 * returns a snapshot of their metadata for display.  Call once at module level
 * so agent instances are stable across renders.
 */
export function createAgentSystem(): AgentSystemBundle {
  const registry   = new AgentRegistry();
  const planner    = new PlannerAgent(registry);
  const spec       = new SpecificationAgent(registry);
  const legal      = new LegalReviewerAgent(registry);
  const risk       = new RiskAgent(registry);
  const chat       = new ChatAgent(registry);
  const autonomous = new AutonomousAgent(registry);

  registry.register(planner);
  registry.register(spec);
  registry.register(legal);
  registry.register(risk);
  registry.register(chat);
  registry.register(autonomous);

  return {
    registry,
    autonomous,
    chat,
    agents: [planner, spec, legal, risk, chat, autonomous].map(a => ({
      id:           a.id,
      name:         a.name,
      capabilities: a.getCapabilities(),
    })),
  };
}

// ─── Component ───────────────────────────────────────────────────────────────

export interface AgentProviderPanelProps {
  agents?:  AgentStatusInfo[] | null;
  title?:   string | null;
  loading?: boolean | null;
}

export default function AgentProviderPanel({
  agents,
  title,
  loading,
}: AgentProviderPanelProps = {}) {
  if (loading === true) {
    return (
      <div data-panel="agent-provider" data-state="loading">
        Đang khởi động agent...
      </div>
    );
  }

  const list      = Array.isArray(agents) ? agents : [];
  const safeTitle = typeof title === 'string' ? title : 'Hệ thống Agent';

  if (list.length === 0) {
    return (
      <div data-panel="agent-provider" data-state="empty">
        Chưa có agent nào.
      </div>
    );
  }

  return (
    <div data-panel="agent-provider" data-state="ready">
      <h2 data-field="title">{safeTitle}</h2>
      <ul data-field="agent-list">
        {list.map(agent => (
          <li key={agent.id} data-agent-id={agent.id}>
            <span data-field="name">{agent.name}</span>
            <span data-field="capability-count">{agent.capabilities.length}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
