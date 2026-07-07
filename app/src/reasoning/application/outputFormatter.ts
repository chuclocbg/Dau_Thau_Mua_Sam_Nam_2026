import { buildExplanation, determineHumanReview } from './answerComposer.ts'
import type { ConversationResponse, FormattingOptions, ResponseLanguage, ResponseSection } from '../domain/conversationResponseTypes.ts'
import type { ReasoningAnswerResult } from '../domain/reasoningAnswerTypes.ts'
import type { FormattedCitation } from '../domain/reasoningTypes.ts'

// ── Output Formatter — Phase X.5 (Output Formatting) ───────────────────────────
// Consumes X.4.7's ReasoningAnswerResult and produces only a ConversationResponse. No
// reasoning, no retrieval, no ranking, no conflict resolution, no confidence computation, no
// citation generation, no MCP/Tool Calling/Multi-Agent access. Pure presentation layer:
// ReasoningAnswerResult -> OutputFormatter -> ConversationResponse, nothing else.
//
// TRANSPARENCY NOTE on "the existing Output Formatter" (per this milestone's instruction to
// inspect it before writing code): src/ai/validation/responseFormatter.ts's formatFinalAnswer()
// is NOT reusable here — it operates on LLMOutput + AIValidationResult + AIContext (the OLD,
// LLM-generated-text validation path: Conversation -> Reasoning -> AIContext -> PromptBuilder ->
// PromptRenderer -> LLMAdapter -> [OutputValidator -> ResponseFormatter]), redacting/banner-
// wrapping raw LLM text based on citation/numeric/contradiction validation issues. This
// milestone's input (ReasoningAnswerResult) is a structured, non-LLM-generated object from the
// native reasoning pipeline (X.3.7 + X.4.1-X.4.7) — a completely different shape with no
// overlapping fields. There is nothing to literally reuse from responseFormatter.ts itself;
// confirmed by direct inspection, not assumed from documentation. src/ai/validation/ (frozen,
// X.4 Output Validation) is not imported anywhere in this file.
//
// What IS genuinely reused, per "reuse existing code whenever possible, never duplicate
// algorithms": answerComposer.ts's buildExplanation() and determineHumanReview() (Batch A,
// frozen, already exported) — both public functions the native pipeline (X.4.1-X.4.7) never
// called. buildExplanation()'s appliedArticles/missingEvidence parameters are honestly passed
// as [] (ReasoningAnswerResult carries neither — the same documented-gap pattern established in
// X.4.5/X.4.6/X.4.7), which is safe because buildExplanation()'s own body never actually reads
// appliedArticles at all (verified by direct inspection) and only uses missingEvidence for the
// optional whatIsMissing/nextSteps fields (correctly empty/absent when genuinely empty).
// determineHumanReview() is called the same honest way; confidence and conflicts — the two
// signals this milestone actually has — still correctly drive its `required`/`reason` output.
// "Warning display" is therefore reused output (split for one-bullet-per-reason display), never
// a re-derived threshold rule of this file's own.
//
// NUMBERING NOTE: PHASE_X_EXECUTION_PLAN.md already assigns "X.5" to Tool Calling — the same
// kind of collision already reconciled once for X.4. See conversationResponseTypes.ts's own
// header note.

const HEADINGS: Readonly<Record<ResponseLanguage, Readonly<Record<string, string>>>> = Object.freeze({
  vi: Object.freeze({
    decision: 'Kết luận', primary: 'Căn cứ pháp lý chính', supporting: 'Căn cứ hỗ trợ',
    disputed: 'Nội dung còn tranh chấp', confidence: 'Độ tin cậy',
  }),
  en: Object.freeze({
    decision: 'Conclusion', primary: 'Primary Legal Basis', supporting: 'Supporting Basis',
    disputed: 'Disputed Provisions', confidence: 'Confidence',
  }),
})

function citationList(citations: readonly FormattedCitation[], max?: number): string {
  const shown = max !== undefined ? citations.slice(0, max) : citations
  return shown.map(citation => `- ${citation.full}`).join('\n')
}

function buildSections(
  answer: ReasoningAnswerResult, decisionText: string, language: ResponseLanguage,
  maxPerSection: number | undefined, includeDisputed: boolean,
): readonly ResponseSection[] {
  const labels = HEADINGS[language]
  const sections: ResponseSection[] = [{ heading: labels['decision']!, body: decisionText }]

  if (answer.primaryCitations.length > 0) {
    sections.push({ heading: labels['primary']!, body: citationList(answer.primaryCitations, maxPerSection) })
  }
  if (answer.supportingCitations.length > 0) {
    sections.push({ heading: labels['supporting']!, body: citationList(answer.supportingCitations, maxPerSection) })
  }
  if (includeDisputed && answer.disputedCitations.length > 0) {
    sections.push({ heading: labels['disputed']!, body: citationList(answer.disputedCitations, maxPerSection) })
  }

  const confidencePercent = (answer.confidenceSummary.finalScore * 100).toFixed(0)
  sections.push({ heading: labels['confidence']!, body: `**${answer.confidenceSummary.label}** (${confidencePercent}%)` })

  return sections
}

function buildWarnings(humanReview: { readonly required: boolean; readonly reason?: string }): readonly string[] {
  if (!humanReview.required || humanReview.reason === undefined) return []
  return humanReview.reason.split('; ')
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const key of Object.getOwnPropertyNames(value)) {
      deepFreeze((value as Record<string, unknown>)[key])
    }
    Object.freeze(value)
  }
  return value
}

export function formatConversationResponse(
  answer: ReasoningAnswerResult, options: FormattingOptions = {},
): ConversationResponse {
  const language: ResponseLanguage = options.language ?? 'vi'
  const includeDisputed = options.includeDisputedCitations ?? true
  const allCitations = [...answer.primaryCitations, ...answer.supportingCitations, ...answer.disputedCitations]

  const explanation = buildExplanation({
    format: 'EXPLANATION', decision: answer.decision, appliedArticles: [],
    conflicts: answer.conflicts, missingEvidence: [], confidence: answer.confidenceSummary,
    citations: allCitations,
  })

  const humanReview = determineHumanReview({
    confidence: answer.confidenceSummary.finalScore, conflicts: answer.conflicts,
    missingEvidence: [], unresolvedExceptionCount: 0, primaryItemConfidences: [],
    externallyFlagged: false,
  })

  const sections = buildSections(answer, explanation.summary, language, options.maxCitationsPerSection, includeDisputed)
  const markdown = sections.map(section => `## ${section.heading}\n\n${section.body}`).join('\n\n')

  const response: ConversationResponse = {
    markdown,
    sections,
    confidenceLabel: answer.confidenceSummary.label,
    confidenceScore: answer.confidenceSummary.finalScore,
    warnings: buildWarnings(humanReview),
    humanReviewRecommended: humanReview.required,
    humanReviewReason: humanReview.reason,
    citationCount: allCitations.length,
    language,
    formattedAt: new Date().toISOString(),
  }
  return deepFreeze(response)
}
