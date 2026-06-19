/**
 * P9-01: AgentRegistry — new methods added for live trace wiring — 28 tests
 *
 * Covers:
 *   listTraceIds()  — all trace IDs with logged messages (Map insertion order)
 *   getAllMessages() — flat sorted cross-trace message list
 *   log() notification — 'message' subscribers notified on every append
 *
 * Groups:
 *   AR-01  (7)  listTraceIds() — empty, single, multi-trace, deduplication
 *   AR-02  (7)  getAllMessages() — empty, single, multi-trace, sort order
 *   AR-03  (7)  log() notification via 'message' subscription
 *   AR-04  (7)  Integration — subscription-based accumulation matches read methods
 */

import { describe, it, expect, vi } from 'vitest';
import { AgentRegistry } from '../agents/AgentRegistry';
import type { AgentMessage } from '../agents/types';
import { createAgentSystem } from '../components/AgentProviderPanel';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const T_A = 'aaaa0000-0000-0000-0000-000000000001';
const T_B = 'bbbb0000-0000-0000-0000-000000000002';

function msg(traceId: string, timestamp: number, type: AgentMessage['type'] = 'request'): AgentMessage {
  return {
    traceId,
    from:      'user',
    to:        'planner',
    type,
    payload:   {},
    timestamp,
  };
}

// ─── AR-01: listTraceIds() ────────────────────────────────────────────────────

describe('AR-01 · listTraceIds()', () => {
  it('AR-01-01: returns [] when no messages have been logged', () => {
    const reg = new AgentRegistry();
    expect(reg.listTraceIds()).toEqual([]);
  });

  it('AR-01-02: returns one ID after logging one message', () => {
    const reg = new AgentRegistry();
    reg.log(msg(T_A, 1000));
    expect(reg.listTraceIds()).toEqual([T_A]);
  });

  it('AR-01-03: returns two IDs for messages from two distinct traces', () => {
    const reg = new AgentRegistry();
    reg.log(msg(T_A, 1000));
    reg.log(msg(T_B, 2000));
    expect(reg.listTraceIds()).toEqual([T_A, T_B]);
  });

  it('AR-01-04: logging the same traceId twice does not duplicate the ID', () => {
    const reg = new AgentRegistry();
    reg.log(msg(T_A, 1000));
    reg.log(msg(T_A, 2000));
    expect(reg.listTraceIds()).toEqual([T_A]);
    expect(reg.listTraceIds()).toHaveLength(1);
  });

  it('AR-01-05: preserves Map insertion order across multiple traces', () => {
    const reg = new AgentRegistry();
    reg.log(msg(T_B, 1000));
    reg.log(msg(T_A, 2000));
    expect(reg.listTraceIds()).toEqual([T_B, T_A]);
  });

  it('AR-01-06: listTraceIds() reflects every log() call cumulatively', () => {
    const reg = new AgentRegistry();
    const traces = ['tr-1', 'tr-2', 'tr-3'];
    for (const id of traces) reg.log(msg(id, 1000));
    expect(reg.listTraceIds()).toEqual(traces);
  });

  it('AR-01-07: new AgentRegistry always starts with empty listTraceIds()', () => {
    expect(new AgentRegistry().listTraceIds()).toHaveLength(0);
    expect(new AgentRegistry().listTraceIds()).toHaveLength(0);
  });
});

// ─── AR-02: getAllMessages() ──────────────────────────────────────────────────

