import { describe, it, expect, beforeEach } from 'vitest'
import { Retriever, isEffectiveOn, matchesApplicability } from '../knowledge/application/retriever.ts'
import { buildMemoryKnowledgeRepositories } from '../knowledge/repositories/memoryKnowledgeRepositories.ts'
import type { KnowledgeRepositories } from '../knowledge/repositories/knowledgeRepositories.ts'
import type { KnowledgeItem, KnowledgeApplicabilityRule, KnowledgeContext } from '../knowledge/platform/knowledgeTypes.ts'

function itemInput(overrides: Partial<KnowledgeItem> = {}): Omit<KnowledgeItem, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    domain: 'legal', provider: 'LegalProvider', type: 'LAW', title: 'T', summary: 'S',
    keywords: [], legalBasis: [], relatedItems: [], metadata: {}, confidence: 1,
    attachments: [], layer: 1, language: 'vi', isActive: true, version: '1',
    ...overrides,
  }
}

const rule = (overrides: Partial<KnowledgeApplicabilityRule> = {}): KnowledgeApplicabilityRule => ({
  id: 'r1', itemId: 'i1', isActive: true, effectiveFrom: '2020-01-01',
  createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  ...overrides,
})

describe('isEffectiveOn', () => {
  it('true when no effectivePeriod is set (universally in force)', () => {
    expect(isEffectiveOn({ ...itemInput(), id: 'i', createdAt: '', updatedAt: '' } as KnowledgeItem, '2026-06-01')).toBe(true)
  })
  it('true when asOfDate is within [startDate, endDate)', () => {
    const item = { ...itemInput(), id: 'i', createdAt: '', updatedAt: '', effectivePeriod: { startDate: '2026-01-01', endDate: '2026-12-31' } } as KnowledgeItem
    expect(isEffectiveOn(item, '2026-06-01')).toBe(true)
  })
  it('false before startDate', () => {
    const item = { ...itemInput(), id: 'i', createdAt: '', updatedAt: '', effectivePeriod: { startDate: '2027-01-01' } } as KnowledgeItem
    expect(isEffectiveOn(item, '2026-06-01')).toBe(false)
  })
  it('false at or after endDate', () => {
    const item = { ...itemInput(), id: 'i', createdAt: '', updatedAt: '', effectivePeriod: { startDate: '2020-01-01', endDate: '2026-01-01' } } as KnowledgeItem
    expect(isEffectiveOn(item, '2026-01-01')).toBe(false)
  })
  it('true with no endDate (still in force indefinitely)', () => {
    const item = { ...itemInput(), id: 'i', createdAt: '', updatedAt: '', effectivePeriod: { startDate: '2020-01-01' } } as KnowledgeItem
    expect(isEffectiveOn(item, '2099-01-01')).toBe(true)
  })
})

describe('matchesApplicability — the universal, domain-agnostic evaluator (fixes TD-02)', () => {
  it('an inactive rule never matches', () => {
    expect(matchesApplicability(rule({ isActive: false }), {}, '2026-06-01')).toBe(false)
  })
  it('a rule not yet effective does not match', () => {
    expect(matchesApplicability(rule({ effectiveFrom: '2027-01-01' }), {}, '2026-06-01')).toBe(false)
  })
  it('a rule past its effectiveUntil does not match', () => {
    expect(matchesApplicability(rule({ effectiveUntil: '2026-01-01' }), {}, '2026-06-01')).toBe(false)
  })
  it('packageTypes filter: matches when context.packageType is in the list', () => {
    expect(matchesApplicability(rule({ packageTypes: ['GOODS', 'SERVICE'] }), { packageType: 'GOODS' }, '2026-06-01')).toBe(true)
  })
  it('packageTypes filter: rejects when context.packageType is not in the list', () => {
    expect(matchesApplicability(rule({ packageTypes: ['GOODS'] }), { packageType: 'CONSTRUCTION' }, '2026-06-01')).toBe(false)
  })
  it('packageTypes filter: matches everything when context.packageType is absent', () => {
    expect(matchesApplicability(rule({ packageTypes: ['GOODS'] }), {}, '2026-06-01')).toBe(true)
  })
  it('procurementMethods filter behaves the same way', () => {
    expect(matchesApplicability(rule({ procurementMethods: ['OPEN_TENDER'] }), { procurementMethod: 'OPEN_TENDER' }, '2026-06-01')).toBe(true)
    expect(matchesApplicability(rule({ procurementMethods: ['OPEN_TENDER'] }), { procurementMethod: 'DIRECT_APPOINTMENT' }, '2026-06-01')).toBe(false)
  })
  it('fundSources filter behaves the same way', () => {
    expect(matchesApplicability(rule({ fundSources: ['STATE'] }), { fundSource: 'STATE' }, '2026-06-01')).toBe(true)
    expect(matchesApplicability(rule({ fundSources: ['STATE'] }), { fundSource: 'ODA' }, '2026-06-01')).toBe(false)
  })
  it('departments filter behaves the same way', () => {
    expect(matchesApplicability(rule({ departments: ['IT'] }), { department: 'IT' }, '2026-06-01')).toBe(true)
    expect(matchesApplicability(rule({ departments: ['IT'] }), { department: 'HR' }, '2026-06-01')).toBe(false)
  })
  it('minValue: rejects a context value below the minimum', () => {
    expect(matchesApplicability(rule({ minValue: 200_000_000n }), { valueAmount: 100_000_000n }, '2026-06-01')).toBe(false)
  })
  it('maxValue: rejects a context value above the maximum', () => {
    expect(matchesApplicability(rule({ maxValue: 200_000_000n }), { valueAmount: 300_000_000n }, '2026-06-01')).toBe(false)
  })
  it('value range: matches within [minValue, maxValue]', () => {
    expect(matchesApplicability(rule({ minValue: 100_000_000n, maxValue: 500_000_000n }), { valueAmount: 250_000_000n }, '2026-06-01')).toBe(true)
  })
  it('all filters combined must pass simultaneously', () => {
    const r = rule({ packageTypes: ['GOODS'], fundSources: ['STATE'], minValue: 100n })
    const goodContext: KnowledgeContext = { packageType: 'GOODS', fundSource: 'STATE', valueAmount: 200n }
    const badContext: KnowledgeContext = { packageType: 'GOODS', fundSource: 'ODA', valueAmount: 200n }
    expect(matchesApplicability(r, goodContext, '2026-06-01')).toBe(true)
    expect(matchesApplicability(r, badContext, '2026-06-01')).toBe(false)
  })
})

