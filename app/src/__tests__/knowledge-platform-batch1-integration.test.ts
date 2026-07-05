import { describe, it, expect, beforeEach } from 'vitest'
import { DefaultKnowledgePlatform } from '../knowledge/platform/knowledgePlatform.ts'
import type { IKnowledgePlatform } from '../knowledge/platform/knowledgePlatform.ts'
import { LegalProvider } from '../knowledge/providers/legal/legalProvider.ts'
import { ProcurementProvider } from '../knowledge/providers/procurement/procurementProvider.ts'
import { TemplateProvider } from '../knowledge/providers/templates/templateProvider.ts'
import { ChecklistProvider } from '../knowledge/providers/checklists/checklistProvider.ts'
import { OntologyProvider } from '../knowledge/providers/ontology/ontologyProvider.ts'
import { GlossaryProvider } from '../knowledge/providers/glossary/glossaryProvider.ts'
import { buildMemoryKnowledgeRepositories } from '../knowledge/repositories/memoryKnowledgeRepositories.ts'
import { KnowledgeGraphService } from '../knowledge/graph/knowledgeGraph.ts'
import type { KnowledgeRepositories } from '../knowledge/repositories/knowledgeRepositories.ts'
import type { KnowledgeItem } from '../knowledge/platform/knowledgeTypes.ts'

// Proves all 6 providers built so far (2 from Stage 2 + 4 from Batch 1) coexist on
// one platform instance with zero core changes — the central claim of "batches,
// not one-by-one" still holding at 6 providers, not just 2.

function itemInput(domain: string, overrides: Partial<KnowledgeItem> = {}): Omit<KnowledgeItem, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    domain, provider: `${domain}Provider`, type: 'TEST', title: `${domain} item`, summary: 'S',
    keywords: [domain], legalBasis: [], relatedItems: [], metadata: {}, confidence: 0.8,
    attachments: [], layer: 2, language: 'vi', isActive: true, version: '1',
    ...overrides,
  }
}

let repos: KnowledgeRepositories
let platform: IKnowledgePlatform

beforeEach(() => {
  repos = buildMemoryKnowledgeRepositories()
  const graph = new KnowledgeGraphService(repos.relations)
  platform = new DefaultKnowledgePlatform(repos)
  platform.registerProvider(new LegalProvider(repos, graph))
  platform.registerProvider(new ProcurementProvider(repos, graph))
  platform.registerProvider(new TemplateProvider(repos, graph))
  platform.registerProvider(new ChecklistProvider(repos, graph))
  platform.registerProvider(new OntologyProvider(repos, graph))
  platform.registerProvider(new GlossaryProvider(repos, graph))
})

describe('all 6 providers register without conflict', () => {
  it('searchKnowledge with no domain filter searches all 6 simultaneously', async () => {
    for (const domain of ['legal', 'procurement', 'templates', 'checklists', 'ontology', 'glossary']) {
      await repos.items.create(itemInput(domain, { title: 'shared keyword item' }))
    }
    const results = await platform.searchKnowledge('shared keyword')
    expect(results).toHaveLength(6)
    expect(new Set(results.map(r => r.matchedDomain)).size).toBe(6)
  })
})

describe('resolveContext aggregates applicable items across all 6 domains at once', () => {
  it('returns one entry per registered domain', async () => {
    for (const domain of ['legal', 'procurement', 'templates', 'checklists', 'ontology', 'glossary']) {
      await repos.items.create(itemInput(domain))
    }
    const context = await platform.resolveContext({}, '2026-06-01')
    expect(Object.keys(context).sort()).toEqual(
      ['checklists', 'glossary', 'legal', 'ontology', 'procurement', 'templates'],
    )
    for (const domain of Object.keys(context)) {
      expect(context[domain]).toHaveLength(1)
    }
  })
})

describe('named convenience methods reach the correct real provider-backed data', () => {
  it('resolveTemplates and resolveChecklist both return only their own domain', async () => {
    await repos.items.create(itemInput('templates', { title: 'A template' }))
    await repos.items.create(itemInput('checklists', { title: 'A checklist' }))

    const templates = await platform.resolveTemplates({}, '2026-06-01')
    const checklists = await platform.resolveChecklist({}, '2026-06-01')

    expect(templates).toHaveLength(1)
    expect(templates[0].domain).toBe('templates')
    expect(checklists).toHaveLength(1)
    expect(checklists[0].domain).toBe('checklists')
  })
})

describe('duplicate domain registration is still rejected at 6 providers', () => {
  it('throws when re-registering an already-claimed domain', () => {
    expect(() => platform.registerProvider(new TemplateProvider(repos, new KnowledgeGraphService(repos.relations))))
      .toThrow()
  })
})

describe('each new provider\'s graph relationships remain independent of the others', () => {
  it('TemplateProvider DEPENDS_ON, ChecklistProvider DEPENDS_ON (reversed direction), and OntologyProvider BROADER_THAN never cross-contaminate', async () => {
    const graph = new KnowledgeGraphService(repos.relations)
    const templateProvider = new TemplateProvider(repos, graph)
    const checklistProvider = new ChecklistProvider(repos, graph)
    const ontologyProvider = new OntologyProvider(repos, graph)

    const contract = await repos.items.create(itemInput('templates', { title: 'Contract' }))
    const decision = await repos.items.create(itemInput('templates', { title: 'Decision' }))
    await templateProvider.linkPrerequisite(contract.id, decision.id)

    const planningGate = await repos.items.create(itemInput('checklists', { title: 'Planning Gate' }))
    const evalGate = await repos.items.create(itemInput('checklists', { title: 'Eval Gate' }))
    await checklistProvider.linkNextPhase(planningGate.id, evalGate.id)

    const broad = await repos.items.create(itemInput('ontology', { title: 'Broad Concept' }))
    const narrow = await repos.items.create(itemInput('ontology', { title: 'Narrow Concept' }))
    await ontologyProvider.linkBroaderConcept(narrow.id, broad.id)

    expect(await templateProvider.getPrerequisites(contract.id)).toEqual([decision.id])
    expect(await checklistProvider.getPreviousPhase(evalGate.id)).toEqual([planningGate.id])
    expect(await ontologyProvider.getBroaderConcepts(narrow.id)).toEqual([broad.id])
    // BROADER_THAN is a distinct relation string from DEPENDS_ON — never appears under
    // TemplateProvider's or ChecklistProvider's DEPENDS_ON-filtered queries, even on the
    // same shared graph.
    expect(await ontologyProvider.getBroaderConcepts(contract.id)).toEqual([])
    expect(await ontologyProvider.getBroaderConcepts(evalGate.id)).toEqual([])
    // An item with no edges at all returns empty regardless of which provider asks.
    const unconnected = await repos.items.create(itemInput('templates', { title: 'Unconnected' }))
    expect(await templateProvider.getPrerequisites(unconnected.id)).toEqual([])
  })
})
