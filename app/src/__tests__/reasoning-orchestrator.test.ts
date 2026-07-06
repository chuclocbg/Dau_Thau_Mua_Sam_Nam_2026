import { describe, it, expect } from 'vitest'
import { buildReasoningOrchestrator } from '../reasoning/application/reasoningOrchestrator.ts'
import type { IKnowledgeRepository, KnowledgeRetrievalResult } from '../reasoning/domain/knowledgeRepositoryTypes.ts'
import type {
  ILegalReasoningEngine, IntentType, ReasoningExplanation, ReasoningIntent, ReasoningResult, ResolvedKnowledge,
} from '../reasoning/domain/reasoningTypes.ts'

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

function stubResult(overrides: Partial<ReasoningResult> = {}): ReasoningResult {
  return {
    decision: null, confidence: 0.5, confidenceLabel: 'MEDIUM', appliedDocuments: [], appliedArticles: [],
    reasoningTrace: [], citations: [], missingEvidence: [], evidenceSufficiency: 'SUFFICIENT', warnings: [],
    humanReviewRequired: false, intent: intent(), explainability: {} as ReasoningExplanation,
    resolvedKnowledge: {
      legalItems: [], procurementItems: [], thresholdItems: [], ruleItems: [], schoolPolicyItems: [],
      asOfDate: '2026-07-06', resolvedAt: '2026-07-06T00:00:00.000Z', platformCallCount: 0, warnings: [],
    },
    conflicts: [], thresholdResults: [], ruleResults: [], asOfDate: '2026-07-06', answeredAt: '2026-07-06T00:00:00.000Z',
    ...overrides,
  }
}

// Records every call it receives — proves both correct dispatch and genuine dependency
// injection (a real LegalReasoningEngine is never constructed in these tests).
class FakeLegalReasoningEngine implements ILegalReasoningEngine {
  readonly reasonCalls: { intent: ReasoningIntent; resolvedKnowledge: ResolvedKnowledge }[] = []
  constructor(private readonly result: ReasoningResult = stubResult()) {}

  async reason(intent: ReasoningIntent, resolvedKnowledge: ResolvedKnowledge): Promise<ReasoningResult> {
    this.reasonCalls.push({ intent, resolvedKnowledge })
    return this.result
  }

  explain(): ReasoningExplanation {
    throw new Error('not used by these tests')
  }
}

describe('ReasoningOrchestrator — coordination', () => {
  it('invokes knowledge resolution before reasoning, and passes the resolved knowledge to reason()', async () => {
    const repository = new EmptyKnowledgeRepository()
    const engine = new FakeLegalReasoningEngine()
    const orchestrator = buildReasoningOrchestrator(repository, engine)

    const theIntent = intent('GENERAL')
    const result = await orchestrator.answer(theIntent)

    expect(engine.reasonCalls).toHaveLength(1)
    expect(engine.reasonCalls[0]!.intent).toBe(theIntent)
    expect(engine.reasonCalls[0]!.resolvedKnowledge.legalItems).toEqual([])
    expect(result).toEqual(stubResult())
  })

  it('passes the same intent instance through to reason() unchanged', async () => {
    const engine = new FakeLegalReasoningEngine()
    const orchestrator = buildReasoningOrchestrator(new EmptyKnowledgeRepository(), engine)
    const theIntent = intent('AUTHORITY_CHECK')

    await orchestrator.answer(theIntent)

    expect(engine.reasonCalls[0]!.intent.intentType).toBe('AUTHORITY_CHECK')
  })

  it('never calls the engine before knowledge resolution completes (resolvedKnowledge reflects the repository, not a stub)', async () => {
    class RecordingRepository implements IKnowledgeRepository {
      async resolveKnowledge(domain: string): Promise<KnowledgeRetrievalResult> {
        if (domain === 'legal') {
          return {
            items: [{
              itemId: 'law-1', domain: 'legal', type: 'LAW', title: 't', summary: 's', confidence: 0.9,
              layer: 1, legalBasis: [], metadata: {}, effectiveFrom: '2025-01-01',
            }],
            effectivePeriodAssumedItemIds: [],
          }
        }
        return { items: [], effectivePeriodAssumedItemIds: [] }
      }
      async searchKnowledge(): Promise<KnowledgeRetrievalResult> {
        return { items: [], effectivePeriodAssumedItemIds: [] }
      }
    }

    const engine = new FakeLegalReasoningEngine()
    const orchestrator = buildReasoningOrchestrator(new RecordingRepository(), engine)

    await orchestrator.answer(intent('GENERAL'))

    expect(engine.reasonCalls[0]!.resolvedKnowledge.legalItems.map(i => i.itemId)).toEqual(['law-1'])
  })
})

describe('ReasoningOrchestrator — dependency injection', () => {
  it('the same orchestrator class produces different results depending on which repository is injected', async () => {
    class SchoolOnlyRepository implements IKnowledgeRepository {
      async resolveKnowledge(domain: string): Promise<KnowledgeRetrievalResult> {
        if (domain !== 'school') return { items: [], effectivePeriodAssumedItemIds: [] }
        return {
          items: [{
            itemId: 'school-1', domain: 'school', type: 'INTERNAL_REGULATION', title: 't', summary: 's',
            confidence: 0.9, layer: 3, legalBasis: [], metadata: {}, effectiveFrom: '2025-01-01',
          }],
          effectivePeriodAssumedItemIds: [],
        }
      }
      async searchKnowledge(): Promise<KnowledgeRetrievalResult> {
        return { items: [], effectivePeriodAssumedItemIds: [] }
      }
    }

    const engineA = new FakeLegalReasoningEngine()
    const engineB = new FakeLegalReasoningEngine()
    const orchestratorA = buildReasoningOrchestrator(new EmptyKnowledgeRepository(), engineA)
    const orchestratorB = buildReasoningOrchestrator(new SchoolOnlyRepository(), engineB)

    await orchestratorA.answer(intent('AUTHORITY_CHECK'))
    await orchestratorB.answer(intent('AUTHORITY_CHECK'))

    expect(engineA.reasonCalls[0]!.resolvedKnowledge.schoolPolicyItems).toEqual([])
    expect(engineB.reasonCalls[0]!.resolvedKnowledge.schoolPolicyItems.map(i => i.itemId)).toEqual(['school-1'])
  })

  it('the same orchestrator class produces different results depending on which engine is injected', async () => {
    const repository = new EmptyKnowledgeRepository()
    const resultA = stubResult({ decision: 'A' })
    const resultB = stubResult({ decision: 'B' })

    const orchestratorA = buildReasoningOrchestrator(repository, new FakeLegalReasoningEngine(resultA))
    const orchestratorB = buildReasoningOrchestrator(repository, new FakeLegalReasoningEngine(resultB))

    expect((await orchestratorA.answer(intent())).decision).toBe('A')
    expect((await orchestratorB.answer(intent())).decision).toBe('B')
  })

  it('defaults to a real LegalReasoningEngine when none is injected', async () => {
    const orchestrator = buildReasoningOrchestrator(new EmptyKnowledgeRepository())
    const result = await orchestrator.answer(intent('GENERAL'))

    expect(result.resolvedKnowledge).toBeDefined()
    expect(result.reasoningTrace.length).toBeGreaterThan(0)
  })
})
