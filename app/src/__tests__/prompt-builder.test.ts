import { describe, it, expect } from 'vitest'
import { buildPrompt } from '../ai/application/promptBuilder.ts'
import type { AIContext } from '../ai/domain/aiTypes.ts'

function context(overrides: Partial<AIContext> = {}): AIContext {
  return {
    contextId: 'ctx-1', builtAt: '2026-07-05T00:00:00.000Z', asOfDate: '2026-07-05',
    question: 'Mức tạm ứng tối đa là bao nhiêu?',
    intent: { intentType: 'ADVANCE_PAYMENT_RULE', confidence: 0.8, ambiguous: false },
    decision: 'Tối đa 20%.', confidence: 0.72, confidenceLabel: 'MEDIUM',
    humanReviewRequired: false,
    legalBasis: [
      { itemId: 'i1', documentSymbol: '79/2025/TT-BTC', documentType: 'CIRCULAR', authorityLevel: 8,
        article: 'Điều 15', provisionText: 'Tối đa 30%.', role: 'PRIMARY_BASIS', isNormative: true,
        isPrimary: true, effectiveFrom: '2025-03-15', citationFull: 'Điều 15 TT 79/2025/TT-BTC',
        citationShort: 'Đ15 TT 79/2025', citationInline: '(Điều 15 TT 79/2025/TT-BTC)' },
    ],
    citations: [], evidence: [{ itemId: 'i1', domain: 'legal', type: 'CIRCULAR', title: 'TT 79/2025 Điều 15', summary: 'Tối đa 30%.', role: 'PRIMARY_BASIS', confidence: 0.9 }],
    reasoningTrace: [], warnings: [{ warningCode: 'W1', severity: 'HIGH', message: 'cảnh báo test' }],
    missingInformation: [], recommendedActions: [], attachments: [],
    conversationHistory: [
      { role: 'USER', content: 'Câu hỏi trước', timestamp: '2026-07-05T00:00:00.000Z' },
      { role: 'ASSISTANT', content: 'Trả lời trước', timestamp: '2026-07-05T00:00:01.000Z' },
    ],
    systemInstructions: {
      role: 'Trợ lý', outputLanguage: 'vi', outputFormat: 'CONVERSATIONAL', tone: 'FORMAL_LEGAL',
      citationStyle: 'INLINE', forbiddenBehaviors: ['Không bịa đặt căn cứ pháp lý'], contextSummary: 'tóm tắt',
    },
    totalTokenEstimate: 100, language: 'vi',
    ...overrides,
  }
}

describe('buildPrompt', () => {
  it('produces one section per kind, in a fixed order', () => {
    const spec = buildPrompt(context())
    expect(spec.sections.map(s => s.kind)).toEqual([
      'SYSTEM_INSTRUCTIONS', 'QUESTION', 'DECISION_CONTEXT', 'LEGAL_BASIS', 'EVIDENCE', 'WARNINGS',
    ])
  })

  it('is a pure function: identical input produces identical output', () => {
    const ctx = context()
    expect(buildPrompt(ctx)).toEqual(buildPrompt(ctx))
  })

  it('the QUESTION section content is exactly context.question, unmodified', () => {
    const spec = buildPrompt(context())
    const question = spec.sections.find(s => s.kind === 'QUESTION')
    expect(question?.content).toBe('Mức tạm ứng tối đa là bao nhiêu?')
  })

  it('the LEGAL_BASIS section renders every legalBasis entry, verbatim from AIContext', () => {
    const spec = buildPrompt(context())
    const legalBasisSection = spec.sections.find(s => s.kind === 'LEGAL_BASIS')
    expect(legalBasisSection?.content).toContain('Điều 15 TT 79/2025/TT-BTC')
    expect(legalBasisSection?.content).toContain('Tối đa 30%.')
  })

  it('renders a placeholder when there is no legal basis, without inventing content', () => {
    const spec = buildPrompt(context({ legalBasis: [] }))
    const legalBasisSection = spec.sections.find(s => s.kind === 'LEGAL_BASIS')
    expect(legalBasisSection?.content).toBe('(không có căn cứ pháp lý)')
  })

  it('passes conversationMessages through unchanged', () => {
    const spec = buildPrompt(context())
    expect(spec.conversationMessages).toHaveLength(2)
    expect(spec.conversationMessages[0]!.content).toBe('Câu hỏi trước')
  })
})