describe('AR-02 · getAllMessages()', () => {
  it('AR-02-01: returns [] when no messages have been logged', () => {
    expect(new AgentRegistry().getAllMessages()).toEqual([]);
  });

  it('AR-02-02: returns all messages from a single trace', () => {
    const reg = new AgentRegistry();
    const m1 = msg(T_A, 1000);
    const m2 = msg(T_A, 2000, 'response');
    reg.log(m1);
    reg.log(m2);
    const all = reg.getAllMessages();
    expect(all).toHaveLength(2);
    expect(all[0]).toBe(m1);
    expect(all[1]).toBe(m2);
  });

  it('AR-02-03: returns messages from all traces', () => {
    const reg = new AgentRegistry();
    reg.log(msg(T_A, 1000));
    reg.log(msg(T_B, 3000));
    reg.log(msg(T_A, 2000, 'response'));
    expect(reg.getAllMessages()).toHaveLength(3);
  });

  it('AR-02-04: sorts messages ascending by timestamp', () => {
    const reg = new AgentRegistry();
    reg.log(msg(T_B, 3000)); // logged first, highest timestamp
    reg.log(msg(T_A, 1000)); // lowest timestamp
    reg.log(msg(T_A, 2000, 'response'));
    const all = reg.getAllMessages();
    expect(all[0]!.timestamp).toBe(1000);
    expect(all[1]!.timestamp).toBe(2000);
    expect(all[2]!.timestamp).toBe(3000);
  });

  it('AR-02-05: getAllMessages().length equals total number of log() calls', () => {
    const reg = new AgentRegistry();
    for (let i = 0; i < 5; i++) reg.log(msg(T_A, i * 1000));
    for (let i = 0; i < 3; i++) reg.log(msg(T_B, i * 1000 + 100));
    expect(reg.getAllMessages()).toHaveLength(8);
  });

  it('AR-02-06: getAllMessages() content matches getTrace() for each ID', () => {
    const reg = new AgentRegistry();
    reg.log(msg(T_A, 1000));
    reg.log(msg(T_B, 2000));
    reg.log(msg(T_A, 3000, 'response'));
    const all = reg.getAllMessages();
    const fromA = reg.getTrace(T_A);
    const fromB = reg.getTrace(T_B);
    expect(all).toHaveLength(fromA.length + fromB.length);
    for (const m of fromA) expect(all).toContain(m);
    for (const m of fromB) expect(all).toContain(m);
  });

  it('AR-02-07: getAllMessages() is consistent with listTraceIds() length', () => {
    const reg = new AgentRegistry();
    reg.log(msg(T_A, 1000));
    reg.log(msg(T_B, 2000));
    const traceCount = reg.listTraceIds().length;
    const msgCount   = reg.getAllMessages().length;
    expect(traceCount).toBe(2);
    expect(msgCount).toBe(2);
  });
});

// ─── AR-03: log() notification via 'message' subscription ────────────────────

