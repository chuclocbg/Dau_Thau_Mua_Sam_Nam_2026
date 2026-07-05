import { describe, it, expect, beforeEach } from 'vitest'
import { DefaultKnowledgePlatform } from '../knowledge/platform/knowledgePlatform.ts'
import type { IKnowledgePlatform } from '../knowledge/platform/knowledgePlatform.ts'
import { LegalProvider } from '../knowledge/providers/legal/legalProvider.ts'
import { ProcurementProvider } from '../knowledge/providers/procurement/procurementProvider.ts'
import { buildMemoryKnowledgeRepositories } from '../knowledge/repositories/memoryKnowledgeRepositories.ts'
import { KnowledgeGraphService } from '../knowledge/graph/knowledgeGraph.ts'
import type { KnowledgeRepositories } from '../knowledge/repositories/knowledgeRepositories.ts'
import type { KnowledgeItem } from '../knowledge/platform/knowledgeTypes.ts'

// End-to-end proof that two genuinely different real providers plug into the
// platform core with ZERO changes to platform/router/ranker/registry — the
// central claim of the whole frozen architecture.

function itemInput(domain: string, overrides: Partial<KnowledgeItem> = {}): Omit<KnowledgeItem, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    domain, provider: `${domain}Provider`, type: 'TEST', title: 'Item', summary: 'S',
    keywords: [], legalBasis: [], relatedItems: [], metadata: {}, confidence: 0.8,
    attachments: [], layer: domain === 'legal' ? 1 : 2, language: 'vi', isActive: true, version: '1',
    ...overrides,
  }
}

let repos: KnowledgeRepositories
let platform: IKnowledgePlatform
let legal: LegalProvider
let procurement: ProcurementProvider

beforeEach(() => {
  repos = buildMemoryKnowledgeRepositories()
  const graph = new KnowledgeGraphService(repos.relations)
  platform = new DefaultKnowledgePlatform(repos)
  legal = new LegalProvider(repos, graph)
  procurement = new ProcurementProvider(repos, graph)
  platform.registerProvider(legal)
  platform.registerProvider(procurement)
})

describe('registration', () => {
  it('both providers are searchable through the platform with no platform code aware of either', async () => {
    await repos.items.create(itemInput('legal', { title: 'Luật Đấu thầu' }))
    await repos.items.create(itemInput('procurement', { title: 'Đấu thầu rộng rãi' }))
    const results = await platform.searchKnowledge('Đấu thầu')
    expect(results).toHaveLength(2)
    expect(results.map(r => r.matchedDomain).sort()).toEqual(['legal', 'procurement'])
  })
})

describe('domain-restricted search still isolates correctly through real providers', () => {
  it('restricting to legal excludes procurement matches', async () => {
    await repos.items.create(itemInput('legal', { title: 'Matching Term' }))
    await repos.items.create(itemInput('procurement', { title: 'Matching Term' }))
    const results = await platform.searchKnowledge('Matching', ['legal'])
    expect(results).toHaveLength(1)
    expect(results[0].matchedDomain).toBe('legal')
  })
})

describe('resolveLegalBasis / resolveContext exercise both real providers\' data simultaneously', () => {
  it('resolveContext returns applicable items for both registered domains', async () => {
    await repos.items.create(itemInput('legal'))
    await repos.items.create(itemInput('procurement'))
    const context = await platform.resolveContext({}, '2026-06-01')
    expect(context.legal).toHaveLength(1)
    expect(context.procurement).toHaveLength(1)
  })

  it('buildAIContext bundles the legal domain via the real LegalProvider-backed data', async () => {
    await repos.items.create(itemInput('legal', { title: 'Legal Basis Item' }))
    const ctx = await platform.buildAIContext({}, '2026-06-01')
    expect(ctx.legalBasis).toHaveLength(1)
    expect(ctx.legalBasis[0].title).toBe('Legal Basis Item')
  })
})

describe('duplicate registration is rejected even across different provider classes', () => {
  it('throws when a second provider tries to claim the same domain', () => {
    expect(() => platform.registerProvider(new LegalProvider(repos, new KnowledgeGraphService(repos.relations)))).toThrow()
  })
})

describe('each provider\'s own graph relationships remain independent', () => {
  it('a citation recorded via LegalProvider does not appear in ProcurementProvider\'s template links', async () => {
    const law = await repos.items.create(itemInput('legal', { title: 'Law' }))
    const decree = await repos.items.create(itemInput('legal', { title: 'Decree' }))
    await legal.recordCitation(decree.id, law.id)

    const method = await repos.items.create(itemInput('procurement', { title: 'Method' }))
    expect(await procurement.getRequiredTemplates(method.id)).toEqual([])
    expect(await legal.getCitations(decree.id)).toEqual([law.id])
  })
})
