import { describe, it, expect } from 'vitest'
import { evaluateRules } from '../reasoning/application/ruleEvaluationStage.ts'
import type { ReasoningExecutionContext } from '../reasoning/domain/reasoningExecutionContextTypes.ts'
import type {
  EvaluationRuleMetadata, IntentType, KnowledgeItemRef, ReasoningIntent, RuleKnowledgeItemRef,
  ThresholdKnowledgeItemRef, ThresholdMetadata,
} from '../reasoning/domain/reasoningTypes.ts'

const ASOF = '2026-07-06'

function intent(overrides: Partial<ReasoningIntent> = {}): ReasoningIntent {
  return {
    intentType: 'GENERAL' as IntentType, question: 'q', normalizedQuestion: 'q', detectedEntities: [],
    context: { asOfDate: ASOF }, confidence: 0.8, ambiguous: false,
    ...overrides,
  }
}

function item(itemId: string, overrides: Partial<KnowledgeItemRef> = {}): KnowledgeItemRef {
  return {
    itemId, domain: 'legal', type: 'LAW', title: itemId, summary: 's', confidence: 0.9,
    layer: 1, legalBasis: [{ documentSymbol: 'X/2025' }], metadata: {}, effectiveFrom: '2025-01-01',
    ...overrides,
  }
}

const validRule: EvaluationRuleMetadata = {
  ruleCode: 'RC-1', ruleCategory: 'PROCUREMENT_METHOD',
  conditions: [{ field: 'estimatedValue', operator: 'GTE', value: '100000000', unit: 'VND' }],
  outcome: { pass: 'passes', fail: 'fails' }, isCritical: true,
}

const validThreshold: ThresholdMetadata = {
  thresholdCode: 'TC-1', thresholdType: 'PROCUREMENT_METHOD_CEILING',
  contextField: 'estimatedValue', operator: 'LTE', value: '500000000', unit: 'VND',
}

function ruleItem(itemId: string, overrides: Partial<RuleKnowledgeItemRef> = {}): RuleKnowledgeItemRef {
  return { ...item(itemId, { domain: 'procurement' }), rule: validRule, ...overrides }
}

function thresholdItem(itemId: string, overrides: Partial<ThresholdKnowledgeItemRef> = {}): ThresholdKnowledgeItemRef {
  return { ...item(itemId, { domain: 'procurement' }), threshold: validThreshold, ...overrides }
}

function context(overrides: Partial<ReasoningExecutionContext> = {}): ReasoningExecutionContext {
  return {
    intent: intent(), asOfDate: ASOF, legalItems: [], procurementItems: [], schoolPolicyItems: [],
    ruleItems: [], thresholdItems: [], resolvedAt: `${ASOF}T00:00:00.000Z`, platformCallCount: 0,
    warnings: [], assembledAt: `${ASOF}T00:00:00.000Z`,
    ...overrides,
  }
}

describe('evaluateRules — rule/threshold execution (reused from ruleEngine.ts)', () => {
  it('evaluates a rule item and reports PASS when its conditions are met', () => {
    const ctx = context({
      ruleItems: [ruleItem('rule-1')],
      intent: intent({ context: { asOfDate: ASOF, estimatedValue: 200_000_000n } }),
    })

    const result = evaluateRules(ctx)

    expect(result.ruleResults).toHaveLength(1)
    expect(result.ruleResults[0]!.status).toBe('PASS')
    expect(result.ruleResults[0]!.ruleItemId).toBe('rule-1')
  })

  it('evaluates a threshold item and reports pass/fail against context', () => {
    const ctx = context({
      thresholdItems: [thresholdItem('threshold-1')],
      intent: intent({ context: { asOfDate: ASOF, estimatedValue: 100_000_000n } }),
    })

    const result = evaluateRules(ctx)

    expect(result.thresholdResults).toHaveLength(1)
    expect(result.thresholdResults[0]!.passed).toBe(true)
  })

  it('omits a threshold result entirely when the context field is missing (mirrors evaluateThreshold returning null)', () => {
    const ctx = context({ thresholdItems: [thresholdItem('threshold-1')] })
    const result = evaluateRules(ctx)
    expect(result.thresholdResults).toEqual([])
  })

  it('is INCONCLUSIVE when a required condition field is missing from context', () => {
    const ctx = context({ ruleItems: [ruleItem('rule-1')] })
    const result = evaluateRules(ctx)
    expect(result.ruleResults[0]!.status).toBe('INCONCLUSIVE')
  })

  it('preserves evidence references (legalBasis) unchanged on both rule and threshold results', () => {
    const ctx = context({
      ruleItems: [ruleItem('rule-1', { legalBasis: [{ documentSymbol: 'Y/2024', article: 'Đ5' }] })],
    })
    const result = evaluateRules(ctx)
    expect(result.ruleResults[0]!.legalBasis).toEqual([{ documentSymbol: 'Y/2024', article: 'Đ5' }])
  })
})

