// ── Phase X.2 Batch A — Reasoning Pipeline Core domain types ──────────────────
// Per app/knowledge/reasoning/{types,pipeline,conflict,rules}.md and
// PROJECT_KNOWLEDGE_SYSTEM/01_PROJECT_DOCS/{AI_ADVISORY_ARCHITECTURE,PHASE_X_EXECUTION_PLAN,
// PHASE_X2_IMPLEMENTATION_STRATEGY}.md. Pure types — no logic.
//
// NAMING NOTE (found during pre-implementation collision check, mirroring the same check
// performed before Phase X.1): four names in the pre-existing design corpus collide with
// unrelated, pre-existing tracks already in this repository:
//   - `ReasoningStep`   collides with src/reasoning/decisionModel.ts (Phase 15 Governance
//                       Reasoning Engine — a different, unrelated pipeline)
//   - `RuleResult`      collides with src/legal/governanceRuleEngine.ts
//   - `ThresholdResult` collides with src/legal/domain/legalDomainTypes.ts
//   - `PipelineStage`   collides with src/providers/Pipeline.ts (there: a stream-stage
//                       function type, an unrelated concept entirely)
// Per PHASE_X2_IMPLEMENTATION_STRATEGY.md §11: only the names that actually collide are
// prefixed (`Legal...`), not every type defensively — everything else here matches the
// design corpus exactly.
//
// SCOPE NOTE (Batch A only, per PHASE_X2_IMPLEMENTATION_STRATEGY.md §1-2): Stage 2
// (Knowledge Resolution — the only stage calling IKnowledgePlatform) is X.3's job.
// `ResolvedKnowledge` here is a plain data shape produced by hand-built fixtures
// (testing/mockKnowledgeFixtures.ts) in Batch A, and will be produced by a real
// `knowledgeResolver.ts` in X.3 — this module never imports from src/knowledge/.
// `graphEdges`/cross-reference-graph fields are omitted; Batch A's cross-reference
// expansion (pipeline.md Stage 3 Responsibility 6) works from already-resolved
// `legalItems` alone, never a graph API call.

// ── Entry point ───────────────────────────────────────────────────────────────

export type ReasoningOutputFormat = 'DECISION' | 'EXPLANATION' | 'FULL_TRACE' | 'LEGAL_MEMO'

export interface ReasoningQuestion {
  readonly question: string
  readonly language?: 'vi' | 'en'
  readonly context?: Partial<ReasoningContext>
  readonly asOfDate?: string
  readonly outputFormat?: ReasoningOutputFormat
}

export interface ReasoningContext {
  readonly packageType?: string
  readonly fundSource?: string
  readonly procurementMethod?: string
  readonly estimatedValue?: bigint
  readonly contractType?: string
  readonly contractValue?: bigint
  readonly advanceAmount?: bigint
  readonly advanceRatio?: number
  readonly department?: string
  readonly region?: string
  readonly vendorId?: string
  readonly asOfDate: string
  readonly mentionedDocumentSymbols?: readonly string[]
  readonly mentionedArticles?: readonly string[]
  readonly mentionedConcepts?: readonly string[]
  readonly [key: string]: unknown
}

// ── Intent (Stage 1 output) ─────────────────────────────────────────────────────

export type IntentType =
  | 'THRESHOLD_CHECK' | 'METHOD_SELECTION' | 'DOCUMENT_REQUIRED' | 'COMPLIANCE_CHECK'
  | 'AUTHORITY_CHECK' | 'ADVANCE_PAYMENT_RULE' | 'GUARANTEE_RULE' | 'TIMELINE_CHECK'
  | 'EXCEPTION_INQUIRY' | 'CONFLICT_RESOLUTION' | 'DEFINITION_LOOKUP' | 'PROCEDURE_GUIDE'
  | 'BEST_PRACTICE' | 'RISK_ASSESSMENT' | 'GENERAL'

export type EntityType =
  | 'DOCUMENT_SYMBOL' | 'ARTICLE_REF' | 'MONEY_AMOUNT' | 'DATE'
  | 'PACKAGE_TYPE' | 'FUND_SOURCE' | 'LEGAL_CONCEPT' | 'PROCUREMENT_METHOD'

export interface DetectedEntity {
  readonly entityType: EntityType
  readonly value: string
  readonly rawText: string
  readonly confidence: number
  readonly startOffset: number
  readonly endOffset: number
}

