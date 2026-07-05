import type {
  AIContext, AIContextAction, AIContextCitation, AIContextEvidence, AIContextLegalBasis,
  AIContextMessage, AIContextMissingInfo, AIContextSystemInstructions, AIContextTraceStep,
  AIContextWarning, AIOutputFormat, AIOutputLanguage,
} from '../domain/aiTypes.ts'
import type { ReasoningResult } from '../../reasoning/domain/reasoningTypes.ts'
import type { AdvisoryConversationMessage } from '../../conversation/domain/conversationTypes.ts'

// ── AIContextBuilder — Batch B, Stage: Reasoning Result -> AIContext ──────────
// Per AI_CONTEXT_SCHEMA.md's field ownership registry. Consumes ReasoningResult
// (Batch A, frozen — read-only, never redesigned) and a caller-supplied conversation
// history array (Conversation Core, X.1, frozen — read-only). Per the architecture
// gate review's Finding A (C-05 compliance): this module never calls
// ISessionRepository or any repository itself — the caller fetches conversation
// history and passes it in as a plain array.

const FORBIDDEN_BEHAVIORS: readonly string[] = Object.freeze([
  'Không bịa đặt căn cứ pháp lý hoặc trích dẫn văn bản không tồn tại',
  'Không chia nhỏ gói thầu để né tránh ngưỡng',
  'Không khóa đặc tính kỹ thuật theo một thương hiệu cụ thể',
  'Không bịa đặt báo giá, bảng giá hoặc catalogue',
  'Không thay đổi kết luận hoặc độ tin cậy đã được tính toán trước',
])

const OUTPUT_FORMAT_MAP: Readonly<Record<ReasoningResult['explainability']['format'], AIOutputFormat>> = Object.freeze({
  DECISION: 'CONVERSATIONAL',
  EXPLANATION: 'LEGAL_ADVISORY',
  FULL_TRACE: 'STEP_BY_STEP',
  LEGAL_MEMO: 'LEGAL_MEMO',
})

const SEVERITY_RANK: Readonly<Record<'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW', number>> = Object.freeze({
  CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3,
})

const MAX_TRACE_STEPS = 10
const CHARS_PER_TOKEN_ESTIMATE = 4

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const key of Object.getOwnPropertyNames(value)) {
      deepFreeze((value as Record<string, unknown>)[key])
    }
    Object.freeze(value)
  }
  return value
}

function summarizeTrace(trace: ReasoningResult['reasoningTrace']): AIContextTraceStep[] {
  const recent = trace.length > MAX_TRACE_STEPS ? trace.slice(-MAX_TRACE_STEPS) : trace
  return recent.map(step => ({
    stage: step.stage, action: step.action, description: step.description, confidence: step.confidence,
  }))
}

function toLegalBasis(result: ReasoningResult): AIContextLegalBasis[] {
  const citationByItemId = new Map(result.citations.map(c => [c.itemId, c]))
  const documentByItemId = new Map(result.appliedDocuments.map(d => [d.itemId, d]))

  return result.appliedArticles
    .filter(article => article.role === 'PRIMARY_BASIS' || article.role === 'SUPPORTING_BASIS')
    .map((article): AIContextLegalBasis => {
      const citation = citationByItemId.get(article.itemId)
      const document = documentByItemId.get(article.itemId)
      return {
        itemId: article.itemId, documentSymbol: article.documentSymbol, documentType: article.documentType,
        authorityLevel: document?.authorityLevel ?? 99, article: article.article, clause: article.clause,
        point: article.point, provisionText: article.extractedText, role: article.role,
        isNormative: citation?.isNormative ?? true, isPrimary: citation?.isPrimary ?? false,
        effectiveFrom: document?.effectiveFrom ?? result.asOfDate, effectiveTo: document?.effectiveTo,
        citationFull: citation?.full ?? article.extractedText,
        citationShort: citation?.short ?? article.documentSymbol,
        citationInline: citation?.inline ?? `(${article.documentSymbol})`,
      }
    })
}

function toCitations(result: ReasoningResult): AIContextCitation[] {
  return result.citations.map((c): AIContextCitation => ({
    citationId: c.citationId, itemId: c.itemId, full: c.full, short: c.short, inline: c.inline,
    isNormative: c.isNormative, isPrimary: c.isPrimary,
  }))
}

function toEvidence(result: ReasoningResult): AIContextEvidence[] {
  return result.appliedArticles.map((article): AIContextEvidence => ({
    itemId: article.itemId, domain: 'legal', type: article.documentType,
    title: `${article.documentSymbol}${article.article ? ` ${article.article}` : ''}`,
    summary: article.extractedText, role: article.role, confidence: article.applicabilityScore,
  }))
}

function toWarnings(result: ReasoningResult): AIContextWarning[] {
  return [...result.warnings]
    .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])
    .map((w): AIContextWarning => ({ warningCode: w.warningCode, severity: w.severity, message: w.message }))
}

