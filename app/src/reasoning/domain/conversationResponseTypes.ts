import type { ConfidenceLabel } from './reasoningTypes.ts'

// ── Conversation Response Types — Phase X.5 (Output Formatting) ───────────────
// NUMBERING NOTE (grep/read-verified before use, per this project's collision-check
// discipline): PHASE_X_EXECUTION_PLAN.md already assigns X.5 to Tool Calling. This is the same
// kind of numbering collision already reconciled once for X.4 (Output Validation vs. Reasoning
// Engine Wiring) — recorded transparently here, not silently ignored. This milestone is tracked
// under the user's own "Phase X.5 (Output Formatting)" label for this session; a future session
// may prefer to renumber it as a continuation of the X.4.x reasoning-answer track (e.g. X.4.8),
// since it operates directly and only on X.4.7's ReasoningAnswerResult.
//
// Reuses ConfidenceLabel (Batch A, frozen, already exported) as-is — the confidence label is
// displayed, never recomputed. ConversationResponse/ResponseSection/FormattingOptions are new:
// a pure presentation shape, structurally compatible with (but not literally reusing, since
// Conversation Core is frozen and untouched) AdvisoryConversationMessage's own
// {content, ...} convention — a caller wanting to append this to conversation history builds
// its own AdvisoryConversationMessage from ConversationResponse.markdown.

export type ResponseLanguage = 'vi' | 'en'

export interface ResponseSection {
  readonly heading: string
  readonly body: string
}

export interface FormattingOptions {
  readonly language?: ResponseLanguage
  readonly includeDisputedCitations?: boolean
  readonly maxCitationsPerSection?: number
}

export interface ConversationResponse {
  readonly markdown: string
  readonly sections: readonly ResponseSection[]
  readonly confidenceLabel: ConfidenceLabel
  readonly confidenceScore: number
  readonly warnings: readonly string[]
  readonly humanReviewRecommended: boolean
  readonly humanReviewReason?: string
  readonly citationCount: number
  readonly language: ResponseLanguage
  readonly formattedAt: string
}
