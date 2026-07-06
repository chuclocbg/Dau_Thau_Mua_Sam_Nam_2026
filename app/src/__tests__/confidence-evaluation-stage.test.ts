import { describe, it, expect } from 'vitest'
import { evaluateConfidence } from '../reasoning/application/confidenceEvaluationStage.ts'
import { legalHierarchyScore } from '../reasoning/application/rankingStrategy.ts'
import type { ReasoningExecutionContext } from '../reasoning/domain/reasoningExecutionContextTypes.ts'
import type { KnowledgeItemEvaluation, RuleEvaluationResult } from '../reasoning/domain/ruleEvaluationTypes.ts'
import type { ConflictResolutionResult } from '../reasoning/domain/conflictResolutionTypes.ts'
import type { DetectedConflict, IntentType, KnowledgeItemRef, ReasoningIntent } from '../reasoning/domain/reasoningTypes.ts'

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

function evaluationFor(item: KnowledgeItemRef, temporalValidity: KnowledgeItemEvaluation['temporalValidity'] = 'CURRENT'): KnowledgeItemEvaluation {
  return {
    itemId: item.itemId, temporalValidity,
    applicability: temporalValidity === 'CURRENT' ? 'APPLICABLE' : temporalValidity,
    hierarchyScore: legalHierarchyScore(item),
  }
}

function ruleEvaluation(itemEvaluations: readonly KnowledgeItemEvaluation[]): RuleEvaluationResult {
  return { asOfDate: ASOF, itemEvaluations, ruleResults: [], thresholdResults: [], evaluatedAt: `${ASOF}T00:00:00.000Z` }
}

function conflictResolution(conflicts: readonly DetectedConflict[] = []): ConflictResolutionResult {
  return { conflicts, rejectedCandidates: [], resolvedAt: `${ASOF}T00:00:00.000Z` }
}

describe('evaluateConfidence — reuses computeConfidence() (Batch A)', () => {
  it('produces a HIGH confidence label for a single, uncontested, current item', () => {
    const solo = item('solo-1')
    const ctx = context({ legalItems: [solo] })

    const result = evaluateConfidence(ctx, ruleEvaluation([evaluationFor(solo)]), conflictResolution())

    // PARTIAL_CONTEXT deducts 0.15 here since the test intent's context omits packageType/
    // fundSource/procurementMethod - reused computeConfidence()'s own, unmodified deduction rule.
    expect(result.confidence.finalScore).toBeCloseTo(0.85, 5)
    expect(result.confidence.label).toBe('HIGH')
  })

  it('deducts confidence for an unresolved conflict', () => {
    const a = item('a', { metadata: { conflictDimension: 'D1', conflictValue: '10' } })
    const b = item('b', { metadata: { conflictDimension: 'D1', conflictValue: '20' } })
    const ctx = context({ legalItems: [a, b] })
    const conflicts: DetectedConflict[] = [{
      conflictId: 'c1', description: 'd', isResolved: false,
      conflictingItems: [
        { itemId: 'a', documentSymbol: 'X/2025', provision: 's', authorityLevel: 3, effectiveFrom: '2025-01-01', layer: 1 },
        { itemId: 'b', documentSymbol: 'X/2025', provision: 's', authorityLevel: 3, effectiveFrom: '2025-01-01', layer: 1 },
      ],
      resolution: 'UNRESOLVED',
    }]

    const result = evaluateConfidence(ctx, ruleEvaluation([evaluationFor(a), evaluationFor(b)]), conflictResolution(conflicts))

    expect(result.confidence.finalScore).toBeLessThan(1)
    expect(result.confidence.deductions.some(d => d.reason === 'UNRESOLVED_CONFLICT')).toBe(true)
  })
})

