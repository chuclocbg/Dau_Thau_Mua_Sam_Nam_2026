/**
 * P6-01A: AgentRegistry — message broker for the multi-agent system.
 *
 * Use as an injected instance (never a module-level singleton) so that
 * each test group can create a fresh registry and avoid state leakage.
 */

import type { AgentId, AgentMessage, IAgent } from './types';

export class AgentRegistry {
  private readonly agents = new Map<AgentId, IAgent>();
  private readonly traces = new Map<string, AgentMessage[]>();
  private readonly subs   = new Map<string, Array<(msg: AgentMessage) => void>>();

  constructor() {}

  /** Appends msg to its trace.  Throws on empty traceId (audit invariant). */
  log(msg: AgentMessage): void {
    if (!msg.traceId) {
      throw new Error('AgentMessage.traceId is required — audit invariant violated');
    }
    const existing = this.traces.get(msg.traceId) ?? [];
    this.traces.set(msg.traceId, [...existing, msg]);
  }

  /** Returns all messages logged under traceId, or [] if none. */
  getTrace(traceId: string): AgentMessage[] {
    return this.traces.get(traceId) ?? [];
  }

  /** Registers an agent.  Last-write-wins for duplicate AgentId. */
  register(agent: IAgent): void {
    this.agents.set(agent.id, agent);
  }

  /**
   * Routes msg to the target agent and returns its response.
   * Broadcast messages are forwarded to all subscribers and returned as-is
   * (no single-agent response).
   */
  async process(msg: AgentMessage): Promise<AgentMessage> {
    this.log(msg);
    if (msg.to === 'broadcast') {
      this.notifySubscribers(msg.type, msg);
      return msg;
    }
    const agent = this.agents.get(msg.to as AgentId);
    if (!agent) {
      throw new Error(`No agent registered for id: ${msg.to}`);
    }
    return agent.process(msg);
  }

  /** Adds handler to the subscriber list for event. */
  subscribe(event: string, handler: (msg: AgentMessage) => void): void {
    const existing = this.subs.get(event) ?? [];
    this.subs.set(event, [...existing, handler]);
  }

  /** Calls all handlers subscribed to event synchronously. */
  notifySubscribers(event: string, msg: AgentMessage): void {
    const handlers = this.subs.get(event) ?? [];
    for (const h of handlers) {
      h(msg);
    }
  }
}
