import { describe, it, expect, beforeEach } from 'vitest'
import { BestPracticeProvider } from '../knowledge/providers/bestpractice/bestPracticeProvider.ts'
import { buildMemoryKnowledgeRepositories } from '../knowledge/repositories/memoryKnowledgeRepositories.ts'
import { KnowledgeGraphService } from '../knowledge/graph/knowledgeGraph.ts'
import type { KnowledgeRepositories } from '../knowledge/repositories/knowledgeRepositories.ts'
import type { IKnowledgeGraph } from '../knowledge/graph/knowledgeGraph.ts'
import type { KnowledgeItem } from '../knowledge/platform/knowledgeTypes.ts'

function bestPracticeItemInput(overrides: Partial<KnowledgeItem> = {}): Omit<KnowledgeItem, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    domain: 'bestpractice', provider: 'BestPracticeProvider', type: 'IMPLEMENTATION_PATTERN',
    title: 'Quy trình đánh giá HSDT chuẩn', summary: 'Thực hành tốt cho quy trình đánh giá hồ sơ dự thầu',
    keywords: ['đánh giá'], legalBasis: [], relatedItems: [], metadata: {}, confidence: 1.0,
    attachments: [], layer: 4, language: 'vi', isActive: true, version: '1',
    ...overrides,
  }
}

let repos: KnowledgeRepositories
let graph: IKnowledgeGraph
let provider: BestPracticeProvider

beforeEach(() => {
  repos = buildMemoryKnowledgeRepositories()
  graph = new KnowledgeGraphService(repos.relations)
  provider = new BestPracticeProvider(repos, graph)
})

describe('identity', () => {
  it('reports domain=bestpractice, layer=4', () => {
    expect(provider.domain).toBe('bestpractice')
    expect(provider.layer).toBe(4)
  })
})

describe('search()', () => {
  it('finds an item by keyword within its own domain', async () => {
    await repos.items.create(bestPracticeItemInput())
    const results = await provider.search({ text: 'đánh giá' })
    expect(results).toHaveLength(1)
    expect(results[0].matchedDomain).toBe('bestpractice')
  })

  it('never returns items from another domain', async () => {
    await repos.items.create(bestPracticeItemInput({ domain: 'cases', title: 'đánh giá case' }))
    expect(await provider.search({ text: 'đánh giá' })).toEqual([])
  })
})

describe('resolve()', () => {
  it('resolves an item it owns', async () => {
    const item = await repos.items.create(bestPracticeItemInput())
    expect((await provider.resolve(item.id))?.id).toBe(item.id)
  })

  it('refuses to resolve an item from a different domain', async () => {
    const item = await repos.items.create(bestPracticeItemInput({ domain: 'ai_feedback' }))
    expect(await provider.resolve(item.id)).toBeNull()
  })
})

describe('suggest()', () => {
  it('suggests applicable items with a best-practice-specific reason including procurement method', async () => {
    await repos.items.create(bestPracticeItemInput())
    const suggestions = await provider.suggest({ procurementMethod: 'Chào hàng cạnh tranh' })
    expect(suggestions[0].reason).toContain('best practice')
    expect(suggestions[0].reason).toContain('Chào hàng cạnh tranh')
  })

  it('respects applicability rules', async () => {
    const item = await repos.items.create(bestPracticeItemInput())
    await repos.applicability.create({ itemId: item.id, isActive: true, effectiveFrom: '2020-01-01', procurementMethods: ['DAU_THAU_RONG_RAI'] })
    expect(await provider.suggest({ procurementMethod: 'CHI_DINH_THAU' })).toEqual([])
  })
})

describe('score()', () => {
  it('scores an applicable item at its confidence', async () => {
    const item = await repos.items.create(bestPracticeItemInput({ confidence: 0.7 }))
    expect(await provider.score(item.id, {})).toBe(0.7)
  })
})

describe('graph integration — pattern implementation linkage (IMPLEMENTS)', () => {
  it('links and retrieves an implemented pattern', async () => {
    const bestPractice = await repos.items.create(bestPracticeItemInput())
    const pattern = await repos.items.create(bestPracticeItemInput({ type: 'ARCHITECTURE_PATTERN', title: 'Hexagonal architecture' }))
    await provider.linkImplementsPattern(bestPractice.id, pattern.id)
    expect(await provider.getImplementedPatterns(bestPractice.id)).toEqual([pattern.id])
  })

  it('a best practice with no linked pattern returns empty', async () => {
    const bestPractice = await repos.items.create(bestPracticeItemInput())
    expect(await provider.getImplementedPatterns(bestPractice.id)).toEqual([])
  })
})

describe('graph integration — case derivation (new relation type DERIVED_FROM)', () => {
  it('links and retrieves a derived-from case', async () => {
    const bestPractice = await repos.items.create(bestPracticeItemInput())
    const caseItem = await repos.items.create(bestPracticeItemInput({ domain: 'cases', type: 'PRECEDENT_CASE', title: 'Case that motivated this practice' }))
    await provider.linkDerivedFromCase(bestPractice.id, caseItem.id)
    expect(await provider.getDerivedFromCases(bestPractice.id)).toEqual([caseItem.id])
  })

  it('IMPLEMENTS and DERIVED_FROM remain independent on the same item', async () => {
    const bestPractice = await repos.items.create(bestPracticeItemInput())
    const pattern = await repos.items.create(bestPracticeItemInput({ type: 'ARCHITECTURE_PATTERN' }))
    const caseItem = await repos.items.create(bestPracticeItemInput({ domain: 'cases', type: 'PRECEDENT_CASE' }))
    await provider.linkImplementsPattern(bestPractice.id, pattern.id)
    await provider.linkDerivedFromCase(bestPractice.id, caseItem.id)
    expect(await provider.getImplementedPatterns(bestPractice.id)).toEqual([pattern.id])
    expect(await provider.getDerivedFromCases(bestPractice.id)).toEqual([caseItem.id])
  })
})
