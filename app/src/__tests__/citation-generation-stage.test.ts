import { describe, it, expect } from 'vitest'
import { generateCitations } from '../reasoning/application/citationGenerationStage.ts'
import type { ReasoningExecutionContext } from '../reasoning/domain/reasoningExecutionContextTypes.ts'
import type { ConflictResolutionResult } from '../reasoning/domain/conflictResolutionTypes.ts'
import type { EvidenceWeightSummary, ConfidenceEvaluationResult } from '../reasoning/domain/confidenceEvaluationTypes.ts'
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
    layer: 1, legalBasis: [{ documentSymbol: 'X/2025', article: 'Điều 1' }], metadata: {}, effectiveFrom: '2025-01-01',
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

function conflictResolution(conflicts: readonly DetectedConflict[] = []): ConflictResolutionResult {
  return { conflicts, rejectedCandidates: [], resolvedAt: `${ASOF}T00:00:00.000Z` }
}

function confidenceEvaluation(
  supportingEvidence: readonly EvidenceWeightSummary[], rejectedEvidence: readonly EvidenceWeightSummary[] = [],
): ConfidenceEvaluationResult {
  return {
    confidence: { baseScore: 1, deductions: [], finalScore: 1, label: 'HIGH' },
    supportingEvidence, rejectedEvidence,
    supportingWeight: supportingEvidence.reduce((sum, e) => sum + e.confidence, 0),
    rejectedWeight: rejectedEvidence.reduce((sum, e) => sum + e.confidence, 0),
    evaluatedAt: `${ASOF}T00:00:00.000Z`,
  }
}

describe('generateCitations — reuses formatCitations() (Batch A)', () => {
  it('cites a single accepted, supporting item', () => {
    const solo = item('solo-1')
    const ctx = context({ legalItems: [solo] })

    const result = generateCitations(ctx, conflictResolution(), confidenceEvaluation([{ itemId: 'solo-1', confidence: 0.9 }]))

    expect(result.citations).toHaveLength(1)
    expect(result.citations[0]!.itemId).toBe('solo-1')
    expect(result.citations[0]!.documentSymbol).toBe('X/2025')
  })

  it('marks the conflict-winner (appliedItem) as isPrimary; the loser as CONFLICT_SOURCE, not primary', () => {
    const law = item('law-a', { type: 'LAW', legalBasis: [{ documentSymbol: 'Luat/2023' }] })
    const circular = item('circular-b', { type: 'CIRCULAR', legalBasis: [{ documentSymbol: 'TT/2024' }] })
    const ctx = context({ legalItems: [law, circular] })
    const conflicts: DetectedConflict[] = [{
      conflictId: 'c1', description: 'd', isResolved: true, appliedItem: 'law-a', supersededItem: 'circular-b',
      conflictingItems: [
        { itemId: 'law-a', documentSymbol: 'Luat/2023', provision: 's', authorityLevel: 3, effectiveFrom: '2025-01-01', layer: 1 },
        { itemId: 'circular-b', documentSymbol: 'TT/2024', provision: 's', authorityLevel: 8, effectiveFrom: '2025-01-01', layer: 1 },
      ],
      resolution: 'RESOLVED_BY_HIERARCHY',
    }]

    const result = generateCitations(
      ctx, conflictResolution(conflicts),
      confidenceEvaluation([{ itemId: 'law-a', confidence: 0.9 }], [{ itemId: 'circular-b', confidence: 0.9 }]),
    )

    const lawCitation = result.citations.find(c => c.itemId === 'law-a')!
    const circularCitation = result.citations.find(c => c.itemId === 'circular-b')!
    expect(lawCitation.isPrimary).toBe(true)
    expect(circularCitation.isPrimary).toBe(false)
    expect(circularCitation.role).toBe('CONFLICT_SOURCE')
    expect(circularCitation.isNormative).toBe(true)
  })

  it('excludes an item that is neither in supportingEvidence nor rejectedEvidence (not accepted)', () => {
    const excluded = item('excluded-1')
    const ctx = context({ legalItems: [excluded] })

    const result = generateCitations(ctx, conflictResolution(), confidenceEvaluation([]))

    expect(result.citations).toEqual([])
  })
})

