import { describe, it, expect, beforeEach } from 'vitest'
import { AuditProvider } from '../knowledge/providers/audit/auditProvider.ts'
import { buildMemoryKnowledgeRepositories } from '../knowledge/repositories/memoryKnowledgeRepositories.ts'
import { KnowledgeGraphService } from '../knowledge/graph/knowledgeGraph.ts'
import type { KnowledgeRepositories } from '../knowledge/repositories/knowledgeRepositories.ts'
import type { IKnowledgeGraph } from '../knowledge/graph/knowledgeGraph.ts'
import type { KnowledgeItem } from '../knowledge/platform/knowledgeTypes.ts'

function auditItemInput(overrides: Partial<KnowledgeItem> = {}): Omit<KnowledgeItem, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    domain: 'audit', provider: 'AuditProvider', type: 'AUDIT_FINDING',
    title: 'Phát hiện chia nhỏ gói thầu', summary: 'Kết luận kiểm toán về chia nhỏ gói thầu',
    keywords: ['kiểm toán'], legalBasis: [], relatedItems: [], metadata: {}, confidence: 1.0,
    attachments: [], layer: 4, language: 'vi', isActive: true, version: '1',
    ...overrides,
  }
}

let repos: KnowledgeRepositories
let graph: IKnowledgeGraph
let provider: AuditProvider

beforeEach(() => {
  repos = buildMemoryKnowledgeRepositories()
  graph = new KnowledgeGraphService(repos.relations)
  provider = new AuditProvider(repos, graph)
})

describe('identity', () => {
  it('reports domain=audit, layer=4', () => {
    expect(provider.domain).toBe('audit')
    expect(provider.layer).toBe(4)
  })
})

describe('search()', () => {
  it('finds an item by keyword within its own domain', async () => {
    await repos.items.create(auditItemInput())
    const results = await provider.search({ text: 'kiểm toán' })
    expect(results).toHaveLength(1)
    expect(results[0].matchedDomain).toBe('audit')
  })

  it('never returns items from another domain', async () => {
    await repos.items.create(auditItemInput({ domain: 'risk', title: 'kiểm toán risk' }))
    expect(await provider.search({ text: 'kiểm toán' })).toEqual([])
  })
})

describe('resolve()', () => {
  it('resolves an item it owns', async () => {
    const item = await repos.items.create(auditItemInput())
    expect((await provider.resolve(item.id))?.id).toBe(item.id)
  })

  it('refuses to resolve an item from a different domain', async () => {
    const item = await repos.items.create(auditItemInput({ domain: 'cases' }))
    expect(await provider.resolve(item.id)).toBeNull()
  })
})

describe('suggest()', () => {
  it('suggests applicable items with an audit-specific reason', async () => {
    await repos.items.create(auditItemInput())
    const suggestions = await provider.suggest({})
    expect(suggestions[0].reason).toBe('Applicable audit finding')
  })
})

describe('score()', () => {
  it('scores an applicable item at its confidence', async () => {
    const item = await repos.items.create(auditItemInput({ confidence: 0.9 }))
    expect(await provider.score(item.id, {})).toBe(0.9)
  })
})

describe('graph integration — corrective action linkage (new relation type REMEDIATED_BY)', () => {
  it('links and retrieves a corrective action', async () => {
    const finding = await repos.items.create(auditItemInput())
    const action = await repos.items.create(auditItemInput({ type: 'CORRECTIVE_ACTION', title: 'Revise procurement plan' }))
    await provider.linkCorrectiveAction(finding.id, action.id)
    expect(await provider.getCorrectiveActions(finding.id)).toEqual([action.id])
  })

  it('a finding with no corrective action returns empty', async () => {
    const finding = await repos.items.create(auditItemInput())
    expect(await provider.getCorrectiveActions(finding.id)).toEqual([])
  })
})

describe('graph integration — affected risk pattern linkage (reuses RELATED_TO)', () => {
  it('links and retrieves an affected risk pattern', async () => {
    const finding = await repos.items.create(auditItemInput())
    const risk = await repos.items.create(auditItemInput({ domain: 'risk', type: 'RISK_PATTERN', title: 'Split-package risk' }))
    await provider.linkAffectedRiskPattern(finding.id, risk.id)
    expect(await provider.getAffectedRiskPatterns(finding.id)).toEqual([risk.id])
  })

  it('REMEDIATED_BY and RELATED_TO remain independent on the same item', async () => {
    const finding = await repos.items.create(auditItemInput())
    const action = await repos.items.create(auditItemInput({ type: 'CORRECTIVE_ACTION' }))
    const risk = await repos.items.create(auditItemInput({ domain: 'risk', type: 'RISK_PATTERN' }))
    await provider.linkCorrectiveAction(finding.id, action.id)
    await provider.linkAffectedRiskPattern(finding.id, risk.id)
    expect(await provider.getCorrectiveActions(finding.id)).toEqual([action.id])
    expect(await provider.getAffectedRiskPatterns(finding.id)).toEqual([risk.id])
  })
})
