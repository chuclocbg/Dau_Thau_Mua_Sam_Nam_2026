// ── Phase X.2 Batch B — AI layer domain types ─────────────────────────────────
// Per PROJECT_KNOWLEDGE_SYSTEM/01_PROJECT_DOCS/AI_CONTEXT_SCHEMA.md. Pure types only.
//
// NAMING NOTE: `ModelInfo`, `PromptTemplate`, `ModelCapability` all already exist,
// unrelated, in src/providers/{OpenAIProvider,PromptTemplateManager,ModelManager}.ts
// (a different, pre-existing "P6" chat-agent track). Per the Phase X.2 Batch A
// precedent, only the names that actually collide are prefixed (`AI...`), matching
// the already-approved `AIContext*` family — everything else here matches
// AI_CONTEXT_SCHEMA.md exactly.
//
// C-05 COMPLIANCE NOTE (per PHASE_X2_BATCH_B architecture gate review, Finding A):
// AIContext is built from data the caller already has in hand (a ReasoningResult and
// a conversation history array) — nothing here calls a repository. The caller is
// responsible for any repository read; this module only shapes already-fetched data.

export type AIOutputLanguage = 'vi' | 'en' | 'vi+en'
export type AIConfidenceLabel = 'HIGH' | 'MEDIUM' | 'LOW' | 'VERY_LOW'

export interface AIContextIntent {
  readonly intentType: string
  readonly confidence: number
  readonly ambiguous: boolean
}

export interface AIContextLegalBasis {
  readonly itemId: string
  readonly documentSymbol: string
  readonly documentType: string
  readonly authorityLevel: number
  readonly article?: string
  readonly clause?: string
  readonly point?: string
  readonly provisionText: string
  readonly role: string
  readonly isNormative: boolean
  readonly isPrimary: boolean
  readonly effectiveFrom: string
  readonly effectiveTo?: string
  readonly citationFull: string
  readonly citationShort: string
  readonly citationInline: string
}

export interface AIContextCitation {
  readonly citationId: string
  readonly itemId: string
  readonly full: string
  readonly short: string
  readonly inline: string
  readonly isNormative: boolean
  readonly isPrimary: boolean
}

export interface AIContextEvidence {
  readonly itemId: string
  readonly domain: string
  readonly type: string
  readonly title: string
  readonly summary: string
  readonly role: string
  readonly confidence: number
}

export interface AIContextTraceStep {
  readonly stage: string
  readonly action: string
  readonly description: string
  readonly confidence: number
}

export interface AIContextWarning {
  readonly warningCode: string
  readonly severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  readonly message: string
}

export interface AIContextMissingInfo {
  readonly description: string
  readonly isCritical: boolean
  readonly impact: string
}

export type AIContextActionType =
  | 'SUBMIT_DOCUMENT' | 'GET_APPROVAL' | 'PUBLISH_NOTICE' | 'PREPARE_GUARANTEE'
  | 'CONSULT_LEGAL' | 'CORRECT_VIOLATION' | 'AWAIT_DECISION' | 'REVIEW_DOCUMENT'
  | 'CONTACT_AUTHORITY' | 'RECORD_MINUTES'

export interface AIContextAction {
  readonly actionId: string
  readonly description: string
  readonly actionType: AIContextActionType
  readonly priority: number
}

export interface AIContextAttachment {
  readonly attachmentId: string
  readonly description: string
}

export type AIContextMessageRole = 'USER' | 'ASSISTANT' | 'SYSTEM'

export interface AIContextMessage {
  readonly role: AIContextMessageRole
  readonly content: string
  readonly timestamp: string
}

export type AIOutputFormat =
  | 'CONVERSATIONAL' | 'STRUCTURED_LIST' | 'LEGAL_ADVISORY' | 'STEP_BY_STEP'
  | 'COMPARISON_TABLE' | 'LEGAL_MEMO'
export type AITone = 'FORMAL_LEGAL' | 'PROFESSIONAL' | 'ACCESSIBLE'
export type AICitationStyle = 'INLINE' | 'FOOTNOTE' | 'ENDNOTE' | 'NONE'

export interface AIContextSystemInstructions {
  readonly role: string
  readonly outputLanguage: AIOutputLanguage
  readonly outputFormat: AIOutputFormat
  readonly tone: AITone
  readonly citationStyle: AICitationStyle
  readonly forbiddenBehaviors: readonly string[]
  readonly contextSummary: string
}

// ── The frozen contract (Constraint C-05) ──────────────────────────────────────
// No repository references, no service instances, no database handles, no
// provider objects, no LLM-specific types (temperature/model params/SDK types)
// anywhere in this shape — deep-frozen at construction by aiContextBuilder.ts.

export interface AIContext {
  readonly contextId: string
  readonly builtAt: string
  readonly asOfDate: string
  readonly question: string
  readonly intent: AIContextIntent
  readonly decision: string | null
  readonly confidence: number
  readonly confidenceLabel: AIConfidenceLabel
  readonly humanReviewRequired: boolean
  readonly humanReviewReason?: string
  readonly legalBasis: readonly AIContextLegalBasis[]
  readonly citations: readonly AIContextCitation[]
  readonly evidence: readonly AIContextEvidence[]
  readonly reasoningTrace: readonly AIContextTraceStep[]
  readonly warnings: readonly AIContextWarning[]
  readonly missingInformation: readonly AIContextMissingInfo[]
  readonly recommendedActions: readonly AIContextAction[]
  readonly attachments: readonly AIContextAttachment[]
  readonly conversationHistory: readonly AIContextMessage[]
  readonly systemInstructions: AIContextSystemInstructions
  readonly totalTokenEstimate: number
  readonly language: AIOutputLanguage
}

// ── Prompt layer (PromptBuilder -> PromptRenderer) ─────────────────────────────
// Provider-agnostic: a system/user/assistant three-part chat shape is common to
// every major LLM API, not an Anthropic-specific concept.

export type PromptSectionKind =
  | 'SYSTEM_INSTRUCTIONS' | 'QUESTION' | 'DECISION_CONTEXT' | 'LEGAL_BASIS'
  | 'EVIDENCE' | 'WARNINGS'

export interface PromptSection {
  readonly kind: PromptSectionKind
  readonly title: string
  readonly content: string
}

export interface PromptSpec {
  readonly contextId: string
  readonly sections: readonly PromptSection[]
  readonly conversationMessages: readonly AIContextMessage[]
}

export type RenderedChatRole = 'user' | 'assistant'

export interface RenderedChatMessage {
  readonly role: RenderedChatRole
  readonly content: string
}

export interface RenderedPrompt {
  readonly system: string
  readonly userMessage: string
  readonly conversationMessages: readonly RenderedChatMessage[]
}

// ── LLM adapter contract (ClaudeLLMAdapter is the first implementation) ────────
// Provider-agnostic on the outside — no Anthropic SDK type appears here.

export interface ILLMAdapter {
  readonly providerId: string
  complete(request: LLMAdapterRequest): Promise<LLMAdapterResult>
}

export interface LLMAdapterRequest {
  readonly rendered: RenderedPrompt
  readonly modelId: string
  readonly maxOutputTokens?: number
}

export type LLMAdapterResult =
  | { readonly ok: true; readonly content: string; readonly model: string; readonly usage: { readonly inputTokens: number; readonly outputTokens: number } }
  | { readonly ok: false; readonly errorCode: string; readonly message: string }