describe('generateCitations — ordering preserved', () => {
  it('preserves the exact input order of ReasoningExecutionContext (never re-sorts)', () => {
    const a = item('a', { legalBasis: [{ documentSymbol: 'C/2025' }] })
    const b = item('b', { legalBasis: [{ documentSymbol: 'A/2025' }] })
    const c = item('c', { legalBasis: [{ documentSymbol: 'B/2025' }] })
    const ctx = context({ legalItems: [c, a, b] })
    const evidence: EvidenceWeightSummary[] = [
      { itemId: 'a', confidence: 0.9 }, { itemId: 'b', confidence: 0.9 }, { itemId: 'c', confidence: 0.9 },
    ]

    const result = generateCitations(ctx, conflictResolution(), confidenceEvaluation(evidence))

    expect(result.citations.map(cit => cit.itemId)).toEqual(['c', 'a', 'b'])
  })
})

describe('generateCitations — duplicate elimination', () => {
  it('removes a second item citing the exact same documentSymbol/article/clause/point, keeping the first', () => {
    const first = item('first-1', { legalBasis: [{ documentSymbol: 'Dup/2025', article: 'Đ1' }] })
    const duplicate = item('duplicate-1', { legalBasis: [{ documentSymbol: 'Dup/2025', article: 'Đ1' }] })
    const ctx = context({ legalItems: [first, duplicate] })
    const evidence: EvidenceWeightSummary[] = [{ itemId: 'first-1', confidence: 0.9 }, { itemId: 'duplicate-1', confidence: 0.9 }]

    const result = generateCitations(ctx, conflictResolution(), confidenceEvaluation(evidence))

    expect(result.citations).toHaveLength(1)
    expect(result.citations[0]!.itemId).toBe('first-1')
    expect(result.duplicatesRemoved).toEqual(['duplicate-1'])
  })

  it('does not treat two items with different articles under the same document as duplicates', () => {
    const a = item('a', { legalBasis: [{ documentSymbol: 'Same/2025', article: 'Đ1' }] })
    const b = item('b', { legalBasis: [{ documentSymbol: 'Same/2025', article: 'Đ2' }] })
    const ctx = context({ legalItems: [a, b] })
    const evidence: EvidenceWeightSummary[] = [{ itemId: 'a', confidence: 0.9 }, { itemId: 'b', confidence: 0.9 }]

    const result = generateCitations(ctx, conflictResolution(), confidenceEvaluation(evidence))

    expect(result.citations).toHaveLength(2)
    expect(result.duplicatesRemoved).toEqual([])
  })
})

describe('generateCitations — traceability', () => {
  it('every citation carries its originating itemId (traceability to the original knowledge item)', () => {
    const a = item('a')
    const ctx = context({ legalItems: [a] })

    const result = generateCitations(ctx, conflictResolution(), confidenceEvaluation([{ itemId: 'a', confidence: 0.9 }]))

    expect(result.citations[0]!.itemId).toBe('a')
  })
})

describe('generateCitations — immutability and determinism', () => {
  it('deep-freezes the result', () => {
    const solo = item('solo-1')
    const ctx = context({ legalItems: [solo] })
    const result = generateCitations(ctx, conflictResolution(), confidenceEvaluation([{ itemId: 'solo-1', confidence: 0.9 }]))

    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(result.citations)).toBe(true)
    expect(() => { (result as { generatedAt: string }).generatedAt = 'x' }).toThrow()
  })

  it('never mutates its inputs', () => {
    const solo = item('solo-1')
    const ctx = context({ legalItems: [solo] })
    const conflicts = conflictResolution()
    const confidence = confidenceEvaluation([{ itemId: 'solo-1', confidence: 0.9 }])

    generateCitations(ctx, conflicts, confidence)

    expect(ctx.legalItems[0]!.itemId).toBe('solo-1')
    expect(confidence.supportingEvidence[0]!.itemId).toBe('solo-1')
  })

  it('is a pure function: identical input produces identical output (aside from generatedAt)', () => {
    const a = item('a')
    const ctx = context({ legalItems: [a] })
    const conflicts = conflictResolution()
    const confidence = confidenceEvaluation([{ itemId: 'a', confidence: 0.9 }])

    const first = generateCitations(ctx, conflicts, confidence)
    const second = generateCitations(ctx, conflicts, confidence)

    expect(first.citations).toEqual(second.citations)
    expect(first.duplicatesRemoved).toEqual(second.duplicatesRemoved)
  })

  it('produces an empty, valid result for an empty context, never throwing', () => {
    const result = generateCitations(context(), conflictResolution(), confidenceEvaluation([]))
    expect(result.citations).toEqual([])
    expect(result.duplicatesRemoved).toEqual([])
  })
})
