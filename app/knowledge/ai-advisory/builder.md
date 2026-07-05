# AIContextBuilder — Build Strategy · Token Budget · Compression

Part of: [ai-context-contract.md](../decisions/ai-context-contract.md)

---

## 1. IAIContextBuilder

```typescript
interface IAIContextBuilder {
  // Primary build method
  build(
    question:  ReasoningQuestion,
    result:    ReasoningResult,
    options?:  AIContextBuildOptions
  ): Promise<AIContext>

  // Build with multi-turn conversation history
  buildWithHistory(
    question:  ReasoningQuestion,
    result:    ReasoningResult,
    history:   AIContextMessage[],
    options?:  AIContextBuildOptions
  ): Promise<AIContext>

  // Estimate token count for a built context against a specific model
  estimateTokens(context: AIContext, model: ModelCapabilities): number

  // Compress an existing AIContext to fit within a token budget
  compress(context: AIContext, targetTokens: number, model: ModelCapabilities): AIContext
}

interface AIContextBuildOptions {
  outputLanguage?:     'vi' | 'en' | 'follow_question'   // default 'follow_question'
  outputFormat?:       AIOutputFormat                      // default 'CONVERSATIONAL'
  tone?:               AIOutputTone                        // default 'PROFESSIONAL'
  citationStyle?:      AICitationStyle                     // default 'INLINE'
  responseLength?:     'BRIEF' | 'STANDARD' | 'DETAILED'  // default 'STANDARD'
  includeTrace?:       boolean                             // default false
  maxHistoryTurns?:    number                              // default 5
  attachmentIds?:      string[]                            // Storage refs to include
  customInstructions?: string                              // additional LLM instructions
  targetModel?:        string                              // model ID; affects token budgeting
}
```

---

## 2. Build Strategy

`DefaultAIContextBuilder.build()` executes these steps in order:

```
Step 1: Validate inputs
  - result must be non-null
  - question.question must be non-empty
  - Generate contextId (UUID)

Step 2: Map ReasoningResult → AIContext fields
  question:              ← ReasoningQuestion.question
  intent:                ← map(ReasoningResult.intent)
  decision:              ← ReasoningResult.decision
  confidence:            ← ReasoningResult.confidence
  confidenceLabel:       ← ReasoningResult.confidenceLabel
  humanReviewRequired:   ← ReasoningResult.humanReviewRequired
  humanReviewReason:     ← ReasoningResult.humanReviewReason
  asOfDate:              ← ReasoningResult.asOfDate
  language:              ← detect from question or default 'vi'

Step 3: Build legalBasis[]
  Source: ReasoningResult.appliedArticles + ReasoningResult.appliedDocuments
  Map each to AIContextLegalBasis:
    - provisionText: trimmed to 500 chars; '...' appended if truncated
    - role mapped: PRIMARY_BASIS → 'PRIMARY'; SUPPORTING_BASIS → 'SUPPORTING'; etc.
  Sort: PRIMARY first; then SUPPORTING; then by authorityLevel ASC

Step 4: Build citations[]
  Source: ReasoningResult.citations (FormattedCitation[])
  Map each to AIContextCitation:
    - copy full / short / inline from FormattedCitation
    - compute chain if IMPLEMENTS relations exist in appliedArticles

Step 5: Build evidence[]
  Source: ReasoningResult.appliedArticles + ruleResults + thresholdResults + similarCases
  Map each to AIContextEvidence:
    - legal articles → domain='legal', role from AppliedRole
    - rule results → domain='procurement'
    - similar cases → domain='cases', role='EXAMPLE'
  Sort: PRIMARY_BASIS first; then confidence DESC

Step 6: Summarize reasoningTrace[]
  Source: ReasoningResult.reasoningTrace (may have 50–100 steps)
  Keep only steps where:
    - stage IN ['REASONING', 'RULE_EVALUATION', 'CONFLICT_RESOLUTION', 'ANSWER_COMPOSITION']
    - OR step.flagged = true
    - OR step.humanReviewTriggered = true
  Maximum 10 steps
  Map each to AIContextTraceStep with summary (step.description)

Step 7: Build warnings[]
  Source: ReasoningResult.warnings
  Map severity, message, suggestion
  Sort: CRITICAL first

Step 8: Build missingInformation[]
  Source: ReasoningResult.missingEvidence
  Map description, isCritical, suggestedSources, impact

Step 9: Build recommendedActions[]
  Source: derive from ruleResults (FAIL → CORRECT_VIOLATION action)
          + missingEvidence (CRITICAL → SUBMIT_DOCUMENT or CONSULT_LEGAL)
          + humanReviewRequired (→ CONSULT_LEGAL with priority=REQUIRED)
          + thresholdResults (trigger → PUBLISH_NOTICE, GET_APPROVAL, PREPARE_GUARANTEE)

Step 10: Build attachments[]
  Source: options.attachmentIds (Storage service refs — Phase K)
  For each: fetch metadata; set isIncluded = (textSummary available AND tokenCount fits budget)

Step 11: Prune conversationHistory[]
  Source: history[] (from buildWithHistory) or []
  Strategy: see token budget section

Step 12: Build systemInstructions
  role: 'Chuyên gia tư vấn đấu thầu và pháp lý mua sắm công Việt Nam'
  outputLanguage: options.outputLanguage ?? 'follow_question'
  outputFormat: options.outputFormat ?? 'CONVERSATIONAL'
  tone: options.tone ?? 'PROFESSIONAL'
  citationStyle: options.citationStyle ?? 'INLINE'
  responseLength: options.responseLength ?? 'STANDARD'
  confidenceDisclosure: confidenceLabel IN ['LOW', 'VERY_LOW']
  uncertaintyBehavior: confidence < 0.70 ? 'DISCLOSE' : 'REDIRECT_TO_REVIEW'
  forbiddenBehaviors: STANDARD_FORBIDDEN_BEHAVIORS + contextual additions (see below)
  allowedKnowledgeSources: ['CONTEXT_ONLY']
  contextSummary: generate 2-sentence summary of what is in this context

Step 13: Compute totalTokenEstimate
  Use TokenBudgetManager.estimate(context, targetModel ?? 'DEFAULT')

Step 14: Compress if over budget
  If totalTokenEstimate > targetModel.maxContextTokens × 0.85:
    context = compress(context, targetModel.maxContextTokens × 0.80, targetModel)

Step 15: Object.freeze(context)
  Return frozen AIContext
```

