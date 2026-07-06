import { describe, it, expect } from 'vitest'
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

// End-to-end integration test — mirrors the real-platform pattern already proven across X.3.2,
// X.4.1, X.4.2, X.4.3, X.4.4, and X.4.5. Exercises the first full chain from a raw question
// string through a real intent detector, a real memory-backed IKnowledgePlatform + LegalProvider,
// X.3.7's FinalKnowledgeResolutionPipeline, X.4.2's assembleReasoningContext(), X.4.3's
// evaluateRules(), X.4.4's resolveConflicts(), X.4.5's evaluateConfidence(), and this milestone's
// generateCitations() - not fakes at any layer.

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

describe('generateCitations — real-platform end-to-end integration', () => {
  it('cites a real, platform-seeded, uncontested item with a traceable citation', async () => {
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
    const result = generateCitations(context, conflictResolution, confidenceEvaluation)

    // No conflicts and no passing rule/threshold back this item, so - matching the real engine's
    // own exact behavior - it stays at the default SUPPORTING_BASIS role, not PRIMARY_BASIS.
    // PRIMARY_BASIS only ever comes from winning a conflict or backing a passing rule/threshold.
    expect(result.citations).toHaveLength(1)
    expect(result.citations[0]!.documentSymbol).toBe('22/2023/QH15')
    expect(result.citations[0]!.role).toBe('SUPPORTING_BASIS')
    expect(result.citations[0]!.isNormative).toBe(true)
  })

  it('cites both sides of a real, platform-seeded hierarchy conflict, marking only the winner primary', async () => {
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
    const result = generateCitations(context, conflictResolution, confidenceEvaluation)

    expect(result.citations).toHaveLength(2)
    expect(result.citations.filter(c => c.isPrimary)).toHaveLength(1)
    expect(result.citations.find(c => c.documentSymbol === '22/2023/QH15')?.isPrimary).toBe(true)
  })

  it('produces no citations, never throwing, when the platform has no seeded items', async () => {
    const { platform } = await buildPlatformWithLegalProvider()
    const repository = buildKnowledgePlatformRepository(platform)
    const pipeline = buildFinalKnowledgeResolutionPipeline(repository)

    const intent = detectIntent({ question: 'Câu hỏi bất kỳ', asOfDate: '2026-07-06' })
    const { knowledge } = await pipeline.resolve(intent)
    const context = assembleReasoningContext(intent, knowledge)
    const ruleEvaluation = evaluateRules(context)
    const conflictResolution = resolveConflicts(context, ruleEvaluation)
    const confidenceEvaluation = evaluateConfidence(context, ruleEvaluation, conflictResolution)
    const result = generateCitations(context, conflictResolution, confidenceEvaluation)

    expect(result.citations).toEqual([])
    expect(Object.isFrozen(result)).toBe(true)
  })
})