describe('AR-03 · log() notification via message subscription', () => {
  it('AR-03-01: subscribe("message", handler) receives message on log()', () => {
    const reg = new AgentRegistry();
    const received: AgentMessage[] = [];
    reg.subscribe('message', (m) => received.push(m));
    const m = msg(T_A, 1000);
    reg.log(m);
    expect(received).toHaveLength(1);
    expect(received[0]).toBe(m);
  });

  it('AR-03-02: handler receives the exact logged message object', () => {
    const reg = new AgentRegistry();
    let captured: AgentMessage | null = null;
    reg.subscribe('message', (m) => { captured = m; });
    const m = msg(T_A, 5000, 'error');
    reg.log(m);
    expect(captured).toBe(m);
  });

  it('AR-03-03: multiple subscribers are all notified on one log()', () => {
    const reg = new AgentRegistry();
    const calls: number[] = [];
    reg.subscribe('message', () => calls.push(1));
    reg.subscribe('message', () => calls.push(2));
    reg.subscribe('message', () => calls.push(3));
    reg.log(msg(T_A, 1000));
    expect(calls).toEqual([1, 2, 3]);
  });

  it('AR-03-04: handler is not called before the first log()', () => {
    const reg = new AgentRegistry();
    const fn = vi.fn();
    reg.subscribe('message', fn);
    expect(fn).not.toHaveBeenCalled();
  });

  it('AR-03-05: handler is called exactly once per log() call', () => {
    const reg = new AgentRegistry();
    const fn = vi.fn();
    reg.subscribe('message', fn);
    reg.log(msg(T_A, 1000));
    reg.log(msg(T_A, 2000));
    reg.log(msg(T_B, 3000));
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('AR-03-06: subscriber for a different event name is not called by log()', () => {
    const reg = new AgentRegistry();
    const fn = vi.fn();
    reg.subscribe('request', fn);   // event name is 'request', not 'message'
    reg.log(msg(T_A, 1000, 'request'));
    expect(fn).not.toHaveBeenCalled();
  });

  it('AR-03-07: process() via broadcast still triggers both type-event and message-event', () => {
    const reg = new AgentRegistry();
    const msgEvents: AgentMessage[]  = [];
    const typeEvents: AgentMessage[] = [];
    reg.subscribe('message', (m) => msgEvents.push(m));
    reg.subscribe('event',   (m) => typeEvents.push(m));
    const broadcastMsg: AgentMessage = {
      traceId: T_A, from: 'planner', to: 'broadcast',
      type: 'event', payload: {}, timestamp: 1000,
    };
    // process() calls log() (→ 'message' sub) then notifySubscribers(msg.type) (→ 'event' sub)
    reg.process(broadcastMsg).then(() => {
      expect(msgEvents).toHaveLength(1);
      expect(typeEvents).toHaveLength(1);
    });
  });
});

// ─── AR-04: Integration — subscription accumulation matches read methods ───────

describe('AR-04 · Integration — subscription-based accumulation matches read methods', () => {
  it('AR-04-01: accumulating via subscription produces the same messages as getAllMessages()', () => {
    const reg = new AgentRegistry();
    const accumulated: AgentMessage[] = [];
    reg.subscribe('message', (m) => accumulated.push(m));
    reg.log(msg(T_A, 1000));
    reg.log(msg(T_B, 2000));
    reg.log(msg(T_A, 3000, 'response'));
    const all = reg.getAllMessages();
    // getAllMessages() sorts by timestamp; accumulated preserves log() call order
    expect(accumulated).toHaveLength(all.length);
    for (const m of accumulated) expect(all).toContain(m);
  });

  it('AR-04-02: traceIds derived from subscription match listTraceIds()', () => {
    const reg = new AgentRegistry();
    const liveIds = new Set<string>();
    reg.subscribe('message', (m) => liveIds.add(m.traceId));
    reg.log(msg(T_A, 1000));
    reg.log(msg(T_B, 2000));
    reg.log(msg(T_A, 3000));
    expect([...liveIds]).toEqual(reg.listTraceIds());
  });

  it('AR-04-03: getTrace(id) returns same messages as filtering accumulated by traceId', () => {
    const reg = new AgentRegistry();
    const accumulated: AgentMessage[] = [];
    reg.subscribe('message', (m) => accumulated.push(m));
    reg.log(msg(T_A, 1000));
    reg.log(msg(T_B, 2000));
    reg.log(msg(T_A, 3000, 'response'));
    const fromTrace = reg.getTrace(T_A);
    const fromAccum = accumulated.filter(m => m.traceId === T_A);
    expect(fromTrace).toEqual(fromAccum);
  });

  it('AR-04-04: listTraceIds() grows as new traces are logged', () => {
    const reg = new AgentRegistry();
    expect(reg.listTraceIds()).toHaveLength(0);
    reg.log(msg(T_A, 1000));
    expect(reg.listTraceIds()).toHaveLength(1);
    reg.log(msg(T_B, 2000));
    expect(reg.listTraceIds()).toHaveLength(2);
    reg.log(msg(T_A, 3000)); // same trace — no new ID
    expect(reg.listTraceIds()).toHaveLength(2);
  });

  it('AR-04-05: getAllMessages() reflects all logs including cross-trace', () => {
    const reg = new AgentRegistry();
    const ids = ['t1', 't2', 't3'];
    for (const id of ids) {
      reg.log(msg(id, 1000));
      reg.log(msg(id, 2000, 'response'));
    }
    expect(reg.getAllMessages()).toHaveLength(ids.length * 2);
  });

  it('AR-04-06: createAgentSystem().registry has all three new methods', () => {
    const bundle = createAgentSystem();
    expect(typeof bundle.registry.listTraceIds).toBe('function');
    expect(typeof bundle.registry.getAllMessages).toBe('function');
    expect(bundle.registry.listTraceIds()).toEqual([]);
    expect(bundle.registry.getAllMessages()).toEqual([]);
  });

  it('AR-04-07: subscription survives multiple log() calls and returns all messages', () => {
    const reg = new AgentRegistry();
    const all: AgentMessage[] = [];
    reg.subscribe('message', (m) => all.push(m));
    const count = 10;
    for (let i = 0; i < count; i++) reg.log(msg(T_A, i * 100));
    expect(all).toHaveLength(count);
    expect(reg.getAllMessages()).toHaveLength(count);
  });
});
