/**
 * P6-10R: SessionManager — session lifecycle manager with strict state-machine
 * semantics.
 *
 * Each session moves through a fixed set of states via explicit transition
 * methods.  Invalid transitions are rejected with INVALID_STATE rather than
 * silently permitted.
 *
 * Valid transitions:
 *   IDLE      → RUNNING    (startSession)
 *   RUNNING   → PAUSED     (pauseSession)
 *   PAUSED    → RUNNING    (resumeSession)
 *   RUNNING   → COMPLETED  (completeSession)
 *   RUNNING   → ERROR      (failSession)
 *
 * Terminal states (COMPLETED, ERROR) cannot be left.
 *
 * Capabilities:
 *   createSession()   — registers a new session in IDLE state
 *   startSession()    — IDLE → RUNNING
 *   pauseSession()    — RUNNING → PAUSED
 *   resumeSession()   — PAUSED → RUNNING
 *   completeSession() — RUNNING → COMPLETED
 *   failSession()     — RUNNING → ERROR
 *   deleteSession()   — removes session regardless of current state
 *   getSession()      — returns a defensive copy
 *   listSessions()    — returns defensive copies in insertion order
 *   clear()           — removes all sessions; never fails
 *
 * Error codes:
 *   DUPLICATE_SESSION — createSession with an id already registered
 *   SESSION_NOT_FOUND — operation on an id not in the manager
 *   INVALID_STATE     — transition not permitted from current state
 *   INVALID_INPUT     — empty / whitespace-only id
 *
 * Design rules (consistent with the rest of the provider layer):
 *   - Never throws — all failures surface as { ok: false, error }.
 *   - Defensive copies on every read (including metadata).
 *   - Operations are atomic: the store is unchanged on any failure.
 *   - listSessions() and clear() never fail.
 */

// ─── SessionState ─────────────────────────────────────────────────────────────

export type SessionState =
  | 'IDLE'
  | 'RUNNING'
  | 'PAUSED'
  | 'COMPLETED'
  | 'ERROR';

// ─── SessionInfo ──────────────────────────────────────────────────────────────

export interface SessionInfo {
  /** Unique identifier. */
  id:        string;
  /** Current lifecycle state. */
  state:     SessionState;
  /** Unix-ms timestamp when the session was created. */
  createdAt: number;
  /** Unix-ms timestamp of the most recent state change. */
  updatedAt: number;
  /** Optional caller-supplied data; shallow-copied on every read. */
  metadata?: Record<string, unknown>;
}

// ─── Options ──────────────────────────────────────────────────────────────────

export interface SessionOptions {
  /** Caller-supplied key/value bag attached to the session. */
  metadata?: Record<string, unknown>;
}

// ─── Error types ──────────────────────────────────────────────────────────────

export type SessionErrorCode =
  | 'DUPLICATE_SESSION'  // createSession with an already-registered id
  | 'SESSION_NOT_FOUND'  // operation on an unknown id
  | 'INVALID_STATE'      // transition not allowed from current state
  | 'INVALID_INPUT';     // empty / whitespace-only id

export interface SessionError {
  code:    SessionErrorCode;
  message: string;
}

// ─── Result ───────────────────────────────────────────────────────────────────

export type SessionResult<T> =
  | { ok: true;  value: T }
  | { ok: false; error: SessionError };

// ─── Transition map ───────────────────────────────────────────────────────────

const TRANSITIONS: Record<SessionState, ReadonlySet<SessionState>> = {
  IDLE:      new Set(['RUNNING']),
  RUNNING:   new Set(['PAUSED', 'COMPLETED', 'ERROR']),
  PAUSED:    new Set(['RUNNING']),
  COMPLETED: new Set(),
  ERROR:     new Set(),
};

// ─── SessionManager ───────────────────────────────────────────────────────────

export class SessionManager {
  private readonly store: Map<string, SessionInfo> = new Map();

