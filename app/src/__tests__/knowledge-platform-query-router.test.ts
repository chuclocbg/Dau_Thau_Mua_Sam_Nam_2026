import { describe, it, expect, beforeEach } from 'vitest'
import { createProviderRegistry } from '../knowledge/platform/providerRegistry.ts'
import type { IProviderRegistry } from '../knowledge/platform/providerRegistry.ts'
import { QueryRouter } from '../knowledge/platform/queryRouter.ts'
import type { IKnowledgeProvider, KnowledgeQuery, KnowledgeResult, KnowledgeItem, KnowledgeContext, KnowledgeSuggestion } from '../knowledge/platform/knowledgeTypes.ts'

function makeItem(id: string, domain: string, provider: string): KnowledgeItem {
  return {
    id, domain, provider, type: 'TEST', title: `Item ${id}`, summary: 'S',
    keywords: [], legalBasis: [], relatedItems: [], metadata: {},
    confidence: 0.5, attachments: [], layer: 2, language: 'vi', isActive: true,
    version: '1', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  }
}

class FixedResultProvider implements IKnowledgeProvider {
  constructor(
    readonly domain: string,
    private readonly results: readonly KnowledgeResult[],
    readonly layer: 1 | 2 | 3 | 4 = 2,
    readonly version = '1.0.0',
  ) {}
  async search(_query: KnowledgeQuery): Promise<readonly KnowledgeResult[]> { return this.results }
  async resolve(_itemId: string) { return null }
  async suggest(_context: KnowledgeContext): Promise<readonly KnowledgeSuggestion[]> { return [] }
  async score(_itemId: string, _context: KnowledgeContext): Promise<number> { return 0 }
}

let registry: IProviderRegistry
let router: QueryRouter

beforeEach(() => {
  registry = createProviderRegistry()
  router = new QueryRouter(registry)
})

describe('route — single domain', () => {
  it('returns results only from the requested domain', async () => {
    const item = makeItem('l1', 'legal', 'LegalProvider')
    registry.register(new FixedResultProvider('legal', [{ item, relevance: 0.9, matchedDomain: 'legal' }]))
    registry.register(new FixedResultProvider('risk', [{ item: makeItem('r1', 'risk', 'RiskProvider'), relevance: 0.8, matchedDomain: 'risk' }]))

    const results = await router.route({ text: 'test', domains: ['legal'] })
    expect(results).toHaveLength(1)
    expect(results[0].matchedDomain).toBe('legal')
  })
})

describe('route — no domains specified searches every registered provider', () => {
  it('merges results across all registered domains', async () => {
    registry.register(new FixedResultProvider('legal', [{ item: makeItem('l1', 'legal', 'LegalProvider'), relevance: 0.9, matchedDomain: 'legal' }]))
    registry.register(new FixedResultProvider('risk', [{ item: makeItem('r1', 'risk', 'RiskProvider'), relevance: 0.8, matchedDomain: 'risk' }]))

    const results = await router.route({ text: 'test' })
    expect(results).toHaveLength(2)
  })

  it('returns empty array when nothing is registered', async () => {
    expect(await router.route({ text: 'test' })).toEqual([])
  })
})

describe('route — an unresolvable domain in the filter list is silently skipped', () => {
  it('does not throw for a domain with no registered provider', async () => {
    registry.register(new FixedResultProvider('legal', [{ item: makeItem('l1', 'legal', 'LegalProvider'), relevance: 0.9, matchedDomain: 'legal' }]))
    const results = await router.route({ text: 'test', domains: ['legal', 'nonexistent'] })
    expect(results).toHaveLength(1)
  })
})

describe('route — ranking and limit', () => {
  it('sorts merged results by relevance descending', async () => {
    registry.register(new FixedResultProvider('legal', [{ item: makeItem('l1', 'legal', 'LegalProvider'), relevance: 0.3, matchedDomain: 'legal' }]))
    registry.register(new FixedResultProvider('risk', [{ item: makeItem('r1', 'risk', 'RiskProvider'), relevance: 0.9, matchedDomain: 'risk' }]))

    const results = await router.route({ text: 'test' })
    expect(results[0].matchedDomain).toBe('risk')
    expect(results[1].matchedDomain).toBe('legal')
  })

  it('respects the limit parameter', async () => {
    registry.register(new FixedResultProvider('legal', [
      { item: makeItem('l1', 'legal', 'LegalProvider'), relevance: 0.9, matchedDomain: 'legal' },
      { item: makeItem('l2', 'legal', 'LegalProvider'), relevance: 0.8, matchedDomain: 'legal' },
    ]))
    const results = await router.route({ text: 'test', limit: 1 })
    expect(results).toHaveLength(1)
  })
})

describe('a brand-new domain works through the router with zero router changes (Rule 2, Rule 3)', () => {
  it('routes to a provider registered under a novel domain key', async () => {
    const item = makeItem('n1', 'a-domain-invented-just-now', 'NovelProvider')
    registry.register(new FixedResultProvider('a-domain-invented-just-now', [{ item, relevance: 1, matchedDomain: 'a-domain-invented-just-now' }]))
    const results = await router.route({ text: 'x' })
    expect(results).toHaveLength(1)
  })
})
