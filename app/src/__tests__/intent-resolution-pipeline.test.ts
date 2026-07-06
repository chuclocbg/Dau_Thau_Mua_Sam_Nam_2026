import { describe, it, expect } from 'vitest'
import { buildIntentResolutionPipeline, executeResolutionStep } from '../reasoning/application/intentResolutionPipeline.ts'
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
    itemId, domain: 'legal', type: 'LAW', title: 't', summary: 's', confidence: 0.9,
    layer: 1, legalBasis: [], metadata: {}, effectiveFrom: '2025-01-01', ...overrides,
  }
}

// A fake IKnowledgeRepository recording every call it receives — proves both correct
// dispatch and genuine dependency injection (a real KnowledgePlatformRepository is never
// constructed here; this pipeline only ever depends on the interface).
class FakeKnowledgeRepository implements IKnowledgeRepository {
  readonly resolveCalls: { domain: string; context: ReasoningContext; asOfDate: string }[] = []
  readonly searchCalls: { text: string; domains: readonly string[]; context: ReasoningContext; limit: number }[] = []

  constructor(
    private readonly resolveResults: Record<string, KnowledgeRetrievalResult> = {},
    private readonly searchResult: KnowledgeRetrievalResult = { items: [], effectivePeriodAssumedItemIds: [] },
  ) {}

  async resolveKnowledge(domain: string, context: ReasoningContext, asOfDate: string): Promise<KnowledgeRetrievalResult> {
    this.resolveCalls.push({ domain, context, asOfDate })
    return this.resolveResults[domain] ?? { items: [], effectivePeriodAssumedItemIds: [] }
  }

  async searchKnowledge(text: string, domains: readonly string[], context: ReasoningContext, limit: number): Promise<KnowledgeRetrievalResult> {
    this.searchCalls.push({ text, domains, context, limit })
    return this.searchResult
  }
}

describe('executeResolutionStep — RESOLVE vs SEARCH dispatch', () => {
  it('a RESOLVE step calls repository.resolveKnowledge with the step\'s domain and the intent\'s asOfDate', async () => {
    const repository = new FakeKnowledgeRepository()
    await executeResolutionStep({ domain: 'legal', method: 'RESOLVE' }, intent('GENERAL'), repository)

    expect(repository.resolveCalls).toEqual([{ domain: 'legal', context: { asOfDate: '2026-07-06' }, asOfDate: '2026-07-06' }])
    expect(repository.searchCalls).toHaveLength(0)
  })

  it('a SEARCH step calls repository.searchKnowledge with the intent\'s question, the step\'s domain, and the step\'s limit', async () => {
    const repository = new FakeKnowledgeRepository()
    await executeResolutionStep({ domain: 'cases', method: 'SEARCH', limit: 3 }, intent('GENERAL'), repository)

    expect(repository.searchCalls).toEqual([{ text: 'q', domains: ['cases'], context: { asOfDate: '2026-07-06' }, limit: 3 }])
    expect(repository.resolveCalls).toHaveLength(0)
  })

  it('a SEARCH step with no explicit limit falls back to a default limit', async () => {
    const repository = new FakeKnowledgeRepository()
    await executeResolutionStep({ domain: 'bestpractice', method: 'SEARCH' }, intent('GENERAL'), repository)

    expect(repository.searchCalls[0]!.limit).toBeGreaterThan(0)
  })
})

describe('IntentResolutionPipeline — dispatch', () => {
  it('calls resolveKnowledge for every RESOLVE step in the plan, with the correct domain/context/asOfDate', async () => {
    const repository = new FakeKnowledgeRepository()
    const pipeline = buildIntentResolutionPipeline(repository)

    await pipeline.resolve(intent('AUTHORITY_CHECK'))

    expect(repository.resolveCalls.map(c => c.domain)).toEqual(['legal', 'procurement', 'school'])
    expect(repository.resolveCalls[0]!.asOfDate).toBe('2026-07-06')
  })

  it('never calls searchKnowledge when the plan has no SEARCH step', async () => {
    const repository = new FakeKnowledgeRepository()
    const pipeline = buildIntentResolutionPipeline(repository)

    await pipeline.resolve(intent('GENERAL'))

    expect(repository.searchCalls).toHaveLength(0)
  })
})

