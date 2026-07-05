import { describe, it, expect, beforeEach } from 'vitest'
import { ProcurementProvider } from '../knowledge/providers/procurement/procurementProvider.ts'
import { buildMemoryKnowledgeRepositories } from '../knowledge/repositories/memoryKnowledgeRepositories.ts'
import { KnowledgeGraphService } from '../knowledge/graph/knowledgeGraph.ts'
import type { KnowledgeRepositories } from '../knowledge/repositories/knowledgeRepositories.ts'
import type { IKnowledgeGraph } from '../knowledge/graph/knowledgeGraph.ts'
import type { KnowledgeItem } from '../knowledge/platform/knowledgeTypes.ts'

function procItemInput(overrides: Partial<KnowledgeItem> = {}): Omit<KnowledgeItem, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    domain: 'procurement', provider: 'ProcurementProvider', type: 'METHOD', title: 'Đấu thầu rộng rãi',
    summary: 'Phương thức đấu thầu mở', keywords: ['open tender'], legalBasis: [], relatedItems: [],
    metadata: {}, confidence: 1.0, attachments: [], layer: 2, language: 'vi', isActive: true, version: '1',
    ...overrides,
  }
}

let repos: KnowledgeRepositories
let graph: IKnowledgeGraph
let provider: ProcurementProvider

beforeEach(() => {
  repos = buildMemoryKnowledgeRepositories()
  graph = new KnowledgeGraphService(repos.relations)
  provider = new ProcurementProvider(repos, graph)
})

describe('identity', () => {
  it('reports domain=procurement, layer=2', () => {
    expect(provider.domain).toBe('procurement')
    expect(provider.layer).toBe(2)
  })
})

describe('search / resolve / suggest / score — same contract as LegalProvider', () => {
  it('search finds items by keyword within its own domain only', async () => {
    await repos.items.create(procItemInput())
    await repos.items.create(procItemInput({ domain: 'legal', title: 'Đấu thầu rộng rãi legal' }))
    const results = await provider.search({ text: 'rộng rãi' })
    expect(results).toHaveLength(1)
    expect(results[0].matchedDomain).toBe('procurement')
  })

  it('resolve refuses items from another domain', async () => {
    const item = await repos.items.create(procItemInput({ domain: 'legal' }))
    expect(await provider.resolve(item.id)).toBeNull()
  })

  it('suggest uses a procurement-specific reason string', async () => {
    await repos.items.create(procItemInput())
    const suggestions = await provider.suggest({ procurementMethod: 'OPEN_TENDER' })
    expect(suggestions[0].reason).toContain('procurement approach')
    expect(suggestions[0].reason).toContain('OPEN_TENDER')
  })

  it('score reflects applicability exactly like LegalProvider', async () => {
    const item = await repos.items.create(procItemInput({ confidence: 0.6 }))
    expect(await provider.score(item.id, {})).toBe(0.6)
  })
})

describe('template linkage (USES_TEMPLATE)', () => {
  it('links and retrieves a required template', async () => {
    const method = await repos.items.create(procItemInput({ title: 'OPEN_TENDER method' }))
    const template = await repos.items.create(procItemInput({ type: 'TEMPLATE', title: 'HSMT' }))
    await provider.linkTemplate(method.id, template.id)
    expect(await provider.getRequiredTemplates(method.id)).toEqual([template.id])
  })

  it('returns empty when no template is linked', async () => {
    const method = await repos.items.create(procItemInput())
    expect(await provider.getRequiredTemplates(method.id)).toEqual([])
  })

  it('supports multiple required templates', async () => {
    const method = await repos.items.create(procItemInput())
    const t1 = await repos.items.create(procItemInput({ type: 'TEMPLATE', title: 'HSMT' }))
    const t2 = await repos.items.create(procItemInput({ type: 'TEMPLATE', title: 'HSYC' }))
    await provider.linkTemplate(method.id, t1.id)
    await provider.linkTemplate(method.id, t2.id)
    expect(await provider.getRequiredTemplates(method.id)).toHaveLength(2)
  })
})

describe('dependency chain (DEPENDS_ON)', () => {
  it('links and retrieves a dependency', async () => {
    const award = await repos.items.create(procItemInput({ title: 'Contract Award' }))
    const evaluation = await repos.items.create(procItemInput({ title: 'Evaluation Complete' }))
    await provider.linkDependency(award.id, evaluation.id)
    expect(await provider.getDependencies(award.id)).toEqual([evaluation.id])
  })

  it('returns empty for an item with no dependencies', async () => {
    const item = await repos.items.create(procItemInput())
    expect(await provider.getDependencies(item.id)).toEqual([])
  })
})

describe('USES_TEMPLATE and DEPENDS_ON are distinct relation types on the same graph', () => {
  it('getRequiredTemplates never returns a DEPENDS_ON edge target', async () => {
    const method = await repos.items.create(procItemInput())
    const template = await repos.items.create(procItemInput({ type: 'TEMPLATE' }))
    const dependency = await repos.items.create(procItemInput({ title: 'Some Dependency' }))
    await provider.linkTemplate(method.id, template.id)
    await provider.linkDependency(method.id, dependency.id)
    expect(await provider.getRequiredTemplates(method.id)).toEqual([template.id])
    expect(await provider.getDependencies(method.id)).toEqual([dependency.id])
  })
})
