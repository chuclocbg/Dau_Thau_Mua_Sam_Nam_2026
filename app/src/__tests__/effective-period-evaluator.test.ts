import { describe, it, expect } from 'vitest'
import { evaluateEffectivePeriod } from '../reasoning/application/effectivePeriodEvaluator.ts'
import type { KnowledgeItemRef } from '../reasoning/domain/reasoningTypes.ts'

function item(overrides: Partial<KnowledgeItemRef> = {}): KnowledgeItemRef {
  return {
    itemId: 'item-1', domain: 'legal', type: 'LAW', title: 't', summary: 's', confidence: 0.9,
    layer: 1, legalBasis: [], metadata: {}, effectiveFrom: '2025-01-01', ...overrides,
  }
}

describe('evaluateEffectivePeriod', () => {
  it('is CURRENT when asOfDate is within [effectiveFrom, effectiveTo]', () => {
    const result = evaluateEffectivePeriod(item({ effectiveFrom: '2025-01-01', effectiveTo: '2026-12-31' }), '2026-07-06')
    expect(result).toEqual({ itemId: 'item-1', status: 'CURRENT' })
  })

  it('is CURRENT when effectiveTo is absent and asOfDate is on/after effectiveFrom', () => {
    const result = evaluateEffectivePeriod(item({ effectiveFrom: '2025-01-01' }), '2026-07-06')
    expect(result.status).toBe('CURRENT')
  })

  it('is NOT_YET_EFFECTIVE when asOfDate precedes effectiveFrom', () => {
    const result = evaluateEffectivePeriod(item({ effectiveFrom: '2027-01-01' }), '2026-07-06')
    expect(result.status).toBe('NOT_YET_EFFECTIVE')
  })

  it('is EXPIRED when asOfDate is after effectiveTo', () => {
    const result = evaluateEffectivePeriod(item({ effectiveFrom: '2020-01-01', effectiveTo: '2025-01-01' }), '2026-07-06')
    expect(result.status).toBe('EXPIRED')
  })

  it('never excludes the item — always returns a classification, never null/undefined', () => {
    const result = evaluateEffectivePeriod(item({ effectiveFrom: '2027-01-01' }), '2026-07-06')
    expect(result.itemId).toBe('item-1')
    expect(result.status).toBeDefined()
  })
})
