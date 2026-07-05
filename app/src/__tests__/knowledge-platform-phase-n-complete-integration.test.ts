import { describe, it, expect, beforeEach } from 'vitest'
import { DefaultKnowledgePlatform } from '../knowledge/platform/knowledgePlatform.ts'
import type { IKnowledgePlatform } from '../knowledge/platform/knowledgePlatform.ts'
import { LegalProvider } from '../knowledge/providers/legal/legalProvider.ts'
import { ProcurementProvider } from '../knowledge/providers/procurement/procurementProvider.ts'
import { TemplateProvider } from '../knowledge/providers/templates/templateProvider.ts'
import { ChecklistProvider } from '../knowledge/providers/checklists/checklistProvider.ts'
import { OntologyProvider } from '../knowledge/providers/ontology/ontologyProvider.ts'
import { GlossaryProvider } from '../knowledge/providers/glossary/glossaryProvider.ts'
import { VendorKnowledgeProvider } from '../knowledge/providers/vendor/vendorKnowledgeProvider.ts'
import { AssetKnowledgeProvider } from '../knowledge/providers/asset/assetKnowledgeProvider.ts'
import { BudgetKnowledgeProvider } from '../knowledge/providers/budget/budgetKnowledgeProvider.ts'
import { NotificationKnowledgeProvider } from '../knowledge/providers/notification/notificationKnowledgeProvider.ts'
import { SchoolPolicyProvider } from '../knowledge/providers/school/schoolPolicyProvider.ts'
import { CaseProvider } from '../knowledge/providers/cases/caseProvider.ts'
import { RiskProvider } from '../knowledge/providers/risk/riskProvider.ts'
import { AuditProvider } from '../knowledge/providers/audit/auditProvider.ts'
import { BestPracticeProvider } from '../knowledge/providers/bestpractice/bestPracticeProvider.ts'
import { AIFeedbackProvider } from '../knowledge/providers/aifeedback/aiFeedbackProvider.ts'
import { buildMemoryKnowledgeRepositories } from '../knowledge/repositories/memoryKnowledgeRepositories.ts'
import { KnowledgeGraphService } from '../knowledge/graph/knowledgeGraph.ts'
import type { KnowledgeRepositories } from '../knowledge/repositories/knowledgeRepositories.ts'
import type { KnowledgeItem } from '../knowledge/platform/knowledgeTypes.ts'

// Phase N is now COMPLETE: all 16 providers from the frozen spec
// (.memory/knowledge-platform-frozen.md) registered on one platform instance,
// proving the architecture holds at full scale with zero core changes across
// Stage 1, Stage 2, and Batches 1-4.

const ALL_DOMAINS = [
  'legal', 'procurement', 'templates', 'checklists', 'ontology', 'glossary',
  'vendor', 'asset', 'budget', 'notification', 'school', 'cases', 'risk', 'audit',
  'bestpractice', 'ai_feedback',
] as const

function itemInput(domain: string, overrides: Partial<KnowledgeItem> = {}): Omit<KnowledgeItem, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    domain, provider: `${domain}Provider`, type: 'TEST', title: `${domain} item`, summary: 'S',
    keywords: [domain], legalBasis: [], relatedItems: [], metadata: {}, confidence: 0.8,
    attachments: [], layer: 2, language: 'vi', isActive: true, version: '1',
    ...overrides,
  }
}

let repos: KnowledgeRepositories
let platform: IKnowledgePlatform

beforeEach(() => {
  repos = buildMemoryKnowledgeRepositories()
  const graph = new KnowledgeGraphService(repos.relations)
  platform = new DefaultKnowledgePlatform(repos)
  platform.registerProvider(new LegalProvider(repos, graph))
  platform.registerProvider(new ProcurementProvider(repos, graph))
  platform.registerProvider(new TemplateProvider(repos, graph))
  platform.registerProvider(new ChecklistProvider(repos, graph))
  platform.registerProvider(new OntologyProvider(repos, graph))
  platform.registerProvider(new GlossaryProvider(repos, graph))
  platform.registerProvider(new VendorKnowledgeProvider(repos, graph))
  platform.registerProvider(new AssetKnowledgeProvider(repos, graph))
  platform.registerProvider(new BudgetKnowledgeProvider(repos, graph))
  platform.registerProvider(new NotificationKnowledgeProvider(repos, graph))
  platform.registerProvider(new SchoolPolicyProvider(repos, graph))
  platform.registerProvider(new CaseProvider(repos, graph))
  platform.registerProvider(new RiskProvider(repos, graph))
  platform.registerProvider(new AuditProvider(repos, graph))
  platform.registerProvider(new BestPracticeProvider(repos, graph))
  platform.registerProvider(new AIFeedbackProvider(repos, graph))
})

describe('all 16 providers register without conflict', () => {
  it('searchKnowledge with no domain filter searches all 16 simultaneously', async () => {
    for (const domain of ALL_DOMAINS) {
      await repos.items.create(itemInput(domain, { title: 'shared keyword item' }))
    }
    const results = await platform.searchKnowledge('shared keyword')
    expect(results).toHaveLength(16)
    expect(new Set(results.map(r => r.matchedDomain)).size).toBe(16)
  })
})

