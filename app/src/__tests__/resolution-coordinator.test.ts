import { describe, it, expect } from 'vitest'
import { ResolutionCoordinator } from '../reasoning/application/resolutionCoordinator.ts'
import type { RankedKnowledge, ResolutionExecutor } from '../reasoning/domain/resolutionOrchestrationTypes.ts'
import type { IntentType, ReasoningIntent, ResolvedKnowledge } from '../reasoning/domain/reasoningTypes.ts'

function intent(intentType: IntentType = 'GENERAL'): ReasoningIntent {
  return {
    intentType, question: 'q', normalizedQuestion: 'q', detectedEntities: [],
    context: { asOfDate: '2026-07-06' }, confidence: 0.8, ambiguous: false,
  }
}

function resolvedKnowledge(overrides: Partial<ResolvedKnowledge> = {}): ResolvedKnowledge {
  return {
    legalItems: [], procurementItems: [], thresholdItems: [], ruleItems: [], schoolPolicyItems: [],
    asOfDate: '2026-07-06', resolvedAt: '2026-07-06T00:00:00.000Z', platformCallCount: 2, warnings: [],
    ...overrides,
  }
}

describe('ResolutionCoordinator — execution order', () => {
  it('executes the intent/retrieval stage before the ranking stage, feeding the first stage\'s output into the second', async () => {
    const callOrder: string[] = []
    const resolvedStub = resolvedKnowledge({ platformCallCount: 7 })
    const rankedStub = resolvedKnowledge({ platformCallCount: 7, legalItems: [] })

    const intentRetrievalExecutor: ResolutionExecutor<void, ResolvedKnowledge> = {
      execute: async () => { callOrder.push('intent-retrieval'); return resolvedStub },
    }
    const rankingExecutor: ResolutionExecutor<ResolvedKnowledge, RankedKnowledge> = {
      execute: async (input) => {
        callOrder.push('ranking')
        expect(input).toBe(resolvedStub)
        return rankedStub
      },
    }

    const coordinator = new ResolutionCoordinator(intentRetrievalExecutor, rankingExecutor)
    const result = await coordinator.coordinate(intent())

    expect(callOrder).toEqual(['intent-retrieval', 'ranking'])
    expect(result).toBe(rankedStub)
  })

  it('passes the same intent instance to both stages', async () => {
    const receivedIntents: ReasoningIntent[] = []
    const theIntent = intent('AUTHORITY_CHECK')

    const intentRetrievalExecutor: ResolutionExecutor<void, ResolvedKnowledge> = {
      execute: async (_input, i) => { receivedIntents.push(i); return resolvedKnowledge() },
    }
    const rankingExecutor: ResolutionExecutor<ResolvedKnowledge, RankedKnowledge> = {
      execute: async (input, i) => { receivedIntents.push(i); return input },
    }

    const coordinator = new ResolutionCoordinator(intentRetrievalExecutor, rankingExecutor)
    await coordinator.coordinate(theIntent)

    expect(receivedIntents).toEqual([theIntent, theIntent])
  })
})
