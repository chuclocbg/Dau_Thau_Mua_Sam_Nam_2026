import { describe, it, expect } from 'vitest'
import { composeAnswer } from '../reasoning/application/reasoningAnswerStage.ts'
import type { ReasoningExecutionContext } from '../reasoning/domain/reasoningExecutionContextTypes.ts'
import type { ConflictResolutionResult } from '../reasoning/domain/conflictResolutionTypes.ts'
import type { ConfidenceEvaluationResult } from '../reasoning/domain/confidenceEvaluationTypes.ts'
import type { CitationGenerationResult } from '../reasoning/domain/citationGenerationTypes.ts'
import type { DetectedConflict, FormattedCitation, IntentType, ReasoningIntent } from '../reasoning/domain/reasoningTypes.ts'

const ASOF = '2026-07-06'

function intent(): ReasoningIntent {
  return {
    intentType: 'GENERAL' as IntentType, question: 'q', normalizedQuestion: 'q', detectedEntities: [],
    context: { asOfDate: ASOF }, confidence: 0.8, ambiguous: false,
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

function conflictResolution(conflicts: readonly DetectedConflict[] = []): ConflictResolutionResult {
  return { conflicts, rejectedCandidates: [], resolvedAt: `${ASOF}T00:00:00.000Z` }
}

function confidenceEvaluation(finalScore = 1): ConfidenceEvaluationResult {
  return {
    confidence: { baseScore: 1, deductions: [], finalScore, label: finalScore >= 0.85 ? 'HIGH' : 'LOW' },
    supportingEvidence: [], rejectedEvidence: [], supportingWeight: 0, rejectedWeight: 0,
    evaluatedAt: `${ASOF}T00:00:00.000Z`,
  }
}

function citation(overrides: Partial<FormattedCitation> = {}): FormattedCitation {
  return {
    citationId: 'citation-1', itemId: 'item-1', documentSymbol: 'X/2025',
    full: 'Luật X/2025', short: 'X/2025', inline: '(Luật X/2025)',
    role: 'SUPPORTING_BASIS', isNormative: true, isPrimary: false,
    ...overrides,
  }
}

function citationGeneration(citations: readonly FormattedCitation[]): CitationGenerationResult {
  return { citations, duplicatesRemoved: [], generatedAt: `${ASOF}T00:00:00.000Z` }
}

describe('composeAnswer — structured sections (grouping, not reformatting)', () => {
  it('groups a primary citation into primaryCitations', () => {
    const result = composeAnswer(
      context(), conflictResolution(), confidenceEvaluation(),
      citationGeneration([citation({ itemId: 'primary-1', isPrimary: true, role: 'PRIMARY_BASIS' })]),
    )
    expect(result.primaryCitations.map(c => c.itemId)).toEqual(['primary-1'])
    expect(result.supportingCitations).toEqual([])
    expect(result.disputedCitations).toEqual([])
  })

  it('groups a CONFLICT_SOURCE citation into disputedCitations, never primaryCitations', () => {
    const result = composeAnswer(
      context(), conflictResolution(), confidenceEvaluation(),
      citationGeneration([citation({ itemId: 'disputed-1', isPrimary: false, role: 'CONFLICT_SOURCE' })]),
    )
    expect(result.disputedCitations.map(c => c.itemId)).toEqual(['disputed-1'])
    expect(result.primaryCitations).toEqual([])
    expect(result.supportingCitations).toEqual([])
  })

  it('groups a non-primary, non-conflict-source citation into supportingCitations', () => {
    const result = composeAnswer(
      context(), conflictResolution(), confidenceEvaluation(),
      citationGeneration([citation({ itemId: 'supporting-1', isPrimary: false, role: 'SUPPORTING_BASIS' })]),
    )
    expect(result.supportingCitations.map(c => c.itemId)).toEqual(['supporting-1'])
  })

  it('preserves the exact input order of CitationGenerationResult.citations within each section (never re-sorts)', () => {
    const citations = [
      citation({ itemId: 'c', role: 'SUPPORTING_BASIS' }),
      citation({ itemId: 'a', role: 'SUPPORTING_BASIS' }),
      citation({ itemId: 'b', role: 'SUPPORTING_BASIS' }),
    ]
    const result = composeAnswer(context(), conflictResolution(), confidenceEvaluation(), citationGeneration(citations))
    expect(result.supportingCitations.map(c => c.itemId)).toEqual(['c', 'a', 'b'])
  })
})

describe('composeAnswer — confidence summary and conflicts pass through unchanged', () => {
  it('confidenceSummary is exactly ConfidenceEvaluationResult.confidence, not recomputed', () => {
    const confidence = confidenceEvaluation(0.72)
    const result = composeAnswer(context(), conflictResolution(), confidence, citationGeneration([]))
    expect(result.confidenceSummary).toBe(confidence.confidence)
  })

  it('conflicts is exactly ConflictResolutionResult.conflicts, not re-resolved', () => {
    const conflicts: DetectedConflict[] = [{
      conflictId: 'c1', description: 'd', isResolved: true, appliedItem: 'a', supersededItem: 'b',
      conflictingItems: [
        { itemId: 'a', documentSymbol: 'X/2025', provision: 's', authorityLevel: 3, effectiveFrom: '2025-01-01', layer: 1 },
        { itemId: 'b', documentSymbol: 'X/2025', provision: 's', authorityLevel: 8, effectiveFrom: '2025-01-01', layer: 1 },
      ],
      resolution: 'RESOLVED_BY_HIERARCHY',
    }]
    const input = conflictResolution(conflicts)
    const result = composeAnswer(context(), input, confidenceEvaluation(), citationGeneration([]))
    expect(result.conflicts).toBe(input.conflicts)
  })
})

describe('composeAnswer — decision (reused composeDecision(), honest empty ruleResults)', () => {
  it('is always null in this milestone\'s scope, since composeDecision() always receives an empty ruleResults array', () => {
    const result = composeAnswer(
      context(), conflictResolution(), confidenceEvaluation(1),
      citationGeneration([citation({ itemId: 'primary-1', isPrimary: true, role: 'PRIMARY_BASIS' })]),
    )
    expect(result.decision).toBeNull()
  })

  it('is null even at maximum confidence with a primary citation present (documents the honest scope gap directly)', () => {
    const result = composeAnswer(
      context(), conflictResolution(), confidenceEvaluation(1),
      citationGeneration([citation({ isPrimary: true, role: 'PRIMARY_BASIS' })]),
    )
    expect(result.decision).toBeNull()
  })
})

describe('composeAnswer — immutability and determinism', () => {
  it('deep-freezes the result', () => {
    const result = composeAnswer(context(), conflictResolution(), confidenceEvaluation(), citationGeneration([]))
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(result.primaryCitations)).toBe(true)
    expect(() => { (result as { composedAt: string }).composedAt = 'x' }).toThrow()
  })

  it('never mutates its inputs', () => {
    const ctx = context()
    const conflicts = conflictResolution()
    const confidence = confidenceEvaluation()
    const citations = citationGeneration([citation({ itemId: 'a' })])

    composeAnswer(ctx, conflicts, confidence, citations)

    expect(citations.citations[0]!.itemId).toBe('a')
  })

  it('is a pure function: identical input produces identical output (aside from composedAt)', () => {
    const ctx = context()
    const conflicts = conflictResolution()
    const confidence = confidenceEvaluation()
    const citations = citationGeneration([citation({ itemId: 'a', isPrimary: true, role: 'PRIMARY_BASIS' })])

    const first = composeAnswer(ctx, conflicts, confidence, citations)
    const second = composeAnswer(ctx, conflicts, confidence, citations)

    expect(first.primaryCitations).toEqual(second.primaryCitations)
    expect(first.decision).toEqual(second.decision)
  })

  it('produces an empty, valid, frozen result for empty inputs, never throwing', () => {
    const result = composeAnswer(context(), conflictResolution(), confidenceEvaluation(), citationGeneration([]))
    expect(result.primaryCitations).toEqual([])
    expect(result.supportingCitations).toEqual([])
    expect(result.disputedCitations).toEqual([])
    expect(result.conflicts).toEqual([])
  })
})
