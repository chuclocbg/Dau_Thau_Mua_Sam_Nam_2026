import { describe, it, expect } from 'vitest'
import { composeAnswer } from '../reasoning/application/reasoningAnswerStage.ts'
import { generateCitations } from '../reasoning/application/citationGenerationStage.ts'
import { resolveConflicts } from '../reasoning/application/conflictResolutionStage.ts'
import { evaluateConfidence } from '../reasoning/application/confidenceEvaluationStage.ts'
import { assembleReasoningContext } from '../reasoning/application/reasoningContextAssembler.ts'
import { evaluateRules } from '../reasoning/application/ruleEvaluationStage.ts'
import { buildLegalReasoningEngine } from '../reasoning/application/legalReasoningEngine.ts'
import { detectIntent } from '../reasoning/application/intentDetector.ts'
import type {
  EvaluationRuleMetadata, KnowledgeItemRef, ResolvedKnowledge, RuleKnowledgeItemRef,
} from '../reasoning/domain/reasoningTypes.ts'

// Parity tests — the load-bearing safety net for this milestone's "reuse existing public
// answer-composition helpers, never duplicate explanation or formatting logic" instruction.
// composeDecision() (Batch A, frozen) IS reused directly here. These tests feed identical item
// scenarios through both the real, frozen LegalReasoningEngine.reason() and this milestone's
// composeAnswer(), asserting equivalence where the inputs genuinely allow it, and explicitly
// locking in the one documented, intentional divergence (no ruleResults available) rather than
// asserting a false equivalence.

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

async function composeViaBothPaths(resolvedKnowledge: ResolvedKnowledge) {
  const intent = detectIntent({ question: 'test', asOfDate: ASOF })

  const engine = buildLegalReasoningEngine()
  const realResult = await engine.reason(intent, resolvedKnowledge)

  const context = assembleReasoningContext(intent, resolvedKnowledge)
  const ruleEvaluation = evaluateRules(context)
  const conflictResolution = resolveConflicts(context, ruleEvaluation)
  const confidenceEvaluation = evaluateConfidence(context, ruleEvaluation, conflictResolution)
  const citationGeneration = generateCitations(context, conflictResolution, confidenceEvaluation)
  const newResult = composeAnswer(context, conflictResolution, confidenceEvaluation, citationGeneration)

  return { realResult, newResult }
}

describe('Reasoning answer parity — no rule items: decision is null in both paths (genuine equivalence)', () => {
  it('produces the identical confidenceSummary/conflicts and a null decision, matching the real engine exactly', async () => {
    const law = legalItem({ itemId: 'law-a', type: 'LAW', metadata: { conflictDimension: 'D1', conflictValue: '10' } })
    const circular = legalItem({ itemId: 'circular-b', type: 'CIRCULAR', metadata: { conflictDimension: 'D1', conflictValue: '20' } })
    const resolved = minimalResolvedKnowledge([law, circular])

    const { realResult, newResult } = await composeViaBothPaths(resolved)

    // No ruleItems at all in this scenario, so the real engine's own ruleResults is also [] -
    // composeDecision()'s passages.length===0 short-circuit fires in both paths identically.
    expect(realResult.decision).toBeNull()
    expect(newResult.decision).toBeNull()
    expect(newResult.confidenceSummary.finalScore).toBeCloseTo(realResult.confidence, 10)
    expect(newResult.confidenceSummary.label).toBe(realResult.confidenceLabel)
    expect(newResult.conflicts).toEqual(realResult.conflicts)
  })
})

describe('Reasoning answer parity — citation grouping matches role assignment for a resolved conflict', () => {
  it('primaryCitations/disputedCitations exactly match the real engine\'s own isPrimary/CONFLICT_SOURCE assignment', async () => {
    // Distinct documentSymbols (unlike the first describe block above, which doesn't exercise
    // citation grouping at all) - otherwise both items collide under X.4.6's own, correct
    // duplicate-citation-elimination logic (same documentSymbol/article/clause/point = same
    // citation in substance), which would silently drop the second one here.
    const law = legalItem({ itemId: 'law-a', type: 'LAW', legalBasis: [{ documentSymbol: 'Luat/2023' }], metadata: { conflictDimension: 'D1', conflictValue: '10' } })
    const circular = legalItem({ itemId: 'circular-b', type: 'CIRCULAR', legalBasis: [{ documentSymbol: 'TT/2024' }], metadata: { conflictDimension: 'D1', conflictValue: '20' } })
    const resolved = minimalResolvedKnowledge([law, circular])

    const { realResult, newResult } = await composeViaBothPaths(resolved)

    const realPrimaryIds = realResult.citations.filter(c => c.isPrimary).map(c => c.itemId).sort()
    const realDisputedIds = realResult.citations.filter(c => c.role === 'CONFLICT_SOURCE').map(c => c.itemId).sort()

    expect(newResult.primaryCitations.map(c => c.itemId).sort()).toEqual(realPrimaryIds)
    expect(newResult.disputedCitations.map(c => c.itemId).sort()).toEqual(realDisputedIds)
  })
})

describe('Reasoning answer parity — a DOCUMENTED, intentional divergence: decision requires ruleResults', () => {
  it('the real engine produces a real, non-null decision once a passing rule exists; this stage\'s decision stays null, since RuleEvaluationResult is not one of this milestone\'s stated inputs', async () => {
    const validRule: EvaluationRuleMetadata = {
      ruleCode: 'RULE-REAL-1', ruleCategory: 'PROCUREMENT_METHOD',
      conditions: [{ field: 'estimatedValue', operator: 'GTE', value: '100000000', unit: 'VND' }],
      outcome: { pass: 'Đấu thầu rộng rãi áp dụng', fail: 'Đấu thầu rộng rãi không áp dụng' },
      isCritical: true,
    }
    const ruleItem: RuleKnowledgeItemRef = { ...legalItem({ itemId: 'rule-1', domain: 'procurement' }), rule: validRule }
    const resolved: ResolvedKnowledge = { ...minimalResolvedKnowledge([]), ruleItems: [ruleItem] }

    const intent = detectIntent({ question: 'test', asOfDate: ASOF, context: { estimatedValue: 200_000_000n } })
    const engine = buildLegalReasoningEngine()
    const realResult = await engine.reason(intent, resolved)

    const context = assembleReasoningContext(intent, resolved)
    const ruleEvaluation = evaluateRules(context)
    const conflictResolution = resolveConflicts(context, ruleEvaluation)
    const confidenceEvaluation = evaluateConfidence(context, ruleEvaluation, conflictResolution)
    const citationGeneration = generateCitations(context, conflictResolution, confidenceEvaluation)
    const newResult = composeAnswer(context, conflictResolution, confidenceEvaluation, citationGeneration)

    expect(realResult.decision).not.toBeNull()
    expect(newResult.decision).toBeNull()
  })
})
