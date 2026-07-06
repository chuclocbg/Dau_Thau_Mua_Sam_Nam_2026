import { describe, it, expect } from 'vitest'
import { evaluateConfidence } from '../reasoning/application/confidenceEvaluationStage.ts'
import { resolveConflicts } from '../reasoning/application/conflictResolutionStage.ts'
import { assembleReasoningContext } from '../reasoning/application/reasoningContextAssembler.ts'
import { evaluateRules } from '../reasoning/application/ruleEvaluationStage.ts'
import { buildLegalReasoningEngine } from '../reasoning/application/legalReasoningEngine.ts'
import { detectIntent } from '../reasoning/application/intentDetector.ts'
import type { KnowledgeItemRef, ResolvedKnowledge } from '../reasoning/domain/reasoningTypes.ts'

// Parity tests — the load-bearing safety net for this milestone's "reuse every existing public
// scorer, do not duplicate scoring logic" instruction. computeConfidence() (Batch A, frozen) IS
// reused directly here; what's independently derived is the appliedDocuments/
// primaryItemConfidences input shape (role assignment), since legalReasoningEngine.ts's own
// role-assignment bookkeeping is private. These tests feed IDENTICAL item scenarios through both
// the real, frozen LegalReasoningEngine.reason() and this milestone's evaluateConfidence(),
// asserting the same confidence.finalScore/label — proving the independently-derived inputs
// produce the same result once run through the one, reused scoring function.

const ASOF = '2026-07-06'

function legalItem(overrides: Partial<KnowledgeItemRef>): KnowledgeItemRef {
  return {
    itemId: 'item', domain: 'legal', type: 'LAW', title: 't', summary: 's',
    confidence: 0.9, layer: 1, legalBasis: [{ documentSymbol: 'X/2025' }], metadata: {},
    effectiveFrom: '2025-01-01',
    ...overrides,
  }
}

function minimalResolvedKnowledge(legalItems: readonly KnowledgeItemRef[]): ResolvedKnowledge {
  return {
    legalItems, procurementItems: [], thresholdItems: [], ruleItems: [], schoolPolicyItems: [],
    asOfDate: ASOF, resolvedAt: `${ASOF}T00:00:00.000Z`, platformCallCount: 0, warnings: [],
  }
}

function withSchoolItems(resolved: ResolvedKnowledge, items: readonly KnowledgeItemRef[]): ResolvedKnowledge {
  return { ...resolved, schoolPolicyItems: items }
}

async function evaluateViaBothPaths(resolvedKnowledge: ResolvedKnowledge) {
  const intent = detectIntent({ question: 'test', asOfDate: ASOF })

  const engine = buildLegalReasoningEngine()
  const realResult = await engine.reason(intent, resolvedKnowledge)

  const context = assembleReasoningContext(intent, resolvedKnowledge)
  const ruleEvaluation = evaluateRules(context)
  const conflictResolution = resolveConflicts(context, ruleEvaluation)
  const newResult = evaluateConfidence(context, ruleEvaluation, conflictResolution)

  return { realResult, newResult }
}

describe('Confidence evaluation parity — Tier 1 (hierarchy): a resolved conflict deducts confidence', () => {
  it('produces the identical finalScore/label as the real, frozen LegalReasoningEngine', async () => {
    const law = legalItem({ itemId: 'law-a', type: 'LAW', metadata: { conflictDimension: 'D1', conflictValue: '10' } })
    const circular = legalItem({ itemId: 'circular-b', type: 'CIRCULAR', metadata: { conflictDimension: 'D1', conflictValue: '20' } })
    const resolved = minimalResolvedKnowledge([law, circular])

    const { realResult, newResult } = await evaluateViaBothPaths(resolved)

    expect(newResult.confidence.finalScore).toBeCloseTo(realResult.confidence, 10)
    expect(newResult.confidence.label).toBe(realResult.confidenceLabel)
  })
})

describe('Confidence evaluation parity — UNRESOLVED conflict deducts confidence more heavily', () => {
  it('produces the identical finalScore/label as the real, frozen LegalReasoningEngine', async () => {
    const a = legalItem({ itemId: 'letter-a', type: 'OFFICIAL_LETTER', effectiveFrom: '2025-01-01', metadata: { conflictDimension: 'D3', conflictValue: '10' } })
    const b = legalItem({ itemId: 'letter-b', type: 'OFFICIAL_LETTER', effectiveFrom: '2025-01-01', metadata: { conflictDimension: 'D3', conflictValue: '20' } })
    const resolved = minimalResolvedKnowledge([a, b])

    const { realResult, newResult } = await evaluateViaBothPaths(resolved)

    expect(newResult.confidence.finalScore).toBeCloseTo(realResult.confidence, 10)
    expect(newResult.confidence.label).toBe(realResult.confidenceLabel)
  })
})

describe('Confidence evaluation parity — no conflicts at all (baseline, single item)', () => {
  it('produces the identical finalScore/label as the real, frozen LegalReasoningEngine', async () => {
    const solo = legalItem({ itemId: 'solo-1', type: 'LAW' })
    const resolved = minimalResolvedKnowledge([solo])

    const { realResult, newResult } = await evaluateViaBothPaths(resolved)

    expect(newResult.confidence.finalScore).toBeCloseTo(realResult.confidence, 10)
    expect(newResult.confidence.label).toBe(realResult.confidenceLabel)
  })
})

describe('Confidence evaluation parity — an expired (superseded) item deducts confidence', () => {
  it('produces the identical finalScore/label as the real, frozen LegalReasoningEngine', async () => {
    const expired = legalItem({ itemId: 'expired-1', effectiveFrom: '2020-01-01', effectiveTo: '2024-12-31' })
    const resolved = minimalResolvedKnowledge([expired])

    const { realResult, newResult } = await evaluateViaBothPaths(resolved)

    expect(newResult.confidence.finalScore).toBeCloseTo(realResult.confidence, 10)
    expect(newResult.confidence.label).toBe(realResult.confidenceLabel)
  })
})

describe('Confidence evaluation parity — Tier 2 (more restrictive): school policy wins, no CONFLICT_SOURCE demotion', () => {
  it('produces the identical finalScore/label as the real, frozen LegalReasoningEngine', async () => {
    const law = legalItem({ itemId: 'law-c', type: 'LAW', metadata: { conflictDimension: 'D4', conflictValue: '30' } })
    const schoolPolicy = legalItem({
      itemId: 'school-c', type: 'INTERNAL_REGULATION', layer: 3, domain: 'school',
      metadata: { conflictDimension: 'D4', conflictValue: '20' },
    })
    const resolved = withSchoolItems(minimalResolvedKnowledge([law]), [schoolPolicy])

    const { realResult, newResult } = await evaluateViaBothPaths(resolved)

    expect(newResult.confidence.finalScore).toBeCloseTo(realResult.confidence, 10)
    expect(newResult.confidence.label).toBe(realResult.confidenceLabel)
  })
})
