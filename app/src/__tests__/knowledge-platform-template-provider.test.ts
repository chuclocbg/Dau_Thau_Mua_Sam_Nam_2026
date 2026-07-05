import { describe, it, expect, beforeEach } from 'vitest'
import { TemplateProvider } from '../knowledge/providers/templates/templateProvider.ts'
import { buildMemoryKnowledgeRepositories } from '../knowledge/repositories/memoryKnowledgeRepositories.ts'
import { KnowledgeGraphService } from '../knowledge/graph/knowledgeGraph.ts'
import type { KnowledgeRepositories } from '../knowledge/repositories/knowledgeRepositories.ts'
import type { IKnowledgeGraph } from '../knowledge/graph/knowledgeGraph.ts'
import type { KnowledgeItem } from '../knowledge/platform/knowledgeTypes.ts'

function templateItemInput(overrides: Partial<KnowledgeItem> = {}): Omit<KnowledgeItem, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    domain: 'templates', provider: 'TemplateProvider', type: 'TEMPLATE', title: 'HSMT',
    summary: 'Hồ sơ mời thầu', keywords: ['HSMT'], legalBasis: [], relatedItems: [],
    metadata: {}, confidence: 1.0, attachments: [], layer: 2, language: 'vi', isActive: true, version: '1',
    ...overrides,
  }
}

let repos: KnowledgeRepositories
let graph: IKnowledgeGraph
let provider: TemplateProvider

beforeEach(() => {
  repos = buildMemoryKnowledgeRepositories()
  graph = new KnowledgeGraphService(repos.relations)
  provider = new TemplateProvider(repos, graph)
})

describe('identity', () => {
  it('reports domain=templates, layer=2', () => {
    expect(provider.domain).toBe('templates')
    expect(provider.layer).toBe(2)
  })
})

describe('search / resolve / suggest / score contract', () => {
  it('search finds a template by keyword within its own domain', async () => {
    await repos.items.create(templateItemInput())
    const results = await provider.search({ text: 'HSMT' })
    expect(results).toHaveLength(1)
    expect(results[0].matchedDomain).toBe('templates')
  })

  it('resolve refuses items from another domain', async () => {
    const item = await repos.items.create(templateItemInput({ domain: 'legal' }))
    expect(await provider.resolve(item.id)).toBeNull()
  })

  it('suggest uses a template-specific reason', async () => {
    await repos.items.create(templateItemInput())
    const suggestions = await provider.suggest({ packageType: 'GOODS' })
    expect(suggestions[0].reason).toContain('template')
    expect(suggestions[0].reason).toContain('GOODS')
  })

  it('score reflects applicability', async () => {
    const item = await repos.items.create(templateItemInput({ confidence: 0.7 }))
    expect(await provider.score(item.id, {})).toBe(0.7)
  })
})

describe('prerequisite graph (DEPENDS_ON)', () => {
  it('links and retrieves a prerequisite template', async () => {
    const contract = await repos.items.create(templateItemInput({ title: 'Contract' }))
    const decision = await repos.items.create(templateItemInput({ title: 'Award Decision' }))
    await provider.linkPrerequisite(contract.id, decision.id)
    expect(await provider.getPrerequisites(contract.id)).toEqual([decision.id])
  })

  it('returns empty when there are no prerequisites', async () => {
    const item = await repos.items.create(templateItemInput())
    expect(await provider.getPrerequisites(item.id)).toEqual([])
  })
})

describe('generated-document graph (GENERATES)', () => {
  it('links and retrieves a generated document', async () => {
    const hsmt = await repos.items.create(templateItemInput())
    const announcement = await repos.items.create(templateItemInput({ type: 'DOCUMENT', title: 'Tender Announcement' }))
    await provider.linkGeneratedDocument(hsmt.id, announcement.id)
    expect(await provider.getGeneratedDocuments(hsmt.id)).toEqual([announcement.id])
  })

  it('keeps GENERATES and DEPENDS_ON independent on the same item', async () => {
    const contract = await repos.items.create(templateItemInput({ title: 'Contract' }))
    const decision = await repos.items.create(templateItemInput({ title: 'Award Decision' }))
    const invoice = await repos.items.create(templateItemInput({ type: 'DOCUMENT', title: 'Invoice' }))
    await provider.linkPrerequisite(contract.id, decision.id)
    await provider.linkGeneratedDocument(contract.id, invoice.id)
    expect(await provider.getPrerequisites(contract.id)).toEqual([decision.id])
    expect(await provider.getGeneratedDocuments(contract.id)).toEqual([invoice.id])
  })
})
