import { describe, it, expect, beforeEach } from 'vitest'
import { CaseProvider } from '../knowledge/providers/cases/caseProvider.ts'
import { buildMemoryKnowledgeRepositories } from '../knowledge/repositories/memoryKnowledgeRepositories.ts'
import { KnowledgeGraphService } from '../knowledge/graph/knowledgeGraph.ts'
import type { KnowledgeRepositories } from '../knowledge/repositories/knowledgeRepositories.ts'
import type { IKnowledgeGraph } from '../knowledge/graph/knowledgeGraph.ts'
import type { KnowledgeItem } from '../knowledge/platform/knowledgeTypes.ts'

function caseItemInput(overrides: Partial<KnowledgeItem> = {}): Omit<KnowledgeItem, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    domain: 'cases', provider: 'CaseProvider', type: 'PRECEDENT_CASE',
    title: 'Vụ việc chia nhỏ gói thầu', summary: 'Tiền lệ về chia nhỏ gói thầu để né hạn mức',
    keywords: ['chia nhỏ gói thầu'], legalBasis: [], relatedItems: [], metadata: {}, confidence: 1.0,
    attachments: [], layer: 4, language: 'vi', isActive: true, version: '1',
    ...overrides,
  }
}

let repos: KnowledgeRepositories
let graph: IKnowledgeGraph
let provider: CaseProvider

beforeEach(() => {
  repos = buildMemoryKnowledgeRepositories()
  graph = new KnowledgeGraphService(repos.relations)
  provider = new CaseProvider(repos, graph)
})

describe('identity', () => {
  it('reports domain=cases, layer=4', () => {
    expect(provider.domain).toBe('cases')
    expect(provider.layer).toBe(4)
  })
})

describe('search()', () => {
  it('finds an item by keyword within its own domain', async () => {
    await repos.items.create(caseItemInput())
    const results = await provider.search({ text: 'chia nhỏ gói thầu' })
    expect(results).toHaveLength(1)
    expect(results[0].matchedDomain).toBe('cases')
  })

  it('never returns items from another domain', async () => {
    await repos.items.create(caseItemInput({ domain: 'risk', title: 'chia nhỏ gói thầu risk' }))
    expect(await provider.search({ text: 'chia nhỏ gói thầu' })).toEqual([])
  })
})

describe('resolve()', () => {
  it('resolves an item it owns', async () => {
    const item = await repos.items.create(caseItemInput())
    expect((await provider.resolve(item.id))?.id).toBe(item.id)
  })

  it('refuses to resolve an item from a different domain', async () => {
    const item = await repos.items.create(caseItemInput({ domain: 'audit' }))
    expect(await provider.resolve(item.id)).toBeNull()
  })
})

describe('suggest()', () => {
  it('suggests applicable items with a case-specific reason', async () => {
    await repos.items.create(caseItemInput())
    const suggestions = await provider.suggest({})
    expect(suggestions[0].reason).toBe('Applicable precedent case')
  })
})

describe('score()', () => {
  it('scores an applicable item at its confidence', async () => {
    const item = await repos.items.create(caseItemInput({ confidence: 0.5 }))
    expect(await provider.score(item.id, {})).toBe(0.5)
  })
})

describe('graph integration — similar case linkage (reuses SIMILAR_TO)', () => {
  it('links and retrieves a similar case', async () => {
    const caseA = await repos.items.create(caseItemInput({ title: 'Case A' }))
    const caseB = await repos.items.create(caseItemInput({ title: 'Case B' }))
    await provider.linkSimilarCase(caseA.id, caseB.id)
    expect(await provider.getSimilarCases(caseA.id)).toEqual([caseB.id])
  })

  it('a case with no similar case returns empty', async () => {
    const item = await repos.items.create(caseItemInput())
    expect(await provider.getSimilarCases(item.id)).toEqual([])
  })
})

describe('graph integration — revealed risk linkage (new relation type REVEALED)', () => {
  it('links and retrieves a revealed risk', async () => {
    const caseItem = await repos.items.create(caseItemInput())
    const risk = await repos.items.create(caseItemInput({ domain: 'risk', type: 'RISK_PATTERN', title: 'Split-package risk' }))
    await provider.linkRevealedRisk(caseItem.id, risk.id)
    expect(await provider.getRevealedRisks(caseItem.id)).toEqual([risk.id])
  })

  it('SIMILAR_TO and REVEALED remain independent on the same item', async () => {
    const caseA = await repos.items.create(caseItemInput({ title: 'Case A' }))
    const caseB = await repos.items.create(caseItemInput({ title: 'Case B' }))
    const risk = await repos.items.create(caseItemInput({ domain: 'risk', type: 'RISK_PATTERN' }))
    await provider.linkSimilarCase(caseA.id, caseB.id)
    await provider.linkRevealedRisk(caseA.id, risk.id)
    expect(await provider.getSimilarCases(caseA.id)).toEqual([caseB.id])
    expect(await provider.getRevealedRisks(caseA.id)).toEqual([risk.id])
  })
})
