import { describe, it, expect } from 'vitest'
import { buildAIContext } from '../ai/application/aiContextBuilder.ts'
import type { ReasoningResult } from '../reasoning/domain/reasoningTypes.ts'
import type { AdvisoryConversationMessage } from '../conversation/domain/conversationTypes.ts'

function reasoningResult(overrides: Partial<ReasoningResult> = {}): ReasoningResult {
  return {
    decision: 'Tạm ứng tối đa 20%.', confidence: 0.72, confidenceLabel: 'MEDIUM',
    appliedDocuments: [
      { itemId: 'i1', documentSymbol: '79/2025/TT-BTC', documentType: 'CIRCULAR', title: 't',
        authorityLevel: 8, effectiveFrom: '2025-03-15', role: 'PRIMARY_BASIS', wasSuperseded: false },
    ],
    appliedArticles: [
      { itemId: 'i1', documentSymbol: '79/2025/TT-BTC', documentType: 'CIRCULAR', article: 'Điều 15',
        extractedText: 'Mức tạm ứng tối đa 30%.', role: 'PRIMARY_BASIS', applicabilityScore: 0.9,
        exceptions: [], crossReferences: [] },
    ],
    reasoningTrace: Array.from({ length: 15 }, (_, i) => ({
      stepId: `s${i}`, stage: 'RULE_EVALUATION' as const, action: 'EVALUATE_RULE' as const,
      description: `step ${i}`, itemIdsConsumed: [], confidence: 0.9, flagged: false, humanReviewTriggered: false,
    })),
    citations: [
      { citationId: 'c1', itemId: 'i1', documentSymbol: '79/2025/TT-BTC', article: 'Điều 15',
        full: 'Điều 15 Thông tư 79/2025/TT-BTC', short: 'Đ15 TT 79/2025', inline: '(Điều 15 TT 79/2025/TT-BTC)',
        role: 'PRIMARY_BASIS', isNormative: true, isPrimary: true },
    ],
    missingEvidence: [{ evidenceId: 'm1', description: 'Thiếu nguồn vốn', isCritical: true, impact: 'x' }],
    evidenceSufficiency: 'PARTIAL',
    warnings: [
      { warningCode: 'W1', severity: 'LOW', stage: 'REASONING', message: 'low warning' },
      { warningCode: 'W2', severity: 'CRITICAL', stage: 'REASONING', message: 'critical warning' },
    ],
    humanReviewRequired: true, humanReviewReason: 'Thiếu chứng cứ trọng yếu',
    intent: {
      intentType: 'ADVANCE_PAYMENT_RULE', question: 'Mức tạm ứng tối đa là bao nhiêu?',
      normalizedQuestion: 'mức tạm ứng tối đa là bao nhiêu?', detectedEntities: [],
      context: { asOfDate: '2026-07-05' }, confidence: 0.8, ambiguous: false,
    },
    explainability: { format: 'EXPLANATION', summary: 'Tóm tắt', decisionRationale: 'r', keyProvisions: [] },
    resolvedKnowledge: {
      legalItems: [], procurementItems: [], thresholdItems: [], ruleItems: [], schoolPolicyItems: [],
      asOfDate: '2026-07-05', resolvedAt: '2026-07-05T00:00:00.000Z', platformCallCount: 0, warnings: [],
    },
    conflicts: [],
    thresholdResults: [],
    ruleResults: [
      { ruleItemId: 'r1', ruleCode: 'RULE-X', status: 'FAIL', evidence: ['r1'], legalBasis: [],
        explanation: 'Vi phạm quy tắc X', missingFields: [] },
    ],
    asOfDate: '2026-07-05', answeredAt: '2026-07-05T00:00:00.000Z',
    ...overrides,
  }
}

function convMessage(overrides: Partial<AdvisoryConversationMessage>): AdvisoryConversationMessage {
  return { messageId: 'm', role: 'USER', content: 'x', timestamp: '2026-07-05T00:00:00.000Z', tokenCount: 10, ...overrides }
}

