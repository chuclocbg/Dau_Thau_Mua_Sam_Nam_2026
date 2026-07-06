import { describe, it, expect } from 'vitest'
import { planKnowledgeResolution } from '../reasoning/application/knowledgeResolutionPlanner.ts'
import type { IntentType, ReasoningIntent } from '../reasoning/domain/reasoningTypes.ts'

function intent(intentType: IntentType): ReasoningIntent {
  return {
    intentType, question: 'q', normalizedQuestion: 'q', detectedEntities: [],
    context: { asOfDate: '2026-07-06' }, confidence: 0.8, ambiguous: false,
  }
}

describe('planKnowledgeResolution — intent routing', () => {
  it('always includes the legal + procurement baseline, regardless of intent type', () => {
    const plan = planKnowledgeResolution(intent('GENERAL'))
    expect(plan.steps).toContainEqual({ domain: 'legal', method: 'RESOLVE' })
    expect(plan.steps).toContainEqual({ domain: 'procurement', method: 'RESOLVE' })
  })

  it('AUTHORITY_CHECK additionally requests the school domain', () => {
    const plan = planKnowledgeResolution(intent('AUTHORITY_CHECK'))
    expect(plan.steps).toContainEqual({ domain: 'school', method: 'RESOLVE' })
    expect(plan.steps).toHaveLength(3)
  })

  it('COMPLIANCE_CHECK additionally requests the school domain', () => {
    const plan = planKnowledgeResolution(intent('COMPLIANCE_CHECK'))
    expect(plan.steps).toContainEqual({ domain: 'school', method: 'RESOLVE' })
    expect(plan.steps).toHaveLength(3)
  })

  it('intents with no additional domain need get exactly the 2-step baseline', () => {
    const noAdditionalIntents: IntentType[] = [
      'GENERAL', 'DEFINITION_LOOKUP', 'THRESHOLD_CHECK', 'METHOD_SELECTION',
      'ADVANCE_PAYMENT_RULE', 'GUARANTEE_RULE', 'BEST_PRACTICE', 'RISK_ASSESSMENT',
    ]
    for (const intentType of noAdditionalIntents) {
      expect(planKnowledgeResolution(intent(intentType)).steps, intentType).toHaveLength(2)
    }
  })

  it('every planned step uses RESOLVE (this milestone\'s default strategy table has no SEARCH step)', () => {
    for (const intentType of ['GENERAL', 'AUTHORITY_CHECK', 'COMPLIANCE_CHECK'] as const) {
      const plan = planKnowledgeResolution(intent(intentType))
      expect(plan.steps.every(s => s.method === 'RESOLVE')).toBe(true)
    }
  })

  it('is a pure function: identical intent produces an identical plan', () => {
    const i = intent('AUTHORITY_CHECK')
    expect(planKnowledgeResolution(i)).toEqual(planKnowledgeResolution(i))
  })
})
