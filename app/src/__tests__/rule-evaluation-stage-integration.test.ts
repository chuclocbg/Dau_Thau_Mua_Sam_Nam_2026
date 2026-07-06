import { describe, it, expect } from 'vitest'
import { evaluateRules } from '../reasoning/application/ruleEvaluationStage.ts'
import { assembleReasoningContext } from '../reasoning/application/reasoningContextAssembler.ts'
import { buildFinalKnowledgeResolutionPipeline } from '../reasoning/application/finalKnowledgeResolutionPipeline.ts'
import { buildKnowledgePlatformRepository } from '../reasoning/infrastructure/knowledgePlatformRepository.ts'
import { detectIntent } from '../reasoning/application/intentDetector.ts'
import { DefaultKnowledgePlatform } from '../knowledge/platform/knowledgePlatform.ts'
import type { IKnowledgePlatform } from '../knowledge/platform/knowledgePlatform.ts'
import type { KnowledgeItem } from '../knowledge/platform/knowledgeTypes.ts'
import { LegalProvider } from '../knowledge/providers/legal/legalProvider.ts'
import { ProcurementProvider } from '../knowledge/providers/procurement/procurementProvider.ts'
import { buildMemoryKnowledgeRepositories } from '../knowledge/repositories/memoryKnowledgeRepositories.ts'
import { KnowledgeGraphService } from '../knowledge/graph/knowledgeGraph.ts'
import type { KnowledgeRepositories } from '../knowledge/repositories/knowledgeRepositories.ts'
import type { EvaluationRuleMetadata } from '../reasoning/domain/reasoningTypes.ts'

// End-to-end integration test — mirrors the real-platform pattern already proven across X.3.2,
// X.4.1, and X.4.2. Exercises the first full chain from a raw question string through a real
// intent detector, a real memory-backed IKnowledgePlatform + LegalProvider + ProcurementProvider,
// X.3.7's FinalKnowledgeResolutionPipeline, X.4.2's assembleReasoningContext(), and this
// milestone's evaluateRules() — not fakes at any layer.

const validRule: EvaluationRuleMetadata = {
  ruleCode: 'RULE-REAL-1', ruleCategory: 'PROCUREMENT_METHOD',
  conditions: [{ field: 'estimatedValue', operator: 'GTE', value: '100000000', unit: 'VND' }],
  outcome: { pass: 'Đấu thầu rộng rãi áp dụng', fail: 'Đấu thầu rộng rãi không áp dụng' },
  isCritical: true,
}

function itemInput(overrides: Partial<KnowledgeItem> = {}): Omit<KnowledgeItem, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    domain: 'procurement', provider: 'procurementProvider', type: 'EVALUATION_RULE',
    title: 'Quy tắc lựa chọn phương thức đấu thầu', summary: 'Quy tắc mẫu cho kiểm thử tích hợp.',
    keywords: ['đấu thầu'], legalBasis: [{ document: '22/2023/QH15', article: 'Điều 10' }],
    relatedItems: [], metadata: { ruleDefinition: JSON.stringify(validRule) }, confidence: 0.9,
    attachments: [], layer: 1, language: 'vi', isActive: true, version: '1',
    ...overrides,
  }
}

async function buildPlatformWithProviders(): Promise<{ platform: IKnowledgePlatform; repos: KnowledgeRepositories }> {
  const repos = buildMemoryKnowledgeRepositories()
  const graph = new KnowledgeGraphService(repos.relations)
  const platform = new DefaultKnowledgePlatform(repos)
  platform.registerProvider(new LegalProvider(repos, graph))
  platform.registerProvider(new ProcurementProvider(repos, graph))
  return { platform, repos }
}

describe('evaluateRules — real-platform end-to-end integration', () => {
  it('evaluates a real, platform-seeded rule item all the way through to a PASS result', async () => {
    const { platform, repos } = await buildPlatformWithProviders()
    await repos.items.create(itemInput({ effectivePeriod: { startDate: '2025-03-15' } }))

    const repository = buildKnowledgePlatformRepository(platform)
    const pipeline = buildFinalKnowledgeResolutionPipeline(repository)

    const intent = detectIntent({
      question: 'Có phải đấu thầu rộng rãi không?', asOfDate: '2026-07-06',
      context: { estimatedValue: 200_000_000n },
    })
    const { knowledge } = await pipeline.resolve(intent)
    const context = assembleReasoningContext(intent, knowledge)
    const result = evaluateRules(context)

    expect(result.ruleResults).toHaveLength(1)
    expect(result.ruleResults[0]!.ruleCode).toBe('RULE-REAL-1')
    expect(result.ruleResults[0]!.status).toBe('PASS')
    expect(result.ruleResults[0]!.legalBasis[0]!.documentSymbol).toBe('22/2023/QH15')
  })

  it('produces empty results, never throwing, when the platform has no seeded items', async () => {
    const { platform } = await buildPlatformWithProviders()
    const repository = buildKnowledgePlatformRepository(platform)
    const pipeline = buildFinalKnowledgeResolutionPipeline(repository)

    const intent = detectIntent({ question: 'Câu hỏi bất kỳ', asOfDate: '2026-07-06' })
    const { knowledge } = await pipeline.resolve(intent)
    const context = assembleReasoningContext(intent, knowledge)
    const result = evaluateRules(context)

    expect(result.ruleResults).toEqual([])
    expect(result.thresholdResults).toEqual([])
    expect(result.itemEvaluations).toEqual([])
  })

  it('produces a frozen, deterministic result from the full real chain', async () => {
    const { platform, repos } = await buildPlatformWithProviders()
    await repos.items.create(itemInput({ effectivePeriod: { startDate: '2025-03-15' } }))

    const repository = buildKnowledgePlatformRepository(platform)
    const pipeline = buildFinalKnowledgeResolutionPipeline(repository)
    const intent = detectIntent({
      question: 'Có phải đấu thầu rộng rãi không?', asOfDate: '2026-07-06',
      context: { estimatedValue: 200_000_000n },
    })
    const { knowledge } = await pipeline.resolve(intent)
    const context = assembleReasoningContext(intent, knowledge)

    const result = evaluateRules(context)

    expect(Object.isFrozen(result)).toBe(true)
    expect(() => { (result.ruleResults[0] as { status: string }).status = 'FAIL' }).toThrow()
  })
})
