import type { AIContext } from '../domain/aiTypes.ts'
import type { AIValidationResult, FinalAnswer, LLMOutput } from './validationTypes.ts'

// ── ResponseFormatter — remediation and final answer assembly ─────────────────
// Per app/knowledge/ai-advisory/validation.md §3 "Validation Result Handling" and
// "On CRITICAL failure". Takes the raw LLMOutput plus the AIValidationResult
// already computed by OutputValidator and produces the text that is actually
// safe to return — applying redaction and the appropriate warning banner.
// Never re-runs any check itself; purely presentational, same "no business
// rules" discipline PromptBuilder already follows in Batch B.

const CRITICAL_WARNING_BANNER =
  '\n\n[⚠ Cảnh báo: Phản hồi của AI đã được hiệu chỉnh do phát hiện nội dung không chính xác. '
  + 'Đề nghị xem xét và xác minh trước khi sử dụng.]'

export function formatFinalAnswer(
  output: LLMOutput, validation: AIValidationResult, context: AIContext,
): FinalAnswer {
  const hasCriticalIssue = validation.issues.some(i => i.severity === 'CRITICAL')
  const hasDecisionContradiction = validation.issues.some(i => i.issueType === 'DECISION_CONTRADICTION')
  // Per validation.md's Check 2 (Numeric Consistency): a HIGH-severity issue is
  // never auto-corrected (numbers can't be reliably fixed) but must still be
  // "flagged as humanReviewRecommended" — a HIGH-severity legal-accuracy problem
  // reaching the user with no review flag at all would be a real safety gap, not
  // just a CRITICAL-only concern.
  const hasHighOrCriticalIssue = validation.issues.some(i => i.severity === 'CRITICAL' || i.severity === 'HIGH')

  const baseContent = validation.wasRedacted && validation.redactedContent !== undefined
    ? validation.redactedContent
    : output.content

  const content = hasCriticalIssue ? `${baseContent}${CRITICAL_WARNING_BANNER}` : baseContent

  const humanReviewRequired = context.humanReviewRequired || hasHighOrCriticalIssue
  const humanReviewReason = hasDecisionContradiction
    ? 'Phát hiện mâu thuẫn giữa kết luận của AI và AIContext.decision đã tính toán trước'
    : hasCriticalIssue
      ? 'Phản hồi có lỗi nghiêm trọng đã được tự động hiệu chỉnh'
      : hasHighOrCriticalIssue
        ? 'Phản hồi có vấn đề mức độ cao cần được rà soát trước khi sử dụng'
        : context.humanReviewReason

  return {
    content,
    wasModified: content !== output.content,
    humanReviewRequired,
    humanReviewReason,
  }
}
