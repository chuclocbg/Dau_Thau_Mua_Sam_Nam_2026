import { describe, it, expect } from 'vitest'
import { rankItems, selectCandidates } from '../reasoning/application/candidateSelector.ts'
import type { KnowledgeItemRef } from '../reasoning/domain/reasoningTypes.ts'
import type { RankingWeights } from '../reasoning/domain/knowledgeRankingTypes.ts'

const EQUAL_WEIGHTS: RankingWeights = { domainPriority: 0.2, legalHierarchy: 0.2, relevance: 0.2, freshness: 0.2, documentAuthority: 0.2 }
const ASOF = '2026-07-06'

function item(itemId: string, overrides: Partial<KnowledgeItemRef> = {}): KnowledgeItemRef {
  return {
    itemId, domain: 'legal', type: 'LAW', title: itemId, summary: 's', confidence: 0.8,
    layer: 1, legalBasis: [], metadata: {}, effectiveFrom: '2025-01-01', ...overrides,
  }
}

describe('rankItems — deterministic ordering', () => {
  it('sorts strictly by descending score', () => {
    const high = item('high', { type: 'LAW' })
    const low = item('low', { type: 'INTERNAL_REGULATION' })
    const ranked = rankItems([low, high], EQUAL_WEIGHTS, ASOF)
    expect(ranked.map(r => r.item.itemId)).toEqual(['high', 'low'])
  })

  it('produces the exact same order across repeated calls with identical input (determinism)', () => {
    const items = [item('c'), item('a', { type: 'DECREE' }), item('b', { type: 'CIRCULAR' })]
    const first = rankItems(items, EQUAL_WEIGHTS, ASOF).map(r => r.item.itemId)
    const second = rankItems(items, EQUAL_WEIGHTS, ASOF).map(r => r.item.itemId)
    expect(first).toEqual(second)
  })

  it('never reorders based on input array position alone — score is what matters', () => {
    const items = [item('z', { type: 'LAW' }), item('a', { type: 'INTERNAL_REGULATION' })]
    const ranked = rankItems(items, EQUAL_WEIGHTS, ASOF)
    expect(ranked[0]!.item.itemId).toBe('z')
  })
})

describe('rankItems — tie-break', () => {
  it('breaks an exact score tie by itemId ascending (never left in input order, never random)', () => {
    const tiedA = item('b-item')
    const tiedB = item('a-item')
    const ranked = rankItems([tiedA, tiedB], EQUAL_WEIGHTS, ASOF)
    expect(ranked[0]!.score).toBe(ranked[1]!.score)
    expect(ranked.map(r => r.item.itemId)).toEqual(['a-item', 'b-item'])
  })

  it('tie-break ordering is stable regardless of input array order', () => {
    const tiedA = item('b-item')
    const tiedB = item('a-item')
    const orderedOneWay = rankItems([tiedA, tiedB], EQUAL_WEIGHTS, ASOF).map(r => r.item.itemId)
    const orderedOtherWay = rankItems([tiedB, tiedA], EQUAL_WEIGHTS, ASOF).map(r => r.item.itemId)
    expect(orderedOneWay).toEqual(orderedOtherWay)
  })

  it('three-way tie is fully resolved by itemId ascending', () => {
    const items = [item('charlie'), item('alpha'), item('bravo')]
    const ranked = rankItems(items, EQUAL_WEIGHTS, ASOF)
    expect(ranked.map(r => r.item.itemId)).toEqual(['alpha', 'bravo', 'charlie'])
  })
})

describe('selectCandidates — trimming', () => {
  it('returns all items when maxCandidates exceeds the input size', () => {
    const items = [item('a'), item('b')]
    expect(selectCandidates(items, EQUAL_WEIGHTS, ASOF, 10)).toHaveLength(2)
  })

  it('trims to exactly maxCandidates, keeping the highest-scored ones', () => {
    const items = [item('low', { type: 'INTERNAL_REGULATION' }), item('high', { type: 'LAW' }), item('mid', { type: 'DECREE' })]
    const selected = selectCandidates(items, EQUAL_WEIGHTS, ASOF, 2)
    expect(selected.map(i => i.itemId)).toEqual(['high', 'mid'])
  })

  it('returns an empty array for an empty input, never throws', () => {
    expect(selectCandidates([], EQUAL_WEIGHTS, ASOF, 5)).toEqual([])
  })

  it('never fabricates or duplicates an item — every selected item is one of the originals by reference', () => {
    const items = [item('a'), item('b')]
    const selected = selectCandidates(items, EQUAL_WEIGHTS, ASOF, 1)
    expect(items).toContain(selected[0])
  })
})
