import type { AdvisorySessionState, AdvisorySessionStatus } from '../domain/conversationTypes.ts'

// ── SessionStateManager — the 4-stage lifecycle: CREATED -> ACTIVE -> IDLE -> ARCHIVED ──
// Per PROJECT_KNOWLEDGE_SYSTEM/01_PROJECT_DOCS/PHASE_X_EXECUTION_PLAN.md's X.1 exit criteria.
// Idle/archive thresholds are minutes-based and caller-supplied (no hardcoded institutional
// policy here) — the specific durations are a deployment/config concern, not this module's.

const VALID_TRANSITIONS: Readonly<Record<AdvisorySessionStatus, readonly AdvisorySessionStatus[]>> = Object.freeze({
  CREATED: ['ACTIVE', 'ARCHIVED'],
  ACTIVE: ['IDLE', 'ARCHIVED'],
  IDLE: ['ACTIVE', 'ARCHIVED'],
  ARCHIVED: [],
})

export class SessionStateManager {
  private state: AdvisorySessionState

  constructor(sessionId: string) {
    const now = new Date().toISOString()
    this.state = {
      sessionId, status: 'CREATED', startedAt: now, lastActivityAt: now,
      advisorHistory: [], attachmentRefs: [],
    }
  }

  current(): AdvisorySessionState {
    return this.state
  }

  /**
   * Rehydrates a manager from a previously-persisted state (Phase X.11 — Application Runtime
   * needs to resume a session across requests; the constructor only ever builds a fresh
   * CREATED session). Additive: does not change the constructor or any existing method.
   */
  static fromState(state: AdvisorySessionState): SessionStateManager {
    const manager = new SessionStateManager(state.sessionId)
    manager.state = state
    return manager
  }

  /** Appends an attachment reference id (Phase X.11 — Attachment persistence wiring). */
  addAttachmentRef(attachmentId: string): AdvisorySessionState {
    if (this.state.attachmentRefs.includes(attachmentId)) return this.state
    this.state = { ...this.state, attachmentRefs: [...this.state.attachmentRefs, attachmentId] }
    return this.state
  }

  /** Records activity (e.g., a new turn) — updates lastActivityAt and moves CREATED/IDLE -> ACTIVE. */
  recordActivity(advisorId?: string): AdvisorySessionState {
    const nextStatus: AdvisorySessionStatus = this.state.status === 'ARCHIVED' ? 'ARCHIVED' : 'ACTIVE'
    const advisorHistory = advisorId && !this.state.advisorHistory.includes(advisorId)
      ? [...this.state.advisorHistory, advisorId]
      : this.state.advisorHistory
    this.state = {
      ...this.state, status: nextStatus, lastActivityAt: new Date().toISOString(), advisorHistory,
    }
    return this.state
  }

  /** Explicit state transition, validated against VALID_TRANSITIONS. Throws on an invalid transition. */
  transitionTo(status: AdvisorySessionStatus): AdvisorySessionState {
    if (this.state.status === status) return this.state
    if (!VALID_TRANSITIONS[this.state.status].includes(status)) {
      throw new Error(`Invalid session transition: ${this.state.status} -> ${status}`)
    }
    this.state = { ...this.state, status, lastActivityAt: new Date().toISOString() }
    return this.state
  }

  /** True once idleMinutes have elapsed since lastActivityAt, for ACTIVE sessions only. */
  isDueForIdle(asOf: Date, idleMinutes: number): boolean {
    if (this.state.status !== 'ACTIVE') return false
    const elapsedMs = asOf.getTime() - new Date(this.state.lastActivityAt).getTime()
    return elapsedMs >= idleMinutes * 60_000
  }

  /** True once archiveMinutes have elapsed since lastActivityAt, for IDLE sessions only. */
  isDueForArchive(asOf: Date, archiveMinutes: number): boolean {
    if (this.state.status !== 'IDLE') return false
    const elapsedMs = asOf.getTime() - new Date(this.state.lastActivityAt).getTime()
    return elapsedMs >= archiveMinutes * 60_000
  }
}
