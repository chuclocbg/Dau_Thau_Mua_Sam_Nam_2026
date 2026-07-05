import { describe, it, expect } from 'vitest'
import { composeDecision, computeConfidence, determineHumanReview } from '../reasoning/application/answerComposer.ts'
import type { FormattedCitation, LegalRuleResult, ReasoningIntent } from '../reasoning/domain/reasoningTypes.ts'

function intent(overrides: Partial<ReasoningIntent> = {}): ReasoningIntent {
  return {
    intentType: 'ADVANCE_PAYMENT_RULE', question: 'q', normalizedQuestion: 'q', detectedEntities: [],
    context: { asOfDate: '2026-07-05', packageType: 'GOODS', fundSource: 'STATE_BUDGET', procurementMethod: 'OPEN_TENDER' },
    confidence: 0.8, ambiguous: false,
    ...overrides,
  }
}

describe('computeConfidence', () => {
  it('starts at 1.00 / HIGH when nothing is wrong', () => {
    const result = computeConfidence({
      intent: intent(), conflicts: [], appliedDocuments: [], missingEvidence: [],
      unresolvedCrossReferenceCount: 0, unresolvedExceptionCount: 0, primaryItemConfidences: [0.95],
    })
    expect(result.finalScore).toBe(1)
    expect(result.label).toBe('HIGH')
  })

  it('deducts 0.10 flat for an ambiguous intent', () => {
    const result = computeConfidence({
      intent: intent({ ambiguous: true }), conflicts: [], appliedDocuments: [], missingEvidence: [],
      unresolvedCrossReferenceCount: 0, unresolvedExceptionCount: 0, primaryItemConfidences: [],
    })
    expect(result.finalScore).toBeCloseTo(0.90)
  })

  it('deducts 0.20 (uncapped per conflict) for each unresolved conflict', () => {
    const result = computeConfidence({
      intent: intent(), conflicts: [
        { conflictId: 'c1', description: 'x', conflictingItems: [
          { itemId: 'a', documentSymbol: 'A', provision: 'p', authorityLevel: 8, effectiveFrom: '2025-01-01', layer: 1 },
          { itemId: 'b', documentSymbol: 'B', provision: 'p', authorityLevel: 8, effectiveFrom: '2025-01-01', layer: 1 },
        ], resolution: 'UNRESOLVED', isResolved: false },
      ], appliedDocuments: [], missingEvidence: [],
      unresolvedCrossReferenceCount: 0, unresolvedExceptionCount: 0, primaryItemConfidences: [],
    })
    expect(result.finalScore).toBeCloseTo(0.80)
  })

  it('falls to VERY_LOW once deductions push the score below 0.50', () => {
    const result = computeConfidence({
      intent: intent(), conflicts: [], appliedDocuments: [],
      missingEvidence: [
        { evidenceId: 'm1', description: 'x', isCritical: true, impact: 'x' },
        { evidenceId: 'm2', description: 'x', isCritical: true, impact: 'x' },
        { evidenceId: 'm3', description: 'x', isCritical: true, impact: 'x' },
      ],
      unresolvedCrossReferenceCount: 0, unresolvedExceptionCount: 0, primaryItemConfidences: [],
    })
    expect(result.finalScore).toBeCloseTo(0.40)
    expect(result.label).toBe('VERY_LOW')
  })
})

describe('determineHumanReview', () => {
  it('is not required when everything is clean', () => {
    const result = determineHumanReview({
      confidence: 0.9, conflicts: [], missingEvidence: [], unresolvedExceptionCount: 0,
      primaryItemConfidences: [0.9], externallyFlagged: false,
    })
    expect(result.required).toBe(false)
  })

  it('is required when confidence is below 0.50', () => {
    const result = determineHumanReview({
      confidence: 0.4, conflicts: [], missingEvidence: [], unresolvedExceptionCount: 0,
      primaryItemConfidences: [], externallyFlagged: false,
    })
    expect(result.required).toBe(true)
    expect(result.reason).toMatch(/Độ tin cậy/)
  })

  it('is required when more than 3 exceptions are unresolved', () => {
    const result = determineHumanReview({
      confidence: 0.9, conflicts: [], missingEvidence: [], unresolvedExceptionCount: 4,
      primaryItemConfidences: [], externallyFlagged: false,
    })
    expect(result.required).toBe(true)
  })
})

describe('composeDecision', () => {
  const citation: FormattedCitation = {
    citationId: 'c1', itemId: 'i1', documentSymbol: '79/2025/TT-BTC', article: 'Điều 15',
    full: 'Điều 15 Thông tư 79/2025/TT-BTC', short: 'Đ15 TT 79/2025', inline: '(Điều 15 TT 79/2025/TT-BTC)',
    role: 'PRIMARY_BASIS', isNormative: true, isPrimary: true,
  }
  const rule: LegalRuleResult = {
    ruleItemId: 'r1', ruleCode: 'RULE-A01', status: 'PASS', evidence: ['r1'],
    legalBasis: [], explanation: 'Tạm ứng tối đa 30%.', missingFields: [],
  }

  it('returns null when confidence is below 0.50', () => {
    expect(composeDecision([citation], [rule], 0.4)).toBeNull()
  })

  it('returns null when there is no passing/exception rule to compose from', () => {
    expect(composeDecision([citation], [{ ...rule, status: 'FAIL' }], 0.9)).toBeNull()
  })

  it('composes a decision string prefixed by the primary citation', () => {
    const decision = composeDecision([citation], [rule], 0.9)
    expect(decision).toContain('Điều 15 Thông tư 79/2025/TT-BTC')
    expect(decision).toContain('Tạm ứng tối đa 30%.')
  })
})
