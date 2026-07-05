import type {
  AppliedArticle, AppliedDocument, ConfidenceComponents, ConfidenceDeduction, ConfidenceLabel,
  DetectedConflict, ExplainedProvision, FormattedCitation, LegalRuleResult, MissingEvidence,
  ReasoningExplanation, ReasoningIntent, ReasoningOutputFormat,
} from '../domain/reasoningTypes.ts'

// ── Stage 7 — Answer Composer ───────────────────────────────────────────────────
// Per app/knowledge/reasoning/pipeline.md Stage 7, Responsibilities 12-15.

const IMPROVES_RESOLUTION_FIELDS = ['packageType', 'fundSource', 'procurementMethod'] as const

export function computeConfidence(input: {
  readonly intent: ReasoningIntent
  readonly conflicts: readonly DetectedConflict[]
  readonly appliedDocuments: readonly AppliedDocument[]
  readonly missingEvidence: readonly MissingEvidence[]
  readonly unresolvedCrossReferenceCount: number
  readonly unresolvedExceptionCount: number
  readonly primaryItemConfidences: readonly number[]
}): ConfidenceComponents {
  const deductions: ConfidenceDeduction[] = []

  if (input.unresolvedCrossReferenceCount > 0) {
    const amount = Math.min(0.20, input.unresolvedCrossReferenceCount * 0.10)
    deductions.push({ reason: 'UNRESOLVED_NORMATIVE_CITATION', amount, description: `${input.unresolvedCrossReferenceCount} trích dẫn chưa được giải quyết` })
  }

  const resolvedConflicts = input.conflicts.filter(c => c.isResolved)
  if (resolvedConflicts.length > 0) {
    deductions.push({ reason: 'RESOLVED_CONFLICT', amount: Math.min(0.24, resolvedConflicts.length * 0.08), description: `${resolvedConflicts.length} xung đột đã được giải quyết` })
  }

  const unresolvedConflicts = input.conflicts.filter(c => !c.isResolved)
  for (const conflict of unresolvedConflicts) {
    deductions.push({ reason: 'UNRESOLVED_CONFLICT', amount: 0.20, description: conflict.description })
  }

  const superseded = input.appliedDocuments.filter(d => d.wasSuperseded)
  if (superseded.length > 0) {
    deductions.push({ reason: 'SUPERSEDED_DOCUMENT_USED', amount: Math.min(0.30, superseded.length * 0.15), description: `${superseded.length} văn bản đã bị thay thế được sử dụng` })
  }

  const criticalMissing = input.missingEvidence.filter(m => m.isCritical)
  for (const missing of criticalMissing) {
    deductions.push({ reason: 'MISSING_CRITICAL_EVIDENCE', amount: 0.20, itemId: missing.evidenceId, description: missing.description })
  }

  const nonCriticalMissing = input.missingEvidence.filter(m => !m.isCritical)
  if (nonCriticalMissing.length > 0) {
    deductions.push({ reason: 'MISSING_NON_CRITICAL_EVIDENCE', amount: Math.min(0.15, nonCriticalMissing.length * 0.05), description: `${nonCriticalMissing.length} chứng cứ không trọng yếu còn thiếu` })
  }

  for (const confidence of input.primaryItemConfidences) {
    if (confidence < 0.70) {
      deductions.push({ reason: 'LOW_QUALITY_KNOWLEDGE_ITEM', amount: 0.70 - confidence, description: `Mục kiến thức chất lượng thấp (${confidence.toFixed(2)}) dùng làm căn cứ chính` })
    }
  }

  if (input.unresolvedExceptionCount > 0) {
    deductions.push({ reason: 'UNRESOLVED_EXCEPTION', amount: Math.min(0.20, input.unresolvedExceptionCount * 0.10), description: `${input.unresolvedExceptionCount} ngoại lệ chưa xác nhận được` })
  }

  if (input.intent.ambiguous) {
    deductions.push({ reason: 'AMBIGUOUS_INTENT', amount: 0.10, description: 'Phát hiện ý định câu hỏi không rõ ràng' })
  }

  const missingContextFields = IMPROVES_RESOLUTION_FIELDS.filter(field => input.intent.context[field] === undefined)
  if (missingContextFields.length > 0) {
    deductions.push({ reason: 'PARTIAL_CONTEXT', amount: Math.min(0.15, missingContextFields.length * 0.05), description: `Thiếu ngữ cảnh: ${missingContextFields.join(', ')}` })
  }

  const finalScore = Math.max(0, 1 - deductions.reduce((sum, d) => sum + d.amount, 0))
  const label: ConfidenceLabel =
    finalScore >= 0.85 ? 'HIGH' : finalScore >= 0.70 ? 'MEDIUM' : finalScore >= 0.50 ? 'LOW' : 'VERY_LOW'

  return { baseScore: 1, deductions, finalScore, label }
}

