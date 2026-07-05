import { describe, it, expect, beforeEach } from 'vitest'
import { AssetKnowledgeProvider } from '../knowledge/providers/asset/assetKnowledgeProvider.ts'
import { buildMemoryKnowledgeRepositories } from '../knowledge/repositories/memoryKnowledgeRepositories.ts'
import { KnowledgeGraphService } from '../knowledge/graph/knowledgeGraph.ts'
import type { KnowledgeRepositories } from '../knowledge/repositories/knowledgeRepositories.ts'
import type { IKnowledgeGraph } from '../knowledge/graph/knowledgeGraph.ts'
import type { KnowledgeItem } from '../knowledge/platform/knowledgeTypes.ts'

function assetItemInput(overrides: Partial<KnowledgeItem> = {}): Omit<KnowledgeItem, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    domain: 'asset', provider: 'AssetKnowledgeProvider', type: 'ASSET_CATEGORY', title: 'Thiết bị máy tính',
    summary: 'Danh mục thiết bị máy tính', keywords: ['máy tính'], legalBasis: [], relatedItems: [],
    metadata: {}, confidence: 1.0, attachments: [], layer: 2, language: 'vi', isActive: true, version: '1',
    ...overrides,
  }
}

let repos: KnowledgeRepositories
let graph: IKnowledgeGraph
let provider: AssetKnowledgeProvider

beforeEach(() => {
  repos = buildMemoryKnowledgeRepositories()
  graph = new KnowledgeGraphService(repos.relations)
  provider = new AssetKnowledgeProvider(repos, graph)
})

describe('identity', () => {
  it('reports domain=asset, layer=2', () => {
    expect(provider.domain).toBe('asset')
    expect(provider.layer).toBe(2)
  })
})

describe('search()', () => {
  it('finds an item by keyword within its own domain', async () => {
    await repos.items.create(assetItemInput())
    const results = await provider.search({ text: 'máy tính' })
    expect(results).toHaveLength(1)
    expect(results[0].matchedDomain).toBe('asset')
  })

  it('never returns items from another domain', async () => {
    await repos.items.create(assetItemInput({ domain: 'vendor', title: 'máy tính supplier' }))
    expect(await provider.search({ text: 'máy tính' })).toEqual([])
  })
})

describe('resolve()', () => {
  it('resolves an item it owns', async () => {
    const item = await repos.items.create(assetItemInput())
    expect((await provider.resolve(item.id))?.id).toBe(item.id)
  })

  it('refuses to resolve an item from a different domain', async () => {
    const item = await repos.items.create(assetItemInput({ domain: 'budget' }))
    expect(await provider.resolve(item.id)).toBeNull()
  })
})

describe('suggest()', () => {
  it('suggests applicable items with an asset-specific reason', async () => {
    await repos.items.create(assetItemInput())
    const suggestions = await provider.suggest({})
    expect(suggestions[0].reason).toBe('Applicable asset management rule')
  })

  it('respects applicability rules', async () => {
    const item = await repos.items.create(assetItemInput())
    await repos.applicability.create({ itemId: item.id, isActive: true, effectiveFrom: '2020-01-01', departments: ['IT'] })
    expect(await provider.suggest({ department: 'HR' })).toEqual([])
  })
})

describe('score()', () => {
  it('scores an applicable item at its confidence', async () => {
    const item = await repos.items.create(assetItemInput({ confidence: 0.65 }))
    expect(await provider.score(item.id, {})).toBe(0.65)
  })
})

describe('graph integration — lifecycle stage ordering (DEPENDS_ON)', () => {
  it('links and retrieves the previous lifecycle stage', async () => {
    const acquisition = await repos.items.create(assetItemInput({ title: 'Acquisition' }))
    const inUse = await repos.items.create(assetItemInput({ title: 'In Use' }))
    await provider.linkNextLifecycleStage(acquisition.id, inUse.id)
    expect(await provider.getPreviousLifecycleStage(inUse.id)).toEqual([acquisition.id])
  })

  it('a stage with no prior stage returns empty', async () => {
    const item = await repos.items.create(assetItemInput())
    expect(await provider.getPreviousLifecycleStage(item.id)).toEqual([])
  })
})

describe('graph integration — depreciation rule linkage (REFERENCES)', () => {
  it('links and retrieves a depreciation rule', async () => {
    const category = await repos.items.create(assetItemInput())
    const rule = await repos.items.create(assetItemInput({ type: 'DEPRECIATION_RULE', title: 'Straight-line 5yr' }))
    await provider.linkDepreciationRule(category.id, rule.id)
    expect(await provider.getDepreciationRules(category.id)).toEqual([rule.id])
  })

  it('lifecycle ordering and depreciation rules remain independent', async () => {
    const acquisition = await repos.items.create(assetItemInput({ title: 'Acquisition' }))
    const inUse = await repos.items.create(assetItemInput({ title: 'In Use' }))
    const rule = await repos.items.create(assetItemInput({ type: 'DEPRECIATION_RULE' }))
    await provider.linkNextLifecycleStage(acquisition.id, inUse.id)
    await provider.linkDepreciationRule(inUse.id, rule.id)
    expect(await provider.getPreviousLifecycleStage(inUse.id)).toEqual([acquisition.id])
    expect(await provider.getDepreciationRules(inUse.id)).toEqual([rule.id])
  })
})