export interface ReasoningIntent {
  readonly intentType: IntentType
  readonly question: string
  readonly normalizedQuestion: string
  readonly detectedEntities: readonly DetectedEntity[]
  readonly context: ReasoningContext
  readonly confidence: number
  readonly ambiguous: boolean
  readonly alternatives?: readonly IntentType[]
}

// ── Resolved knowledge (Stage 2 output — supplied by fixtures in Batch A) ──────

export interface LegalBasisRef {
  readonly documentSymbol: string
  readonly article?: string
  readonly clause?: string
  readonly point?: string
}

export interface KnowledgeItemRef {
  readonly itemId: string
  readonly domain: string
  readonly type: string
  readonly title: string
  readonly summary: string
  readonly confidence: number
  readonly layer: 1 | 2 | 3 | 4
  readonly legalBasis: readonly LegalBasisRef[]
  readonly metadata: Readonly<Record<string, unknown>>
  readonly effectiveFrom: string
  readonly effectiveTo?: string
}

export type RuleCategory =
  | 'PROCUREMENT_METHOD' | 'ADVANCE_PAYMENT' | 'GUARANTEE' | 'DOCUMENT_REQUIREMENT'
  | 'TIMELINE' | 'AUTHORITY' | 'SUPPLIER_ELIGIBILITY' | 'EVALUATION_CRITERIA'
  | 'CONTRACT_TERMS' | 'PAYMENT_TERMS' | 'RETENTION' | 'REPORTING'

export type ConditionOperator =
  | 'EQ' | 'NEQ' | 'GT' | 'GTE' | 'LT' | 'LTE' | 'BETWEEN' | 'IN' | 'NOT_IN' | 'EXISTS' | 'NOT_EXISTS'

export interface RuleCondition {
  readonly field: string
  readonly operator: ConditionOperator
  readonly value: string
  readonly unit?: 'VND' | 'PERCENT' | 'DAYS'
}

export interface EvaluationRuleMetadata {
  readonly ruleCode: string
  readonly ruleCategory: RuleCategory
  readonly conditions: readonly RuleCondition[]
  readonly outcome: {
    readonly pass: string
    readonly fail: string
    readonly exception?: string
    readonly inconclusive?: string
  }
  readonly isCritical: boolean
  readonly exceptionCodes?: readonly string[]
}

export type ThresholdType =
  | 'PROCUREMENT_METHOD_FLOOR' | 'PROCUREMENT_METHOD_CEILING' | 'ADVANCE_PAYMENT_MAX'
  | 'ADVANCE_PAYMENT_MIN_GUARANTEE' | 'BID_SECURITY_FLOOR' | 'PERFORMANCE_GUARANTEE_RATE'

export interface ThresholdMetadata {
  readonly thresholdCode: string
  readonly thresholdType: ThresholdType
  readonly contextField: string
  readonly operator: 'GT' | 'GTE' | 'LT' | 'LTE' | 'BETWEEN'
  readonly value: string
  readonly valueTo?: string
  readonly unit: 'VND' | 'PERCENT' | 'DAYS'
  readonly note?: string
}

export interface RuleKnowledgeItemRef extends KnowledgeItemRef {
  readonly rule: EvaluationRuleMetadata
}

export interface ThresholdKnowledgeItemRef extends KnowledgeItemRef {
  readonly threshold: ThresholdMetadata
}

export interface ResolvedKnowledge {
  readonly legalItems: readonly KnowledgeItemRef[]
  readonly procurementItems: readonly KnowledgeItemRef[]
  readonly thresholdItems: readonly ThresholdKnowledgeItemRef[]
  readonly ruleItems: readonly RuleKnowledgeItemRef[]
  readonly schoolPolicyItems: readonly KnowledgeItemRef[]
  readonly asOfDate: string
  readonly resolvedAt: string
  readonly platformCallCount: number
  readonly warnings: readonly string[]
}

// ── Reasoning trace ─────────────────────────────────────────────────────────────

export type LegalPipelineStage =
  | 'INTENT_DETECTION' | 'REASONING' | 'RULE_EVALUATION' | 'EVIDENCE_COLLECTION'
  | 'CITATION_FORMATTING' | 'ANSWER_COMPOSITION'

