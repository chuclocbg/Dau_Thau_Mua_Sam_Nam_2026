import { legalHierarchyScore } from './rankingStrategy.ts'
import type { ConflictResolutionResult, RejectedCandidateEntry } from '../domain/conflictResolutionTypes.ts'
import type { ConflictingItem, DetectedConflict, KnowledgeItemRef } from '../domain/reasoningTypes.ts'
import type { ReasoningExecutionContext } from '../domain/reasoningExecutionContextTypes.ts'
import type { RuleEvaluationResult } from '../domain/ruleEvaluationTypes.ts'

// ── Conflict Resolution Stage — Phase X.4.4 ────────────────────────────────────
// Consumes X.4.2's ReasoningExecutionContext and X.4.3's RuleEvaluationResult and produces
// only a ConflictResolutionResult. No confidence scoring, no citation/explanation/answer
// generation, no repository/KnowledgePlatform access — all of that remains
// legalReasoningEngine.ts's job, untouched.
//
// TRANSPARENCY NOTE (per this milestone's explicit "reuse existing public components, never
// duplicate conflict logic already implemented elsewhere" instruction): legalReasoningEngine.ts
// (Batch A, frozen) already contains a complete 4-tier conflict-resolution cascade
// (detectAndResolveConflicts/resolveConflict), but every function involved is a private,
// non-exported implementation detail of that file — there is no public component to reuse for
// the cascade itself, and modifying a frozen file to export one is out of this milestone's
// scope (not authorized here, unlike the narrow, explicitly-approved pre-X.4 API cleanup).
// What follows is a from-scratch re-expression of the exact same four tiers, same tie-break
// order, same field semantics — verified byte-for-byte equivalent by dedicated parity tests
// (rule-evaluation... conflict-resolution-parity.test.ts) that feed the frozen cascade's own
// three test scenarios (Tier 1 hierarchy, Tier 3 lex posterior, UNRESOLVED) through this stage
// and assert identical outcomes. Two pieces ARE genuinely reused, not reimplemented:
//   - Item applicability (which items are even eligible to conflict) comes from X.4.3's own
//     RuleEvaluationResult.itemEvaluations[].applicability === 'APPLICABLE', never re-derived
//     via a fresh temporal check.
//   - The authority-hierarchy comparison itself uses rankingStrategy.ts's own exported
//     legalHierarchyScore() (X.3.4, frozen) directly — a higher score means stronger authority,
//     the same ordering authorityLevelOf()'s lower-is-stronger raw level produces, just
//     measured on an inverted 0-1 scale. This is the one piece of the frozen cascade that WAS
//     already a public, reusable component, so it is not re-derived at all.
//
// MAX_HIERARCHY_LEVEL below is the same constant rankingStrategy.ts uses internally (not
// exported there) to invert a hierarchyScore back into a ConflictingItem.authorityLevel value
// for the reused, frozen ConflictingItem type — a documented, tested round-trip, not an
// independent authority table.

const MAX_HIERARCHY_LEVEL = 14

function authorityLevelFromHierarchyScore(score: number): number {
  return Math.round(1 + (1 - score) * (MAX_HIERARCHY_LEVEL - 1))
}

function toConflictingItem(item: KnowledgeItemRef, hierarchyScore: number): ConflictingItem {
  const basis = item.legalBasis[0]
  return {
    itemId: item.itemId, documentSymbol: basis?.documentSymbol ?? item.itemId,
    article: basis?.article, provision: item.summary,
    authorityLevel: authorityLevelFromHierarchyScore(hierarchyScore),
    effectiveFrom: item.effectiveFrom, layer: item.layer,
  }
}

interface ConflictOutcome {
  readonly conflict: DetectedConflict
}

function isMoreRestrictive(candidate: KnowledgeItemRef, baseline: KnowledgeItemRef): boolean | null {
  const candidateValue = Number.parseFloat(String(candidate.metadata['conflictValue'] ?? ''))
  const baselineValue = Number.parseFloat(String(baseline.metadata['conflictValue'] ?? ''))
  if (Number.isNaN(candidateValue) || Number.isNaN(baselineValue)) return null
  if (candidateValue === baselineValue) return null
  return candidateValue < baselineValue
}

