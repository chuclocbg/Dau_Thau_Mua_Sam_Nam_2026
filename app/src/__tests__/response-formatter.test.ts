import { describe, it, expect } from 'vitest'
import { formatFinalAnswer } from '../ai/validation/responseFormatter.ts'
import type { AIContext } from '../ai/domain/aiTypes.ts'
import type { AIValidationResult, LLMOutput } from '../ai/validation/validationTypes.ts'

function context(overrides: Partial<AIContext> = {}): AIContext {
  return {
    contextId: 'ctx-1', builtAt: '2026-07-05T00:00:00.000Z', asOfDate: '2026-07-05', question: 'q',
    intent: { intentType: 'ADVANCE_PAYMENT_RULE', confidence: 0.8, ambiguous: false },
    decision: 'x', confidence: 0.8, confidenceLabel: 'HIGH', humanReviewRequired: false,
    legalBasis: [], citations: [], evidence: [], reasoningTrace: [], warnings: [], missingInformation: [],
    recommendedActions: [], attachments: [], conversationHistory: [],
    systemInstructions: {
      role: 'Trợ lý', outputLanguage: 'vi', outputFormat: 'CONVERSATIONAL', tone: 'FORMAL_LEGAL',
      citationStyle: 'INLINE', forbiddenBehaviors: [], contextSummary: 'x',
    },
    totalTokenEstimate: 10, language: 'vi',
    ...overrides,
  }
}

function output(content: string): LLMOutput {
  return { content, model: 'claude-haiku-3-5-latest' }
}

function result(overrides: Partial<AIValidationResult> = {}): AIValidationResult {
  return { passed: true, issues: [], wasRedacted: false, validationConfidence: 1, validatedAt: '2026-07-05T00:00:00.000Z', ...overrides }
}

describe('formatFinalAnswer', () => {
  it('returns the original content unchanged when validation passed with no issues', () => {
    const answer = formatFinalAnswer(output('Nội dung sạch.'), result(), context())
    expect(answer.content).toBe('Nội dung sạch.')
    expect(answer.wasModified).toBe(false)
    expect(answer.humanReviewRequired).toBe(false)
  })

  it('uses redactedContent when wasRedacted is true', () => {
    const answer = formatFinalAnswer(
      output('Theo NĐ 1/2099/NĐ-CP...'),
      result({ wasRedacted: true, redactedContent: 'Theo [NGUỒN KHÔNG XÁC MINH]...' }),
      context(),
    )
    expect(answer.content).toBe('Theo [NGUỒN KHÔNG XÁC MINH]...')
    expect(answer.wasModified).toBe(true)
  })

  it('appends the critical warning banner and requires human review when a CRITICAL issue is present', () => {
    const answer = formatFinalAnswer(
      output('Nội dung.'),
      result({
        passed: false,
        issues: [{ issueId: 'x', issueType: 'HALLUCINATED_CITATION', severity: 'CRITICAL', description: 'x', autoFixed: true }],
      }),
      context(),
    )
    expect(answer.content).toContain('Cảnh báo')
    expect(answer.humanReviewRequired).toBe(true)
  })

  it('sets a specific humanReviewReason and requires review on DECISION_CONTRADICTION, even without a CRITICAL-severity banner check failing elsewhere', () => {
    const answer = formatFinalAnswer(
      output('Nội dung.'),
      result({
        passed: false,
        issues: [{ issueId: 'x', issueType: 'DECISION_CONTRADICTION', severity: 'CRITICAL', description: 'x', autoFixed: false }],
      }),
      context(),
    )
    expect(answer.humanReviewRequired).toBe(true)
    expect(answer.humanReviewReason).toMatch(/mâu thuẫn/)
  })

  it('preserves AIContext.humanReviewRequired even when validation found no issues at all', () => {
    const answer = formatFinalAnswer(output('Nội dung.'), result(), context({ humanReviewRequired: true, humanReviewReason: 'thiếu chứng cứ' }))
    expect(answer.humanReviewRequired).toBe(true)
    expect(answer.humanReviewReason).toBe('thiếu chứng cứ')
  })
})