export type ReasoningAction =
  | 'DETECT_INTENT' | 'EXTRACT_ENTITY' | 'BUILD_CONTEXT'
  | 'RESOLVE_APPLICABLE_LAW' | 'RESOLVE_EFFECTIVE_DATE' | 'APPLY_LEGAL_HIERARCHY'
  | 'DETECT_SUPERSESSION' | 'DETECT_CONFLICT' | 'RESOLVE_CONFLICT' | 'EXPAND_CROSS_REFERENCE'
  | 'EVALUATE_THRESHOLD' | 'EVALUATE_RULE' | 'DETECT_EXCEPTION' | 'APPLY_EXCEPTION'
  | 'COLLECT_EVIDENCE' | 'IDENTIFY_MISSING_EVIDENCE' | 'ASSESS_EVIDENCE_SUFFICIENCY'
  | 'FORMAT_CITATION' | 'BUILD_CITATION_CHAIN'
  | 'COMPUTE_CONFIDENCE' | 'DETERMINE_HUMAN_REVIEW' | 'COMPOSE_DECISION'
  | 'GENERATE_EXPLANATION' | 'GENERATE_WARNINGS'

export interface LegalReasoningStep {
  readonly stepId: string
  readonly stage: LegalPipelineStage
  readonly action: ReasoningAction
  readonly description: string
  readonly itemIdsConsumed: readonly string[]
  readonly conclusion?: string
  readonly confidence: number
  readonly flagged: boolean
  readonly humanReviewTriggered: boolean
}

// ── Applied law ──────────────────────────────────────────────────────────────────

export type AppliedRole =
  | 'PRIMARY_BASIS' | 'SUPPORTING_BASIS' | 'EXCEPTION_SOURCE' | 'CONFLICT_SOURCE'
  | 'SUPERSEDED_CONTEXT' | 'CROSS_REFERENCE' | 'SCHOOL_POLICY_OVERRIDE'

export interface AppliedDocument {
  readonly itemId: string
  readonly documentSymbol: string
  readonly documentType: string
  readonly title: string
  readonly authorityLevel: number
  readonly effectiveFrom: string
  readonly effectiveTo?: string
  readonly role: AppliedRole
  readonly wasSuperseded: boolean
}

export interface AppliedArticle {
  readonly itemId: string
  readonly documentSymbol: string
  readonly documentType: string
  readonly article?: string
  readonly clause?: string
  readonly point?: string
  readonly extractedText: string
  readonly role: AppliedRole
  readonly applicabilityScore: number
  readonly exceptions: DetectedException[]
  readonly crossReferences: readonly string[]
}

// ── Exceptions ─────────────────────────────────────────────────────────────────

export interface DetectedException {
  readonly exceptionId: string
  readonly sourceItemId: string
  readonly patternCode: string
  readonly exceptionText: string
  readonly conditionText: string
  readonly isApplicable: boolean | null
  readonly impactOnDecision: string
}

// ── Conflicts ──────────────────────────────────────────────────────────────────

export interface ConflictingItem {
  readonly itemId: string
  readonly documentSymbol: string
  readonly article?: string
  readonly provision: string
  readonly authorityLevel: number
  readonly effectiveFrom: string
  readonly layer: 1 | 2 | 3 | 4
}

export type ConflictResolution =
  | 'RESOLVED_BY_HIERARCHY' | 'RESOLVED_BY_MORE_RESTRICTIVE'
  | 'RESOLVED_BY_LEX_POSTERIOR' | 'RESOLVED_BY_LEX_SPECIALIS' | 'UNRESOLVED'

export interface DetectedConflict {
  readonly conflictId: string
  readonly description: string
  readonly conflictingItems: readonly [ConflictingItem, ConflictingItem]
  readonly resolution: ConflictResolution
  readonly isResolved: boolean
  readonly appliedItem?: string
  readonly supersededItem?: string
}

// ── Thresholds and rules (Stage 4 output) ──────────────────────────────────────

export interface LegalThresholdResult {
  readonly thresholdItemId: string
  readonly thresholdCode: string
  readonly description: string
  readonly thresholdValue: bigint
  readonly contextValue: bigint
  readonly operator: 'GT' | 'GTE' | 'LT' | 'LTE' | 'BETWEEN'
  readonly passed: boolean
  readonly legalBasis: readonly LegalBasisRef[]
}

export type LegalRuleStatus = 'PASS' | 'FAIL' | 'EXCEPTION' | 'NOT_APPLICABLE' | 'INCONCLUSIVE'

export interface LegalRuleResult {
  readonly ruleItemId: string
  readonly ruleCode: string
  readonly status: LegalRuleStatus
  readonly evidence: readonly string[]
  readonly legalBasis: readonly LegalBasisRef[]
  readonly explanation: string
  readonly missingFields: readonly string[]
}

