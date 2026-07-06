import type { DetectedConflict } from './reasoningTypes.ts'

// ── Conflict Resolution Types — Phase X.4.4 ────────────────────────────────────
// Reuses DetectedConflict/ConflictingItem/ConflictResolution (Batch A, frozen, already
// exported) as-is rather than inventing parallel types — the exact shape
// legalReasoningEngine.ts's own frozen cascade already produces. Only RejectedCandidateEntry
// is new: DetectedConflict.supersededItem names the loser but carries no rejection-reason
// string of its own.

export interface RejectedCandidateEntry {
  readonly itemId: string
  readonly reason: string
}

export interface ConflictResolutionResult {
  readonly conflicts: readonly DetectedConflict[]
  readonly rejectedCandidates: readonly RejectedCandidateEntry[]
  readonly resolvedAt: string
}
