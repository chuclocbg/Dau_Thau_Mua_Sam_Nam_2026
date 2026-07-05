import { describe, it, expect } from 'vitest'
import { buildLegalReasoningEngine } from '../reasoning/application/legalReasoningEngine.ts'
import { buildResolvedKnowledge } from '../reasoning/testing/mockKnowledgeFixtures.ts'
import type { KnowledgeItemRef, ResolvedKnowledge } from '../reasoning/domain/reasoningTypes.ts'

const ASOF = '2026-07-05'

function legalItem(overrides: Partial<KnowledgeItemRef>): KnowledgeItemRef {
  return {
    itemId: 'item', domain: 'legal', type: 'LAW', title: 't', summary: 's',
    confidence: 0.9, layer: 1, legalBasis: [{ documentSymbol: 'X/2025' }], metadata: {},
    effectiveFrom: '2025-01-01',
    ...overrides,
  }
}

function minimalResolvedKnowledge(legalItems: readonly KnowledgeItemRef[]): ResolvedKnowledge {
  return {
    legalItems, procurementItems: [], thresholdItems: [], ruleItems: [], schoolPolicyItems: [],
    asOfDate: ASOF, resolvedAt: `${ASOF}T00:00:00.000Z`, platformCallCount: 0, warnings: [],
  }
}

describe('LegalReasoningEngine — full pipeline (mock fixtures)', () => {
  it('composes a decision with the school policy as primary basis when it is more restrictive (Tier 2)', async () => {
    const engine = buildLegalReasoningEngine()
    const result = await engine.reason(
      {
        question: 'Mức tạm ứng tối đa là bao nhiêu?', asOfDate: ASOF,
        context: {
          packageType: 'GOODS', fundSource: 'STATE_BUDGET', procurementMethod: 'OPEN_TENDER',
          estimatedValue: 3_000_000_000n, advanceAmount: 150_000_000n, advanceRatio: 0.20,
        },
      },
      buildResolvedKnowledge(ASOF),
    )

    expect(result.decision).not.toBeNull()
    expect(result.humanReviewRequired).toBe(false)
    expect(result.confidenceLabel).toBe('MEDIUM')
    expect(result.confidence).toBeCloseTo(0.72, 2)

    const conflict = result.conflicts.find(c => c.resolution === 'RESOLVED_BY_MORE_RESTRICTIVE')
    expect(conflict).toBeDefined()
    expect(conflict!.appliedItem).toBe('qcnb-01-2025')

    const schoolCitation = result.citations.find(c => c.documentSymbol === 'QCNB-01/2025')
    expect(schoolCitation?.isNormative).toBe(true)

    const ruleA01 = result.ruleResults.find(r => r.ruleCode === 'RULE-A01')
    expect(ruleA01?.status).toBe('PASS')
    const ruleG01 = result.ruleResults.find(r => r.ruleCode === 'RULE-G01')
    expect(ruleG01?.status).toBe('PASS')

    expect(result.evidenceSufficiency).toBe('SUFFICIENT')
  })

  it('requires human review when a critical rule is INCONCLUSIVE due to missing context', async () => {
    const engine = buildLegalReasoningEngine()
    const result = await engine.reason(
      { question: 'Có phải đấu thầu rộng rãi không?', asOfDate: ASOF, context: {} },
      buildResolvedKnowledge(ASOF),
    )

    const openTenderRule = result.ruleResults.find(r => r.ruleCode === 'RULE-M01')
    expect(openTenderRule?.status).toBe('INCONCLUSIVE')
    expect(result.humanReviewRequired).toBe(true)
    expect(result.evidenceSufficiency).toBe('INSUFFICIENT')
  })
})

