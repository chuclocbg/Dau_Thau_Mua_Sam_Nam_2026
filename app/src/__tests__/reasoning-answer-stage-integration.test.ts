import { describe, it, expect } from 'vitest'
import { composeAnswer } from '../reasoning/application/reasoningAnswerStage.ts'
import { generateCitations } from '../reasoning/application/citationGenerationStage.ts'
import { resolveConflicts } from '../reasoning/application/conflictResolutionStage.ts'
import { evaluateConfidence } from '../reasoning/application/confidenceEvaluationStage.ts'
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

// End-to-end integration test — mirrors the real-platform pattern already proven across X.3.2
// and X.4.1-X.4.6. Exercises the first full chain from a raw question string through a real
// intent detector, a real memory-backed IKnowledgePlatform + LegalProvider, X.3.7's
// FinalKnowledgeResolutionPipeline, X.4.2's assembleReasoningContext(), X.4.3's evaluateRules(),
// X.4.4's resolveConflicts(), X.4.5's evaluateConfidence(), X.4.6's generateCitations(), and this
// milestone's composeAnswer() - not fakes at any layer.

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

describe('composeAnswer — real-platform end-to-end integration', () => {
  it('composes a structured answer for a real, platform-seeded, uncontested item', async () => {
    const { platform, repos } = await buildPlatformWithLegalProvider()
    await repos.items.create(itemInput({ effectivePeriod: { startDate: '2025-03-15' } }))

    const repository = buildKnowledgePlatformRepository(platform)
    const pipeline = buildFinalKnowledgeResolutionPipeline(repository)

    const intent = detectIntent({ question: 'Mức tạm ứng tối đa là bao nhiêu?', asOfDate: '2026-07-06' })
    const { knowledge } = await pipeline.resolve(intent)
    const context = assembleReasoningContext(intent, knowledge)
    const ruleEvaluation = evaluateRules(context)
    const conflictResolution = resolveConflicts(context, ruleEvaluation)
    const confidenceEvaluation = evaluateConfidence(context, ruleEvaluation, conflictResolution)
    const citationGeneration = generateCitations(context, conflictResolution, confidenceEvaluation)
    const result = composeAnswer(context, conflictResolution, confidenceEvaluation, citationGeneration)

    expect(result.supportingCitations).toHaveLength(1)
    expect(result.supportingCitations[0]!.documentSymbol).toBe('22/2023/QH15')
    expect(result.confidenceSummary.finalScore).toBe(confidenceEvaluation.confidence.finalScore)
    expect(result.conflicts).toEqual([])
  })

  it('composes a structured answer for a real, platform-seeded hierarchy conflict, primary/disputed correctly separated', async () => {
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
    const pipeline = buildFinalKnowledgeResolutionPipeline(repository)
    const intent = detectIntent({ question: 'Mức tạm ứng tối đa là bao nhiêu?', asOfDate: '2026-07-06' })
    const { knowledge } = await pipeline.resolve(intent)
    const context = assembleReasoningContext(intent, knowledge)
    const ruleEvaluation = evaluateRules(context)
    const conflictResolution = resolveConflicts(context, ruleEvaluation)
    const confidenceEvaluation = evaluateConfidence(context, ruleEvaluation, conflictResolution)
    const citationGeneration = generateCitations(context, conflictResolution, confidenceEvaluation)
    const result = composeAnswer(context, conflictResolution, confidenceEvaluation, citationGeneration)

    expect(result.primaryCitations).toHaveLength(1)
    expect(result.primaryCitations[0]!.documentSymbol).toBe('22/2023/QH15')
    expect(result.disputedCitations).toHaveLength(1)
    expect(result.disputedCitations[0]!.documentSymbol).toBe('79/2025/TT-BTC')
    expect(result.conflicts).toHaveLength(1)
    expect(result.confidenceSummary.finalScore).toBeLessThan(1)
  })

  it('produces a valid, empty, frozen answer, never throwing, when the platform has no seeded items', async () => {
    const { platform } = await buildPlatformWithLegalProvider()
    const repository = buildKnowledgePlatformRepository(platform)
    const pipeline = buildFinalKnowledgeResolutionPipeline(repository)

    const intent = detectIntent({ question: 'Câu hỏi bất kỳ', asOfDate: '2026-07-06' })
    const { knowledge } = await pipeline.resolve(intent)
    const context = assembleReasoningContext(intent, knowledge)
    const ruleEvaluation = evaluateRules(context)
    const conflictResolution = resolveConflicts(context, ruleEvaluation)
    const confidenceEvaluation = evaluateConfidence(context, ruleEvaluation, conflictResolution)
    const citationGeneration = generateCitations(context, conflictResolution, confidenceEvaluation)
    const result = composeAnswer(context, conflictResolution, confidenceEvaluation, citationGeneration)

    expect(result.primaryCitations).toEqual([])
    expect(result.decision).toBeNull()
    expect(Object.isFrozen(result)).toBe(true)
  })
})
