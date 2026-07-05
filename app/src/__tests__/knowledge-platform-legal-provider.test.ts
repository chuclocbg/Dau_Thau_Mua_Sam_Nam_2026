import { describe, it, expect, beforeEach } from 'vitest'
import { LegalProvider } from '../knowledge/providers/legal/legalProvider.ts'
import { buildMemoryKnowledgeRepositories } from '../knowledge/repositories/memoryKnowledgeRepositories.ts'
import { KnowledgeGraphService } from '../knowledge/graph/knowledgeGraph.ts'
import type { KnowledgeRepositories } from '../knowledge/repositories/knowledgeRepositories.ts'
import type { IKnowledgeGraph } from '../knowledge/graph/knowledgeGraph.ts'
import type { KnowledgeItem } from '../knowledge/platform/knowledgeTypes.ts'

function legalItemInput(overrides: Partial<KnowledgeItem> = {}): Omit<KnowledgeItem, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    domain: 'legal', provider: 'LegalProvider', type: 'LAW', title: 'Luật Đấu thầu',
    summary: 'Quy định về đấu thầu', keywords: ['đấu thầu'], legalBasis: [], relatedItems: [],
    metadata: {}, confidence: 1.0, attachments: [], layer: 1, language: 'vi', isActive: true, version: '1',
    ...overrides,
  }
}

let repos: KnowledgeRepositories
let graph: IKnowledgeGraph
let provider: LegalProvider

beforeEach(() => {
  repos = buildMemoryKnowledgeRepositories()
  graph = new KnowledgeGraphService(repos.relations)
  provider = new LegalProvider(repos, graph)
})

describe('identity', () => {
  it('reports domain=legal, layer=1', () => {
    expect(provider.domain).toBe('legal')
    expect(provider.layer).toBe(1)
    expect(provider.version).toBeTruthy()
  })
})

describe('search', () => {
  it('finds an item by keyword', async () => {
    await repos.items.create(legalItemInput())
    const results = await provider.search({ text: 'đấu thầu' })
    expect(results).toHaveLength(1)
    expect(results[0].matchedDomain).toBe('legal')
  })

  it('never returns items from another domain', async () => {
    await repos.items.create(legalItemInput({ domain: 'risk', title: 'đấu thầu risk pattern' }))
    const results = await provider.search({ text: 'đấu thầu' })
    expect(results).toEqual([])
  })

  it('excludes inactive items', async () => {
    await repos.items.create(legalItemInput({ isActive: false }))
    expect(await provider.search({ text: 'đấu thầu' })).toEqual([])
  })
})

describe('resolve', () => {
  it('resolves an item it owns', async () => {
    const item = await repos.items.create(legalItemInput())
    expect((await provider.resolve(item.id))?.id).toBe(item.id)
  })

  it('refuses to resolve an item from a different domain', async () => {
    const item = await repos.items.create(legalItemInput({ domain: 'risk' }))
    expect(await provider.resolve(item.id)).toBeNull()
  })

  it('returns null for an unknown id', async () => {
    expect(await provider.resolve('missing')).toBeNull()
  })
})

describe('suggest', () => {
  it('suggests applicable items with a legal-basis reason', async () => {
    await repos.items.create(legalItemInput())
    const suggestions = await provider.suggest({ packageType: 'GOODS' })
    expect(suggestions).toHaveLength(1)
    expect(suggestions[0].reason).toContain('legal basis')
    expect(suggestions[0].reason).toContain('GOODS')
  })

  it('respects applicability rules', async () => {
    const item = await repos.items.create(legalItemInput())
    await repos.applicability.create({ itemId: item.id, isActive: true, effectiveFrom: '2020-01-01', packageTypes: ['CONSTRUCTION'] })
    expect(await provider.suggest({ packageType: 'GOODS' })).toEqual([])
  })
})

describe('score', () => {
  it('scores an applicable item at its confidence', async () => {
    const item = await repos.items.create(legalItemInput({ confidence: 0.85 }))
    expect(await provider.score(item.id, {})).toBe(0.85)
  })

  it('scores a non-applicable item lower', async () => {
    const item = await repos.items.create(legalItemInput({ confidence: 0.9 }))
    await repos.applicability.create({ itemId: item.id, isActive: true, effectiveFrom: '2020-01-01', packageTypes: ['CONSTRUCTION'] })
    expect(await provider.score(item.id, { packageType: 'GOODS' })).toBeCloseTo(0.27, 5)
  })

  it('scores an item from another domain as 0', async () => {
    const item = await repos.items.create(legalItemInput({ domain: 'risk' }))
    expect(await provider.score(item.id, {})).toBe(0)
  })
})

describe('citation graph', () => {
  it('records and retrieves a citation', async () => {
    const decree = await repos.items.create(legalItemInput({ title: 'Nghị định' }))
    const law = await repos.items.create(legalItemInput({ title: 'Luật' }))
    await provider.recordCitation(decree.id, law.id)
    expect(await provider.getCitations(decree.id)).toEqual([law.id])
  })

  it('returns empty for an item with no citations', async () => {
    const item = await repos.items.create(legalItemInput())
    expect(await provider.getCitations(item.id)).toEqual([])
  })
})

describe('amendment chain', () => {
  it('returns just the item itself when never amended', async () => {
    const item = await repos.items.create(legalItemInput())
    expect(await provider.getAmendmentChain(item.id)).toEqual([item.id])
  })

  it('walks a single amendment', async () => {
    const original = await repos.items.create(legalItemInput({ title: 'Original' }))
    const amendment = await repos.items.create(legalItemInput({ title: 'Amendment' }))
    await provider.recordAmendment(amendment.id, original.id)
    expect(await provider.getAmendmentChain(original.id)).toEqual([original.id, amendment.id])
  })

  it('walks a multi-step amendment chain in order', async () => {
    const v1 = await repos.items.create(legalItemInput({ title: 'V1' }))
    const v2 = await repos.items.create(legalItemInput({ title: 'V2' }))
    const v3 = await repos.items.create(legalItemInput({ title: 'V3' }))
    await provider.recordAmendment(v2.id, v1.id)
    await provider.recordAmendment(v3.id, v2.id)
    expect(await provider.getAmendmentChain(v1.id)).toEqual([v1.id, v2.id, v3.id])
  })

  it('does not infinite-loop on a cyclical amendment (defensive)', async () => {
    const a = await repos.items.create(legalItemInput({ title: 'A' }))
    const b = await repos.items.create(legalItemInput({ title: 'B' }))
    await provider.recordAmendment(b.id, a.id)
    await provider.recordAmendment(a.id, b.id) // cycle
    const chain = await provider.getAmendmentChain(a.id)
    expect(chain.length).toBeLessThanOrEqual(2)
  })
})
