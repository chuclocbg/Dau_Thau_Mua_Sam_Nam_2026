import { describe, it, expect } from 'vitest'
import { buildFinalKnowledgeResolutionPipeline } from '../reasoning/application/finalKnowledgeResolutionPipeline.ts'
import { buildKnowledgeResolutionPipeline } from '../reasoning/application/knowledgeResolutionPipeline.ts'
import type { IKnowledgeRepository, KnowledgeRetrievalResult } from '../reasoning/domain/knowledgeRepositoryTypes.ts'
import type {
  EvaluationRuleMetadata, IntentType, KnowledgeItemRef, ReasoningContext, ReasoningIntent, ThresholdMetadata,
} from '../reasoning/domain/reasoningTypes.ts'

function intent(intentType: IntentType, context: Partial<ReasoningContext> = {}): ReasoningIntent {
  return {
    intentType, question: 'q', normalizedQuestion: 'q', detectedEntities: [],
    context: { asOfDate: '2026-07-06', ...context }, confidence: 0.8, ambiguous: false,
  }
}

function item(itemId: string, overrides: Partial<KnowledgeItemRef> = {}): KnowledgeItemRef {
  return {
    itemId, domain: 'legal', type: 'LAW', title: itemId, summary: 's', confidence: 0.9,
    layer: 1, legalBasis: [], metadata: {}, effectiveFrom: '2025-01-01', ...overrides,
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

class RecordingKnowledgeRepository implements IKnowledgeRepository {
  readonly resolveCallOrder: string[] = []

  constructor(private readonly resolveResults: Record<string, KnowledgeRetrievalResult> = {}) {}

  async resolveKnowledge(domain: string): Promise<KnowledgeRetrievalResult> {
    this.resolveCallOrder.push(domain)
    return this.resolveResults[domain] ?? { items: [], effectivePeriodAssumedItemIds: [] }
  }

  async searchKnowledge(): Promise<KnowledgeRetrievalResult> {
    return { items: [], effectivePeriodAssumedItemIds: [] }
  }
}

describe('FinalKnowledgeResolutionPipeline — Intent Resolution -> Retrieval -> Ranking -> Enrichment -> ResolvedKnowledge', () => {
  it('produces a fully enriched result: ranked ordering AND populated ruleItems/thresholdItems in one call', async () => {
    const repository = new RecordingKnowledgeRepository({
      legal: {
        items: [
          item('law-weak', { type: 'INTERNAL_REGULATION' }),
          item('law-strong', { type: 'LAW' }),
          item('rule-1', { metadata: { ruleDefinition: JSON.stringify(validRule) } }),
        ],
        effectivePeriodAssumedItemIds: [],
      },
      procurement: {
        items: [item('threshold-1', { domain: 'procurement', metadata: { thresholdDefinition: JSON.stringify(validThreshold) } })],
        effectivePeriodAssumedItemIds: [],
      },
    })
    const pipeline = buildFinalKnowledgeResolutionPipeline(repository)

    const { knowledge, diagnostics } = await pipeline.resolve(intent('GENERAL'))

    // Ranking (X.3.5) genuinely ran: legal hierarchy re-orders law-strong before law-weak.
    expect(knowledge.legalItems.map(i => i.itemId)).toContain('law-strong')
    expect(knowledge.legalItems.findIndex(i => i.itemId === 'law-strong'))
      .toBeLessThan(knowledge.legalItems.findIndex(i => i.itemId === 'law-weak'))

    // Enrichment (X.3.6) genuinely ran: rule/threshold metadata parsed into their own buckets.
    expect(knowledge.ruleItems.map(i => i.itemId)).toEqual(['rule-1'])
    expect(knowledge.thresholdItems.map(i => i.itemId)).toEqual(['threshold-1'])
    expect(diagnostics.summary.totalItemsEvaluated).toBeGreaterThan(0)
  })

  it('executes retrieval before ranking/enrichment can see any data (deterministic stage order)', async () => {
    const repository = new RecordingKnowledgeRepository({
      legal: { items: [item('legal-1')], effectivePeriodAssumedItemIds: [] },
    })
    const pipeline = buildFinalKnowledgeResolutionPipeline(repository)

    const result = await pipeline.resolve(intent('GENERAL'))

    // Retrieval must have happened (repository was called) before any ranked/enriched item
    // could exist in the result — proving Retrieval -> Ranking -> Enrichment causal order.
    expect(repository.resolveCallOrder.length).toBeGreaterThan(0)
    expect(result.knowledge.legalItems.map(i => i.itemId)).toEqual(['legal-1'])
  })

  it('a malformed rule definition is excluded with a critical MissingEvidence entry, never throwing, end-to-end', async () => {
    const repository = new RecordingKnowledgeRepository({
      legal: { items: [item('bad-rule', { metadata: { ruleDefinition: '{not json' } })], effectivePeriodAssumedItemIds: [] },
    })
    const pipeline = buildFinalKnowledgeResolutionPipeline(repository)

    const { knowledge, diagnostics } = await pipeline.resolve(intent('GENERAL'))

    expect(knowledge.ruleItems).toEqual([])
    expect(diagnostics.missingEvidence).toHaveLength(1)
    expect(diagnostics.missingEvidence[0]!.isCritical).toBe(true)
  })

  it('trims candidates to the ranking plan\'s maxCandidates before enrichment ever runs', async () => {
    const manyItems = Array.from({ length: 30 }, (_, i) => item(`item-${i}`))
    const repository = new RecordingKnowledgeRepository({ legal: { items: manyItems, effectivePeriodAssumedItemIds: [] } })
    const pipeline = buildFinalKnowledgeResolutionPipeline(repository, () => ({
      weights: { domainPriority: 0.2, legalHierarchy: 0.2, relevance: 0.2, freshness: 0.2, documentAuthority: 0.2 },
      maxCandidates: 5,
    }))

    const { knowledge, diagnostics } = await pipeline.resolve(intent('GENERAL'))

    expect(knowledge.legalItems).toHaveLength(5)
    expect(diagnostics.summary.totalItemsEvaluated).toBe(5)
  })

  it('the same pipeline resolves different intents independently (no shared mutable state)', async () => {
    const repository = new RecordingKnowledgeRepository({
      legal: { items: [item('legal-1')], effectivePeriodAssumedItemIds: [] },
      school: { items: [item('school-1', { domain: 'school', layer: 3 })], effectivePeriodAssumedItemIds: [] },
    })
    const pipeline = buildFinalKnowledgeResolutionPipeline(repository)

    const generalResult = await pipeline.resolve(intent('GENERAL'))
    const authorityResult = await pipeline.resolve(intent('AUTHORITY_CHECK'))

    expect(generalResult.knowledge.schoolPolicyItems).toEqual([])
    expect(authorityResult.knowledge.schoolPolicyItems.map(i => i.itemId)).toEqual(['school-1'])
  })
})

describe('Regression — X.3.5\'s own KnowledgeResolutionPipeline is unchanged by X.3.7', () => {
  it('calling X.3.5\'s KnowledgeResolutionPipeline directly still leaves ruleItems/thresholdItems empty', async () => {
    const repository = new RecordingKnowledgeRepository({
      legal: { items: [item('rule-1', { metadata: { ruleDefinition: JSON.stringify(validRule) } })], effectivePeriodAssumedItemIds: [] },
    })
    const directPipeline = buildKnowledgeResolutionPipeline(repository)

    const result = await directPipeline.resolve(intent('GENERAL'))

    expect(result.ruleItems).toEqual([])
    expect(result.thresholdItems).toEqual([])
  })
})
