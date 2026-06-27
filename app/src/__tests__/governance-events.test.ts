/**
 * Phase 11.5.5 — Governance Events tests
 *
 * Groups (13 × 3 = 39):
 *   GE-01  (3)  createGovernanceEventBus creates a bus
 *   GE-02  (3)  publish + subscribe round-trip for LegalUpdated
 *   GE-03  (3)  subscribe returns an unsubscribe function
 *   GE-04  (3)  unsubscribe stops the handler from receiving events
 *   GE-05  (3)  multiple subscribers receive the same event
 *   GE-06  (3)  createGovernanceEvent creates a well-formed event
 *   GE-07  (3)  ImpactAnalyzed event round-trip
 *   GE-08  (3)  ConfigurationInvalidated event round-trip
 *   GE-09  (3)  ConfigurationUpdated event round-trip
 *   GE-10  (3)  subscribe to multiple event types independently
 *   GE-11  (3)  publish with no subscribers does not throw
 *   GE-12  (3)  two buses are isolated — events do not cross bus boundaries
 *   GE-13  (3)  unsubscribe one of several handlers
 */

import { describe, it, expect, vi } from 'vitest';
import {
  createGovernanceEventBus,
  createGovernanceEvent,
  GOVERNANCE_EVENT_TYPES,
} from '../legal/governanceEvents';
import type {
  LegalUpdatedPayload,
  ImpactAnalyzedPayload,
  ConfigurationInvalidatedPayload,
  ConfigurationUpdatedPayload,
  GovernanceEvent,
} from '../legal/governanceEvents';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const LEGAL_PAYLOAD: LegalUpdatedPayload = {
  documentId: 'luat-22-2023', changeType: 'AMENDED', impactedIds: ['thresh-a'],
};
const IMPACT_PAYLOAD: ImpactAnalyzedPayload = {
  sourceNodeId: 'nd-214-2025', impactCount: 4, criticalCount: 1,
};
const INVALIDATED_PAYLOAD: ConfigurationInvalidatedPayload = {
  configId: 'thresh-a', reason: 'Legal source superseded',
};
const UPDATED_PAYLOAD: ConfigurationUpdatedPayload = {
  configId: 'thresh-a', version: '2.0.0',
};

// ── GE-01 createGovernanceEventBus ───────────────────────────────────────────

describe('GE-01 createGovernanceEventBus', () => {
  it('GE-01-01 createGovernanceEventBus returns an object with publish and subscribe', () => {
    const bus = createGovernanceEventBus();
    expect(typeof bus.publish).toBe('function');
    expect(typeof bus.subscribe).toBe('function');
  });

  it('GE-01-02 each call creates a new independent bus', () => {
    const bus1 = createGovernanceEventBus();
    const bus2 = createGovernanceEventBus();
    expect(bus1).not.toBe(bus2);
  });

  it('GE-01-03 GOVERNANCE_EVENT_TYPES contains all 4 event types', () => {
    expect(GOVERNANCE_EVENT_TYPES).toHaveLength(4);
    expect(GOVERNANCE_EVENT_TYPES).toContain('LegalUpdated');
    expect(GOVERNANCE_EVENT_TYPES).toContain('ImpactAnalyzed');
  });
});

// ── GE-02 publish + subscribe LegalUpdated ────────────────────────────────────

describe('GE-02 LegalUpdated round-trip', () => {
  it('GE-02-01 handler is called when a LegalUpdated event is published', () => {
    const bus     = createGovernanceEventBus();
    const handler = vi.fn();
    bus.subscribe('LegalUpdated', handler);
    bus.publish(createGovernanceEvent('LegalUpdated', LEGAL_PAYLOAD));
    expect(handler).toHaveBeenCalledOnce();
  });

  it('GE-02-02 handler receives the correct payload', () => {
    const bus      = createGovernanceEventBus();
    let received: GovernanceEvent<LegalUpdatedPayload> | undefined;
    bus.subscribe<LegalUpdatedPayload>('LegalUpdated', e => { received = e; });
    bus.publish(createGovernanceEvent('LegalUpdated', LEGAL_PAYLOAD));
    expect(received?.payload.documentId).toBe('luat-22-2023');
    expect(received?.payload.changeType).toBe('AMENDED');
  });

  it('GE-02-03 handler is NOT called for a different event type', () => {
    const bus     = createGovernanceEventBus();
    const handler = vi.fn();
    bus.subscribe('LegalUpdated', handler);
    bus.publish(createGovernanceEvent('ConfigurationUpdated', UPDATED_PAYLOAD));
    expect(handler).not.toHaveBeenCalled();
  });
});

