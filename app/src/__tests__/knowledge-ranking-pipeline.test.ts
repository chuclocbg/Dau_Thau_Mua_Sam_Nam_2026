import { describe, it, expect } from 'vitest'
import { buildKnowledgeRankingPipeline } from '../reasoning/application/knowledgeRankingPipeline.ts'
import type { KnowledgeItemRef, ReasoningIntent, ResolvedKnowledge } from '../reasoning/domain/reasoningTypes.ts'
import type { RankingPlan } from '../reasoning/domain/knowledgeRankingTypes.ts'

const ASOF = '2026-07-06'

function item(itemId: string, overrides: Partial<KnowledgeItemRef> = {}): KnowledgeItemRef {
  return {
    itemId, domain: 'legal', type: 'LAW', title: itemId, summary: 's', confidence: 0.8,
    layer: 1, legalBasis: [], metadata: {}, effectiveFrom: '2025-01-01', ...overrides,
  }
}

function intent(overrides: Partial<ReasoningIntent> = {}): ReasoningIntent {
  return {
    intentType: 'GENERAL', question: 'q', normalizedQuestion: 'q', detectedEntities: [],
    context: { asOfDate: ASOF }, confidence: 0.8, ambiguous: false, ...overrides,
  }
}

function resolvedKnowledge(overrides: Partial<ResolvedKnowledge> = {}): ResolvedKnowledge {
  return {
    legalItems: [], procurementItems: [], thresholdItems: [], ruleItems: [], schoolPolicyItems: [],
    asOfDate: ASOF, resolvedAt: `${ASOF}T00:00:00.000Z`, platformCallCount: 2, warnings: [],
    ...overrides,
  }
}

describe('KnowledgeRankingPipeline — orchestration', () => {
  it('ranks and trims each bucket independently (legalItems, procurementItems, schoolPolicyItems)', () => {
    const pipeline = buildKnowledgeRankingPipeline()
    const resolved = resolvedKnowledge({
      legalItems: [item('law-low', { type: 'INTERNAL_REGULATION' }), item('law-high', { type: 'LAW' })],
      procurementItems: [item('proc-1', { domain: 'procurement' })],
      schoolPolicyItems: [item('school-1', { domain: 'school', layer: 3 })],
    })

    const result = pipeline.rank(resolved, intent())

    expect(result.legalItems.map(i => i.itemId)).toEqual(['law-high', 'law-low'])
    expect(result.procurementItems.map(i => i.itemId)).toEqual(['proc-1'])
    expect(result.schoolPolicyItems.map(i => i.itemId)).toEqual(['school-1'])
  })

  it('preserves asOfDate/resolvedAt/platformCallCount/warnings from the input unchanged', () => {
    const pipeline = buildKnowledgeRankingPipeline()
    const resolved = resolvedKnowledge({ warnings: ['a warning'], platformCallCount: 3 })

    const result = pipeline.rank(resolved, intent())

    expect(result.asOfDate).toBe(resolved.asOfDate)
    expect(result.resolvedAt).toBe(resolved.resolvedAt)
    expect(result.platformCallCount).toBe(3)
    expect(result.warnings).toEqual(['a warning'])
  })

  it('never resolves conflicts — two contradictory items are both kept and ordered by score, not merged or removed', () => {
    const pipeline = buildKnowledgeRankingPipeline()
    const resolved = resolvedKnowledge({
      legalItems: [
        item('law-a', { type: 'LAW', metadata: { conflictDimension: 'X', conflictValue: '0.3' } }),
        item('law-b', { type: 'LAW', metadata: { conflictDimension: 'X', conflictValue: '0.2' } }),
      ],
    })

    const result = pipeline.rank(resolved, intent())

    expect(result.legalItems).toHaveLength(2)
  })

  it('trims to the plan\'s maxCandidates across a large bucket', () => {
    const manyItems = Array.from({ length: 30 }, (_, i) => item(`item-${i}`))
    const pipeline = buildKnowledgeRankingPipeline(() => ({
      weights: { domainPriority: 0.2, legalHierarchy: 0.2, relevance: 0.2, freshness: 0.2, documentAuthority: 0.2 },
      maxCandidates: 5,
    }))

    const result = pipeline.rank(resolvedKnowledge({ legalItems: manyItems }), intent())

    expect(result.legalItems).toHaveLength(5)
  })
})

describe('KnowledgeRankingPipeline — dependency injection', () => {
  it('the same pipeline class produces different results depending on which planner is injected', () => {
    const items = [item('a', { type: 'LAW' }), item('b', { domain: 'school', layer: 3, type: 'INTERNAL_REGULATION' })]
    const resolved = resolvedKnowledge({ legalItems: items })

    const defaultPipeline = buildKnowledgeRankingPipeline()
    const customPlan: RankingPlan = {
      weights: { domainPriority: 0, legalHierarchy: 0, relevance: 0, freshness: 0, documentAuthority: 1 },
      maxCandidates: 1,
    }
    const customPipeline = buildKnowledgeRankingPipeline(() => customPlan)

    const defaultResult = defaultPipeline.rank(resolved, intent())
    const customResult = customPipeline.rank(resolved, intent())

    expect(defaultResult.legalItems).toHaveLength(2)
    expect(customResult.legalItems).toHaveLength(1)
  })

  it('the injected planner receives the actual intent passed to rank()', () => {
    let receivedIntent: ReasoningIntent | undefined
    const pipeline = buildKnowledgeRankingPipeline((i) => {
      receivedIntent = i
      return { weights: { domainPriority: 0.2, legalHierarchy: 0.2, relevance: 0.2, freshness: 0.2, documentAuthority: 0.2 }, maxCandidates: 20 }
    })

    pipeline.rank(resolvedKnowledge(), intent({ intentType: 'AUTHORITY_CHECK' }))

    expect(receivedIntent?.intentType).toBe('AUTHORITY_CHECK')
  })
})