describe('Retriever.resolveApplicableDocuments — same code path for every domain', () => {
  let repos: KnowledgeRepositories
  let retriever: Retriever

  beforeEach(() => {
    repos = buildMemoryKnowledgeRepositories()
    retriever = new Retriever(repos)
  })

  it('an item with zero applicability rules is universally applicable', async () => {
    await repos.items.create(itemInput({ domain: 'legal' }))
    const result = await retriever.resolveApplicableDocuments('legal', '2026-06-01', {})
    expect(result).toHaveLength(1)
  })

  it('an item with a matching rule is returned', async () => {
    const item = await repos.items.create(itemInput({ domain: 'legal' }))
    await repos.applicability.create({ itemId: item.id, isActive: true, effectiveFrom: '2020-01-01', packageTypes: ['GOODS'] })
    const result = await retriever.resolveApplicableDocuments('legal', '2026-06-01', { packageType: 'GOODS' })
    expect(result).toHaveLength(1)
  })

  it('an item with a non-matching rule is excluded', async () => {
    const item = await repos.items.create(itemInput({ domain: 'legal' }))
    await repos.applicability.create({ itemId: item.id, isActive: true, effectiveFrom: '2020-01-01', packageTypes: ['CONSTRUCTION'] })
    const result = await retriever.resolveApplicableDocuments('legal', '2026-06-01', { packageType: 'GOODS' })
    expect(result).toHaveLength(0)
  })

  it('excludes inactive items entirely', async () => {
    await repos.items.create(itemInput({ domain: 'legal', isActive: false }))
    const result = await retriever.resolveApplicableDocuments('legal', '2026-06-01', {})
    expect(result).toHaveLength(0)
  })

  it('excludes items from other domains', async () => {
    await repos.items.create(itemInput({ domain: 'risk' }))
    const result = await retriever.resolveApplicableDocuments('legal', '2026-06-01', {})
    expect(result).toHaveLength(0)
  })

  it('excludes items not yet effective as of the given date', async () => {
    await repos.items.create(itemInput({ domain: 'legal', effectivePeriod: { startDate: '2027-01-01' } }))
    const result = await retriever.resolveApplicableDocuments('legal', '2026-06-01', {})
    expect(result).toHaveLength(0)
  })

  it('works identically for a non-legal domain — no special-casing anywhere (Rule 1)', async () => {
    const item = await repos.items.create(itemInput({ domain: 'risk', type: 'RISK_PATTERN' }))
    await repos.applicability.create({ itemId: item.id, isActive: true, effectiveFrom: '2020-01-01', minValue: 200_000_000n })
    const applies = await retriever.resolveApplicableDocuments('risk', '2026-06-01', { valueAmount: 300_000_000n })
    const doesNotApply = await retriever.resolveApplicableDocuments('risk', '2026-06-01', { valueAmount: 50_000_000n })
    expect(applies).toHaveLength(1)
    expect(doesNotApply).toHaveLength(0)
  })

  it('an item matches if ANY of its multiple rules matches (OR semantics)', async () => {
    const item = await repos.items.create(itemInput({ domain: 'legal' }))
    await repos.applicability.create({ itemId: item.id, isActive: true, effectiveFrom: '2020-01-01', packageTypes: ['CONSTRUCTION'] })
    await repos.applicability.create({ itemId: item.id, isActive: true, effectiveFrom: '2020-01-01', packageTypes: ['GOODS'] })
    const result = await retriever.resolveApplicableDocuments('legal', '2026-06-01', { packageType: 'GOODS' })
    expect(result).toHaveLength(1)
  })
})
