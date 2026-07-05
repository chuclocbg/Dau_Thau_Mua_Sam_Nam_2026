import type { AIContext } from '../domain/aiTypes.ts'
import { validateCitations } from './citationValidator.ts'
import { validateConfidence } from './confidenceValidator.ts'
import { validateLegalConsistency } from './legalConsistencyValidator.ts'
import type { AIValidationResult, LLMOutput, ValidationIssue } from './validationTypes.ts'

// ── OutputValidator — orchestrator + structural checks ──────────────────────────
// Per app/knowledge/ai-advisory/validation.md: "Every LLMOutput passes through
// DefaultOutputValidator before it is returned... No raw LLM output ever reaches
// the end user without passing validation." Owns the structural/format checks
// directly (responsibilities 1, 2, 8, plus validation.md Checks 4-6: language
// compliance, response completeness, forbidden-pattern), and delegates the
// content-grounding checks to CitationValidator, ConfidenceValidator, and
// LegalConsistencyValidator. Depends only on AIContext + the provider-agnostic
// LLMOutput/ValidationIssue shapes — never Knowledge Platform, Reasoning,
// Conversation, or a provider implementation.

const REPLACEMENT_CHARACTER = '�'
const VIETNAMESE_DIACRITICS = /[ăâđêôơưàằầèềìòồờùừỳáắấéếíóốớúứýạặậẹệịọộợụựỵãẵẫẽễĩõỗỡũữỹ]/gi
const LEGAL_MEMO_SECTIONS = ['Căn cứ', 'Phân tích', 'Kết luận']
const RAW_MARKDOWN_PATTERN = /```|(?:\|.+\|.+\|)/
const NO_REGULATION_CLAIM = /không có quy định/i
const LEGAL_COUNSEL_NAME_PATTERN = /(?:luật sư|ông|bà)\s+[A-ZĐ][a-zà-ỹ]+(?:\s+[A-ZĐ][a-zà-ỹ]+)*/gu

function checkMalformedOutput(output: LLMOutput): ValidationIssue[] {
  if (output.content.trim().length === 0) {
    return [{
      issueId: 'malformed-empty', issueType: 'MALFORMED_OUTPUT', severity: 'CRITICAL',
      description: 'Phản hồi rỗng hoặc chỉ chứa khoảng trắng', autoFixed: false,
    }]
  }
  if (output.content.includes(REPLACEMENT_CHARACTER)) {
    return [{
      issueId: 'malformed-encoding', issueType: 'MALFORMED_OUTPUT', severity: 'HIGH',
      description: 'Phản hồi chứa ký tự thay thế cho thấy lỗi mã hóa', autoFixed: false,
    }]
  }
  return []
}

function checkMissingRequiredSections(output: LLMOutput, context: AIContext): ValidationIssue[] {
  if (context.systemInstructions.outputFormat !== 'LEGAL_MEMO') return []
  const missing = LEGAL_MEMO_SECTIONS.filter(section => !output.content.includes(section))
  if (missing.length === 0) return []
  return [{
    issueId: 'missing-required-section', issueType: 'MISSING_REQUIRED_SECTION', severity: 'MEDIUM',
    description: `Định dạng LEGAL_MEMO thiếu mục bắt buộc: ${missing.join(', ')}`, autoFixed: false,
  }]
}

function checkFormattingViolations(output: LLMOutput, context: AIContext): ValidationIssue[] {
  if (context.systemInstructions.outputFormat !== 'CONVERSATIONAL') return []
  if (!RAW_MARKDOWN_PATTERN.test(output.content)) return []
  return [{
    issueId: 'formatting-violation', issueType: 'FORMATTING_VIOLATION', severity: 'LOW',
    description: 'Phản hồi chứa bảng/khối mã Markdown thô trong khi định dạng yêu cầu là hội thoại', autoFixed: false,
  }]
}

function checkLanguageCompliance(output: LLMOutput, context: AIContext): ValidationIssue[] {
  if (context.systemInstructions.outputLanguage !== 'vi') return []
  const diacriticCount = (output.content.match(VIETNAMESE_DIACRITICS) ?? []).length
  const ratio = output.content.length > 0 ? diacriticCount / output.content.length : 1
  if (ratio < 0.02 && output.content.length > 60) {
    return [{
      issueId: 'language-mismatch', issueType: 'LANGUAGE_MISMATCH', severity: 'MEDIUM',
      description: 'Phản hồi có vẻ không phải tiếng Việt trong khi ngôn ngữ yêu cầu là tiếng Việt', autoFixed: false,
    }]
  }
  return []
}

const SENTENCE_END_PATTERN = /[.!?"»]$/

function checkResponseCompleteness(output: LLMOutput): { issues: ValidationIssue[]; appended?: string } {
  if (output.finishReason !== 'MAX_TOKENS') return { issues: [] }
  if (SENTENCE_END_PATTERN.test(output.content.trim())) return { issues: [] }

  const appended = '\n[Câu trả lời bị cắt ngắn do giới hạn độ dài. Vui lòng chia nhỏ câu hỏi.]'
  return {
    issues: [{
      issueId: 'truncated-response', issueType: 'TRUNCATED_RESPONSE', severity: 'HIGH',
      description: 'Phản hồi bị cắt ngắn giữa chừng do đạt giới hạn token', correction: appended, autoFixed: true,
    }],
    appended,
  }
}

function checkForbiddenPatterns(output: LLMOutput, context: AIContext): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  if (NO_REGULATION_CLAIM.test(output.content) && context.legalBasis.length > 0) {
    issues.push({
      issueId: 'forbidden-no-regulation-claim', issueType: 'FORBIDDEN_PATTERN', severity: 'HIGH',
      description: 'Phản hồi khẳng định "không có quy định" trong khi AIContext có căn cứ pháp lý', autoFixed: false,
    })
  }

  const nameMatches = [...output.content.matchAll(LEGAL_COUNSEL_NAME_PATTERN)]
  if (nameMatches.length > 0) {
    issues.push({
      issueId: 'forbidden-named-counsel', issueType: 'FORBIDDEN_PATTERN', severity: 'LOW',
      description: 'Phản hồi đề cập tên cụ thể của luật sư/cá nhân — nên thay bằng "bộ phận pháp lý"',
      evidence: nameMatches[0]![0], correction: 'bộ phận pháp lý', autoFixed: false,
    })
  }
  return issues
}

function computeValidationConfidence(content: string, hasDecisionContradictionCheck: boolean): number {
  let confidence = 1.0
  confidence -= 0.10 // numeric check is heuristic (substring match), not NLP
  confidence -= 0.05 // language detection is heuristic only
  if (hasDecisionContradictionCheck) confidence -= 0.15 // decision contradiction check is keyword-only
  const wordCount = content.split(/\s+/).filter(Boolean).length
  if (wordCount > 2000) confidence -= 0.10
  return Math.max(0, confidence)
}

export class OutputValidator {
  validate(output: LLMOutput, context: AIContext): AIValidationResult {
    const completeness = checkResponseCompleteness(output)

    const issues: ValidationIssue[] = [
      ...checkMalformedOutput(output),
      ...checkMissingRequiredSections(output, context),
      ...checkFormattingViolations(output, context),
      ...checkLanguageCompliance(output, context),
      ...completeness.issues,
      ...checkForbiddenPatterns(output, context),
      ...validateCitations(output, context).issues,
      ...validateConfidence(output, context),
      ...validateLegalConsistency(output, context),
    ]

    const citationOutcome = validateCitations(output, context)
    let redactedContent = citationOutcome.redactedContent
    if (completeness.appended) {
      redactedContent = (redactedContent ?? output.content) + completeness.appended
    }

    const validationConfidence = computeValidationConfidence(
      output.content, issues.some(i => i.issueType === 'DECISION_CONTRADICTION'),
    )
    if (validationConfidence < 0.70) {
      issues.push({
        issueId: 'low-validation-confidence', issueType: 'UNSUPPORTED_CLAIM', severity: 'LOW',
        description: 'Xác minh tự động có độ tin cậy thấp do độ phức tạp của phản hồi. Khuyến nghị xem xét thủ công.',
        autoFixed: false,
      })
    }

    const hasCritical = issues.some(i => i.severity === 'CRITICAL')
    const wasRedacted = redactedContent !== undefined

    return {
      passed: !hasCritical,
      issues,
      redactedContent,
      wasRedacted,
      validationConfidence,
      validatedAt: new Date().toISOString(),
    }
  }
}

export function buildOutputValidator(): OutputValidator {
  return new OutputValidator()
}
