import type { AIContext } from '../domain/aiTypes.ts'
import type { LLMOutput, ValidationIssue } from './validationTypes.ts'

// ── LegalConsistencyValidator — validation.md Checks 2 (Numeric Consistency) and
// 3 (Decision Contradiction) ────────────────────────────────────────────────────
// Depends only on AIContext. Both checks are heuristic (keyword/substring
// matching, not full semantic comparison) — the same tradeoff validation.md's
// own design accepts, documented there as a validation-confidence deduction.

const NUMBER_PATTERN = /\d+(?:[.,]\d+)?\s*(?:tỷ|triệu|nghìn|đồng|VNĐ|%)/gi
const LIMIT_MARKERS = ['tối đa', 'tối thiểu', 'không quá', 'ít nhất', 'phải có']
const CONCLUSION_MARKERS = ['kết luận', 'vì vậy', 'do đó', 'tóm lại', 'như vậy']
const SURROUNDING_WINDOW = 40

function checkNumericConsistency(content: string, context: AIContext): ValidationIssue[] {
  const groundingText = [
    ...context.legalBasis.map(b => b.provisionText),
    ...context.evidence.map(e => e.summary),
    ...context.reasoningTrace.map(t => t.description),
  ].join(' ')

  const issues: ValidationIssue[] = []
  for (const match of content.matchAll(NUMBER_PATTERN)) {
    const index = match.index ?? 0
    const before = content.slice(Math.max(0, index - SURROUNDING_WINDOW), index).toLowerCase()
    const isLegalLimit = LIMIT_MARKERS.some(marker => before.includes(marker))
    if (!isLegalLimit) continue

    if (!groundingText.includes(match[0])) {
      issues.push({
        issueId: `numeric-inconsistency-${index}`, issueType: 'NUMERIC_INCONSISTENCY', severity: 'HIGH',
        description: `Giá trị "${match[0]}" được nêu như một quy tắc/ngưỡng pháp lý nhưng không xuất hiện trong AIContext`,
        evidence: match[0], autoFixed: false,
      })
    }
  }
  return issues
}

function extractConclusionSentences(content: string): string[] {
  const sentences = content.split(/(?<=[.!?])\s+/)
  return sentences.filter(s => CONCLUSION_MARKERS.some(marker => s.toLowerCase().includes(marker)))
}

function checkDecisionContradiction(content: string, context: AIContext): ValidationIssue[] {
  if (context.decision === null) return []
  if (context.confidenceLabel === 'LOW' || context.confidenceLabel === 'VERY_LOW') return []

  const conclusions = extractConclusionSentences(content)
  if (conclusions.length === 0) return []

  const decisionLower = context.decision.toLowerCase()
  const issues: ValidationIssue[] = []

  for (const sentence of conclusions) {
    const sentenceLower = sentence.toLowerCase()

    const decisionAffirms = decisionLower.includes('bắt buộc') && !decisionLower.includes('không bắt buộc')
    const sentenceDenies = sentenceLower.includes('không bắt buộc')
    const decisionDenies = decisionLower.includes('không bắt buộc')
    const sentenceAffirms = sentenceLower.includes('bắt buộc') && !sentenceLower.includes('không bắt buộc')

    const negationMismatch = (decisionAffirms && sentenceDenies) || (decisionDenies && sentenceAffirms)

    const decisionNumbers = [...decisionLower.matchAll(NUMBER_PATTERN)].map(m => m[0])
    const sentenceNumbers = [...sentenceLower.matchAll(NUMBER_PATTERN)].map(m => m[0])
    const numberMismatch = decisionNumbers.length > 0 && sentenceNumbers.length > 0
      && !sentenceNumbers.some(n => decisionNumbers.includes(n))

    if (negationMismatch || numberMismatch) {
      issues.push({
        issueId: `decision-contradiction-${issues.length + 1}`, issueType: 'DECISION_CONTRADICTION',
        severity: 'CRITICAL',
        description: 'Kết luận của phản hồi mâu thuẫn với AIContext.decision đã được tính toán trước',
        evidence: sentence.trim(), correction: context.decision, autoFixed: false,
      })
    }
  }
  return issues
}

export function validateLegalConsistency(output: LLMOutput, context: AIContext): readonly ValidationIssue[] {
  return [
    ...checkNumericConsistency(output.content, context),
    ...checkDecisionContradiction(output.content, context),
  ]
}
