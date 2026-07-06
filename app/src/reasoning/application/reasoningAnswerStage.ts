import { composeDecision } from './answerComposer.ts'
import type { ReasoningAnswerResult } from '../domain/reasoningAnswerTypes.ts'
import type { ReasoningExecutionContext } from '../domain/reasoningExecutionContextTypes.ts'
import type { ConflictResolutionResult } from '../domain/conflictResolutionTypes.ts'
import type { ConfidenceEvaluationResult } from '../domain/confidenceEvaluationTypes.ts'
import type { CitationGenerationResult } from '../domain/citationGenerationTypes.ts'

// ── Reasoning Answer Stage — Phase X.4.7 ───────────────────────────────────────
// Consumes X.4.2's ReasoningExecutionContext, X.4.4's ConflictResolutionResult, X.4.5's
// ConfidenceEvaluationResult, and X.4.6's CitationGenerationResult, and produces only a
// ReasoningAnswerResult. No new rule evaluation, no new conflict resolution, no recomputed
// confidence, no regenerated citations, no repository/KnowledgePlatform/provider/LLM/
// PromptBuilder/MCP/Tool Calling/Multi-Agent access — all of that remains
// legalReasoningEngine.ts's job, untouched.
//
// TRANSPARENCY NOTE (per this milestone's explicit "reuse existing public answer-composition
// helpers wherever possible, never duplicate explanation or formatting logic, never expose
// private helpers" instruction): answerComposer.ts's composeDecision() (Batch A, frozen) IS
// already public and exported and is called here directly — its short-circuit logic (no
// decision below 50% confidence, no decision without at least one PASS/EXCEPTION rule passage)
// is never reimplemented by hand.
//
// HONEST SCOPE GAP (documented, not fabricated): composeDecision() requires ruleResults
// (LegalRuleResult[], produced by X.4.3's RuleEvaluationResult) to find PASS/EXCEPTION
// passages — X.4.3 is not one of this milestone's stated inputs. This stage therefore always
// calls composeDecision() with an empty ruleResults array, meaning `decision` is always null in
// this milestone's current scope (composeDecision()'s own `passages.length === 0` short-circuit
// fires unconditionally). This is a real, disclosed limitation, not a silently-broken feature —
// confirmed and locked in by a dedicated parity test that also proves the real, frozen engine
// produces a real, non-null decision for the same real-platform scenario once genuine rule
// results exist. Calling the real function with an honest empty array is still preferred over
// hand-writing "always return null" — it delegates to the one real implementation of this
// short-circuit rather than reimplementing it, so if composeDecision()'s own logic ever changes
// upstream, this stage's behavior tracks it automatically.
//
// "Combine accepted conclusions / expose structured answer sections only" is implemented as
// grouping — never reformatting — the citations X.4.6 already produced: primaryCitations
// (isPrimary), disputedCitations (role CONFLICT_SOURCE), and everything else as
// supportingCitations. No new sort: the reused citations array's own order (X.4.6's, itself
// preserving X.4.2/X.3.4's order) is preserved by simple, order-stable array filtering.

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const key of Object.getOwnPropertyNames(value)) {
      deepFreeze((value as Record<string, unknown>)[key])
    }
    Object.freeze(value)
  }
  return value
}

export function composeAnswer(
  _context: ReasoningExecutionContext,
  conflictResolution: ConflictResolutionResult,
  confidenceEvaluation: ConfidenceEvaluationResult,
  citationGeneration: CitationGenerationResult,
): ReasoningAnswerResult {
  const primaryCitations = citationGeneration.citations.filter(citation => citation.isPrimary)
  const disputedCitations = citationGeneration.citations.filter(citation => citation.role === 'CONFLICT_SOURCE')
  const supportingCitations = citationGeneration.citations.filter(
    citation => !citation.isPrimary && citation.role !== 'CONFLICT_SOURCE',
  )

  const decision = composeDecision(citationGeneration.citations, [], confidenceEvaluation.confidence.finalScore)

  const result: ReasoningAnswerResult = {
    decision,
    primaryCitations,
    supportingCitations,
    disputedCitations,
    confidenceSummary: confidenceEvaluation.confidence,
    conflicts: conflictResolution.conflicts,
    composedAt: new Date().toISOString(),
  }
  return deepFreeze(result)
}
