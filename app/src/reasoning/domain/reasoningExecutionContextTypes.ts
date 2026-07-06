import type {
  KnowledgeItemRef, ReasoningIntent, RuleKnowledgeItemRef, ThresholdKnowledgeItemRef,
} from './reasoningTypes.ts'

// ── Reasoning Execution Context — Phase X.4.2 ──────────────────────────────────
// NAMING NOTE (grep-verified before use, per this project's collision-check discipline):
// reasoningTypes.ts already defines ReasoningContext (Batch A, frozen — the extracted
// packageType/fundSource/asOfDate/... fields on ReasoningIntent.context). This is a distinct
// concept: an immutable, deeply-frozen bundle of an intent plus its already-resolved knowledge,
// assembled for later reasoning stages to consume. Named ReasoningExecutionContext, not
// ReasoningContext, to avoid shadowing the existing type.
//
// Deliberately reuses KnowledgeItemRef/RuleKnowledgeItemRef/ThresholdKnowledgeItemRef as-is
// (Batch A, frozen) rather than inventing parallel "Normalized*" types — those types are
// already the correctly-shaped, normalized form (X.3.1's own design intent); duplicating them
// here would repeat PHASE_X3_FINAL_ARCHITECTURE_AUDIT.md's Finding F-5 (proliferating
// near-identical types for one concept).

export interface ReasoningExecutionContext {
  readonly intent: ReasoningIntent
  readonly asOfDate: string
  readonly legalItems: readonly KnowledgeItemRef[]
  readonly procurementItems: readonly KnowledgeItemRef[]
  readonly schoolPolicyItems: readonly KnowledgeItemRef[]
  readonly ruleItems: readonly RuleKnowledgeItemRef[]
  readonly thresholdItems: readonly ThresholdKnowledgeItemRef[]
  readonly resolvedAt: string
  readonly platformCallCount: number
  readonly warnings: readonly string[]
  readonly assembledAt: string
}
