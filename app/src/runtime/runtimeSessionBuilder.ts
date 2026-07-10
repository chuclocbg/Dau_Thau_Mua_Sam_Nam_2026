import type { ISessionRepository } from '../conversation/infrastructure/memorySessionRepository.ts'
import { ConversationSession } from './conversationSession.ts'

// ── RuntimeSessionBuilder — Phase X.11 Application Runtime ────────────────────
// Creates and resumes ConversationSession instances against an ISessionRepository (memory- or
// Prisma-backed, per Runtime dependency composition). Idle/archive thresholds are caller-
// supplied per SessionStateManager's own documented design ("no hardcoded institutional policy
// here") -- this builder only supplies defaults, never invents new lifecycle rules.

export interface RuntimeSessionBuilderOptions {
  readonly idleMinutes?: number
  readonly archiveMinutes?: number
}

const DEFAULT_IDLE_MINUTES = 30
const DEFAULT_ARCHIVE_MINUTES = 24 * 60

export class RuntimeSessionBuilder {
  private readonly idleMinutes: number
  private readonly archiveMinutes: number

  constructor(
    private readonly sessionRepository: ISessionRepository,
    options: RuntimeSessionBuilderOptions = {},
  ) {
    this.idleMinutes = options.idleMinutes ?? DEFAULT_IDLE_MINUTES
    this.archiveMinutes = options.archiveMinutes ?? DEFAULT_ARCHIVE_MINUTES
  }

  /** Creates and persists a brand-new session. */
  async createSession(): Promise<ConversationSession> {
    const session = ConversationSession.createNew()
    const created = await this.sessionRepository.create(session.toPersistedFields())
    return session.withRepoId(created.id)
  }

  /**
   * Resumes an existing session by its business sessionId (via findBySessionId(), the lookup
   * ISessionRepository already exposes for exactly this purpose). Returns null if not found.
   * Applies the existing idle/archive lifecycle check on resume.
   */
  async resumeSession(sessionId: string, asOf: Date = new Date()): Promise<ConversationSession | null> {
    const persisted = await this.sessionRepository.findBySessionId(sessionId)
    if (!persisted) return null
    const session = ConversationSession.fromPersisted(persisted)
    session.applyLifecycleCheck(asOf, this.idleMinutes, this.archiveMinutes)
    return session
  }

  /** Persists the session's current state/history and returns the updated record. */
  async persist(session: ConversationSession) {
    return this.sessionRepository.update(session.repoId, session.toPersistedFields())
  }
}