  /**
   * Registers a new session in IDLE state.
   *
   * Returns INVALID_INPUT when id is empty or whitespace-only.
   * Returns DUPLICATE_SESSION when the id is already registered.
   * Returns a defensive copy of the new SessionInfo on success.
   */
  createSession(
    id:       string,
    options?: SessionOptions,
  ): SessionResult<SessionInfo> {
    if (!id || !id.trim()) {
      return sessionErr('INVALID_INPUT',
        'Session id must be a non-empty, non-whitespace string.');
    }
    if (this.store.has(id)) {
      return sessionErr('DUPLICATE_SESSION',
        `Session '${id}' is already registered.`);
    }
    const now    = Date.now();
    const session: SessionInfo = {
      id,
      state:     'IDLE',
      createdAt: now,
      updatedAt: now,
      ...(options?.metadata !== undefined
        ? { metadata: { ...options.metadata } }
        : {}),
    };
    this.store.set(id, session);
    return { ok: true, value: cloneSession(session) };
  }

  /** Transitions the session from IDLE to RUNNING. */
  startSession(id: string): SessionResult<SessionInfo> {
    return this.transition(id, 'RUNNING');
  }

  /** Transitions the session from RUNNING to PAUSED. */
  pauseSession(id: string): SessionResult<SessionInfo> {
    return this.transition(id, 'PAUSED');
  }

  /** Transitions the session from PAUSED to RUNNING. */
  resumeSession(id: string): SessionResult<SessionInfo> {
    return this.transition(id, 'RUNNING');
  }

  /** Transitions the session from RUNNING to COMPLETED. */
  completeSession(id: string): SessionResult<SessionInfo> {
    return this.transition(id, 'COMPLETED');
  }

  /** Transitions the session from RUNNING to ERROR. */
  failSession(id: string): SessionResult<SessionInfo> {
    return this.transition(id, 'ERROR');
  }

  /**
   * Removes the session regardless of its current state.
   *
   * Returns SESSION_NOT_FOUND when the id is not registered.
   */
  deleteSession(id: string): SessionResult<true> {
    if (!this.store.has(id)) {
      return sessionErr('SESSION_NOT_FOUND', `Session '${id}' is not registered.`);
    }
    this.store.delete(id);
    return { ok: true, value: true };
  }

  /**
   * Returns a defensive copy of the named session.
   *
   * Returns SESSION_NOT_FOUND when the id is not registered.
   */
  getSession(id: string): SessionResult<SessionInfo> {
    const session = this.store.get(id);
    if (!session) {
      return sessionErr('SESSION_NOT_FOUND', `Session '${id}' is not registered.`);
    }
    return { ok: true, value: cloneSession(session) };
  }

  /**
   * Returns defensive copies of all sessions in insertion order.
   * Returns an empty array when no sessions are registered.  Never fails.
   */
  listSessions(): SessionInfo[] {
    return Array.from(this.store.values()).map(cloneSession);
  }

  /**
   * Removes all registered sessions.  Never fails.
   */
  clear(): void {
    this.store.clear();
  }

  // ─── private helpers ───────────────────────────────────────────────────────

  private transition(
    id:          string,
    targetState: SessionState,
  ): SessionResult<SessionInfo> {
    const session = this.store.get(id);
    if (!session) {
      return sessionErr('SESSION_NOT_FOUND', `Session '${id}' is not registered.`);
    }
    if (!TRANSITIONS[session.state].has(targetState)) {
      return sessionErr('INVALID_STATE',
        `Cannot transition session '${id}' from ${session.state} to ${targetState}.`);
    }
    session.state     = targetState;
    session.updatedAt = Date.now();
    return { ok: true, value: cloneSession(session) };
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function cloneSession(session: SessionInfo): SessionInfo {
  const copy: SessionInfo = {
    id:        session.id,
    state:     session.state,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
  if (session.metadata !== undefined) copy.metadata = { ...session.metadata };
  return copy;
}

function sessionErr<T>(
  code:    SessionErrorCode,
  message: string,
): SessionResult<T> {
  return { ok: false, error: { code, message } };
}
