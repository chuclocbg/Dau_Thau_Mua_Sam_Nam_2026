# Reasoning Pipeline — 8 Stages · 15 Responsibilities

Part of: [reasoning-architecture.md](../decisions/reasoning-architecture.md)

---

## Stage Map

```
ReasoningQuestion
       │
       ▼
┌──────────────────────────────────────────────────────────────────────┐
│ Stage 1 — Intent Detection                                           │
│ Responsibilities: [none from spec — enables all others]              │
│ Output: ReasoningIntent + populated ReasoningContext                 │
└──────────────────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────────────┐
│ Stage 2 — Knowledge Resolution                                       │
│ THE ONLY STAGE THAT CALLS IKnowledgePlatform                         │
│ Output: ResolvedKnowledge (all items for all subsequent stages)      │
└──────────────────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────────────┐
│ Stage 3 — Reasoning Engine                                           │
│ Responsibilities: 1 applicable law · 2 effective date ·              │
│   3 legal hierarchy · 4 conflict resolution ·                        │
│   5 superseded document detection · 6 cross-reference expansion      │
│ Output: AppliedDocument[], AppliedArticle[], DetectedConflict[]      │
└──────────────────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────────────┐
│ Stage 4 — Rule Engine                                                │
│ Responsibilities: 7 exception detection · 8 threshold evaluation ·   │
│   9 rule evaluation                                                  │
│ Output: RuleResult[], ThresholdResult[], DetectedException[]         │
└──────────────────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────────────┐
│ Stage 5 — Evidence Collection                                        │
│ Responsibilities: 10 evidence collection                             │
│ Output: evidence set complete; MissingEvidence[]                     │
└──────────────────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────────────┐
│ Stage 6 — Citation Formatter                                         │
│ Responsibilities: 11 citation generation                             │
│ Output: FormattedCitation[]                                          │
└──────────────────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────────────┐
│ Stage 7 — Answer Composer                                            │
│ Responsibilities: 12 reasoning trace · 13 confidence score ·         │
│   14 human review recommendation · 15 explainability                │
│ Output: ReasoningResult (complete)                                   │
└──────────────────────────────────────────────────────────────────────┘
       │
       ▼
ReasoningResult
```

**Trace:** each stage appends `ReasoningStep` records. The trace is passed through all stages as a mutable accumulator. `AnswerComposer` packages it as `reasoningTrace[]` in the final result.

**humanReviewRequired flag:** passed as mutable boolean through all stages. Any stage may set it to `true`. No stage may set it to `false`.

---

## Stage 1 — Intent Detection

**Class:** `IntentDetector`
**Input:** `ReasoningQuestion`
**Output:** `ReasoningIntent`

### Responsibilities

