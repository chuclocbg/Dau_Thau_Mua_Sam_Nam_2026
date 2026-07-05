import { describe, it, expect } from 'vitest'
import { scoreKeyword, SearchEngine } from '../knowledge/search/searchEngine.ts'
import { NoOpEmbeddingAdapter } from '../knowledge/search/embeddingAdapter.ts'
import type { IEmbeddingAdapter } from '../knowledge/search/embeddingAdapter.ts'
import { MemoryVectorStoreAdapter } from '../knowledge/search/vectorStoreAdapter.ts'
import type { KnowledgeItem } from '../knowledge/platform/knowledgeTypes.ts'

function makeItem(overrides: Partial<KnowledgeItem> = {}): KnowledgeItem {
  return {
    id: 'i1', domain: 'legal', provider: 'LegalProvider', type: 'LAW',
    title: 'Luật Đấu thầu', summary: 'Quy định về đấu thầu công', keywords: ['đấu thầu', 'mua sắm công'],
    legalBasis: [], relatedItems: [], metadata: {}, confidence: 1.0, attachments: [],
    layer: 1, language: 'vi', isActive: true, version: '1',
    createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('scoreKeyword', () => {
  it('scores an exact keyword match highest', () => {
    const item = makeItem()
    expect(scoreKeyword('đấu thầu', item)).toBe(1.0)
  })

  it('scores a prefix match below exact', () => {
    const item = makeItem({ title: 'Luật Đấu thầu mở rộng' })
    expect(scoreKeyword('Luật Đấu thầu', item)).toBe(0.9)
  })

  it('scores a substring match below prefix', () => {
    const item = makeItem({ summary: 'văn bản về đấu thầu công khai' })
    expect(scoreKeyword('đấu thầu công khai', item)).toBeGreaterThanOrEqual(0.7)
  })

  it('scores zero for no match', () => {
    const item = makeItem()
    expect(scoreKeyword('hoàn toàn không liên quan', item)).toBe(0)
  })

  it('returns 0 for empty query text', () => {
    expect(scoreKeyword('', makeItem())).toBe(0)
    expect(scoreKeyword('   ', makeItem())).toBe(0)
  })

  it('is case-insensitive', () => {
    const item = makeItem({ title: 'HELLO WORLD' })
    expect(scoreKeyword('hello world', item)).toBe(1.0)
  })
})

describe('SearchEngine with default (NoOp) adapters', () => {
  it('falls back to pure keyword scoring when no embedding adapter is configured', async () => {
    const engine = new SearchEngine()
    const item = makeItem()
    const score = await engine.score('đấu thầu', item)
    expect(score).toBe(1.0)
  })

  it('index() is a safe no-op with the default NoOp embedding adapter', async () => {
    const engine = new SearchEngine()
    await expect(engine.index(makeItem())).resolves.toBeUndefined()
  })
})

describe('SearchEngine with a real (fake) embedding adapter', () => {
  class FixedVectorEmbeddingAdapter implements IEmbeddingAdapter {
    constructor(private readonly vector: readonly number[]) {}
    async embed(_text: string): Promise<readonly number[]> { return this.vector }
  }

  it('uses the semantic score when it exceeds the keyword score', async () => {
    const vectorStore = new MemoryVectorStoreAdapter()
    const embedding = new FixedVectorEmbeddingAdapter([1, 0, 0])
    const engine = new SearchEngine(embedding, vectorStore)

    const item = makeItem({ title: 'unrelated title', summary: 'unrelated summary', keywords: [] })
    await engine.index(item)

    const score = await engine.score('query text with no keyword overlap', item)
    expect(score).toBe(1) // perfect cosine similarity — same vector reused for query and item
  })

  it('takes the max of keyword and semantic signal', async () => {
    const vectorStore = new MemoryVectorStoreAdapter()
    const embedding = new FixedVectorEmbeddingAdapter([1, 0, 0])
    const engine = new SearchEngine(embedding, vectorStore)

    const item = makeItem({ title: 'đấu thầu' })
    await engine.index(item)

    const score = await engine.score('đấu thầu', item)
    expect(score).toBe(1.0) // keyword exact match ties semantic, max() picks either
  })
})

describe('MemoryVectorStoreAdapter', () => {
  it('returns empty results for an empty query vector', async () => {
    const store = new MemoryVectorStoreAdapter()
    await store.upsert('a', [1, 0, 0])
    expect(await store.query([], 10)).toEqual([])
  })

  it('returns empty results when nothing has been indexed', async () => {
    const store = new MemoryVectorStoreAdapter()
    expect(await store.query([1, 0, 0], 10)).toEqual([])
  })

  it('ranks by cosine similarity descending', async () => {
    const store = new MemoryVectorStoreAdapter()
    await store.upsert('orthogonal', [0, 1, 0])
    await store.upsert('identical', [1, 0, 0])
    const results = await store.query([1, 0, 0], 10)
    expect(results[0].itemId).toBe('identical')
    expect(results[0].score).toBeCloseTo(1, 5)
  })

  it('excludes zero-similarity matches', async () => {
    const store = new MemoryVectorStoreAdapter()
    await store.upsert('orthogonal', [0, 1, 0])
    const results = await store.query([1, 0, 0], 10)
    expect(results).toEqual([])
  })

  it('remove() drops an item from future queries', async () => {
    const store = new MemoryVectorStoreAdapter()
    await store.upsert('a', [1, 0, 0])
    await store.remove('a')
    expect(await store.query([1, 0, 0], 10)).toEqual([])
  })

  it('respects the limit parameter', async () => {
    const store = new MemoryVectorStoreAdapter()
    await store.upsert('a', [1, 0, 0])
    await store.upsert('b', [1, 0.01, 0])
    const results = await store.query([1, 0, 0], 1)
    expect(results).toHaveLength(1)
  })
})

describe('NoOpEmbeddingAdapter', () => {
  it('always returns an empty vector', async () => {
    const adapter = new NoOpEmbeddingAdapter()
    expect(await adapter.embed('anything')).toEqual([])
  })
})
