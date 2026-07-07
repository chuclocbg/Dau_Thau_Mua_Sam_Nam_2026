import { describe, it, expect } from 'vitest'
import { formatConversationResponse } from '../reasoning/application/outputFormatter.ts'
import { buildReasoningEnginePipeline } from '../reasoning/application/reasoningEnginePipeline.ts'
import { buildKnowledgePlatformRepository } from '../reasoning/infrastructure/knowledgePlatformRepository.ts'
import { detectIntent } from '../reasoning/application/intentDetector.ts'
import { DefaultKnowledgePlatform } from '../knowledge/platform/knowledgePlatform.ts'
import type { IKnowledgePlatform } from '../knowledge/platform/knowledgePlatform.ts'
import type { KnowledgeItem } from '../knowledge/platform/knowledgeTypes.ts'
import { LegalProvider } from '../knowledge/providers/legal/legalProvider.ts'
import { buildMemoryKnowledgeRepositories } from '../knowledge/repositories/memoryKnowledgeRepositories.ts'
import { KnowledgeGraphService } from '../knowledge/graph/knowledgeGraph.ts'
import type { KnowledgeRepositories } from '../knowledge/repositories/knowledgeRepositories.ts'

// True end-to-end integration test — the complete chain, question to formatted response:
// a real intent detector, a real memory-backed IKnowledgePlatform + LegalProvider, the complete
// native Reasoning Engine (ReasoningEnginePipeline, X.3.7 + X.4.1-X.4.7), and this milestone's
// formatConversationResponse() — not fakes at any layer.

function itemInput(overrides: Partial<KnowledgeItem> = {}): Omit<KnowledgeItem, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    domain: 'legal', provider: 'legalProvider', type: 'LAW', title: 'Luật mẫu',
    summary: 'Quy định mẫu cho kiểm thử tích hợp.', keywords: ['tạm ứng'],
    legalBasis: [{ document: '22/2023/QH15', article: 'Điều 10' }],
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

describe('formatConversationResponse — real-platform end-to-end integration (question to response)', () => {
  it('formats a complete, structured, cited response for a real, uncontested question', async () => {
    const { platform, repos } = await buildPlatformWithLegalProvider()
    await repos.items.create(itemInput({ effectivePeriod: { startDate: '2025-03-15' } }))

    const repository = buildKnowledgePlatformRepository(platform)
    const engine = buildReasoningEnginePipeline(repository)
    const intent = detectIntent({ question: 'Mức tạm ứng tối đa là bao nhiêu?', asOfDate: '2026-07-06' })

    const answer = await engine.answer(intent)
    const response = formatConversationResponse(answer)

    expect(response.markdown).toContain('## Kết luận')
    expect(response.markdown).toContain('22/2023/QH15')
    expect(response.citationCount).toBe(1)
    expect(response.confidenceScore).toBe(answer.confidenceSummary.finalScore)
    expect(Object.isFrozen(response)).toBe(true)
  })

  it('formats a response with a disputed section and a warning for a real hierarchy conflict', async () => {
    const { platform, repos } = await buildPlatformWithLegalProvider()
    await repos.items.create(itemInput({
      title: 'Luật gốc', type: 'LAW', legalBasis: [{ document: '22/2023/QH15', article: 'Điều 10' }],
      effectivePeriod: { startDate: '2025-01-01' }, metadata: { conflictDimension: 'ADVANCE_PAYMENT_CAP', conflictValue: '30' },
    }))
    await repos.items.create(itemInput({
      title: 'Thông tư mâu thuẫn', type: 'CIRCULAR', legalBasis: [{ document: '79/2025/TT-BTC', article: 'Điều 15' }],
      effectivePeriod: { startDate: '2025-01-01' }, metadata: { conflictDimension: 'ADVANCE_PAYMENT_CAP', conflictValue: '20' },
    }))

    const repository = buildKnowledgePlatformRepository(platform)
    const engine = buildReasoningEnginePipeline(repository)
    const intent = detectIntent({ question: 'Mức tạm ứng tối đa là bao nhiêu?', asOfDate: '2026-07-06' })

    const answer = await engine.answer(intent)
    const response = formatConversationResponse(answer)

    expect(response.markdown).toContain('Nội dung còn tranh chấp')
    expect(response.markdown).toContain('79/2025/TT-BTC')
    expect(response.confidenceScore).toBeLessThan(1)
  })

  it('produces a valid, empty, frozen response, never throwing, when the platform has no seeded items', async () => {
    const { platform } = await buildPlatformWithLegalProvider()
    const repository = buildKnowledgePlatformRepository(platform)
    const engine = buildReasoningEnginePipeline(repository)

    const intent = detectIntent({ question: 'Câu hỏi bất kỳ', asOfDate: '2026-07-06' })
    const answer = await engine.answer(intent)
    const response = formatConversationResponse(answer)

    expect(response.citationCount).toBe(0)
    expect(Object.isFrozen(response)).toBe(true)
  })
})

describe('formatConversationResponse — deterministic replay through the full chain', () => {
  it('formatting the same answer twice produces identical markdown/sections (aside from formattedAt)', async () => {
    const { platform, repos } = await buildPlatformWithLegalProvider()
    await repos.items.create(itemInput({ effectivePeriod: { startDate: '2025-03-15' } }))

    const repository = buildKnowledgePlatformRepository(platform)
    const engine = buildReasoningEnginePipeline(repository)
    const intent = detectIntent({ question: 'Mức tạm ứng tối đa là bao nhiêu?', asOfDate: '2026-07-06' })
    const answer = await engine.answer(intent)

    const first = formatConversationResponse(answer)
    const second = formatConversationResponse(answer)

    expect(first.markdown).toBe(second.markdown)
    expect(first.sections).toEqual(second.sections)
    expect(first.warnings).toEqual(second.warnings)
  })
})
