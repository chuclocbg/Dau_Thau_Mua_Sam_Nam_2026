import { describe, it, expect, beforeEach } from 'vitest'
import { DefaultKnowledgePlatform } from '../knowledge/platform/knowledgePlatform.ts'
import type { IKnowledgePlatform } from '../knowledge/platform/knowledgePlatform.ts'
import { buildMemoryKnowledgeRepositories } from '../knowledge/repositories/memoryKnowledgeRepositories.ts'
import type { KnowledgeRepositories } from '../knowledge/repositories/knowledgeRepositories.ts'
import type {
  IKnowledgeProvider, KnowledgeQuery, KnowledgeResult, KnowledgeContext, KnowledgeSuggestion, KnowledgeItem,
} from '../knowledge/platform/knowledgeTypes.ts'

// A fake provider standing in for a real domain provider (Stage 2 builds real ones).
// It only needs to exercise every platform extension point — search/resolve/suggest/score.
class FakeDomainProvider implements IKnowledgeProvider {
  readonly version = '1.0.0'
  private readonly items = new Map<string, KnowledgeItem>()

  constructor(readonly domain: string, readonly layer: 1 | 2 | 3 | 4, seedItems: readonly KnowledgeItem[] = []) {
    for (const item of seedItems) this.items.set(item.id, item)
  }

  async search(query: KnowledgeQuery): Promise<readonly KnowledgeResult[]> {
    return Array.from(this.items.values())
      .filter(i => i.title.toLowerCase().includes(query.text.toLowerCase()))
      .map(item => ({ item, relevance: 0.8, matchedDomain: this.domain }))
  }
  async resolve(itemId: string): Promise<KnowledgeItem | null> {
    return this.items.get(itemId) ?? null
  }
  async suggest(_context: KnowledgeContext): Promise<readonly KnowledgeSuggestion[]> {
    return Array.from(this.items.values()).map(item => ({ item, reason: 'proactive suggestion', confidence: 0.6 }))
  }
  async score(itemId: string, _context: KnowledgeContext): Promise<number> {
    return this.items.has(itemId) ? 0.75 : 0
  }
}

function makeItem(id: string, domain: string, title: string): KnowledgeItem {
  return {
    id, domain, provider: `${domain}Provider`, type: 'TEST', title, summary: 'S',
    keywords: [], legalBasis: [], relatedItems: [], metadata: {}, confidence: 0.9,
    attachments: [], layer: 2, language: 'vi', isActive: true, version: '1',
    createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  }
}

let repos: KnowledgeRepositories
let platform: IKnowledgePlatform

beforeEach(() => {
  repos = buildMemoryKnowledgeRepositories()
  platform = new DefaultKnowledgePlatform(repos)
})

describe('registerProvider', () => {
  it('registers a provider that searchKnowledge can then route to', async () => {
    platform.registerProvider(new FakeDomainProvider('legal', 1, [makeItem('l1', 'legal', 'Luật Đấu thầu')]))
    const results = await platform.searchKnowledge('Đấu thầu')
    expect(results).toHaveLength(1)
    expect(results[0].matchedDomain).toBe('legal')
  })

  it('a second, entirely novel domain registers with zero platform changes (Rule 2)', async () => {
    platform.registerProvider(new FakeDomainProvider('a-domain-from-the-future', 4, [makeItem('x1', 'a-domain-from-the-future', 'Future Item')]))
    const results = await platform.searchKnowledge('Future')
    expect(results).toHaveLength(1)
  })
})

describe('searchKnowledge', () => {
  it('searches across every registered domain when none is specified', async () => {
    platform.registerProvider(new FakeDomainProvider('legal', 1, [makeItem('l1', 'legal', 'Matching Law')]))
    platform.registerProvider(new FakeDomainProvider('risk', 4, [makeItem('r1', 'risk', 'Matching Risk')]))
    const results = await platform.searchKnowledge('Matching')
    expect(results).toHaveLength(2)
  })

  it('restricts to the given domains list', async () => {
    platform.registerProvider(new FakeDomainProvider('legal', 1, [makeItem('l1', 'legal', 'Matching Law')]))
    platform.registerProvider(new FakeDomainProvider('risk', 4, [makeItem('r1', 'risk', 'Matching Risk')]))
    const results = await platform.searchKnowledge('Matching', ['legal'])
    expect(results).toHaveLength(1)
    expect(results[0].matchedDomain).toBe('legal')
  })
})

