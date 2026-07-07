import { describe, it, expect } from 'vitest'
import { runToolCallingStage } from '../reasoning/application/toolCallingStage.ts'
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
import { ToolRegistry } from '../providers/ToolRegistry.ts'
import { ToolExecutor } from '../providers/ToolExecutor.ts'
import type { ToolDecider } from '../reasoning/domain/toolCallingTypes.ts'

// True end-to-end integration test — question to formatted response to tool-augmented response:
// a real intent detector, a real memory-backed IKnowledgePlatform + LegalProvider, the complete
// native Reasoning Engine, the real Output Formatter, and a real ToolRegistry/ToolExecutor with
// an actual registered tool — not fakes at any layer.

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

function buildLookupExecutor(): ToolExecutor {
  const registry = new ToolRegistry()
  registry.registerTool({
    name: 'lookupDocumentSymbol', description: 'Looks up a legal document symbol', parameters: {},
    required: [], handler: () => ({ found: true, symbol: '22/2023/QH15' }),
  })
  return new ToolExecutor(registry)
}

describe('runToolCallingStage — real-platform end-to-end integration (question to tool-augmented response)', () => {
  it('wraps a real formatted response untouched when the decider declines (default behavior)', async () => {
    const { platform, repos } = await buildPlatformWithLegalProvider()
    await repos.items.create(itemInput({ effectivePeriod: { startDate: '2025-03-15' } }))

    const repository = buildKnowledgePlatformRepository(platform)
    const engine = buildReasoningEnginePipeline(repository)
    const intent = detectIntent({ question: 'Mức tạm ứng tối đa là bao nhiêu?', asOfDate: '2026-07-06' })

    const answer = await engine.answer(intent)
    const response = formatConversationResponse(answer)
    const executor = buildLookupExecutor()

    const result = await runToolCallingStage(response, answer, executor)

    expect(result.toolInvoked).toBe(false)
    expect(result.response).toEqual(response)
    expect(Object.isFrozen(result)).toBe(true)
  })

  it('invokes a real registered tool through a real ToolExecutor and normalizes its output', async () => {
    const { platform, repos } = await buildPlatformWithLegalProvider()
    await repos.items.create(itemInput({ effectivePeriod: { startDate: '2025-03-15' } }))

    const repository = buildKnowledgePlatformRepository(platform)
    const engine = buildReasoningEnginePipeline(repository)
    const intent = detectIntent({ question: 'Mức tạm ứng tối đa là bao nhiêu?', asOfDate: '2026-07-06' })

    const answer = await engine.answer(intent)
    const response = formatConversationResponse(answer)
    const executor = buildLookupExecutor()

    const decider: ToolDecider = () => ({
      shouldInvoke: true, call: { name: 'lookupDocumentSymbol', arguments: {} }, reason: 'verification lookup',
    })
    const result = await runToolCallingStage(response, answer, executor, { decider })

    expect(result.toolInvoked).toBe(true)
    expect(result.toolResults[0]!.success).toBe(true)
    expect(result.toolResults[0]!.output).toEqual({ found: true, symbol: '22/2023/QH15' })
    expect(result.response.markdown).toBe(response.markdown)
  })

  it('produces a valid, frozen, tool-declined augmented response when the platform has no seeded items', async () => {
    const { platform } = await buildPlatformWithLegalProvider()
    const repository = buildKnowledgePlatformRepository(platform)
    const engine = buildReasoningEnginePipeline(repository)

    const intent = detectIntent({ question: 'Câu hỏi bất kỳ', asOfDate: '2026-07-06' })
    const answer = await engine.answer(intent)
    const response = formatConversationResponse(answer)
    const executor = buildLookupExecutor()

    const result = await runToolCallingStage(response, answer, executor)

    expect(result.toolInvoked).toBe(false)
    expect(result.response.citationCount).toBe(0)
    expect(Object.isFrozen(result)).toBe(true)
  })
})
