import { describe, it, expect, beforeEach } from 'vitest'
import { ChecklistProvider } from '../knowledge/providers/checklists/checklistProvider.ts'
import { buildMemoryKnowledgeRepositories } from '../knowledge/repositories/memoryKnowledgeRepositories.ts'
import { KnowledgeGraphService } from '../knowledge/graph/knowledgeGraph.ts'
import { KNOWLEDGE_RELATION_TYPES } from '../knowledge/platform/knowledgeTypes.ts'
import type { KnowledgeRepositories } from '../knowledge/repositories/knowledgeRepositories.ts'
import type { IKnowledgeGraph } from '../knowledge/graph/knowledgeGraph.ts'
import type { KnowledgeItem } from '../knowledge/platform/knowledgeTypes.ts'

function checklistItemInput(overrides: Partial<KnowledgeItem> = {}): Omit<KnowledgeItem, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    domain: 'checklists', provider: 'ChecklistProvider', type: 'CHECKLIST', title: 'Evaluation Checklist',
    summary: 'Danh mục kiểm tra đánh giá', keywords: ['evaluation'], legalBasis: [], relatedItems: [],
    metadata: {}, confidence: 1.0, attachments: [], layer: 2, language: 'vi', isActive: true, version: '1',
    ...overrides,
  }
}

let repos: KnowledgeRepositories
let graph: IKnowledgeGraph
let provider: ChecklistProvider

beforeEach(() => {
  repos = buildMemoryKnowledgeRepositories()
  graph = new KnowledgeGraphService(repos.relations)
  provider = new ChecklistProvider(repos, graph)
})

describe('identity', () => {
  it('reports domain=checklists, layer=2', () => {
    expect(provider.domain).toBe('checklists')
    expect(provider.layer).toBe(2)
  })
})

describe('search / resolve / suggest / score contract', () => {
  it('search finds a checklist by keyword', async () => {
    await repos.items.create(checklistItemInput())
    const results = await provider.search({ text: 'evaluation' })
    expect(results).toHaveLength(1)
  })

  it('resolve refuses items from another domain', async () => {
    const item = await repos.items.create(checklistItemInput({ domain: 'templates' }))
    expect(await provider.resolve(item.id)).toBeNull()
  })

  it('suggest uses a checklist-specific reason', async () => {
    await repos.items.create(checklistItemInput())
    const suggestions = await provider.suggest({ packageType: 'CONSTRUCTION' })
    expect(suggestions[0].reason).toContain('compliance checklist')
  })
})

describe('phase-gate ordering (DEPENDS_ON)', () => {
  it('linkNextPhase makes the next phase depend on this one', async () => {
    const planning = await repos.items.create(checklistItemInput({ title: 'Planning Gate' }))
    const evaluation = await repos.items.create(checklistItemInput({ title: 'Evaluation Gate' }))
    await provider.linkNextPhase(planning.id, evaluation.id)
    expect(await provider.getPreviousPhase(evaluation.id)).toEqual([planning.id])
  })

  it('a checklist with no prior phase returns empty', async () => {
    const item = await repos.items.create(checklistItemInput())
    expect(await provider.getPreviousPhase(item.id)).toEqual([])
  })
})

describe('getRequiredBy (incoming USES_CHECKLIST)', () => {
  it('finds items that declared they use this checklist', async () => {
    const checklist = await repos.items.create(checklistItemInput())
    const method = await repos.items.create({ ...checklistItemInput({ domain: 'procurement', title: 'OPEN_TENDER' }) })
    await graph.addEdge(method.id, checklist.id, KNOWLEDGE_RELATION_TYPES.USES_CHECKLIST)
    expect(await provider.getRequiredBy(checklist.id)).toEqual([method.id])
  })

  it('returns empty when nothing references this checklist', async () => {
    const item = await repos.items.create(checklistItemInput())
    expect(await provider.getRequiredBy(item.id)).toEqual([])
  })
})
