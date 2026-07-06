import { describe, it, expect } from 'vitest'
import { generateCitations } from '../reasoning/application/citationGenerationStage.ts'
import { resolveConflicts } from '../reasoning/application/conflictResolutionStage.ts'
import { evaluateConfidence } from '../reasoning/application/confidenceEvaluationStage.ts'
import { assembleReasoningContext } from '../reasoning/application/reasoningContextAssembler.ts'
import { evaluateRules } from '../reasoning/application/ruleEvaluationStage.ts'
import { buildLegalReasoningEngine } from '../reasoning/application/legalReasoningEngine.ts'
import { detectIntent } from '../reasoning/application/intentDetector.ts'
import type { KnowledgeItemRef, ResolvedKnowledge } from '../reasoning/domain/reasoningTypes.ts'

// Parity tests — the load-bearing safety net for this milestone's "reuse existing public
// citation builders, never duplicate citation logic" instruction. formatCitations() (Batch A,
// frozen) IS reused directly here; what's independently derived is the AppliedArticle[] input
// shape (which items get cited, with which role), since legalReasoningEngine.ts's own
// role-assignment bookkeeping is private. These tests feed IDENTICAL item scenarios through both
// the real, frozen LegalReasoningEngine.reason() and this milestone's generateCitations(),
// asserting the same set of citations (documentSymbol/article/role/isPrimary/isNormative) -
// proving the independently-derived inputs produce the same result once run through the one,
// reused formatting function.

const ASOF = '2026-07-06'

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

function normalize(citation: { documentSymbol: string; article?: string; role: string; isNormative: boolean; isPrimary: boolean }) {
  return { documentSymbol: citation.documentSymbol, article: citation.article, role: citation.role, isNormative: citation.isNormative, isPrimary: citation.isPrimary }
}

async function generateViaBothPaths(resolvedKnowledge: ResolvedKnowledge) {
  const intent = detectIntent({ question: 'test', asOfDate: ASOF })

  const engine = buildLegalReasoningEngine()
  const realResult = await engine.reason(intent, resolvedKnowledge)

  const context = assembleReasoningContext(intent, resolvedKnowledge)
  const ruleEvaluation = evaluateRules(context)
  const conflictResolution = resolveConflicts(context, ruleEvaluation)
  const confidenceEvaluation = evaluateConfidence(context, ruleEvaluation, conflictResolution)
  const newResult = generateCitations(context, conflictResolution, confidenceEvaluation)

  return { realResult, newResult }
}

describe('Citation generation parity — Tier 1 (hierarchy): both documents cited, LAW is primary', () => {
  it('produces the identical citation set as the real, frozen LegalReasoningEngine', async () => {
    const law = legalItem({ itemId: 'law-a', type: 'LAW', legalBasis: [{ documentSymbol: 'Luat/2023', article: 'Điều 10' }], metadata: { conflictDimension: 'D1', conflictValue: '10' } })
    const circular = legalItem({ itemId: 'circular-b', type: 'CIRCULAR', legalBasis: [{ documentSymbol: 'TT/2024', article: 'Điều 5' }], metadata: { conflictDimension: 'D1', conflictValue: '20' } })
    const resolved = minimalResolvedKnowledge([law, circular])

    const { realResult, newResult } = await generateViaBothPaths(resolved)

    expect(newResult.citations.map(normalize).sort((a, b) => a.documentSymbol.localeCompare(b.documentSymbol)))
      .toEqual(realResult.citations.map(normalize).sort((a, b) => a.documentSymbol.localeCompare(b.documentSymbol)))
    expect(newResult.citations.find(c => c.itemId === 'law-a')?.isPrimary).toBe(true)
    expect(newResult.citations.find(c => c.itemId === 'circular-b')?.isPrimary).toBe(false)
  })
})

describe('Citation generation parity — UNRESOLVED conflict: both cited, neither primary', () => {
  it('produces the identical citation set as the real, frozen LegalReasoningEngine', async () => {
    const a = legalItem({ itemId: 'letter-a', type: 'OFFICIAL_LETTER', effectiveFrom: '2025-01-01', legalBasis: [{ documentSymbol: 'CV/2025-A' }], metadata: { conflictDimension: 'D3', conflictValue: '10' } })
    const b = legalItem({ itemId: 'letter-b', type: 'OFFICIAL_LETTER', effectiveFrom: '2025-01-01', legalBasis: [{ documentSymbol: 'CV/2025-B' }], metadata: { conflictDimension: 'D3', conflictValue: '20' } })
    const resolved = minimalResolvedKnowledge([a, b])

    const { realResult, newResult } = await generateViaBothPaths(resolved)

    expect(newResult.citations.map(normalize).sort((a, b) => a.documentSymbol.localeCompare(b.documentSymbol)))
      .toEqual(realResult.citations.map(normalize).sort((a, b) => a.documentSymbol.localeCompare(b.documentSymbol)))
    expect(newResult.citations.every(c => !c.isPrimary)).toBe(true)
  })
})

describe('Citation generation parity — no conflicts at all (baseline, single item)', () => {
  it('produces the identical citation as the real, frozen LegalReasoningEngine', async () => {
    const solo = legalItem({ itemId: 'solo-1', type: 'LAW', legalBasis: [{ documentSymbol: 'Solo/2025', article: 'Điều 1' }] })
    const resolved = minimalResolvedKnowledge([solo])

    const { realResult, newResult } = await generateViaBothPaths(resolved)

    expect(newResult.citations.map(normalize)).toEqual(realResult.citations.map(normalize))
  })
})

describe('Citation generation parity — a DOCUMENTED, intentional divergence: superseded items', () => {
  it('the real engine cites a superseded item (role SUPERSEDED_CONTEXT, non-primary, non-normative); this stage excludes it, since X.4.6\'s input list has no temporal-validity signal to distinguish it from an ordinary rejected/absent item', async () => {
    const expired = legalItem({ itemId: 'expired-1', effectiveFrom: '2020-01-01', effectiveTo: '2024-12-31' })
    const resolved = minimalResolvedKnowledge([expired])

    const { realResult, newResult } = await generateViaBothPaths(resolved)

    expect(realResult.citations).toHaveLength(1)
    expect(realResult.citations[0]!.role).toBe('SUPERSEDED_CONTEXT')
    expect(newResult.citations).toEqual([])
  })
})