// ── GE-03 subscribe returns unsubscribe ───────────────────────────────────────

describe('GE-03 subscribe returns unsubscribe', () => {
  it('GE-03-01 subscribe returns a function', () => {
    const bus  = createGovernanceEventBus();
    const unsub = bus.subscribe('LegalUpdated', () => { /* noop */ });
    expect(typeof unsub).toBe('function');
  });

  it('GE-03-02 calling the returned function removes the handler', () => {
    const bus     = createGovernanceEventBus();
    const handler = vi.fn();
    const unsub   = bus.subscribe('LegalUpdated', handler);
    unsub();
    bus.publish(createGovernanceEvent('LegalUpdated', LEGAL_PAYLOAD));
    expect(handler).not.toHaveBeenCalled();
  });

  it('GE-03-03 unsubscribe is idempotent (calling twice does not throw)', () => {
    const bus   = createGovernanceEventBus();
    const unsub = bus.subscribe('LegalUpdated', () => { /* noop */ });
    unsub();
    expect(() => unsub()).not.toThrow();
  });
});

// ── GE-04 unsubscribe stops future events ────────────────────────────────────

describe('GE-04 unsubscribe stops events', () => {
  it('GE-04-01 handler is called before unsubscribe but not after', () => {
    const bus     = createGovernanceEventBus();
    const handler = vi.fn();
    const unsub   = bus.subscribe('LegalUpdated', handler);
    bus.publish(createGovernanceEvent('LegalUpdated', LEGAL_PAYLOAD));
    unsub();
    bus.publish(createGovernanceEvent('LegalUpdated', LEGAL_PAYLOAD));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('GE-04-02 handler receives events published before unsub and misses those after', () => {
    const bus     = createGovernanceEventBus();
    const calls:  string[] = [];
    const unsub   = bus.subscribe<LegalUpdatedPayload>('LegalUpdated', e => calls.push(e.payload.documentId));
    bus.publish(createGovernanceEvent('LegalUpdated', { documentId: 'first', changeType: 'CREATED' }));
    unsub();
    bus.publish(createGovernanceEvent('LegalUpdated', { documentId: 'second', changeType: 'AMENDED' }));
    expect(calls).toEqual(['first']);
  });

  it('GE-04-03 other handlers are not affected by an unrelated unsubscribe', () => {
    const bus     = createGovernanceEventBus();
    const h1      = vi.fn();
    const h2      = vi.fn();
    const unsub1  = bus.subscribe('LegalUpdated', h1);
    bus.subscribe('LegalUpdated', h2);
    unsub1();
    bus.publish(createGovernanceEvent('LegalUpdated', LEGAL_PAYLOAD));
    expect(h1).not.toHaveBeenCalled();
    expect(h2).toHaveBeenCalledOnce();
  });
});

// ── GE-05 multiple subscribers ───────────────────────────────────────────────

describe('GE-05 multiple subscribers', () => {
  it('GE-05-01 all subscribers receive the same event', () => {
    const bus = createGovernanceEventBus();
    const h1  = vi.fn();
    const h2  = vi.fn();
    const h3  = vi.fn();
    bus.subscribe('LegalUpdated', h1);
    bus.subscribe('LegalUpdated', h2);
    bus.subscribe('LegalUpdated', h3);
    bus.publish(createGovernanceEvent('LegalUpdated', LEGAL_PAYLOAD));
    expect(h1).toHaveBeenCalledOnce();
    expect(h2).toHaveBeenCalledOnce();
    expect(h3).toHaveBeenCalledOnce();
  });

  it('GE-05-02 each handler receives the same event payload', () => {
    const bus       = createGovernanceEventBus();
    const received: unknown[] = [];
    bus.subscribe<LegalUpdatedPayload>('LegalUpdated', e => received.push(e.payload));
    bus.subscribe<LegalUpdatedPayload>('LegalUpdated', e => received.push(e.payload));
    bus.publish(createGovernanceEvent('LegalUpdated', LEGAL_PAYLOAD));
    expect(received).toHaveLength(2);
    expect((received[0] as LegalUpdatedPayload).documentId).toBe('luat-22-2023');
  });

  it('GE-05-03 publishing twice calls each handler twice', () => {
    const bus     = createGovernanceEventBus();
    const handler = vi.fn();
    bus.subscribe('LegalUpdated', handler);
    bus.publish(createGovernanceEvent('LegalUpdated', LEGAL_PAYLOAD));
    bus.publish(createGovernanceEvent('LegalUpdated', LEGAL_PAYLOAD));
    expect(handler).toHaveBeenCalledTimes(2);
  });
});

// ── GE-06 createGovernanceEvent ──────────────────────────────────────────────

describe('GE-06 createGovernanceEvent', () => {
  it('GE-06-01 event.type matches the given type', () => {
    const event = createGovernanceEvent('LegalUpdated', LEGAL_PAYLOAD);
    expect(event.type).toBe('LegalUpdated');
  });

  it('GE-06-02 event.payload matches the given payload', () => {
    const event = createGovernanceEvent('LegalUpdated', LEGAL_PAYLOAD);
    expect(event.payload).toBe(LEGAL_PAYLOAD);
  });

  it('GE-06-03 event.occurredAt is an ISO-8601 timestamp', () => {
    const event = createGovernanceEvent('LegalUpdated', LEGAL_PAYLOAD);
    expect(event.occurredAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});

// ── GE-07 ImpactAnalyzed event ────────────────────────────────────────────────

describe('GE-07 ImpactAnalyzed event', () => {
  it('GE-07-01 ImpactAnalyzed event is received by subscriber', () => {
    const bus     = createGovernanceEventBus();
    const handler = vi.fn();
    bus.subscribe('ImpactAnalyzed', handler);
    bus.publish(createGovernanceEvent('ImpactAnalyzed', IMPACT_PAYLOAD));
    expect(handler).toHaveBeenCalledOnce();
  });

  it('GE-07-02 payload fields are correct', () => {
    const bus = createGovernanceEventBus();
    let got: ImpactAnalyzedPayload | undefined;
    bus.subscribe<ImpactAnalyzedPayload>('ImpactAnalyzed', e => { got = e.payload; });
    bus.publish(createGovernanceEvent('ImpactAnalyzed', IMPACT_PAYLOAD));
    expect(got?.sourceNodeId).toBe('nd-214-2025');
    expect(got?.criticalCount).toBe(1);
  });

  it('GE-07-03 LegalUpdated subscriber does not receive ImpactAnalyzed events', () => {
    const bus     = createGovernanceEventBus();
    const handler = vi.fn();
    bus.subscribe('LegalUpdated', handler);
    bus.publish(createGovernanceEvent('ImpactAnalyzed', IMPACT_PAYLOAD));
    expect(handler).not.toHaveBeenCalled();
  });
});

// ── GE-08 ConfigurationInvalidated event ─────────────────────────────────────

describe('GE-08 ConfigurationInvalidated event', () => {
  it('GE-08-01 subscriber receives the event', () => {
    const bus     = createGovernanceEventBus();
    const handler = vi.fn();
    bus.subscribe('ConfigurationInvalidated', handler);
    bus.publish(createGovernanceEvent('ConfigurationInvalidated', INVALIDATED_PAYLOAD));
    expect(handler).toHaveBeenCalledOnce();
  });

  it('GE-08-02 payload.configId is correct', () => {
    const bus = createGovernanceEventBus();
    let got: ConfigurationInvalidatedPayload | undefined;
    bus.subscribe<ConfigurationInvalidatedPayload>('ConfigurationInvalidated', e => { got = e.payload; });
    bus.publish(createGovernanceEvent('ConfigurationInvalidated', INVALIDATED_PAYLOAD));
    expect(got?.configId).toBe('thresh-a');
    expect(got?.reason).toContain('superseded');
  });

  it('GE-08-03 event.type is ConfigurationInvalidated', () => {
    const event = createGovernanceEvent('ConfigurationInvalidated', INVALIDATED_PAYLOAD);
    expect(event.type).toBe('ConfigurationInvalidated');
  });
});

// ── GE-09 ConfigurationUpdated event ─────────────────────────────────────────

describe('GE-09 ConfigurationUpdated event', () => {
  it('GE-09-01 subscriber receives the event', () => {
    const bus     = createGovernanceEventBus();
    const handler = vi.fn();
    bus.subscribe('ConfigurationUpdated', handler);
    bus.publish(createGovernanceEvent('ConfigurationUpdated', UPDATED_PAYLOAD));
    expect(handler).toHaveBeenCalledOnce();
  });

  it('GE-09-02 payload.version is correct', () => {
    const bus = createGovernanceEventBus();
    let got: ConfigurationUpdatedPayload | undefined;
    bus.subscribe<ConfigurationUpdatedPayload>('ConfigurationUpdated', e => { got = e.payload; });
    bus.publish(createGovernanceEvent('ConfigurationUpdated', UPDATED_PAYLOAD));
    expect(got?.version).toBe('2.0.0');
  });

  it('GE-09-03 event type is ConfigurationUpdated', () => {
    const event = createGovernanceEvent('ConfigurationUpdated', UPDATED_PAYLOAD);
    expect(event.type).toBe('ConfigurationUpdated');
  });
});

// ── GE-10 subscribe to multiple types independently ───────────────────────────

describe('GE-10 subscribe multiple types', () => {
  it('GE-10-01 subscriptions on different types do not cross-fire', () => {
    const bus       = createGovernanceEventBus();
    const legal     = vi.fn();
    const impact    = vi.fn();
    bus.subscribe('LegalUpdated',   legal);
    bus.subscribe('ImpactAnalyzed', impact);
    bus.publish(createGovernanceEvent('LegalUpdated', LEGAL_PAYLOAD));
    expect(legal).toHaveBeenCalledOnce();
    expect(impact).not.toHaveBeenCalled();
  });

  it('GE-10-02 both handlers receive events of their respective types', () => {
    const bus    = createGovernanceEventBus();
    const legal  = vi.fn();
    const impact = vi.fn();
    bus.subscribe('LegalUpdated',   legal);
    bus.subscribe('ImpactAnalyzed', impact);
    bus.publish(createGovernanceEvent('LegalUpdated',   LEGAL_PAYLOAD));
    bus.publish(createGovernanceEvent('ImpactAnalyzed', IMPACT_PAYLOAD));
    expect(legal).toHaveBeenCalledOnce();
    expect(impact).toHaveBeenCalledOnce();
  });

  it('GE-10-03 a handler subscribed to all 4 types receives one event per type', () => {
    const bus     = createGovernanceEventBus();
    const handler = vi.fn();
    for (const type of GOVERNANCE_EVENT_TYPES) bus.subscribe(type, handler);
    bus.publish(createGovernanceEvent('LegalUpdated',          LEGAL_PAYLOAD));
    bus.publish(createGovernanceEvent('ImpactAnalyzed',        IMPACT_PAYLOAD));
    bus.publish(createGovernanceEvent('ConfigurationInvalidated', INVALIDATED_PAYLOAD));
    bus.publish(createGovernanceEvent('ConfigurationUpdated',  UPDATED_PAYLOAD));
    expect(handler).toHaveBeenCalledTimes(4);
  });
});

// ── GE-11 publish with no subscribers ────────────────────────────────────────

describe('GE-11 publish no subscribers', () => {
  it('GE-11-01 publishing to a type with no subscribers does not throw', () => {
    const bus = createGovernanceEventBus();
    expect(() => bus.publish(createGovernanceEvent('LegalUpdated', LEGAL_PAYLOAD))).not.toThrow();
  });

  it('GE-11-02 publishing to a different type than the subscription does not call handler', () => {
    const bus     = createGovernanceEventBus();
    const handler = vi.fn();
    bus.subscribe('LegalUpdated', handler);
    expect(() => bus.publish(createGovernanceEvent('ImpactAnalyzed', IMPACT_PAYLOAD))).not.toThrow();
    expect(handler).not.toHaveBeenCalled();
  });

  it('GE-11-03 empty bus can publish and subscribe in any order without error', () => {
    const bus = createGovernanceEventBus();
    bus.publish(createGovernanceEvent('ConfigurationUpdated', UPDATED_PAYLOAD));
    const handler = vi.fn();
    bus.subscribe('ConfigurationUpdated', handler);
    bus.publish(createGovernanceEvent('ConfigurationUpdated', UPDATED_PAYLOAD));
    expect(handler).toHaveBeenCalledOnce();
  });
});

// ── GE-12 bus isolation ───────────────────────────────────────────────────────

describe('GE-12 bus isolation', () => {
  it('GE-12-01 event published on bus A is not received by bus B subscriber', () => {
    const busA    = createGovernanceEventBus();
    const busB    = createGovernanceEventBus();
    const handler = vi.fn();
    busB.subscribe('LegalUpdated', handler);
    busA.publish(createGovernanceEvent('LegalUpdated', LEGAL_PAYLOAD));
    expect(handler).not.toHaveBeenCalled();
  });

  it('GE-12-02 subscriber on bus A does not receive events from bus B', () => {
    const busA    = createGovernanceEventBus();
    const busB    = createGovernanceEventBus();
    const handler = vi.fn();
    busA.subscribe('LegalUpdated', handler);
    busB.publish(createGovernanceEvent('LegalUpdated', LEGAL_PAYLOAD));
    expect(handler).not.toHaveBeenCalled();
  });

  it('GE-12-03 both buses work independently for same event type', () => {
    const busA = createGovernanceEventBus();
    const busB = createGovernanceEventBus();
    const hA   = vi.fn();
    const hB   = vi.fn();
    busA.subscribe('ConfigurationUpdated', hA);
    busB.subscribe('ConfigurationUpdated', hB);
    busA.publish(createGovernanceEvent('ConfigurationUpdated', UPDATED_PAYLOAD));
    expect(hA).toHaveBeenCalledOnce();
    expect(hB).not.toHaveBeenCalled();
  });
});

// ── GE-13 unsubscribe one of several handlers ─────────────────────────────────

describe('GE-13 selective unsubscribe', () => {
  it('GE-13-01 unsubscribing one handler leaves others intact', () => {
    const bus   = createGovernanceEventBus();
    const h1    = vi.fn();
    const h2    = vi.fn();
    const unsub = bus.subscribe('LegalUpdated', h1);
    bus.subscribe('LegalUpdated', h2);
    unsub();
    bus.publish(createGovernanceEvent('LegalUpdated', LEGAL_PAYLOAD));
    expect(h1).not.toHaveBeenCalled();
    expect(h2).toHaveBeenCalledOnce();
  });

  it('GE-13-02 re-subscribing after unsubscribe works correctly', () => {
    const bus   = createGovernanceEventBus();
    const h     = vi.fn();
    const unsub = bus.subscribe('LegalUpdated', h);
    bus.publish(createGovernanceEvent('LegalUpdated', LEGAL_PAYLOAD));
    unsub();
    bus.subscribe('LegalUpdated', h);  // re-subscribe
    bus.publish(createGovernanceEvent('LegalUpdated', LEGAL_PAYLOAD));
    expect(h).toHaveBeenCalledTimes(2);
  });

  it('GE-13-03 unsubscribing all handlers leaves no subscribers', () => {
    const bus   = createGovernanceEventBus();
    const h     = vi.fn();
    const unsub = bus.subscribe('LegalUpdated', h);
    unsub();
    bus.publish(createGovernanceEvent('LegalUpdated', LEGAL_PAYLOAD));
    expect(h).not.toHaveBeenCalled();
  });
});
