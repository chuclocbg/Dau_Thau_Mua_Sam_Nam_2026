import { describe, it, expect, beforeEach } from 'vitest'
import { VendorKnowledgeProvider } from '../knowledge/providers/vendor/vendorKnowledgeProvider.ts'
import { buildMemoryKnowledgeRepositories } from '../knowledge/repositories/memoryKnowledgeRepositories.ts'
import { KnowledgeGraphService } from '../knowledge/graph/knowledgeGraph.ts'
import type { KnowledgeRepositories } from '../knowledge/repositories/knowledgeRepositories.ts'
import type { IKnowledgeGraph } from '../knowledge/graph/knowledgeGraph.ts'
import type { KnowledgeItem } from '../knowledge/platform/knowledgeTypes.ts'

function vendorItemInput(overrides: Partial<KnowledgeItem> = {}): Omit<KnowledgeItem, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    domain: 'vendor', provider: 'VendorKnowledgeProvider', type: 'VENDOR_CATEGORY', title: 'Nhà thầu xây dựng',
    summary: 'Tiêu chí nhà thầu xây dựng', keywords: ['xây dựng'], legalBasis: [], relatedItems: [],
    metadata: {}, confidence: 1.0, attachments: [], layer: 2, language: 'vi', isActive: true, version: '1',
    ...overrides,
  }
}

let repos: KnowledgeRepositories
let graph: IKnowledgeGraph
let provider: VendorKnowledgeProvider

beforeEach(() => {
  repos = buildMemoryKnowledgeRepositories()
  graph = new KnowledgeGraphService(repos.relations)
  provider = new VendorKnowledgeProvider(repos, graph)
})

describe('identity', () => {
  it('reports domain=vendor, layer=2', () => {
    expect(provider.domain).toBe('vendor')
    expect(provider.layer).toBe(2)
  })
})

describe('search()', () => {
  it('finds an item by keyword within its own domain', async () => {
    await repos.items.create(vendorItemInput())
    const results = await provider.search({ text: 'xây dựng' })
    expect(results).toHaveLength(1)
    expect(results[0].matchedDomain).toBe('vendor')
  })

  it('never returns items from another domain', async () => {
    await repos.items.create(vendorItemInput({ domain: 'asset', title: 'xây dựng equipment' }))
    expect(await provider.search({ text: 'xây dựng' })).toEqual([])
  })

  it('excludes inactive items', async () => {
    await repos.items.create(vendorItemInput({ isActive: false }))
    expect(await provider.search({ text: 'xây dựng' })).toEqual([])
  })
})

describe('resolve()', () => {
  it('resolves an item it owns', async () => {
    const item = await repos.items.create(vendorItemInput())
    expect((await provider.resolve(item.id))?.id).toBe(item.id)
  })

  it('refuses to resolve an item from a different domain', async () => {
    const item = await repos.items.create(vendorItemInput({ domain: 'budget' }))
    expect(await provider.resolve(item.id)).toBeNull()
  })

  it('returns null for an unknown id', async () => {
    expect(await provider.resolve('missing')).toBeNull()
  })
})

describe('suggest()', () => {
  it('suggests applicable items with a vendor-specific reason', async () => {
    await repos.items.create(vendorItemInput())
    const suggestions = await provider.suggest({ packageType: 'CONSTRUCTION' })
    expect(suggestions).toHaveLength(1)
    expect(suggestions[0].reason).toContain('Vendor requirement')
    expect(suggestions[0].reason).toContain('CONSTRUCTION')
  })

  it('respects applicability rules', async () => {
    const item = await repos.items.create(vendorItemInput())
    await repos.applicability.create({ itemId: item.id, isActive: true, effectiveFrom: '2020-01-01', packageTypes: ['GOODS'] })
    expect(await provider.suggest({ packageType: 'CONSTRUCTION' })).toEqual([])
  })
})

describe('score()', () => {
  it('scores an applicable item at its confidence', async () => {
    const item = await repos.items.create(vendorItemInput({ confidence: 0.75 }))
    expect(await provider.score(item.id, {})).toBe(0.75)
  })

  it('scores an item from another domain as 0', async () => {
    const item = await repos.items.create(vendorItemInput({ domain: 'asset' }))
    expect(await provider.score(item.id, {})).toBe(0)
  })
})

describe('graph integration — certification requirements (REQUIRES)', () => {
  it('links and retrieves a required certification', async () => {
    const category = await repos.items.create(vendorItemInput())
    const cert = await repos.items.create(vendorItemInput({ type: 'CERTIFICATION', title: 'ISO 9001' }))
    await provider.linkRequiredCertification(category.id, cert.id)
    expect(await provider.getRequiredCertifications(category.id)).toEqual([cert.id])
  })

  it('returns empty when no certification is required', async () => {
    const category = await repos.items.create(vendorItemInput())
    expect(await provider.getRequiredCertifications(category.id)).toEqual([])
  })
})

describe('graph integration — blacklist reasoning (new relation type BLACKLISTED_FOR)', () => {
  it('links and retrieves a blacklist reason', async () => {
    const vendor = await repos.items.create(vendorItemInput({ type: 'VENDOR' }))
    const finding = await repos.items.create(vendorItemInput({ domain: 'audit', type: 'AUDIT_FINDING', title: 'Fraudulent bid' }))
    await provider.linkBlacklistReason(vendor.id, finding.id)
    expect(await provider.getBlacklistReasons(vendor.id)).toEqual([finding.id])
  })

  it('a vendor with no blacklist reason returns empty', async () => {
    const vendor = await repos.items.create(vendorItemInput({ type: 'VENDOR' }))
    expect(await provider.getBlacklistReasons(vendor.id)).toEqual([])
  })

  it('REQUIRES and BLACKLISTED_FOR remain independent on the same item', async () => {
    const vendor = await repos.items.create(vendorItemInput({ type: 'VENDOR' }))
    const cert = await repos.items.create(vendorItemInput({ type: 'CERTIFICATION' }))
    const finding = await repos.items.create(vendorItemInput({ type: 'AUDIT_FINDING' }))
    await provider.linkRequiredCertification(vendor.id, cert.id)
    await provider.linkBlacklistReason(vendor.id, finding.id)
    expect(await provider.getRequiredCertifications(vendor.id)).toEqual([cert.id])
    expect(await provider.getBlacklistReasons(vendor.id)).toEqual([finding.id])
  })
})
