import { SessionStateManager } from '../conversation/application/sessionState.ts'
import { AdvisoryConversationMemory } from '../conversation/application/conversationMemory.ts'
import type {
  AdvisoryConversationSession, AdvisoryConversationMessage, AdvisorySessionState, AdvisoryConversationHistory,
} from '../conversation/domain/conversationTypes.ts'

// ── ConversationSession — Phase X.11 Application Runtime ──────────────────────
// The Runtime-layer aggregate for one live conversation session. Wraps the frozen Phase X.1
// managers (SessionStateManager, AdvisoryConversationMemory) rather than reimplementing their
// lifecycle/pruning logic, and tracks two identifiers deliberately kept distinct, matching
// Phase X.1's own existing design (see conversation-repository.test.ts's fixtures and
// ISessionRepository.findBySessionId()):
//   - repoId  — the persistence layer's own primary key (IBaseRepository-assigned, opaque)
//   - sessionId — the business-facing identifier embedded in AdvisorySessionState/
//                 AdvisoryConversationHistory, looked up via findBySessionId()
// This is not a bug being worked around; ISessionRepository.create()'s signature (per
// IBaseRepository<T>, frozen) never lets a caller supply its own id, so the two identifiers are
// independent by the pre-existing contract's own design.

export class ConversationSession {
  private constructor(
    readonly repoId: string,
    readonly sessionId: string,
    private readonly stateManager: SessionStateManager,
    private readonly memory: AdvisoryConversationMemory,
  ) {}

  /** Builds a brand-new, not-yet-persisted session state (CREATED, empty history). */
  static createNew(): ConversationSession {
    const sessionId = crypto.randomUUID()
    return new ConversationSession('', sessionId, new SessionStateManager(sessionId), new AdvisoryConversationMemory(sessionId))
  }

  /** Rehydrates a session from a persisted AdvisoryConversationSession row. */
  static fromPersisted(persisted: AdvisoryConversationSession): ConversationSession {
    return new ConversationSession(
      persisted.id,
      persisted.sessionState.sessionId,
      SessionStateManager.fromState(persisted.sessionState),
      AdvisoryConversationMemory.fromHistory(persisted.history),
    )
  }

  /** Returns a copy of this session bound to a repository-assigned id (after first create()). */
  withRepoId(repoId: string): ConversationSession {
    return new ConversationSession(repoId, this.sessionId, this.stateManager, this.memory)
  }

  get state(): AdvisorySessionState {
    return this.stateManager.current()
  }

  get history(): AdvisoryConversationHistory {
    return this.memory.current()
  }

  /** Applies the existing idle/archive lifecycle rules (Phase X.1, SessionStateManager) as-is. */
  applyLifecycleCheck(asOf: Date, idleMinutes: number, archiveMinutes: number): void {
    if (this.stateManager.isDueForIdle(asOf, idleMinutes)) this.stateManager.transitionTo('IDLE')
    if (this.stateManager.isDueForArchive(asOf, archiveMinutes)) this.stateManager.transitionTo('ARCHIVED')
  }

  /** Records one conversational turn: activity + both messages, via the existing X.1 managers. */
  recordTurn(userMessage: AdvisoryConversationMessage, assistantMessage: AdvisoryConversationMessage, advisorId: string): void {
    this.stateManager.recordActivity(advisorId)
    this.memory.append(userMessage)
    this.memory.append(assistantMessage)
  }

  /** Records a new attachment reference id against this session's state. */
  recordAttachment(attachmentId: string): void {
    this.stateManager.addAttachmentRef(attachmentId)
  }

  /** The (sessionState, history) pair to persist via ISessionRepository.create()/update(). */
  toPersistedFields(): Pick<AdvisoryConversationSession, 'sessionState' | 'history'> {
    return { sessionState: this.stateManager.current(), history: this.memory.current() }
  }
}
