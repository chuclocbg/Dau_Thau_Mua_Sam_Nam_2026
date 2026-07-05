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
import { buildMemoryKnowledgeRepositories } from '../knowledge/repositories/memoryKnowledgeRepositories.ts'
import { KnowledgeGraphService } from '../knowledge/graph/knowledgeGraph.ts'
import type { KnowledgeRepositories } from '../knowledge/repositories/knowledgeRepositories.ts'
import type { KnowledgeItem } from '../knowledge/platform/knowledgeTypes.ts'

// Proves all 10 providers built so far (Stage 2's 2 + Batch 1's 4 + Batch 2's 4) coexist
// on one platform instance with zero core changes.

const ALL_DOMAINS = [
  'legal', 'procurement', 'templates', 'checklists', 'ontology', 'glossary',
  'vendor', 'asset', 'budget', 'notification',
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
})

describe('all 10 providers register without conflict', () => {
  it('searchKnowledge with no domain filter searches all 10 simultaneously', async () => {
    for (const domain of ALL_DOMAINS) {
      await repos.items.create(itemInput(domain, { title: 'shared keyword item' }))
    }
    const results = await platform.searchKnowledge('shared keyword')
    expect(results).toHaveLength(10)
    expect(new Set(results.map(r => r.matchedDomain)).size).toBe(10)
  })
})

describe('resolveContext aggregates applicable items across all 10 domains at once', () => {
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

describe('named convenience methods reach the correct real Batch 2 provider-backed data', () => {
  it('resolveVendorKnowledge, resolveAssetKnowledge, resolveBudgetKnowledge each return only their own domain', async () => {
    await repos.items.create(itemInput('vendor'))
    await repos.items.create(itemInput('asset'))
    await repos.items.create(itemInput('budget'))

    const vendor = await platform.resolveVendorKnowledge({}, '2026-06-01')
    const asset = await platform.resolveAssetKnowledge({}, '2026-06-01')
    const budget = await platform.resolveBudgetKnowledge({}, '2026-06-01')

    expect(vendor).toHaveLength(1)
    expect(vendor[0].domain).toBe('vendor')
    expect(asset).toHaveLength(1)
    expect(asset[0].domain).toBe('asset')
    expect(budget).toHaveLength(1)
    expect(budget[0].domain).toBe('budget')
  })
})

describe('duplicate domain registration is still rejected at 10 providers', () => {
  it('throws when re-registering an already-claimed domain', () => {
    expect(() => platform.registerProvider(new VendorKnowledgeProvider(repos, new KnowledgeGraphService(repos.relations))))
      .toThrow()
  })
})

describe('Batch 2 providers\' graph relationships remain independent of Batch 1 and Stage 2', () => {
  it('VendorKnowledgeProvider BLACKLISTED_FOR, BudgetKnowledgeProvider ROLLS_UP_TO, and NotificationKnowledgeProvider ESCALATES_TO never cross-contaminate', async () => {
    const graph = new KnowledgeGraphService(repos.relations)
    const vendorProvider = new VendorKnowledgeProvider(repos, graph)
    const budgetProvider = new BudgetKnowledgeProvider(repos, graph)
    const notificationProvider = new NotificationKnowledgeProvider(repos, graph)

    const vendor = await repos.items.create(itemInput('vendor', { title: 'Vendor X' }))
    const finding = await repos.items.create(itemInput('vendor', { title: 'Finding' }))
    await vendorProvider.linkBlacklistReason(vendor.id, finding.id)

    const childBudget = await repos.items.create(itemInput('budget', { title: 'Child' }))
    const parentBudget = await repos.items.create(itemInput('budget', { title: 'Parent' }))
    await budgetProvider.linkParentBudgetCode(childBudget.id, parentBudget.id)

    const rule = await repos.items.create(itemInput('notification', { title: 'Rule' }))
    const escalationTarget = await repos.items.create(itemInput('notification', { title: 'Escalation' }))
    await notificationProvider.linkEscalation(rule.id, escalationTarget.id)

    expect(await vendorProvider.getBlacklistReasons(vendor.id)).toEqual([finding.id])
    expect(await budgetProvider.getParentBudgetCode(childBudget.id)).toEqual([parentBudget.id])
    expect(await notificationProvider.getEscalationTarget(rule.id)).toEqual([escalationTarget.id])

    // cross-checks: none of these unrelated relation types appear on the wrong item
    expect(await vendorProvider.getBlacklistReasons(childBudget.id)).toEqual([])
    expect(await budgetProvider.getParentBudgetCode(rule.id)).toEqual([])
    expect(await notificationProvider.getEscalationTarget(vendor.id)).toEqual([])
  })
})

describe('buildAIContext still works correctly with 10 providers registered', () => {
  it('bundles legal/templates/checklists/bestPractices/risks/cases — unaffected by the other 4 domains existing', async () => {
    await repos.items.create(itemInput('legal'))
    await repos.items.create(itemInput('vendor')) // not part of AIKnowledgeContext's fixed shape
    const ctx = await platform.buildAIContext({}, '2026-06-01')
    expect(ctx.legalBasis).toHaveLength(1)
    expect(ctx.templates).toEqual([])
    expect(ctx.generatedAt).toBeTruthy()
  })
})
