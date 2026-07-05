import { describe, it, expect, beforeEach } from 'vitest'
import { SchoolPolicyProvider } from '../knowledge/providers/school/schoolPolicyProvider.ts'
import { buildMemoryKnowledgeRepositories } from '../knowledge/repositories/memoryKnowledgeRepositories.ts'
import { KnowledgeGraphService } from '../knowledge/graph/knowledgeGraph.ts'
import type { KnowledgeRepositories } from '../knowledge/repositories/knowledgeRepositories.ts'
import type { IKnowledgeGraph } from '../knowledge/graph/knowledgeGraph.ts'
import type { KnowledgeItem } from '../knowledge/platform/knowledgeTypes.ts'

function schoolItemInput(overrides: Partial<KnowledgeItem> = {}): Omit<KnowledgeItem, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    domain: 'school', provider: 'SchoolPolicyProvider', type: 'INTERNAL_REGULATION',
    title: 'Quy chế mua sắm nội bộ', summary: 'Quy định nội bộ về mua sắm tài sản',
    keywords: ['nội bộ'], legalBasis: [], relatedItems: [], metadata: {}, confidence: 1.0,
    attachments: [], layer: 3, language: 'vi', isActive: true, version: '1',
    ...overrides,
  }
}

let repos: KnowledgeRepositories
let graph: IKnowledgeGraph
let provider: SchoolPolicyProvider

beforeEach(() => {
  repos = buildMemoryKnowledgeRepositories()
  graph = new KnowledgeGraphService(repos.relations)
  provider = new SchoolPolicyProvider(repos, graph)
})

describe('identity', () => {
  it('reports domain=school, layer=3', () => {
    expect(provider.domain).toBe('school')
    expect(provider.layer).toBe(3)
  })
})

describe('search()', () => {
  it('finds an item by keyword within its own domain', async () => {
    await repos.items.create(schoolItemInput())
    const results = await provider.search({ text: 'nội bộ' })
    expect(results).toHaveLength(1)
    expect(results[0].matchedDomain).toBe('school')
  })

  it('never returns items from another domain', async () => {
    await repos.items.create(schoolItemInput({ domain: 'legal', title: 'nội bộ law' }))
    expect(await provider.search({ text: 'nội bộ' })).toEqual([])
  })
})

describe('resolve()', () => {
  it('resolves an item it owns', async () => {
    const item = await repos.items.create(schoolItemInput())
    expect((await provider.resolve(item.id))?.id).toBe(item.id)
  })

  it('refuses to resolve an item from a different domain', async () => {
    const item = await repos.items.create(schoolItemInput({ domain: 'audit' }))
    expect(await provider.resolve(item.id)).toBeNull()
  })
})

describe('suggest()', () => {
  it('suggests applicable items with a school-specific reason including department', async () => {
    await repos.items.create(schoolItemInput())
    const suggestions = await provider.suggest({ department: 'Phòng Kế hoạch' })
    expect(suggestions[0].reason).toContain('school policy')
    expect(suggestions[0].reason).toContain('Phòng Kế hoạch')
  })

  it('respects applicability rules', async () => {
    const item = await repos.items.create(schoolItemInput())
    await repos.applicability.create({ itemId: item.id, isActive: true, effectiveFrom: '2020-01-01', departments: ['IT'] })
    expect(await provider.suggest({ department: 'HR' })).toEqual([])
  })
})

describe('score()', () => {
  it('scores an applicable item at its confidence', async () => {
    const item = await repos.items.create(schoolItemInput({ confidence: 0.6 }))
    expect(await provider.score(item.id, {})).toBe(0.6)
  })
})

describe('graph integration — governing legal basis (REFERENCES)', () => {
  it('links and retrieves a governing legal document', async () => {
    const policy = await repos.items.create(schoolItemInput())
    const legalDoc = await repos.items.create(schoolItemInput({ domain: 'legal', type: 'LAW', title: 'Luật Đấu thầu' }))
    await provider.linkGoverningLegalBasis(policy.id, legalDoc.id)
    expect(await provider.getGoverningLegalBasis(policy.id)).toEqual([legalDoc.id])
  })

  it('a policy with no linked legal basis returns empty', async () => {
    const policy = await repos.items.create(schoolItemInput())
    expect(await provider.getGoverningLegalBasis(policy.id)).toEqual([])
  })
})

describe('graph integration — internal restriction (new relation type RESTRICTS)', () => {
  it('links and retrieves a restricted broader rule', async () => {
    const policy = await repos.items.create(schoolItemInput())
    const broaderRule = await repos.items.create(schoolItemInput({ domain: 'legal', type: 'LAW', title: 'Nghị định 214' }))
    await provider.linkRestriction(policy.id, broaderRule.id)
    expect(await provider.getRestrictedRules(policy.id)).toEqual([broaderRule.id])
  })

  it('REFERENCES and RESTRICTS remain independent on the same item', async () => {
    const policy = await repos.items.create(schoolItemInput())
    const legalDoc = await repos.items.create(schoolItemInput({ domain: 'legal', type: 'LAW' }))
    const broaderRule = await repos.items.create(schoolItemInput({ domain: 'legal', type: 'LAW' }))
    await provider.linkGoverningLegalBasis(policy.id, legalDoc.id)
    await provider.linkRestriction(policy.id, broaderRule.id)
    expect(await provider.getGoverningLegalBasis(policy.id)).toEqual([legalDoc.id])
    expect(await provider.getRestrictedRules(policy.id)).toEqual([broaderRule.id])
  })
})