### Contextual forbidden behavior injections

```
if humanReviewRequired:
  forbiddenBehaviors.push(
    'Không được đưa ra kết luận pháp lý cuối cùng — trường hợp này cần xem xét bởi chuyên gia'
  )

if confidenceLabel = 'VERY_LOW':
  forbiddenBehaviors.push(
    'Chỉ mô tả những gì đã được xác minh; không suy đoán câu trả lời'
  )

if warnings.any(w => w.severity = 'CRITICAL'):
  forbiddenBehaviors.push(
    'Phải đề cập cảnh báo CRITICAL ngay đầu câu trả lời trước khi trả lời câu hỏi'
  )

if missingInformation.any(m => m.isCritical):
  forbiddenBehaviors.push(
    'Phải nêu rõ thông tin còn thiếu ảnh hưởng đến độ chính xác của câu trả lời'
  )
```

---

## 3. Token Budget Management

### Default Token Allocations

```
Total budget:     model.maxContextTokens × 0.85 (15% reserved for LLM response)

Fixed allocations (always present, cannot be compressed):
  System prompt text:            ~800 tokens
  Question + intent:             ~400 tokens
  Decision + confidence:         ~150 tokens
  humanReviewRequired status:    ~50 tokens
  ──────────────────────────────────────────
  Fixed total:                   ~1400 tokens

Variable allocations (subject to compression):
  legalBasis[] (provisionText):  ~3000 tokens  (priority 1 — most important)
  citations[]:                   ~600  tokens  (priority 2 — formatting only)
  warnings[] + missingInfo[]:    ~400  tokens  (priority 3 — critical safety)
  recommendedActions[]:          ~300  tokens  (priority 4 — actionable)
  evidence[]:                    ~3000 tokens  (priority 5 — supporting)
  reasoningTrace[]:              ~600  tokens  (priority 6 — background)
  conversationHistory[]:         ~2000 tokens  (priority 7 — context)
  attachments[].textSummary:     ~1500 tokens  (priority 8 — user files)
  ──────────────────────────────────────────
  Variable total (default):      ~11400 tokens

Grand total (default):           ~12800 tokens  (fits all models ≥ 16K context)
```

