import { describe, it, expect } from 'vitest'
import { validateCitations } from '../ai/validation/citationValidator.ts'
import type { AIContext } from '../ai/domain/aiTypes.ts'
import type { LLMOutput } from '../ai/validation/validationTypes.ts'

function context(overrides: Partial<AIContext> = {}): AIContext {
  return {
    contextId: 'ctx-1', builtAt: '2026-07-05T00:00:00.000Z', asOfDate: '2026-07-05',
    question: 'q', intent: { intentType: 'ADVANCE_PAYMENT_RULE', confidence: 0.8, ambiguous: false },
    decision: 'Tối đa 20%.', confidence: 0.72, confidenceLabel: 'MEDIUM', humanReviewRequired: false,
    legalBasis: [
      { itemId: 'i1', documentSymbol: '79/2025/TT-BTC', documentType: 'CIRCULAR', authorityLevel: 8,
        article: 'Điều 15', provisionText: 'Tối đa 30% giá trị hợp đồng.', role: 'PRIMARY_BASIS',
        isNormative: true, isPrimary: true, effectiveFrom: '2025-03-15',
        citationFull: 'Điều 15 TT 79/2025/TT-BTC', citationShort: 'Đ15 TT 79/2025',
        citationInline: '(Điều 15 TT 79/2025/TT-BTC)' },
    ],
    citations: [
      { citationId: 'c1', itemId: 'i1', full: 'Điều 15 TT 79/2025/TT-BTC', short: 'Đ15 TT 79/2025',
        inline: '(Điều 15 TT 79/2025/TT-BTC)', isNormative: true, isPrimary: true },
    ],
    evidence: [], reasoningTrace: [], warnings: [], missingInformation: [], recommendedActions: [],
    attachments: [], conversationHistory: [],
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

describe('validateCitations', () => {
  it('passes a citation that matches AIContext.legalBasis', () => {
    const outcome = validateCitations(output('Theo Điều 15 Thông tư 79/2025/TT-BTC, mức tối đa là 30%.'), context())
    expect(outcome.issues).toHaveLength(0)
    expect(outcome.redactedContent).toBeUndefined()
  })

  it('flags and redacts a hallucinated document symbol not present in AIContext', () => {
    const outcome = validateCitations(output('Theo Điều 25 Nghị định 10/2022/NĐ-CP, mức tạm ứng là 30%.'), context())
    expect(outcome.issues.some(i => i.issueType === 'HALLUCINATED_CITATION' && i.severity === 'CRITICAL')).toBe(true)
    expect(outcome.redactedContent).toContain('[NGUỒN KHÔNG XÁC MINH]')
    expect(outcome.redactedContent).not.toContain('10/2022/NĐ-CP')
  })

  it('flags an invalid citation structure ("Điều" not followed by a number)', () => {
    const outcome = validateCitations(output('Theo Điều nào đó của luật, mức tạm ứng là 30%.'), context())
    expect(outcome.issues.some(i => i.issueType === 'INVALID_CITATION_STRUCTURE')).toBe(true)
  })

  it('flags MISSING_LEGAL_BASIS when a normative claim is made with an empty legalBasis', () => {
    const outcome = validateCitations(output('Đơn vị bắt buộc phải nộp hồ sơ trước ngày 10.'), context({ legalBasis: [] }))
    expect(outcome.issues.some(i => i.issueType === 'MISSING_LEGAL_BASIS' && i.severity === 'CRITICAL')).toBe(true)
  })

  it('does not flag MISSING_LEGAL_BASIS when there is no normative claim at all', () => {
    const outcome = validateCitations(output('Xin chào, tôi có thể giúp gì cho bạn?'), context({ legalBasis: [] }))
    expect(outcome.issues.some(i => i.issueType === 'MISSING_LEGAL_BASIS')).toBe(false)
  })
})
