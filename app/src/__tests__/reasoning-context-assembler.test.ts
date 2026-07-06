import { describe, it, expect } from 'vitest'
import { assembleReasoningContext } from '../reasoning/application/reasoningContextAssembler.ts'
import type { IntentType, KnowledgeItemRef, ReasoningIntent, ResolvedKnowledge } from '../reasoning/domain/reasoningTypes.ts'

const ASOF = '2026-07-06'

function intent(intentType: IntentType = 'GENERAL'): ReasoningIntent {
  return {
    intentType, question: 'q', normalizedQuestion: 'q', detectedEntities: [],
    context: { asOfDate: ASOF }, confidence: 0.8, ambiguous: false,
  }
}

function item(itemId: string, overrides: Partial<KnowledgeItemRef> = {}): KnowledgeItemRef {
  return {
    itemId, domain: 'legal', type: 'LAW', title: itemId, summary: 's', confidence: 0.9,
    layer: 1, legalBasis: [], metadata: {}, effectiveFrom: '2025-01-01', ...overrides,
  }
}

function resolvedKnowledge(overrides: Partial<ResolvedKnowledge> = {}): ResolvedKnowledge {
  return {
    legalItems: [], procurementItems: [], thresholdItems: [], ruleItems: [], schoolPolicyItems: [],
    asOfDate: ASOF, resolvedAt: `${ASOF}T00:00:00.000Z`, platformCallCount: 2, warnings: [],
    ...overrides,
  }
}

describe('assembleReasoningContext — field mapping', () => {
  it('carries intent, asOfDate, resolvedAt, platformCallCount, and warnings through unchanged', () => {
    const theIntent = intent()
    const resolved = resolvedKnowledge({ warnings: ['w1'], platformCallCount: 3 })

    const context = assembleReasoningContext(theIntent, resolved)

    expect(context.intent.question).toBe(theIntent.question)
    expect(context.asOfDate).toBe(ASOF)
    expect(context.resolvedAt).toBe(resolved.resolvedAt)
    expect(context.platformCallCount).toBe(3)
    expect(context.warnings).toEqual(['w1'])
  })

  it('stamps a fresh assembledAt timestamp', () => {
    const context = assembleReasoningContext(intent(), resolvedKnowledge())
    expect(new Date(context.assembledAt).toString()).not.toBe('Invalid Date')
  })
})

describe('assembleReasoningContext — ordering preserved', () => {
  it('preserves the exact input order of each bucket (never re-sorts)', () => {
    const resolved = resolvedKnowledge({
      legalItems: [item('c'), item('a'), item('b')],
    })
    const context = assembleReasoningContext(intent(), resolved)
    expect(context.legalItems.map(i => i.itemId)).toEqual(['c', 'a', 'b'])
  })
})

describe('assembleReasoningContext — deduplication (normalization)', () => {
  it('deduplicates items by itemId within a bucket, keeping the first occurrence', () => {
    const first = item('dup-1', { title: 'first' })
    const second = item('dup-1', { title: 'second' })
    const resolved = resolvedKnowledge({ legalItems: [first, second, item('unique-1')] })

    const context = assembleReasoningContext(intent(), resolved)

    expect(context.legalItems.map(i => i.itemId)).toEqual(['dup-1', 'unique-1'])
    expect(context.legalItems[0]!.title).toBe('first')
  })

  it('deduplicates legalBasis entries within an item, keeping the first occurrence', () => {
    const withDupLegalBasis = item('item-1', {
      legalBasis: [
        { documentSymbol: 'X/2025', article: 'Đ1' },
        { documentSymbol: 'X/2025', article: 'Đ1' },
        { documentSymbol: 'X/2025', article: 'Đ2' },
      ],
    })
    const resolved = resolvedKnowledge({ legalItems: [withDupLegalBasis] })

    const context = assembleReasoningContext(intent(), resolved)

    expect(context.legalItems[0]!.legalBasis).toHaveLength(2)
    expect(context.legalItems[0]!.legalBasis.map(b => b.article)).toEqual(['Đ1', 'Đ2'])
  })

  it('deduplication is independent per bucket (legal and procurement do not interfere)', () => {
    const resolved = resolvedKnowledge({
      legalItems: [item('shared-id', { domain: 'legal' })],
      procurementItems: [item('shared-id', { domain: 'procurement' })],
    })

    const context = assembleReasoningContext(intent(), resolved)

    expect(context.legalItems).toHaveLength(1)
    expect(context.procurementItems).toHaveLength(1)
  })
})

describe('assembleReasoningContext — no mutation of inputs', () => {
  it('never mutates the original ResolvedKnowledge item objects', () => {
    const original = item('item-1', { legalBasis: [{ documentSymbol: 'X/2025' }] })
    const resolved = resolvedKnowledge({ legalItems: [original] })

    assembleReasoningContext(intent(), resolved)

    expect(Object.isFrozen(original)).toBe(false)
    expect(original.title).toBe('item-1')
  })

  it('produces a new item object even when no duplicate/normalization was needed', () => {
    const original = item('item-1')
    const resolved = resolvedKnowledge({ legalItems: [original] })

    const context = assembleReasoningContext(intent(), resolved)

    expect(context.legalItems[0]).not.toBe(original)
    expect(context.legalItems[0]).toEqual(original)
  })
})

describe('assembleReasoningContext — immutability', () => {
  it('the top-level context is frozen', () => {
    const context = assembleReasoningContext(intent(), resolvedKnowledge())
    expect(Object.isFrozen(context)).toBe(true)
    expect(() => { (context as { asOfDate: string }).asOfDate = 'x' }).toThrow()
  })

  it('nested item arrays and objects are frozen (deep freeze)', () => {
    const resolved = resolvedKnowledge({ legalItems: [item('item-1', { metadata: { foo: 'bar' } })] })
    const context = assembleReasoningContext(intent(), resolved)

    expect(Object.isFrozen(context.legalItems)).toBe(true)
    expect(Object.isFrozen(context.legalItems[0])).toBe(true)
    expect(Object.isFrozen(context.legalItems[0]!.metadata)).toBe(true)
    expect(() => { (context.legalItems[0] as { title: string }).title = 'mutated' }).toThrow()
    expect(() => { (context.legalItems[0]!.metadata as Record<string, unknown>).foo = 'mutated' }).toThrow()
  })

  it('legalBasis arrays are frozen', () => {
    const resolved = resolvedKnowledge({
      legalItems: [item('item-1', { legalBasis: [{ documentSymbol: 'X/2025' }] })],
    })
    const context = assembleReasoningContext(intent(), resolved)

    expect(Object.isFrozen(context.legalItems[0]!.legalBasis)).toBe(true)
  })

  it('the warnings array is frozen', () => {
    const context = assembleReasoningContext(intent(), resolvedKnowledge({ warnings: ['w'] }))
    expect(Object.isFrozen(context.warnings)).toBe(true)
  })
})

describe('assembleReasoningContext — determinism', () => {
  it('produces identical output (aside from assembledAt) for identical input', () => {
    const resolved = resolvedKnowledge({ legalItems: [item('a'), item('b')] })
    const theIntent = intent('AUTHORITY_CHECK')

    const first = assembleReasoningContext(theIntent, resolved)
    const second = assembleReasoningContext(theIntent, resolved)

    expect(first.legalItems).toEqual(second.legalItems)
    expect(first.asOfDate).toBe(second.asOfDate)
    expect(first.warnings).toEqual(second.warnings)
  })
})
