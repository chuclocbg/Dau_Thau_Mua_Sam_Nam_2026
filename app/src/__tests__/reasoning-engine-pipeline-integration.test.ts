import { describe, it, expect } from 'vitest'
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

// True end-to-end integration test — the culmination of the real-platform pattern proven across
// X.3.2 and every X.4.x sub-milestone. Exercises the ENTIRE Reasoning Engine (X.4.1's knowledge
// resolution front-end through X.4.7's answer composition) via the single public entry point,
// against a real memory-backed IKnowledgePlatform + LegalProvider — not fakes, and not a
// hand-assembled chain of individual stage calls (every other X.4.x integration test already
// proved those individually; this proves the ONE new entry point wires them identically).

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

describe('ReasoningEnginePipeline — true end-to-end integration (the complete Reasoning Engine)', () => {
  it('answers a real, platform-seeded, uncontested question with a structured, cited, confident answer', async () => {
    const { platform, repos } = await buildPlatformWithLegalProvider()
    await repos.items.create(itemInput({ effectivePeriod: { startDate: '2025-03-15' } }))

    const repository = buildKnowledgePlatformRepository(platform)
    const engine = buildReasoningEnginePipeline(repository)

    const intent = detectIntent({ question: 'Mức tạm ứng tối đa là bao nhiêu?', asOfDate: '2026-07-06' })
    const result = await engine.answer(intent)

    expect(result.supportingCitations).toHaveLength(1)
    expect(result.supportingCitations[0]!.documentSymbol).toBe('22/2023/QH15')
    expect(result.confidenceSummary.finalScore).toBeGreaterThan(0)
    expect(result.disputedCitations).toEqual([])
    expect(result.conflicts).toEqual([])
  })

  it('answers a real, platform-seeded hierarchy conflict end-to-end, correctly separating primary/disputed citations and reducing confidence', async () => {
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

    const result = await engine.answer(intent)

    expect(result.primaryCitations).toHaveLength(1)
    expect(result.primaryCitations[0]!.documentSymbol).toBe('22/2023/QH15')
    expect(result.disputedCitations).toHaveLength(1)
    expect(result.disputedCitations[0]!.documentSymbol).toBe('79/2025/TT-BTC')
    expect(result.conflicts).toHaveLength(1)
    expect(result.confidenceSummary.finalScore).toBeLessThan(1)
    expect(result.confidenceSummary.deductions.some(d => d.reason === 'RESOLVED_CONFLICT')).toBe(true)
  })

  it('excludes a real, platform-seeded item not yet effective as of the given date, end-to-end', async () => {
    const { platform, repos } = await buildPlatformWithLegalProvider()
    await repos.items.create(itemInput({ effectivePeriod: { startDate: '2099-01-01' } }))

    const repository = buildKnowledgePlatformRepository(platform)
    const engine = buildReasoningEnginePipeline(repository)
    const intent = detectIntent({ question: 'Mức tạm ứng tối đa là bao nhiêu?', asOfDate: '2026-07-06' })

    const result = await engine.answer(intent)

    expect(result.supportingCitations).toEqual([])
    expect(result.primaryCitations).toEqual([])
  })

  it('produces a valid, empty, frozen answer, never throwing, when the platform has no seeded items', async () => {
    const { platform } = await buildPlatformWithLegalProvider()
    const repository = buildKnowledgePlatformRepository(platform)
    const engine = buildReasoningEnginePipeline(repository)

    const intent = detectIntent({ question: 'Câu hỏi bất kỳ', asOfDate: '2026-07-06' })
    const result = await engine.answer(intent)

    expect(result.primaryCitations).toEqual([])
    expect(result.decision).toBeNull()
    expect(Object.isFrozen(result)).toBe(true)
  })
})

describe('ReasoningEnginePipeline — deterministic replay', () => {
  it('answering the same intent twice against the same platform state produces identical structured results (aside from wall-clock timestamps)', async () => {
    const { platform, repos } = await buildPlatformWithLegalProvider()
    await repos.items.create(itemInput({
      title: 'Luật gốc', legalBasis: [{ document: '22/2023/QH15', article: 'Điều 10' }],
      effectivePeriod: { startDate: '2025-01-01' },
    }))

    const repository = buildKnowledgePlatformRepository(platform)
    const engine = buildReasoningEnginePipeline(repository)
    const intent = detectIntent({ question: 'Mức tạm ứng tối đa là bao nhiêu?', asOfDate: '2026-07-06' })

    const first = await engine.answer(intent)
    const second = await engine.answer(intent)

    expect(first.primaryCitations.map(c => ({ ...c }))).toEqual(second.primaryCitations.map(c => ({ ...c })))
    expect(first.supportingCitations.map(c => ({ ...c }))).toEqual(second.supportingCitations.map(c => ({ ...c })))
    expect(first.disputedCitations).toEqual(second.disputedCitations)
    expect(first.confidenceSummary).toEqual(second.confidenceSummary)
    expect(first.conflicts).toEqual(second.conflicts)
    expect(first.decision).toEqual(second.decision)
  })

  it('two independently-constructed engine instances against the same platform produce identical results', async () => {
    const { platform, repos } = await buildPlatformWithLegalProvider()
    await repos.items.create(itemInput())

    const repository = buildKnowledgePlatformRepository(platform)
    const intent = detectIntent({ question: 'Mức tạm ứng tối đa là bao nhiêu?', asOfDate: '2026-07-06' })

    const resultA = await buildReasoningEnginePipeline(repository).answer(intent)
    const resultB = await buildReasoningEnginePipeline(repository).answer(intent)

    expect(resultA.supportingCitations).toEqual(resultB.supportingCitations)
    expect(resultA.confidenceSummary).toEqual(resultB.confidenceSummary)
  })
})
