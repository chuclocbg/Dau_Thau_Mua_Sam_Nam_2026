import { describe, it, expect } from 'vitest'
import { planRanking } from '../reasoning/application/rankingPlanner.ts'
import type { IntentType, ReasoningIntent } from '../reasoning/domain/reasoningTypes.ts'

function intent(intentType: IntentType): ReasoningIntent {
  return {
    intentType, question: 'q', normalizedQuestion: 'q', detectedEntities: [],
    context: { asOfDate: '2026-07-06' }, confidence: 0.8, ambiguous: false,
  }
}

function weightsSum(weights: ReturnType<typeof planRanking>['weights']): number {
  return weights.domainPriority + weights.legalHierarchy + weights.relevance + weights.freshness + weights.documentAuthority
}

describe('planRanking', () => {
  it('AUTHORITY_CHECK weights documentAuthority and legalHierarchy higher than the default profile', () => {
    const authorityWeights = planRanking(intent('AUTHORITY_CHECK')).weights
    const defaultWeights = planRanking(intent('GENERAL')).weights
    expect(authorityWeights.documentAuthority).toBeGreaterThan(defaultWeights.documentAuthority)
    expect(authorityWeights.legalHierarchy).toBeGreaterThan(defaultWeights.legalHierarchy)
  })

  it('every intent without an explicit override uses the same default weight profile', () => {
    const a = planRanking(intent('GENERAL')).weights
    const b = planRanking(intent('THRESHOLD_CHECK')).weights
    const c = planRanking(intent('BEST_PRACTICE')).weights
    expect(a).toEqual(b)
    expect(b).toEqual(c)
  })

  it('every weight profile sums to 1.0 (a proper distribution, not an arbitrary scale)', () => {
    for (const intentType of ['GENERAL', 'AUTHORITY_CHECK', 'COMPLIANCE_CHECK'] as const) {
      expect(weightsSum(planRanking(intent(intentType)).weights)).toBeCloseTo(1, 10)
    }
  })

  it('always sets a positive maxCandidates cap', () => {
    expect(planRanking(intent('GENERAL')).maxCandidates).toBeGreaterThan(0)
  })

  it('is a pure function: identical intent produces an identical plan', () => {
    const i = intent('AUTHORITY_CHECK')
    expect(planRanking(i)).toEqual(planRanking(i))
  })
})
