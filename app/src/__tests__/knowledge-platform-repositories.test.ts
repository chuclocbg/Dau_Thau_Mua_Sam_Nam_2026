import { describe, it, expect, beforeEach } from 'vitest'
import { buildMemoryKnowledgeRepositories } from '../knowledge/repositories/memoryKnowledgeRepositories.ts'
import type { KnowledgeRepositories } from '../knowledge/repositories/knowledgeRepositories.ts'
import type { KnowledgeItem, KnowledgeApplicabilityRule } from '../knowledge/platform/knowledgeTypes.ts'

let repos: KnowledgeRepositories

function itemInput(overrides: Partial<KnowledgeItem> = {}): Omit<KnowledgeItem, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    domain: 'legal', provider: 'LegalProvider', type: 'LAW', title: 'T', summary: 'S',
    keywords: [], legalBasis: [], relatedItems: [], metadata: {}, confidence: 1,
    attachments: [], layer: 1, language: 'vi', isActive: true, version: '1',
    ...overrides,
  }
}

beforeEach(() => {
  repos = buildMemoryKnowledgeRepositories()
})

describe('IKnowledgeItemRepository', () => {
  it('create/findById round-trip', async () => {
    const item = await repos.items.create(itemInput())
    expect((await repos.items.findById(item.id))?.id).toBe(item.id)
  })

  it('findByDomain filters correctly', async () => {
    await repos.items.create(itemInput({ domain: 'legal' }))
    await repos.items.create(itemInput({ domain: 'risk' }))
    expect(await repos.items.findByDomain('legal')).toHaveLength(1)
  })

  it('findActive excludes inactive items', async () => {
    const item = await repos.items.create(itemInput({ isActive: true }))
    await repos.items.update(item.id, { isActive: false })
    expect(await repos.items.findActive()).toHaveLength(0)
  })

  it('findActive can additionally filter by domain', async () => {
    await repos.items.create(itemInput({ domain: 'legal', isActive: true }))
    await repos.items.create(itemInput({ domain: 'risk', isActive: true }))
    expect(await repos.items.findActive('legal')).toHaveLength(1)
  })

  it('findByType filters correctly', async () => {
    await repos.items.create(itemInput({ type: 'LAW' }))
    await repos.items.create(itemInput({ type: 'TEMPLATE' }))
    expect(await repos.items.findByType('TEMPLATE')).toHaveLength(1)
  })

  it('update preserves id and createdAt', async () => {
    const item = await repos.items.create(itemInput())
    const updated = await repos.items.update(item.id, { title: 'New Title' })
    expect(updated.id).toBe(item.id)
    expect(updated.createdAt).toBe(item.createdAt)
    expect(updated.title).toBe('New Title')
  })

  it('delete removes the item', async () => {
    const item = await repos.items.create(itemInput())
    await repos.items.delete(item.id)
    expect(await repos.items.findById(item.id)).toBeNull()
  })

  it('count reflects the number of created items', async () => {
    await repos.items.create(itemInput())
    await repos.items.create(itemInput())
    expect(await repos.items.count()).toBe(2)
  })
})

describe('IKnowledgeRelationRepository', () => {
  it('create/findByFromItem/findByToItem round-trip', async () => {
    const edge = await repos.relations.create('a', 'b', 'REFERENCES')
    expect(await repos.relations.findByFromItem('a')).toEqual([edge])
    expect(await repos.relations.findByToItem('b')).toEqual([edge])
  })

  it('findAll returns every edge', async () => {
    await repos.relations.create('a', 'b', 'REFERENCES')
    await repos.relations.create('b', 'c', 'SUPERSEDES')
    expect(await repos.relations.findAll()).toHaveLength(2)
  })

  it('carries metadata through', async () => {
    const edge = await repos.relations.create('a', 'b', 'REFERENCES', { note: 'x' })
    expect(edge.metadata).toEqual({ note: 'x' })
  })

  it('defaults metadata to an empty object', async () => {
    const edge = await repos.relations.create('a', 'b', 'REFERENCES')
    expect(edge.metadata).toEqual({})
  })
})

describe('IApplicabilityRepository', () => {
  function ruleInput(overrides: Partial<KnowledgeApplicabilityRule> = {}): Omit<KnowledgeApplicabilityRule, 'id' | 'createdAt' | 'updatedAt'> {
    return { itemId: 'item-1', isActive: true, effectiveFrom: '2026-01-01', ...overrides }
  }

  it('create/findByItemId round-trip', async () => {
    const rule = await repos.applicability.create(ruleInput({ itemId: 'item-1' }))
    const found = await repos.applicability.findByItemId('item-1')
    expect(found).toHaveLength(1)
    expect(found[0].id).toBe(rule.id)
  })

  it('findActive excludes inactive rules', async () => {
    const rule = await repos.applicability.create(ruleInput({ isActive: true }))
    await repos.applicability.update(rule.id, { isActive: false })
    expect(await repos.applicability.findActive()).toHaveLength(0)
  })

  it('findByItemId returns empty for an item with no rules', async () => {
    expect(await repos.applicability.findByItemId('no-rules')).toEqual([])
  })
})
