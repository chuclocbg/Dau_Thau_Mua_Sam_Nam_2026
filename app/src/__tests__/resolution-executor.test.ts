import { describe, it, expect } from 'vitest'
import { createIntentRetrievalExecutor, createRankingExecutor } from '../reasoning/application/resolutionExecutor.ts'
import { buildIntentResolutionPipeline } from '../reasoning/application/intentResolutionPipeline.ts'
import { buildKnowledgeRankingPipeline } from '../reasoning/application/knowledgeRankingPipeline.ts'
import type { IKnowledgeRepository, KnowledgeRetrievalResult } from '../reasoning/domain/knowledgeRepositoryTypes.ts'
import type { IntentType, ReasoningIntent, ResolvedKnowledge } from '../reasoning/domain/reasoningTypes.ts'

function intent(intentType: IntentType = 'GENERAL'): ReasoningIntent {
  return {
    intentType, question: 'q', normalizedQuestion: 'q', detectedEntities: [],
    context: { asOfDate: '2026-07-06' }, confidence: 0.8, ambiguous: false,
  }
}

class EmptyKnowledgeRepository implements IKnowledgeRepository {
  async resolveKnowledge(): Promise<KnowledgeRetrievalResult> {
    return { items: [], effectivePeriodAssumedItemIds: [] }
  }
  async searchKnowledge(): Promise<KnowledgeRetrievalResult> {
    return { items: [], effectivePeriodAssumedItemIds: [] }
  }
}

function resolvedKnowledge(overrides: Partial<ResolvedKnowledge> = {}): ResolvedKnowledge {
  return {
    legalItems: [], procurementItems: [], thresholdItems: [], ruleItems: [], schoolPolicyItems: [],
    asOfDate: '2026-07-06', resolvedAt: '2026-07-06T00:00:00.000Z', platformCallCount: 2, warnings: [],
    ...overrides,
  }
}

describe('createIntentRetrievalExecutor', () => {
  it('forwards to the wrapped IntentResolutionPipeline.resolve() unchanged', async () => {
    const pipeline = buildIntentResolutionPipeline(new EmptyKnowledgeRepository())
    const executor = createIntentRetrievalExecutor(pipeline)

    const direct = await pipeline.resolve(intent())
    const viaExecutor = await executor.execute(undefined, intent())

    expect(viaExecutor.legalItems).toEqual(direct.legalItems)
    expect(viaExecutor.asOfDate).toBe(direct.asOfDate)
  })
})

describe('createRankingExecutor', () => {
  it('forwards to the wrapped KnowledgeRankingPipeline.rank() unchanged', async () => {
    const pipeline = buildKnowledgeRankingPipeline()
    const executor = createRankingExecutor(pipeline)
    const resolved = resolvedKnowledge()

    const direct = pipeline.rank(resolved, intent())
    const viaExecutor = await executor.execute(resolved, intent())

    expect(viaExecutor).toEqual(direct)
  })

  it('resolves to a Promise even though the underlying pipeline is synchronous', () => {
    const pipeline = buildKnowledgeRankingPipeline()
    const executor = createRankingExecutor(pipeline)

    const result = executor.execute(resolvedKnowledge(), intent())

    expect(result).toBeInstanceOf(Promise)
  })
})