describe('IntentResolutionPipeline — result assembly', () => {
  it('buckets legal-domain results into legalItems', async () => {
    const legalItem = knowledgeItemRef('legal-1', { domain: 'legal' })
    const repository = new FakeKnowledgeRepository({ legal: { items: [legalItem], effectivePeriodAssumedItemIds: [] } })
    const pipeline = buildIntentResolutionPipeline(repository)

    const result = await pipeline.resolve(intent('GENERAL'))

    expect(result.legalItems).toEqual([legalItem])
    expect(result.procurementItems).toEqual([])
    expect(result.schoolPolicyItems).toEqual([])
  })

  it('buckets school-domain results into schoolPolicyItems', async () => {
    const schoolItem = knowledgeItemRef('school-1', { domain: 'school' })
    const repository = new FakeKnowledgeRepository({ school: { items: [schoolItem], effectivePeriodAssumedItemIds: [] } })
    const pipeline = buildIntentResolutionPipeline(repository)

    const result = await pipeline.resolve(intent('AUTHORITY_CHECK'))

    expect(result.schoolPolicyItems).toEqual([schoolItem])
  })

  it('ruleItems and thresholdItems are always empty this milestone', async () => {
    const repository = new FakeKnowledgeRepository()
    const pipeline = buildIntentResolutionPipeline(repository)

    const result = await pipeline.resolve(intent('THRESHOLD_CHECK'))

    expect(result.ruleItems).toEqual([])
    expect(result.thresholdItems).toEqual([])
  })

  it('platformCallCount equals the number of plan steps actually executed', async () => {
    const repository = new FakeKnowledgeRepository()
    const pipeline = buildIntentResolutionPipeline(repository)

    const generalResult = await pipeline.resolve(intent('GENERAL'))
    const authorityResult = await pipeline.resolve(intent('AUTHORITY_CHECK'))

    expect(generalResult.platformCallCount).toBe(2)
    expect(authorityResult.platformCallCount).toBe(3)
  })

  it('collects effectivePeriodAssumedItemIds across all steps into ResolvedKnowledge.warnings as strings', async () => {
    const repository = new FakeKnowledgeRepository({
      legal: { items: [knowledgeItemRef('legal-1')], effectivePeriodAssumedItemIds: ['legal-1'] },
      procurement: { items: [knowledgeItemRef('proc-1', { domain: 'procurement' })], effectivePeriodAssumedItemIds: ['proc-1'] },
    })
    const pipeline = buildIntentResolutionPipeline(repository)

    const result = await pipeline.resolve(intent('GENERAL'))

    expect(result.warnings).toHaveLength(2)
    expect(result.warnings.some(w => w.includes('legal-1'))).toBe(true)
    expect(result.warnings.some(w => w.includes('proc-1'))).toBe(true)
  })

  it('produces no warnings when nothing triggered an effectivePeriod fallback', async () => {
    const repository = new FakeKnowledgeRepository()
    const pipeline = buildIntentResolutionPipeline(repository)

    const result = await pipeline.resolve(intent('GENERAL'))

    expect(result.warnings).toEqual([])
  })

  it('sets asOfDate from the intent context, and resolvedAt to a fresh timestamp', async () => {
    const repository = new FakeKnowledgeRepository()
    const pipeline = buildIntentResolutionPipeline(repository)

    const result = await pipeline.resolve(intent('GENERAL', { asOfDate: '2025-12-01' }))

    expect(result.asOfDate).toBe('2025-12-01')
    expect(new Date(result.resolvedAt).toString()).not.toBe('Invalid Date')
  })
})

describe('IntentResolutionPipeline — dependency injection', () => {
  it('the same pipeline class produces different results depending on which repository instance is injected', async () => {
    const repositoryA = new FakeKnowledgeRepository({ legal: { items: [knowledgeItemRef('a')], effectivePeriodAssumedItemIds: [] } })
    const repositoryB = new FakeKnowledgeRepository({ legal: { items: [knowledgeItemRef('b')], effectivePeriodAssumedItemIds: [] } })

    const resultA = await buildIntentResolutionPipeline(repositoryA).resolve(intent('GENERAL'))
    const resultB = await buildIntentResolutionPipeline(repositoryB).resolve(intent('GENERAL'))

    expect(resultA.legalItems[0]!.itemId).toBe('a')
    expect(resultB.legalItems[0]!.itemId).toBe('b')
  })
})
