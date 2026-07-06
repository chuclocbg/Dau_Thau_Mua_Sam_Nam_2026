import { describe, it, expect } from 'vitest'
import {
  documentAuthorityScore, domainPriorityScore, freshnessScore, legalHierarchyScore,
  relevanceScore, scoreItem,
} from '../reasoning/application/rankingStrategy.ts'
import type { KnowledgeItemRef } from '../reasoning/domain/reasoningTypes.ts'
import type { RankingWeights } from '../reasoning/domain/knowledgeRankingTypes.ts'

function item(overrides: Partial<KnowledgeItemRef> = {}): KnowledgeItemRef {
  return {
    itemId: 'item-1', domain: 'legal', type: 'LAW', title: 't', summary: 's', confidence: 0.8,
    layer: 1, legalBasis: [], metadata: {}, effectiveFrom: '2025-01-01', ...overrides,
  }
}

describe('domainPriorityScore', () => {
  it('ranks legal above school above procurement', () => {
    expect(domainPriorityScore(item({ domain: 'legal' })))
      .toBeGreaterThan(domainPriorityScore(item({ domain: 'school' })))
    expect(domainPriorityScore(item({ domain: 'school' })))
      .toBeGreaterThan(domainPriorityScore(item({ domain: 'procurement' })))
  })

  it('falls back to a neutral default for an unlisted domain', () => {
    expect(domainPriorityScore(item({ domain: 'audit' }))).toBe(0.5)
  })
})

describe('legalHierarchyScore', () => {
  it('ranks LAW above DECREE above CIRCULAR above INTERNAL_REGULATION', () => {
    const law = legalHierarchyScore(item({ type: 'LAW' }))
    const decree = legalHierarchyScore(item({ type: 'DECREE' }))
    const circular = legalHierarchyScore(item({ type: 'CIRCULAR' }))
    const internal = legalHierarchyScore(item({ type: 'INTERNAL_REGULATION' }))
    expect(law).toBeGreaterThan(decree)
    expect(decree).toBeGreaterThan(circular)
    expect(circular).toBeGreaterThan(internal)
  })

  it('ranks CONSTITUTION as the highest possible score', () => {
    expect(legalHierarchyScore(item({ type: 'CONSTITUTION' }))).toBe(1)
  })

  it('never goes negative for an unknown type', () => {
    expect(legalHierarchyScore(item({ type: 'SOMETHING_UNKNOWN' }))).toBeGreaterThanOrEqual(0)
  })
})

describe('relevanceScore', () => {
  it('uses confidence directly, since no independent relevance field exists on KnowledgeItemRef', () => {
    expect(relevanceScore(item({ confidence: 0.42 }))).toBe(0.42)
  })
})

describe('freshnessScore', () => {
  it('scores an item effective exactly on asOfDate at the maximum (1.0)', () => {
    expect(freshnessScore(item({ effectiveFrom: '2026-07-06' }), '2026-07-06')).toBe(1)
  })

  it('scores a more recent item higher than an older one, relative to the same asOfDate', () => {
    const recent = freshnessScore(item({ effectiveFrom: '2026-01-01' }), '2026-07-06')
    const old = freshnessScore(item({ effectiveFrom: '2020-01-01' }), '2026-07-06')
    expect(recent).toBeGreaterThan(old)
  })

  it('never goes negative or produces NaN for an item effective after asOfDate', () => {
    const score = freshnessScore(item({ effectiveFrom: '2027-01-01' }), '2026-07-06')
    expect(score).toBeGreaterThanOrEqual(0)
    expect(Number.isNaN(score)).toBe(false)
  })
})

describe('documentAuthorityScore', () => {
  it('ranks layer 1 (national law) above layer 4 (experience-only)', () => {
    expect(documentAuthorityScore(item({ layer: 1 }))).toBeGreaterThan(documentAuthorityScore(item({ layer: 4 })))
  })

  it('is monotonically decreasing from layer 1 to layer 4', () => {
    const scores = [1, 2, 3, 4].map(layer => documentAuthorityScore(item({ layer: layer as 1 | 2 | 3 | 4 })))
    expect(scores[0]).toBeGreaterThan(scores[1]!)
    expect(scores[1]).toBeGreaterThan(scores[2]!)
    expect(scores[2]).toBeGreaterThan(scores[3]!)
  })
})

describe('scoreItem — composite scoring', () => {
  it('is a deterministic weighted sum of all five criteria', () => {
    const weights: RankingWeights = { domainPriority: 0.2, legalHierarchy: 0.2, relevance: 0.2, freshness: 0.2, documentAuthority: 0.2 }
    const testItem = item()
    const expected = weights.domainPriority * domainPriorityScore(testItem)
      + weights.legalHierarchy * legalHierarchyScore(testItem)
      + weights.relevance * relevanceScore(testItem)
      + weights.freshness * freshnessScore(testItem, '2026-07-06')
      + weights.documentAuthority * documentAuthorityScore(testItem)

    expect(scoreItem(testItem, weights, '2026-07-06')).toBeCloseTo(expected, 10)
  })

  it('a zero-weighted criterion has no effect on the composite score', () => {
    const zeroFreshness: RankingWeights = { domainPriority: 0.25, legalHierarchy: 0.25, relevance: 0.25, freshness: 0, documentAuthority: 0.25 }
    const veryOld = item({ effectiveFrom: '1990-01-01' })
    const veryNew = item({ effectiveFrom: '2026-07-06' })
    expect(scoreItem(veryOld, zeroFreshness, '2026-07-06')).toBe(scoreItem(veryNew, zeroFreshness, '2026-07-06'))
  })
})