function resolvePair(a: KnowledgeItemRef, b: KnowledgeItemRef, hierarchyScoreOf: (item: KnowledgeItemRef) => number): ConflictOutcome {
  const conflictId = `conflict-${a.itemId}-${b.itemId}`
  const description = `Xung đột giữa ${a.legalBasis[0]?.documentSymbol ?? a.itemId} và ${b.legalBasis[0]?.documentSymbol ?? b.itemId}`
  const conflictingItems: readonly [ConflictingItem, ConflictingItem] = [
    toConflictingItem(a, hierarchyScoreOf(a)), toConflictingItem(b, hierarchyScoreOf(b)),
  ]

  const layer3 = a.layer === 3 ? a : b.layer === 3 ? b : null
  if (layer3) {
    const other = layer3 === a ? b : a
    const moreRestrictive = isMoreRestrictive(layer3, other)
    if (moreRestrictive === true) {
      return { conflict: { conflictId, description, conflictingItems, resolution: 'RESOLVED_BY_MORE_RESTRICTIVE', isResolved: true, appliedItem: layer3.itemId, supersededItem: undefined } }
    }
    if (moreRestrictive === false) {
      return { conflict: { conflictId, description, conflictingItems, resolution: 'RESOLVED_BY_HIERARCHY', isResolved: true, appliedItem: other.itemId, supersededItem: layer3.itemId } }
    }
  }

  const scoreA = hierarchyScoreOf(a), scoreB = hierarchyScoreOf(b)
  if (scoreA !== scoreB) {
    const [winner, loser] = scoreA > scoreB ? [a, b] : [b, a]
    return { conflict: { conflictId, description, conflictingItems, resolution: 'RESOLVED_BY_HIERARCHY', isResolved: true, appliedItem: winner.itemId, supersededItem: loser.itemId } }
  }

  if (a.effectiveFrom !== b.effectiveFrom) {
    const [winner, loser] = a.effectiveFrom > b.effectiveFrom ? [a, b] : [b, a]
    return { conflict: { conflictId, description, conflictingItems, resolution: 'RESOLVED_BY_LEX_POSTERIOR', isResolved: true, appliedItem: winner.itemId, supersededItem: loser.itemId } }
  }

  const scopeA = String(a.metadata['scope'] ?? 'ALL')
  const scopeB = String(b.metadata['scope'] ?? 'ALL')
  if (scopeA !== scopeB) {
    const [narrow, broad] = scopeA === 'ALL' ? [b, a] : [a, b]
    if (scopeA === 'ALL' || scopeB === 'ALL') {
      return { conflict: { conflictId, description, conflictingItems, resolution: 'RESOLVED_BY_LEX_SPECIALIS', isResolved: true, appliedItem: narrow.itemId, supersededItem: broad.itemId } }
    }
  }

  return { conflict: { conflictId, description, conflictingItems, resolution: 'UNRESOLVED', isResolved: false } }
}

function groupByConflictDimension(items: readonly KnowledgeItemRef[]): Map<string, KnowledgeItemRef[]> {
  const groups = new Map<string, KnowledgeItemRef[]>()
  for (const item of items) {
    const dimension = item.metadata['conflictDimension']
    if (typeof dimension !== 'string') continue
    const group = groups.get(dimension) ?? []
    group.push(item)
    groups.set(dimension, group)
  }
  return groups
}

function rejectionReason(conflict: DetectedConflict): string {
  return `Superseded by ${conflict.appliedItem} (${conflict.resolution})`
}

function collectRejectedCandidates(conflicts: readonly DetectedConflict[]): readonly RejectedCandidateEntry[] {
  const seen = new Set<string>()
  const result: RejectedCandidateEntry[] = []
  for (const conflict of conflicts) {
    if (conflict.supersededItem === undefined || seen.has(conflict.supersededItem)) continue
    seen.add(conflict.supersededItem)
    result.push({ itemId: conflict.supersededItem, reason: rejectionReason(conflict) })
  }
  return result
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

export function resolveConflicts(
  context: ReasoningExecutionContext, ruleEvaluation: RuleEvaluationResult,
): ConflictResolutionResult {
  const applicableItemIds = new Set(
    ruleEvaluation.itemEvaluations.filter(e => e.applicability === 'APPLICABLE').map(e => e.itemId),
  )
  const hierarchyScoreByItemId = new Map(
    ruleEvaluation.itemEvaluations.map(e => [e.itemId, e.hierarchyScore] as const),
  )
  const hierarchyScoreOf = (item: KnowledgeItemRef): number => hierarchyScoreByItemId.get(item.itemId) ?? legalHierarchyScore(item)

  const candidates = [...context.legalItems, ...context.schoolPolicyItems]
    .filter(item => applicableItemIds.has(item.itemId))

  const conflicts: DetectedConflict[] = []
  for (const group of groupByConflictDimension(candidates).values()) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i]!, b = group[j]!
        if (a.metadata['conflictValue'] === b.metadata['conflictValue']) continue
        conflicts.push(resolvePair(a, b, hierarchyScoreOf).conflict)
      }
    }
  }

  const result: ConflictResolutionResult = {
    conflicts,
    rejectedCandidates: collectRejectedCandidates(conflicts),
    resolvedAt: new Date().toISOString(),
  }
  return deepFreeze(result)
}
