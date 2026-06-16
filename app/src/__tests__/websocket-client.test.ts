import { describe, it, expect, vi } from 'vitest';
import {
  WebSocketClient,
  type WebSocketClientOptions,
  type WebSocketClientResult,
  type WebSocketTransport,
  type WebSocketFactory,
  type WebSocketCloseEvent,
  type MessageHandler,
} from '../providers/WebSocketClient';

// ─── Mock transport ───────────────────────────────────────────────────────────

interface MockTransport extends WebSocketTransport {
  sentData:    (string | ArrayBuffer)[];
  closedWith:  { code?: number; reason?: string }[];
  simulateOpen():                                                  Promise<void>;
  simulateMessage(data: unknown):                                  Promise<void>;
  simulateClose(code?: number, reason?: string, wasClean?: boolean): Promise<void>;
  simulateError(error?: unknown):                                  Promise<void>;
}

function createMockTransport(): MockTransport {
  const t: MockTransport = {
    onopen:     null,
    onmessage:  null,
    onclose:    null,
    onerror:    null,
    readyState: 0,
    sentData:   [],
    closedWith: [],
    send(data)          { this.sentData.push(data); },
    close(code, reason) { this.closedWith.push({ code, reason }); },
    async simulateOpen() {
      this.readyState = 1;
      await Promise.resolve((this.onopen as ((e: unknown) => unknown) | null)?.({}) ?? undefined);
    },
    async simulateMessage(data: unknown) {
      await Promise.resolve((this.onmessage as ((e: { data: unknown }) => unknown) | null)?.({ data }) ?? undefined);
    },
    async simulateClose(code = 1000, reason = '', wasClean = true) {
      this.readyState = 3;
      await Promise.resolve(
        (this.onclose as ((e: { code: number; reason: string; wasClean: boolean }) => unknown) | null)?.(
          { code, reason, wasClean },
        ) ?? undefined,
      );
    },
    async simulateError(error: unknown = new Error('ws error')) {
      this.readyState = 3;
      await Promise.resolve((this.onerror as ((e: unknown) => unknown) | null)?.(error) ?? undefined);
    },
  };
  return t;
}

/** Creates a client + factory that exposes the latest mock transport. */
function makeSetup(): {
  client:       WebSocketClient;
  getTransport: () => MockTransport;
  factoryCalls: () => { url: string; protocols?: string | string[] }[];
} {
  const calls: { url: string; protocols?: string | string[] }[] = [];
  let latest: MockTransport = createMockTransport();

  const factory: WebSocketFactory = (url, protocols) => {
    calls.push({ url, protocols });
    latest = createMockTransport();
    return latest;
  };
  const client = new WebSocketClient({ factory });
  return {
    client,
    getTransport:  () => latest,
    factoryCalls:  () => [...calls],
  };
}

const TEST_URL = 'ws://example.com/socket';

// ─── WS1: Constructor / initial state ─────────────────────────────────────────

describe('WS1: Constructor / initial state', () => {
  it('WS1-01: new WebSocketClient() does not throw', () => {
    expect(() => new WebSocketClient()).not.toThrow();
  });

  it('WS1-02: getStatus() returns DISCONNECTED initially', () => {
    const client = new WebSocketClient({ factory: createMockTransport as unknown as WebSocketFactory });
    expect(client.getStatus()).toBe('DISCONNECTED');
  });

  it('WS1-03: injected factory is called when connect() is invoked', async () => {
    const { client, factoryCalls } = makeSetup();
    await client.connect(TEST_URL);
    expect(factoryCalls()).toHaveLength(1);
    expect(factoryCalls()[0].url).toBe(TEST_URL);
  });

  it('WS1-04: onMessage() registration does not throw', () => {
    const client = new WebSocketClient({ factory: vi.fn() as unknown as WebSocketFactory });
    expect(() => client.onMessage(async () => {})).not.toThrow();
  });

  it('WS1-05: onOpen/onClose/onError registration does not throw', () => {
    const client = new WebSocketClient({ factory: vi.fn() as unknown as WebSocketFactory });
    expect(() => {
      client.onOpen(async () => {});
      client.onClose(async () => {});
      client.onError(async () => {});
    }).not.toThrow();
  });
});

// ─── WS2: connect() ───────────────────────────────────────────────────────────

