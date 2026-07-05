import { describe, it, expect } from 'vitest'
import { ResultRanker } from '../knowledge/search/resultRanker.ts'
import type { KnowledgeItem, KnowledgeResult } from '../knowledge/platform/knowledgeTypes.ts'

function makeResult(id: string, relevance: number, confidence = 0.5): KnowledgeResult {
  const item: KnowledgeItem = {
    id, domain: 'legal', provider: 'LegalProvider', type: 'LAW', title: id, summary: '',
    keywords: [], legalBasis: [], relatedItems: [], metadata: {}, confidence, attachments: [],
    layer: 1, language: 'vi', isActive: true, version: '1',
    createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  }
  return { item, relevance, matchedDomain: 'legal' }
}

describe('ResultRanker.rank', () => {
  it('sorts by relevance descending', () => {
    const ranker = new ResultRanker()
    const ranked = ranker.rank([makeResult('low', 0.2), makeResult('high', 0.9), makeResult('mid', 0.5)])
    expect(ranked.map(r => r.item.id)).toEqual(['high', 'mid', 'low'])
  })

  it('breaks ties using item confidence', () => {
    const ranker = new ResultRanker()
    const ranked = ranker.rank([
      makeResult('less-confident', 0.5, 0.3),
      makeResult('more-confident', 0.5, 0.9),
    ])
    expect(ranked[0].item.id).toBe('more-confident')
  })

  it('applies the limit after sorting', () => {
    const ranker = new ResultRanker()
    const ranked = ranker.rank([makeResult('a', 0.9), makeResult('b', 0.5), makeResult('c', 0.1)], 2)
    expect(ranked).toHaveLength(2)
    expect(ranked.map(r => r.item.id)).toEqual(['a', 'b'])
  })

  it('returns everything when no limit is given', () => {
    const ranker = new ResultRanker()
    expect(ranker.rank([makeResult('a', 0.1), makeResult('b', 0.2)])).toHaveLength(2)
  })

  it('does not mutate the input array', () => {
    const ranker = new ResultRanker()
    const input = [makeResult('a', 0.1), makeResult('b', 0.9)]
    const original = [...input]
    ranker.rank(input)
    expect(input).toEqual(original)
  })

  it('handles an empty result set', () => {
    expect(new ResultRanker().rank([])).toEqual([])
  })
})
