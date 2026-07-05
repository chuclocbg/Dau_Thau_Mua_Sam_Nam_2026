import { describe, it, expect, beforeEach } from 'vitest'
import { Resolver } from '../knowledge/application/resolver.ts'
import { buildMemoryKnowledgeRepositories } from '../knowledge/repositories/memoryKnowledgeRepositories.ts'
import { KnowledgeGraphService } from '../knowledge/graph/knowledgeGraph.ts'
import type { KnowledgeRepositories } from '../knowledge/repositories/knowledgeRepositories.ts'
import type { IKnowledgeGraph } from '../knowledge/graph/knowledgeGraph.ts'
import type { KnowledgeItem } from '../knowledge/platform/knowledgeTypes.ts'

function itemInput(overrides: Partial<KnowledgeItem> = {}): Omit<KnowledgeItem, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    domain: 'legal', provider: 'LegalProvider', type: 'LAW', title: 'T', summary: 'S',
    keywords: [], legalBasis: [], relatedItems: [], metadata: {}, confidence: 1,
    attachments: [], layer: 1, language: 'vi', isActive: true, version: '1',
    ...overrides,
  }
}

let repos: KnowledgeRepositories
let graph: IKnowledgeGraph
let resolver: Resolver

beforeEach(() => {
  repos = buildMemoryKnowledgeRepositories()
  graph = new KnowledgeGraphService(repos.relations)
  resolver = new Resolver(repos, graph)
})

describe('resolve', () => {
  it('resolves an existing item by id', async () => {
    const item = await repos.items.create(itemInput())
    expect((await resolver.resolve(item.id))?.id).toBe(item.id)
  })

  it('returns null for an unknown id', async () => {
    expect(await resolver.resolve('missing')).toBeNull()
  })
})

describe('resolveWithRelated', () => {
  it('returns null when the item does not exist', async () => {
    expect(await resolver.resolveWithRelated('missing')).toBeNull()
  })

  it('returns an empty related array for an item with no graph edges', async () => {
    const item = await repos.items.create(itemInput())
    const resolved = await resolver.resolveWithRelated(item.id)
    expect(resolved?.item.id).toBe(item.id)
    expect(resolved?.related).toEqual([])
  })

  it('resolves items connected by outgoing graph edges', async () => {
    const base = await repos.items.create(itemInput({ title: 'Base' }))
    const related = await repos.items.create(itemInput({ title: 'Related' }))
    await graph.addEdge(base.id, related.id, 'REFERENCES')

    const resolved = await resolver.resolveWithRelated(base.id)
    expect(resolved?.related).toHaveLength(1)
    expect(resolved?.related[0].id).toBe(related.id)
  })

  it('does not resolve incoming-only edges as related', async () => {
    const base = await repos.items.create(itemInput())
    const other = await repos.items.create(itemInput())
    await graph.addEdge(other.id, base.id, 'REFERENCES') // other -> base, not base -> other

    const resolved = await resolver.resolveWithRelated(base.id)
    expect(resolved?.related).toEqual([])
  })

  it('skips a related edge pointing to a deleted item', async () => {
    const base = await repos.items.create(itemInput())
    const related = await repos.items.create(itemInput())
    await graph.addEdge(base.id, related.id, 'REFERENCES')
    await repos.items.delete(related.id)

    const resolved = await resolver.resolveWithRelated(base.id)
    expect(resolved?.related).toEqual([])
  })
})
