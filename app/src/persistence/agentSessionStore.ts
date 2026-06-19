/**
 * P9-04: AgentSession persistence — four public functions backed by IndexedDB
 * with automatic in-memory fallback for SSR and non-browser environments.
 *
 * Eviction: saveSession() enforces SESSION_STORE_MAX by deleting the oldest
 * sessions (by savedAt desc) after every write.
 *
 * SSR safety: when globalThis.indexedDB is absent, or openPersistenceDb()
 * rejects for any reason, the module falls back to InMemorySessionStore.
 * An injectable `factory` option enables full IndexedDB testing via fake-indexeddb.
 *
 * Never throws: all public methods always resolve.
 */

import type { AgentSession }  from '../agents/AutonomousAgent';
import type { AgentMessage }  from '../agents/types';
import type { ISessionStore, PersistedSession } from './schema';

import { serializeSession, isPersistedSession } from './schema';
import { InMemorySessionStore }                  from './memory';
import { openPersistenceDb, IndexedDbSessionStore } from './idb-stores';

// ─── Public constant ──────────────────────────────────────────────────────────

/** Maximum number of sessions retained before evicting oldest. */
export const SESSION_STORE_MAX = 10;

// ─── Options / public interface ───────────────────────────────────────────────

export interface AgentSessionStoreOptions {
  /** Max sessions to retain. Default: SESSION_STORE_MAX (10). */
  maxSessions?: number;
  /** Injectable IDBFactory for tests. Defaults to globalThis.indexedDB. */
  factory?: IDBFactory;
}

export interface AgentSessionStore {
  saveSession(session: AgentSession): Promise<void>;
  loadSession(sessionId: string): Promise<AgentSession | null>;
  listSessions(): Promise<string[]>;
  deleteSession(sessionId: string): Promise<void>;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function deserializeSession(p: PersistedSession): AgentSession {
  return {
    sessionId:       p.sessionId,
    state:           p.state,
    goal:            p.goal,
    pkg:             p.pkg,
    plannerOutput:   p.plannerOutput,
    dossierReview:   p.dossierReview,
    riskOutput:      p.riskOutput,
    pendingQuestion: p.pendingQuestion,
    startedAt:       p.startedAt,
    completedAt:     p.completedAt,
    specRetries:     p.specRetries,
    totalBudget:     p.totalBudget,
    budgetYear:      p.budgetYear,
    // PersistedMessage.from/to/type are `string`; cast back to typed union
    messageLog: p.messageLog as unknown as AgentMessage[],
  };
}

async function resolveBackingStore(opts: AgentSessionStoreOptions): Promise<ISessionStore> {
  try {
    const db = await openPersistenceDb({ factory: opts.factory });
    return new IndexedDbSessionStore(db);
  } catch {
    return new InMemorySessionStore();
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Creates an AgentSessionStore backed by IndexedDB (when available) or
 * an in-memory Map (SSR / non-browser).  Backing store is resolved lazily
 * on first use — construction is always synchronous and never throws.
 */
export function createAgentSessionStore(
  opts: AgentSessionStoreOptions = {},
): AgentSessionStore {
  const maxSessions = opts.maxSessions ?? SESSION_STORE_MAX;
  // ponytail: lazy singleton — avoid async at construction time
  let backingPromise: Promise<ISessionStore> | null = null;

  function getBacking(): Promise<ISessionStore> {
    if (!backingPromise) backingPromise = resolveBackingStore(opts);
    return backingPromise;
  }

  return {
    async saveSession(session: AgentSession): Promise<void> {
      const backing = await getBacking();
      await backing.saveSession(serializeSession(session));
      const ids = await backing.listSessions(); // newest-first
      for (const id of ids.slice(maxSessions)) {
        await backing.deleteSession(id);
      }
    },

    async loadSession(sessionId: string): Promise<AgentSession | null> {
      const backing = await getBacking();
      const raw = await backing.loadSession(sessionId);
      if (!raw || !isPersistedSession(raw)) return null;
      return deserializeSession(raw);
    },

    async listSessions(): Promise<string[]> {
      return (await getBacking()).listSessions();
    },

    async deleteSession(sessionId: string): Promise<void> {
      return (await getBacking()).deleteSession(sessionId);
    },
  };
}
