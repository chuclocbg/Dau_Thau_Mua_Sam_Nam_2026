import { describe, it, expect } from 'vitest'
import { buildValidationPipeline } from '../ai/validation/validationPipeline.ts'
import type { AIContext } from '../ai/domain/aiTypes.ts'
import type { LLMOutput } from '../ai/validation/validationTypes.ts'

function context(overrides: Partial<AIContext> = {}): AIContext {
  return {
    contextId: 'ctx-42', builtAt: '2026-07-05T00:00:00.000Z', asOfDate: '2026-07-05',
    question: 'Mức tạm ứng tối đa là bao nhiêu?',
    intent: { intentType: 'ADVANCE_PAYMENT_RULE', confidence: 0.8, ambiguous: false },
    decision: 'Mức tạm ứng tối đa là 20%, bắt buộc tuân thủ.', confidence: 0.8, confidenceLabel: 'HIGH', humanReviewRequired: false,
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

function output(content: string, overrides: Partial<LLMOutput> = {}): LLMOutput {
  return { content, model: 'claude-haiku-3-5-latest', ...overrides }
}

describe('ValidationPipeline — regression: does not over-trigger on a legitimate, well-grounded answer', () => {
  it('a clean, correctly-cited answer passes through unmodified with no human review required', () => {
    const pipeline = buildValidationPipeline()
    const result = pipeline.run({
      output: output('Theo Điều 15 TT 79/2025/TT-BTC, mức tạm ứng tối đa là 20% giá trị hợp đồng.'),
      context: context(),
    })
    expect(result.validation.passed).toBe(true)
    expect(result.finalAnswer.wasModified).toBe(false)
    expect(result.finalAnswer.humanReviewRequired).toBe(false)
    expect(result.report.passed).toBe(true)
    expect(result.report.totalIssues).toBe(0)
  })
})

describe('ValidationPipeline — adversarial fixture set (100% catch rate required)', () => {
  const adversarialCases: { readonly name: string; readonly content: string; readonly finishReason?: string }[] = [
    { name: 'hallucinated citation', content: 'Theo Điều 99 Nghị định 1/2099/NĐ-CP, mức là 50%.' },
    { name: 'numeric drift', content: 'Mức tạm ứng tối đa 45% giá trị hợp đồng.' },
    { name: 'decision contradiction (negation)', content: 'Do đó, việc tuân thủ mức 20% là không bắt buộc.' },
    { name: 'truncated response', content: 'Mức tạm ứng tối đa là 20% và ngoài ra còn cần', finishReason: 'MAX_TOKENS' },
    { name: 'forbidden pattern (no regulation claim)', content: 'Không có quy định nào về vấn đề này.' },
    { name: 'malformed output (empty)', content: '   ' },
  ]

  it.each(adversarialCases)('catches: $name', ({ content, finishReason }) => {
    const pipeline = buildValidationPipeline()
    const result = pipeline.run({ output: output(content, { finishReason }), context: context() })
    expect(result.validation.issues.length, `expected at least one issue for: ${content}`).toBeGreaterThan(0)
  })

  it('every adversarial case triggers humanReviewRequired or a redaction/append on the final answer', () => {
    const pipeline = buildValidationPipeline()
    for (const testCase of adversarialCases) {
      const result = pipeline.run({ output: output(testCase.content, { finishReason: testCase.finishReason }), context: context() })
      const flagged = result.finalAnswer.humanReviewRequired || result.finalAnswer.wasModified || !result.validation.passed
      expect(flagged, `expected "${testCase.name}" to be flagged in some way`).toBe(true)
    }
  })
})

describe('ValidationPipeline — ValidationReport', () => {
  it('groups issues by severity with correct counts', () => {
    const pipeline = buildValidationPipeline()
    const result = pipeline.run({
      output: output('Theo Điều 99 Nghị định 1/2099/NĐ-CP, mức là 50%.'), context: context(),
    })
    expect(result.report.contextId).toBe('ctx-42')
    const criticalSection = result.report.bySeverity.find(s => s.severity === 'CRITICAL')
    expect(criticalSection?.count).toBeGreaterThan(0)
    expect(result.report.humanReviewRecommended).toBe(true)
  })

  it('reports zero sections when there are no issues', () => {
    const pipeline = buildValidationPipeline()
    const result = pipeline.run({
      output: output('Theo Điều 15 TT 79/2025/TT-BTC, mức tạm ứng tối đa là 20% giá trị hợp đồng.'), context: context(),
    })
    expect(result.report.bySeverity).toEqual([])
    expect(result.report.humanReviewRecommended).toBe(false)
  })
})
