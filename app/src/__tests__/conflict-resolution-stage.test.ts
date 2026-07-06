import { describe, it, expect } from 'vitest'
import { resolveConflicts } from '../reasoning/application/conflictResolutionStage.ts'
import { legalHierarchyScore } from '../reasoning/application/rankingStrategy.ts'
import type { ReasoningExecutionContext } from '../reasoning/domain/reasoningExecutionContextTypes.ts'
import type { RuleEvaluationResult, KnowledgeItemEvaluation } from '../reasoning/domain/ruleEvaluationTypes.ts'
import type { IntentType, KnowledgeItemRef, ReasoningIntent } from '../reasoning/domain/reasoningTypes.ts'

const ASOF = '2026-07-06'

function intent(): ReasoningIntent {
  return {
    intentType: 'GENERAL' as IntentType, question: 'q', normalizedQuestion: 'q', detectedEntities: [],
    context: { asOfDate: ASOF }, confidence: 0.8, ambiguous: false,
  }
}

function item(itemId: string, overrides: Partial<KnowledgeItemRef> = {}): KnowledgeItemRef {
  return {
    itemId, domain: 'legal', type: 'LAW', title: itemId, summary: 's', confidence: 0.9,
    layer: 1, legalBasis: [{ documentSymbol: 'X/2025' }], metadata: {}, effectiveFrom: '2025-01-01',
    ...overrides,
  }
}

function context(overrides: Partial<ReasoningExecutionContext> = {}): ReasoningExecutionContext {
  return {
    intent: intent(), asOfDate: ASOF, legalItems: [], procurementItems: [], schoolPolicyItems: [],
    ruleItems: [], thresholdItems: [], resolvedAt: `${ASOF}T00:00:00.000Z`, platformCallCount: 0,
    warnings: [], assembledAt: `${ASOF}T00:00:00.000Z`,
    ...overrides,
  }
}

function evaluationFor(item: KnowledgeItemRef, applicability: KnowledgeItemEvaluation['applicability'] = 'APPLICABLE'): KnowledgeItemEvaluation {
  return { itemId: item.itemId, temporalValidity: 'CURRENT', applicability, hierarchyScore: legalHierarchyScore(item) }
}

function ruleEvaluation(itemEvaluations: readonly KnowledgeItemEvaluation[]): RuleEvaluationResult {
  return { asOfDate: ASOF, itemEvaluations, ruleResults: [], thresholdResults: [], evaluatedAt: `${ASOF}T00:00:00.000Z` }
}

describe('resolveConflicts — grouping and eligibility', () => {
  it('never compares two items from different conflictDimension groups', () => {
    const a = item('a', { metadata: { conflictDimension: 'D1', conflictValue: '10' } })
    const b = item('b', { metadata: { conflictDimension: 'D2', conflictValue: '10' } })
    const ctx = context({ legalItems: [a, b] })

    const result = resolveConflicts(ctx, ruleEvaluation([evaluationFor(a), evaluationFor(b)]))

    expect(result.conflicts).toEqual([])
  })

  it('skips items with no conflictDimension metadata entirely', () => {
    const a = item('a', { metadata: {} })
    const b = item('b', { metadata: {} })
    const ctx = context({ legalItems: [a, b] })

    const result = resolveConflicts(ctx, ruleEvaluation([evaluationFor(a), evaluationFor(b)]))

    expect(result.conflicts).toEqual([])
  })

  it('never compares two items with the same conflictValue (not a real conflict)', () => {
    const a = item('a', { metadata: { conflictDimension: 'D1', conflictValue: '10' } })
    const b = item('b', { metadata: { conflictDimension: 'D1', conflictValue: '10' } })
    const ctx = context({ legalItems: [a, b] })

    const result = resolveConflicts(ctx, ruleEvaluation([evaluationFor(a), evaluationFor(b)]))

    expect(result.conflicts).toEqual([])
  })

  it('excludes an item not marked APPLICABLE by X.4.3\'s own evaluation, reusing its applicability determination rather than re-deriving it', () => {
    const a = item('a', { metadata: { conflictDimension: 'D1', conflictValue: '10' } })
    const b = item('b', { metadata: { conflictDimension: 'D1', conflictValue: '20' } })
    const ctx = context({ legalItems: [a, b] })

    const result = resolveConflicts(ctx, ruleEvaluation([evaluationFor(a, 'NOT_YET_EFFECTIVE'), evaluationFor(b)]))

    expect(result.conflicts).toEqual([])
  })

  it('only considers legalItems and schoolPolicyItems — procurementItems never enter conflict detection (mirrors legalReasoningEngine.ts\'s own candidate set)', () => {
    const a = item('a', { domain: 'procurement', metadata: { conflictDimension: 'D1', conflictValue: '10' } })
    const b = item('b', { domain: 'procurement', metadata: { conflictDimension: 'D1', conflictValue: '20' } })
    const ctx = context({ procurementItems: [a, b] })

    const result = resolveConflicts(ctx, ruleEvaluation([evaluationFor(a), evaluationFor(b)]))

    expect(result.conflicts).toEqual([])
  })
})

