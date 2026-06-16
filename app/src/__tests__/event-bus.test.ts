/**
 * P6-11B: EventBus — test suite (56 tests, EB1–EB12).
 *
 * Plain TypeScript — no JSX.  The EventBus class has no browser-API
 * dependencies, so no renderToString is needed here.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  EventBus,
  type EventListener,
  type EventPayload,
  type SubscriptionToken,
} from '../providers/EventBus';

// ─── EB1: Constructor and basics (5 tests) ────────────────────────────────────

describe('EB1: constructor and basics', () => {
  it('EB1-01: new EventBus() does not throw', () => {
    expect(() => new EventBus()).not.toThrow();
  });

  it('EB1-02: listenerCount() returns 0 on an empty bus', () => {
    const bus = new EventBus();
    expect(bus.listenerCount()).toBe(0);
  });

  it('EB1-03: listenerCount(eventName) returns 0 for an unknown event', () => {
    const bus = new EventBus();
    expect(bus.listenerCount('unknown')).toBe(0);
  });

  it('EB1-04: publish() on an event with no listeners returns ok:true', () => {
    const bus = new EventBus();
    const r = bus.publish('no-listeners');
    expect(r.ok).toBe(true);
  });

  it('EB1-05: publish() on an empty bus returns listenerCount:0 in result', () => {
    const bus = new EventBus();
    const r = bus.publish('empty');
    expect(r.ok && r.value.listenerCount).toBe(0);
  });
});

// ─── EB2: subscribe() — valid registration (5 tests) ─────────────────────────

describe('EB2: subscribe() valid registration', () => {
  let bus: EventBus;
  beforeEach(() => { bus = new EventBus(); });

  it('EB2-01: subscribe() returns ok:true', () => {
    const r = bus.subscribe('evt', () => {});
    expect(r.ok).toBe(true);
  });

  it('EB2-02: token.id is a positive integer', () => {
    const r = bus.subscribe('evt', () => {});
    expect(r.ok && r.value.id).toBeGreaterThan(0);
  });

  it('EB2-03: token.eventName matches the registered event', () => {
    const r = bus.subscribe('my-event', () => {});
    expect(r.ok && r.value.eventName).toBe('my-event');
  });

  it('EB2-04: listenerCount increases after subscribe', () => {
    bus.subscribe('ev', () => {});
    expect(bus.listenerCount('ev')).toBe(1);
  });

  it('EB2-05: second subscribe to same event increments count to 2', () => {
    bus.subscribe('ev', () => {});
    bus.subscribe('ev', () => {});
    expect(bus.listenerCount('ev')).toBe(2);
  });
});

// ─── EB3: unsubscribe() (5 tests) ────────────────────────────────────────────

describe('EB3: unsubscribe()', () => {
  let bus: EventBus;
  beforeEach(() => { bus = new EventBus(); });

  it('EB3-01: unsubscribe() with a valid token returns ok:true', () => {
    const sub = bus.subscribe('ev', () => {});
    if (!sub.ok) throw new Error('subscribe failed');
    const r = bus.unsubscribe(sub.value);
    expect(r.ok).toBe(true);
  });

  it('EB3-02: listenerCount decreases after unsubscribe', () => {
    const sub = bus.subscribe('ev', () => {});
    if (!sub.ok) throw new Error('subscribe failed');
    bus.unsubscribe(sub.value);
    expect(bus.listenerCount('ev')).toBe(0);
  });

  it('EB3-03: unsubscribe() twice with same token returns LISTENER_NOT_FOUND', () => {
    const sub = bus.subscribe('ev', () => {});
    if (!sub.ok) throw new Error('subscribe failed');
    bus.unsubscribe(sub.value);
    const r = bus.unsubscribe(sub.value);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.code).toBe('LISTENER_NOT_FOUND');
  });

  it('EB3-04: unsubscribe() with a fabricated token returns LISTENER_NOT_FOUND', () => {
    bus.subscribe('ev', () => {});
    const fakeToken: SubscriptionToken = { id: 9999, eventName: 'ev' };
    const r = bus.unsubscribe(fakeToken);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.code).toBe('LISTENER_NOT_FOUND');
  });

  it('EB3-05: unsubscribing one listener does not affect another on the same event', () => {
    const s1 = bus.subscribe('ev', () => {});
    bus.subscribe('ev', () => {});
    if (!s1.ok) throw new Error('subscribe failed');
    bus.unsubscribe(s1.value);
    expect(bus.listenerCount('ev')).toBe(1);
  });
});

// ─── EB4: publish() — basic dispatch (5 tests) ───────────────────────────────

describe('EB4: publish() basic dispatch', () => {
  let bus: EventBus;
  beforeEach(() => { bus = new EventBus(); });

  it('EB4-01: publish() calls the registered listener', () => {
    const spy = vi.fn();
    bus.subscribe('ping', spy);
    bus.publish('ping');
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('EB4-02: listener receives correct event name in payload', () => {
    let receivedName: string | undefined;
    bus.subscribe('greet', (e: EventPayload) => { receivedName = e.name; });
    bus.publish('greet');
    expect(receivedName).toBe('greet');
  });

  it('EB4-03: listener receives the published data', () => {
    let received: unknown;
    bus.subscribe('data-event', (e: EventPayload) => { received = e.data; });
    bus.publish('data-event', { value: 42 });
    expect((received as { value: number }).value).toBe(42);
  });

  it('EB4-04: listener receives a numeric timestamp', () => {
    let ts: unknown;
    bus.subscribe('ts-event', (e: EventPayload) => { ts = e.timestamp; });
    bus.publish('ts-event');
    expect(typeof ts).toBe('number');
    expect(ts as number).toBeGreaterThan(0);
  });

  it('EB4-05: publish() returns ok:true with successCount:1', () => {
    bus.subscribe('ok-event', () => {});
    const r = bus.publish('ok-event');
    expect(r.ok && r.value.successCount).toBe(1);
  });
});

// ─── EB5: publish() — multiple listeners (5 tests) ───────────────────────────

describe('EB5: publish() multiple listeners', () => {
  let bus: EventBus;
  beforeEach(() => { bus = new EventBus(); });

  it('EB5-01: all registered listeners are called', () => {
    const s1 = vi.fn();
    const s2 = vi.fn();
    const s3 = vi.fn();
    bus.subscribe('multi', s1);
    bus.subscribe('multi', s2);
    bus.subscribe('multi', s3);
    bus.publish('multi');
    expect(s1).toHaveBeenCalledTimes(1);
    expect(s2).toHaveBeenCalledTimes(1);
    expect(s3).toHaveBeenCalledTimes(1);
  });

  it('EB5-02: listeners are called in registration order', () => {
    const order: number[] = [];
    bus.subscribe('order', () => { order.push(1); });
    bus.subscribe('order', () => { order.push(2); });
    bus.subscribe('order', () => { order.push(3); });
    bus.publish('order');
    expect(order).toEqual([1, 2, 3]);
  });

  it('EB5-03: publish() result.listenerCount matches subscription count', () => {
    bus.subscribe('cnt', () => {});
    bus.subscribe('cnt', () => {});
    const r = bus.publish('cnt');
    expect(r.ok && r.value.listenerCount).toBe(2);
  });

  it('EB5-04: publish() result.successCount matches number of non-throwing listeners', () => {
    bus.subscribe('suc', () => {});
    bus.subscribe('suc', () => {});
    const r = bus.publish('suc');
    expect(r.ok && r.value.successCount).toBe(2);
  });

  it('EB5-05: each listener receives the same payload object shape', () => {
    const payloads: EventPayload[] = [];
    const capture: EventListener = (e) => { payloads.push(e); };
    bus.subscribe('same', capture);
    bus.subscribe('same', capture);
    bus.publish('same', 'hello');
    expect(payloads[0].data).toBe(payloads[1].data);
    expect(payloads[0].name).toBe(payloads[1].name);
  });
});

// ─── EB6: publish() — listener failure isolation (4 tests) ───────────────────

describe('EB6: publish() listener failure isolation', () => {
  let bus: EventBus;
  beforeEach(() => { bus = new EventBus(); });

  it('EB6-01: a throwing listener does not prevent subsequent listeners from running', () => {
    const after = vi.fn();
    bus.subscribe('fail-event', () => { throw new Error('boom'); });
    bus.subscribe('fail-event', after);
    bus.publish('fail-event');
    expect(after).toHaveBeenCalledTimes(1);
  });

  it('EB6-02: failureCount reflects the number of throwing listeners', () => {
    bus.subscribe('fail-event', () => { throw new Error('err1'); });
    bus.subscribe('fail-event', () => { throw new Error('err2'); });
    bus.subscribe('fail-event', () => {});
    const r = bus.publish('fail-event');
    expect(r.ok && r.value.failureCount).toBe(2);
  });

  it('EB6-03: errors array contains one entry per throwing listener', () => {
    bus.subscribe('err-event', () => { throw new Error('oops'); });
    const r = bus.publish('err-event');
    expect(r.ok && r.value.errors.length).toBe(1);
    expect(r.ok && r.value.errors[0].error).toBeInstanceOf(Error);
  });

  it('EB6-04: successCount correctly counts non-throwing listeners amid failures', () => {
    bus.subscribe('mixed', () => {});
    bus.subscribe('mixed', () => { throw new Error('bad'); });
    bus.subscribe('mixed', () => {});
    const r = bus.publish('mixed');
    expect(r.ok && r.value.successCount).toBe(2);
  });
});

// ─── EB7: listenerCount() (5 tests) ──────────────────────────────────────────

describe('EB7: listenerCount()', () => {
  let bus: EventBus;
  beforeEach(() => { bus = new EventBus(); });

  it('EB7-01: returns 0 with no arguments on an empty bus', () => {
    expect(bus.listenerCount()).toBe(0);
  });

  it('EB7-02: returns total count across all events when called with no args', () => {
    bus.subscribe('a', () => {});
    bus.subscribe('a', () => {});
    bus.subscribe('b', () => {});
    expect(bus.listenerCount()).toBe(3);
  });

  it('EB7-03: returns per-event count when called with an event name', () => {
    bus.subscribe('x', () => {});
    bus.subscribe('x', () => {});
    bus.subscribe('y', () => {});
    expect(bus.listenerCount('x')).toBe(2);
    expect(bus.listenerCount('y')).toBe(1);
  });

  it('EB7-04: returns 0 for an unknown event name', () => {
    bus.subscribe('known', () => {});
    expect(bus.listenerCount('unknown')).toBe(0);
  });

  it('EB7-05: updates correctly after subscribe then unsubscribe', () => {
    const sub = bus.subscribe('ev', () => {});
    expect(bus.listenerCount('ev')).toBe(1);
    if (sub.ok) bus.unsubscribe(sub.value);
    expect(bus.listenerCount('ev')).toBe(0);
    expect(bus.listenerCount()).toBe(0);
  });
});

// ─── EB8: clear() (4 tests) ──────────────────────────────────────────────────

describe('EB8: clear()', () => {
  let bus: EventBus;
  beforeEach(() => {
    bus = new EventBus();
    bus.subscribe('a', () => {});
    bus.subscribe('b', () => {});
  });

  it('EB8-01: clear() does not throw', () => {
    expect(() => bus.clear()).not.toThrow();
  });

  it('EB8-02: listenerCount() returns 0 after clear()', () => {
    bus.clear();
    expect(bus.listenerCount()).toBe(0);
  });

  it('EB8-03: listenerCount(eventName) returns 0 after clear()', () => {
    bus.clear();
    expect(bus.listenerCount('a')).toBe(0);
  });

  it('EB8-04: publish() after clear() returns listenerCount:0 in result', () => {
    bus.clear();
    const r = bus.publish('a');
    expect(r.ok && r.value.listenerCount).toBe(0);
  });
});

// ─── EB9: registration order preservation (4 tests) ──────────────────────────

describe('EB9: registration order', () => {
  let bus: EventBus;
  beforeEach(() => { bus = new EventBus(); });

  it('EB9-01: listeners are called first-subscribed first-called', () => {
    const seq: string[] = [];
    bus.subscribe('order', () => { seq.push('first'); });
    bus.subscribe('order', () => { seq.push('second'); });
    bus.publish('order');
    expect(seq[0]).toBe('first');
    expect(seq[1]).toBe('second');
  });

  it('EB9-02: later subscribers receive later positions', () => {
    const seq: number[] = [];
    for (let i = 1; i <= 5; i++) {
      const n = i;
      bus.subscribe('nums', () => { seq.push(n); });
    }
    bus.publish('nums');
    expect(seq).toEqual([1, 2, 3, 4, 5]);
  });

  it('EB9-03: after unsubscribing a middle listener, remaining keep their relative order', () => {
    const seq: string[] = [];
    bus.subscribe('mid', () => { seq.push('A'); });
    const midSub = bus.subscribe('mid', () => { seq.push('B'); });
    bus.subscribe('mid', () => { seq.push('C'); });
    if (midSub.ok) bus.unsubscribe(midSub.value);
    bus.publish('mid');
    expect(seq).toEqual(['A', 'C']);
  });

  it('EB9-04: re-subscribing after unsubscribe appends to the end', () => {
    const seq: string[] = [];
    const s1 = bus.subscribe('reorder', () => { seq.push('X'); });
    bus.subscribe('reorder', () => { seq.push('Y'); });
    if (s1.ok) bus.unsubscribe(s1.value);
    bus.subscribe('reorder', () => { seq.push('X-new'); });
    bus.publish('reorder');
    expect(seq).toEqual(['Y', 'X-new']);
  });
});

// ─── EB10: publish() returns accurate result metadata (3 tests) ──────────────

describe('EB10: publish() result metadata', () => {
  let bus: EventBus;
  beforeEach(() => { bus = new EventBus(); });

  it('EB10-01: result.eventName matches the published event name', () => {
    const r = bus.publish('target-event');
    expect(r.ok && r.value.eventName).toBe('target-event');
  });

  it('EB10-02: result.listenerCount is accurate for a populated channel', () => {
    bus.subscribe('meta', () => {});
    bus.subscribe('meta', () => {});
    bus.subscribe('meta', () => {});
    const r = bus.publish('meta');
    expect(r.ok && r.value.listenerCount).toBe(3);
  });

  it('EB10-03: result.errors is always an array (even with no failures)', () => {
    bus.subscribe('clean', () => {});
    const r = bus.publish('clean');
    expect(r.ok && Array.isArray(r.value.errors)).toBe(true);
    expect(r.ok && r.value.errors.length).toBe(0);
  });
});

// ─── EB11: defensive copy during publish (4 tests) ───────────────────────────

describe('EB11: defensive copy during publish', () => {
  let bus: EventBus;
  beforeEach(() => { bus = new EventBus(); });

  it('EB11-01: a listener that unsubscribes itself does not prevent remaining listeners', () => {
    const after = vi.fn();
    let selfToken: SubscriptionToken | null = null;

    const sub = bus.subscribe('self-unsub', () => {
      if (selfToken) bus.unsubscribe(selfToken);
    });
    if (sub.ok) selfToken = sub.value;
    bus.subscribe('self-unsub', after);

    bus.publish('self-unsub');
    expect(after).toHaveBeenCalledTimes(1);
  });

  it('EB11-02: a listener that subscribes a new listener does not affect current publish', () => {
    const newListener = vi.fn();
    bus.subscribe('late-add', () => {
      bus.subscribe('late-add', newListener);
    });
    bus.publish('late-add');
    expect(newListener).not.toHaveBeenCalled();
  });

  it('EB11-03: result.listenerCount reflects the snapshot taken before dispatch', () => {
    bus.subscribe('snap', () => {
      bus.subscribe('snap', () => {});
    });
    const r = bus.publish('snap');
    // Only 1 listener was present when publish started
    expect(r.ok && r.value.listenerCount).toBe(1);
  });

  it('EB11-04: subsequent publish sees the new listener added during previous publish', () => {
    const lateListener = vi.fn();
    bus.subscribe('snap2', () => {
      bus.subscribe('snap2', lateListener);
    });
    bus.publish('snap2');              // lateListener not called yet
    bus.publish('snap2');              // lateListener is now registered
    expect(lateListener).toHaveBeenCalledTimes(1);
  });
});

// ─── EB12: malformed input and never-throw (7 tests) ─────────────────────────

describe('EB12: malformed input and never-throw', () => {
  let bus: EventBus;
  beforeEach(() => { bus = new EventBus(); });

  it('EB12-01: subscribe() with empty event name returns INVALID_EVENT_NAME', () => {
    const r = bus.subscribe('', () => {});
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.code).toBe('INVALID_EVENT_NAME');
  });

  it('EB12-02: subscribe() with non-string event name returns INVALID_EVENT_NAME', () => {
    const r = bus.subscribe(42 as unknown as string, () => {});
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.code).toBe('INVALID_EVENT_NAME');
  });

  it('EB12-03: subscribe() with non-function listener returns INVALID_LISTENER', () => {
    const r = bus.subscribe('ev', 'not-a-fn' as unknown as EventListener);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.code).toBe('INVALID_LISTENER');
  });

  it('EB12-04: unsubscribe() with null token returns an error', () => {
    const r = bus.unsubscribe(null as unknown as SubscriptionToken);
    expect(r.ok).toBe(false);
  });

  it('EB12-05: publish() with empty event name returns INVALID_EVENT_NAME', () => {
    const r = bus.publish('');
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.code).toBe('INVALID_EVENT_NAME');
  });

  it('EB12-06: publish() with non-string event name returns INVALID_EVENT_NAME', () => {
    const r = bus.publish(null as unknown as string);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.code).toBe('INVALID_EVENT_NAME');
  });

  it('EB12-07: listenerCount() with non-string argument returns 0 and never throws', () => {
    bus.subscribe('real', () => {});
    expect(() => bus.listenerCount(42 as unknown as string)).not.toThrow();
    expect(bus.listenerCount(42 as unknown as string)).toBe(0);
  });
});