describe('LegalReasoningEngine — conflict resolution cascade', () => {
  it('Tier 1 (hierarchy): a LAW prevails over a CIRCULAR at the same layer', async () => {
    const engine = buildLegalReasoningEngine()
    const law = legalItem({ itemId: 'law-a', type: 'LAW', metadata: { conflictDimension: 'D1', conflictValue: '10' } })
    const circular = legalItem({ itemId: 'circular-b', type: 'CIRCULAR', metadata: { conflictDimension: 'D1', conflictValue: '20' } })

    const result = await engine.reason(
      { question: 'test', asOfDate: ASOF },
      minimalResolvedKnowledge([law, circular]),
    )

    const conflict = result.conflicts[0]
    expect(conflict?.resolution).toBe('RESOLVED_BY_HIERARCHY')
    expect(conflict?.appliedItem).toBe('law-a')
    expect(conflict?.supersededItem).toBe('circular-b')
    expect(result.appliedArticles.find(a => a.itemId === 'circular-b')?.role).toBe('CONFLICT_SOURCE')
  })

  it('Tier 3 (lex posterior): the newer document prevails at equal authority level', async () => {
    const engine = buildLegalReasoningEngine()
    const older = legalItem({ itemId: 'decree-older', type: 'DECREE', effectiveFrom: '2022-01-01', metadata: { conflictDimension: 'D2', conflictValue: '10' } })
    const newer = legalItem({ itemId: 'decree-newer', type: 'DECREE', effectiveFrom: '2024-01-01', metadata: { conflictDimension: 'D2', conflictValue: '20' } })

    const result = await engine.reason(
      { question: 'test', asOfDate: ASOF },
      minimalResolvedKnowledge([older, newer]),
    )

    const conflict = result.conflicts[0]
    expect(conflict?.resolution).toBe('RESOLVED_BY_LEX_POSTERIOR')
    expect(conflict?.appliedItem).toBe('decree-newer')
  })

  it('UNRESOLVED: same authority, same layer, same effective date, no scope distinction', async () => {
    const engine = buildLegalReasoningEngine()
    const a = legalItem({ itemId: 'letter-a', type: 'OFFICIAL_LETTER', effectiveFrom: '2025-01-01', metadata: { conflictDimension: 'D3', conflictValue: '10' } })
    const b = legalItem({ itemId: 'letter-b', type: 'OFFICIAL_LETTER', effectiveFrom: '2025-01-01', metadata: { conflictDimension: 'D3', conflictValue: '20' } })

    const result = await engine.reason(
      { question: 'test', asOfDate: ASOF },
      minimalResolvedKnowledge([a, b]),
    )

    const conflict = result.conflicts[0]
    expect(conflict?.resolution).toBe('UNRESOLVED')
    expect(conflict?.isResolved).toBe(false)
    expect(result.humanReviewRequired).toBe(true)
    expect(result.appliedArticles.filter(art => art.role === 'CONFLICT_SOURCE')).toHaveLength(2)
  })
})

describe('LegalReasoningEngine — supersession', () => {
  it('excludes an expired item from active reasoning and marks it SUPERSEDED_CONTEXT', async () => {
    const engine = buildLegalReasoningEngine()
    const expired = legalItem({ itemId: 'expired-1', effectiveFrom: '2020-01-01', effectiveTo: '2024-12-31' })

    const result = await engine.reason(
      { question: 'test', asOfDate: ASOF },
      minimalResolvedKnowledge([expired]),
    )

    expect(result.appliedArticles[0]?.role).toBe('SUPERSEDED_CONTEXT')
    expect(result.appliedDocuments[0]?.wasSuperseded).toBe(true)
    expect(result.warnings.some(w => w.warningCode === 'SUPERSEDED_DOCUMENT')).toBe(true)
  })
})

describe('LegalReasoningEngine.explain', () => {
  it('regenerates an explanation at a different format without re-running the pipeline', async () => {
    const engine = buildLegalReasoningEngine()
    const result = await engine.reason(
      { question: 'Mức tạm ứng tối đa là bao nhiêu?', asOfDate: ASOF, context: { fundSource: 'STATE_BUDGET', advanceRatio: 0.20 } },
      buildResolvedKnowledge(ASOF),
    )

    const explanation = engine.explain(result, 'EXPLANATION')
    expect(explanation.format).toBe('EXPLANATION')
    expect(explanation.summary).toBe(result.explainability.summary)
  })
})
