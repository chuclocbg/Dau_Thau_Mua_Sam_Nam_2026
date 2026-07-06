import { describe, it, expect } from 'vitest'
import { evaluateConfidence } from '../reasoning/application/confidenceEvaluationStage.ts'
import { resolveConflicts } from '../reasoning/application/conflictResolutionStage.ts'
import { assembleReasoningContext } from '../reasoning/application/reasoningContextAssembler.ts'
import { evaluateRules } from '../reasoning/application/ruleEvaluationStage.ts'
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

// End-to-end integration test — mirrors the real-platform pattern already proven across X.3.2,
// X.4.1, X.4.2, X.4.3, and X.4.4. Exercises the first full chain from a raw question string
// through a real intent detector, a real memory-backed IKnowledgePlatform + LegalProvider,
// X.3.7's FinalKnowledgeResolutionPipeline, X.4.2's assembleReasoningContext(), X.4.3's
// evaluateRules(), X.4.4's resolveConflicts(), and this milestone's evaluateConfidence() - not
// fakes at any layer.

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

describe('evaluateConfidence — real-platform end-to-end integration', () => {
  it('scores a real, platform-seeded, uncontested item with high confidence', async () => {
    const { platform, repos } = await buildPlatformWithLegalProvider()
    await repos.items.create(itemInput({ effectivePeriod: { startDate: '2025-03-15' } }))

    const repository = buildKnowledgePlatformRepository(platform)
    const pipeline = buildFinalKnowledgeResolutionPipeline(repository)

    const intent = detectIntent({
      question: 'Mức tạm ứng tối đa là bao nhiêu?', asOfDate: '2026-07-06',
      context: { packageType: 'GOODS', fundSource: 'STATE_BUDGET', procurementMethod: 'OPEN_TENDER' },
    })
    const { knowledge } = await pipeline.resolve(intent)
    const context = assembleReasoningContext(intent, knowledge)
    const ruleEvaluation = evaluateRules(context)
    const conflictResolution = resolveConflicts(context, ruleEvaluation)
    const result = evaluateConfidence(context, ruleEvaluation, conflictResolution)

    expect(result.confidence.finalScore).toBe(1)
    expect(result.confidence.label).toBe('HIGH')
    expect(result.supportingEvidence).toHaveLength(1)
    expect(result.rejectedEvidence).toEqual([])
  })

  it('scores a real, platform-seeded hierarchy conflict with a reduced confidence and correct evidence weights', async () => {
    const { platform, repos } = await buildPlatformWithLegalProvider()
    await repos.items.create(itemInput({
      title: 'Luật gốc', type: 'LAW', effectivePeriod: { startDate: '2025-01-01' },
      metadata: { conflictDimension: 'ADVANCE_PAYMENT_CAP', conflictValue: '30' },
    }))
    await repos.items.create(itemInput({
      title: 'Thông tư mâu thuẫn', type: 'CIRCULAR', effectivePeriod: { startDate: '2025-01-01' },
      metadata: { conflictDimension: 'ADVANCE_PAYMENT_CAP', conflictValue: '20' },
    }))

    const repository = buildKnowledgePlatformRepository(platform)
    const pipeline = buildFinalKnowledgeResolutionPipeline(repository)
    const intent = detectIntent({
      question: 'Mức tạm ứng tối đa là bao nhiêu?', asOfDate: '2026-07-06',
      context: { packageType: 'GOODS', fundSource: 'STATE_BUDGET', procurementMethod: 'OPEN_TENDER' },
    })
    const { knowledge } = await pipeline.resolve(intent)
    const context = assembleReasoningContext(intent, knowledge)
    const ruleEvaluation = evaluateRules(context)
    const conflictResolution = resolveConflicts(context, ruleEvaluation)
    const result = evaluateConfidence(context, ruleEvaluation, conflictResolution)

    expect(result.confidence.finalScore).toBeLessThan(1)
    expect(result.confidence.deductions.some(d => d.reason === 'RESOLVED_CONFLICT')).toBe(true)
    expect(result.supportingEvidence).toHaveLength(1)
    expect(result.rejectedEvidence).toHaveLength(1)
  })

  it('produces a valid, frozen result, never throwing, when the platform has no seeded items', async () => {
    const { platform } = await buildPlatformWithLegalProvider()
    const repository = buildKnowledgePlatformRepository(platform)
    const pipeline = buildFinalKnowledgeResolutionPipeline(repository)

    const intent = detectIntent({ question: 'Câu hỏi bất kỳ', asOfDate: '2026-07-06' })
    const { knowledge } = await pipeline.resolve(intent)
    const context = assembleReasoningContext(intent, knowledge)
    const ruleEvaluation = evaluateRules(context)
    const conflictResolution = resolveConflicts(context, ruleEvaluation)
    const result = evaluateConfidence(context, ruleEvaluation, conflictResolution)

    expect(result.supportingEvidence).toEqual([])
    expect(Object.isFrozen(result)).toBe(true)
  })
})