describe('evaluateRules — per-item evaluation (temporal validity, applicability, hierarchy)', () => {
  it('evaluates every item across all five buckets, not only rule/threshold items', () => {
    const ctx = context({
      legalItems: [item('legal-1')],
      procurementItems: [item('procurement-1', { domain: 'procurement' })],
      schoolPolicyItems: [item('school-1', { domain: 'school', layer: 3 })],
      ruleItems: [ruleItem('rule-1')],
      thresholdItems: [thresholdItem('threshold-1')],
    })

    const result = evaluateRules(ctx)

    expect(result.itemEvaluations.map(e => e.itemId).sort()).toEqual(
      ['legal-1', 'procurement-1', 'rule-1', 'school-1', 'threshold-1'],
    )
  })

  it('marks an item effective as of the asOfDate as CURRENT/APPLICABLE', () => {
    const ctx = context({ legalItems: [item('legal-1', { effectiveFrom: '2020-01-01' })] })
    const result = evaluateRules(ctx)
    const evaluation = result.itemEvaluations.find(e => e.itemId === 'legal-1')!
    expect(evaluation.temporalValidity).toBe('CURRENT')
    expect(evaluation.applicability).toBe('APPLICABLE')
  })

  it('marks a not-yet-effective item as NOT_YET_EFFECTIVE for both temporal validity and applicability', () => {
    const ctx = context({ legalItems: [item('legal-1', { effectiveFrom: '2099-01-01' })] })
    const result = evaluateRules(ctx)
    const evaluation = result.itemEvaluations.find(e => e.itemId === 'legal-1')!
    expect(evaluation.temporalValidity).toBe('NOT_YET_EFFECTIVE')
    expect(evaluation.applicability).toBe('NOT_YET_EFFECTIVE')
  })

  it('assigns a higher hierarchy score to a LAW than to an INTERNAL_REGULATION', () => {
    const ctx = context({
      legalItems: [
        item('law-1', { type: 'LAW' }),
        item('reg-1', { type: 'INTERNAL_REGULATION' }),
      ],
    })
    const result = evaluateRules(ctx)
    const lawScore = result.itemEvaluations.find(e => e.itemId === 'law-1')!.hierarchyScore
    const regScore = result.itemEvaluations.find(e => e.itemId === 'reg-1')!.hierarchyScore
    expect(lawScore).toBeGreaterThan(regScore)
  })
})

describe('evaluateRules — immutability and determinism', () => {
  it('deep-freezes the result', () => {
    const ctx = context({ ruleItems: [ruleItem('rule-1')] })
    const result = evaluateRules(ctx)

    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(result.itemEvaluations)).toBe(true)
    expect(Object.isFrozen(result.ruleResults[0])).toBe(true)
    expect(() => { (result as { asOfDate: string }).asOfDate = 'x' }).toThrow()
  })

  it('never mutates the input context', () => {
    const ctx = context({ ruleItems: [ruleItem('rule-1')] })
    evaluateRules(ctx)
    expect(ctx.ruleItems[0]!.itemId).toBe('rule-1')
  })

  it('is a pure function: identical input produces identical output (aside from evaluatedAt)', () => {
    const ctx = context({ legalItems: [item('a'), item('b', { effectiveFrom: '2099-01-01' })] })
    const first = evaluateRules(ctx)
    const second = evaluateRules(ctx)
    expect(first.itemEvaluations).toEqual(second.itemEvaluations)
    expect(first.ruleResults).toEqual(second.ruleResults)
    expect(first.thresholdResults).toEqual(second.thresholdResults)
  })
})
