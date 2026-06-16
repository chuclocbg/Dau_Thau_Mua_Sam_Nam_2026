/**
 * P6-11B: EventBus — in-process publish/subscribe message bus.
 *
 * Supports multiple listeners per named event.  Listeners are called
 * in registration order.  A listener that throws is isolated: the
 * failure is recorded but remaining listeners still run.
 *
 * Public API:
 *   subscribe(eventName, listener)  — register a listener; returns a token
 *   unsubscribe(token)              — remove a listener by its token
 *   publish(eventName, data?)       — dispatch an event; returns PublishResult
 *   clear()                         — remove all listeners; never fails
 *   listenerCount(eventName?)       — count listeners (one event or all)
 *
 * Error codes:
 *   INVALID_EVENT_NAME  — empty / non-string event name
 *   INVALID_LISTENER    — non-function listener passed to subscribe()
 *   LISTENER_NOT_FOUND  — unsubscribe() with an unknown token
 *   BUS_ERROR           — catch-all for unexpected failures
 *
 * Design rules (consistent with the provider layer):
 *   - Never throws — errors surface as { ok: false, error }.
 *   - Defensive snapshot: publish() copies the listener array before
 *     iterating so a listener that calls subscribe / unsubscribe during
 *     dispatch does not affect the current iteration.
 *   - clear() and listenerCount() never fail.
 *   - SSR-compatible: no browser APIs; Date.now() is the only external
 *     call, available in all JS runtimes.
 */

// ─── Listener and payload ─────────────────────────────────────────────────────

/** Callback signature received by every subscriber. */
export type EventListener<T = unknown> = (event: EventPayload<T>) => void;

/** Object passed to every listener when an event is published. */
export interface EventPayload<T = unknown> {
  readonly name:      string;
  readonly data:      T;
  readonly timestamp: number;
}

// ─── Subscription token ───────────────────────────────────────────────────────

/**
 * Opaque token returned by subscribe().
 * Pass this to unsubscribe() to remove the specific registration.
 */
export interface SubscriptionToken {
  readonly id:        number;
  readonly eventName: string;
}

// ─── Publish result ───────────────────────────────────────────────────────────

/** Information returned by every publish() call. */
export interface PublishResult {
  /** The event name that was published. */
  eventName:     string;
  /** How many listeners were found for this event. */
  listenerCount: number;
  /** How many listeners completed without throwing. */
  successCount:  number;
  /** How many listeners threw during dispatch. */
  failureCount:  number;
  /** One entry per listener that threw; contains the subscription id and the caught error. */
  errors:        Array<{ listenerId: number; error: unknown }>;
}

// ─── Error types ──────────────────────────────────────────────────────────────

export type EventBusErrorCode =
  | 'INVALID_EVENT_NAME'  // empty or non-string event name
  | 'INVALID_LISTENER'    // non-function listener
  | 'LISTENER_NOT_FOUND'  // unsubscribe with unknown token
  | 'BUS_ERROR';          // catch-all for unexpected failures

export interface EventBusError {
  code:    EventBusErrorCode;
  message: string;
}

export type EventBusResult<T> =
  | { ok: true;  value: T }
  | { ok: false; error: EventBusError };

// ─── Private helpers ──────────────────────────────────────────────────────────

function busErr(code: EventBusErrorCode, message: string): EventBusResult<never> {
  return { ok: false, error: { code, message } };
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim() !== '';
}

// Internal registration record — not exported.
interface Registration {
  id:       number;
  listener: EventListener;
}

// ─── EventBus ─────────────────────────────────────────────────────────────────

export class EventBus {
  private readonly channels: Map<string, Registration[]> = new Map();
  private          seq       = 0;

  // ── subscribe ──────────────────────────────────────────────────────────────

  /**
   * Registers `listener` to be called whenever `eventName` is published.
   * Returns a SubscriptionToken that can be passed to unsubscribe().
   *
   * Returns INVALID_EVENT_NAME when eventName is empty or not a string.
   * Returns INVALID_LISTENER  when listener is not a function.
   */
  subscribe<T = unknown>(
    eventName: string,
    listener:  EventListener<T>,
  ): EventBusResult<SubscriptionToken> {
    if (!isNonEmptyString(eventName)) {
      return busErr('INVALID_EVENT_NAME',
        `Event name must be a non-empty string; received: ${String(eventName)}.`);
    }
    if (typeof listener !== 'function') {
      return busErr('INVALID_LISTENER',
        `Listener must be a function; received: ${typeof listener}.`);
    }

    const id = ++this.seq;
    const reg: Registration = { id, listener: listener as EventListener };

    const existing = this.channels.get(eventName);
    if (existing !== undefined) {
      existing.push(reg);
    } else {
      this.channels.set(eventName, [reg]);
    }

    const token: SubscriptionToken = { id, eventName };
    return { ok: true, value: token };
  }

