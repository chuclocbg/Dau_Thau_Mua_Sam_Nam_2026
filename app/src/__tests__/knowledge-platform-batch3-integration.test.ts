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
import { buildMemoryKnowledgeRepositories } from '../knowledge/repositories/memoryKnowledgeRepositories.ts'
import { KnowledgeGraphService } from '../knowledge/graph/knowledgeGraph.ts'
import type { KnowledgeRepositories } from '../knowledge/repositories/knowledgeRepositories.ts'
import type { KnowledgeItem } from '../knowledge/platform/knowledgeTypes.ts'

// Proves all 14 providers built so far (Stage 2's 2 + Batch 1's 4 + Batch 2's 4 +
// Batch 3's 4) coexist on one platform instance with zero core changes.

const ALL_DOMAINS = [
  'legal', 'procurement', 'templates', 'checklists', 'ontology', 'glossary',
  'vendor', 'asset', 'budget', 'notification', 'school', 'cases', 'risk', 'audit',
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
})

describe('all 14 providers register without conflict', () => {
  it('searchKnowledge with no domain filter searches all 14 simultaneously', async () => {
    for (const domain of ALL_DOMAINS) {
      await repos.items.create(itemInput(domain, { title: 'shared keyword item' }))
    }
    const results = await platform.searchKnowledge('shared keyword')
    expect(results).toHaveLength(14)
    expect(new Set(results.map(r => r.matchedDomain)).size).toBe(14)
  })
})

describe('resolveContext aggregates applicable items across all 14 domains at once', () => {
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

describe('named convenience methods reach the correct real Batch 3 provider-backed data', () => {
  it('resolveSchoolPolicy, resolveCases, resolveRisk, resolveAuditFinding each return only their own domain', async () => {
    await repos.items.create(itemInput('school'))
    await repos.items.create(itemInput('cases'))
    await repos.items.create(itemInput('risk'))
    await repos.items.create(itemInput('audit'))

    const school = await platform.resolveSchoolPolicy({}, '2026-06-01')
    const cases = await platform.resolveCases({}, '2026-06-01')
    const risk = await platform.resolveRisk({}, '2026-06-01')
    const audit = await platform.resolveAuditFinding({}, '2026-06-01')

    expect(school).toHaveLength(1)
    expect(school[0].domain).toBe('school')
    expect(cases).toHaveLength(1)
    expect(cases[0].domain).toBe('cases')
    expect(risk).toHaveLength(1)
    expect(risk[0].domain).toBe('risk')
    expect(audit).toHaveLength(1)
    expect(audit[0].domain).toBe('audit')
  })
})

describe('duplicate domain registration is still rejected at 14 providers', () => {
  it('throws when re-registering an already-claimed domain', () => {
    expect(() => platform.registerProvider(new RiskProvider(repos, new KnowledgeGraphService(repos.relations))))
      .toThrow()
  })
})

describe('Batch 3 providers\' graph relationships remain independent of earlier batches', () => {
  it('SchoolPolicyProvider RESTRICTS, CaseProvider REVEALED, RiskProvider MITIGATED_BY, and AuditProvider REMEDIATED_BY never cross-contaminate', async () => {
    const graph = new KnowledgeGraphService(repos.relations)
    const schoolProvider = new SchoolPolicyProvider(repos, graph)
    const caseProvider = new CaseProvider(repos, graph)
    const riskProvider = new RiskProvider(repos, graph)
    const auditProvider = new AuditProvider(repos, graph)

    const policy = await repos.items.create(itemInput('school', { title: 'Policy' }))
    const broaderRule = await repos.items.create(itemInput('legal', { title: 'Broader Rule' }))
    await schoolProvider.linkRestriction(policy.id, broaderRule.id)

    const caseItem = await repos.items.create(itemInput('cases', { title: 'Case' }))
    const revealedRisk = await repos.items.create(itemInput('risk', { title: 'Revealed Risk' }))
    await caseProvider.linkRevealedRisk(caseItem.id, revealedRisk.id)

    const risk = await repos.items.create(itemInput('risk', { title: 'Risk' }))
    const control = await repos.items.create(itemInput('risk', { title: 'Control' }))
    await riskProvider.linkMitigatingControl(risk.id, control.id)

    const finding = await repos.items.create(itemInput('audit', { title: 'Finding' }))
    const action = await repos.items.create(itemInput('audit', { title: 'Action' }))
    await auditProvider.linkCorrectiveAction(finding.id, action.id)

    expect(await schoolProvider.getRestrictedRules(policy.id)).toEqual([broaderRule.id])
    expect(await caseProvider.getRevealedRisks(caseItem.id)).toEqual([revealedRisk.id])
    expect(await riskProvider.getMitigatingControls(risk.id)).toEqual([control.id])
    expect(await auditProvider.getCorrectiveActions(finding.id)).toEqual([action.id])

    // cross-checks: none of these unrelated relation types appear on the wrong item
    expect(await schoolProvider.getRestrictedRules(caseItem.id)).toEqual([])
    expect(await caseProvider.getRevealedRisks(risk.id)).toEqual([])
    expect(await riskProvider.getMitigatingControls(finding.id)).toEqual([])
    expect(await auditProvider.getCorrectiveActions(policy.id)).toEqual([])
  })
})

describe('buildAIContext now returns real risk/case data from Batch 3 providers', () => {
  it('bundles legal/risks/cases with real items, unaffected by the other 8 domains existing', async () => {
    await repos.items.create(itemInput('legal'))
    await repos.items.create(itemInput('risk'))
    await repos.items.create(itemInput('cases'))
    await repos.items.create(itemInput('school')) // not part of AIKnowledgeContext's fixed shape
    const ctx = await platform.buildAIContext({}, '2026-06-01')
    expect(ctx.legalBasis).toHaveLength(1)
    expect(ctx.risks).toHaveLength(1)
    expect(ctx.risks[0].domain).toBe('risk')
    expect(ctx.cases).toHaveLength(1)
    expect(ctx.cases[0].domain).toBe('cases')
    expect(ctx.generatedAt).toBeTruthy()
  })
})
