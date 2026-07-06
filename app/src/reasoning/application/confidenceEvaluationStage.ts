import { computeConfidence } from './answerComposer.ts'
import type { ConfidenceEvaluationResult, EvidenceWeightSummary } from '../domain/confidenceEvaluationTypes.ts'
import type { AppliedDocument, AppliedRole, DetectedConflict, KnowledgeItemRef } from '../domain/reasoningTypes.ts'
import type { ReasoningExecutionContext } from '../domain/reasoningExecutionContextTypes.ts'
import type { RuleEvaluationResult } from '../domain/ruleEvaluationTypes.ts'
import type { ConflictResolutionResult } from '../domain/conflictResolutionTypes.ts'

// ── Confidence Evaluation Stage — Phase X.4.5 ──────────────────────────────────
// Consumes X.4.2's ReasoningExecutionContext, X.4.3's RuleEvaluationResult, and X.4.4's
// ConflictResolutionResult, and produces only a ConfidenceEvaluationResult. No new conflict
// resolution, no modification of conflict results, no citation/explanation/answer generation,
// no repository/KnowledgePlatform/provider/LLM access — all of that remains
// legalReasoningEngine.ts's job, untouched.
//
// TRANSPARENCY NOTE (per this milestone's explicit "reuse every existing public scorer, do not
// duplicate scoring logic, do not expose private helpers from previous milestones" instruction):
// answerComposer.ts's computeConfidence() (Batch A, frozen) IS already public and exported —
// unlike X.4.4's conflict cascade, this milestone genuinely has a public scorer to reuse, and
// it is called here directly. The confidence FORMULA (deduction weights, thresholds, label
// bands) is never reimplemented.
//
// computeConfidence() requires appliedDocuments/primaryItemConfidences — data
// legalReasoningEngine.ts derives via its own private toAppliedDocument()/roleByItemId
// bookkeeping, which is not exported (per "do not expose private helpers") and not touched here.
// This stage independently derives the SAME role-assignment bookkeeping from data this
// milestone's own inputs already provide — this is exactly the "aggregate supporting evidence
// weight / aggregate rejected evidence weight" responsibility this milestone is scoped for, not
// a re-implementation of conflict-resolution or confidence-scoring logic. Verified byte-for-byte
// equivalent to the real, frozen engine's own confidence output by dedicated parity tests.
//
// Honest scope gaps, never fabricated: missingEvidence is always [] and unresolvedExceptionCount/
// unresolvedCrossReferenceCount are always 0 — evidence collection and exception detection are
// evidenceCollector.ts's/ruleEngine.ts's own jobs, deliberately out of scope for every X.4.x
// milestone so far (X.4.3 already made the identical choice for exception detection). These are
// honest zeros reflecting data that genuinely does not exist in this pipeline yet, never
// fabricated non-zero values.

const MAX_HIERARCHY_LEVEL = 14

function authorityLevelFromHierarchyScore(score: number): number {
  return Math.round(1 + (1 - score) * (MAX_HIERARCHY_LEVEL - 1))
}

function toAppliedDocument(item: KnowledgeItemRef, role: AppliedRole, wasSuperseded: boolean, authorityLevel: number): AppliedDocument {
  const basis = item.legalBasis[0]
  return {
    itemId: item.itemId, documentSymbol: basis?.documentSymbol ?? item.itemId, documentType: item.type,
    title: item.title, authorityLevel, effectiveFrom: item.effectiveFrom, effectiveTo: item.effectiveTo,
    role, wasSuperseded,
  }
}

