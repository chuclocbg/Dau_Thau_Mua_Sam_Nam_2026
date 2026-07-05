# Reasoning Layer — Type Definitions

Part of: [reasoning-architecture.md](../decisions/reasoning-architecture.md)

All types live in `src/reasoning/reasoningTypes.ts`. No type from this module escapes into `src/knowledge/`. Callers import from `reasoningTypes.ts` only.

---

## 1. Entry Point

```typescript
// What the caller provides
interface ReasoningQuestion {
  question:        string           // natural language question (Vietnamese or English)
  language?:       'vi' | 'en'     // default 'vi'
  context?:        ReasoningContext // structured context (optional; may also be extracted from question)
  asOfDate?:       string           // YYYY-MM-DD; default = today
  outputFormat?:   ReasoningOutputFormat
  maxDepth?:       number           // cross-reference expansion depth; default 2
  domainHints?:    string[]         // optional domain hints for KnowledgeResolver
}

type ReasoningOutputFormat = 'DECISION' | 'EXPLANATION' | 'FULL_TRACE' | 'LEGAL_MEMO'
// DECISION:     decision + citations + confidence (minimal; for UI)
// EXPLANATION:  + reasoning trace summary + warnings (for staff)
// FULL_TRACE:   everything including every stage step (for audit / AI input)
// LEGAL_MEMO:   formatted Vietnamese legal memo structure
```

---

## 2. Context

Passed between all pipeline stages. Populated by `IntentDetector` (Stage 1) from the question, supplemented by the caller's explicit `context` field.

```typescript
interface ReasoningContext {
  // Procurement dimensions (all optional; filled as available)
  packageType?:            string    // 'GOODS' | 'CONSTRUCTION' | 'CONSULTING' | 'MIXED'
  fundSource?:             string    // 'STATE_BUDGET' | 'ODA' | 'PPP' | 'ENTERPRISE'
  procurementMethod?:      string    // 'OPEN_TENDER' | 'LIMITED_TENDER' | 'DIRECT_AWARD' | ...
  estimatedValue?:         bigint    // in VNĐ; bigint (never float)
  contractType?:           string    // 'LUMP_SUM' | 'UNIT_PRICE' | 'TIME_MATERIAL'
  contractValue?:          bigint    // signed contract value
  advanceAmount?:          bigint    // proposed advance payment amount
  department?:             string    // org unit
  region?:                 string    // province code or 'NATIONWIDE'
  vendorId?:               string    // supplier being evaluated

  // Temporal
  asOfDate:                string    // YYYY-MM-DD (always populated, default = today)
  contractSignedDate?:     string
  deadlineDate?:           string

  // Detected legal references (from IntentDetector)
  mentionedDocumentSymbols?: string[]  // '22/2023/QH15', '79/2025/TT-BTC', ...
  mentionedArticles?:        string[]  // 'Điều 15', 'Điều 29'
  mentionedConcepts?:        string[]  // 'tạm ứng', 'bảo lãnh dự thầu'

  // Extensible — unknown future dimensions
  [key: string]:           unknown
}
```

---

## 3. Intent

Output of Stage 1 (IntentDetector).