describe('WS2: connect()', () => {
  it('WS2-01: connect() returns { ok: true }', async () => {
    const { client } = makeSetup();
    const r = await client.connect(TEST_URL);
    expect(r.ok).toBe(true);
  });

  it('WS2-02: connect() sets status to CONNECTING before handshake completes', async () => {
    const { client, getTransport } = makeSetup();
    await client.connect(TEST_URL);
    // Transport created but onopen not yet fired → CONNECTING
    expect(client.getStatus()).toBe('CONNECTING');
  });

  it('WS2-03: connect() passes the URL to the factory', async () => {
    const { client, factoryCalls } = makeSetup();
    await client.connect('ws://test.local/api');
    expect(factoryCalls()[0].url).toBe('ws://test.local/api');
  });

  it('WS2-04: connect() when CONNECTED returns ALREADY_CONNECTED error', async () => {
    const { client, getTransport } = makeSetup();
    await client.connect(TEST_URL);
    await getTransport().simulateOpen();
    const r = await client.connect(TEST_URL);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('ALREADY_CONNECTED');
  });

  it('WS2-05: connect() when CONNECTING returns ALREADY_CONNECTED error', async () => {
    const { client } = makeSetup();
    await client.connect(TEST_URL);
    // Still CONNECTING (onopen not fired yet)
    const r = await client.connect(TEST_URL);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('ALREADY_CONNECTED');
  });
});

// ─── WS3: onOpen / open event ────────────────────────────────────────────────

describe('WS3: onOpen / open event', () => {
  it('WS3-01: onOpen handler fires when transport triggers open', async () => {
    const { client, getTransport } = makeSetup();
    let fired = false;
    client.onOpen(async () => { fired = true; });
    await client.connect(TEST_URL);
    await getTransport().simulateOpen();
    expect(fired).toBe(true);
  });

  it('WS3-02: status becomes CONNECTED after onOpen fires', async () => {
    const { client, getTransport } = makeSetup();
    await client.connect(TEST_URL);
    expect(client.getStatus()).toBe('CONNECTING');
    await getTransport().simulateOpen();
    expect(client.getStatus()).toBe('CONNECTED');
  });

  it('WS3-03: multiple onOpen handlers all fire', async () => {
    const { client, getTransport } = makeSetup();
    const log: number[] = [];
    client.onOpen(async () => { log.push(1); });
    client.onOpen(async () => { log.push(2); });
    client.onOpen(async () => { log.push(3); });
    await client.connect(TEST_URL);
    await getTransport().simulateOpen();
    expect(log).toEqual([1, 2, 3]);
  });

  it('WS3-04: async onOpen handler is awaited before the next handler runs', async () => {
    const { client, getTransport } = makeSetup();
    const order: string[] = [];
    client.onOpen(async () => {
      await Promise.resolve();
      order.push('first');
    });
    client.onOpen(async () => { order.push('second'); });
    await client.connect(TEST_URL);
    await getTransport().simulateOpen();
    expect(order).toEqual(['first', 'second']);
  });

  it('WS3-05: onOpen registered before connect() still fires after handshake', async () => {
    const { client, getTransport } = makeSetup();
    let count = 0;
    client.onOpen(async () => { count++; });
    await client.connect(TEST_URL);
    await getTransport().simulateOpen();
    expect(count).toBe(1);
  });
});

// ─── WS4: onMessage / message event ──────────────────────────────────────────

describe('WS4: onMessage / message event', () => {
  it('WS4-01: onMessage handler fires when transport triggers a message', async () => {
    const { client, getTransport } = makeSetup();
    let called = false;
    client.onMessage(async () => { called = true; });
    await client.connect(TEST_URL);
    await getTransport().simulateMessage('hello');
    expect(called).toBe(true);
  });

  it('WS4-02: handler receives the message data', async () => {
    const { client, getTransport } = makeSetup();
    let received: unknown;
    client.onMessage(async d => { received = d; });
    await client.connect(TEST_URL);
    await getTransport().simulateMessage('payload');
    expect(received).toBe('payload');
  });

  it('WS4-03: multiple onMessage handlers all fire in registration order', async () => {
    const { client, getTransport } = makeSetup();
    const log: number[] = [];
    client.onMessage(async () => { log.push(1); });
    client.onMessage(async () => { log.push(2); });
    await client.connect(TEST_URL);
    await getTransport().simulateMessage('msg');
    expect(log).toEqual([1, 2]);
  });

  it('WS4-04: message data (object) received by handler is a defensive copy', async () => {
    const { client, getTransport } = makeSetup();
    const received: unknown[] = [];
    client.onMessage(async d => { received.push(d); });
    const original = { key: 'value' };
    await client.connect(TEST_URL);
    await getTransport().simulateMessage(original);
    const msg = received[0] as { key: string };
    expect(msg).toEqual(original);
    expect(msg).not.toBe(original);
  });

  it('WS4-05: async onMessage handler is awaited', async () => {
    const { client, getTransport } = makeSetup();
    const order: string[] = [];
    client.onMessage(async () => {
      await Promise.resolve();
      order.push('handler');
    });
    await client.connect(TEST_URL);
    await getTransport().simulateMessage('x');
    expect(order).toEqual(['handler']);
  });
});

