import { describe, it, expect } from 'vitest'
import { evaluateApplicability } from '../reasoning/application/knowledgeApplicabilityEvaluator.ts'
import type { KnowledgeItemRef } from '../reasoning/domain/reasoningTypes.ts'

function item(): KnowledgeItemRef {
  return {
    itemId: 'item-1', domain: 'legal', type: 'LAW', title: 't', summary: 's', confidence: 0.9,
    layer: 1, legalBasis: [], metadata: {}, effectiveFrom: '2025-01-01',
  }
}

describe('evaluateApplicability', () => {
  it('is MISSING_EVIDENCE when metadata parsing failed, regardless of effectivePeriod status', () => {
    const result = evaluateApplicability(item(), { itemId: 'item-1', status: 'CURRENT' }, true)
    expect(result.status).toBe('MISSING_EVIDENCE')
  })

  it('is NOT_YET_EFFECTIVE when effectivePeriod says so and metadata parsing did not fail', () => {
    const result = evaluateApplicability(item(), { itemId: 'item-1', status: 'NOT_YET_EFFECTIVE' }, false)
    expect(result.status).toBe('NOT_YET_EFFECTIVE')
  })

  it('is EXPIRED when effectivePeriod says so and metadata parsing did not fail', () => {
    const result = evaluateApplicability(item(), { itemId: 'item-1', status: 'EXPIRED' }, false)
    expect(result.status).toBe('EXPIRED')
  })

  it('is APPLICABLE when effectivePeriod is CURRENT and metadata parsing did not fail', () => {
    const result = evaluateApplicability(item(), { itemId: 'item-1', status: 'CURRENT' }, false)
    expect(result.status).toBe('APPLICABLE')
  })
})
