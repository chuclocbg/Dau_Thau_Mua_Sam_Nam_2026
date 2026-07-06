import { describe, it, expect } from 'vitest'
import { buildKnowledgeResolutionPipeline } from '../reasoning/application/knowledgeResolutionPipeline.ts'
import type { IKnowledgeRepository, KnowledgeRetrievalResult } from '../reasoning/domain/knowledgeRepositoryTypes.ts'
import type { IntentType, KnowledgeItemRef, ReasoningContext, ReasoningIntent } from '../reasoning/domain/reasoningTypes.ts'

function intent(intentType: IntentType, context: Partial<ReasoningContext> = {}): ReasoningIntent {
  return {
    intentType, question: 'q', normalizedQuestion: 'q', detectedEntities: [],
    context: { asOfDate: '2026-07-06', ...context }, confidence: 0.8, ambiguous: false,
  }
}

function knowledgeItemRef(itemId: string, overrides: Partial<KnowledgeItemRef> = {}): KnowledgeItemRef {
  return {
    itemId, domain: 'legal', type: 'LAW', title: itemId, summary: 's', confidence: 0.9,
    layer: 1, legalBasis: [], metadata: {}, effectiveFrom: '2025-01-01', ...overrides,
  }
}

class FakeKnowledgeRepository implements IKnowledgeRepository {
  constructor(private readonly resolveResults: Record<string, KnowledgeRetrievalResult> = {}) {}

  async resolveKnowledge(domain: string): Promise<KnowledgeRetrievalResult> {
    return this.resolveResults[domain] ?? { items: [], effectivePeriodAssumedItemIds: [] }
  }

  async searchKnowledge(): Promise<KnowledgeRetrievalResult> {
    return { items: [], effectivePeriodAssumedItemIds: [] }
  }
}

describe('KnowledgeResolutionPipeline — Intent Resolution -> Retrieval -> Ranking -> RankedKnowledge', () => {
  it('resolves real (fake-repository-backed) knowledge and returns it ranked, not just retrieved', async () => {
    const repository = new FakeKnowledgeRepository({
      legal: {
        items: [
          knowledgeItemRef('law-weak', { type: 'INTERNAL_REGULATION' }),
          knowledgeItemRef('law-strong', { type: 'LAW' }),
        ],
        effectivePeriodAssumedItemIds: [],
      },
    })
    const pipeline = buildKnowledgeResolutionPipeline(repository)

    const result = await pipeline.resolve(intent('GENERAL'))

    // Retrieval alone (X.3.3) would preserve repository order; ranking (X.3.4) re-orders by
    // legal hierarchy/authority — proving the ranking stage genuinely ran, not just retrieval.
    expect(result.legalItems.map(i => i.itemId)).toEqual(['law-strong', 'law-weak'])
  })

  it('trims candidates to the ranking plan\'s maxCandidates — a guarantee retrieval alone never provides', async () => {
    const manyItems = Array.from({ length: 30 }, (_, i) => knowledgeItemRef(`item-${i}`))
    const repository = new FakeKnowledgeRepository({ legal: { items: manyItems, effectivePeriodAssumedItemIds: [] } })
    const pipeline = buildKnowledgeResolutionPipeline(repository, () => ({
      weights: { domainPriority: 0.2, legalHierarchy: 0.2, relevance: 0.2, freshness: 0.2, documentAuthority: 0.2 },
      maxCandidates: 5,
    }))

    const result = await pipeline.resolve(intent('GENERAL'))

    expect(result.legalItems).toHaveLength(5)
  })

  it('preserves asOfDate/platformCallCount/warnings from the retrieval stage through ranking', async () => {
    const repository = new FakeKnowledgeRepository({
      legal: { items: [], effectivePeriodAssumedItemIds: ['legal-1'] },
    })
    const pipeline = buildKnowledgeResolutionPipeline(repository)

    const result = await pipeline.resolve(intent('GENERAL', { asOfDate: '2025-11-01' }))

    expect(result.asOfDate).toBe('2025-11-01')
    expect(result.platformCallCount).toBe(2)
    expect(result.warnings.some(w => w.includes('legal-1'))).toBe(true)
  })

  it('the same pipeline resolves different intents to independently correct results (no shared mutable state)', async () => {
    const repository = new FakeKnowledgeRepository({
      legal: { items: [knowledgeItemRef('legal-1')], effectivePeriodAssumedItemIds: [] },
      school: { items: [knowledgeItemRef('school-1', { domain: 'school', layer: 3 })], effectivePeriodAssumedItemIds: [] },
    })
    const pipeline = buildKnowledgeResolutionPipeline(repository)

    const generalResult = await pipeline.resolve(intent('GENERAL'))
    const authorityResult = await pipeline.resolve(intent('AUTHORITY_CHECK'))

    expect(generalResult.schoolPolicyItems).toEqual([])
    expect(authorityResult.schoolPolicyItems.map(i => i.itemId)).toEqual(['school-1'])
  })
})