// ─── WS5: onClose / close event ──────────────────────────────────────────────

describe('WS5: onClose / close event', () => {
  it('WS5-01: onClose handler fires when transport triggers close', async () => {
    const { client, getTransport } = makeSetup();
    let fired = false;
    client.onClose(async () => { fired = true; });
    await client.connect(TEST_URL);
    await getTransport().simulateClose();
    expect(fired).toBe(true);
  });

  it('WS5-02: status becomes DISCONNECTED after onClose fires', async () => {
    const { client, getTransport } = makeSetup();
    await client.connect(TEST_URL);
    await getTransport().simulateOpen();
    expect(client.getStatus()).toBe('CONNECTED');
    await getTransport().simulateClose();
    expect(client.getStatus()).toBe('DISCONNECTED');
  });

  it('WS5-03: handler receives code, reason, and wasClean from the close event', async () => {
    const { client, getTransport } = makeSetup();
    let ev: WebSocketCloseEvent | null = null;
    client.onClose(async e => { ev = e; });
    await client.connect(TEST_URL);
    await getTransport().simulateClose(1001, 'Going away', false);
    expect(ev?.code).toBe(1001);
    expect(ev?.reason).toBe('Going away');
    expect(ev?.wasClean).toBe(false);
  });

  it('WS5-04: multiple onClose handlers all fire', async () => {
    const { client, getTransport } = makeSetup();
    const log: number[] = [];
    client.onClose(async () => { log.push(1); });
    client.onClose(async () => { log.push(2); });
    await client.connect(TEST_URL);
    await getTransport().simulateClose();
    expect(log).toEqual([1, 2]);
  });
});

// ─── WS6: onError / error event ──────────────────────────────────────────────

describe('WS6: onError / error event', () => {
  it('WS6-01: onError handler fires when transport triggers error', async () => {
    const { client, getTransport } = makeSetup();
    let fired = false;
    client.onError(async () => { fired = true; });
    await client.connect(TEST_URL);
    await getTransport().simulateError();
    expect(fired).toBe(true);
  });

  it('WS6-02: status becomes DISCONNECTED after onError fires', async () => {
    const { client, getTransport } = makeSetup();
    await client.connect(TEST_URL);
    await getTransport().simulateOpen();
    await getTransport().simulateError(new Error('connection reset'));
    expect(client.getStatus()).toBe('DISCONNECTED');
  });

  it('WS6-03: multiple onError handlers all fire', async () => {
    const { client, getTransport } = makeSetup();
    const log: number[] = [];
    client.onError(async () => { log.push(1); });
    client.onError(async () => { log.push(2); });
    await client.connect(TEST_URL);
    await getTransport().simulateError();
    expect(log).toEqual([1, 2]);
  });

  it('WS6-04: async onError handler is awaited', async () => {
    const { client, getTransport } = makeSetup();
    const order: string[] = [];
    client.onError(async () => {
      await Promise.resolve();
      order.push('error-handler');
    });
    await client.connect(TEST_URL);
    await getTransport().simulateError();
    expect(order).toEqual(['error-handler']);
  });
});

// ─── WS7: send() ──────────────────────────────────────────────────────────────

