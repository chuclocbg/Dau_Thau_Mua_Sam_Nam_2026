import { describe, it, expect } from 'vitest'
import { enrichKnowledge } from '../reasoning/application/knowledgeEnrichmentPipeline.ts'
import type { EvaluationRuleMetadata, KnowledgeItemRef, ResolvedKnowledge, ThresholdMetadata } from '../reasoning/domain/reasoningTypes.ts'

const ASOF = '2026-07-06'

function item(itemId: string, overrides: Partial<KnowledgeItemRef> = {}): KnowledgeItemRef {
  return {
    itemId, domain: 'legal', type: 'LAW', title: itemId, summary: 's', confidence: 0.9,
    layer: 1, legalBasis: [], metadata: {}, effectiveFrom: '2025-01-01', ...overrides,
  }
}

function resolvedKnowledge(overrides: Partial<ResolvedKnowledge> = {}): ResolvedKnowledge {
  return {
    legalItems: [], procurementItems: [], thresholdItems: [], ruleItems: [], schoolPolicyItems: [],
    asOfDate: ASOF, resolvedAt: `${ASOF}T00:00:00.000Z`, platformCallCount: 2, warnings: [],
    ...overrides,
  }
}

const validRule: EvaluationRuleMetadata = {
  ruleCode: 'RC-1', ruleCategory: 'PROCUREMENT_METHOD',
  conditions: [{ field: 'estimatedValue', operator: 'GTE', value: '100000000', unit: 'VND' }],
  outcome: { pass: 'p', fail: 'f' }, isCritical: true,
}

const validThreshold: ThresholdMetadata = {
  thresholdCode: 'TC-1', thresholdType: 'PROCUREMENT_METHOD_CEILING',
  contextField: 'estimatedValue', operator: 'LTE', value: '500000000', unit: 'VND',
}

describe('enrichKnowledge — deterministic pipeline', () => {
  it('populates ruleItems/thresholdItems by parsing metadata across legal/procurement/schoolPolicy buckets', () => {
    const resolved = resolvedKnowledge({
      legalItems: [item('rule-1', { metadata: { ruleDefinition: JSON.stringify(validRule) } })],
      procurementItems: [item('threshold-1', { domain: 'procurement', metadata: { thresholdDefinition: JSON.stringify(validThreshold) } })],
    })

    const { knowledge } = enrichKnowledge(resolved)

    expect(knowledge.ruleItems.map(i => i.itemId)).toEqual(['rule-1'])
    expect(knowledge.thresholdItems.map(i => i.itemId)).toEqual(['threshold-1'])
  })

  it('leaves ruleItems/thresholdItems empty when no item carries the corresponding metadata key', () => {
    const resolved = resolvedKnowledge({ legalItems: [item('plain-1')] })
    const { knowledge } = enrichKnowledge(resolved)
    expect(knowledge.ruleItems).toEqual([])
    expect(knowledge.thresholdItems).toEqual([])
  })

  it('preserves every other ResolvedKnowledge field unchanged', () => {
    const resolved = resolvedKnowledge({ warnings: ['w'], platformCallCount: 5 })
    const { knowledge } = enrichKnowledge(resolved)
    expect(knowledge.asOfDate).toBe(resolved.asOfDate)
    expect(knowledge.resolvedAt).toBe(resolved.resolvedAt)
    expect(knowledge.platformCallCount).toBe(5)
    expect(knowledge.warnings).toEqual(['w'])
    expect(knowledge.legalItems).toBe(resolved.legalItems)
  })

  it('a malformed ruleDefinition produces a critical MissingEvidence entry and excludes the item from ruleItems, never throwing', () => {
    const resolved = resolvedKnowledge({
      legalItems: [item('bad-rule', { metadata: { ruleDefinition: '{not json' } })],
    })

    expect(() => enrichKnowledge(resolved)).not.toThrow()
    const { knowledge, diagnostics } = enrichKnowledge(resolved)

    expect(knowledge.ruleItems).toEqual([])
    expect(diagnostics.missingEvidence).toHaveLength(1)
    expect(diagnostics.missingEvidence[0]!.isCritical).toBe(true)
  })

  it('an item with no effectivePeriod violation is diagnosed as APPLICABLE/CURRENT', () => {
    const resolved = resolvedKnowledge({ legalItems: [item('current-1', { effectiveFrom: '2020-01-01' })] })
    const { diagnostics } = enrichKnowledge(resolved)

    expect(diagnostics.effectivePeriodEvaluations).toEqual([{ itemId: 'current-1', status: 'CURRENT' }])
    expect(diagnostics.applicabilityEvaluations).toEqual([{ itemId: 'current-1', status: 'APPLICABLE' }])
  })

  it('a not-yet-effective item is diagnosed as NOT_YET_EFFECTIVE and does not affect ruleItems/thresholdItems for other items', () => {
    const resolved = resolvedKnowledge({
      legalItems: [
        item('future-1', { effectiveFrom: '2099-01-01' }),
        item('rule-1', { metadata: { ruleDefinition: JSON.stringify(validRule) } }),
      ],
    })
    const { knowledge, diagnostics } = enrichKnowledge(resolved)

    expect(diagnostics.applicabilityEvaluations.find(e => e.itemId === 'future-1')!.status).toBe('NOT_YET_EFFECTIVE')
    expect(knowledge.ruleItems.map(i => i.itemId)).toEqual(['rule-1'])
  })

  it('diagnostics summary reflects the actual mix of statuses across all evaluated items', () => {
    const resolved = resolvedKnowledge({
      legalItems: [
        item('current-1'),
        item('future-1', { effectiveFrom: '2099-01-01' }),
        item('bad-rule', { metadata: { ruleDefinition: '{not json' } }),
      ],
    })
    const { diagnostics } = enrichKnowledge(resolved)

    expect(diagnostics.summary.totalItemsEvaluated).toBe(3)
    expect(diagnostics.summary.notYetEffectiveCount).toBe(1)
    expect(diagnostics.summary.missingEvidenceCount).toBe(1)
  })

  it('is a pure function: calling it twice with the same input produces the same result', () => {
    const resolved = resolvedKnowledge({ legalItems: [item('a'), item('b', { effectiveFrom: '2099-01-01' })] })
    expect(enrichKnowledge(resolved)).toEqual(enrichKnowledge(resolved))
  })
})