describe('evaluateConfidence — evidence weight aggregation', () => {
  it('classifies a PRIMARY_BASIS item as supporting evidence, not rejected', () => {
    const law = item('law-a', { type: 'LAW', metadata: { conflictDimension: 'D1', conflictValue: '10' } })
    const circular = item('circular-b', { type: 'CIRCULAR', metadata: { conflictDimension: 'D1', conflictValue: '20' } })
    const ctx = context({ legalItems: [law, circular] })
    const conflicts: DetectedConflict[] = [{
      conflictId: 'c1', description: 'd', isResolved: true, appliedItem: 'law-a', supersededItem: 'circular-b',
      conflictingItems: [
        { itemId: 'law-a', documentSymbol: 'X/2025', provision: 's', authorityLevel: 3, effectiveFrom: '2025-01-01', layer: 1 },
        { itemId: 'circular-b', documentSymbol: 'X/2025', provision: 's', authorityLevel: 8, effectiveFrom: '2025-01-01', layer: 1 },
      ],
      resolution: 'RESOLVED_BY_HIERARCHY',
    }]

    const result = evaluateConfidence(ctx, ruleEvaluation([evaluationFor(law), evaluationFor(circular)]), conflictResolution(conflicts))

    expect(result.supportingEvidence.map(e => e.itemId)).toEqual(['law-a'])
    expect(result.rejectedEvidence.map(e => e.itemId)).toEqual(['circular-b'])
    expect(result.supportingWeight).toBeCloseTo(0.9, 5)
    expect(result.rejectedWeight).toBeCloseTo(0.9, 5)
  })

  it('sums supportingWeight/rejectedWeight from each bucket\'s own item confidences', () => {
    const a = item('a', { confidence: 0.8 })
    const b = item('b', { confidence: 0.6 })
    const ctx = context({ legalItems: [a, b] })

    const result = evaluateConfidence(ctx, ruleEvaluation([evaluationFor(a), evaluationFor(b)]), conflictResolution())

    expect(result.supportingWeight).toBeCloseTo(1.4, 5)
    expect(result.rejectedWeight).toBe(0)
  })

  it('excludes a not-yet-effective item from both supporting and rejected evidence entirely', () => {
    const future = item('future-1', { effectiveFrom: '2099-01-01' })
    const ctx = context({ legalItems: [future] })

    const result = evaluateConfidence(ctx, ruleEvaluation([evaluationFor(future, 'NOT_YET_EFFECTIVE')]), conflictResolution())

    expect(result.supportingEvidence).toEqual([])
    expect(result.rejectedEvidence).toEqual([])
  })
})

describe('evaluateConfidence — never resolves new conflicts, never modifies conflict results', () => {
  it('passes conflictResolution.conflicts through to computeConfidence() unchanged', () => {
    const a = item('a', { metadata: { conflictDimension: 'D1', conflictValue: '10' } })
    const b = item('b', { metadata: { conflictDimension: 'D1', conflictValue: '20' } })
    const ctx = context({ legalItems: [a, b] })
    const conflicts: DetectedConflict[] = [{
      conflictId: 'c1', description: 'd', isResolved: true, appliedItem: 'a', supersededItem: 'b',
      conflictingItems: [
        { itemId: 'a', documentSymbol: 'X/2025', provision: 's', authorityLevel: 3, effectiveFrom: '2025-01-01', layer: 1 },
        { itemId: 'b', documentSymbol: 'X/2025', provision: 's', authorityLevel: 8, effectiveFrom: '2025-01-01', layer: 1 },
      ],
      resolution: 'RESOLVED_BY_HIERARCHY',
    }]
    const input = conflictResolution(conflicts)

    evaluateConfidence(ctx, ruleEvaluation([evaluationFor(a), evaluationFor(b)]), input)

    expect(input.conflicts).toBe(conflicts)
    expect(input.conflicts[0]).toEqual(conflicts[0])
  })
})

describe('evaluateConfidence — immutability and determinism', () => {
  it('deep-freezes the result', () => {
    const solo = item('solo-1')
    const result = evaluateConfidence(context({ legalItems: [solo] }), ruleEvaluation([evaluationFor(solo)]), conflictResolution())

    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(result.confidence)).toBe(true)
    expect(Object.isFrozen(result.supportingEvidence)).toBe(true)
    expect(() => { (result as { evaluatedAt: string }).evaluatedAt = 'x' }).toThrow()
  })

  it('never mutates its inputs', () => {
    const solo = item('solo-1')
    const ctx = context({ legalItems: [solo] })
    const evaluation = ruleEvaluation([evaluationFor(solo)])
    const conflicts = conflictResolution()

    evaluateConfidence(ctx, evaluation, conflicts)

    expect(ctx.legalItems[0]!.itemId).toBe('solo-1')
    expect(evaluation.itemEvaluations[0]!.itemId).toBe('solo-1')
  })

  it('is a pure function: identical input produces identical output (aside from evaluatedAt)', () => {
    const a = item('a', { type: 'LAW' })
    const b = item('b', { type: 'CIRCULAR', effectiveFrom: '2099-01-01' })
    const ctx = context({ legalItems: [a, b] })
    const evaluation = ruleEvaluation([evaluationFor(a), evaluationFor(b, 'NOT_YET_EFFECTIVE')])
    const conflicts = conflictResolution()

    const first = evaluateConfidence(ctx, evaluation, conflicts)
    const second = evaluateConfidence(ctx, evaluation, conflicts)

    expect(first.confidence).toEqual(second.confidence)
    expect(first.supportingEvidence).toEqual(second.supportingEvidence)
    expect(first.rejectedEvidence).toEqual(second.rejectedEvidence)
  })

  it('produces a valid, high-confidence, empty-evidence result for an empty context, never throwing', () => {
    const result = evaluateConfidence(context(), ruleEvaluation([]), conflictResolution())
    expect(result.supportingEvidence).toEqual([])
    expect(result.rejectedEvidence).toEqual([])
    expect(result.confidence.finalScore).toBeCloseTo(0.85, 5)
    expect(result.confidence.label).toBe('HIGH')
  })
})
