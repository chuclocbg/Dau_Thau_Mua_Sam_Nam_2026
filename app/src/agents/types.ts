/**
 * P6-01A: Core type contracts for the multi-agent message-passing system.
 * No business logic — contracts only.
 */

/** Identifies which agent a message is routed to or from. */
export type AgentId =
  | 'planner'
  | 'specification'
  | 'legal-reviewer'
  | 'risk'
  | 'chat'
  | 'autonomous';

/**
 * Every message flowing through the multi-agent system.
 * traceId is REQUIRED — AgentRegistry.log() throws on empty traceId.
 */
export interface AgentMessage {
  traceId:       string;              // UUID v4, không được rỗng
  from:          AgentId | 'user';
  to:            AgentId | 'broadcast';
  type:          'request' | 'response' | 'event' | 'error';
  payload:       unknown;
  timestamp:     number;              // Date.now()
  legalBasis?:   string[];            // legal citations emitted by this message
  parentTraceId?: string;             // for child / sub-traces
}

/** Contract every P6 agent must implement. */
export interface IAgent {
  readonly id:   AgentId;
  readonly name: string;
  process(msg: AgentMessage): Promise<AgentMessage>;
  getCapabilities(): string[];
}
