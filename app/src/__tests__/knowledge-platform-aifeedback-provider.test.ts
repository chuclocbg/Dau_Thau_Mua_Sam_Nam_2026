import { describe, it, expect, beforeEach } from 'vitest'
import { AIFeedbackProvider } from '../knowledge/providers/aifeedback/aiFeedbackProvider.ts'
import { buildMemoryKnowledgeRepositories } from '../knowledge/repositories/memoryKnowledgeRepositories.ts'
import { KnowledgeGraphService } from '../knowledge/graph/knowledgeGraph.ts'
import type { KnowledgeRepositories } from '../knowledge/repositories/knowledgeRepositories.ts'
import type { IKnowledgeGraph } from '../knowledge/graph/knowledgeGraph.ts'
import type { KnowledgeItem } from '../knowledge/platform/knowledgeTypes.ts'

function feedbackItemInput(overrides: Partial<KnowledgeItem> = {}): Omit<KnowledgeItem, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    domain: 'ai_feedback', provider: 'AIFeedbackProvider', type: 'REVIEWER_COMMENT',
    title: 'Sửa lỗi trích dẫn sai điều luật', summary: 'Phản hồi của người thẩm định về trích dẫn pháp lý sai',
    keywords: ['trích dẫn'], legalBasis: [], relatedItems: [], metadata: {}, confidence: 1.0,
    attachments: [], layer: 4, language: 'vi', isActive: true, version: '1',
    ...overrides,
  }
}

let repos: KnowledgeRepositories
let graph: IKnowledgeGraph
let provider: AIFeedbackProvider

beforeEach(() => {
  repos = buildMemoryKnowledgeRepositories()
  graph = new KnowledgeGraphService(repos.relations)
  provider = new AIFeedbackProvider(repos, graph)
})

describe('identity', () => {
  it('reports domain=ai_feedback, layer=4', () => {
    expect(provider.domain).toBe('ai_feedback')
    expect(provider.layer).toBe(4)
  })

  it('is a pure knowledge source — exposes no reasoning or LLM invocation methods', () => {
    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(provider))
    expect(methods).not.toContain('generate')
    expect(methods).not.toContain('reason')
    expect(methods).not.toContain('callModel')
    expect(methods).not.toContain('complete')
  })
})

describe('search()', () => {
  it('finds an item by keyword within its own domain', async () => {
    await repos.items.create(feedbackItemInput())
    const results = await provider.search({ text: 'trích dẫn' })
    expect(results).toHaveLength(1)
    expect(results[0].matchedDomain).toBe('ai_feedback')
  })

  it('never returns items from another domain', async () => {
    await repos.items.create(feedbackItemInput({ domain: 'legal', title: 'trích dẫn law' }))
    expect(await provider.search({ text: 'trích dẫn' })).toEqual([])
  })
})

describe('resolve()', () => {
  it('resolves an item it owns', async () => {
    const item = await repos.items.create(feedbackItemInput())
    expect((await provider.resolve(item.id))?.id).toBe(item.id)
  })

  it('refuses to resolve an item from a different domain', async () => {
    const item = await repos.items.create(feedbackItemInput({ domain: 'bestpractice' }))
    expect(await provider.resolve(item.id)).toBeNull()
  })
})

describe('suggest()', () => {
  it('suggests applicable items with an AI-feedback-specific reason', async () => {
    await repos.items.create(feedbackItemInput())
    const suggestions = await provider.suggest({})
    expect(suggestions[0].reason).toBe('Applicable AI feedback/quality observation')
  })
})

describe('score()', () => {
  it('scores an applicable item at its confidence', async () => {
    const item = await repos.items.create(feedbackItemInput({ confidence: 0.35 }))
    expect(await provider.score(item.id, {})).toBe(0.35)
  })
})

describe('graph integration — correction linkage (new relation type CORRECTS)', () => {
  it('links and retrieves a corrected item', async () => {
    const feedback = await repos.items.create(feedbackItemInput())
    const corrected = await repos.items.create(feedbackItemInput({ domain: 'legal', type: 'LAW', title: 'Original citation' }))
    await provider.linkCorrection(feedback.id, corrected.id)
    expect(await provider.getCorrectedItems(feedback.id)).toEqual([corrected.id])
  })

  it('feedback with no correction returns empty', async () => {
    const feedback = await repos.items.create(feedbackItemInput())
    expect(await provider.getCorrectedItems(feedback.id)).toEqual([])
  })
})

describe('graph integration — related best practice linkage (reuses RELATED_TO)', () => {
  it('links and retrieves a related best practice', async () => {
    const feedback = await repos.items.create(feedbackItemInput())
    const bestPractice = await repos.items.create(feedbackItemInput({ domain: 'bestpractice', type: 'IMPLEMENTATION_PATTERN', title: 'Citation verification step' }))
    await provider.linkRelatedBestPractice(feedback.id, bestPractice.id)
    expect(await provider.getRelatedBestPractices(feedback.id)).toEqual([bestPractice.id])
  })

  it('CORRECTS and RELATED_TO remain independent on the same item', async () => {
    const feedback = await repos.items.create(feedbackItemInput())
    const corrected = await repos.items.create(feedbackItemInput({ domain: 'legal', type: 'LAW' }))
    const bestPractice = await repos.items.create(feedbackItemInput({ domain: 'bestpractice', type: 'IMPLEMENTATION_PATTERN' }))
    await provider.linkCorrection(feedback.id, corrected.id)
    await provider.linkRelatedBestPractice(feedback.id, bestPractice.id)
    expect(await provider.getCorrectedItems(feedback.id)).toEqual([corrected.id])
    expect(await provider.getRelatedBestPractices(feedback.id)).toEqual([bestPractice.id])
  })
})