describe('resolveKnowledge', () => {
  it('resolves an item stored directly in the item repository', async () => {
    const item = await repos.items.create({
      domain: 'legal', provider: 'LegalProvider', type: 'LAW', title: 'T', summary: 'S',
      keywords: [], legalBasis: [], relatedItems: [], metadata: {}, confidence: 1,
      attachments: [], layer: 1, language: 'vi', isActive: true, version: '1',
    })
    expect((await platform.resolveKnowledge(item.id))?.id).toBe(item.id)
  })

  it('returns null for an unknown item', async () => {
    expect(await platform.resolveKnowledge('missing')).toBeNull()
  })
})

describe('resolveApplicableDocuments and the named convenience methods', () => {
  beforeEach(async () => {
    await repos.items.create({
      domain: 'legal', provider: 'LegalProvider', type: 'LAW', title: 'Legal Item', summary: 'S',
      keywords: [], legalBasis: [], relatedItems: [], metadata: {}, confidence: 1,
      attachments: [], layer: 1, language: 'vi', isActive: true, version: '1',
    })
    await repos.items.create({
      domain: 'templates', provider: 'TemplateProvider', type: 'TEMPLATE', title: 'Template Item', summary: 'S',
      keywords: [], legalBasis: [], relatedItems: [], metadata: {}, confidence: 1,
      attachments: [], layer: 2, language: 'vi', isActive: true, version: '1',
    })
  })

  it('resolveApplicableDocuments works for the legal domain', async () => {
    const result = await platform.resolveApplicableDocuments('legal', '2026-06-01', {})
    expect(result).toHaveLength(1)
    expect(result[0].domain).toBe('legal')
  })

  it('resolveLegalBasis is the named convenience wrapper for the legal domain', async () => {
    const result = await platform.resolveLegalBasis({}, '2026-06-01')
    expect(result).toHaveLength(1)
    expect(result[0].domain).toBe('legal')
  })

  it('resolveTemplates is the named convenience wrapper for the templates domain', async () => {
    const result = await platform.resolveTemplates({}, '2026-06-01')
    expect(result).toHaveLength(1)
    expect(result[0].domain).toBe('templates')
  })

  it('every other named resolve* method returns empty when no items exist for its domain', async () => {
    expect(await platform.resolveChecklist({}, '2026-06-01')).toEqual([])
    expect(await platform.resolveBestPractice({}, '2026-06-01')).toEqual([])
    expect(await platform.resolveCases({}, '2026-06-01')).toEqual([])
    expect(await platform.resolveRisk({}, '2026-06-01')).toEqual([])
    expect(await platform.resolveAuditFinding({}, '2026-06-01')).toEqual([])
    expect(await platform.resolveSchoolPolicy({}, '2026-06-01')).toEqual([])
    expect(await platform.resolveVendorKnowledge({}, '2026-06-01')).toEqual([])
    expect(await platform.resolveAssetKnowledge({}, '2026-06-01')).toEqual([])
    expect(await platform.resolveBudgetKnowledge({}, '2026-06-01')).toEqual([])
  })
})

describe('resolveContext', () => {
  it('returns applicable items keyed by every domain that has a registered provider', async () => {
    platform.registerProvider(new FakeDomainProvider('legal', 1))
    platform.registerProvider(new FakeDomainProvider('risk', 4))
    await repos.items.create({
      domain: 'legal', provider: 'LegalProvider', type: 'LAW', title: 'T', summary: 'S',
      keywords: [], legalBasis: [], relatedItems: [], metadata: {}, confidence: 1,
      attachments: [], layer: 1, language: 'vi', isActive: true, version: '1',
    })
    const context = await platform.resolveContext({}, '2026-06-01')
    expect(Object.keys(context).sort()).toEqual(['legal', 'risk'])
    expect(context.legal).toHaveLength(1)
    expect(context.risk).toHaveLength(0)
  })

  it('returns an empty object when no provider is registered', async () => {
    expect(await platform.resolveContext({}, '2026-06-01')).toEqual({})
  })
})

describe('buildAIContext', () => {
  it('bundles legal/templates/checklists/bestPractices/risks/cases with a generatedAt timestamp', async () => {
    await repos.items.create({
      domain: 'legal', provider: 'LegalProvider', type: 'LAW', title: 'T', summary: 'S',
      keywords: [], legalBasis: [], relatedItems: [], metadata: {}, confidence: 1,
      attachments: [], layer: 1, language: 'vi', isActive: true, version: '1',
    })
    const ctx = await platform.buildAIContext({}, '2026-06-01')
    expect(ctx.legalBasis).toHaveLength(1)
    expect(ctx.templates).toEqual([])
    expect(ctx.checklists).toEqual([])
    expect(ctx.bestPractices).toEqual([])
    expect(ctx.risks).toEqual([])
    expect(ctx.cases).toEqual([])
    expect(ctx.generatedAt).toBeTruthy()
  })
})
