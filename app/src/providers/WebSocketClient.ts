/**
 * P6-12D: WebSocketClient — injectable-transport WebSocket client.
 *
 * Wraps a WebSocketTransport (real or mocked) with a typed connection-state
 * machine, event-handler registries, and a result-based public API that never
 * throws.  The transport is fully injectable so the client works in SSR
 * environments (Node.js, Deno, edge runtimes) and in unit tests without a
 * real WebSocket server.
 *
 * Public API:
 *   connect(url, protocols?)  — initiate a connection; returns { ok: true } once
 *                               the transport is created (before the handshake)
 *   disconnect(code?, reason?) — close the current connection
 *   send(data)                — transmit data; serialises objects to JSON
 *   reconnect()               — close + re-connect with the same URL/protocols
 *   getStatus()               — synchronous connection-state query
 *
 * Handler registration (each method appends; multiple handlers per event):
 *   onMessage(handler)   — fires for every incoming message
 *   onOpen(handler)      — fires when the handshake completes
 *   onClose(handler)     — fires when the connection closes
 *   onError(handler)     — fires when a transport error occurs
 *
 * All registered handlers may be async; they are awaited in registration order.
 * A handler that throws does not abort the chain or propagate the error.
 *
 * Connection states:
 *   DISCONNECTED  — initial / after close or error
 *   CONNECTING    — after connect() is called, before onopen fires
 *   CONNECTED     — after the transport's onopen fires
 *
 * Error codes:
 *   ALREADY_CONNECTED        — connect() called while CONNECTED or CONNECTING
 *   NOT_CONNECTED            — send() / disconnect() called while DISCONNECTED;
 *                              reconnect() called with no prior URL
 *   INVALID_URL              — connect() received a non-string or empty URL
 *   TRANSPORT_ERROR          — factory threw, or transport method threw
 *   SEND_ERROR               — transport.send() threw
 *   WEBSOCKET_CLIENT_ERROR   — catch-all
 *
 * Design rules (consistent with the provider layer):
 *   - Never throws — all errors surface as { ok: false, error }.
 *   - SSR-compatible: no direct use of globalThis.WebSocket; inject factory.
 *   - No browser-exclusive globals, no React hooks, no DOM.
 *   - Defensive copies everywhere: data cloned before being given to handlers;
 *     protocols array cloned at connect time for safe reconnect.
 */

// ─── Connection state ──────────────────────────────────────────────────────────

export type ConnectionStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED';

// ─── Close event ──────────────────────────────────────────────────────────────

export interface WebSocketCloseEvent {
  readonly code:     number;
  readonly reason:   string;
  readonly wasClean: boolean;
}

// ─── Handler types ────────────────────────────────────────────────────────────

export type MessageHandler = (data: unknown)                  => void | Promise<void>;
export type OpenHandler    = ()                               => void | Promise<void>;
export type CloseHandler   = (event: WebSocketCloseEvent)    => void | Promise<void>;
export type ErrorHandler   = (error: unknown)                => void | Promise<void>;

// ─── Error types ──────────────────────────────────────────────────────────────

export type WebSocketClientErrorCode =
  | 'ALREADY_CONNECTED'
  | 'NOT_CONNECTED'
  | 'INVALID_URL'
  | 'TRANSPORT_ERROR'
  | 'SEND_ERROR'
  | 'WEBSOCKET_CLIENT_ERROR';

export interface WebSocketClientError {
  code:    WebSocketClientErrorCode;
  message: string;
}

export type WebSocketClientResult<T> =
  | { ok: true;  value: T }
  | { ok: false; error: WebSocketClientError };

// ─── Transport interface ──────────────────────────────────────────────────────

/**
 * Minimal WebSocket-compatible transport interface.
 * Matches the shape of the browser WebSocket object so the real WebSocket can
 * be used as-is, but also easy to implement as a test double.
 */
export interface WebSocketTransport {
  send(data: string | ArrayBuffer): void;
  close(code?: number, reason?: string): void;
  readonly readyState: number;
  onopen:    ((event: unknown)                                           => void) | null;
  onmessage: ((event: { data: unknown })                                 => void) | null;
  onclose:   ((event: { code: number; reason: string; wasClean: boolean }) => void) | null;
  onerror:   ((event: unknown)                                           => void) | null;
}

/** Factory that produces a transport for a given URL and optional sub-protocols. */
export type WebSocketFactory = (
  url:        string,
  protocols?: string | string[],
) => WebSocketTransport;

