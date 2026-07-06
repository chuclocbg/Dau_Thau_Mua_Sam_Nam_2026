import { describe, it, expect } from 'vitest'
import { buildReasoningOrchestrator } from '../reasoning/application/reasoningOrchestrator.ts'
import { buildKnowledgePlatformRepository } from '../reasoning/infrastructure/knowledgePlatformRepository.ts'
import { detectIntent } from '../reasoning/application/intentDetector.ts'
import { DefaultKnowledgePlatform } from '../knowledge/platform/knowledgePlatform.ts'
import type { IKnowledgePlatform } from '../knowledge/platform/knowledgePlatform.ts'
import type { KnowledgeItem } from '../knowledge/platform/knowledgeTypes.ts'
import { LegalProvider } from '../knowledge/providers/legal/legalProvider.ts'
import { buildMemoryKnowledgeRepositories } from '../knowledge/repositories/memoryKnowledgeRepositories.ts'
import { KnowledgeGraphService } from '../knowledge/graph/knowledgeGraph.ts'
import type { KnowledgeRepositories } from '../knowledge/repositories/knowledgeRepositories.ts'

// End-to-end integration test — mirrors the exact real-platform pattern already proven in
// knowledge-platform-repository.test.ts (X.3.2). Exercises the first full chain from a raw
// question string, through a real intent detector, a real memory-backed IKnowledgePlatform +
// LegalProvider, X.3.7's FinalKnowledgeResolutionPipeline, and a real LegalReasoningEngine — not
// fakes at any layer.

function itemInput(overrides: Partial<KnowledgeItem> = {}): Omit<KnowledgeItem, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    domain: 'legal', provider: 'legalProvider', type: 'CIRCULAR', title: 'Thông tư 79/2025/TT-BTC',
    summary: 'Mức tạm ứng tối đa 30%.', keywords: ['tạm ứng'],
    legalBasis: [{ document: '79/2025/TT-BTC', article: 'Điều 15', clause: 'khoản 1' }],
    relatedItems: [], metadata: {}, confidence: 0.9, attachments: [],
    layer: 1, language: 'vi', isActive: true, version: '1',
    ...overrides,
  }
}

async function buildPlatformWithLegalProvider(): Promise<{ platform: IKnowledgePlatform; repos: KnowledgeRepositories }> {
  const repos = buildMemoryKnowledgeRepositories()
  const graph = new KnowledgeGraphService(repos.relations)
  const platform = new DefaultKnowledgePlatform(repos)
  platform.registerProvider(new LegalProvider(repos, graph))
  return { platform, repos }
}

describe('ReasoningOrchestrator — real-platform end-to-end integration', () => {
  it('resolves a real, platform-seeded KnowledgeItem and reasons over it, producing a traceable citation', async () => {
    const { platform, repos } = await buildPlatformWithLegalProvider()
    await repos.items.create(itemInput({ effectivePeriod: { startDate: '2025-03-15' } }))

    const repository = buildKnowledgePlatformRepository(platform)
    const orchestrator = buildReasoningOrchestrator(repository)

    const intent = detectIntent({ question: 'Mức tạm ứng tối đa là bao nhiêu?', asOfDate: '2026-07-06' })
    const result = await orchestrator.answer(intent)

    expect(result.resolvedKnowledge.legalItems.map(i => i.title)).toContain('Thông tư 79/2025/TT-BTC')
    expect(result.appliedArticles.some(a => a.documentSymbol === '79/2025/TT-BTC')).toBe(true)
    expect(result.citations.some(c => c.documentSymbol === '79/2025/TT-BTC')).toBe(true)
  })

  it('produces no applied articles when the platform has no seeded items, without throwing', async () => {
    const { platform } = await buildPlatformWithLegalProvider()
    const repository = buildKnowledgePlatformRepository(platform)
    const orchestrator = buildReasoningOrchestrator(repository)

    const intent = detectIntent({ question: 'Câu hỏi bất kỳ', asOfDate: '2026-07-06' })
    const result = await orchestrator.answer(intent)

    expect(result.appliedArticles).toEqual([])
    expect(result.decision).toBeNull()
  })

  it('excludes an item not yet effective as of the given date (temporal filtering flows through end-to-end)', async () => {
    const { platform, repos } = await buildPlatformWithLegalProvider()
    await repos.items.create(itemInput({ effectivePeriod: { startDate: '2099-01-01' } }))

    const repository = buildKnowledgePlatformRepository(platform)
    const orchestrator = buildReasoningOrchestrator(repository)

    const intent = detectIntent({ question: 'Mức tạm ứng tối đa là bao nhiêu?', asOfDate: '2026-07-06' })
    const result = await orchestrator.answer(intent)

    expect(result.resolvedKnowledge.legalItems).toEqual([])
  })
})