describe('WS7: send()', () => {
  it('WS7-01: send() transmits a string directly via transport', async () => {
    const { client, getTransport } = makeSetup();
    await client.connect(TEST_URL);
    await getTransport().simulateOpen();
    await client.send('hello');
    expect(getTransport().sentData[0]).toBe('hello');
  });

  it('WS7-02: send() serialises an object to JSON', async () => {
    const { client, getTransport } = makeSetup();
    await client.connect(TEST_URL);
    await getTransport().simulateOpen();
    await client.send({ type: 'ping', id: 1 });
    expect(getTransport().sentData[0]).toBe('{"type":"ping","id":1}');
  });

  it('WS7-03: send() when not CONNECTED returns NOT_CONNECTED error', async () => {
    const { client } = makeSetup();
    const r = await client.send('msg');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('NOT_CONNECTED');
  });

  it('WS7-04: send() returns { ok: true } when the transport accepts the data', async () => {
    const { client, getTransport } = makeSetup();
    await client.connect(TEST_URL);
    await getTransport().simulateOpen();
    const r = await client.send('data');
    expect(r.ok).toBe(true);
  });

  it('WS7-05: send() when transport.send() throws returns SEND_ERROR', async () => {
    const { client, getTransport } = makeSetup();
    await client.connect(TEST_URL);
    await getTransport().simulateOpen();
    getTransport().send = () => { throw new Error('send failed'); };
    const r = await client.send('data');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('SEND_ERROR');
  });
});

// ─── WS8: disconnect() ────────────────────────────────────────────────────────

describe('WS8: disconnect()', () => {
  it('WS8-01: disconnect() calls transport.close()', async () => {
    const { client, getTransport } = makeSetup();
    await client.connect(TEST_URL);
    await client.disconnect();
    expect(getTransport().closedWith.length).toBeGreaterThan(0);
  });

  it('WS8-02: disconnect() returns { ok: true }', async () => {
    const { client } = makeSetup();
    await client.connect(TEST_URL);
    const r = await client.disconnect();
    expect(r.ok).toBe(true);
  });

  it('WS8-03: disconnect() when already DISCONNECTED returns NOT_CONNECTED error', async () => {
    const { client } = makeSetup();
    const r = await client.disconnect();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('NOT_CONNECTED');
  });

  it('WS8-04: disconnect() passes code and reason to transport.close()', async () => {
    const { client, getTransport } = makeSetup();
    await client.connect(TEST_URL);
    await client.disconnect(1000, 'Normal closure');
    const call = getTransport().closedWith[0];
    expect(call.code).toBe(1000);
    expect(call.reason).toBe('Normal closure');
  });
});

// ─── WS9: reconnect() ─────────────────────────────────────────────────────────

describe('WS9: reconnect()', () => {
  it('WS9-01: reconnect() when connect() was never called returns NOT_CONNECTED error', async () => {
    const { client } = makeSetup();
    const r = await client.reconnect();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('NOT_CONNECTED');
  });

  it('WS9-02: reconnect() calls factory with the last used URL', async () => {
    const { client, factoryCalls } = makeSetup();
    await client.connect('ws://original.example.com');
    await client.reconnect();
    expect(factoryCalls()).toHaveLength(2);
    expect(factoryCalls()[1].url).toBe('ws://original.example.com');
  });

  it('WS9-03: reconnect() closes the existing transport before creating a new one', async () => {
    const { client, getTransport } = makeSetup();
    await client.connect(TEST_URL);
    await getTransport().simulateOpen();
    const firstTransport = getTransport();
    await client.reconnect();
    expect(firstTransport.closedWith.length).toBeGreaterThan(0);
  });

  it('WS9-04: reconnect() returns { ok: true }', async () => {
    const { client } = makeSetup();
    await client.connect(TEST_URL);
    const r = await client.reconnect();
    expect(r.ok).toBe(true);
  });
});

// ─── WS10: getStatus() ────────────────────────────────────────────────────────

describe('WS10: getStatus()', () => {
  it('WS10-01: returns DISCONNECTED before any connection', () => {
    const { client } = makeSetup();
    expect(client.getStatus()).toBe('DISCONNECTED');
  });

  it('WS10-02: returns CONNECTING immediately after connect()', async () => {
    const { client } = makeSetup();
    await client.connect(TEST_URL);
    expect(client.getStatus()).toBe('CONNECTING');
  });

  it('WS10-03: returns CONNECTED after onOpen fires', async () => {
    const { client, getTransport } = makeSetup();
    await client.connect(TEST_URL);
    await getTransport().simulateOpen();
    expect(client.getStatus()).toBe('CONNECTED');
  });

  it('WS10-04: returns DISCONNECTED after onClose fires', async () => {
    const { client, getTransport } = makeSetup();
    await client.connect(TEST_URL);
    await getTransport().simulateOpen();
    await getTransport().simulateClose();
    expect(client.getStatus()).toBe('DISCONNECTED');
  });
});

// ─── WS11: Defensive copies ───────────────────────────────────────────────────