```typescript
interface ReasoningIntent {
  intentType:         IntentType
  subIntent?:         string              // open string for fine-grained classification
  question:           string              // original question
  normalizedQuestion: string              // normalized, Vietnamese
  detectedEntities:   DetectedEntity[]
  context:            ReasoningContext    // extracted from question + caller's context merged
  confidence:         number              // 0–1; how confident is the intent classification
  ambiguous:          boolean             // true if multiple intent types fit
  alternatives?:      IntentType[]        // if ambiguous, other candidate intents
}

type IntentType =
  | 'THRESHOLD_CHECK'        // is value X above/below a legal threshold?
  | 'METHOD_SELECTION'       // which procurement method applies?
  | 'DOCUMENT_REQUIRED'      // what documents are required for this step?
  | 'COMPLIANCE_CHECK'       // is this approach legally compliant?
  | 'AUTHORITY_CHECK'        // who has authority to approve this?
  | 'ADVANCE_PAYMENT_RULE'   // what are the advance payment rules?
  | 'GUARANTEE_RULE'         // what guarantees are required?
  | 'TIMELINE_CHECK'         // are these timelines compliant?
  | 'EXCEPTION_INQUIRY'      // does an exception apply here?
  | 'CONFLICT_RESOLUTION'    // two rules seem to conflict — which prevails?
  | 'DEFINITION_LOOKUP'      // what does this term mean legally?
  | 'PROCEDURE_GUIDE'        // what is the correct procedure for this step?
  | 'BEST_PRACTICE'          // what is the best practice here?
  | 'RISK_ASSESSMENT'        // what are the risks in this approach?
  | 'GENERAL'                // open-ended; does not match a specific intent

interface DetectedEntity {
  entityType:   EntityType
  value:        string
  rawText:      string       // as it appeared in the question
  confidence:   number
  startOffset:  number
  endOffset:    number
}

type EntityType =
  | 'DOCUMENT_SYMBOL'       // '22/2023/QH15'
  | 'ARTICLE_REF'           // 'Điều 15 khoản 2'
  | 'MONEY_AMOUNT'          // '2 tỷ', '500 triệu'
  | 'DATE'                  // '01/01/2026', 'năm 2025'
  | 'PACKAGE_TYPE'          // 'hàng hóa', 'xây dựng'
  | 'FUND_SOURCE'           // 'ngân sách nhà nước', 'ODA'
  | 'LEGAL_CONCEPT'         // 'tạm ứng', 'bảo lãnh'
  | 'PROCUREMENT_METHOD'    // 'đấu thầu rộng rãi', 'chỉ định thầu'
  | 'ORGANIZATION'          // 'Bộ Tài chính', 'UBND tỉnh'
  | 'PERSON_TITLE'          // 'Giám đốc', 'Bộ trưởng'
```

---

## 4. Resolved Knowledge

Output of Stage 2 (KnowledgeResolver). This is the only point where `IKnowledgePlatform` is called. All subsequent stages receive this struct — they never call the platform again.

```typescript
interface ResolvedKnowledge {
  // Retrieved from Knowledge Platform
  legalItems:          KnowledgeItemRef[]   // applicable laws, decrees, circulars
  procurementItems:    KnowledgeItemRef[]   // applicable procurement rules
  thresholdItems:      KnowledgeItemRef[]   // applicable thresholds (type='THRESHOLD')
  ruleItems:           KnowledgeItemRef[]   // applicable rules (type='EVALUATION_RULE')
  templateItems:       KnowledgeItemRef[]   // applicable templates
  checklistItems:      KnowledgeItemRef[]   // applicable checklists
  schoolPolicyItems:   KnowledgeItemRef[]   // org-internal policies
  caseItems:           KnowledgeItemRef[]   // similar historical cases
  riskItems:           KnowledgeItemRef[]   // applicable risk patterns
  glossaryItems:       KnowledgeItemRef[]   // term definitions used in reasoning
  graphEdges:          KnowledgeEdgeRef[]   // relevant KnowledgeGraph edges

  // Resolution metadata
  asOfDate:            string
  resolvedAt:          string               // ISO datetime of resolution
  platformCallCount:   number               // how many IKnowledgePlatform calls were made
  platformCallsMs:     number               // total time in Knowledge Platform
  warnings:            string[]             // any warnings from resolution (empty result sets, etc.)
}

// Lightweight reference to a KnowledgeItem — avoids re-passing full item objects between stages
interface KnowledgeItemRef {
  itemId:      string
  domain:      string
  type:        string
  title:       string
  summary:     string
  confidence:  number         // KnowledgeItem.confidence from corpus
  layer:       1 | 2 | 3 | 4
  legalBasis:  LegalBasisRef[]
  metadata:    Record<string, unknown>
  effectiveFrom: string
  effectiveTo?:  string
}

interface KnowledgeEdgeRef {
  fromItemId:    string
  toItemId:      string
  relationType:  string
  weight?:       number
}
```

---

## 5. Reasoning Step (Trace Unit)

Every pipeline stage appends `ReasoningStep` records to a growing trace. The full trace is included in `ReasoningResult.reasoningTrace`.

