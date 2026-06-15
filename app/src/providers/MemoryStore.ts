/**
 * P6-10S: MemoryStore — persistent key-value store for conversation memory snapshots.
 *
 * Associates a sessionId with a MemorySnapshot containing the full message history
 * and timestamps.  Designed to complement ConversationMemory: a live session's
 * messages can be snapshotted here and restored later.
 *
 * Capabilities:
 *   saveMemory()    — insert or overwrite a snapshot for a sessionId
 *   loadMemory()    — retrieve a defensive copy of a snapshot
 *   deleteMemory()  — remove a snapshot by sessionId
 *   listMemories()  — return defensive copies of all snapshots in insertion order
 *   clear()         — remove all snapshots; never fails
 *
 * Overwrite semantics:
 *   When saveMemory() is called with an already-registered sessionId, the stored
 *   messages are replaced and updatedAt is refreshed, but createdAt is preserved.
 *
 * Error codes:
 *   MEMORY_NOT_FOUND — loadMemory / deleteMemory with an unknown sessionId
 *   INVALID_INPUT    — empty or whitespace-only sessionId
 *   STORE_ERROR      — catch-all for unexpected failures (defensive)
 *
 * Design rules (consistent with the rest of the provider layer):
 *   - Never throws — all failures surface as { ok: false, error }.
 *   - Defensive copies: every read returns independent snapshots.
 *     Input messages are also copied at write time so caller mutations
 *     do not corrupt stored state.
 *   - listMemories() and clear() never fail.
 *   - Insertion order is preserved by the underlying Map.
 */

import type { MemoryMessage } from './ConversationMemory';

// ─── MemorySnapshot ───────────────────────────────────────────────────────────

export interface MemorySnapshot {
  /** Unique key that identifies the session this snapshot belongs to. */
  sessionId:  string;
  /** Conversation turns stored for this session. */
  messages:   MemoryMessage[];
  /** Unix-ms timestamp when the snapshot was first created. */
  createdAt:  number;
  /** Unix-ms timestamp of the most recent saveMemory() call for this session. */
  updatedAt:  number;
}

// ─── Options ──────────────────────────────────────────────────────────────────

export interface MemoryStoreOptions {
  // Reserved for future configuration (e.g. maxSessions, persistence adapter).
}

// ─── Error types ──────────────────────────────────────────────────────────────

export type MemoryStoreErrorCode =
  | 'MEMORY_NOT_FOUND'  // loadMemory / deleteMemory with unknown sessionId
  | 'INVALID_INPUT'     // empty or whitespace-only sessionId
  | 'STORE_ERROR';      // catch-all for unexpected failures

export interface MemoryStoreError {
  code:    MemoryStoreErrorCode;
  message: string;
}

// ─── Result ───────────────────────────────────────────────────────────────────

export type MemoryStoreResult<T> =
  | { ok: true;  value: T }
  | { ok: false; error: MemoryStoreError };

// ─── MemoryStore ──────────────────────────────────────────────────────────────

export class MemoryStore {
  private readonly store: Map<string, MemorySnapshot> = new Map();

  constructor(_options?: MemoryStoreOptions) {}

  /**
   * Saves a snapshot for the given sessionId.
   *
   * If the sessionId is already registered the existing snapshot is overwritten:
   *   - messages  → replaced with copies of the new input
   *   - updatedAt → set to Date.now()
   *   - createdAt → preserved from the original save
   *
   * If the sessionId is new, both createdAt and updatedAt are set to Date.now().
   *
   * Returns INVALID_INPUT when sessionId is empty or whitespace-only.
   * Returns a defensive copy of the stored snapshot on success.
   */
  saveMemory(
    sessionId: string,
    messages:  MemoryMessage[],
  ): MemoryStoreResult<MemorySnapshot> {
    if (!sessionId || !sessionId.trim()) {
      return storeErr('INVALID_INPUT',
        'sessionId must be a non-empty, non-whitespace string.');
    }

    const now      = Date.now();
    const existing = this.store.get(sessionId);

    const snapshot: MemorySnapshot = {
      sessionId,
      messages:  messages.map(m => ({ ...m })),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    this.store.set(sessionId, snapshot);
    return { ok: true, value: cloneSnapshot(snapshot) };
  }

  /**
   * Returns a defensive copy of the snapshot for the given sessionId.
   *
   * Returns INVALID_INPUT when sessionId is empty or whitespace-only.
   * Returns MEMORY_NOT_FOUND when no snapshot is registered for the sessionId.
   */
  loadMemory(sessionId: string): MemoryStoreResult<MemorySnapshot> {
    if (!sessionId || !sessionId.trim()) {
      return storeErr('INVALID_INPUT',
        'sessionId must be a non-empty, non-whitespace string.');
    }
    const snapshot = this.store.get(sessionId);
    if (!snapshot) {
      return storeErr('MEMORY_NOT_FOUND',
        `No memory snapshot found for session '${sessionId}'.`);
    }
    return { ok: true, value: cloneSnapshot(snapshot) };
  }

  /**
   * Removes the snapshot for the given sessionId.
   *
   * Returns INVALID_INPUT when sessionId is empty or whitespace-only.
   * Returns MEMORY_NOT_FOUND when no snapshot is registered for the sessionId.
   */
  deleteMemory(sessionId: string): MemoryStoreResult<true> {
    if (!sessionId || !sessionId.trim()) {
      return storeErr('INVALID_INPUT',
        'sessionId must be a non-empty, non-whitespace string.');
    }
    if (!this.store.has(sessionId)) {
      return storeErr('MEMORY_NOT_FOUND',
        `No memory snapshot found for session '${sessionId}'.`);
    }
    this.store.delete(sessionId);
    return { ok: true, value: true };
  }

  /**
   * Returns defensive copies of all stored snapshots in insertion order.
   * Returns an empty array when the store is empty.  Never fails.
   */
  listMemories(): MemorySnapshot[] {
    return Array.from(this.store.values()).map(cloneSnapshot);
  }

  /**
   * Removes all stored snapshots.  Never fails.
   */
  clear(): void {
    this.store.clear();
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function cloneSnapshot(snapshot: MemorySnapshot): MemorySnapshot {
  return {
    sessionId:  snapshot.sessionId,
    messages:   snapshot.messages.map(m => ({ ...m })),
    createdAt:  snapshot.createdAt,
    updatedAt:  snapshot.updatedAt,
  };
}

function storeErr<T>(
  code:    MemoryStoreErrorCode,
  message: string,
): MemoryStoreResult<T> {
  return { ok: false, error: { code, message } };
}