describe('resolveContext aggregates applicable items across all 16 domains at once', () => {
  it('returns one entry per registered domain', async () => {
    for (const domain of ALL_DOMAINS) {
      await repos.items.create(itemInput(domain))
    }
    const context = await platform.resolveContext({}, '2026-06-01')
    expect(Object.keys(context).sort()).toEqual([...ALL_DOMAINS].sort())
    for (const domain of Object.keys(context)) {
      expect(context[domain]).toHaveLength(1)
    }
  })
})

describe('named convenience method reaches BestPracticeProvider-backed data', () => {
  it('resolveBestPractice returns only the bestpractice domain', async () => {
    await repos.items.create(itemInput('bestpractice'))
    const result = await platform.resolveBestPractice({}, '2026-06-01')
    expect(result).toHaveLength(1)
    expect(result[0].domain).toBe('bestpractice')
  })
})

describe('AIFeedbackProvider has no named convenience method — reachable only through generic APIs', () => {
  it('is reachable via searchKnowledge, resolveApplicableDocuments, and resolveContext', async () => {
    const item = await repos.items.create(itemInput('ai_feedback', { title: 'unique feedback keyword' }))

    const searchResults = await platform.searchKnowledge('unique feedback keyword')
    expect(searchResults.some(r => r.item.id === item.id)).toBe(true)

    const applicable = await platform.resolveApplicableDocuments('ai_feedback', '2026-06-01', {})
    expect(applicable.map(i => i.id)).toContain(item.id)

    const context = await platform.resolveContext({}, '2026-06-01')
    expect(context['ai_feedback'].map(i => i.id)).toContain(item.id)
  })
})

describe('duplicate domain registration is still rejected at 16 providers', () => {
  it('throws when re-registering an already-claimed domain', () => {
    expect(() => platform.registerProvider(new BestPracticeProvider(repos, new KnowledgeGraphService(repos.relations))))
      .toThrow()
  })
})

describe('final 2 providers\' graph relationships remain independent of all 14 earlier providers', () => {
  it('BestPracticeProvider IMPLEMENTS/DERIVED_FROM and AIFeedbackProvider CORRECTS/RELATED_TO never cross-contaminate', async () => {
    const graph = new KnowledgeGraphService(repos.relations)
    const bestPracticeProvider = new BestPracticeProvider(repos, graph)
    const feedbackProvider = new AIFeedbackProvider(repos, graph)

    const bestPractice = await repos.items.create(itemInput('bestpractice', { title: 'Best Practice' }))
    const pattern = await repos.items.create(itemInput('bestpractice', { title: 'Pattern' }))
    const caseItem = await repos.items.create(itemInput('cases', { title: 'Case' }))
    await bestPracticeProvider.linkImplementsPattern(bestPractice.id, pattern.id)
    await bestPracticeProvider.linkDerivedFromCase(bestPractice.id, caseItem.id)

    const feedback = await repos.items.create(itemInput('ai_feedback', { title: 'Feedback' }))
    const corrected = await repos.items.create(itemInput('legal', { title: 'Corrected' }))
    await feedbackProvider.linkCorrection(feedback.id, corrected.id)
    await feedbackProvider.linkRelatedBestPractice(feedback.id, bestPractice.id)

    expect(await bestPracticeProvider.getImplementedPatterns(bestPractice.id)).toEqual([pattern.id])
    expect(await bestPracticeProvider.getDerivedFromCases(bestPractice.id)).toEqual([caseItem.id])
    expect(await feedbackProvider.getCorrectedItems(feedback.id)).toEqual([corrected.id])
    expect(await feedbackProvider.getRelatedBestPractices(feedback.id)).toEqual([bestPractice.id])

    // cross-checks: none of these unrelated relation types appear on the wrong item
    expect(await bestPracticeProvider.getImplementedPatterns(feedback.id)).toEqual([])
    expect(await feedbackProvider.getCorrectedItems(bestPractice.id)).toEqual([])
  })
})

describe('buildAIContext remains a thin, fixed-shape composition bundle at full 16-provider scale', () => {
  it('still returns exactly the AIKnowledgeContext shape — bestpractice/ai_feedback deliberately excluded', async () => {
    await repos.items.create(itemInput('legal'))
    await repos.items.create(itemInput('templates'))
    await repos.items.create(itemInput('checklists'))
    await repos.items.create(itemInput('bestpractice'))
    await repos.items.create(itemInput('risk'))
    await repos.items.create(itemInput('cases'))
    await repos.items.create(itemInput('ai_feedback'))

    const ctx = await platform.buildAIContext({}, '2026-06-01')
    expect(Object.keys(ctx).sort()).toEqual(
      ['bestPractices', 'cases', 'checklists', 'generatedAt', 'legalBasis', 'risks', 'templates'].sort(),
    )
    expect(ctx.bestPractices).toHaveLength(1)
    expect(ctx.bestPractices[0].domain).toBe('bestpractice')
    // ai_feedback is intentionally not part of AIKnowledgeContext (Phase X will consume it,
    // if at all, through a future explicit field — not by silently widening this frozen shape)
  })
})