```typescript
interface ReasoningStep {
  stepId:                  string
  stage:                   PipelineStage
  action:                  ReasoningAction
  description:             string         // human-readable; in Vietnamese
  inputSummary?:           string
  outputSummary?:          string

  // Evidence consumed at this step
  itemIdsConsumed:         string[]       // KnowledgeItem IDs used at this step
  relationsConsumed:       string[]       // KnowledgeRelation types used

  // Step outcome
  conclusion?:             string         // what was decided at this step (may be null for info-only steps)
  confidence:              number         // 0–1; step-level confidence
  flagged:                 boolean        // true if this step produced a warning or triggered humanReview
  humanReviewTriggered:    boolean        // true if this step set humanReviewRequired

  durationMs:              number
}

type PipelineStage =
  | 'INTENT_DETECTION'
  | 'KNOWLEDGE_RESOLUTION'
  | 'REASONING'
  | 'RULE_EVALUATION'
  | 'EVIDENCE_COLLECTION'
  | 'CITATION_FORMATTING'
  | 'ANSWER_COMPOSITION'

type ReasoningAction =
  // Stage 1
  | 'DETECT_INTENT'
  | 'EXTRACT_ENTITY'
  | 'BUILD_CONTEXT'
  // Stage 2
  | 'RESOLVE_LEGAL_KNOWLEDGE'
  | 'RESOLVE_PROCUREMENT_KNOWLEDGE'
  | 'RESOLVE_RULES'
  | 'RESOLVE_THRESHOLDS'
  | 'RESOLVE_SCHOOL_POLICY'
  | 'RESOLVE_SIMILAR_CASES'
  | 'EXPAND_CROSS_REFERENCE'
  // Stage 3
  | 'RESOLVE_APPLICABLE_LAW'
  | 'RESOLVE_EFFECTIVE_DATE'
  | 'APPLY_LEGAL_HIERARCHY'
  | 'DETECT_SUPERSESSION'
  | 'DETECT_CONFLICT'
  | 'RESOLVE_CONFLICT'
  | 'EXPAND_CROSS_REFERENCE'
  // Stage 4
  | 'EVALUATE_THRESHOLD'
  | 'EVALUATE_RULE'
  | 'DETECT_EXCEPTION'
  | 'APPLY_EXCEPTION'
  // Stage 5
  | 'COLLECT_EVIDENCE'
  | 'IDENTIFY_MISSING_EVIDENCE'
  | 'ASSESS_EVIDENCE_SUFFICIENCY'
  // Stage 6
  | 'FORMAT_CITATION'
  | 'BUILD_CITATION_CHAIN'
  // Stage 7
  | 'COMPUTE_CONFIDENCE'
  | 'DETERMINE_HUMAN_REVIEW'
  | 'COMPOSE_DECISION'
  | 'GENERATE_EXPLANATION'
  | 'GENERATE_WARNINGS'
```

---

## 6. Applied Document and Article

```typescript
interface AppliedDocument {
  itemId:          string           // KnowledgeItem.id
  documentSymbol:  string           // '22/2023/QH15'
  title:           string
  documentType:    string           // 'LAW' | 'DECREE' | 'CIRCULAR' ...
  authorityLevel:  number           // 1–14
  issuingBody:     string
  effectiveFrom:   string
  effectiveTo?:    string
  role:            AppliedRole      // how this document was used in reasoning
  wasSuperseded:   boolean
  supersededBy?:   string           // itemId of the superseding document (if wasSuperseded)
}

interface AppliedArticle {
  itemId:          string           // KnowledgeItem.id for the article-level item
  documentSymbol:  string
  article:         string           // 'Điều 15'
  clause?:         string           // 'khoản 2'
  point?:          string           // 'điểm a'
  subpoint?:       string           // 'tiết 1'
  title?:          string           // article heading if available
  extractedText:   string           // the text of this article/clause/point
  role:            AppliedRole
  applicabilityScore: number        // 0–1; how relevant is this article to the question
  exceptions:      DetectedException[]
  crossReferences: string[]         // itemIds of cross-referenced articles
}

type AppliedRole =
  | 'PRIMARY_BASIS'          // directly answers the question
  | 'SUPPORTING_BASIS'       // supports the primary basis
  | 'EXCEPTION_SOURCE'       // source of an applicable exception
  | 'CONFLICT_SOURCE'        // one side of a resolved conflict
  | 'SUPERSEDED_CONTEXT'     // historically relevant; no longer in force
  | 'CROSS_REFERENCE'        // followed from another article's cross-reference
  | 'SCHOOL_POLICY_OVERRIDE' // more restrictive internal policy
```

---

## 7. ReasoningResult

The output of `ILegalReasoningEngine.reason()`. This is the frozen output contract.

