import type { AIContext } from '../domain/aiTypes.ts'
import type { LLMOutput, ValidationIssue } from './validationTypes.ts'

// ── CitationValidator — Check 1 (Citation Integrity) + structure/legal-basis ───
// Per app/knowledge/ai-advisory/validation.md Check 1, extended with this
// milestone's responsibilities 3 (invalid citation structure), 5 (hallucination
// indicators), 7 (missing legal basis). Depends only on AIContext — never Reasoning,
// Conversation, Knowledge Platform, or provider-specific types.

const DOCUMENT_SYMBOL_PATTERN = /\d{1,3}\/\d{4}\/[A-ZĐ][A-ZĐ0-9-]*/g
const ARTICLE_TOKEN_PATTERN = /Điều\s*(\S*)/g
const NORMATIVE_CLAIM_MARKERS = ['phải', 'bắt buộc', 'không được', 'cấm', 'quy định']
const REDACTION_MARKER = '[NGUỒN KHÔNG XÁC MINH]'

function normalize(text: string): string {
  return text.toLowerCase().normalize('NFC')
}

function citationKnownToContext(symbol: string, context: AIContext): boolean {
  const target = normalize(symbol)
  const inCitations = context.citations.some(c =>
    normalize(c.full).includes(target) || normalize(c.short).includes(target) || normalize(c.inline).includes(target),
  )
  const inLegalBasis = context.legalBasis.some(b =>
    normalize(b.documentSymbol).includes(target)
    || normalize(b.citationFull).includes(target)
    || normalize(b.citationShort).includes(target),
  )
  return inCitations || inLegalBasis
}

function checkHallucinatedCitations(
  content: string, context: AIContext, redacted: { text: string },
): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const symbols = [...new Set(Array.from(content.matchAll(DOCUMENT_SYMBOL_PATTERN), m => m[0]))]

  for (const symbol of symbols) {
    if (!citationKnownToContext(symbol, context)) {
      issues.push({
        issueId: `hallucinated-${symbol}`, issueType: 'HALLUCINATED_CITATION',
        severity: 'CRITICAL', description: `Trích dẫn "${symbol}" không tìm thấy trong AIContext`,
        evidence: symbol, correction: REDACTION_MARKER, autoFixed: true,
      })
      redacted.text = redacted.text.split(symbol).join(REDACTION_MARKER)
    }
  }
  return issues
}

function checkCitationStructure(content: string): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  for (const match of content.matchAll(ARTICLE_TOKEN_PATTERN)) {
    const token = match[1] ?? ''
    if (!/^\d+/.test(token)) {
      issues.push({
        issueId: `invalid-citation-structure-${match.index}`, issueType: 'INVALID_CITATION_STRUCTURE',
        severity: 'HIGH', description: `Cấu trúc trích dẫn không hợp lệ gần "Điều ${token}"`,
        evidence: match[0], autoFixed: false,
      })
    }
  }
  return issues
}

function checkMissingLegalBasis(content: string, context: AIContext): ValidationIssue[] {
  const hasNormativeClaim = NORMATIVE_CLAIM_MARKERS.some(marker => content.includes(marker))
  if (hasNormativeClaim && context.legalBasis.length === 0) {
    return [{
      issueId: 'missing-legal-basis', issueType: 'MISSING_LEGAL_BASIS', severity: 'CRITICAL',
      description: 'Phản hồi đưa ra yêu cầu mang tính quy phạm nhưng AIContext không có căn cứ pháp lý nào',
      autoFixed: false,
    }]
  }
  return []
}

export interface CitationValidationOutcome {
  readonly issues: readonly ValidationIssue[]
  readonly redactedContent?: string
}

export function validateCitations(output: LLMOutput, context: AIContext): CitationValidationOutcome {
  const redacted = { text: output.content }
  const issues = [
    ...checkHallucinatedCitations(output.content, context, redacted),
    ...checkCitationStructure(output.content),
    ...checkMissingLegalBasis(output.content, context),
  ]
  return {
    issues,
    redactedContent: redacted.text !== output.content ? redacted.text : undefined,
  }
}
