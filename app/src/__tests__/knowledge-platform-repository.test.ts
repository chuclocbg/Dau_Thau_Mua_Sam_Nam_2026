import { describe, it, expect, beforeEach } from 'vitest'
import { DefaultKnowledgePlatform } from '../knowledge/platform/knowledgePlatform.ts'
import type { IKnowledgePlatform } from '../knowledge/platform/knowledgePlatform.ts'
import type { KnowledgeItem } from '../knowledge/platform/knowledgeTypes.ts'
import { LegalProvider } from '../knowledge/providers/legal/legalProvider.ts'
import { buildMemoryKnowledgeRepositories } from '../knowledge/repositories/memoryKnowledgeRepositories.ts'
import { KnowledgeGraphService } from '../knowledge/graph/knowledgeGraph.ts'
import type { KnowledgeRepositories } from '../knowledge/repositories/knowledgeRepositories.ts'
import { buildKnowledgePlatformRepository } from '../reasoning/infrastructure/knowledgePlatformRepository.ts'
import type { ReasoningContext } from '../reasoning/domain/reasoningTypes.ts'

// Mirrors the exact pattern already proven in
// knowledge-platform-phase-n-complete-integration.test.ts — a real, memory-backed
// IKnowledgePlatform with a real provider registered, never a fixture standing in for it.

function itemInput(overrides: Partial<KnowledgeItem> = {}): Omit<KnowledgeItem, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    domain: 'legal', provider: 'legalProvider', type: 'CIRCULAR', title: 'Thông tư 79/2025/TT-BTC',
    summary: 'Mức tạm ứng tối đa 30%.', keywords: ['tạm ứng'],
    legalBasis: [{ document: '79/2025/TT-BTC', article: 'Điều 15', clause: 'khoản 1' }],
    relatedItems: [], metadata: { concept: 'ADVANCE_PAYMENT' }, confidence: 0.9, attachments: [],
    layer: 1, language: 'vi', isActive: true, version: '1',
    ...overrides,
  }
}

function context(overrides: Partial<ReasoningContext> = {}): ReasoningContext {
  return { asOfDate: '2026-07-05', packageType: 'GOODS', fundSource: 'STATE_BUDGET', ...overrides }
}

async function buildPlatformWithLegalProvider(): Promise<{ platform: IKnowledgePlatform; repos: KnowledgeRepositories }> {
  const repos = buildMemoryKnowledgeRepositories()
  const graph = new KnowledgeGraphService(repos.relations)
  const platform = new DefaultKnowledgePlatform(repos)
  platform.registerProvider(new LegalProvider(repos, graph))
  return { platform, repos }
}