describe('resolveConflicts — rejected candidates', () => {
  it('records the superseded item with a rejection reason', () => {
    const winner = item('winner', { type: 'LAW', metadata: { conflictDimension: 'D1', conflictValue: '10' } })
    const loser = item('loser', { type: 'CIRCULAR', metadata: { conflictDimension: 'D1', conflictValue: '20' } })
    const ctx = context({ legalItems: [winner, loser] })

    const result = resolveConflicts(ctx, ruleEvaluation([evaluationFor(winner), evaluationFor(loser)]))

    expect(result.rejectedCandidates).toEqual([{ itemId: 'loser', reason: expect.stringContaining('winner') }])
  })

  it('deduplicates a rejected candidate that loses in more than one pairwise comparison', () => {
    const strongest = item('strongest', { type: 'LAW', metadata: { conflictDimension: 'D1', conflictValue: '10' } })
    const weak1 = item('weak-1', { type: 'CIRCULAR', metadata: { conflictDimension: 'D1', conflictValue: '20' } })
    const weak2 = item('weak-2', { type: 'OFFICIAL_LETTER', metadata: { conflictDimension: 'D1', conflictValue: '30' } })
    const ctx = context({ legalItems: [strongest, weak1, weak2] })

    const result = resolveConflicts(ctx, ruleEvaluation([evaluationFor(strongest), evaluationFor(weak1), evaluationFor(weak2)]))

    const rejectedIds = result.rejectedCandidates.map(r => r.itemId)
    expect(new Set(rejectedIds).size).toBe(rejectedIds.length)
  })

  it('records no rejected candidate for an UNRESOLVED conflict', () => {
    const a = item('a', { type: 'OFFICIAL_LETTER', effectiveFrom: '2025-01-01', metadata: { conflictDimension: 'D1', conflictValue: '10' } })
    const b = item('b', { type: 'OFFICIAL_LETTER', effectiveFrom: '2025-01-01', metadata: { conflictDimension: 'D1', conflictValue: '20' } })
    const ctx = context({ legalItems: [a, b] })

    const result = resolveConflicts(ctx, ruleEvaluation([evaluationFor(a), evaluationFor(b)]))

    expect(result.conflicts[0]!.resolution).toBe('UNRESOLVED')
    expect(result.rejectedCandidates).toEqual([])
  })
})

describe('resolveConflicts — authorityLevel round-trip (ConflictingItem.authorityLevel derived from hierarchyScore)', () => {
  it('recovers the same authorityLevel ordering for a LAW vs. an INTERNAL_REGULATION as the frozen cascade\'s own table', () => {
    const law = item('law-1', { type: 'LAW', metadata: { conflictDimension: 'D1', conflictValue: '10' } })
    const reg = item('reg-1', { type: 'INTERNAL_REGULATION', metadata: { conflictDimension: 'D1', conflictValue: '20' } })
    const ctx = context({ legalItems: [law, reg] })

    const result = resolveConflicts(ctx, ruleEvaluation([evaluationFor(law), evaluationFor(reg)]))

    const [first, second] = result.conflicts[0]!.conflictingItems
    const lawEntry = [first, second].find(c => c.itemId === 'law-1')!
    const regEntry = [first, second].find(c => c.itemId === 'reg-1')!
    // Lower authorityLevel = stronger authority, matching legalReasoningEngine.ts's own
    // AUTHORITY_LEVEL_BY_TYPE table (LAW: 3, INTERNAL_REGULATION: 14).
    expect(lawEntry.authorityLevel).toBeLessThan(regEntry.authorityLevel)
    expect(lawEntry.authorityLevel).toBe(3)
    expect(regEntry.authorityLevel).toBe(14)
  })
})

describe('resolveConflicts — immutability and determinism', () => {
  it('deep-freezes the result', () => {
    const a = item('a', { metadata: { conflictDimension: 'D1', conflictValue: '10' } })
    const b = item('b', { metadata: { conflictDimension: 'D1', conflictValue: '20' } })
    const ctx = context({ legalItems: [a, b] })

    const result = resolveConflicts(ctx, ruleEvaluation([evaluationFor(a), evaluationFor(b)]))

    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(result.conflicts)).toBe(true)
    expect(() => { (result as { resolvedAt: string }).resolvedAt = 'x' }).toThrow()
  })

  it('never mutates the input context or ruleEvaluation', () => {
    const a = item('a', { metadata: { conflictDimension: 'D1', conflictValue: '10' } })
    const ctx = context({ legalItems: [a] })
    const evaluation = ruleEvaluation([evaluationFor(a)])

    resolveConflicts(ctx, evaluation)

    expect(ctx.legalItems[0]!.itemId).toBe('a')
    expect(evaluation.itemEvaluations[0]!.itemId).toBe('a')
  })

  it('is a pure function: identical input produces identical output (aside from resolvedAt)', () => {
    const a = item('a', { type: 'LAW', metadata: { conflictDimension: 'D1', conflictValue: '10' } })
    const b = item('b', { type: 'CIRCULAR', metadata: { conflictDimension: 'D1', conflictValue: '20' } })
    const ctx = context({ legalItems: [a, b] })
    const evaluation = ruleEvaluation([evaluationFor(a), evaluationFor(b)])

    const first = resolveConflicts(ctx, evaluation)
    const second = resolveConflicts(ctx, evaluation)

    expect(first.conflicts).toEqual(second.conflicts)
    expect(first.rejectedCandidates).toEqual(second.rejectedCandidates)
  })

  it('produces no conflicts and an empty result for an empty context, never throwing', () => {
    const result = resolveConflicts(context(), ruleEvaluation([]))
    expect(result.conflicts).toEqual([])
    expect(result.rejectedCandidates).toEqual([])
  })
})