function toMissingInformation(result: ReasoningResult): AIContextMissingInfo[] {
  return result.missingEvidence.map((m): AIContextMissingInfo => ({
    description: m.description, isCritical: m.isCritical, impact: m.impact,
  }))
}

function deriveRecommendedActions(result: ReasoningResult): AIContextAction[] {
  const actions: AIContextAction[] = []
  let seq = 0

  for (const missing of result.missingEvidence.filter(m => m.isCritical)) {
    actions.push({
      actionId: `action-${++seq}`, description: `Bổ sung thông tin còn thiếu: ${missing.description}`,
      actionType: 'CONSULT_LEGAL', priority: 1,
    })
  }
  for (const rule of result.ruleResults.filter(r => r.status === 'FAIL')) {
    actions.push({
      actionId: `action-${++seq}`, description: rule.explanation, actionType: 'CORRECT_VIOLATION', priority: 1,
    })
  }
  if (result.humanReviewRequired) {
    actions.push({
      actionId: `action-${++seq}`,
      description: result.humanReviewReason ?? 'Cần rà soát thủ công trước khi áp dụng kết luận này',
      actionType: 'AWAIT_DECISION', priority: 0,
    })
  }
  return actions
}

function buildSystemInstructions(
  result: ReasoningResult, language: AIOutputLanguage,
): AIContextSystemInstructions {
  return {
    role: 'Trợ lý tư vấn đấu thầu và mua sắm công',
    outputLanguage: language,
    outputFormat: OUTPUT_FORMAT_MAP[result.explainability.format],
    tone: 'FORMAL_LEGAL',
    citationStyle: 'INLINE',
    forbiddenBehaviors: FORBIDDEN_BEHAVIORS,
    contextSummary: result.explainability.summary,
  }
}

function toConversationHistory(
  messages: readonly AdvisoryConversationMessage[], maxTokens: number,
): AIContextMessage[] {
  // Token-budget pruning for LLM injection: SYSTEM messages are never dropped;
  // non-SYSTEM messages are dropped oldest-first once the budget is exceeded.
  // (A separate concern from AdvisoryConversationMemory's own turn-based pruning
  // in X.1 — that manages session-memory size, this manages the final LLM payload.)
  const systemMessages = messages.filter(m => m.role === 'SYSTEM')
  const otherMessages = messages.filter(m => m.role !== 'SYSTEM')

  let totalTokens = messages.reduce((sum, m) => sum + m.tokenCount, 0)
  let dropCount = 0
  while (totalTokens > maxTokens && dropCount < otherMessages.length) {
    totalTokens -= otherMessages[dropCount]!.tokenCount
    dropCount += 1
  }
  const kept = otherMessages.slice(dropCount)

  return [...systemMessages, ...kept]
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    .map(m => ({ role: m.role, content: m.content, timestamp: m.timestamp }))
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN_ESTIMATE)
}

export interface BuildAIContextInput {
  readonly reasoningResult: ReasoningResult
  readonly conversationHistory: readonly AdvisoryConversationMessage[]
  readonly language?: AIOutputLanguage
  readonly attachmentRefs?: readonly string[]
  readonly maxConversationTokens?: number
}

export function buildAIContext(input: BuildAIContextInput): AIContext {
  const language = input.language ?? 'vi'
  const conversationHistory = toConversationHistory(
    input.conversationHistory, input.maxConversationTokens ?? 2000,
  )
  const legalBasis = toLegalBasis(input.reasoningResult)
  const citations = toCitations(input.reasoningResult)
  const evidence = toEvidence(input.reasoningResult)
  const warnings = toWarnings(input.reasoningResult)
  const missingInformation = toMissingInformation(input.reasoningResult)
  const recommendedActions = deriveRecommendedActions(input.reasoningResult)
  const systemInstructions = buildSystemInstructions(input.reasoningResult, language)
  const attachments = (input.attachmentRefs ?? []).map(ref => ({ attachmentId: ref, description: ref }))

  const tokenEstimate = estimateTokens(
    systemInstructions.contextSummary
    + citations.map(c => c.full).join(' ')
    + conversationHistory.map(m => m.content).join(' '),
  )

  const context: AIContext = {
    contextId: crypto.randomUUID(),
    builtAt: new Date().toISOString(),
    asOfDate: input.reasoningResult.asOfDate,
    question: input.reasoningResult.intent.question,
    intent: {
      intentType: input.reasoningResult.intent.intentType,
      confidence: input.reasoningResult.intent.confidence,
      ambiguous: input.reasoningResult.intent.ambiguous,
    },
    decision: input.reasoningResult.decision,
    confidence: input.reasoningResult.confidence,
    confidenceLabel: input.reasoningResult.confidenceLabel,
    humanReviewRequired: input.reasoningResult.humanReviewRequired,
    humanReviewReason: input.reasoningResult.humanReviewReason,
    legalBasis, citations, evidence,
    reasoningTrace: summarizeTrace(input.reasoningResult.reasoningTrace),
    warnings, missingInformation, recommendedActions, attachments, conversationHistory,
    systemInstructions, totalTokenEstimate: tokenEstimate, language,
  }

  return deepFreeze(context)
}
