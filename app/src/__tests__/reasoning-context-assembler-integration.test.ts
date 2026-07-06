import { describe, it, expect } from 'vitest'
import { assembleReasoningContext } from '../reasoning/application/reasoningContextAssembler.ts'
import { buildFinalKnowledgeResolutionPipeline } from '../reasoning/application/finalKnowledgeResolutionPipeline.ts'
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
// knowledge-platform-repository.test.ts (X.3.2) and reasoning-orchestrator-integration.test.ts
// (X.4.1). Exercises the first full chain from a raw question string through a real intent
// detector, a real memory-backed IKnowledgePlatform + LegalProvider, X.3.7's
// FinalKnowledgeResolutionPipeline, and this milestone's assembleReasoningContext() — not fakes
// at any layer — proving the assembled context is genuinely frozen and correctly populated from
// real platform data, not just fixture data.

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

describe('assembleReasoningContext — real-platform end-to-end integration', () => {
  it('assembles a genuinely frozen ReasoningExecutionContext from a real, platform-resolved item', async () => {
    const { platform, repos } = await buildPlatformWithLegalProvider()
    await repos.items.create(itemInput({ effectivePeriod: { startDate: '2025-03-15' } }))

    const repository = buildKnowledgePlatformRepository(platform)
    const pipeline = buildFinalKnowledgeResolutionPipeline(repository)

    const intent = detectIntent({ question: 'Mức tạm ứng tối đa là bao nhiêu?', asOfDate: '2026-07-06' })
    const { knowledge } = await pipeline.resolve(intent)
    const context = assembleReasoningContext(intent, knowledge)

    expect(context.legalItems.map(i => i.title)).toContain('Thông tư 79/2025/TT-BTC')
    expect(Object.isFrozen(context)).toBe(true)
    expect(Object.isFrozen(context.legalItems[0])).toBe(true)
    expect(() => { (context.legalItems[0] as { title: string }).title = 'mutated' }).toThrow()
  })

  it('excludes an item not yet effective as of the given date (temporal filtering preserved, not re-applied)', async () => {
    const { platform, repos } = await buildPlatformWithLegalProvider()
    await repos.items.create(itemInput({ effectivePeriod: { startDate: '2099-01-01' } }))

    const repository = buildKnowledgePlatformRepository(platform)
    const pipeline = buildFinalKnowledgeResolutionPipeline(repository)

    const intent = detectIntent({ question: 'Mức tạm ứng tối đa là bao nhiêu?', asOfDate: '2026-07-06' })
    const { knowledge } = await pipeline.resolve(intent)
    const context = assembleReasoningContext(intent, knowledge)

    expect(context.legalItems).toEqual([])
  })

  it('produces an empty, still-valid, frozen context when the platform has no seeded items', async () => {
    const { platform } = await buildPlatformWithLegalProvider()
    const repository = buildKnowledgePlatformRepository(platform)
    const pipeline = buildFinalKnowledgeResolutionPipeline(repository)

    const intent = detectIntent({ question: 'Câu hỏi bất kỳ', asOfDate: '2026-07-06' })
    const { knowledge } = await pipeline.resolve(intent)
    const context = assembleReasoningContext(intent, knowledge)

    expect(context.legalItems).toEqual([])
    expect(Object.isFrozen(context)).toBe(true)
  })
})