describe('buildAIContext', () => {
  it('maps ReasoningResult fields onto AIContext', () => {
    const context = buildAIContext({ reasoningResult: reasoningResult(), conversationHistory: [] })
    expect(context.decision).toBe('Tạm ứng tối đa 20%.')
    expect(context.confidence).toBe(0.72)
    expect(context.humanReviewRequired).toBe(true)
    expect(context.question).toBe('Mức tạm ứng tối đa là bao nhiêu?')
  })

  it('maps outputFormat from explainability.format (EXPLANATION -> LEGAL_ADVISORY)', () => {
    const context = buildAIContext({ reasoningResult: reasoningResult(), conversationHistory: [] })
    expect(context.systemInstructions.outputFormat).toBe('LEGAL_ADVISORY')
  })

  it('sorts warnings by severity (CRITICAL first)', () => {
    const context = buildAIContext({ reasoningResult: reasoningResult(), conversationHistory: [] })
    expect(context.warnings[0]!.severity).toBe('CRITICAL')
    expect(context.warnings[1]!.severity).toBe('LOW')
  })

  it('summarizes reasoningTrace to at most 10 steps, keeping the most recent', () => {
    const context = buildAIContext({ reasoningResult: reasoningResult(), conversationHistory: [] })
    expect(context.reasoningTrace).toHaveLength(10)
    expect(context.reasoningTrace[9]!.description).toBe('step 14')
  })

  it('derives CONSULT_LEGAL, CORRECT_VIOLATION, and AWAIT_DECISION actions', () => {
    const context = buildAIContext({ reasoningResult: reasoningResult(), conversationHistory: [] })
    const types = context.recommendedActions.map(a => a.actionType)
    expect(types).toContain('CONSULT_LEGAL')
    expect(types).toContain('CORRECT_VIOLATION')
    expect(types).toContain('AWAIT_DECISION')
  })

  it('maps legalBasis from PRIMARY_BASIS/SUPPORTING_BASIS applied articles only', () => {
    const rr = reasoningResult({
      appliedArticles: [
        { itemId: 'a', documentSymbol: 'X', documentType: 'LAW', extractedText: 'x', role: 'PRIMARY_BASIS',
          applicabilityScore: 0.9, exceptions: [], crossReferences: [] },
        { itemId: 'b', documentSymbol: 'Y', documentType: 'LAW', extractedText: 'y', role: 'CONFLICT_SOURCE',
          applicabilityScore: 0.9, exceptions: [], crossReferences: [] },
      ],
    })
    const context = buildAIContext({ reasoningResult: rr, conversationHistory: [] })
    expect(context.legalBasis).toHaveLength(1)
    expect(context.legalBasis[0]!.itemId).toBe('a')
  })

  it('prunes conversation history to the token budget, keeping SYSTEM and dropping oldest first', () => {
    const messages: AdvisoryConversationMessage[] = [
      convMessage({ messageId: 'sys', role: 'SYSTEM', content: 'system prompt', timestamp: '2026-07-05T00:00:00.000Z', tokenCount: 50 }),
      convMessage({ messageId: 'u1', content: 'old question', timestamp: '2026-07-05T00:01:00.000Z', tokenCount: 40 }),
      convMessage({ messageId: 'u2', content: 'new question', timestamp: '2026-07-05T00:02:00.000Z', tokenCount: 40 }),
    ]
    const context = buildAIContext({
      reasoningResult: reasoningResult(), conversationHistory: messages, maxConversationTokens: 90,
    })
    const contents = context.conversationHistory.map(m => m.content)
    expect(contents).toContain('system prompt')
    expect(contents).toContain('new question')
    expect(contents).not.toContain('old question')
  })

  it('is deep-frozen: reassigning a top-level field throws', () => {
    const context = buildAIContext({ reasoningResult: reasoningResult(), conversationHistory: [] })
    expect(() => {
      // @ts-expect-error deliberate mutation attempt for the immutability test
      context.decision = 'mutated'
    }).toThrow()
  })

  it('is deep-frozen: pushing to a nested array throws', () => {
    const context = buildAIContext({ reasoningResult: reasoningResult(), conversationHistory: [] })
    expect(() => {
      // @ts-expect-error deliberate mutation attempt for the immutability test
      context.citations.push({ citationId: 'x' })
    }).toThrow()
  })

  it('is deep-frozen: mutating a nested object field throws', () => {
    const context = buildAIContext({ reasoningResult: reasoningResult(), conversationHistory: [] })
    expect(() => {
      // @ts-expect-error deliberate mutation attempt for the immutability test
      context.systemInstructions.tone = 'ACCESSIBLE'
    }).toThrow()
  })
})
