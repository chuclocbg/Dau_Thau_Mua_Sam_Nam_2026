import { describe, it, expect, beforeEach } from 'vitest'
import { RiskProvider } from '../knowledge/providers/risk/riskProvider.ts'
import { buildMemoryKnowledgeRepositories } from '../knowledge/repositories/memoryKnowledgeRepositories.ts'
import { KnowledgeGraphService } from '../knowledge/graph/knowledgeGraph.ts'
import type { KnowledgeRepositories } from '../knowledge/repositories/knowledgeRepositories.ts'
import type { IKnowledgeGraph } from '../knowledge/graph/knowledgeGraph.ts'
import type { KnowledgeItem } from '../knowledge/platform/knowledgeTypes.ts'

function riskItemInput(overrides: Partial<KnowledgeItem> = {}): Omit<KnowledgeItem, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    domain: 'risk', provider: 'RiskProvider', type: 'RISK_PATTERN',
    title: 'Rủi ro chia nhỏ gói thầu', summary: 'Mẫu hình rủi ro chia nhỏ gói thầu để né hạn mức',
    keywords: ['chia nhỏ'], legalBasis: [], relatedItems: [], metadata: {}, confidence: 1.0,
    attachments: [], layer: 4, language: 'vi', isActive: true, version: '1',
    ...overrides,
  }
}

let repos: KnowledgeRepositories
let graph: IKnowledgeGraph
let provider: RiskProvider

beforeEach(() => {
  repos = buildMemoryKnowledgeRepositories()
  graph = new KnowledgeGraphService(repos.relations)
  provider = new RiskProvider(repos, graph)
})

describe('identity', () => {
  it('reports domain=risk, layer=4', () => {
    expect(provider.domain).toBe('risk')
    expect(provider.layer).toBe(4)
  })
})

describe('search()', () => {
  it('finds an item by keyword within its own domain', async () => {
    await repos.items.create(riskItemInput())
    const results = await provider.search({ text: 'chia nhỏ' })
    expect(results).toHaveLength(1)
    expect(results[0].matchedDomain).toBe('risk')
  })

  it('never returns items from another domain', async () => {
    await repos.items.create(riskItemInput({ domain: 'cases', title: 'chia nhỏ case' }))
    expect(await provider.search({ text: 'chia nhỏ' })).toEqual([])
  })
})

describe('resolve()', () => {
  it('resolves an item it owns', async () => {
    const item = await repos.items.create(riskItemInput())
    expect((await provider.resolve(item.id))?.id).toBe(item.id)
  })

  it('refuses to resolve an item from a different domain', async () => {
    const item = await repos.items.create(riskItemInput({ domain: 'audit' }))
    expect(await provider.resolve(item.id)).toBeNull()
  })
})

describe('suggest()', () => {
  it('suggests applicable items with a risk-specific reason', async () => {
    await repos.items.create(riskItemInput())
    const suggestions = await provider.suggest({})
    expect(suggestions[0].reason).toBe('Applicable risk pattern')
  })
})

describe('score()', () => {
  it('scores an applicable item at its confidence', async () => {
    const item = await repos.items.create(riskItemInput({ confidence: 0.45 }))
    expect(await provider.score(item.id, {})).toBe(0.45)
  })
})

describe('graph integration — mitigating control linkage (new relation type MITIGATED_BY)', () => {
  it('links and retrieves a mitigating control', async () => {
    const risk = await repos.items.create(riskItemInput())
    const control = await repos.items.create(riskItemInput({ type: 'CONTROL', title: 'Independent appraisal review' }))
    await provider.linkMitigatingControl(risk.id, control.id)
    expect(await provider.getMitigatingControls(risk.id)).toEqual([control.id])
  })

  it('a risk with no mitigating control returns empty', async () => {
    const risk = await repos.items.create(riskItemInput())
    expect(await provider.getMitigatingControls(risk.id)).toEqual([])
  })
})

describe('graph integration — related audit finding linkage (reuses REFERENCES)', () => {
  it('links and retrieves a related audit finding', async () => {
    const risk = await repos.items.create(riskItemInput())
    const finding = await repos.items.create(riskItemInput({ domain: 'audit', type: 'AUDIT_FINDING', title: 'Split-package finding' }))
    await provider.linkRelatedAuditFinding(risk.id, finding.id)
    expect(await provider.getRelatedAuditFindings(risk.id)).toEqual([finding.id])
  })

  it('MITIGATED_BY and REFERENCES remain independent on the same item', async () => {
    const risk = await repos.items.create(riskItemInput())
    const control = await repos.items.create(riskItemInput({ type: 'CONTROL' }))
    const finding = await repos.items.create(riskItemInput({ domain: 'audit', type: 'AUDIT_FINDING' }))
    await provider.linkMitigatingControl(risk.id, control.id)
    await provider.linkRelatedAuditFinding(risk.id, finding.id)
    expect(await provider.getMitigatingControls(risk.id)).toEqual([control.id])
    expect(await provider.getRelatedAuditFindings(risk.id)).toEqual([finding.id])
  })
})