// ─── Constructor options ──────────────────────────────────────────────────────

export interface WebSocketClientOptions {
  /**
   * Transport factory.  Defaults to creating a real WebSocket via
   * `globalThis.WebSocket` when available; otherwise throws (caught as
   * TRANSPORT_ERROR).  Inject a mock in unit tests or SSR environments.
   */
  factory?: WebSocketFactory;
}

// ─── Private helpers ──────────────────────────────────────────────────────────

function cloneValue<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return [...value] as unknown as T;
  if (typeof value === 'object') return { ...(value as object) } as unknown as T;
  return value;
}

function serializeData(data: unknown): string {
  if (typeof data === 'string') return data;
  try {
    return JSON.stringify(data) ?? 'null';
  } catch {
    return String(data);
  }
}

function wsErr(
  code:    WebSocketClientErrorCode,
  message: string,
): WebSocketClientResult<never> {
  return { ok: false, error: { code, message } };
}

const defaultFactory: WebSocketFactory = (url, protocols) => {
  const WS = (
    typeof globalThis !== 'undefined'
      ? (globalThis as Record<string, unknown>)['WebSocket']
      : undefined
  ) as (new (url: string, protocols?: string | string[]) => WebSocketTransport) | undefined;

  if (typeof WS !== 'function') {
    throw new Error(
      'WebSocket is not available in this environment. ' +
      'Inject a factory via WebSocketClientOptions.factory.',
    );
  }
  return new WS(url, protocols);
};

// ─── WebSocketClient ──────────────────────────────────────────────────────────

export class WebSocketClient {
  private readonly factory: WebSocketFactory;
  private transport:       WebSocketTransport | null = null;
  private status_:         ConnectionStatus          = 'DISCONNECTED';
  private lastUrl:         string | null             = null;
  private lastProtocols:   string | string[] | undefined;

  // Event-handler registries (append-only; handlers run in registration order)
  private readonly msgHandlers:  MessageHandler[] = [];
  private readonly openHandlers: OpenHandler[]    = [];
  private readonly closeHandlers:CloseHandler[]   = [];
  private readonly errHandlers:  ErrorHandler[]   = [];

  constructor(options?: WebSocketClientOptions) {
    this.factory = options?.factory ?? defaultFactory;
  }

  // ── getStatus ─────────────────────────────────────────────────────────────

  /** Returns the current connection state.  Synchronous; never throws. */
  getStatus(): ConnectionStatus {
    return this.status_;
  }

  // ── Handler registration ──────────────────────────────────────────────────

  /**
   * Registers a handler that fires for every incoming message.
   * Handlers run in registration order; async handlers are awaited.
   * Never throws.
   */
  onMessage(handler: MessageHandler): void {
    if (typeof handler === 'function') this.msgHandlers.push(handler);
  }

  /**
   * Registers a handler that fires when the connection handshake completes.
   * Never throws.
   */
  onOpen(handler: OpenHandler): void {
    if (typeof handler === 'function') this.openHandlers.push(handler);
  }

  /**
   * Registers a handler that fires when the connection closes.
   * Receives a WebSocketCloseEvent (defensive copy).
   * Never throws.
   */
  onClose(handler: CloseHandler): void {
    if (typeof handler === 'function') this.closeHandlers.push(handler);
  }

  /**
   * Registers a handler that fires when a transport error occurs.
   * After onerror, status becomes DISCONNECTED.
   * Never throws.
   */
  onError(handler: ErrorHandler): void {
    if (typeof handler === 'function') this.errHandlers.push(handler);
  }

  // ── connect ───────────────────────────────────────────────────────────────

  /**
   * Initiates a connection to `url` using the configured factory.
   *
   * Returns { ok: true } as soon as the transport is created (the WebSocket
   * handshake is still in progress; await onOpen for CONNECTED status).
   * Returns { ok: false } if already connected/connecting, if the URL is
   * invalid, or if the factory throws.
   *
   * Never throws.
   */
  async connect(
    url:        string,
    protocols?: string | string[],
  ): Promise<WebSocketClientResult<void>> {
    if (typeof url !== 'string' || url.trim().length === 0) {
      return wsErr('INVALID_URL', `URL must be a non-empty string; received: ${String(url)}.`);
    }
    if (this.status_ !== 'DISCONNECTED') {
      return wsErr('ALREADY_CONNECTED', `Cannot connect: current status is ${this.status_}.`);
    }

    // Store for reconnect before state change so a failed factory still records them.
    this.lastUrl       = url;
    this.lastProtocols = Array.isArray(protocols) ? [...protocols] : protocols;
    this.status_       = 'CONNECTING';

    try {
      this.transport = this.factory(url, protocols);
    } catch (err) {
      this.status_ = 'DISCONNECTED';
      return wsErr('TRANSPORT_ERROR', `Factory threw: ${String(err)}.`);
    }

    this.wireTransport(this.transport);
    return { ok: true, value: undefined };
  }