// Mirrors legalReasoningEngine.ts's own roleByItemId construction exactly: every currently-valid
// candidate defaults to SUPPORTING_BASIS; a resolved conflict promotes its appliedItem to
// PRIMARY_BASIS and (only when set — the MORE_RESTRICTIVE-wins branch deliberately leaves
// supersededItem undefined) demotes its supersededItem to CONFLICT_SOURCE; an unresolved
// conflict demotes both conflicting items to CONFLICT_SOURCE.
function computeRoleByItemId(currentItemIds: readonly string[], conflicts: readonly DetectedConflict[]): Map<string, AppliedRole> {
  const roleByItemId = new Map<string, AppliedRole>(currentItemIds.map(id => [id, 'SUPPORTING_BASIS' as AppliedRole]))
  for (const conflict of conflicts) {
    if (conflict.isResolved) {
      if (conflict.appliedItem !== undefined) roleByItemId.set(conflict.appliedItem, 'PRIMARY_BASIS')
      if (conflict.supersededItem !== undefined) roleByItemId.set(conflict.supersededItem, 'CONFLICT_SOURCE')
    } else {
      for (const conflictingItem of conflict.conflictingItems) roleByItemId.set(conflictingItem.itemId, 'CONFLICT_SOURCE')
    }
  }
  return roleByItemId
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const key of Object.getOwnPropertyNames(value)) {
      deepFreeze((value as Record<string, unknown>)[key])
    }
    Object.freeze(value)
  }
  return value
}

export function evaluateConfidence(
  context: ReasoningExecutionContext,
  ruleEvaluation: RuleEvaluationResult,
  conflictResolution: ConflictResolutionResult,
): ConfidenceEvaluationResult {
  const evaluationByItemId = new Map(ruleEvaluation.itemEvaluations.map(e => [e.itemId, e]))
  const candidates = [...context.legalItems, ...context.schoolPolicyItems]

  const currentItemIds = candidates
    .filter(item => evaluationByItemId.get(item.itemId)?.temporalValidity === 'CURRENT')
    .map(item => item.itemId)
  const roleByItemId = computeRoleByItemId(currentItemIds, conflictResolution.conflicts)

  const appliedDocuments: AppliedDocument[] = []
  for (const item of candidates) {
    const temporalValidity = evaluationByItemId.get(item.itemId)?.temporalValidity
    const hierarchyScore = evaluationByItemId.get(item.itemId)?.hierarchyScore ?? 0
    const authorityLevel = authorityLevelFromHierarchyScore(hierarchyScore)
    if (temporalValidity === 'CURRENT') {
      appliedDocuments.push(toAppliedDocument(item, roleByItemId.get(item.itemId)!, false, authorityLevel))
    } else if (temporalValidity === 'EXPIRED') {
      appliedDocuments.push(toAppliedDocument(item, 'SUPERSEDED_CONTEXT', true, authorityLevel))
    }
    // NOT_YET_EFFECTIVE / MISSING_EVIDENCE / no evaluation at all: excluded entirely, matching
    // legalReasoningEngine.ts's own isEffectiveAt-based exclusion from appliedDocuments.
  }

  const primaryItemConfidences = candidates
    .filter(item => roleByItemId.get(item.itemId) === 'PRIMARY_BASIS')
    .map(item => item.confidence)

  const confidence = computeConfidence({
    intent: context.intent,
    conflicts: conflictResolution.conflicts,
    appliedDocuments,
    missingEvidence: [],
    unresolvedCrossReferenceCount: 0,
    unresolvedExceptionCount: 0,
    primaryItemConfidences,
  })

  const supportingEvidence: EvidenceWeightSummary[] = candidates
    .filter(item => {
      const role = roleByItemId.get(item.itemId)
      return role === 'PRIMARY_BASIS' || role === 'SUPPORTING_BASIS'
    })
    .map(item => ({ itemId: item.itemId, confidence: item.confidence }))

  const rejectedEvidence: EvidenceWeightSummary[] = candidates
    .filter(item => roleByItemId.get(item.itemId) === 'CONFLICT_SOURCE')
    .map(item => ({ itemId: item.itemId, confidence: item.confidence }))

  const result: ConfidenceEvaluationResult = {
    confidence,
    supportingEvidence,
    rejectedEvidence,
    supportingWeight: supportingEvidence.reduce((sum, e) => sum + e.confidence, 0),
    rejectedWeight: rejectedEvidence.reduce((sum, e) => sum + e.confidence, 0),
    evaluatedAt: new Date().toISOString(),
  }
  return deepFreeze(result)
}
