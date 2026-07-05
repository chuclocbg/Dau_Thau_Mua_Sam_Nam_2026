import { describe, it, expect } from 'vitest'
import type {
  ReasoningQuestion, ReasoningContext, ReasoningIntent, KnowledgeItemRef,
  ResolvedKnowledge, LegalReasoningStep, DetectedConflict, LegalRuleResult, LegalThresholdResult,
  ReasoningResult,
} from '../reasoning/domain/reasoningTypes.ts'

describe('Reasoning domain types', () => {
  it('constructs a valid ReasoningQuestion', () => {
    const question: ReasoningQuestion = { question: 'Mức tạm ứng tối đa là bao nhiêu?' }
    expect(question.question).toBeTruthy()
  })

  it('constructs a valid ReasoningContext', () => {
    const context: ReasoningContext = {
      asOfDate: '2026-07-05', packageType: 'GOODS', estimatedValue: 3_000_000_000n,
    }
    expect(context.estimatedValue).toBe(3_000_000_000n)
  })

  it('constructs a valid ReasoningIntent', () => {
    const intent: ReasoningIntent = {
      intentType: 'ADVANCE_PAYMENT_RULE', question: 'q', normalizedQuestion: 'q',
      detectedEntities: [], context: { asOfDate: '2026-07-05' }, confidence: 0.8, ambiguous: false,
    }
    expect(intent.intentType).toBe('ADVANCE_PAYMENT_RULE')
  })

  it('constructs a valid KnowledgeItemRef and ResolvedKnowledge', () => {
    const item: KnowledgeItemRef = {
      itemId: 'item-1', domain: 'legal', type: 'LAW', title: 'Luật 22/2023/QH15',
      summary: 'text', confidence: 0.9, layer: 1, legalBasis: [], metadata: {},
      effectiveFrom: '2024-01-01',
    }
    const resolved: ResolvedKnowledge = {
      legalItems: [item], procurementItems: [], thresholdItems: [], ruleItems: [],
      schoolPolicyItems: [], asOfDate: '2026-07-05', resolvedAt: '2026-07-05T00:00:00.000Z',
      platformCallCount: 0, warnings: [],
    }
    expect(resolved.legalItems).toHaveLength(1)
  })

  it('constructs a valid LegalReasoningStep (renamed to avoid collision with src/reasoning/decisionModel.ts)', () => {
    const step: LegalReasoningStep = {
      stepId: 'step-1', stage: 'INTENT_DETECTION', action: 'DETECT_INTENT',
      description: 'x', itemIdsConsumed: [], confidence: 1, flagged: false, humanReviewTriggered: false,
    }
    expect(step.stage).toBe('INTENT_DETECTION')
  })

  it('constructs a valid DetectedConflict', () => {
    const conflict: DetectedConflict = {
      conflictId: 'c-1', description: 'x',
      conflictingItems: [
        { itemId: 'a', documentSymbol: 'A', provision: 'p', authorityLevel: 8, effectiveFrom: '2025-01-01', layer: 1 },
        { itemId: 'b', documentSymbol: 'B', provision: 'p', authorityLevel: 14, effectiveFrom: '2025-01-01', layer: 3 },
      ],
      resolution: 'RESOLVED_BY_MORE_RESTRICTIVE', isResolved: true, appliedItem: 'b',
    }
    expect(conflict.conflictingItems).toHaveLength(2)
  })

  it('constructs a valid LegalRuleResult and LegalThresholdResult (renamed to avoid collisions)', () => {
    const rule: LegalRuleResult = {
      ruleItemId: 'r-1', ruleCode: 'RULE-A01', status: 'PASS', evidence: [], legalBasis: [],
      explanation: 'x', missingFields: [],
    }
    const threshold: LegalThresholdResult = {
      thresholdItemId: 't-1', thresholdCode: 'OPEN_TENDER_GOODS_MIN', thresholdValue: 2_000_000_000n,
      contextValue: 3_000_000_000n, operator: 'GT', passed: true, legalBasis: [],
    }
    expect(rule.status).toBe('PASS')
    expect(threshold.passed).toBe(true)
  })

  it('ReasoningResult composes all stage outputs into one frozen-shaped record', () => {
    const result: ReasoningResult = {
      decision: null, confidence: 0, confidenceLabel: 'VERY_LOW', appliedDocuments: [],
      appliedArticles: [], reasoningTrace: [], citations: [], missingEvidence: [],
      evidenceSufficiency: 'INSUFFICIENT', warnings: [], humanReviewRequired: true,
      intent: {
        intentType: 'GENERAL', question: 'q', normalizedQuestion: 'q', detectedEntities: [],
        context: { asOfDate: '2026-07-05' }, confidence: 0.3, ambiguous: false,
      },
      explainability: { format: 'DECISION', summary: 's', decisionRationale: 'r', keyProvisions: [] },
      resolvedKnowledge: {
        legalItems: [], procurementItems: [], thresholdItems: [], ruleItems: [],
        schoolPolicyItems: [], asOfDate: '2026-07-05', resolvedAt: '2026-07-05T00:00:00.000Z',
        platformCallCount: 0, warnings: [],
      },
      conflicts: [], thresholdResults: [], ruleResults: [], asOfDate: '2026-07-05',
      answeredAt: '2026-07-05T00:00:00.000Z',
    }
    expect(result.humanReviewRequired).toBe(true)
  })
})
