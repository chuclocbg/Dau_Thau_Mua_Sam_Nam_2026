import { describe, it, expect, beforeEach } from 'vitest'
import { GlossaryProvider } from '../knowledge/providers/glossary/glossaryProvider.ts'
import { buildMemoryKnowledgeRepositories } from '../knowledge/repositories/memoryKnowledgeRepositories.ts'
import { KnowledgeGraphService } from '../knowledge/graph/knowledgeGraph.ts'
import type { KnowledgeRepositories } from '../knowledge/repositories/knowledgeRepositories.ts'
import type { IKnowledgeGraph } from '../knowledge/graph/knowledgeGraph.ts'
import type { KnowledgeItem } from '../knowledge/platform/knowledgeTypes.ts'

function termItemInput(overrides: Partial<KnowledgeItem> = {}): Omit<KnowledgeItem, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    domain: 'glossary', provider: 'GlossaryProvider', type: 'TERM', title: 'HSMT',
    summary: 'Hồ sơ mời thầu', keywords: ['HSMT'], legalBasis: [], relatedItems: [],
    metadata: {}, confidence: 1.0, attachments: [], layer: 2, language: 'vi', isActive: true, version: '1',
    ...overrides,
  }
}

let repos: KnowledgeRepositories
let graph: IKnowledgeGraph
let provider: GlossaryProvider

beforeEach(() => {
  repos = buildMemoryKnowledgeRepositories()
  graph = new KnowledgeGraphService(repos.relations)
  provider = new GlossaryProvider(repos, graph)
})

describe('identity', () => {
  it('reports domain=glossary, layer=2', () => {
    expect(provider.domain).toBe('glossary')
    expect(provider.layer).toBe(2)
  })
})

describe('search / resolve / suggest / score contract', () => {
  it('search finds a term by keyword', async () => {
    await repos.items.create(termItemInput())
    expect(await provider.search({ text: 'HSMT' })).toHaveLength(1)
  })

  it('resolve refuses items from another domain', async () => {
    const item = await repos.items.create(termItemInput({ domain: 'ontology' }))
    expect(await provider.resolve(item.id)).toBeNull()
  })

  it('suggest uses a glossary-specific reason', async () => {
    await repos.items.create(termItemInput())
    const suggestions = await provider.suggest({})
    expect(suggestions[0].reason).toContain('glossary term')
  })
})

describe('abbreviation linkage — a brand-new relation type (ABBREVIATES)', () => {
  it('links an abbreviation to its full term', async () => {
    const hsmt = await repos.items.create(termItemInput({ title: 'HSMT' }))
    const fullTerm = await repos.items.create(termItemInput({ title: 'Hồ sơ mời thầu' }))
    await provider.linkAbbreviation(hsmt.id, fullTerm.id)
    expect(await provider.getFullTerm(hsmt.id)).toEqual([fullTerm.id])
  })

  it('finds abbreviations for a full term via the incoming edge', async () => {
    const hsmt = await repos.items.create(termItemInput({ title: 'HSMT' }))
    const fullTerm = await repos.items.create(termItemInput({ title: 'Hồ sơ mời thầu' }))
    await provider.linkAbbreviation(hsmt.id, fullTerm.id)
    expect(await provider.getAbbreviations(fullTerm.id)).toEqual([hsmt.id])
  })

  it('a term with no abbreviation link returns empty', async () => {
    const item = await repos.items.create(termItemInput())
    expect(await provider.getFullTerm(item.id)).toEqual([])
    expect(await provider.getAbbreviations(item.id)).toEqual([])
  })
})

describe('term translation — a second, independent brand-new relation type (TRANSLATES_TO)', () => {
  it('links a term to its translation', async () => {
    const vi = await repos.items.create(termItemInput({ title: 'Đấu thầu', language: 'vi' }))
    const en = await repos.items.create(termItemInput({ title: 'Procurement', language: 'en' }))
    await provider.linkTranslation(vi.id, en.id)
    expect(await provider.getTranslations(vi.id)).toEqual([en.id])
  })

  it('ABBREVIATES and TRANSLATES_TO coexist independently on the same graph', async () => {
    const hsmt = await repos.items.create(termItemInput({ title: 'HSMT' }))
    const fullTerm = await repos.items.create(termItemInput({ title: 'Hồ sơ mời thầu' }))
    const en = await repos.items.create(termItemInput({ title: 'Tender Documents', language: 'en' }))
    await provider.linkAbbreviation(hsmt.id, fullTerm.id)
    await provider.linkTranslation(fullTerm.id, en.id)
    expect(await provider.getFullTerm(hsmt.id)).toEqual([fullTerm.id])
    expect(await provider.getTranslations(fullTerm.id)).toEqual([en.id])
  })
})
