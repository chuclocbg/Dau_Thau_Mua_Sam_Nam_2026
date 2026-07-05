import { describe, it, expect } from 'vitest'
import { validateLegalConsistency } from '../ai/validation/legalConsistencyValidator.ts'
import type { AIContext } from '../ai/domain/aiTypes.ts'
import type { LLMOutput } from '../ai/validation/validationTypes.ts'

function context(overrides: Partial<AIContext> = {}): AIContext {
  return {
    contextId: 'ctx-1', builtAt: '2026-07-05T00:00:00.000Z', asOfDate: '2026-07-05',
    question: 'q', intent: { intentType: 'ADVANCE_PAYMENT_RULE', confidence: 0.8, ambiguous: false },
    decision: 'Mức tạm ứng tối đa là 20%, bắt buộc tuân thủ.', confidence: 0.72, confidenceLabel: 'MEDIUM',
    humanReviewRequired: false,
    legalBasis: [
      { itemId: 'i1', documentSymbol: '79/2025/TT-BTC', documentType: 'CIRCULAR', authorityLevel: 8,
        article: 'Điều 15', provisionText: 'Mức tạm ứng tối đa không vượt quá 20% giá trị hợp đồng.',
        role: 'PRIMARY_BASIS', isNormative: true, isPrimary: true, effectiveFrom: '2025-03-15',
        citationFull: 'Điều 15 TT 79/2025/TT-BTC', citationShort: 'Đ15 TT 79/2025',
        citationInline: '(Điều 15 TT 79/2025/TT-BTC)' },
    ],
    citations: [], evidence: [], reasoningTrace: [], warnings: [], missingInformation: [],
    recommendedActions: [], attachments: [], conversationHistory: [],
    systemInstructions: {
      role: 'Trợ lý', outputLanguage: 'vi', outputFormat: 'CONVERSATIONAL', tone: 'FORMAL_LEGAL',
      citationStyle: 'INLINE', forbiddenBehaviors: [], contextSummary: 'tóm tắt',
    },
    totalTokenEstimate: 100, language: 'vi',
    ...overrides,
  }
}

function output(content: string): LLMOutput {
  return { content, model: 'claude-haiku-3-5-latest' }
}

describe('validateLegalConsistency — numeric consistency', () => {
  it('flags a legal-limit number ("tối đa X%") that does not appear anywhere in AIContext', () => {
    const issues = validateLegalConsistency(output('Mức tạm ứng tối đa 45% giá trị hợp đồng.'), context())
    expect(issues.some(i => i.issueType === 'NUMERIC_INCONSISTENCY')).toBe(true)
  })

  it('does not flag a legal-limit number that does appear in AIContext', () => {
    const issues = validateLegalConsistency(output('Mức tạm ứng tối đa 20% giá trị hợp đồng.'), context())
    expect(issues.some(i => i.issueType === 'NUMERIC_INCONSISTENCY')).toBe(false)
  })

  it('does not flag a number with no nearby limit marker (e.g. a conversational example)', () => {
    const issues = validateLegalConsistency(output('Ví dụ, một gói thầu trị giá 500 triệu đồng.'), context())
    expect(issues.some(i => i.issueType === 'NUMERIC_INCONSISTENCY')).toBe(false)
  })
})

describe('validateLegalConsistency — decision contradiction', () => {
  it('flags a negation mismatch (decision says bắt buộc, conclusion says không bắt buộc)', () => {
    const issues = validateLegalConsistency(
      output('Do đó, việc tuân thủ mức 20% là không bắt buộc trong trường hợp này.'), context(),
    )
    expect(issues.some(i => i.issueType === 'DECISION_CONTRADICTION')).toBe(true)
  })

  it('flags a numeric mismatch between decision and conclusion', () => {
    const issues = validateLegalConsistency(output('Vì vậy, mức tạm ứng tối đa được áp dụng là 35%.'), context())
    expect(issues.some(i => i.issueType === 'DECISION_CONTRADICTION')).toBe(true)
  })

  it('does not flag when the conclusion matches the decision', () => {
    const issues = validateLegalConsistency(output('Vì vậy, mức tạm ứng tối đa được áp dụng là 20%.'), context())
    expect(issues.some(i => i.issueType === 'DECISION_CONTRADICTION')).toBe(false)
  })

  it('skips the check entirely when AIContext.decision is null', () => {
    const issues = validateLegalConsistency(
      output('Do đó, mức áp dụng là 99% — hoàn toàn khác biệt.'), context({ decision: null }),
    )
    expect(issues.some(i => i.issueType === 'DECISION_CONTRADICTION')).toBe(false)
  })

  it('skips the check entirely when confidenceLabel is LOW', () => {
    const issues = validateLegalConsistency(
      output('Do đó, mức áp dụng là 99% — hoàn toàn khác biệt.'), context({ confidenceLabel: 'LOW' }),
    )
    expect(issues.some(i => i.issueType === 'DECISION_CONTRADICTION')).toBe(false)
  })

  it('does not flag when there is no conclusion marker sentence at all', () => {
    const issues = validateLegalConsistency(output('Mức 20% được áp dụng theo quy định.'), context())
    expect(issues.some(i => i.issueType === 'DECISION_CONTRADICTION')).toBe(false)
  })
})