  // ── unsubscribe ────────────────────────────────────────────────────────────

  /**
   * Removes the listener identified by `token`.
   *
   * Returns LISTENER_NOT_FOUND when no matching registration exists.
   * Returns BUS_ERROR when token is null / not an object.
   */
  unsubscribe(token: SubscriptionToken): EventBusResult<undefined> {
    if (token === null || typeof token !== 'object') {
      return busErr('BUS_ERROR',
        'Token must be a SubscriptionToken object; received a non-object.');
    }

    const { id, eventName } = token;

    if (!isNonEmptyString(eventName)) {
      return busErr('LISTENER_NOT_FOUND',
        `No listeners registered for event: ${String(eventName)}.`);
    }

    const regs = this.channels.get(eventName);
    if (regs === undefined) {
      return busErr('LISTENER_NOT_FOUND',
        `No listeners found for event "${eventName}" with id ${id}.`);
    }

    const idx = regs.findIndex(r => r.id === id);
    if (idx === -1) {
      return busErr('LISTENER_NOT_FOUND',
        `Listener with id ${id} not found on event "${eventName}".`);
    }

    regs.splice(idx, 1);
    if (regs.length === 0) {
      this.channels.delete(eventName);
    }

    return { ok: true, value: undefined };
  }

  // ── publish ────────────────────────────────────────────────────────────────

  /**
   * Dispatches `data` to all listeners registered for `eventName`.
   *
   * - Takes a defensive snapshot of the listener list before iterating, so
   *   a listener that subscribes or unsubscribes during dispatch does not
   *   affect the current call.
   * - A listener that throws is caught; its error is recorded in PublishResult.errors
   *   and the next listener is still called.
   * - Returns ok:true with PublishResult in all cases (except invalid eventName).
   *
   * Returns INVALID_EVENT_NAME when eventName is empty or not a string.
   */
  publish<T = unknown>(
    eventName: string,
    data?:     T,
  ): EventBusResult<PublishResult> {
    if (!isNonEmptyString(eventName)) {
      return busErr('INVALID_EVENT_NAME',
        `Event name must be a non-empty string; received: ${String(eventName)}.`);
    }

    const regs = this.channels.get(eventName);

    // Defensive snapshot so mid-dispatch mutations don't affect this call.
    const snapshot: Registration[] = regs !== undefined ? [...regs] : [];

    const payload: EventPayload<T> = {
      name:      eventName,
      data:      data as T,
      timestamp: Date.now(),
    };

    let successCount = 0;
    let failureCount = 0;
    const errors: Array<{ listenerId: number; error: unknown }> = [];

    for (const reg of snapshot) {
      try {
        reg.listener(payload as EventPayload<unknown>);
        successCount++;
      } catch (err: unknown) {
        failureCount++;
        errors.push({ listenerId: reg.id, error: err });
      }
    }

    const result: PublishResult = {
      eventName,
      listenerCount: snapshot.length,
      successCount,
      failureCount,
      errors,
    };

    return { ok: true, value: result };
  }

  // ── clear ──────────────────────────────────────────────────────────────────

  /**
   * Removes all listeners for all events.  Resets the id counter.
   * Never fails.
   */
  clear(): void {
    this.channels.clear();
    this.seq = 0;
  }

  // ── listenerCount ──────────────────────────────────────────────────────────

  /**
   * Returns the number of listeners.
   *   - With a valid eventName string: count for that event only.
   *   - With no argument (or an invalid/non-string argument): total across all events.
   * Never fails; returns 0 when the bus is empty or the event is unknown.
   */
  listenerCount(eventName?: string): number {
    if (eventName !== undefined) {
      // Any non-string argument (malformed input) matches no channel.
      if (typeof eventName !== 'string') return 0;
      return this.channels.get(eventName)?.length ?? 0;
    }
    let total = 0;
    for (const regs of this.channels.values()) {
      total += regs.length;
    }
    return total;
  }
}