```typescript
interface ReasoningResult {
  // Core output (required by spec)
  decision:             string | null         // the answer; null if humanReviewRequired and confidence < 0.50
  confidence:           number                // 0–1; aggregate confidence score
  appliedDocuments:     AppliedDocument[]
  appliedArticles:      AppliedArticle[]
  reasoningTrace:       ReasoningStep[]       // full pipeline trace
  citations:            FormattedCitation[]
  missingEvidence:      MissingEvidence[]
  warnings:             ReasoningWarning[]
  humanReviewRequired:  boolean

  // Extended output
  humanReviewReason?:   string                // why review is required (if humanReviewRequired)
  intent:               ReasoningIntent       // what the system understood the question to be
  confidenceLabel:      ConfidenceLabel       // HIGH | MEDIUM | LOW | VERY_LOW
  explainability:       ReasoningExplanation  // human-readable explanation at requested format
  resolvedKnowledge:    ResolvedKnowledge     // what the Knowledge Platform returned (for audit)
  exceptions:           DetectedException[]   // all exceptions found across all articles
  conflicts:            DetectedConflict[]    // all conflicts detected (resolved or not)
  thresholdResults:     ThresholdResult[]     // threshold evaluations
  ruleResults:          RuleResult[]          // rule evaluations
  similarCases:         SimilarCase[]         // similar historical cases

  // Performance
  processingTimeMs:     number
  platformCallCount:    number
  asOfDate:             string
  answeredAt:           string               // ISO datetime
}

type ConfidenceLabel = 'HIGH' | 'MEDIUM' | 'LOW' | 'VERY_LOW'
```

---

## 8. Citations

```typescript
interface FormattedCitation {
  citationId:       string
  itemId:           string          // source KnowledgeItem.id
  documentSymbol:   string
  article?:         string
  clause?:          string
  point?:           string
  appendix?:        string

  // Formatted forms
  full:             string   // 'Điều 15 khoản 2 điểm a Nghị định 104/2026/NĐ-CP ngày 15/3/2026'
  short:            string   // 'Đ15.2.a NĐ 104/2026'
  inline:           string   // '(Điều 15.2.a NĐ 104/2026)'

  // Context
  role:             AppliedRole
  isNormative:      boolean    // true = legally binding basis; false = informational
  isPrimary:        boolean    // true = this is the primary legal basis for the decision
  extractedText?:   string     // the actual provision text
}
```

---

## 9. Missing Evidence, Warnings, Conflicts, Exceptions

```typescript
interface MissingEvidence {
  evidenceId:         string
  description:        string          // what is missing (Vietnamese)
  isCritical:         boolean         // if true → humanReviewRequired
  suggestedSources?:  string[]        // where to find it (document symbols, domains)
  impact:             string          // how the absence affects the decision
}

interface ReasoningWarning {
  warningCode:   string
  severity:      'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  stage:         PipelineStage
  message:       string              // Vietnamese
  itemId?:       string              // related KnowledgeItem if applicable
  suggestion?:   string              // what to do about it
}

interface DetectedConflict {
  conflictId:        string
  description:       string
  conflictingItems:  ConflictingItem[]
  resolution:        ConflictResolution
  isResolved:        boolean
  resolvedBy?:       ConflictResolutionStrategy
  appliedItem?:      string         // itemId of the item that prevailed
  supersededItem?:   string         // itemId of the item set aside
}

interface ConflictingItem {
  itemId:          string
  documentSymbol:  string
  article?:        string
  provision:       string           // text of the provision
  authorityLevel:  number
  effectiveFrom:   string
  scope:           string           // which context this provision covers
}

type ConflictResolution =
  | 'RESOLVED_BY_HIERARCHY'          // higher authority level prevails
  | 'RESOLVED_BY_MORE_RESTRICTIVE'   // school policy more restrictive → applies
  | 'RESOLVED_BY_LEX_POSTERIOR'      // newer document prevails (same authority level)
  | 'RESOLVED_BY_LEX_SPECIALIS'      // more specific scope prevails
  | 'UNRESOLVED'                     // ambiguous → humanReviewRequired

type ConflictResolutionStrategy =
  | 'HIERARCHY' | 'MORE_RESTRICTIVE' | 'LEX_POSTERIOR' | 'LEX_SPECIALIS'

interface DetectedException {
  exceptionId:      string
  sourceItemId:     string
  article?:         string
  exceptionText:    string          // the exception clause text
  appliesTo?:       string          // which provision this is an exception to
  conditionText:    string          // the condition under which the exception applies
  isApplicable:     boolean | null  // true/false/null (null = cannot determine without more context)
  impactOnDecision: string
}
```

---

## 10. Threshold and Rule Results