describe('KnowledgePlatformRepository.resolveKnowledge — repository tests + retrieval fixtures', () => {
  it('maps a real, platform-seeded KnowledgeItem into a correctly-shaped KnowledgeItemRef', async () => {
    const { platform, repos } = await buildPlatformWithLegalProvider()
    await repos.items.create(itemInput({ effectivePeriod: { startDate: '2025-03-15' } }))
    const repository = buildKnowledgePlatformRepository(platform)

    const result = await repository.resolveKnowledge('legal', context(), '2026-07-05')

    expect(result.items).toHaveLength(1)
    expect(result.items[0]!.title).toBe('Thông tư 79/2025/TT-BTC')
    expect(result.items[0]!.legalBasis[0]!.documentSymbol).toBe('79/2025/TT-BTC')
    expect(result.items[0]!.effectiveFrom).toBe('2025-03-15')
  })

  it('falls back to createdAt when effectivePeriod is absent, and reports it in effectivePeriodAssumedItemIds', async () => {
    const { platform, repos } = await buildPlatformWithLegalProvider()
    const created = await repos.items.create(itemInput({ effectivePeriod: undefined }))
    const repository = buildKnowledgePlatformRepository(platform)

    const result = await repository.resolveKnowledge('legal', context(), '2026-07-05')

    expect(result.items[0]!.effectiveFrom).toBe(created.createdAt.slice(0, 10))
    expect(result.effectivePeriodAssumedItemIds).toContain(created.id)
  })

  it('does not report effectivePeriodAssumedItemIds for an item that has an effectivePeriod', async () => {
    const { platform, repos } = await buildPlatformWithLegalProvider()
    await repos.items.create(itemInput({ effectivePeriod: { startDate: '2025-03-15' } }))
    const repository = buildKnowledgePlatformRepository(platform)

    const result = await repository.resolveKnowledge('legal', context(), '2026-07-05')

    expect(result.effectivePeriodAssumedItemIds).toEqual([])
  })

  it('relies on the platform\'s own temporal filtering — an item expired before asOfDate is excluded', async () => {
    const { platform, repos } = await buildPlatformWithLegalProvider()
    await repos.items.create(itemInput({ effectivePeriod: { startDate: '2025-01-01', endDate: '2025-06-30' } }))
    const repository = buildKnowledgePlatformRepository(platform)

    const result = await repository.resolveKnowledge('legal', context(), '2026-01-01')

    expect(result.items).toEqual([])
  })

  it('returns an empty result for a domain with no registered provider, never throws', async () => {
    const { platform } = await buildPlatformWithLegalProvider()
    const repository = buildKnowledgePlatformRepository(platform)

    const result = await repository.resolveKnowledge('procurement', context(), '2026-07-05')

    expect(result.items).toEqual([])
  })
})

describe('KnowledgePlatformRepository.searchKnowledge — repository tests + retrieval fixtures', () => {
  it('maps real search results and respects the limit, without adding its own ranking', async () => {
    const { platform, repos } = await buildPlatformWithLegalProvider()
    await repos.items.create(itemInput({ title: 'Tạm ứng A', summary: 'Mức tạm ứng tối đa 30%.' }))
    await repos.items.create(itemInput({ title: 'Tạm ứng B', summary: 'Mức tạm ứng tối đa 20%.' }))
    await repos.items.create(itemInput({ title: 'Tạm ứng C', summary: 'Mức tạm ứng tối đa 10%.' }))
    const repository = buildKnowledgePlatformRepository(platform)

    const direct = await platform.searchKnowledge('tạm ứng', ['legal'], { asOfDate: '2026-07-05' }, 2)
    const result = await repository.searchKnowledge('tạm ứng', ['legal'], context(), 2)

    expect(result.items).toHaveLength(2)
    expect(result.items.map(i => i.itemId)).toEqual(direct.map(r => r.item.id))
  })

  it('returns an empty result when nothing matches the query text', async () => {
    const { platform, repos } = await buildPlatformWithLegalProvider()
    await repos.items.create(itemInput())
    const repository = buildKnowledgePlatformRepository(platform)

    const result = await repository.searchKnowledge('không liên quan gì cả', ['legal'], context(), 5)

    expect(result.items).toEqual([])
  })
})

describe('KnowledgePlatformRepository — dependency injection', () => {
  it('the same repository class produces different results depending on which platform instance is injected', async () => {
    const seeded = await buildPlatformWithLegalProvider()
    await seeded.repos.items.create(itemInput())
    const emptyRepos = buildMemoryKnowledgeRepositories()
    const emptyPlatform = new DefaultKnowledgePlatform(emptyRepos)
    emptyPlatform.registerProvider(new LegalProvider(emptyRepos, new KnowledgeGraphService(emptyRepos.relations)))

    const seededRepository = buildKnowledgePlatformRepository(seeded.platform)
    const emptyRepository = buildKnowledgePlatformRepository(emptyPlatform)

    const seededResult = await seededRepository.resolveKnowledge('legal', context(), '2026-07-05')
    const emptyResult = await emptyRepository.resolveKnowledge('legal', context(), '2026-07-05')

    expect(seededResult.items).toHaveLength(1)
    expect(emptyResult.items).toHaveLength(0)
  })
})