- Classify `intentType` from the natural language question
- Extract `DetectedEntity` records (document symbols, money amounts, dates, legal concepts, procurement terms)
- Merge caller-provided `context` with entities extracted from the question text
- Detect ambiguity (multiple intent types fit equally well)
- Set `asOfDate` (use caller's value or default to today)

### Entity Extraction Patterns

```
DOCUMENT_SYMBOL:
  Pattern: \b\d{1,3}\/\d{4}\/[A-ZĐẰẮÂÊÔƠƯÁÀẢÃẠÉÈẺẼẸÍÌỈĨỊÓÒỎÕỌÚÙỦŨỤỐỒỔỖỘẮẶẲẴẰẤẦẨẪẬẾỀỂỄỆ\-]+\b
  Examples: '22/2023/QH15', '104/2026/NĐ-CP', '79/2025/TT-BTC'

ARTICLE_REF:
  Pattern: [Điều]\s+\d+(?:\s+khoản\s+\d+)?(?:\s+điểm\s+[a-z])?
  Examples: 'Điều 15', 'Điều 15 khoản 2', 'Điều 15 khoản 2 điểm a'

MONEY_AMOUNT:
  Patterns: \d+(?:[.,]\d+)?\s*(?:tỷ|triệu|nghìn|VNĐ|đồng|VND|billion|million)
  Normalize to bigint (VNĐ): '2 tỷ' → 2_000_000_000n; '500 triệu' → 500_000_000n

DATE:
  Patterns: \d{2}\/\d{2}\/\d{4}, năm \d{4}, \d{4}, ngày \d{1,2} tháng \d{1,2} năm \d{4}
  Normalize to YYYY-MM-DD

LEGAL_CONCEPT:
  Match against GlossaryProvider / OntologyProvider term list
  Examples: 'tạm ứng', 'bảo lãnh dự thầu', 'hồ sơ mời thầu', 'chỉ định thầu'

PROCUREMENT_METHOD:
  Keyword: 'đấu thầu rộng rãi' → OPEN_TENDER; 'chỉ định thầu' → DIRECT_AWARD; etc.

PACKAGE_TYPE:
  Keyword: 'hàng hóa' → GOODS; 'xây dựng' → CONSTRUCTION; 'tư vấn' → CONSULTING

FUND_SOURCE:
  Keyword: 'ngân sách nhà nước' → STATE_BUDGET; 'ODA' → ODA; 'PPP' → PPP
```

### Intent Classification

Intent is classified by matching the normalized question against the `IntentPatternRegistry`. Each intent type has a set of trigger patterns (Vietnamese phrases). The highest-scoring match wins. If two patterns tie within 0.10 of each other: `ambiguous = true`, `alternatives[]` populated.

```
THRESHOLD_CHECK triggers:
  'ngưỡng', 'hạn mức', 'dưới bao nhiêu', 'trên bao nhiêu', 'vượt', 'không vượt',
  'áp dụng phương thức nào', 'chỉ định thầu được không'

METHOD_SELECTION triggers:
  'phương thức nào', 'hình thức lựa chọn', 'đấu thầu hay chỉ định',
  'được chỉ định không', 'có phải đấu thầu'

ADVANCE_PAYMENT_RULE triggers:
  'tạm ứng', 'ứng trước', 'mức tạm ứng', 'tỷ lệ tạm ứng', 'điều kiện tạm ứng'

GUARANTEE_RULE triggers:
  'bảo lãnh', 'bảo đảm dự thầu', 'bảo đảm thực hiện', 'bảo đảm tạm ứng',
  'mức bảo lãnh', 'thời hạn bảo lãnh'

AUTHORITY_CHECK triggers:
  'ai phê duyệt', 'thẩm quyền', 'cấp nào', 'Giám đốc được không', 'cần phê duyệt của ai'

COMPLIANCE_CHECK triggers:
  'có đúng không', 'có hợp lệ không', 'vi phạm không', 'có được không', 'đúng quy định'

EXCEPTION_INQUIRY triggers:
  'ngoại lệ', 'trường hợp nào được', 'trừ trường hợp', 'miễn', 'không áp dụng khi nào'
```

### Stage 1 Output (ReasoningStep appended)

```
Step: DETECT_INTENT
  description: 'Phát hiện ý định: [intentType] (confidence: 0.XX)'
Step: EXTRACT_ENTITY (one per entity type found)
  description: 'Trích xuất [entityType]: [value]'
Step: BUILD_CONTEXT
  description: 'Xây dựng ngữ cảnh suy luận: [context summary]'
```

---

## Stage 2 — Knowledge Resolution

**Class:** `KnowledgeResolver`
**Input:** `ReasoningIntent` (with populated `ReasoningContext`)
**Output:** `ResolvedKnowledge`

### RULE: This is the ONLY stage that calls IKnowledgePlatform.

All `IKnowledgePlatform` calls happen here. Other stages operate on `ResolvedKnowledge`.

### Resolution Strategy by Intent Type

```
ALL intents — always resolve:
  platform.resolveLegalBasis(intent.context)           → legalItems
  platform.resolveContext(intent.context)              → procurementItems

THRESHOLD_CHECK / METHOD_SELECTION — additionally:
  platform.resolveContext({ ...context, type: 'THRESHOLD' })  → thresholdItems
  platform.resolveContext({ ...context, type: 'EVALUATION_RULE' }) → ruleItems

ADVANCE_PAYMENT_RULE — additionally:
  platform.resolveContext({ ...context, concept: 'tạm ứng' }) → ruleItems + thresholdItems

GUARANTEE_RULE — additionally:
  platform.resolveContext({ ...context, concept: 'bảo lãnh' }) → ruleItems

AUTHORITY_CHECK — additionally:
  platform.resolveSchoolPolicy(context)                → schoolPolicyItems

COMPLIANCE_CHECK — additionally:
  platform.resolveChecklist(context)                   → checklistItems
  platform.resolveSchoolPolicy(context)                → schoolPolicyItems
  platform.resolveCases(intent.question, context, 3)   → caseItems

BEST_PRACTICE / RISK_ASSESSMENT — additionally:
  platform.resolveBestPractice(intent.question, context)  → (merged into ruleItems)
  platform.resolveRisk(context)                           → riskItems
  platform.resolveCases(intent.question, context, 5)      → caseItems
```

### Cross-Reference Pre-expansion

Before returning, KnowledgeResolver pre-expands cross-references if `question.maxDepth > 1`:

```
For each legalItem with REFERENCES or DEPENDS_ON edges:
  → follow graph edges via platform graph API (depth = min(maxDepth, 2))
  → add referenced items to legalItems if not already present
  → cap at 20 additional items per expansion (prevent combinatorial explosion)
  → log each expansion as a RESOLVE_CROSS_REFERENCE step in trace
```

### Temporal Filtering

Every `IKnowledgePlatform` call passes `asOfDate` from `ReasoningIntent.context.asOfDate`. The Knowledge Platform returns items valid at that date. Items with `effectiveTo < asOfDate` are excluded from default results.

Items that *were* valid at a past date but are now SUPERSEDED are included only if `asOfDate` falls within their `effectiveFrom`–`effectiveTo` window.

### Stage 2 Output (ReasoningStep appended)

```
Step: RESOLVE_LEGAL_KNOWLEDGE
  description: 'Truy vấn pháp lý: [N] văn bản tìm thấy cho ngữ cảnh [context summary]'
Step: RESOLVE_PROCUREMENT_KNOWLEDGE
  description: 'Truy vấn quy trình mua sắm: [N] mục tìm thấy'
Step: RESOLVE_RULES (if applicable)
  description: 'Tải [N] quy tắc đánh giá, [M] ngưỡng từ nền tảng kiến thức'
Step: EXPAND_CROSS_REFERENCE (if expansions made)
  description: 'Mở rộng tham chiếu chéo: [N] văn bản bổ sung'
```

---

## Stage 3 — Reasoning Engine

**Class:** `ReasoningEngine`
**Input:** `ReasoningIntent` + `ResolvedKnowledge`
**Output:** `AppliedDocument[]`, `AppliedArticle[]`, `DetectedConflict[]`

### Responsibility 1 — Applicable Law Resolution

From all `legalItems` in `ResolvedKnowledge`, determine which are applicable to the specific context.

```
For each legalItem:
  1. Check KnowledgeApplicabilityRule records (PACKAGE_TYPE, FUND_SOURCE, VALUE_RANGE, etc.)
  2. Evaluate rules against ReasoningContext
  3. If ALL rules pass → applicable
  4. If ANY rule fails → not applicable
  5. If no rules → universally applicable

Output: filtered list of applicable legalItems
Trace: one RESOLVE_APPLICABLE_LAW step per item evaluated
```

### Responsibility 2 — Effective Date Resolution

```
For each applicable legalItem:
  1. Check effectiveFrom ≤ asOfDate
  2. Check effectiveTo is null OR effectiveTo > asOfDate
  3. If out of range: mark as SUPERSEDED_CONTEXT; add warning
  4. If in range: include as ACTIVE for this reasoning call

Trace: one RESOLVE_EFFECTIVE_DATE step with outcome
```

### Responsibility 3 — Legal Hierarchy Arrangement

```
Sort all applicable legalItems by authorityLevel ASC (lower number = higher authority)
Group by documentType (LAW, DECREE, CIRCULAR, etc.)
Build hierarchy stack for conflict resolution (step 4)

Trace: one APPLY_LEGAL_HIERARCHY step showing the ordered stack
```

### Responsibility 4 — Conflict Resolution

Conflict = two applicable items from the same domain with overlapping effective periods that prescribe different (incompatible) values or requirements for the same question.

**Detection:**
```
For each pair (A, B) of applicable legalItems where:
  - A.domain = B.domain
  - A.effectiveFrom..A.effectiveTo overlaps with B
  - A and B address the same dimension (same concept, same packageType, same fundSource)
  - A and B prescribe different values or requirements
→ Conflict detected → call IConflictResolver
```

**Resolution** (see conflict.md for full strategy):
```
1. If authorityLevel differs → higher authority prevails
2. If same authorityLevel but Layer 3 (school) vs Layer 1/2 → Layer 3 applies if more restrictive
3. If same authorityLevel and same layer, effectiveFrom differs → lex posterior (newer prevails)
4. If scope differs → lex specialis (more specific scope prevails)
5. None of the above → UNRESOLVED → humanReviewRequired = true
```

Trace: one DETECT_CONFLICT step + one RESOLVE_CONFLICT (or UNRESOLVED) step per conflict.

### Responsibility 5 — Superseded Document Detection

```
For each applicable legalItem:
  Check if lifecycleStatus = SUPERSEDED at asOfDate
  Check if graph has SUPERSEDES edge pointing to this item from a newer item
  → If superseded: flag appliedDocument.wasSuperseded = true
  → Add warning: 'Văn bản [X] đã bị thay thế bởi [Y]'
  → If the question's asOfDate is current: reduce confidence (SUPERSEDED_DOCUMENT_USED deduction)
  → If asOfDate is in the past: SUPERSEDED_CONTEXT is expected; no deduction
```

### Responsibility 6 — Cross-Reference Expansion (Stage 3 pass)

Stage 2 pre-expanded at the document level. Stage 3 expands at the article level:

```
For each AppliedArticle:
  1. Check extractedText for explicit cross-references ('theo quy định tại Điều X')
  2. Check KnowledgeCitation records for CROSS_REFERENCES from this article
  3. If found: resolve those articles via resolvedKnowledge.legalItems
     (already fetched in Stage 2; no new platform calls)
  4. Add to AppliedArticle.crossReferences[]
  5. Add referenced articles to AppliedArticle list with role = CROSS_REFERENCE

Depth: capped at maxDepth (default 2)
Cap: max 10 cross-referenced articles per reasoning call to prevent explosion
```

---

## Stage 4 — Rule Engine

**Class:** `RuleEngine`
**Input:** `ReasoningIntent` + `ResolvedKnowledge` + `AppliedArticle[]` (from Stage 3)
**Output:** `RuleResult[]`, `ThresholdResult[]`, `DetectedException[]`

### Responsibility 7 — Exception Detection

```
For each AppliedArticle:
  Scan extractedText for exception patterns:
    Vietnamese patterns:
      'trừ trường hợp'       → introduces exception condition
      'không áp dụng'        → scope exclusion
      'ngoại trừ'            → except
      'trừ khi'              → unless
      'trường hợp đặc biệt'  → special cases
      'miễn là'              → provided that
    English patterns (if language='en'):
      'except', 'unless', 'provided that', 'does not apply'

  For each detected exception:
    Extract the exception condition (text after the pattern)
    Evaluate the condition against ReasoningContext
    If condition matches context → exception applies
    If condition does not match → exception does not apply
    If cannot evaluate (requires information not in context) → isApplicable = null
                                                              → MissingEvidence entry

Trace: one DETECT_EXCEPTION step per detected exception
       one APPLY_EXCEPTION step if exception is applicable
```

### Responsibility 8 — Threshold Evaluation

```
For each thresholdItem in ResolvedKnowledge:
  1. Extract threshold value from thresholdItem.metadata.value (bigint)
  2. Extract operator from thresholdItem.metadata.operator ('GT' | 'GTE' | 'LT' | 'LTE' | 'BETWEEN')
  3. Extract the context value to compare (from ReasoningContext, per thresholdItem.metadata.contextField)
  4. Evaluate: contextValue [operator] thresholdValue
  5. Build ThresholdResult

Key procurement thresholds (defined as KnowledgeItem in corpus, NOT in code):
  OPEN_TENDER_GOODS_MIN:         contextField=estimatedValue, GT, 2_000_000_000n (2B)
  OPEN_TENDER_CONSTRUCTION_MIN:  contextField=estimatedValue, GT, 5_000_000_000n (5B)
  DIRECT_AWARD_MAX:              contextField=estimatedValue, LT, 500_000_000n   (500M)
  ADVANCE_PAYMENT_MAX_STATE:     contextField=advanceRatio,  LTE, 0.30           (30%)
  BID_SECURITY_THRESHOLD:        contextField=estimatedValue, GT, 500_000_000n   (500M)

These values are loaded from Knowledge Platform corpus, not from code.
When law changes a threshold, only the KnowledgeItem is updated. Zero code change.

Trace: one EVALUATE_THRESHOLD step per threshold evaluated
```

### Responsibility 9 — Rule Evaluation

```
For each ruleItem in ResolvedKnowledge (type='EVALUATION_RULE'):
  1. Parse rule conditions from ruleItem.metadata:
       {
         conditions: RuleCondition[]   // AND-joined conditions
         outcome: { pass: string, fail: string, exception: string }
         legalBasis: LegalBasisRef[]
       }
  2. Evaluate each condition against ReasoningContext
  3. All conditions pass → RuleStatus.PASS
  4. Any condition fails → RuleStatus.FAIL
  5. Any applicable exception (from Responsibility 7) → RuleStatus.EXCEPTION
  6. Context field missing → RuleStatus.INCONCLUSIVE + MissingEvidence

Example rule (as KnowledgeItem metadata, NOT code):
{
  conditions: [
    { field: 'fundSource', operator: 'EQ', value: 'STATE_BUDGET' },
    { field: 'estimatedValue', operator: 'GT', value: '100000000' }  // 100M
  ],
  outcome: {
    pass: 'Bảo lãnh tạm ứng bắt buộc theo Điều 18 TT 79/2025/TT-BTC',
    fail: 'Không bắt buộc bảo lãnh tạm ứng trong trường hợp này'
  }
}

Trace: one EVALUATE_RULE step per rule evaluated
```

---

## Stage 5 — Evidence Collection

**Class:** `EvidenceCollector`
**Input:** `AppliedDocument[]`, `AppliedArticle[]`, `RuleResult[]`, `ThresholdResult[]`, `DetectedException[]`, `ResolvedKnowledge`
**Output:** consolidated evidence set, `MissingEvidence[]`

### Responsibility 10 — Evidence Collection

```
Consolidation:
  1. Collect all AppliedArticle[] with role = PRIMARY_BASIS or SUPPORTING_BASIS
  2. Collect all RuleResult[] with status = PASS or EXCEPTION
  3. Collect all ThresholdResult[]
  4. Cross-reference: every RuleResult must have at least one AppliedArticle backing it
     If no backing article found → flag as WEAK_EVIDENCE → warning

Missing evidence detection:
  For each INCONCLUSIVE RuleResult:
    Create MissingEvidence {
      description: 'Thiếu thông tin: [missing context field]',
      isCritical: rule.isCritical,
      suggestedSources: rule.sourceDomains,
      impact: 'Không thể xác định kết quả quy tắc [ruleName]'
    }

  For each PRIMARY_BASIS article with unresolved citations:
    Create MissingEvidence {
      description: 'Chưa tìm thấy văn bản được trích dẫn: [citation.formatted]',
      isCritical: citation.isNormative,
      suggestedSources: [citation.documentSymbol],
      impact: 'Thiếu cơ sở pháp lý bổ sung'
    }

Evidence sufficiency assessment:
  SUFFICIENT:     at least 1 PRIMARY_BASIS article, 0 CRITICAL missing evidence
  PARTIAL:        at least 1 PRIMARY_BASIS article, ≥ 1 non-critical missing evidence
  INSUFFICIENT:   0 PRIMARY_BASIS articles OR ≥ 1 CRITICAL missing evidence
  → INSUFFICIENT: humanReviewRequired = true

Trace: one COLLECT_EVIDENCE step, one IDENTIFY_MISSING_EVIDENCE step,
       one ASSESS_EVIDENCE_SUFFICIENCY step
```

---

## Stage 6 — Citation Formatter

**Class:** `CitationFormatter`
**Input:** `AppliedArticle[]`, `AppliedDocument[]`
**Output:** `FormattedCitation[]`

### Responsibility 11 — Citation Generation

```
For each AppliedArticle:
  Format full citation:
    '[Article] [Clause?] [Point?] [DocumentType] [DocumentNumber]/[Year]/[IssuingBody]'
    Example: 'Điều 15 khoản 2 điểm a Thông tư 79/2025/TT-BTC ngày 15 tháng 3 năm 2025'

  Format short citation:
    'Đ[article].[clause?].[point?] [TypeCode] [Number]/[Year]'
    Example: 'Đ15.2.a TT 79/2025'

  Format inline citation:
    '(Điều 15 khoản 2 TT 79/2025/TT-BTC)'

Citation chain building:
  When article A (IMPLEMENTS) → law B (IMPLEMENTS) → law C:
  Chain: C (primary) → B (implementing decree) → A (implementing circular)
  Format: 'Điều 15 TT 79/2025/TT-BTC, thực hiện Điều 68 Luật 22/2023/QH15'

PRIMARY citation marker:
  The first PRIMARY_BASIS citation is marked isPrimary = true
  All others: isPrimary = false

Normative vs informational:
  Articles with role = PRIMARY_BASIS or SUPPORTING_BASIS: isNormative = true
  Articles with role = CROSS_REFERENCE or SUPERSEDED_CONTEXT: isNormative = false

Trace: one FORMAT_CITATION step per FormattedCitation created
       one BUILD_CITATION_CHAIN step if chains are built
```

---

## Stage 7 — Answer Composer

**Class:** `AnswerComposer`
**Input:** all outputs from Stages 1–6 + accumulated `reasoningTrace[]`
**Output:** complete `ReasoningResult`

### Responsibility 12 — Reasoning Trace Assembly

```
Consolidate all ReasoningStep[] appended by each stage
Sort by: stage order, then time within stage
Assign sequential stepIds
Package as ReasoningResult.reasoningTrace
```

### Responsibility 13 — Confidence Score Computation

```
Start: baseScore = 1.00

Apply deductions in order:
  1. Unresolved normative citations:      −0.10 each, max −0.20 total
  2. Resolved conflicts:                  −0.08 each, max −0.24 total
  3. Unresolved conflicts:                −0.20 each, triggers humanReviewRequired
  4. Superseded document used (current date context): −0.15 each, max −0.30 total
  5. Missing critical evidence:           −0.20 each, triggers humanReviewRequired
  6. Missing non-critical evidence:       −0.05 each, max −0.15 total
  7. Low-quality knowledge item (quality < 0.70) in PRIMARY_BASIS role:
                                          −(0.70 − quality) per item
  8. Unverified AI-extracted item in PRIMARY_BASIS role: −0.10 each
  9. Unresolved exceptions:               −0.10 each, max −0.20 total
  10. Ambiguous intent detection:         −0.10
  11. Partial context (required fields missing): −0.05 per missing field, max −0.15

finalScore = max(0.00, baseScore − sum(deductions))

confidenceLabel:
  finalScore ≥ 0.85  → HIGH
  finalScore ≥ 0.70  → MEDIUM
  finalScore ≥ 0.50  → LOW
  finalScore < 0.50  → VERY_LOW → humanReviewRequired = true
```

### Responsibility 14 — Human Review Recommendation

```
humanReviewRequired = true if ANY of:
  - confidence < 0.50
  - any DetectedConflict with resolution = UNRESOLVED
  - any MissingEvidence with isCritical = true
  - count of DetectedException with isApplicable = null > 3
  - any load-bearing KnowledgeItem (role = PRIMARY_BASIS) with qualityScore.overall < 0.50
  - any pipeline stage flagged humanReviewRequired

humanReviewReason: aggregate all trigger reasons into a single explanation string
```

### Responsibility 15 — Explainability

```
Build ReasoningExplanation at the requested outputFormat:

DECISION:
  summary: 1–3 sentences (Vietnamese)
  decisionRationale: why this decision
  keyProvisions: top 3 AppliedArticles as ExplainedProvision

EXPLANATION:
  All of DECISION +
  Full explainedProvisions (all applied articles)
  conflictSummary (if conflicts were resolved)
  whatIsMissing (plain-language missing evidence)
  nextSteps (actionable list)

FULL_TRACE:
  All of EXPLANATION +
  Complete reasoningTrace with all ReasoningStep details
  All DetectedConflict details with resolution reasoning
  All DetectedException details
  All ThresholdResult + RuleResult details

LEGAL_MEMO:
  Vietnamese legal memo structure:
    Heading:   'PHIẾU TƯ VẤN PHÁP LÝ — [date]'
    Subject:   restated question in formal Vietnamese legal language
    Căn cứ:   all primary citations in formal list format
    Phân tích: structured analysis of each applicable provision
    Kết luận:  decision restated as legal conclusion
    Lưu ý:     warnings, exceptions, and human review triggers (if any)
```

### Decision Composition

```
if confidence ≥ 0.50:
  decision = composed answer string (Vietnamese)
  Example: 'Theo Điều 15 khoản 1 TT 79/2025/TT-BTC, mức tạm ứng tối đa là 30% giá trị hợp đồng
            đối với nguồn vốn ngân sách nhà nước. Quy chế nội bộ đơn vị giới hạn 20%.
            Áp dụng: 20% (quy định nội bộ nghiêm ngặt hơn).'

if confidence < 0.50:
  decision = null
  humanReviewRequired = true
  explainability.summary = explanation of why a decision cannot be made automatically

Trace: COMPUTE_CONFIDENCE, DETERMINE_HUMAN_REVIEW, COMPOSE_DECISION, GENERATE_EXPLANATION,
       GENERATE_WARNINGS — one step each
```

---

## Inter-Stage Data Contract

```typescript
interface PipelineState {
  question:             ReasoningQuestion
  intent:               ReasoningIntent          // set by Stage 1
  resolvedKnowledge:    ResolvedKnowledge        // set by Stage 2
  appliedDocuments:     AppliedDocument[]        // built by Stage 3
  appliedArticles:      AppliedArticle[]         // built by Stage 3
  detectedConflicts:    DetectedConflict[]       // built by Stage 3
  detectedExceptions:   DetectedException[]      // built by Stage 4
  ruleResults:          RuleResult[]             // built by Stage 4
  thresholdResults:     ThresholdResult[]        // built by Stage 4
  missingEvidence:      MissingEvidence[]        // built by Stage 5
  citations:            FormattedCitation[]      // built by Stage 6
  warnings:             ReasoningWarning[]       // appended by any stage
  reasoningTrace:       ReasoningStep[]          // appended by every stage
  humanReviewRequired:  boolean                  // any stage may set to true
  humanReviewReasons:   string[]                 // accumulated from all stages
}
```

`DefaultLegalReasoningEngine` creates and passes `PipelineState` through all 7 stages sequentially. Each stage mutates it. The final state is assembled into `ReasoningResult` by `AnswerComposer`.
