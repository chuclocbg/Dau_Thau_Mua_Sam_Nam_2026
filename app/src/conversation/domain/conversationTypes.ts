// ── Phase X.1 — Conversation Core domain types ────────────────────────────────
// Per PROJECT_KNOWLEDGE_SYSTEM/01_PROJECT_DOCS/{AI_ADVISORY_ARCHITECTURE,
// PHASE_X_EXECUTION_PLAN,PHASE_X_READINESS_REVIEW}.md. Pure types — no logic.
//
// NAMING NOTE (found during pre-implementation collision check, not present in any
// prior design doc): `ConversationContext`, `ConversationMessage`, `SessionState`,
// and `ConversationMemory` all already exist as unrelated types/classes elsewhere in
// this repository (src/workspace/workspaceTypes.ts, src/providers/ConversationMemory.ts,
// src/providers/SessionManager.ts, src/components/SessionPanel.tsx) — all belonging to a
// different, pre-existing, unrelated commit track, never part of Phase A-N or this
// project's own work. Every type here is prefixed `Advisory` to avoid recreating that
// collision, the same avoidance principle already applied to src/mcp/ and
// src/reasoning/orchestration/ in the Execution Plan. This is a naming choice only —
// the architectural role of each type is unchanged from what the design docs specify.
//
// Per the Readiness Review: `AdvisoryConversationMessage` is defined locally here rather
// than importing `AIContextMessage` from a future src/ai/domain/aiTypes.ts (Phase X.2),
// which does not exist yet. The dependency direction is X.2 -> X.1, never the reverse.

export type AdvisoryMessageRole = 'USER' | 'ASSISTANT' | 'SYSTEM'

export interface AdvisoryConversationMessage {
  readonly messageId: string
  readonly role: AdvisoryMessageRole
  readonly content: string
  readonly timestamp: string
  readonly tokenCount: number
}

export interface AdvisoryConversationHistory {
  readonly sessionId: string
  readonly messages: readonly AdvisoryConversationMessage[]
  readonly droppedTurnCount: number
}

export type AdvisorySessionStatus = 'CREATED' | 'ACTIVE' | 'IDLE' | 'ARCHIVED'

export interface AdvisorySessionState {
  readonly sessionId: string
  readonly status: AdvisorySessionStatus
  readonly startedAt: string
  readonly lastActivityAt: string
  readonly advisorHistory: readonly string[]
  // ponytail: ToolCalls deliberately omitted — deferred to Phase X.5 (Tool Calling), per
  // PHASE_X_READINESS_REVIEW.md's scope recommendation. Add as an optional field there.
  readonly attachmentRefs: readonly string[]
}

export interface AdvisoryConversationContext {
  readonly sessionId: string
  readonly userId: string
  readonly activeAdvisorId: string | null
  readonly currentQuestion: string | null
  readonly turnNumber: number
}

// ── Repository-persisted entity (IBaseRepository-compatible shape) ───────────

export interface AdvisoryConversationSession {
  readonly id: string
  readonly createdAt: string
  readonly updatedAt: string
  readonly sessionState: AdvisorySessionState
  readonly history: AdvisoryConversationHistory
}