export function determineHumanReview(input: {
  readonly confidence: number
  readonly conflicts: readonly DetectedConflict[]
  readonly missingEvidence: readonly MissingEvidence[]
  readonly unresolvedExceptionCount: number
  readonly primaryItemConfidences: readonly number[]
  readonly externallyFlagged: boolean
}): { required: boolean; reason?: string } {
  const reasons: string[] = []
  if (input.confidence < 0.50) reasons.push('Độ tin cậy dưới 50%')
  const unresolved = input.conflicts.filter(c => !c.isResolved)
  if (unresolved.length > 0) reasons.push(`${unresolved.length} xung đột pháp lý chưa giải quyết`)
  if (input.missingEvidence.some(m => m.isCritical)) reasons.push('Thiếu chứng cứ trọng yếu')
  if (input.unresolvedExceptionCount > 3) reasons.push('Quá nhiều ngoại lệ chưa xác nhận')
  if (input.primaryItemConfidences.some(c => c < 0.50)) reasons.push('Căn cứ pháp lý chính có chất lượng thấp')
  if (input.externallyFlagged) reasons.push('Một giai đoạn xử lý trước đó yêu cầu rà soát thủ công')

  return reasons.length > 0
    ? { required: true, reason: reasons.join('; ') }
    : { required: false }
}

export function composeDecision(
  citations: readonly FormattedCitation[], ruleResults: readonly LegalRuleResult[], confidence: number,
): string | null {
  if (confidence < 0.50) return null
  const primary = citations.find(c => c.isPrimary)
  const passages = ruleResults.filter(r => r.status === 'PASS' || r.status === 'EXCEPTION').map(r => r.explanation)
  if (passages.length === 0) return null
  const basis = primary ? `Theo ${primary.full}: ` : ''
  return `${basis}${passages.join(' ')}`
}

export function buildExplanation(input: {
  readonly format: ReasoningOutputFormat
  readonly decision: string | null
  readonly appliedArticles: readonly AppliedArticle[]
  readonly conflicts: readonly DetectedConflict[]
  readonly missingEvidence: readonly MissingEvidence[]
  readonly confidence: ConfidenceComponents
  readonly citations: readonly FormattedCitation[]
}): ReasoningExplanation {
  const keyProvisions: ExplainedProvision[] = input.citations
    .filter(c => c.role === 'PRIMARY_BASIS' || c.role === 'SUPPORTING_BASIS')
    .slice(0, 3)
    .map(citation => ({
      citation,
      relevance: citation.isPrimary ? 'Căn cứ pháp lý chính cho quyết định' : 'Căn cứ hỗ trợ',
      requirement: citation.full,
      isBinding: citation.isNormative,
    }))

  const summary = input.decision
    ?? `Không thể đưa ra kết luận tự động (độ tin cậy: ${(input.confidence.finalScore * 100).toFixed(0)}%) — cần rà soát thủ công.`

  const explanation: ReasoningExplanation = {
    format: input.format,
    summary,
    decisionRationale: input.decision
      ? `Kết luận dựa trên ${keyProvisions.length} căn cứ pháp lý áp dụng, độ tin cậy ${input.confidence.label}.`
      : 'Không đủ căn cứ hoặc độ tin cậy quá thấp để tự động kết luận.',
    keyProvisions,
  }

  if (input.format === 'DECISION') return explanation

  const resolvedConflicts = input.conflicts.filter(c => c.isResolved)
  return {
    ...explanation,
    conflictSummary: resolvedConflicts.length > 0
      ? `${resolvedConflicts.length} xung đột pháp lý đã được giải quyết theo nguyên tắc phân cấp/hiệu lực.`
      : undefined,
    whatIsMissing: input.missingEvidence.length > 0
      ? input.missingEvidence.map(m => m.description).join('; ')
      : undefined,
    nextSteps: input.missingEvidence.filter(m => m.isCritical).length > 0
      ? ['Bổ sung thông tin/chứng cứ còn thiếu', 'Chuyển hồ sơ để rà soát thủ công']
      : undefined,
  }
}