  // ── disconnect ────────────────────────────────────────────────────────────

  /**
   * Closes the current connection.
   * Returns { ok: false } if already disconnected.
   * The transport's onclose handler will fire asynchronously.
   * Never throws.
   */
  async disconnect(code?: number, reason?: string): Promise<WebSocketClientResult<void>> {
    if (this.status_ === 'DISCONNECTED') {
      return wsErr('NOT_CONNECTED', 'Cannot disconnect: already disconnected.');
    }
    try {
      this.transport?.close(code, reason);
      return { ok: true, value: undefined };
    } catch (err) {
      return wsErr('TRANSPORT_ERROR', `transport.close() threw: ${String(err)}.`);
    }
  }

  // ── send ──────────────────────────────────────────────────────────────────

  /**
   * Transmits data over the current connection.
   * Strings are sent as-is; all other values are JSON-serialised.
   * Returns { ok: false } if not in the CONNECTED state.
   * Never throws.
   */
  async send(data: unknown): Promise<WebSocketClientResult<void>> {
    if (this.status_ !== 'CONNECTED') {
      return wsErr('NOT_CONNECTED', `Cannot send: current status is ${this.status_}.`);
    }
    try {
      this.transport!.send(serializeData(data));
      return { ok: true, value: undefined };
    } catch (err) {
      return wsErr('SEND_ERROR', `transport.send() threw: ${String(err)}.`);
    }
  }

  // ── reconnect ─────────────────────────────────────────────────────────────

  /**
   * Closes any active connection and reconnects using the last URL and
   * protocols passed to connect().
   * Returns { ok: false } if connect() has never been called.
   * Never throws.
   */
  async reconnect(): Promise<WebSocketClientResult<void>> {
    if (this.lastUrl === null) {
      return wsErr('NOT_CONNECTED', 'Cannot reconnect: connect() has not been called yet.');
    }
    // Force-close existing transport without waiting for onclose.
    if (this.status_ !== 'DISCONNECTED') {
      try { this.transport?.close(); } catch { /* ignore */ }
      this.status_    = 'DISCONNECTED';
      this.transport  = null;
    }
    return this.connect(this.lastUrl, this.lastProtocols);
  }

  // ── Internal transport wiring ─────────────────────────────────────────────

  private wireTransport(t: WebSocketTransport): void {
    t.onopen = async (_event: unknown) => {
      this.status_ = 'CONNECTED';
      for (const h of [...this.openHandlers]) {
        try { await h(); } catch { /* handler errors do not propagate */ }
      }
    };

    t.onmessage = async (event: { data: unknown }) => {
      // Clone once into an intermediate value, then give each handler its own copy.
      const base = cloneValue(event.data);
      for (const h of [...this.msgHandlers]) {
        try { await h(cloneValue(base)); } catch { /* handler errors do not propagate */ }
      }
    };

    t.onclose = async (event: { code: number; reason: string; wasClean: boolean }) => {
      this.status_ = 'DISCONNECTED';
      const ev: WebSocketCloseEvent = {
        code:     typeof event?.code     === 'number'  ? event.code     : 1000,
        reason:   typeof event?.reason   === 'string'  ? event.reason   : '',
        wasClean: typeof event?.wasClean === 'boolean' ? event.wasClean : true,
      };
      for (const h of [...this.closeHandlers]) {
        try { await h({ ...ev }); } catch { /* handler errors do not propagate */ }
      }
    };

    t.onerror = async (event: unknown) => {
      // onerror always precedes onclose in the real WebSocket spec; we also
      // set DISCONNECTED here so that getStatus() reflects the error immediately.
      this.status_ = 'DISCONNECTED';
      for (const h of [...this.errHandlers]) {
        try { await h(event); } catch { /* handler errors do not propagate */ }
      }
    };
  }
}
