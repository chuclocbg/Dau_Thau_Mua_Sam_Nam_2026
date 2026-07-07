import { describe, it, expect } from 'vitest'
import { formatConversationResponse } from '../reasoning/application/outputFormatter.ts'
import { buildExplanation, determineHumanReview } from '../reasoning/application/answerComposer.ts'
import type { ReasoningAnswerResult } from '../reasoning/domain/reasoningAnswerTypes.ts'
import type { DetectedConflict, FormattedCitation } from '../reasoning/domain/reasoningTypes.ts'

// Parity tests — the load-bearing safety net for this milestone's "reuse existing code, never
// duplicate algorithms" instruction. buildExplanation() and determineHumanReview() (Batch A,
// frozen) are reused directly, called honestly with empty appliedArticles/missingEvidence
// (ReasoningAnswerResult carries neither). These tests prove the formatter's markdown/warnings
// are byte-for-byte derived from calling those same functions directly with the same inputs —
// not an independently reimplemented approximation.

function citation(overrides: Partial<FormattedCitation> = {}): FormattedCitation {
  return {
    citationId: 'citation-1', itemId: 'item-1', documentSymbol: 'X/2025',
    full: 'Luật X/2025', short: 'X/2025', inline: '(Luật X/2025)',
    role: 'PRIMARY_BASIS', isNormative: true, isPrimary: true,
    ...overrides,
  }
}

function answer(overrides: Partial<ReasoningAnswerResult> = {}): ReasoningAnswerResult {
  return {
    decision: null,
    primaryCitations: [], supportingCitations: [], disputedCitations: [],
    confidenceSummary: { baseScore: 1, deductions: [], finalScore: 1, label: 'HIGH' },
    conflicts: [],
    composedAt: '2026-07-07T00:00:00.000Z',
    ...overrides,
  }
}

describe('Output formatter parity — decision text matches buildExplanation() directly', () => {
  it('the decision section body is exactly buildExplanation().summary for a null decision', () => {
    const input = answer({ confidenceSummary: { baseScore: 1, deductions: [], finalScore: 0.3, label: 'VERY_LOW' } })

    const response = formatConversationResponse(input)
    const expected = buildExplanation({
      format: 'EXPLANATION', decision: null, appliedArticles: [], conflicts: [], missingEvidence: [],
      confidence: input.confidenceSummary, citations: [],
    })

    expect(response.sections[0]!.body).toBe(expected.summary)
  })

  it('the decision section body is exactly buildExplanation().summary for a real decision string', () => {
    const input = answer({ decision: 'Đấu thầu rộng rãi áp dụng.' })

    const response = formatConversationResponse(input)
    const expected = buildExplanation({
      format: 'EXPLANATION', decision: input.decision, appliedArticles: [], conflicts: [], missingEvidence: [],
      confidence: input.confidenceSummary, citations: [],
    })

    expect(response.sections[0]!.body).toBe(expected.summary)
    expect(response.sections[0]!.body).toBe('Đấu thầu rộng rãi áp dụng.')
  })
})

describe('Output formatter parity — warnings match determineHumanReview() directly', () => {
  it('produces no warnings when determineHumanReview() reports required=false', () => {
    const input = answer()
    const response = formatConversationResponse(input)
    const expected = determineHumanReview({
      confidence: 1, conflicts: [], missingEvidence: [], unresolvedExceptionCount: 0,
      primaryItemConfidences: [], externallyFlagged: false,
    })

    expect(expected.required).toBe(false)
    expect(response.warnings).toEqual([])
    expect(response.humanReviewRecommended).toBe(false)
  })

  it('splits determineHumanReview()\'s combined reason string into one warning per reason, for low confidence AND an unresolved conflict together', () => {
    const conflicts: DetectedConflict[] = [{
      conflictId: 'c1', description: 'd', isResolved: false,
      conflictingItems: [
        { itemId: 'a', documentSymbol: 'X/2025', provision: 's', authorityLevel: 3, effectiveFrom: '2025-01-01', layer: 1 },
        { itemId: 'b', documentSymbol: 'X/2025', provision: 's', authorityLevel: 3, effectiveFrom: '2025-01-01', layer: 1 },
      ],
      resolution: 'UNRESOLVED',
    }]
    const input = answer({
      conflicts, confidenceSummary: { baseScore: 1, deductions: [], finalScore: 0.3, label: 'VERY_LOW' },
    })

    const response = formatConversationResponse(input)
    const expected = determineHumanReview({
      confidence: 0.3, conflicts, missingEvidence: [], unresolvedExceptionCount: 0,
      primaryItemConfidences: [], externallyFlagged: false,
    })

    expect(expected.required).toBe(true)
    expect(response.humanReviewRecommended).toBe(true)
    expect(response.humanReviewReason).toBe(expected.reason)
    expect(response.warnings).toEqual(expected.reason!.split('; '))
    expect(response.warnings.length).toBeGreaterThanOrEqual(2)
  })
})

describe('Output formatter parity — never re-derives conflict/confidence facts independently', () => {
  it('confidenceLabel/confidenceScore are exactly ReasoningAnswerResult.confidenceSummary, not recomputed', () => {
    const input = answer({ confidenceSummary: { baseScore: 1, deductions: [], finalScore: 0.72, label: 'MEDIUM' } })
    const response = formatConversationResponse(input)
    expect(response.confidenceLabel).toBe('MEDIUM')
    expect(response.confidenceScore).toBe(0.72)
  })
})
