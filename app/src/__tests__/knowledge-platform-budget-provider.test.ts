import { describe, it, expect, beforeEach } from 'vitest'
import { BudgetKnowledgeProvider } from '../knowledge/providers/budget/budgetKnowledgeProvider.ts'
import { buildMemoryKnowledgeRepositories } from '../knowledge/repositories/memoryKnowledgeRepositories.ts'
import { KnowledgeGraphService } from '../knowledge/graph/knowledgeGraph.ts'
import type { KnowledgeRepositories } from '../knowledge/repositories/knowledgeRepositories.ts'
import type { IKnowledgeGraph } from '../knowledge/graph/knowledgeGraph.ts'
import type { KnowledgeItem } from '../knowledge/platform/knowledgeTypes.ts'

function budgetItemInput(overrides: Partial<KnowledgeItem> = {}): Omit<KnowledgeItem, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    domain: 'budget', provider: 'BudgetKnowledgeProvider', type: 'BUDGET_CODE', title: 'Vốn sự nghiệp',
    summary: 'Mã ngân sách vốn sự nghiệp', keywords: ['ngân sách'], legalBasis: [], relatedItems: [],
    metadata: {}, confidence: 1.0, attachments: [], layer: 2, language: 'vi', isActive: true, version: '1',
    ...overrides,
  }
}

let repos: KnowledgeRepositories
let graph: IKnowledgeGraph
let provider: BudgetKnowledgeProvider

beforeEach(() => {
  repos = buildMemoryKnowledgeRepositories()
  graph = new KnowledgeGraphService(repos.relations)
  provider = new BudgetKnowledgeProvider(repos, graph)
})

describe('identity', () => {
  it('reports domain=budget, layer=2', () => {
    expect(provider.domain).toBe('budget')
    expect(provider.layer).toBe(2)
  })
})

describe('search()', () => {
  it('finds an item by keyword within its own domain', async () => {
    await repos.items.create(budgetItemInput())
    const results = await provider.search({ text: 'ngân sách' })
    expect(results).toHaveLength(1)
    expect(results[0].matchedDomain).toBe('budget')
  })

  it('never returns items from another domain', async () => {
    await repos.items.create(budgetItemInput({ domain: 'vendor', title: 'ngân sách vendor' }))
    expect(await provider.search({ text: 'ngân sách' })).toEqual([])
  })
})

describe('resolve()', () => {
  it('resolves an item it owns', async () => {
    const item = await repos.items.create(budgetItemInput())
    expect((await provider.resolve(item.id))?.id).toBe(item.id)
  })

  it('refuses to resolve an item from a different domain', async () => {
    const item = await repos.items.create(budgetItemInput({ domain: 'asset' }))
    expect(await provider.resolve(item.id)).toBeNull()
  })
})

describe('suggest()', () => {
  it('suggests applicable items with a budget-specific reason including fund source', async () => {
    await repos.items.create(budgetItemInput())
    const suggestions = await provider.suggest({ fundSource: 'STATE' })
    expect(suggestions[0].reason).toContain('budget rule')
    expect(suggestions[0].reason).toContain('STATE')
  })

  it('respects applicability rules', async () => {
    const item = await repos.items.create(budgetItemInput())
    await repos.applicability.create({ itemId: item.id, isActive: true, effectiveFrom: '2020-01-01', fundSources: ['ODA'] })
    expect(await provider.suggest({ fundSource: 'STATE' })).toEqual([])
  })
})

describe('score()', () => {
  it('scores an applicable item at its confidence', async () => {
    const item = await repos.items.create(budgetItemInput({ confidence: 0.55 }))
    expect(await provider.score(item.id, {})).toBe(0.55)
  })
})

describe('graph integration — budget code hierarchy (new relation type ROLLS_UP_TO)', () => {
  it('links a child code to its parent and retrieves the parent', async () => {
    const parent = await repos.items.create(budgetItemInput({ title: 'Vốn sự nghiệp (parent)' }))
    const child = await repos.items.create(budgetItemInput({ title: 'Vốn sự nghiệp - CNTT' }))
    await provider.linkParentBudgetCode(child.id, parent.id)
    expect(await provider.getParentBudgetCode(child.id)).toEqual([parent.id])
  })

  it('finds child codes via the incoming edge', async () => {
    const parent = await repos.items.create(budgetItemInput({ title: 'Parent' }))
    const child1 = await repos.items.create(budgetItemInput({ title: 'Child 1' }))
    const child2 = await repos.items.create(budgetItemInput({ title: 'Child 2' }))
    await provider.linkParentBudgetCode(child1.id, parent.id)
    await provider.linkParentBudgetCode(child2.id, parent.id)
    const children = await provider.getChildBudgetCodes(parent.id)
    expect([...children].sort()).toEqual([child1.id, child2.id].sort())
  })

  it('a top-level code with no parent returns empty', async () => {
    const item = await repos.items.create(budgetItemInput())
    expect(await provider.getParentBudgetCode(item.id)).toEqual([])
  })
})

describe('graph integration — fund source rule linkage (REFERENCES)', () => {
  it('links and retrieves a fund source rule', async () => {
    const code = await repos.items.create(budgetItemInput())
    const rule = await repos.items.create(budgetItemInput({ type: 'FUND_SOURCE_RULE', title: 'ODA spending limit' }))
    await provider.linkFundSourceRule(code.id, rule.id)
    expect(await provider.getFundSourceRules(code.id)).toEqual([rule.id])
  })

  it('ROLLS_UP_TO and REFERENCES remain independent on the same item', async () => {
    const parent = await repos.items.create(budgetItemInput({ title: 'Parent' }))
    const child = await repos.items.create(budgetItemInput({ title: 'Child' }))
    const rule = await repos.items.create(budgetItemInput({ type: 'FUND_SOURCE_RULE' }))
    await provider.linkParentBudgetCode(child.id, parent.id)
    await provider.linkFundSourceRule(child.id, rule.id)
    expect(await provider.getParentBudgetCode(child.id)).toEqual([parent.id])
    expect(await provider.getFundSourceRules(child.id)).toEqual([rule.id])
  })
})