```typescript
interface ThresholdResult {
  ruleId:           string
  thresholdItemId:  string          // KnowledgeItem.id of the threshold definition
  description:      string
  thresholdValue:   bigint          // in VNĐ
  contextValue:     bigint          // the value being checked
  operator:         'GT' | 'GTE' | 'LT' | 'LTE' | 'BETWEEN'
  passed:           boolean         // true = threshold condition met
  legalBasis:       LegalBasisRef[]
  applicabilityNote?: string        // why this threshold applies
}

interface RuleResult {
  ruleId:           string
  ruleItemId:       string          // KnowledgeItem.id of the rule definition
  ruleName:         string
  description:      string
  status:           RuleStatus
  evidence:         string[]        // itemIds supporting this result
  exceptions:       DetectedException[]
  legalBasis:       LegalBasisRef[]
  explanation:      string          // why PASS/FAIL/EXCEPTION/NOT_APPLICABLE
}

type RuleStatus =
  | 'PASS'            // rule satisfied; proceeding is compliant
  | 'FAIL'            // rule not satisfied; action blocked or requires remediation
  | 'EXCEPTION'       // a legal exception applies; normal rule set aside
  | 'NOT_APPLICABLE'  // rule does not apply to this context
  | 'INCONCLUSIVE'    // cannot determine; missing context → humanReviewRequired
```

---

## 11. Confidence Scoring

```typescript
interface ConfidenceComponents {
  baseScore:              number    // 1.00 starting point
  deductions:             ConfidenceDeduction[]
  finalScore:             number    // after all deductions; clamped [0, 1]
  label:                  ConfidenceLabel
  computedAt:             string
}

interface ConfidenceDeduction {
  reason:        ConfidenceDeductionReason
  amount:        number           // 0–1; subtracted from running score
  itemId?:       string
  description:   string
}

type ConfidenceDeductionReason =
  | 'UNRESOLVED_NORMATIVE_CITATION'     // −0.10 per unresolved (max −0.20)
  | 'RESOLVED_CONFLICT'                 // −0.08 per resolved conflict
  | 'UNRESOLVED_CONFLICT'               // −0.20 per unresolved conflict
  | 'SUPERSEDED_DOCUMENT_USED'          // −0.15 per superseded document
  | 'MISSING_CRITICAL_EVIDENCE'         // −0.20 per missing critical item
  | 'MISSING_NON_CRITICAL_EVIDENCE'     // −0.05 per missing non-critical item
  | 'LOW_QUALITY_KNOWLEDGE_ITEM'        // −(0.70 - quality) weighted by role
  | 'UNVERIFIED_AI_EXTRACTION'          // −0.10 for AI-extracted unverified content
  | 'UNRESOLVED_EXCEPTION'              // −0.10 per exception that could not be evaluated
  | 'AMBIGUOUS_INTENT'                  // −0.10 if intent detection was ambiguous
  | 'PARTIAL_CONTEXT'                   // −0.05 per missing context field that would improve resolution
```

---

## 12. Explainability

```typescript
interface ReasoningExplanation {
  format:              ReasoningOutputFormat
  summary:             string              // 1–3 sentence plain-language summary (Vietnamese)
  decisionRationale:   string              // why this decision was reached
  keyProvisions:       ExplainedProvision[]
  keyExceptions?:      string              // plain-language exception summary
  conflictSummary?:    string              // if conflicts were resolved, how
  confidenceExplained: string              // why this confidence score
  whatIsMissing?:      string              // plain-language description of missing evidence
  nextSteps?:          string[]            // actionable next steps for the user
  legalMemo?:          LegalMemo           // populated only for LEGAL_MEMO format
}

interface ExplainedProvision {
  citation:    FormattedCitation
  relevance:   string           // plain-language reason this provision applies
  requirement: string           // what this provision requires of the user
  isBinding:   boolean
}

interface LegalMemo {
  heading:         string   // 'PHIẾU TƯ VẤN PHÁP LÝ'
  subject:         string   // question restated formally
  legalBasisSection: string // Căn cứ pháp lý
  analysisSection: string   // Phân tích
  conclusionSection: string // Kết luận
  noteSection?:    string   // Lưu ý (if exceptions or warnings)
  preparedAt:      string
}
```

---

## 13. ILegalReasoningEngine

The top-level interface. Only two methods.

```typescript
interface ILegalReasoningEngine {
  reason(question: ReasoningQuestion): Promise<ReasoningResult>
  explain(result: ReasoningResult, format: ReasoningOutputFormat): Promise<ReasoningExplanation>
}
```

`reason()` runs the full 8-stage pipeline and returns `ReasoningResult` with a default explanation at the requested format.

`explain()` regenerates the explanation for an existing `ReasoningResult` at a different format level — without re-running the pipeline (uses the existing `reasoningTrace`).
