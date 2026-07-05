import { describe, it, expect } from 'vitest'
import { buildOutputValidator } from '../ai/validation/outputValidator.ts'
import type { AIContext } from '../ai/domain/aiTypes.ts'
import type { LLMOutput } from '../ai/validation/validationTypes.ts'

function context(overrides: Partial<AIContext> = {}): AIContext {
  return {
    contextId: 'ctx-1', builtAt: '2026-07-05T00:00:00.000Z', asOfDate: '2026-07-05',
    question: 'Mức tạm ứng tối đa là bao nhiêu?',
    intent: { intentType: 'ADVANCE_PAYMENT_RULE', confidence: 0.8, ambiguous: false },
    decision: 'Mức tạm ứng tối đa là 20%.', confidence: 0.8, confidenceLabel: 'HIGH', humanReviewRequired: false,
    legalBasis: [
      { itemId: 'i1', documentSymbol: '79/2025/TT-BTC', documentType: 'CIRCULAR', authorityLevel: 8,
        article: 'Điều 15', provisionText: 'Mức tạm ứng tối đa không vượt quá 20% giá trị hợp đồng.',
        role: 'PRIMARY_BASIS', isNormative: true, isPrimary: true, effectiveFrom: '2025-03-15',
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

function output(overrides: Partial<LLMOutput> = {}): LLMOutput {
  return { content: 'Theo Điều 15 TT 79/2025/TT-BTC, mức tạm ứng tối đa là 20% giá trị hợp đồng.', model: 'claude-haiku-3-5-latest', ...overrides }
}

const validator = buildOutputValidator()

describe('OutputValidator — structural checks', () => {
  it('flags MALFORMED_OUTPUT for empty content', () => {
    const result = validator.validate(output({ content: '   ' }), context())
    expect(result.passed).toBe(false)
    expect(result.issues.some(i => i.issueType === 'MALFORMED_OUTPUT')).toBe(true)
  })

  it('flags MALFORMED_OUTPUT for content containing a Unicode replacement character', () => {
    const result = validator.validate(output({ content: 'Mức tạm ứng �' }), context())
    expect(result.issues.some(i => i.issueType === 'MALFORMED_OUTPUT')).toBe(true)
  })

  it('flags MISSING_REQUIRED_SECTION when LEGAL_MEMO format lacks Căn cứ/Phân tích/Kết luận', () => {
    const result = validator.validate(
      output({ content: 'Một đoạn văn bản không có cấu trúc phiếu tư vấn.' }),
      context({ systemInstructions: { ...context().systemInstructions, outputFormat: 'LEGAL_MEMO' } }),
    )
    expect(result.issues.some(i => i.issueType === 'MISSING_REQUIRED_SECTION')).toBe(true)
  })

  it('does not flag MISSING_REQUIRED_SECTION when LEGAL_MEMO sections are all present', () => {
    const result = validator.validate(
      output({ content: 'Căn cứ: Điều 15. Phân tích: ... Kết luận: 20%.' }),
      context({ systemInstructions: { ...context().systemInstructions, outputFormat: 'LEGAL_MEMO' } }),
    )
    expect(result.issues.some(i => i.issueType === 'MISSING_REQUIRED_SECTION')).toBe(false)
  })

  it('flags FORMATTING_VIOLATION for a raw code block in CONVERSATIONAL format', () => {
    const result = validator.validate(output({ content: 'Kết quả:\n```\ncode here\n```' }), context())
    expect(result.issues.some(i => i.issueType === 'FORMATTING_VIOLATION')).toBe(true)
  })

  it('flags LANGUAGE_MISMATCH when output is not Vietnamese but outputLanguage=vi', () => {
    const result = validator.validate(
      output({ content: 'The maximum advance payment is twenty percent of the contract value under this circular.' }),
      context(),
    )
    expect(result.issues.some(i => i.issueType === 'LANGUAGE_MISMATCH')).toBe(true)
  })

  it('flags TRUNCATED_RESPONSE and appends a warning when finishReason=MAX_TOKENS mid-sentence', () => {
    const result = validator.validate(
      output({ content: 'Mức tạm ứng tối đa là 20% và ngoài ra còn cần', finishReason: 'MAX_TOKENS' }), context(),
    )
    expect(result.issues.some(i => i.issueType === 'TRUNCATED_RESPONSE')).toBe(true)
    expect(result.redactedContent).toContain('cắt ngắn')
  })

  it('does not flag TRUNCATED_RESPONSE when the sentence properly ends before the token limit', () => {
    const result = validator.validate(
      output({ content: 'Mức tạm ứng tối đa là 20%.', finishReason: 'MAX_TOKENS' }), context(),
    )
    expect(result.issues.some(i => i.issueType === 'TRUNCATED_RESPONSE')).toBe(false)
  })

  it('flags FORBIDDEN_PATTERN when claiming "không có quy định" while legalBasis is non-empty', () => {
    const result = validator.validate(output({ content: 'Không có quy định nào về vấn đề này.' }), context())
    expect(result.issues.some(i => i.issueType === 'FORBIDDEN_PATTERN')).toBe(true)
  })

  it('flags FORBIDDEN_PATTERN when a specific legal counsel is named', () => {
    const result = validator.validate(output({ content: 'Vui lòng liên hệ luật sư Nguyễn Văn A để được tư vấn.' }), context())
    expect(result.issues.some(i => i.issueType === 'FORBIDDEN_PATTERN')).toBe(true)
  })
})

describe('OutputValidator — aggregation', () => {
  it('passed=false whenever any CRITICAL issue is present', () => {
    const result = validator.validate(output({ content: 'Theo Điều 99 Nghị định 1/2099/NĐ-CP, mức là 50%.' }), context())
    expect(result.passed).toBe(false)
  })

  it('passed=true with a clean, well-grounded, legitimate answer (no over-triggering)', () => {
    const result = validator.validate(output(), context())
    expect(result.passed).toBe(true)
    expect(result.issues.filter(i => i.severity === 'CRITICAL' || i.severity === 'HIGH')).toHaveLength(0)
  })

  it('validationConfidence is always between 0 and 1', () => {
    const result = validator.validate(output(), context())
    expect(result.validationConfidence).toBeGreaterThanOrEqual(0)
    expect(result.validationConfidence).toBeLessThanOrEqual(1)
  })

  it('every issue has a non-empty issueId, description, and a valid severity', () => {
    const result = validator.validate(output({ content: 'Theo Điều 99 Nghị định 1/2099/NĐ-CP, mức là 50%.' }), context())
    for (const issue of result.issues) {
      expect(issue.issueId.length).toBeGreaterThan(0)
      expect(issue.description.length).toBeGreaterThan(0)
      expect(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).toContain(issue.severity)
    }
  })
})
