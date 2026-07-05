import { describe, it, expect, beforeEach } from 'vitest'
import { OntologyProvider } from '../knowledge/providers/ontology/ontologyProvider.ts'
import { buildMemoryKnowledgeRepositories } from '../knowledge/repositories/memoryKnowledgeRepositories.ts'
import { KnowledgeGraphService } from '../knowledge/graph/knowledgeGraph.ts'
import type { KnowledgeRepositories } from '../knowledge/repositories/knowledgeRepositories.ts'
import type { IKnowledgeGraph } from '../knowledge/graph/knowledgeGraph.ts'
import type { KnowledgeItem } from '../knowledge/platform/knowledgeTypes.ts'

function conceptItemInput(overrides: Partial<KnowledgeItem> = {}): Omit<KnowledgeItem, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    domain: 'ontology', provider: 'OntologyProvider', type: 'CONCEPT', title: 'Đấu thầu',
    summary: 'Khái niệm đấu thầu', keywords: ['đấu thầu'], legalBasis: [], relatedItems: [],
    metadata: {}, confidence: 1.0, attachments: [], layer: 2, language: 'vi', isActive: true, version: '1',
    ...overrides,
  }
}

let repos: KnowledgeRepositories
let graph: IKnowledgeGraph
let provider: OntologyProvider

beforeEach(() => {
  repos = buildMemoryKnowledgeRepositories()
  graph = new KnowledgeGraphService(repos.relations)
  provider = new OntologyProvider(repos, graph)
})

describe('identity', () => {
  it('reports domain=ontology, layer=2', () => {
    expect(provider.domain).toBe('ontology')
    expect(provider.layer).toBe(2)
  })
})

describe('search / resolve / suggest / score contract', () => {
  it('search finds a concept by keyword', async () => {
    await repos.items.create(conceptItemInput())
    expect(await provider.search({ text: 'đấu thầu' })).toHaveLength(1)
  })

  it('resolve refuses items from another domain', async () => {
    const item = await repos.items.create(conceptItemInput({ domain: 'glossary' }))
    expect(await provider.resolve(item.id)).toBeNull()
  })

  it('suggest uses an ontology-specific reason', async () => {
    await repos.items.create(conceptItemInput())
    const suggestions = await provider.suggest({})
    expect(suggestions[0].reason).toContain('terminology concept')
  })
})

describe('synonym linkage (SIMILAR_TO)', () => {
  it('links and retrieves a synonym', async () => {
    const a = await repos.items.create(conceptItemInput({ title: 'Mua sắm công' }))
    const b = await repos.items.create(conceptItemInput({ title: 'Đấu thầu công' }))
    await provider.linkSynonym(a.id, b.id)
    expect(await provider.getSynonyms(a.id)).toEqual([b.id])
  })
})

describe('broader/narrower concept hierarchy — a brand-new relation type (BROADER_THAN)', () => {
  it('links a narrower concept to a broader one', async () => {
    const procurement = await repos.items.create(conceptItemInput({ title: 'Đấu thầu' }))
    const openTender = await repos.items.create(conceptItemInput({ title: 'Đấu thầu rộng rãi' }))
    await provider.linkBroaderConcept(openTender.id, procurement.id)
    expect(await provider.getBroaderConcepts(openTender.id)).toEqual([procurement.id])
  })

  it('finds narrower concepts via the incoming edge', async () => {
    const procurement = await repos.items.create(conceptItemInput({ title: 'Đấu thầu' }))
    const openTender = await repos.items.create(conceptItemInput({ title: 'Đấu thầu rộng rãi' }))
    const limitedTender = await repos.items.create(conceptItemInput({ title: 'Đấu thầu hạn chế' }))
    await provider.linkBroaderConcept(openTender.id, procurement.id)
    await provider.linkBroaderConcept(limitedTender.id, procurement.id)
    const narrower = await provider.getNarrowerConcepts(procurement.id)
    expect(narrower.sort()).toEqual([limitedTender.id, openTender.id].sort())
  })

  it('a concept with no hierarchy links returns empty on both sides', async () => {
    const item = await repos.items.create(conceptItemInput())
    expect(await provider.getBroaderConcepts(item.id)).toEqual([])
    expect(await provider.getNarrowerConcepts(item.id)).toEqual([])
  })

  it('BROADER_THAN and SIMILAR_TO coexist independently on the same graph', async () => {
    const procurement = await repos.items.create(conceptItemInput({ title: 'Đấu thầu' }))
    const openTender = await repos.items.create(conceptItemInput({ title: 'Đấu thầu rộng rãi' }))
    const synonym = await repos.items.create(conceptItemInput({ title: 'Mua sắm cạnh tranh' }))
    await provider.linkBroaderConcept(openTender.id, procurement.id)
    await provider.linkSynonym(openTender.id, synonym.id)
    expect(await provider.getBroaderConcepts(openTender.id)).toEqual([procurement.id])
    expect(await provider.getSynonyms(openTender.id)).toEqual([synonym.id])
  })
})
