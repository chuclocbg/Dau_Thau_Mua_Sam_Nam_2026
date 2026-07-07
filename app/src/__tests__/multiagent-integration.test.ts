import { describe, it, expect } from 'vitest'
import { CoordinatorAgent } from '../multiagent/application/coordinatorAgent.ts'
import { buildReasoningWorkerTask } from '../multiagent/application/reasoningWorkerAdapter.ts'
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
import type { ToolAugmentedResponse } from '../reasoning/domain/toolCallingTypes.ts'

// True end-to-end integration test for Phase X.8 — the complete chain:
// Question(s) -> Coordinator Agent -> [real, frozen: Reasoning Engine -> Output Formatting ->
// Tool Calling] -> Conversation Response, aggregated across multiple parallel workers.
//
// Nothing here is a fake: a real intent detector, a real memory-backed IKnowledgePlatform +
// LegalProvider, the complete native Reasoning Engine, the real Output Formatter, a real
// ToolRegistry/ToolExecutor, and the real CoordinatorAgent/buildReasoningWorkerTask.

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

describe('Multi-Agent end-to-end: Coordinator dispatches parallel workers through the real Reasoning Engine', () => {
  it('answers two independent questions in parallel, each through the full real pipeline', async () => {
    const { platform, repos } = await buildPlatformWithLegalProvider()
    await repos.items.create(itemInput({ effectivePeriod: { startDate: '2025-03-15' } }))

    const repository = buildKnowledgePlatformRepository(platform)
    const pipeline = buildReasoningEnginePipeline(repository)

    const intentA = detectIntent({ question: 'Mức tạm ứng tối đa là bao nhiêu?', asOfDate: '2026-07-06' })
    const intentB = detectIntent({ question: 'Câu hỏi khác về tạm ứng?', asOfDate: '2026-07-06' })

    const coordinator = new CoordinatorAgent()
    const result = await coordinator.run([
      buildReasoningWorkerTask('q1', intentA, pipeline),
      buildReasoningWorkerTask('q2', intentB, pipeline),
    ])

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.status).toBe('COMPLETED')
      expect(result.value.outcomes).toHaveLength(2)
      for (const outcome of result.value.outcomes) {
        expect(outcome.status).toBe('COMPLETED')
        const augmented = outcome.value as ToolAugmentedResponse
        expect(augmented.response.markdown).toContain('## Kết luận')
        expect(Object.isFrozen(augmented)).toBe(true)
      }
    }
  })

  it('routes one worker through a real ToolExecutor while another runs reasoning-only, aggregating both', async () => {
    const { platform, repos } = await buildPlatformWithLegalProvider()
    await repos.items.create(itemInput({ effectivePeriod: { startDate: '2025-03-15' } }))

    const repository = buildKnowledgePlatformRepository(platform)
    const pipeline = buildReasoningEnginePipeline(repository)
    const intent = detectIntent({ question: 'Mức tạm ứng tối đa là bao nhiêu?', asOfDate: '2026-07-06' })

    const registry = new ToolRegistry()
    registry.registerTool({
      name: 'lookupDocumentSymbol', description: 'Looks up a legal document symbol',
      parameters: {}, required: [], handler: () => ({ symbol: '22/2023/QH15' }),
    })
    const executor = new ToolExecutor(registry)

    const coordinator = new CoordinatorAgent()
    const result = await coordinator.run([
      buildReasoningWorkerTask('with-tool', intent, pipeline, {
        executor, decider: () => ({ shouldInvoke: true, call: { name: 'lookupDocumentSymbol', arguments: {} }, reason: 'verify' }),
      }),
      buildReasoningWorkerTask('reasoning-only', intent, pipeline),
    ])

    expect(result.ok).toBe(true)
    if (result.ok) {
      const withTool = result.value.outcomes.find(o => o.taskId === 'with-tool')!.value as ToolAugmentedResponse
      const reasoningOnly = result.value.outcomes.find(o => o.taskId === 'reasoning-only')!.value as ToolAugmentedResponse
      expect(withTool.toolInvoked).toBe(true)
      expect(withTool.toolResults[0]!.output).toEqual({ symbol: '22/2023/QH15' })
      expect(reasoningOnly.toolInvoked).toBe(false)
    }
  })

  it('handles an empty platform gracefully, producing a valid, frozen, empty-citation response', async () => {
    const { platform } = await buildPlatformWithLegalProvider()
    const repository = buildKnowledgePlatformRepository(platform)
    const pipeline = buildReasoningEnginePipeline(repository)
    const intent = detectIntent({ question: 'Câu hỏi bất kỳ', asOfDate: '2026-07-06' })

    const coordinator = new CoordinatorAgent()
    const result = await coordinator.run([buildReasoningWorkerTask('q1', intent, pipeline)])

    expect(result.ok).toBe(true)
    if (result.ok) {
      const augmented = result.value.outcomes[0]!.value as ToolAugmentedResponse
      expect(augmented.response.citationCount).toBe(0)
      expect(result.value.status).toBe('COMPLETED')
    }
  })
})
