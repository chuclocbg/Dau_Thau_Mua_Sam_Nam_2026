/**
 * Phase 11.5.5 — Governance Event Integration
 *
 * Publish/subscribe event bus for the Governance Configuration Platform.
 * No module calls Configuration directly — events are the integration
 * boundary between governance domains.
 *
 * Event types:
 *   LegalUpdated            — a legal document was created, amended, superseded, or repealed
 *   ImpactAnalyzed          — impact analysis completed (from GovernanceImpactEngine)
 *   ConfigurationInvalidated— a configuration object was determined invalid
 *   ConfigurationUpdated    — a configuration object was created or revised
 *
 * Usage pattern:
 *   const bus = createGovernanceEventBus();
 *   const unsub = bus.subscribe('LegalUpdated', handler);
 *   bus.publish(createGovernanceEvent('LegalUpdated', payload));
 *   unsub();  // removes the handler
 *
 * Extension interfaces for future modules are declared here (not implemented):
 *   RuleEngineHook, WorkflowEngineHook, DocumentGeneratorHook,
 *   AuthorityEngineHook, ExecutiveCopilotHook
 *
 * Multiple subscribers per event type are supported.
 * Events are dispatched synchronously in subscribe order.
 * Two buses are completely isolated — events do not cross bus boundaries.
 *
 * Pure. No I/O. No side effects. No any. No React. No browser globals.
 */

// ─── Event types ──────────────────────────────────────────────────────────────

export type GovernanceEventType =
  | 'LegalUpdated'
  | 'ImpactAnalyzed'
  | 'ConfigurationInvalidated'
  | 'ConfigurationUpdated';

export const GOVERNANCE_EVENT_TYPES: readonly GovernanceEventType[] = [
  'LegalUpdated',
  'ImpactAnalyzed',
  'ConfigurationInvalidated',
  'ConfigurationUpdated',
];

// ─── Event envelope ───────────────────────────────────────────────────────────

export interface GovernanceEvent<T = unknown> {
  readonly type:       GovernanceEventType;
  readonly occurredAt: string;   // ISO-8601 timestamp
  readonly payload:    T;
}

// ─── Payload types ────────────────────────────────────────────────────────────

export interface LegalUpdatedPayload {
  readonly documentId:   string;
  readonly changeType:   'CREATED' | 'AMENDED' | 'SUPERSEDED' | 'REPEALED';
  readonly impactedIds?: readonly string[];
}

export interface ImpactAnalyzedPayload {
  readonly sourceNodeId:  string;
  readonly impactCount:   number;
  readonly criticalCount: number;
}

export interface ConfigurationInvalidatedPayload {
  readonly configId: string;
  readonly reason:   string;
}

export interface ConfigurationUpdatedPayload {
  readonly configId: string;
  readonly version:  string;
}

// ─── Event bus ────────────────────────────────────────────────────────────────

export type EventHandler<T = unknown> = (event: GovernanceEvent<T>) => void;

export interface GovernanceEventBus {
  /** Dispatches event to all handlers registered for event.type. */
  publish<T>(event: GovernanceEvent<T>): void;
  /**
   * Registers handler for events of the given type.
   * Returns an unsubscribe function — call it to deregister the handler.
   */
  subscribe<T>(type: GovernanceEventType, handler: EventHandler<T>): () => void;
}

// ─── Factory helpers ──────────────────────────────────────────────────────────

/** Creates a typed event with the current UTC timestamp. */
export function createGovernanceEvent<T>(
  type:    GovernanceEventType,
  payload: T,
): GovernanceEvent<T> {
  return { type, occurredAt: new Date().toISOString(), payload };
}

/** Creates a new, isolated in-process event bus. */
export function createGovernanceEventBus(): GovernanceEventBus {
  const registry = new Map<GovernanceEventType, Set<EventHandler<unknown>>>();

  function bucket(type: GovernanceEventType): Set<EventHandler<unknown>> {
    if (!registry.has(type)) registry.set(type, new Set());
    return registry.get(type)!;
  }

  return {
    publish<T>(event: GovernanceEvent<T>): void {
      for (const handler of bucket(event.type)) {
        handler(event as GovernanceEvent<unknown>);
      }
    },
    subscribe<T>(type: GovernanceEventType, handler: EventHandler<T>): () => void {
      const set = bucket(type);
      set.add(handler as EventHandler<unknown>);
      return () => set.delete(handler as EventHandler<unknown>);
    },
  };
}

// ─── Extension point interfaces (Phase 11.6+) ────────────────────────────────

/** Future — Rule Engine: react to configuration changes. */
export interface RuleEngineHook {
  onConfigurationUpdated(payload: ConfigurationUpdatedPayload): void;
}

/** Future — Workflow Engine: react to legal updates. */
export interface WorkflowEngineHook {
  onLegalUpdated(payload: LegalUpdatedPayload): void;
}

/** Future — Document Generator: regenerate affected templates. */
export interface DocumentGeneratorHook {
  onTemplateUpdated(configId: string): void;
}

/** Future — Authority Engine: recompute approval chains. */
export interface AuthorityEngineHook {
  onAuthorityUpdated(configId: string): void;
}

/** Future — Executive Copilot: summarize impact for executive review. */
export interface ExecutiveCopilotHook {
  onImpactAnalyzed(payload: ImpactAnalyzedPayload): void;
}
