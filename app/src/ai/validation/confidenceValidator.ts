import type { AIContext } from '../domain/aiTypes.ts'
import type { LLMOutput, ValidationIssue } from './validationTypes.ts'

// ── ConfidenceValidator — responsibilities 4 (confidence inconsistency) and
// 6 (unsupported legal claims) ─────────────────────────────────────────────────
// Depends only on AIContext. A "confidence inconsistency" is the LLM expressing
// more certainty in prose than AIContext's deterministically-computed confidence
// warrants. An "unsupported claim" is a normative assertion whose wording shares
// no grounding keyword with anything in AIContext.legalBasis/evidence — a
// heuristic (keyword overlap, not full semantic comparison), same tradeoff
// validation.md's Decision Contradiction check already accepts for this kind of
// natural-language check.

const CERTAINTY_MARKERS = ['chắc chắn', 'tuyệt đối', 'luôn luôn', 'không có ngoại lệ']
const HEDGING_MARKERS = ['có thể', 'có lẽ', 'cần xem xét', 'tùy trường hợp', 'chưa chắc', 'khuyến nghị rà soát']
const NORMATIVE_SENTENCE_MARKERS = ['phải', 'bắt buộc', 'không được', 'cấm']
const MIN_KEYWORD_LENGTH = 4

function checkConfidenceInconsistency(content: string, context: AIContext): ValidationIssue[] {
  const lowered = content.toLowerCase()
  const isUncertainContext = context.confidenceLabel === 'LOW' || context.confidenceLabel === 'VERY_LOW'
    || context.humanReviewRequired

  if (!isUncertainContext) return []

  const hasCertaintyMarker = CERTAINTY_MARKERS.some(marker => lowered.includes(marker))
  const hasHedgingMarker = HEDGING_MARKERS.some(marker => lowered.includes(marker))

  if (hasCertaintyMarker && !hasHedgingMarker) {
    return [{
      issueId: 'confidence-inconsistency', issueType: 'CONFIDENCE_INCONSISTENCY', severity: 'HIGH',
      description: `Phản hồi thể hiện sự chắc chắn tuyệt đối trong khi AIContext có độ tin cậy ${context.confidenceLabel}`
        + (context.humanReviewRequired ? ' và yêu cầu rà soát thủ công' : ''),
      autoFixed: false,
    }]
  }
  return []
}

function splitSentences(content: string): string[] {
  return content.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0)
}

// JS's default `\w`/`\W` is ASCII-only and does not recognize Vietnamese diacritic
// letters as word characters — splitting on `\W+` would shred a word like "thầu"
// apart at every accented vowel. `\p{L}`/`\p{N}` (Unicode property escapes, `u`
// flag) correctly treat the whole Vietnamese letter as a letter.
function extractKeywords(text: string): Set<string> {
  return new Set(
    text.toLowerCase().normalize('NFC').split(/[^\p{L}\p{N}]+/u).filter(word => word.length >= MIN_KEYWORD_LENGTH),
  )
}

function checkUnsupportedClaims(content: string, context: AIContext): ValidationIssue[] {
  const groundingText = [
    ...context.legalBasis.map(b => b.provisionText),
    ...context.evidence.map(e => e.summary),
  ].join(' ')
  const groundingKeywords = extractKeywords(groundingText)
  if (groundingKeywords.size === 0) return []

  const issues: ValidationIssue[] = []
  for (const sentence of splitSentences(content)) {
    const lowered = sentence.toLowerCase()
    if (!NORMATIVE_SENTENCE_MARKERS.some(marker => lowered.includes(marker))) continue

    const sentenceKeywords = extractKeywords(sentence)
    const overlap = [...sentenceKeywords].some(word => groundingKeywords.has(word))
    if (!overlap) {
      issues.push({
        issueId: `unsupported-claim-${issues.length + 1}`, issueType: 'UNSUPPORTED_CLAIM', severity: 'MEDIUM',
        description: 'Câu khẳng định mang tính quy phạm không có từ khóa trùng với bất kỳ căn cứ/chứng cứ nào trong AIContext',
        evidence: sentence.trim(), autoFixed: false,
      })
    }
  }
  return issues
}

export function validateConfidence(output: LLMOutput, context: AIContext): readonly ValidationIssue[] {
  return [
    ...checkConfidenceInconsistency(output.content, context),
    ...checkUnsupportedClaims(output.content, context),
  ]
}
