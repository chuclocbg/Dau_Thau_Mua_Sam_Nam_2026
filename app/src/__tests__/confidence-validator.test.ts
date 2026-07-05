import { describe, it, expect } from 'vitest'
import { validateConfidence } from '../ai/validation/confidenceValidator.ts'
import type { AIContext } from '../ai/domain/aiTypes.ts'
import type { LLMOutput } from '../ai/validation/validationTypes.ts'

function context(overrides: Partial<AIContext> = {}): AIContext {
  return {
    contextId: 'ctx-1', builtAt: '2026-07-05T00:00:00.000Z', asOfDate: '2026-07-05',
    question: 'q', intent: { intentType: 'ADVANCE_PAYMENT_RULE', confidence: 0.8, ambiguous: false },
    decision: null, confidence: 0.4, confidenceLabel: 'LOW', humanReviewRequired: false,
    legalBasis: [
      { itemId: 'i1', documentSymbol: '79/2025/TT-BTC', documentType: 'CIRCULAR', authorityLevel: 8,
        article: 'Điều 15', provisionText: 'Mức tạm ứng tối đa 30% giá trị hợp đồng.', role: 'PRIMARY_BASIS',
        isNormative: true, isPrimary: true, effectiveFrom: '2025-03-15',
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

describe('validateConfidence — confidence inconsistency', () => {
  it('flags certainty language when AIContext confidence is LOW and no hedging is present', () => {
    const issues = validateConfidence(output('Đơn vị chắc chắn phải nộp hồ sơ đúng hạn.'), context({ confidenceLabel: 'LOW' }))
    expect(issues.some(i => i.issueType === 'CONFIDENCE_INCONSISTENCY')).toBe(true)
  })

  it('flags certainty language when humanReviewRequired is true, regardless of confidence label', () => {
    const issues = validateConfidence(
      output('Điều này tuyệt đối bắt buộc.'), context({ confidenceLabel: 'HIGH', humanReviewRequired: true }),
    )
    expect(issues.some(i => i.issueType === 'CONFIDENCE_INCONSISTENCY')).toBe(true)
  })

  it('does not flag when certainty language is paired with a hedging qualifier', () => {
    const issues = validateConfidence(
      output('Điều này chắc chắn quan trọng, tuy nhiên khuyến nghị rà soát trước khi áp dụng.'),
      context({ confidenceLabel: 'LOW' }),
    )
    expect(issues.some(i => i.issueType === 'CONFIDENCE_INCONSISTENCY')).toBe(false)
  })

  it('does not flag certainty language when AIContext confidence is HIGH and review is not required', () => {
    const issues = validateConfidence(
      output('Điều này chắc chắn đúng theo quy định.'), context({ confidenceLabel: 'HIGH', humanReviewRequired: false }),
    )
    expect(issues.some(i => i.issueType === 'CONFIDENCE_INCONSISTENCY')).toBe(false)
  })
})

describe('validateConfidence — unsupported claims', () => {
  it('flags a normative sentence sharing no grounding keyword with legalBasis/evidence', () => {
    const issues = validateConfidence(
      output('Nhà thầu bắt buộc phải sơn màu xanh cho thiết bị lắp đặt.'), context(),
    )
    expect(issues.some(i => i.issueType === 'UNSUPPORTED_CLAIM')).toBe(true)
  })

  it('does not flag a normative sentence grounded in legalBasis provisionText', () => {
    const issues = validateConfidence(
      output('Mức tạm ứng tối đa 30% giá trị hợp đồng phải được tuân thủ.'), context(),
    )
    expect(issues.some(i => i.issueType === 'UNSUPPORTED_CLAIM')).toBe(false)
  })

  it('does not flag a non-normative sentence at all', () => {
    const issues = validateConfidence(output('Xin chào, tôi có thể giúp gì cho bạn?'), context())
    expect(issues.some(i => i.issueType === 'UNSUPPORTED_CLAIM')).toBe(false)
  })
})