// ── Evidence (Stage 5 output) ───────────────────────────────────────────────────

export interface MissingEvidence {
  readonly evidenceId: string
  readonly description: string
  readonly isCritical: boolean
  readonly suggestedSources?: readonly string[]
  readonly impact: string
}

export type EvidenceSufficiency = 'SUFFICIENT' | 'PARTIAL' | 'INSUFFICIENT'

// ── Citations (Stage 6 output) ─────────────────────────────────────────────────

export interface FormattedCitation {
  readonly citationId: string
  readonly itemId: string
  readonly documentSymbol: string
  readonly article?: string
  readonly clause?: string
  readonly point?: string
  readonly full: string
  readonly short: string
  readonly inline: string
  readonly role: AppliedRole
  readonly isNormative: boolean
  readonly isPrimary: boolean
}

// ── Warnings ───────────────────────────────────────────────────────────────────

export interface ReasoningWarning {
  readonly warningCode: string
  readonly severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  readonly stage: LegalPipelineStage
  readonly message: string
  readonly itemId?: string
}

// ── Confidence (Stage 7) ────────────────────────────────────────────────────────

export type ConfidenceLabel = 'HIGH' | 'MEDIUM' | 'LOW' | 'VERY_LOW'

export type ConfidenceDeductionReason =
  | 'UNRESOLVED_NORMATIVE_CITATION' | 'RESOLVED_CONFLICT' | 'UNRESOLVED_CONFLICT'
  | 'SUPERSEDED_DOCUMENT_USED' | 'MISSING_CRITICAL_EVIDENCE' | 'MISSING_NON_CRITICAL_EVIDENCE'
  | 'LOW_QUALITY_KNOWLEDGE_ITEM' | 'UNRESOLVED_EXCEPTION' | 'AMBIGUOUS_INTENT' | 'PARTIAL_CONTEXT'

export interface ConfidenceDeduction {
  readonly reason: ConfidenceDeductionReason
  readonly amount: number
  readonly itemId?: string
  readonly description: string
}

export interface ConfidenceComponents {
  readonly baseScore: number
  readonly deductions: readonly ConfidenceDeduction[]
  readonly finalScore: number
  readonly label: ConfidenceLabel
}

// ── Explainability ─────────────────────────────────────────────────────────────

export interface ExplainedProvision {
  readonly citation: FormattedCitation
  readonly relevance: string
  readonly requirement: string
  readonly isBinding: boolean
}

export interface LegalMemo {
  readonly heading: string
  readonly subject: string
  readonly legalBasisSection: string
  readonly analysisSection: string
  readonly conclusionSection: string
  readonly noteSection?: string
  readonly preparedAt: string
}

export interface ReasoningExplanation {
  readonly format: ReasoningOutputFormat
  readonly summary: string
  readonly decisionRationale: string
  readonly keyProvisions: readonly ExplainedProvision[]
  readonly conflictSummary?: string
  readonly whatIsMissing?: string
  readonly nextSteps?: readonly string[]
  readonly legalMemo?: LegalMemo
}

// ── Final result ────────────────────────────────────────────────────────────────

export interface ReasoningResult {
  readonly decision: string | null
  readonly confidence: number
  readonly confidenceLabel: ConfidenceLabel
  readonly appliedDocuments: readonly AppliedDocument[]
  readonly appliedArticles: readonly AppliedArticle[]
  readonly reasoningTrace: readonly LegalReasoningStep[]
  readonly citations: readonly FormattedCitation[]
  readonly missingEvidence: readonly MissingEvidence[]
  readonly evidenceSufficiency: EvidenceSufficiency
  readonly warnings: readonly ReasoningWarning[]
  readonly humanReviewRequired: boolean
  readonly humanReviewReason?: string
  readonly intent: ReasoningIntent
  readonly explainability: ReasoningExplanation
  readonly resolvedKnowledge: ResolvedKnowledge
  readonly conflicts: readonly DetectedConflict[]
  readonly thresholdResults: readonly LegalThresholdResult[]
  readonly ruleResults: readonly LegalRuleResult[]
  readonly asOfDate: string
  readonly answeredAt: string
}

// ── Top-level interface ─────────────────────────────────────────────────────────

export interface ILegalReasoningEngine {
  reason(intent: ReasoningIntent, resolvedKnowledge: ResolvedKnowledge): Promise<ReasoningResult>
  explain(result: ReasoningResult, format: ReasoningOutputFormat): ReasoningExplanation
}