### Model-Specific Budgets

```
Model context window → allocated for AIContext:
  4K  tokens (legacy):    3400 tokens  → aggressive compression required
  8K  tokens:             6800 tokens  → moderate compression
  16K tokens (standard):  13600 tokens → light compression
  32K tokens:             27200 tokens → no compression usually needed
  128K tokens (Claude 3): 108800 tokens → full context always fits
  200K tokens (Claude 4): no budget concern
```

### Compression Priority Order

When the context must be reduced, fields are trimmed in this order (lowest priority dropped first):

```
Priority 8 — DROP FIRST:
  attachments[].textSummary: replace with 'Tệp: [filename] (nội dung không hiển thị)'
  if still over budget → remove attachment entries with isIncluded=false (keep name-only refs)

Priority 7:
  conversationHistory[]: drop oldest turns first, always keeping last 2 user+assistant pairs
  when a turn is dropped: insert '[Đã ẩn [N] tin nhắn cũ]' placeholder

Priority 6:
  reasoningTrace[]: reduce to top 3 steps only (REASONING + CONFLICT_RESOLUTION + final)

Priority 5:
  evidence[]: drop .detail fields on all SUPPORTING evidence
  if still over: drop all SUPPORTING evidence items (keep PRIMARY only)
  if still over: truncate PRIMARY evidence .summary to 100 chars each

Priority 4:
  recommendedActions[]: drop OPTIONAL actions; keep REQUIRED and RECOMMENDED

Priority 3:
  missingInformation[]: drop non-critical items
  warnings[]: drop LOW severity

Priority 2:
  citations[]: merge chain citations to inline only; drop full/short forms

Priority 1 — NEVER DROP:
  legalBasis[] PRIMARY items (provisionText up to 200 chars each, non-negotiable floor)
  decision + confidence + confidenceLabel
  humanReviewRequired + humanReviewReason
  question
  systemInstructions
```

If after all compressions the context still exceeds budget:
- Truncate `legalBasis[].provisionText` to 100 chars each
- Log `CONTEXT_OVERFLOW` error
- Set `systemInstructions.customInstructions += ' [Ngữ cảnh đã bị rút gọn do giới hạn kích thước]'`

---

## 4. RecommendedAction Generation Rules

`DefaultAIContextBuilder` derives `recommendedActions[]` from `ReasoningResult` automatically.

```
Source: RuleResult (FAIL) → AIContextAction:
  RULE-M01 FAIL (estimatedValue > threshold, no open tender):
    → REQUIRED action: 'Tổ chức đấu thầu rộng rãi theo quy định'
    → legalRef: RULE-M01.legalBasis[0].citationShort

Source: RuleResult (FAIL, ADVANCE_GUARANTEE_REQUIRED):
    → REQUIRED action: 'Yêu cầu nhà thầu nộp bảo lãnh tạm ứng trước khi thanh toán'
    → templateRef: KnowledgeItem ID of GUARANTEE_ADVANCE template

Source: MissingEvidence (isCritical=true):
    → RECOMMENDED action: 'Bổ sung thông tin: [missingEvidence.description]'
    → actionType: SUBMIT_DOCUMENT (if a document is suggested) or CONSULT_LEGAL

Source: humanReviewRequired=true:
    → REQUIRED action: 'Tham vấn bộ phận pháp lý hoặc chuyên gia đấu thầu'
    → actionType: CONSULT_LEGAL

Source: DetectedConflict (UNRESOLVED):
    → REQUIRED action: 'Xin ý kiến pháp lý về xung đột giữa [A] và [B]'
    → actionType: CONSULT_LEGAL

Source: ThresholdResult (approvalThreshold exceeded):
    → REQUIRED action: 'Trình [authority level] phê duyệt (giá trị vượt thẩm quyền Giám đốc)'
    → actionType: GET_APPROVAL
```

Actions are deduplicated by `actionType + description`. REQUIRED actions precede RECOMMENDED precede OPTIONAL.