describe('WS11: Defensive copies', () => {
  it('WS11-01: message data (object) is cloned before being given to the handler', async () => {
    const { client, getTransport } = makeSetup();
    const received: unknown[] = [];
    client.onMessage(async d => { received.push(d); });
    const original = { key: 'original' };
    await client.connect(TEST_URL);
    await getTransport().simulateMessage(original);
    expect(received[0]).toEqual(original);
    expect(received[0]).not.toBe(original);
  });

  it('WS11-02: each onMessage handler receives its own copy of the data', async () => {
    const { client, getTransport } = makeSetup();
    const copies: unknown[] = [];
    client.onMessage(async d => { copies.push(d); });
    client.onMessage(async d => { copies.push(d); });
    await client.connect(TEST_URL);
    await getTransport().simulateMessage({ x: 1 });
    expect(copies).toHaveLength(2);
    expect(copies[0]).toEqual(copies[1]);
    expect(copies[0]).not.toBe(copies[1]);
  });

  it('WS11-03: the close event given to each handler is a defensive copy', async () => {
    const { client, getTransport } = makeSetup();
    const events: WebSocketCloseEvent[] = [];
    client.onClose(async e => { events.push(e); });
    client.onClose(async e => { events.push(e); });
    await client.connect(TEST_URL);
    await getTransport().simulateClose(1000, 'bye', true);
    expect(events).toHaveLength(2);
    expect(events[0]).toEqual(events[1]);
    expect(events[0]).not.toBe(events[1]);
  });

  it('WS11-04: protocols array is cloned at connect() so later mutation does not affect reconnect()', async () => {
    const { client, factoryCalls } = makeSetup();
    const protocols = ['proto-a', 'proto-b'];
    await client.connect(TEST_URL, protocols);
    protocols.push('proto-c');            // mutate after connect
    await client.reconnect();
    const reconnectProtocols = factoryCalls()[1].protocols as string[];
    expect(reconnectProtocols).toEqual(['proto-a', 'proto-b']);
    expect(reconnectProtocols).not.toContain('proto-c');
  });

  it('WS11-05: send() serialises object data — transport receives a string, not the original reference', async () => {
    const { client, getTransport } = makeSetup();
    await client.connect(TEST_URL);
    await getTransport().simulateOpen();
    const obj = { action: 'subscribe' };
    await client.send(obj);
    const sent = getTransport().sentData[0];
    expect(typeof sent).toBe('string');
    expect(JSON.parse(sent as string)).toEqual(obj);
  });
});

// ─── WS12: Never throw / edge cases ──────────────────────────────────────────

describe('WS12: Never throw / edge cases', () => {
  it('WS12-01: connect() with an empty URL returns INVALID_URL error, does not throw', async () => {
    const { client } = makeSetup();
    const r = await client.connect('');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_URL');
  });

  it('WS12-02: connect() when factory throws returns TRANSPORT_ERROR, does not throw', async () => {
    const factory: WebSocketFactory = () => { throw new Error('no socket'); };
    const client = new WebSocketClient({ factory });
    await expect(client.connect(TEST_URL)).resolves.toMatchObject({ ok: false });
    const r = await client.connect(TEST_URL);
    // After the first failed connect, status is DISCONNECTED again — try a second time
    // (first call above already consumed the re-run; test the code)
    if (!r.ok) expect(r.error.code).toBe('TRANSPORT_ERROR');
  });

  it('WS12-03: send() with null does not throw', async () => {
    const { client, getTransport } = makeSetup();
    await client.connect(TEST_URL);
    await getTransport().simulateOpen();
    await expect(client.send(null)).resolves.toMatchObject({ ok: true });
  });

  it('WS12-04: disconnect() when already disconnected does not throw', async () => {
    const { client } = makeSetup();
    await expect(client.disconnect()).resolves.toMatchObject({ ok: false });
  });

  it('WS12-05: a handler that throws does not propagate the error to the caller', async () => {
    const { client, getTransport } = makeSetup();
    client.onMessage(async () => { throw new Error('handler crash'); });
    await client.connect(TEST_URL);
    await expect(getTransport().simulateMessage('data')).resolves.toBeUndefined();
  });

  it('WS12-06: getStatus() never throws', () => {
    const client = new WebSocketClient({ factory: vi.fn() as unknown as WebSocketFactory });
    expect(() => client.getStatus()).not.toThrow();
  });
});
